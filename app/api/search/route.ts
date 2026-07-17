import { getDb } from "@/lib/mongodb";
import { generateTextEmbedding, dotProduct } from "@/lib/embeddings";

const SIMILARITY_THRESHOLD = 0.20;
const MAX_RESULTS = 50;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();

  const db = await getDb();

  // No query → return all images sorted by date
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

  // Generate text embedding for the search query
  // Prefix with "a photo of" — matches CLIP training distribution
  const textEmbedding = await generateTextEmbedding(`a photo of ${query}`);

  // Fetch all images that have a valid embedding stored
  const images = await db
    .collection("images")
    .find({ embedding: { $exists: true, $not: { $size: 0 } } })
    .toArray();

  // Cosine similarity (dot product — both vectors are L2-normalised)
  const results = images
    .map((img) => ({
      ...img,
      _id: img._id.toString(),
      embedding: undefined, // don't send 512 floats to the client
      score: Array.isArray(img.embedding)
        ? dotProduct(textEmbedding, img.embedding as number[])
        : 0,
    }))
    .filter((img) => img.score > SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  return Response.json(results);
}
