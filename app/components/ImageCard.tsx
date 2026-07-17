"use client";

import { useState } from "react";

interface ImageMeta {
  _id: string;
  url: string;
  filename?: string;
  tags?: string[];
  createdAt: string;
  score?: number;
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
      className="relative group rounded-xl overflow-hidden"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.filename ?? "Gallery image"}
        className="w-full h-48 object-cover transition-all duration-300"
        style={{ opacity: deleting ? 0.3 : 1, transform: hover ? "scale(1.03)" : "scale(1)" }}
      />

      {/* Hover overlay */}
      {hover && !deleting && (
        <div
          className="absolute inset-0 flex flex-col justify-between p-2"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }}
        >
          {/* Delete button */}
          <div className="flex justify-end">
            <button
              onClick={handleDelete}
              className="bg-red-600/80 hover:bg-red-500 p-1.5 rounded-lg text-xs transition-colors backdrop-blur-sm"
              title="Delete image"
            >
              🗑
            </button>
          </div>

          {/* Tags at bottom */}
          {image.tags && image.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {image.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(99,102,241,0.75)", color: "white", backdropFilter: "blur(4px)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Similarity score badge (shown during search) */}
      {image.score !== undefined && image.score > 0 && (
        <div
          className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: "rgba(16,185,129,0.8)", color: "white", backdropFilter: "blur(4px)" }}
        >
          {(image.score * 100).toFixed(0)}% match
        </div>
      )}

      {/* Deleting overlay */}
      {deleting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-white">Deleting…</span>
        </div>
      )}
    </div>
  );
}
