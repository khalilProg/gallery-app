import type { GalleryPage } from "@/lib/image-response";
import { IMAGE_PROJECTION, imageResponse, type ImageRecord } from "@/lib/image-record";
import { GET as galleryPage } from "../images/route";
import { ObjectId } from "mongodb";
import { descriptionMatches, planSearch, searchTagEvidence } from "@/lib/search-categories";
import { visibleAiTags } from "@/lib/photo-metadata";
import { getDb } from "@/lib/mongodb";
import { generateTextEmbedding, dotProduct } from "@/lib/embeddings";

const PAGE_SIZE = 12;
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

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const query = params.get("q")?.trim().replace(/\s+/g, " ");
  if (!query) return galleryPage(req);
  let cursor: { query: string; rank: number; date: string; id: string } | undefined;
  if (params.has("cursor")) {
    try {
      const raw = params.get("cursor")!;
      if (raw.length > 2048) throw new Error("Cursor too long");
      const parsed = JSON.parse(Buffer.from(raw, "base64url").toString());
      if (parsed.query !== query || !Number.isFinite(parsed.rank) ||
          typeof parsed.date !== "string" || new Date(parsed.date).toISOString() !== parsed.date ||
          typeof parsed.id !== "string" || !ObjectId.isValid(parsed.id)) throw new Error("Invalid cursor");
      cursor = parsed;
    } catch {
      return Response.json({ error: "Invalid search cursor." }, { status: 400 });
    }
  }
  try {
  if (query && query.length > 200) {
    return Response.json({ error: "Search queries are limited to 200 characters." }, { status: 400 });
  }

    const db = await getDb();
    const images = await db.collection<ImageRecord>("images").find({}, { projection: { ...IMAGE_PROJECTION, embedding: 1 }, sort: { createdAt: -1, _id: -1 } }).toArray();

    const plan = planSearch(query);
    const manualPlan = { ...plan, rivals: new Set<string>() };
    const results: Array<{ image: ImageRecord; rank: number }> = [];
    const visualCandidates: Array<{ image: ImageRecord; contextualMatch: boolean }> = [];

    for (const image of images) {
      const manual = searchTagEvidence(manualPlan, image.manualTags);
      if (manual === "direct" || descriptionMatches(plan, image.description)) {
        results.push({ image, rank: 4 });
        continue;
      }
      if (manual === "related" && !plan.contextual) {
        results.push({ image, rank: 3 });
        continue;
      }
      if (image.removedAiTags?.some((tag) => searchTagEvidence(plan, [tag]) === "direct")) continue;

      const evidence = searchTagEvidence(plan, visibleAiTags(image.tags, image.removedAiTags));
      if (evidence === "rival") continue;
      if (evidence === "direct") {
        results.push({ image, rank: 3 });
      } else if (evidence === "related" && !plan.contextual) {
        results.push({ image, rank: 2 });
      } else if (Array.isArray(image.embedding) && image.embedding.length > 0) {
        visualCandidates.push({ image, contextualMatch: evidence === "related" || manual === "related" });
      }
    }

    let warning: string | undefined;
    if (visualCandidates.length) {
      req.signal.throwIfAborted();
      try {
        const positive = await embedPrompts(plan.positivePrompts);
        const negative = await embedPrompts(plan.negativePrompts);
        for (const { image, contextualMatch } of visualCandidates) {
          req.signal.throwIfAborted();
          const score = visualEvidence(image.embedding, positive);
          const margin = score - visualEvidence(image.embedding, negative);
          const minimum = contextualMatch ? 0.27 : plan.known ? 0.28 : 0.30;
          if (score >= minimum && margin >= 0.025) {
            results.push({ image, rank: (contextualMatch ? 1 : 0) + margin });
          }
        }
      } catch (error) {
        console.error("Visual search unavailable", error);
        req.signal.throwIfAborted();
        warning = "Visual search is unavailable. Showing tag and description matches.";
        if (!results.length) {
          return Response.json({ error: "Visual search is temporarily unavailable." }, { status: 503 });
        }
      }
    }

    results.sort((a, b) => b.rank - a.rank ||
      b.image.createdAt.getTime() - a.image.createdAt.getTime() ||
      b.image._id.toHexString().localeCompare(a.image._id.toHexString()));
    const remaining = cursor ? results.filter(({ image, rank }) =>
      rank < cursor.rank || (rank === cursor.rank &&
        (image.createdAt.toISOString() < cursor.date ||
          (image.createdAt.toISOString() === cursor.date && image._id.toHexString() < cursor.id)))) : results;
    const page = remaining.slice(0, PAGE_SIZE);
    const last = page.at(-1);
    const response: GalleryPage = {
      images: page.map(({ image }) => imageResponse(image)),
      nextCursor: remaining.length > PAGE_SIZE && last
        ? Buffer.from(JSON.stringify({
          query, rank: last.rank, date: last.image.createdAt.toISOString(), id: last.image._id.toHexString(),
        })).toString("base64url") : null,
      warning,
    };
    return Response.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error("Search request failed", error);
    return Response.json({ error: "Could not search photos. Try again." }, { status: 503 });
  }
}
