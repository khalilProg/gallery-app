import type { ObjectId } from "mongodb";
import type { GalleryImage } from "./image-response";
import type { IndexingState } from "./indexing";
import { uniqueTags, visibleAiTags } from "./photo-metadata";

export interface ImageRecord {
  _id: ObjectId;
  url: string;
  thumbnailKey?: string;
  filename?: string;
  createdAt: Date;
  // The indexer owns this field, including tags already stored on older photos.
  tags?: string[];
  description?: string;
  manualTags?: string[];
  removedAiTags?: string[];
  indexing?: { state: IndexingState };
  embedding?: number[];
}

export const IMAGE_TAG_PROJECTION = { tags: 1, removedAiTags: 1 };

export const IMAGE_PROJECTION = {
  ...IMAGE_TAG_PROJECTION, url: 1, thumbnailKey: 1, filename: 1, createdAt: 1, description: 1,
  manualTags: 1, "indexing.state": 1,
};

export function imageResponse(image: ImageRecord): GalleryImage {
  const aiTags = visibleAiTags(image.tags, image.removedAiTags);
  return {
    _id: image._id.toHexString(),
    url: image.url,
    thumbnailUrl: image.thumbnailKey ? `/api/proxy/${image.thumbnailKey}` : undefined,
    filename: image.filename,
    createdAt: image.createdAt.toISOString(),
    tags: uniqueTags([...(image.manualTags ?? []), ...aiTags]),
    description: image.description,
    manualTags: image.manualTags,
    aiTags,
    removedAiTags: image.removedAiTags,
    indexingState: image.indexing?.state,
  };
}
