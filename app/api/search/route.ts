import { getDb } from "@/lib/mongodb";
import { generateTextEmbedding, dotProduct } from "@/lib/embeddings";

const SIMILARITY_THRESHOLD = 0.25;
const MAX_RESULTS = 50;

function tagMatch(tags: unknown, query: string): boolean {
  if (!Array.isArray(tags)) return false;
  const q = query.toLowerCase();
  return tags.some((tag: string) => {
    const t = tag.toLowerCase();
    return t.includes(q) || q.includes(t);
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();

  const db = await getDb();

  if (!query) {
    const images = await db
      .collection("images")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    return Response.json(
      images.map((img) => ({ ...img, _id: img._id.toString(), embedding: undefined }))
    );
  }

  const textEmbedding = await generateTextEmbedding(`a photo of ${query}`);

  const images = await db.collection("images").find({}).toArray();

  const results = images
    .map((img) => {
      const embScore =
        Array.isArray(img.embedding) && img.embedding.length > 0
          ? dotProduct(textEmbedding, img.embedding as number[])
          : 0;
      const hasTagMatch = tagMatch(img.tags, query);

      return {
        ...img,
        _id: img._id.toString(),
        embedding: undefined,
        score: embScore,
        tagMatch: hasTagMatch,
      };
    })
    .filter((img) => img.score > SIMILARITY_THRESHOLD || img.tagMatch)
    .sort((a, b) => {
      const aEff = a.tagMatch ? Math.max(a.score, SIMILARITY_THRESHOLD + 0.02) : a.score;
      const bEff = b.tagMatch ? Math.max(b.score, SIMILARITY_THRESHOLD + 0.02) : b.score;
      return bEff - aEff;
    })
    .slice(0, MAX_RESULTS);

  return Response.json(results);
}
