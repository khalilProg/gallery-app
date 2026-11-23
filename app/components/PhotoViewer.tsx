"use client";

import { useEffect, useRef, useState } from "react";

export default function PhotoViewer({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function closeViewer() {
    dialog.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="photo-viewer-title"
      onCancel={(event) => {
        event.preventDefault();
        closeViewer();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeViewer();
      }}
      className="m-auto w-fit min-w-28 max-w-[calc(100dvw_-_2rem)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 text-zinc-100 shadow-2xl backdrop:bg-black/55 backdrop:backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 [contain:inline-size]">
        <h2 id="photo-viewer-title" className="min-w-0 truncate text-sm font-medium" title={title}>{title}</h2>
        <button
          type="button"
          aria-label="Close photo"
          onClick={closeViewer}
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-lg text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="p-1.5 pt-0">
        {failed ? (
          <p role="alert" className="w-64 max-w-[calc(100dvw_-_3rem)] p-4 text-center text-sm text-zinc-300">Could not load the original photo.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            onError={() => setFailed(true)}
            className="mx-auto block h-auto max-h-[calc(100dvh_-_5.5rem)] w-auto max-w-[min(64rem,calc(100dvw_-_3rem))] rounded-xl object-contain"
          />
        )}
      </div>
    </dialog>
  );
}
