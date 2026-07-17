import "server-only";
import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  pipeline,
} from "@huggingface/transformers";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nlp = require("compromise");

// ── Model IDs ────────────────────────────────────────────────────────────────
const CLIP_MODEL = "Xenova/clip-vit-base-patch32";
const BLIP_MODEL = "mozilla/distilvit";

// ── Singleton model instances ─────────────────────────────────────────────────
let tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | null = null;
let textModel: Awaited<ReturnType<typeof CLIPTextModelWithProjection.from_pretrained>> | null = null;
let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null;
let visionModel: Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let captionPipeline: any | null = null;

// ── Stopwords to strip from NLP output ───────────────────────────────────────
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "it", "its", "are", "was",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "shall", "can",
  "this", "that", "these", "those", "there", "their", "they", "them",
  "we", "us", "our", "you", "your", "he", "she", "him", "her", "his",
  "photo", "picture", "image", "background",
]);

// ── Utility ───────────────────────────────────────────────────────────────────
/** Dot product — equals cosine similarity when both vectors are L2-normalised */
export function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

// ── CLIP text pipeline ────────────────────────────────────────────────────────
async function getTextPipeline() {
  if (!tokenizer) tokenizer = await AutoTokenizer.from_pretrained(CLIP_MODEL);
  if (!textModel) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textModel = await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "fp32" } as any);
  }
  return { tokenizer, textModel };
}

// ── CLIP vision pipeline ──────────────────────────────────────────────────────
async function getVisionPipeline() {
  if (!processor) processor = await AutoProcessor.from_pretrained(CLIP_MODEL);
  if (!visionModel) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visionModel = await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "fp32" } as any);
  }
  return { processor, visionModel };
}

// ── BLIP captioning pipeline ──────────────────────────────────────────────────
async function getCaptionPipeline() {
  if (!captionPipeline) {
    captionPipeline = await pipeline("image-to-text", BLIP_MODEL);
  }
  return captionPipeline;
}

// ── Public: CLIP text embedding ───────────────────────────────────────────────
/** Generate a 512-dim CLIP text embedding (L2-normalised) */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const { tokenizer, textModel } = await getTextPipeline();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputs = await (tokenizer as any)(text, { padding: true, truncation: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { text_embeds } = await (textModel as any)(inputs);
  return l2normalize(Array.from(text_embeds.data as Float32Array));
}

// ── Public: CLIP image embedding ──────────────────────────────────────────────
/** Generate a 512-dim CLIP image embedding (L2-normalised) from a Buffer or Blob */
export async function generateImageEmbedding(input: Buffer | Blob): Promise<number[]> {
  const { processor, visionModel } = await getVisionPipeline();

  const arrayBuffer =
    input instanceof Blob
      ? await input.arrayBuffer()
      : (input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer);

  const image = await RawImage.fromBlob(new Blob([arrayBuffer]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputs = await (processor as any)(image);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { image_embeds } = await (visionModel as any)(inputs);
  return l2normalize(Array.from(image_embeds.data as Float32Array));
}

export async function generateCaptionAndTags(
  input: Buffer | Blob
): Promise<{ caption: string; tags: string[] }> {
  const captioner = await getCaptionPipeline();

  const arrayBuffer =
    input instanceof Blob
      ? await input.arrayBuffer()
      : (input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer);

  const blob = new Blob([arrayBuffer]);
  const objectUrl = URL.createObjectURL(blob);
  let caption = "";

  try {
    const result: Array<{ generated_text: string }> = await captioner(objectUrl) as any;
    caption = result[0]?.generated_text?.trim() ?? "";
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const doc = nlp(caption);
  const rawTerms: string[] = [
    ...(doc.nouns().out("array") as any[]),
    ...(doc.adjectives().out("array") as any[]),
  ];

  const tags = [
    ...new Set(
      rawTerms
        .map((t: string) => t.toLowerCase().trim().replace(/[^a-z0-9\s'-]/g, ""))
        .filter((t: string) => t.length > 2 && !STOPWORDS.has(t))
    ),
  ];

  return { caption, tags };
}
