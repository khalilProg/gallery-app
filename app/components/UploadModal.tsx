"use client";

import { useState } from "react";

export default function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      onUploaded?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-xl w-96 shadow-2xl">
        <h2 className="text-lg font-semibold mb-4">Upload Image</h2>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setError(null);
          }}
          className="mb-4 w-full text-sm text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-white file:text-black
            hover:file:bg-gray-200 cursor-pointer"
        />

        {file && (
          <p className="text-xs text-gray-400 mb-4 truncate">
            {file.name} — {(file.size / 1024).toFixed(1)} KB
          </p>
        )}

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1 rounded text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={upload}
            disabled={loading || !file}
            className="bg-white text-black px-4 py-1 rounded-md font-medium
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:bg-gray-200 transition-colors"
          >
            {loading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
