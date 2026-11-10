import { ObjectId } from "mongodb";
import type { GalleryPage } from "@/lib/image-response";
import { getDb } from "@/lib/mongodb";

const PAGE_SIZE = 12;
let indexReady: Promise<string> | undefined;

interface ImageRecord {
  _id: ObjectId;
  url: string;
  thumbnailKey?: string;
  filename?: string;
  createdAt: Date;
}

function parseCursor(cursor: string) {
  const [timestamp, id, extra] = cursor.split(",");
  const createdAt = new Date(timestamp);
  if (extra !== undefined || !id || !ObjectId.isValid(id) ||
      !Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== timestamp) {
    return null;
  }
  return { createdAt, _id: new ObjectId(id) };
}

export async function GET(req: Request) {
  const rawCursor = new URL(req.url).searchParams.get("cursor");
  const cursor = rawCursor === null ? null : parseCursor(rawCursor);
  if (rawCursor !== null && !cursor) {
    return Response.json({ error: "Invalid gallery cursor." }, { status: 400 });
  }

  try {
    const db = await getDb();
    const images = db.collection<ImageRecord>("images");
    indexReady ??= images.createIndex({ createdAt: -1, _id: -1 }).catch((error: unknown) => {
      indexReady = undefined;
      throw error;
    });
    await indexReady;

    const records = await images.find(cursor ? {
      $or: [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
      ],
    } : {}, {
      projection: { url: 1, thumbnailKey: 1, filename: 1, createdAt: 1 },
      sort: { createdAt: -1, _id: -1 },
      limit: PAGE_SIZE + 1,
    }).toArray();

    const page = records.slice(0, PAGE_SIZE);
    const last = page.at(-1);
    const response: GalleryPage = {
      images: page.map((image) => ({
        _id: image._id.toHexString(),
        url: image.url,
        thumbnailUrl: image.thumbnailKey ? `/api/proxy/${image.thumbnailKey}` : undefined,
        filename: image.filename,
        createdAt: image.createdAt.toISOString(),
      })),
      nextCursor: last && records.length > PAGE_SIZE
        ? `${last.createdAt.toISOString()},${last._id.toHexString()}`
        : null,
    };
    return Response.json(response);
  } catch (error) {
    console.error("Could not load gallery page", error);
    return Response.json({ error: "Could not load images. Try again." }, { status: 503 });
  }
}
