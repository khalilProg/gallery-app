import { ObjectId, type UpdateFilter } from "mongodb";
import { IMAGE_PROJECTION, imageResponse, type ImageRecord } from "@/lib/image-record";
import { deleteImage } from "@/lib/image-storage";
import { getDb } from "@/lib/mongodb";
import { cleanTag, MAX_DESCRIPTION_LENGTH, MAX_MANUAL_TAGS, MAX_TAG_LENGTH, tagKey, uniqueTags } from "@/lib/photo-metadata";

function parseTags(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_MANUAL_TAGS ||
      !value.every((tag) => typeof tag === "string" && cleanTag(tag).length > 0 &&
        cleanTag(tag).length <= MAX_TAG_LENGTH)) {
    return null;
  }
  return uniqueTags(value.map(cleanTag));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid image ID." }, { status: 400 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !["description", "manualTags", "removeAiTags"].includes(key))) {
    return Response.json({ error: "Invalid photo details." }, { status: 400 });
  }

  const { description, manualTags, removeAiTags } = body as Record<string, unknown>;
  const update: UpdateFilter<ImageRecord> = {};
  const fields: Pick<ImageRecord, "description" | "manualTags"> = {};
  if (description !== undefined) {
    if (typeof description !== "string" || description.trim().length > MAX_DESCRIPTION_LENGTH) {
      return Response.json({ error: `Descriptions can have up to ${MAX_DESCRIPTION_LENGTH} characters.` }, { status: 400 });
    }
    fields.description = description.trim();
  }
  if (manualTags !== undefined) {
    const tags = parseTags(manualTags);
    if (!tags) {
      return Response.json({
        error: `Enter up to ${MAX_MANUAL_TAGS} manual tags with 1 to ${MAX_TAG_LENGTH} characters each.`,
      }, { status: 400 });
    }
    fields.manualTags = tags;
  }
  if (removeAiTags !== undefined) {
    const tags = parseTags(removeAiTags);
    if (!tags) {
      return Response.json({ error: "Invalid AI tags to remove." }, { status: 400 });
    }
    if (tags.length) update.$addToSet = { removedAiTags: { $each: tags.map(tagKey) } };
  }
  if (Object.keys(fields).length) update.$set = fields;
  if (!Object.keys(update).length) {
    return Response.json({ error: "No photo details to update." }, { status: 400 });
  }

  try {
    const db = await getDb();
    const image = await db.collection<ImageRecord>("images").findOneAndUpdate(
      { _id: new ObjectId(id) },
      update,
      { projection: IMAGE_PROJECTION, returnDocument: "after" },
    );
    if (!image) return Response.json({ error: "Photo not found." }, { status: 404 });
    return Response.json(imageResponse(image));
  } catch (error) {
    console.error("Photo details update failed", { id, error });
    return Response.json({ error: "Could not save photo details. Try again." }, { status: 503 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid image ID." }, { status: 400 });
  }

  try {
    await deleteImage(new ObjectId(id));
    return Response.json({ success: true });
  } catch (error) {
    console.error("Image deletion failed", { id, error });
    return Response.json({ error: "Could not delete the image. Try again." }, { status: 503 });
  }
}
