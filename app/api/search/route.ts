import type { GalleryImage } from "@/lib/image-response";
import type { Document } from "mongodb";
import { planSearch, searchTagEvidence } from "@/lib/search-categories";
import { getDb } from "@/lib/mongodb";
import { generateTextEmbedding, dotProduct } from "@/lib/embeddings";

const MAX_RESULTS = 50;
const MAX_CACHED_PROMPTS = 128;
const promptCache = new Map<string, Promise<number[]>>();

function embedPrompt(prompt: string) {
  const cached = promptCache.get(prompt);
  if (cached) return cached;

  if (promptCache.size >= MAX_CACHED_PROMPTS) {
    const oldest = promptCache.keys().next().value;
    if (oldest !== undefined) promptCache.delete(oldest);
  }
  const embedding = generateTextEmbedding(prompt).catch((error: unknown) => {
    if (promptCache.get(prompt) === embedding) promptCache.delete(prompt);
    throw error;
  });
  promptCache.set(prompt, embedding);
  return embedding;
}

async function embedPrompts(prompts: string[]) {
  const embeddings: number[][] = [];
  for (const prompt of prompts) embeddings.push(await embedPrompt(prompt));
  return embeddings;
}

function visualEvidence(embedding: unknown, prompts: number[][]) {
  if (!Array.isArray(embedding) || embedding.length === 0) return 0;
  return Math.max(0, ...prompts.map((vector) =>
    vector.length === embedding.length ? dotProduct(vector, embedding) : 0));
}

function searchImage(image: Document): GalleryImage {
  return {
    _id: image._id.toString(),
    url: image.url,
    thumbnailUrl: image.thumbnailKey ? `/api/proxy/${image.thumbnailKey}` : undefined,
    filename: image.filename,
    createdAt: image.createdAt.toISOString(),
    tags: image.tags,
    indexingState: image.indexing?.state,
  };
}

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("q")?.trim();
  if (query && query.length > 200) {
    return Response.json({ error: "Search queries are limited to 200 characters." }, { status: 400 });
  }

  const db = await getDb();
  const images = await db.collection("images").find({}, { sort: { createdAt: -1, _id: -1 } }).toArray();
  if (!query) return Response.json(images.map(searchImage));

  const plan = planSearch(query);
  const results: Array<{ image: Document; rank: number }> = [];
  const visualCandidates: Array<{ image: Document; contextualMatch: boolean }> = [];

  for (const image of images) {
    const evidence = searchTagEvidence(plan, image.tags);
    if (evidence === "rival") continue;
    if (evidence === "direct") {
      results.push({ image, rank: 3 });
    } else if (evidence === "related" && !plan.contextual) {
      results.push({ image, rank: 2 });
    } else if (Array.isArray(image.embedding) && image.embedding.length > 0) {
      visualCandidates.push({ image, contextualMatch: evidence === "related" });
    }
  }

  if (visualCandidates.length) {
    try {
      const positive = await embedPrompts(plan.positivePrompts);
      const negative = await embedPrompts(plan.negativePrompts);
      for (const { image, contextualMatch } of visualCandidates) {
        const score = visualEvidence(image.embedding, positive);
        const margin = score - visualEvidence(image.embedding, negative);
        const minimum = contextualMatch ? 0.27 : plan.known ? 0.28 : 0.30;
        if (score >= minimum && margin >= 0.025) {
          results.push({ image, rank: (contextualMatch ? 1 : 0) + margin });
        }
      }
    } catch (error) {
      console.error("Visual search unavailable", error);
      if (!results.length) {
        return Response.json({ error: "Visual search is temporarily unavailable." }, { status: 503 });
      }
    }
  }

  results.sort((a, b) => b.rank - a.rank);
  const page = plan.broad ? results : results.slice(0, MAX_RESULTS);
  return Response.json(page.map(({ image }) => searchImage(image)));
}
