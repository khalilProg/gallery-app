import type { ObjectId } from "mongodb";
import type { GalleryImage } from "./image-response";
import type { IndexingState } from "./indexing";

export interface ImageRecord {
  _id: ObjectId;
  url: string;
  thumbnailKey?: string;
  filename?: string;
  createdAt: Date;
  tags?: string[];
  indexing?: { state: IndexingState };
  embedding?: number[];
}

export const IMAGE_PROJECTION = {
  url: 1, thumbnailKey: 1, filename: 1, createdAt: 1, tags: 1, "indexing.state": 1,
};

export function imageResponse(image: ImageRecord): GalleryImage {
  return {
    _id: image._id.toHexString(),
    url: image.url,
    thumbnailUrl: image.thumbnailKey ? `/api/proxy/${image.thumbnailKey}` : undefined,
    filename: image.filename,
    createdAt: image.createdAt.toISOString(),
    tags: image.tags,
    indexingState: image.indexing?.state,
  };
}
