import "server-only";
import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
} from "@huggingface/transformers";

const MODEL_ID = "Xenova/clip-vit-base-patch32";

let tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | null = null;
let textModel: Awaited<ReturnType<typeof CLIPTextModelWithProjection.from_pretrained>> | null = null;
let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null;
let visionModel: Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>> | null = null;
let tagEmbeddingsCache: Map<string, number[]> | null = null;

export const CANDIDATE_TAGS = [
  "pizza", "burger", "sushi", "pasta", "salad", "rice", "soup", "sandwich",
  "cake", "dessert", "coffee", "fruit", "vegetables", "seafood", "meat",
  "breakfast", "street food", "snack", "food",
  "beach", "ocean", "mountain", "forest", "sky", "sunset", "flowers", "garden",
  "lake", "river", "snow", "nature",
  "cat", "dog", "bird", "horse", "fish", "wildlife",
  "person", "portrait", "selfie", "family", "crowd",
  "sports", "running", "gym", "yoga", "cooking", "travel",
  "city", "building", "street", "indoor", "outdoor", "architecture",
  "car", "computer", "phone", "art", "fashion", "music",
];

export function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

async function getTextPipeline() {
  if (!tokenizer) {
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  }
  if (!textModel) {
    textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: "fp32" } as any);
  }
  return { tokenizer, textModel };
}

async function getVisionPipeline() {
  if (!processor) {
    processor = await AutoProcessor.from_pretrained(MODEL_ID);
  }
  if (!visionModel) {
    visionModel = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { dtype: "fp32" } as any);
  }
  return { processor, visionModel };
}

export async function generateTextEmbedding(text: string): Promise<number[]> {
  const { tokenizer, textModel } = await getTextPipeline();
  const inputs = await (tokenizer as any)(text, { padding: true, truncation: true });
  const { text_embeds } = await (textModel as any)(inputs);
  const vec = Array.from(text_embeds.data as Float32Array);
  return l2normalize(vec);
}

export async function generateImageEmbedding(input: Buffer | Blob): Promise<number[]> {
  const { processor, visionModel } = await getVisionPipeline();

  const arrayBuffer =
    input instanceof Blob
      ? await input.arrayBuffer()
      : input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;

  const image = await RawImage.fromBlob(new Blob([arrayBuffer]));
  const inputs = await (processor as any)(image);
  const { image_embeds } = await (visionModel as any)(inputs);
  const vec = Array.from(image_embeds.data as Float32Array);
  return l2normalize(vec);
}

export async function autoTagImage(imageEmbedding: number[], topK = 5): Promise<string[]> {
  if (!tagEmbeddingsCache) {
    tagEmbeddingsCache = new Map();
    for (const tag of CANDIDATE_TAGS) {
      const emb = await generateTextEmbedding(`a photo of ${tag}`);
      tagEmbeddingsCache.set(tag, emb);
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
