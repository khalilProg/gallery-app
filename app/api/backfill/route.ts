import { getDb } from "@/lib/mongodb";
import { generateImageEmbedding, autoTagImage } from "@/lib/embeddings";

export const maxDuration = 300;

export async function POST() {
  const db = await getDb();

  const images = await db.collection("images").find({}).toArray();

  if (images.length === 0) {
    return Response.json({ message: "All images already have embeddings.", updated: 0 });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const img of images) {
    try {
      const imageUrl = `http://localhost:3000${img.url}`;
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${imageUrl}`);

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
        }
      );

      updated++;
      console.log(`[backfill] ✓ ${img.filename ?? img.key} — tags: ${tags.join(", ")}`);
    } catch (err) {
      const msg = `[backfill] ✗ ${img.filename ?? img._id}: ${(err as Error).message}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  return Response.json({
    message: `Backfill complete. Updated ${updated}/${images.length} images.`,
    updated,
    errors,
  });
}
