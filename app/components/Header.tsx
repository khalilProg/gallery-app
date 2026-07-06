"use client";

import { useState } from "react";
import UploadModal from "./UploadModal";

export default function Header({ onUploaded }: { onUploaded?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Gallery App</h1>

        <button
          onClick={() => setOpen(true)}
          className="bg-white text-black px-4 py-1.5 rounded-md font-medium hover:bg-gray-200 transition-colors"
        >
          + Upload
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
