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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch?.(val), 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <>
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{
          background: "rgba(9,11,19,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🖼️</span>
          <h1 className="text-base font-bold tracking-tight text-white">Gallery</h1>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              background: "linear-gradient(135deg,#6366f1,#818cf8)",
              color: "white",
              letterSpacing: "0.04em",
            }}
          >
            AI
          </span>
        </div>

        {/* Search bar */}
        <div className="relative flex-1 max-w-md mx-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
            🔍
          </span>
          <input
            id="gallery-search"
            type="search"
            placeholder="Search images…"
            value={query}
            onChange={handleSearchChange}
            autoComplete="off"
            className="w-full rounded-xl text-sm pl-9 pr-4 py-2 bg-white/5 border border-white/8 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
            style={{ "--tw-ring-color": "rgba(99,102,241,0.5)" } as React.CSSProperties}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); onSearch?.(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors text-base leading-none"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Upload button */}
        <button
          id="open-upload-modal"
          onClick={() => setOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, #6366f1, #818cf8)",
            color: "white",
            boxShadow: "0 0 18px rgba(99,102,241,0.35)",
          }}
        >
          <span className="text-base leading-none">＋</span>
          Upload
        </button>
      </header>

      {open && (
        <UploadModal
          onClose={() => setOpen(false)}
          onUploaded={() => {
            setOpen(false);
            onUploaded?.();
          }}
        />
      )}
    </>
  );
}
