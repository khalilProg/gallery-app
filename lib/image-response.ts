import type { IndexingState } from "./indexing";

export interface GalleryImage {
  _id: string;
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  createdAt: string;
  tags?: string[];
  description?: string;
  manualTags?: string[];
  aiTags?: string[];
  removedAiTags?: string[];
  indexingState?: IndexingState;
}

export interface GalleryPage {
  images: GalleryImage[];
  nextCursor: string | null;
  warning?: string;
}

export interface GalleryIndexingUpdate {
  _id: string;
  indexingState: IndexingState;
  aiTags: string[];
  tags?: string[];
}
