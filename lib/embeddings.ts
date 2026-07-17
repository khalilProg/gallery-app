import "server-only";
import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
} from "@huggingface/transformers";
import { LABELS } from "./labels";

// ── Model IDs ────────────────────────────────────────────────────────────────
const CLIP_MODEL = "Xenova/clip-vit-base-patch32";

// ── Singleton model instances ─────────────────────────────────────────────────
let tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | null = null;
let textModel: Awaited<ReturnType<typeof CLIPTextModelWithProjection.from_pretrained>> | null = null;
let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null;
let visionModel: Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>> | null = null;

/**
 * Pre-computed label embeddings cache.
 * Built once on first tagging call, reused for all subsequent images.
 * { label → L2-normalised 512-dim CLIP text embedding }
 */
let labelEmbeddingCache: Map<string, number[]> | null = null;

// ── Tagging config ────────────────────────────────────────────────────────────
/** Minimum CLIP similarity score for a label to be assigned as a tag */
const TAG_THRESHOLD = 0.245;
/** Maximum number of tags to assign per image */
const MAX_TAGS = 6;

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
 * All 500+ labels are embedded with the "a photo of <label>" prompt
 * that CLIP was trained on, maximising zero-shot accuracy.
 */
async function getLabelEmbeddings(): Promise<Map<string, number[]>> {
  if (labelEmbeddingCache) return labelEmbeddingCache;

  console.log(`[embeddings] Building label cache for ${LABELS.length} labels…`);
  const cache = new Map<string, number[]>();

  for (const label of LABELS) {
    const emb = await generateTextEmbedding(`a photo of ${label}`);
    cache.set(label, emb);
  }

  labelEmbeddingCache = cache;
  console.log("[embeddings] Label cache ready.");
  return cache;
}

// ── Public: auto-tag image ────────────────────────────────────────────────────
/**
 * Tags an image using CLIP zero-shot classification against a comprehensive
 * 500+ label taxonomy covering animals, food, fashion, culture, geography,
 * nature, and more.
 *
 * Uses the pre-computed image embedding (no extra model calls) and the
 * shared label embedding cache (built once, reused forever).
 *
 * Returns only labels whose CLIP similarity exceeds TAG_THRESHOLD,
 * capped at MAX_TAGS, sorted by confidence descending.
 */
export async function autoTagImage(imageEmbedding: number[]): Promise<string[]> {
  const labelEmbs = await getLabelEmbeddings();

  const scored: Array<{ label: string; score: number }> = [];
  for (const [label, emb] of labelEmbs) {
    scored.push({ label, score: dotProduct(imageEmbedding, emb) });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .filter((t) => t.score > TAG_THRESHOLD)
    .slice(0, MAX_TAGS)
    .map((t) => t.label);
}
