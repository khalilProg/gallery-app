"use server";

import { getDb } from "@/lib/mongodb";
import { getS3 } from "@/lib/garage";
import { generateImageEmbedding, autoTagImage } from "@/lib/embeddings";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { incrementUploads } from "@/lib/metrics";

const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export type UploadResult =
  | { success: true; id: string; url: string }
  | { success: false; error: string };

export async function uploadImage(formData: FormData): Promise<UploadResult> {
  // ── 1. Validate ──────────────────────────────────────────────────────────
  const file = formData.get("file");
  if (!(file instanceof File)) return { success: false, error: "No file provided." };
  if (!ALLOWED_TYPES.includes(file.type))
    return { success: false, error: `Unsupported file type: ${file.type}.` };
  if (file.size > MAX_SIZE_BYTES)
    return {
      success: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 50 MB.`,
    };

  // ── 2. Upload to Garage S3 ────────────────────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

  try {
    await getS3().send(
      new PutObjectCommand({
        Bucket: process.env.GARAGE_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );
  } catch (err) {
    console.error("[uploadImage] Garage upload error:", err);
    return { success: false, error: "Failed to upload image to storage. Please try again." };
  }

  const url = `/api/proxy/${key}`;

  // ── 3. Generate CLIP image embedding ─────────────────────────────────────
  let embedding: number[] = [];
  let tags: string[] = [];
  try {
    embedding = await generateImageEmbedding(buffer);
    tags = await autoTagImage(embedding);
  } catch (err) {
    console.error("[uploadImage] Embedding/tagging failed:", err);
  }

  // ── 5. Save to MongoDB ────────────────────────────────────────────────────
  try {
    const db = await getDb();
    const result = await db.collection("images").insertOne({
      key,
      url,
      filename: file.name,
      size: file.size,
      contentType: file.type,
      embedding,
      tags,
      embeddingModel: "Xenova/clip-vit-base-patch32",
      createdAt: new Date(),
    });

    incrementUploads();
    return { success: true, id: result.insertedId.toString(), url };
  } catch (err) {
    console.error("[uploadImage] MongoDB insert error:", err);
    return { success: false, error: "Failed to save image metadata. Please try again." };
  }
}
