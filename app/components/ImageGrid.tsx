"use client";

import { useEffect, useState } from "react";
import type { GalleryImage, GalleryIndexingUpdate, GalleryPage } from "@/lib/image-response";
import ImageCard from "./ImageCard";

export default function ImageGrid({ searchQuery = "" }: { searchQuery?: string }) {
  const query = searchQuery.trim();
  return <GalleryResults key={query} query={query} />;
}

function GalleryResults({ query }: { query: string }) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [request, setRequest] = useState<{ cursor: string | null }>({ cursor: null });

  useEffect(() => {
    const controller = new AbortController();
    const { cursor } = request;
    const url = query ? `/api/search?q=${encodeURIComponent(query)}` : cursor ? `/api/images?cursor=${encodeURIComponent(cursor)}` : "/api/images";

    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Gallery request failed");
        const result = await response.json();
        const page: GalleryPage = query ? { images: result, nextCursor: null } : result;
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
  }, [query, request]);

  const pending = images.filter((image) => image.indexingState === "pending");
  const pendingIds = pending
    .slice(0, 24)
    .map((image) => image._id)
    .join(",");

  useEffect(() => {
    if (!pendingIds) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const response = await fetch(`/api/images/indexing?ids=${pendingIds}`, { signal: controller.signal });
        if (!response.ok) return;
        const updates: GalleryIndexingUpdate[] = await response.json();
        if (controller.signal.aborted || updates.length === 0) return;
        const byId = new Map(updates.map((update) => [update._id, update]));
        setImages((previous) => previous.map((image) => {
          const update = byId.get(image._id);
          return update ? { ...image, ...update } : image;
        }));
      } catch {
        // A transient status error is retried by the next poll.
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 4_000);
      }
    }

    timer = setTimeout(poll, 4_000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pendingIds]);

  function handleDeleted(id: string) {
    setImages((previous) => previous.filter((image) => image._id !== id));
  }

  function loadMore() {
    setError(false);
    setLoading(true);
    setRequest({ cursor: nextCursor });
  }

  return (
    <section aria-labelledby="gallery-title" className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h1 id="gallery-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {query ? "Search results" : "Your photos"}
          </h1>
          {query && <p className="mt-1 break-words text-sm text-zinc-400">Results for “{query}”</p>}
        </div>

        {pending.length > 0 && (
          <p role="status" className="flex items-center gap-2 text-xs text-zinc-400">
            <span aria-hidden="true" className="size-2 rounded-full bg-indigo-400 motion-safe:animate-pulse" />
            Preparing {pending.length} {pending.length === 1 ? "photo" : "photos"} for search
          </p>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {images.map((image) => (
            <ImageCard key={image._id} image={image} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      {images.length === 0 && !loading && !error && !nextCursor && (
        <div className="grid min-h-52 place-content-center gap-1 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 px-4 text-center">
          <p className="font-medium">{query ? "No photos found" : "No photos yet"}</p>
          <p className="text-sm text-zinc-400">{query ? "Try a different search." : "Upload a photo to get started."}</p>
        </div>
      )}

      {(loading || error || nextCursor) && (
        <div className="mt-6 flex flex-col items-center gap-2">
          {loading && <p role="status" className="text-sm text-zinc-400">{query ? "Searching…" : "Loading photos…"}</p>}
          {error && <p role="alert" className="text-sm text-red-300">{query ? "Could not search photos." : "Could not load photos."}</p>}
          {!loading && (error || nextCursor) && (
            <button type="button" onClick={loadMore} className="button-secondary">
              {error ? "Try again" : "Load more"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
