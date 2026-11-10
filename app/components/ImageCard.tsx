"use client";

import { useState } from "react";

import type { GalleryImage } from "@/lib/image-response";

export default function ImageCard({
  image,
  onDeleted,
}: {
  image: GalleryImage;
  onDeleted: (id: string) => void;
}) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnailUrl = thumbnailFailed ? undefined : image.thumbnailUrl;
  const [hover, setHover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this image?")) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/images/${image._id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      onDeleted(image._id);
    } catch {
      setDeleteError("Could not delete. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article>
      <div
        className="relative group"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl ?? image.url}
          loading="lazy"
          decoding="async"
          onError={thumbnailUrl ? () => setThumbnailFailed(true) : undefined}
          alt={image.filename ?? "Gallery image"}
          className="w-full h-48 object-cover rounded-lg transition-opacity duration-200"
          style={{ opacity: deleting ? 0.4 : 1 }}
        />

        {hover && !deleting && (
          <button
            onClick={handleDelete}
            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 p-2 rounded-full shadow-lg transition-colors"
            title="Delete image"
          >
            🗑
          </button>
        )}

        {deleteError && (
          <p role="alert" className="absolute inset-x-0 bottom-0 rounded-b-lg bg-gray-950/90 p-2 text-sm text-red-300">
            {deleteError}
          </p>
        )}

        {image.indexingState && (
          <span className="absolute right-2 bottom-10 rounded bg-gray-950/90 px-2 py-1 text-xs">
            {image.indexingState === "pending" ? "Indexing…" :
              image.indexingState === "failed" ? "Indexing failed" : "Search ready"}
          </span>
        )}

        {deleting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-white">Deleting…</span>
          </div>
        )}
      </div>

      {image.tags && image.tags.length > 0 && (
        <details className="px-1 pt-2 text-xs">
          <summary className="w-fit cursor-pointer text-gray-300">
            Tags ({image.tags.length})
          </summary>
          <ul className="flex flex-wrap gap-1 pt-2">
            {image.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-gray-800 px-2 py-1 text-gray-100">{tag}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
