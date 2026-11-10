import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { getS3 } from "./garage";
import { incrementDeletions, incrementUploads } from "./metrics";

function deleteObject(key: string) {
  return getS3().send(new DeleteObjectCommand({
    Bucket: process.env.GARAGE_BUCKET!,
    Key: key,
  }));
}

async function cleanUpUpload(key: string) {
  try {
    await deleteObject(key);
  } catch (error) {
    console.error("Could not clean up failed upload", { key, error });
  }
}

export async function saveImage(file: File, buffer: Buffer, contentType: string) {
  const images = (await getDb()).collection("images");
  const id = new ObjectId();
  const key = randomUUID();
  const url = `/api/proxy/${key}`;

  try {
    await getS3().send(new PutObjectCommand({
      Bucket: process.env.GARAGE_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
  } catch (error) {
    // A failed response can arrive after Garage has stored the object.
    await cleanUpUpload(key);
    throw error;
  }

  try {
    await images.insertOne({
      _id: id,
      key,
      url,
      filename: file.name,
      size: file.size,
      contentType,
      createdAt: new Date(),
    });
  } catch (error) {
    // A lost MongoDB acknowledgement can hide a successful insert.
    const saved = await images.findOne({ _id: id }).catch((readError: unknown) => {
      console.error("Could not confirm upload metadata", { key, id, error: readError });
      return undefined;
    });
    if (!saved) {
      if (saved === null) await cleanUpUpload(key);
      throw error;
    }
  }

  incrementUploads();
  return { id: id.toHexString(), url };
}

export async function deleteImage(id: ObjectId) {
  const images = (await getDb()).collection("images");
  const image = await images.findOne({ _id: id });
  if (!image) return;

  // Keep the key in MongoDB until Garage confirms deletion so a retry can finish.
  await deleteObject(image.key);
  const result = await images.deleteOne({ _id: id });
  if (result.deletedCount) incrementDeletions();
}
