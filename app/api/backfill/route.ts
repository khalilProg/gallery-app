import { getDb } from "@/lib/mongodb";
import { generateImageEmbedding, autoTagImage } from "@/lib/embeddings";

export const maxDuration = 300;

/**
 * POST /api/backfill
 * Re-generates CLIP embeddings and tags for all images using the current
 * 500+ label taxonomy. Safe to run multiple times.
 */
export async function POST() {
  const db = await getDb();
  const images = await db.collection("images").find({}).toArray();

  if (images.length === 0) {
    return Response.json({ message: "No images found.", updated: 0 });
  }

  let updated = 0;
  const errors: string[] = [];
  const results: Array<{ filename: string; tags: string[] }> = [];

  for (const img of images) {
    try {
      const imageUrl = `http://localhost:3000${img.url}`;
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${imageUrl}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      const embedding = await generateImageEmbedding(buffer);
      const tags = await autoTagImage(embedding);

      await db.collection("images").updateOne(
        { _id: img._id },
        {
          $set: {
            embedding,
            tags,
            embeddingModel: "Xenova/clip-vit-base-patch32",
          },
          // Remove stale caption field if present from previous approach
          $unset: { caption: "", captionModel: "" },
        }
      );

      updated++;
      results.push({ filename: img.filename ?? img.key, tags });
      console.log(`[backfill] ✓ ${img.filename ?? img.key} → [${tags.join(", ")}]`);
    } catch (err) {
      const msg = `✗ ${img.filename ?? String(img._id)}: ${(err as Error).message}`;
      console.error(`[backfill] ${msg}`);
      errors.push(msg);
    }
  }

  return Response.json({
    message: `Backfill complete. Updated ${updated}/${images.length} images.`,
    updated,
    results,
    errors,
  });
}
