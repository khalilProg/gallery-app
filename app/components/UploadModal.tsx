"use client";

import { useRef, useState, useTransition } from "react";
import { uploadImage } from "@/app/actions/uploadImage";

type UploadStage = "idle" | "uploading" | "embedding" | "done" | "error";

interface Props {
  onClose: () => void;
  onUploaded?: () => void;
}

export default function UploadModal({ onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const isProcessing = stage === "uploading" || stage === "embedding";

  function applyFile(f: File) {
    setFile(f);
    setError(null);
    setStage("idle");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) applyFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) applyFile(f);
  }

  async function handleUpload() {
    if (!file || isProcessing) return;

    setError(null);
    setStage("uploading");

    const formData = new FormData();
    formData.append("file", file);

    const embeddingTimer = setTimeout(() => setStage("embedding"), 1200);

    startTransition(async () => {
      const result = await uploadImage(formData);
      clearTimeout(embeddingTimer);

      if (result.success) {
        setStage("done");
        setTimeout(() => {
          onUploaded?.();
          onClose();
        }, 1400);
      } else {
        setStage("error");
        setError(result.error);
      }
    });
  }

  const stageLabel = {
    idle: "Upload",
    uploading: "Uploading to storage…",
    embedding: "Generating AI embedding…",
    done: "✓ Done!",
    error: "Retry",
  }[stage];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #111827 0%, #0f172a 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <h2 className="text-lg font-semibold text-white">Upload Image</h2>
            <p className="text-xs text-gray-500 mt-0.5">AI embedding generated automatically</p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none disabled:opacity-40"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className="relative rounded-xl cursor-pointer transition-all duration-200 overflow-hidden"
            style={{
              border: `2px dashed ${isDragging ? "rgba(99,102,241,0.8)" : "rgba(255,255,255,0.1)"}`,
              background: isDragging ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.03)",
              minHeight: preview ? undefined : "11rem",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="sr-only"
              disabled={isProcessing}
            />

            {preview ? (
              <div className="relative">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full max-h-56 object-contain"
                  style={{ display: "block" }}
                />
                {isProcessing && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                    style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                  >
                    <Spinner />
                    <span className="text-sm text-white font-medium">{stageLabel}</span>
                    {stage === "embedding" && (
                      <span className="text-xs text-indigo-300">
                        CLIP model · may take a few seconds on first run
                      </span>
                    )}
                  </div>
                )}
                {stage === "done" && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                    style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
                  >
                    <span className="text-5xl">✅</span>
                    <span className="text-sm text-emerald-400 font-semibold">Uploaded successfully!</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-4xl opacity-30">🖼️</span>
                <p className="text-sm text-gray-400">
                  <span className="text-indigo-400 font-medium">Click to browse</span> or drag & drop
                </p>
                <p className="text-xs text-gray-600">JPEG, PNG, WebP, GIF, AVIF · up to 50 MB</p>
              </div>
            )}
          </div>

          {file && stage === "idle" && (
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 rounded-lg px-3 py-2">
              <span className="opacity-50">📄</span>
              <span className="truncate flex-1">{file.name}</span>
              <span className="shrink-0 text-gray-600">{(file.size / 1024).toFixed(1)} KB</span>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                className="text-gray-600 hover:text-red-400 transition-colors ml-1"
                title="Remove file"
              >
                ×
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-950/60 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              onClick={handleUpload}
              disabled={!file || isProcessing || stage === "done"}
              className="relative px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background:
                  stage === "done"
                    ? "linear-gradient(135deg, #059669, #10b981)"
                    : "linear-gradient(135deg, #6366f1, #818cf8)",
                color: "white",
                boxShadow: isProcessing ? "none" : "0 0 20px rgba(99,102,241,0.3)",
              }}
            >
              {isProcessing && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Spinner size="sm" />
                </span>
              )}
              <span className={isProcessing ? "opacity-0" : ""}>{stageLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? 16 : 28;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      style={{ animationDuration: "0.7s" }}
    >
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
