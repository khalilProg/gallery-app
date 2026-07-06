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

  async function handleDelete() {
    if (!confirm("Delete this image?")) return;
    setDeleting(true);
    await fetch(`/api/images/${image._id}`, { method: "DELETE" });
    onDeleted(image._id);
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

      {deleting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-white">Deleting…</span>
        </div>
      )}
    </div>
  );
}
