"use client";

import { useCallback, useRef, useState } from "react";
import Header from "./components/Header";
import ImageGrid from "./components/ImageGrid";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <main className="min-h-screen">
      <Header onUploaded={refresh} />
      <ImageGrid key={refreshKey} />
    </main>
  );
}
