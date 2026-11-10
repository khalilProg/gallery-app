import type { IndexingState } from "./indexing";

export interface GalleryImage {
  _id: string;
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  createdAt: string;
  tags?: string[];
  indexingState?: IndexingState;
}

export interface GalleryPage {
  images: GalleryImage[];
  nextCursor: string | null;
}

export interface GalleryIndexingUpdate {
  _id: string;
  indexingState: IndexingState;
  tags?: string[];
}
