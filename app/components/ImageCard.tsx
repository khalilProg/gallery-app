"use client";

import { useState } from "react";

interface ImageMeta {
  _id: string;
  url: string;
  filename?: string;
  createdAt: string;
}

export default function ImageCard({
  image,
  onDeleted,
}: {
  image: ImageMeta;
  onDeleted: (id: string) => void;
}) {
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
    <div
      className="relative group"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
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

      {deleting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-white">Deleting…</span>
        </div>
      )}
    </div>
  );
}
