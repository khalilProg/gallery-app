import { getDb } from "@/lib/mongodb";
import { getS3 } from "@/lib/garage";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return Response.json({ error: "No file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const key = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

  // 1. Upload image to Garage (S3-compatible object storage)
  await getS3().send(
    new PutObjectCommand({
      Bucket: process.env.GARAGE_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  const url = `/api/proxy/${key}`;

  // 2. Save metadata (key, url, filename, size, type) in MongoDB
  const db = await getDb();

  const result = await db.collection("images").insertOne({
    key,
    url,
    filename: file.name,
    size: file.size,
    contentType: file.type,
    createdAt: new Date(),
  });

  return Response.json({
    id: result.insertedId.toString(),
    url,
  });
}
