export interface GalleryImage {
  _id: string;
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  createdAt: string;
}

export interface GalleryPage {
  images: GalleryImage[];
  nextCursor: string | null;
}
