"use client";

import { useEffect, useRef, useState } from "react";
import UploadModal from "./UploadModal";

interface Props {
  onUploaded?: () => void;
  onSearch?: (query: string) => void;
}

export default function Header({ onUploaded, onSearch }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateSearch(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    if (!value.trim()) {
      onSearch?.("");
      return;
    }
    debounce.current = setTimeout(() => onSearch?.(value), 300);
  }

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#111113]/95 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_minmax(15rem,30rem)_1fr] sm:px-6">
          <div className="col-start-1 row-start-1 flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-300" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="m3 17 5-5 4 4 4-5 5 6" />
                <circle cx="9" cy="8" r="1" />
              </svg>
            </span>
            Gallery
          </div>

          <div role="search" className="relative col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" strokeLinecap="round" />
            </svg>
            <input
              ref={searchInput}
              id="gallery-search"
              type="search"
              aria-label="Search photos"
              placeholder="Search photos…"
              value={query}
              onChange={(event) => updateSearch(event.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pr-10 pl-9 text-sm placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-indigo-400 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => { updateSearch(""); searchInput.current?.focus(); }}
                className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-lg text-zinc-400 hover:bg-white/10 hover:text-white"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <button id="open-upload-modal" type="button" onClick={() => setOpen(true)} className="button-primary col-start-2 row-start-1 justify-self-end sm:col-start-3">
            <span aria-hidden="true" className="text-lg leading-none">+</span>
            Upload
          </button>
        </div>
      </header>

      {open && <UploadModal onClose={() => setOpen(false)} onUploaded={onUploaded} />}
    </>
  );
}
