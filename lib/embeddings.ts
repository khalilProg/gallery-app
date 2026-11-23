import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from "@huggingface/transformers";
import { LABELS, labelPrompt } from "./labels.ts";
import { colorSubject, enrichTags, selectColor, selectVisualTags } from "./image-tags.ts";
import { CLIP_MODEL } from "./indexing.ts";

// ── Model IDs ────────────────────────────────────────────────────────────────
if (process.env.CLIP_CACHE_DIR) env.cacheDir = process.env.CLIP_CACHE_DIR;

// ── Singleton model instances ─────────────────────────────────────────────────
let textPipeline: ReturnType<typeof loadTextPipeline> | undefined;
let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null;
let visionModel: Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>> | null = null;

/**
 * Pre-computed label embeddings cache.
 * Built once on first tagging call, reused for all subsequent images.
 * { label → L2-normalised 512-dim CLIP text embedding }
 */
let labelEmbeddingCache: Map<string, number[]> | null = null;

const colors = ["black", "white", "gray", "red", "pink", "purple", "blue", "green",
  "yellow", "orange", "brown", "beige", "multicolored"];
const colorEmbeddings = new Map<string, { neutral: number[]; alternatives: Map<string, number[]> }>();

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
async function loadTextPipeline() {
  const tokenizer = await AutoTokenizer.from_pretrained(CLIP_MODEL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textModel = await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "fp32" } as any);
  return { tokenizer, textModel };
}

function getTextPipeline() {
  textPipeline ??= loadTextPipeline().catch((error: unknown) => {
    textPipeline = undefined;
    throw error;
  });
  return textPipeline;
}

async function getVisionPipeline() {
  if (!processor) processor = await AutoProcessor.from_pretrained(CLIP_MODEL);
  if (!visionModel) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visionModel = await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: "fp32" } as any);
  }
  return { processor, visionModel };
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

// ── Label embedding cache builder ─────────────────────────────────────────────
/**
 * Builds (once per process) a map of label → CLIP text embedding.
 * Labels with an ambiguous name get a prompt that includes their domain.
 */
async function getLabelEmbeddings(): Promise<Map<string, number[]>> {
  if (labelEmbeddingCache) return labelEmbeddingCache;

  console.log(`[embeddings] Building label cache for ${LABELS.length} labels…`);
  const cache = new Map<string, number[]>();

  for (const label of LABELS) {
    const emb = await generateTextEmbedding(labelPrompt(label));
    cache.set(label, emb);
  }

  labelEmbeddingCache = cache;
  console.log("[embeddings] Label cache ready.");
  return cache;
}

async function getColorEmbeddings(subject: string) {
  const cached = colorEmbeddings.get(subject);
  if (cached) return cached;

  const neutral = await generateTextEmbedding(`a product photo of a ${subject}`);
  const alternatives = new Map<string, number[]>();
  for (const color of colors) {
    alternatives.set(color, await generateTextEmbedding(`a product photo of a ${color} ${subject}`));
  }
  const result = { neutral, alternatives };
  colorEmbeddings.set(subject, result);
  return result;
}

export async function autoTagImage(imageEmbedding: number[]): Promise<string[]> {
  const labelEmbs = await getLabelEmbeddings();
  const visual = selectVisualTags(Array.from(labelEmbs, ([label, embedding]) => ({
    label, score: dotProduct(imageEmbedding, embedding),
  })));
  const subject = visual[0] ? colorSubject(visual[0]) : undefined;
  if (!subject) return enrichTags(visual);

  const { neutral, alternatives } = await getColorEmbeddings(subject);
  const color = selectColor(Array.from(alternatives, ([label, embedding]) => ({
    label, score: dotProduct(imageEmbedding, embedding),
  })), dotProduct(imageEmbedding, neutral));
  return enrichTags(visual, color ? `${color} ${subject}` : undefined);
}
