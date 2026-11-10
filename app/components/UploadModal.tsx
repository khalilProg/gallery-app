"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onClose: () => void;
  onUploaded?: () => void;
}

export default function UploadModal({ onClose, onUploaded }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<{ file: File; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => () => {
    if (selection) URL.revokeObjectURL(selection.preview);
  }, [selection]);

  function selectFile(file: File | undefined) {
    if (!file || uploading) return;
    setError(null);
    setSelection({ file, preview: URL.createObjectURL(file) });
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || uploading) return;

    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selection.file);

    try {
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Upload failed. Try again.");
      }
      onUploaded?.();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed. Try again.");
      setUploading(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="upload-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!uploading) onClose();
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-5 text-zinc-100 shadow-xl backdrop:bg-black/65 sm:p-6"
    >
      <form onSubmit={upload} className="space-y-5">
        <div>
          <h2 id="upload-title" className="text-lg font-semibold tracking-tight">Upload a photo</h2>
          <p className="mt-1 text-sm text-zinc-400">JPEG, PNG, WebP, GIF or AVIF · up to 50 MB</p>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          hidden
          onChange={(event) => selectFile(event.target.files?.[0])}
          disabled={uploading}
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            selectFile(event.dataTransfer.files[0]);
          }}
          className={`w-full overflow-hidden rounded-xl border border-dashed p-3 text-sm transition-colors disabled:opacity-70 ${dragging ? "border-indigo-400 bg-indigo-500/10" : "border-zinc-700 bg-zinc-950/50 hover:border-zinc-500"}`}
        >
          {selection ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selection.preview} alt="" className="mx-auto max-h-52 w-full rounded-lg object-contain" />
              <span className="mt-2 block truncate text-zinc-300">{selection.file.name}</span>
              <span className="text-xs text-zinc-400">Choose a different photo</span>
            </>
          ) : (
            <span className="block py-9">
              <span className="font-medium text-indigo-300">Choose a photo</span>
              <span className="block pt-1 text-zinc-400">or drop it here</span>
            </span>
          )}
        </button>

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className="button-secondary" onClick={onClose} disabled={uploading}>Cancel</button>
          <button type="submit" className="button-primary" disabled={!selection || uploading}>
            {uploading ? "Uploading…" : "Upload photo"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
