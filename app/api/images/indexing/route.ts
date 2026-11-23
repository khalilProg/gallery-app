import { ObjectId } from "mongodb";
import type { GalleryIndexingUpdate } from "@/lib/image-response";
import type { IndexingState } from "@/lib/indexing";
import { getDb } from "@/lib/mongodb";

export async function GET(req: Request) {
  const ids = new URL(req.url).searchParams.get("ids")?.split(",");
  if (!ids || ids.length > 24 || ids.some((id) => !ObjectId.isValid(id))) {
    return Response.json({ error: "Invalid image IDs." }, { status: 400 });
  }

  const db = await getDb();
  const images = await db.collection<{ indexing: { state: IndexingState }; tags?: string[] }>("images")
    .find({
      _id: { $in: ids.map((id) => new ObjectId(id)) },
      "indexing.state": { $in: ["ready", "failed"] },
    }, { projection: { "indexing.state": 1, tags: 1 } }).toArray();
  const updates: GalleryIndexingUpdate[] = images.map((image) => ({
    _id: image._id.toHexString(),
    indexingState: image.indexing.state,
    tags: image.tags,
  }));
  return Response.json(updates);
}
