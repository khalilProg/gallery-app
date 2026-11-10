import type { Filter, ObjectId } from "mongodb";
import { CLIP_MODEL, pendingIndexing } from "../lib/indexing.ts";
import { closeDb, getDb } from "../lib/mongodb.ts";

const BATCH_SIZE = 100;
const retag = process.argv.includes("--retag");

try {
  const images = (await getDb()).collection("images");
  const eligible: Filter<{ _id: ObjectId }> = retag
    ? { "indexing.state": { $ne: "pending" } }
    : {
      $or: [
        { "indexing.state": "failed" },
        {
          indexing: { $exists: false },
          $or: [{ "embedding.0": { $exists: false } }, { embeddingModel: { $ne: CLIP_MODEL } }],
        },
      ],
    };

  let after: ObjectId | undefined;
  let queued = 0;
  while (true) {
    const batch = await images.find(after ? { ...eligible, _id: { $gt: after } } : eligible, {
      projection: { _id: 1 },
      sort: { _id: 1 },
      limit: BATCH_SIZE,
    }).toArray();
    const last = batch.at(-1);
    if (!last) break;

    const result = await images.updateMany(
      { ...eligible, _id: { $in: batch.map(({ _id }) => _id) } },
      { $set: { indexing: pendingIndexing() } },
    );
    queued += result.modifiedCount;
    after = last._id;
  }
  console.log(`Queued ${queued} images for indexing.`);
} finally {
  await closeDb();
}
