import "server-only";
import { pipeline } from "@huggingface/transformers";

type Pipeline = Awaited<ReturnType<typeof pipeline>>;

let imageExtractor: Pipeline | null = null;
let textExtractor: Pipeline | null = null;
let tagEmbeddingsCache: Map<string, number[]> | null = null;

export const CANDIDATE_TAGS = [
  // Food & drink
  "pizza", "burger", "sushi", "pasta", "salad", "rice", "soup", "sandwich",
  "cake", "dessert", "coffee", "fruit", "vegetables", "seafood", "meat",
  "breakfast", "street food", "snack", "food",
  // Nature
  "beach", "ocean", "mountain", "forest", "sky", "sunset", "flowers", "garden",
  "lake", "river", "snow", "nature",
  // Animals
  "cat", "dog", "bird", "horse", "fish", "wildlife",
  // People
  "person", "portrait", "selfie", "family", "crowd",
  // Activities
  "sports", "running", "gym", "yoga", "cooking", "travel",
  // Places
  "city", "building", "street", "indoor", "outdoor", "architecture",
  // Objects
  "car", "computer", "phone", "art", "fashion", "music",
];

/** Dot product — equals cosine similarity when vectors are L2-normalised */
export function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

async function getImageExtractor(): Promise<Pipeline> {
  if (!imageExtractor) {
    imageExtractor = await pipeline(
      "image-feature-extraction",
      "Xenova/clip-vit-base-patch32",
      { dtype: "fp32" }
    );
  }
  return imageExtractor;
}

async function getTextExtractor(): Promise<Pipeline> {
  if (!textExtractor) {
    textExtractor = await pipeline(
      "feature-extraction",
      "Xenova/clip-vit-base-patch32",
      { dtype: "fp32" }
    );
  }
  return textExtractor;
}

/** Generate a 512-dim CLIP image embedding from a Buffer or Blob */
export async function generateImageEmbedding(input: Buffer | Blob): Promise<number[]> {
  const blob =
    input instanceof Blob
      ? input
      : new Blob([input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer], {
          type: "image/jpeg",
        });

  const objectUrl = URL.createObjectURL(blob);
  try {
    const model = await getImageExtractor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = await (model as any)(objectUrl, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Generate a 512-dim CLIP text embedding — lives in the same space as image embeddings */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const model = await getTextExtractor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output = await (model as any)(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Auto-tag an image using its already-computed embedding.
 * Compares against cached text embeddings of CANDIDATE_TAGS and returns
 * the top-K labels above the similarity threshold.
 */
export async function autoTagImage(imageEmbedding: number[], topK = 5): Promise<string[]> {
  // Build tag embedding cache once per process lifetime
  if (!tagEmbeddingsCache) {
    const model = await getTextExtractor();
    tagEmbeddingsCache = new Map();
    for (const tag of CANDIDATE_TAGS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await (model as any)(`a photo of ${tag}`, { pooling: "mean", normalize: true });
      tagEmbeddingsCache.set(tag, Array.from(out.data as Float32Array));
    }
  }

  const scores = Array.from(tagEmbeddingsCache.entries()).map(([label, emb]) => ({
    label,
    score: dotProduct(imageEmbedding, emb),
  }));

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((t) => t.score > 0.22)
    .map((t) => t.label);
}
