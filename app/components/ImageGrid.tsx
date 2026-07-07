"use client";

import { useEffect, useState } from "react";
import ImageCard from "./ImageCard";

interface ImageMeta {
  _id: string;
  url: string;
  filename?: string;
  createdAt: string;
}

export default function ImageGrid() {
  const [images, setImages] = useState<ImageMeta[]>([]);

  useEffect(() => {
    const fetchpic = async () => {
      const res = await fetch("/api/images");
      const data: ImageMeta[] = await res.json();
      setImages(data);
    }
    fetchpic();
  }, []);

  function handleDeleted(id: string) {
    setImages((prev) => prev.filter((img) => img._id !== id));
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <p className="text-gray-400 text-lg">No images yet.</p>
        <p className="text-gray-600 text-sm">Click the + button to upload one.</p>
      </div>
    );
  }

  return (
    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
      {images.map((img) => (
        <ImageCard key={img._id} image={img} onDeleted={handleDeleted} />
      ))}
    </div>
  );
}
