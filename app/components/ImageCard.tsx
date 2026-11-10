"use client";

import { useState } from "react";

import type { GalleryImage } from "@/lib/image-response";
import PhotoViewer from "./PhotoViewer";

const actionClass = "grid size-8 place-items-center rounded-lg bg-black/65 text-white transition-colors";

export default function ImageCard({
  image,
  onDeleted,
}: {
  image: GalleryImage;
  onDeleted: (id: string) => void;
}) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnailUrl = thumbnailFailed ? undefined : image.thumbnailUrl;
  const [viewing, setViewing] = useState(false);
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
    <article className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
      <div className="group relative aspect-[4/3] overflow-hidden bg-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl ?? image.url}
          loading="lazy"
          decoding="async"
          onError={thumbnailUrl ? () => setThumbnailFailed(true) : undefined}
          alt={image.filename ?? "Gallery image"}
          className="h-full w-full object-cover"
        />

        <div className="absolute top-2 right-2 flex gap-1.5 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:hover)]:opacity-0">
          <button
            type="button"
            onClick={() => setViewing(true)}
            disabled={deleting}
            aria-label={image.filename ? `View original photo: ${image.filename}` : "View original photo"}
            title="View original photo"
            className={`${actionClass} hover:bg-zinc-700`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label={image.filename ? `Delete ${image.filename}` : "Delete photo"}
            title="Delete photo"
            className={`${actionClass} hover:bg-red-700`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16m-10-3h4m4 3-1 13H7L6 7m4 4v5m4-5v5" />
            </svg>
          </button>
        </div>

        {deleting && (
          <p role="status" className="absolute inset-0 grid place-items-center bg-black/65 text-sm">Deleting…</p>
        )}
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <p className="truncate text-sm font-medium text-zinc-100" title={image.filename}>
          {image.filename ?? "Untitled photo"}
        </p>

        {image.indexingState === "failed" && (
          <p className="text-xs text-amber-300">Search couldn’t be prepared for this photo.</p>
        )}
        {deleteError && <p role="alert" className="text-xs text-red-300">{deleteError}</p>}

        {image.tags && image.tags.length > 0 && (
          <details className="text-xs text-zinc-400">
            <summary className="w-fit cursor-pointer rounded hover:text-white">Tags ({image.tags.length})</summary>
            <ul className="flex flex-wrap gap-1.5 pt-2">
              {image.tags.map((tag) => (
                <li key={tag} className="rounded-md bg-white/5 px-2 py-1 text-zinc-200">{tag}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {viewing && (
        <PhotoViewer
          url={image.url}
          title={image.filename ?? "Original photo"}
          onClose={() => setViewing(false)}
        />
      )}
    </article>
  );
}
