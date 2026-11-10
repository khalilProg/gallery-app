"use client";

import { useEffect, useState } from "react";
import type { GalleryImage, GalleryPage } from "@/lib/image-response";
import ImageCard from "./ImageCard";

export default function ImageGrid() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [request, setRequest] = useState<{ cursor: string | null }>({ cursor: null });

  useEffect(() => {
    const controller = new AbortController();
    const { cursor } = request;
    const url = cursor ? `/api/images?cursor=${encodeURIComponent(cursor)}` : "/api/images";

    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Gallery request failed");
        const page: GalleryPage = await response.json();
        if (controller.signal.aborted) return;

        setImages((previous) => cursor ? [...previous, ...page.images] : page.images);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [request]);

  function handleDeleted(id: string) {
    setImages((previous) => previous.filter((image) => image._id !== id));
  }

  function loadMore() {
    setError(false);
    setLoading(true);
    setRequest({ cursor: nextCursor });
  }

  return (
    <section className="p-4">
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((image) => (
            <ImageCard key={image._id} image={image} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      {images.length === 0 && !loading && !error && !nextCursor && (
        <div className="flex flex-col justify-center items-center h-64 gap-2">
          <p className="text-gray-400 text-lg">No images yet.</p>
          <p className="text-gray-600 text-sm">Click the + button to upload one.</p>
        </div>
      )}

      {(loading || error || nextCursor) && (
        <div className="mt-4 flex flex-col items-center gap-2">
          {loading && <p role="status" className="text-gray-400">Loading images…</p>}
          {error && <p role="alert" className="text-red-300">Could not load images.</p>}
          {!loading && (error || nextCursor) && (
            <button type="button" onClick={loadMore} className="rounded-md border border-gray-600 px-4 py-2">
              {error ? "Try again" : "Load more"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
