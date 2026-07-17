"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ImageCard from "./ImageCard";

interface ImageMeta {
  _id: string;
  url: string;
  filename?: string;
  tags?: string[];
  createdAt: string;
  score?: number;
}

interface Props {
  searchQuery?: string;
}

export default function ImageGrid({ searchQuery = "" }: Props) {
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    fetch("/api/images")
      .then((r) => r.json())
      .then((data: ImageMeta[]) => setImages(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery.trim()) {
      loadAll();
      return;
    }

    debounceRef.current = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((data: ImageMeta[]) => setImages(data))
        .finally(() => setSearching(false));
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, loadAll]);

  function handleDeleted(id: string) {
    setImages((prev) => prev.filter((img) => img._id !== id));
  }

  if (loading) {
    return (
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-xl animate-pulse"
            style={{ background: "rgba(255,255,255,0.05)" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4">
      {searchQuery && (
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          {searching ? (
            <>
              <span className="inline-block w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              Searching for &ldquo;{searchQuery}&rdquo;…
            </>
          ) : (
            <>
              <span className="text-indigo-400">✦</span>
              {images.length > 0
                ? `${images.length} semantic match${images.length !== 1 ? "es" : ""} for "${searchQuery}"`
                : `No matches for "${searchQuery}"`}
            </>
          )}
        </div>
      )}

      {images.length === 0 && !searching ? (
        searchQuery ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <span className="text-5xl opacity-20">🔍</span>
            <p className="text-gray-400 font-medium">No images match &ldquo;{searchQuery}&rdquo;</p>
            <p className="text-gray-600 text-sm">Try a different term — search uses AI similarity, not filenames.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <span className="text-5xl opacity-20">🖼️</span>
            <p className="text-gray-400 font-medium">No images yet.</p>
            <p className="text-gray-600 text-sm">
              Click <strong className="text-indigo-400">+ Upload</strong> to add your first image.
            </p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((img) => (
            <ImageCard key={img._id} image={img} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
