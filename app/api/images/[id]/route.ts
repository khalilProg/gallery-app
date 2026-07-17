import { getDb } from "@/lib/mongodb";
import { getS3 } from "@/lib/garage";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { ObjectId } from "mongodb";
import { incrementDeletions } from "@/lib/metrics";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const db = await getDb();

  const image = await db.collection("images").findOne({
    _id: new ObjectId(id),
  });

  if (!image) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await getS3().send(
    new DeleteObjectCommand({
      Bucket: process.env.GARAGE_BUCKET!,
      Key: image.key,
    })
  );

  await db.collection("images").deleteOne({ _id: new ObjectId(id) });

  incrementDeletions();

  return Response.json({ success: true });
}
