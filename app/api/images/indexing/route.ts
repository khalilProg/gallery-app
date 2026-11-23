import { ObjectId } from "mongodb";
import type { GalleryIndexingUpdate } from "@/lib/image-response";
import { IMAGE_TAG_PROJECTION, type ImageRecord } from "@/lib/image-record";
import { getDb } from "@/lib/mongodb";
import { uniqueTags, visibleAiTags } from "@/lib/photo-metadata";

export async function GET(req: Request) {
  const ids = new URL(req.url).searchParams.get("ids")?.split(",");
  if (!ids || ids.length > 24 || ids.some((id) => !ObjectId.isValid(id))) {
    return Response.json({ error: "Invalid image IDs." }, { status: 400 });
  }

  const db = await getDb();
  const images = await db.collection<ImageRecord & Required<Pick<ImageRecord, "indexing">>>("images")
    .find({
      _id: { $in: ids.map((id) => new ObjectId(id)) },
      "indexing.state": { $in: ["ready", "failed"] },
    }, { projection: { "indexing.state": 1, manualTags: 1, ...IMAGE_TAG_PROJECTION } }).toArray();
  const updates: GalleryIndexingUpdate[] = images.map((image) => {
    const aiTags = visibleAiTags(image.tags, image.removedAiTags);
    return {
      _id: image._id.toHexString(),
      indexingState: image.indexing.state,
      aiTags,
      tags: uniqueTags([...(image.manualTags ?? []), ...aiTags]),
    };
  });
  return Response.json(updates);
}
