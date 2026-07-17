"use client";

import { useCallback, useState } from "react";
import Header from "./components/Header";
import ImageGrid from "./components/ImageGrid";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <main className="min-h-screen">
      <Header onUploaded={refresh} onSearch={setSearchQuery} />
      <ImageGrid key={refreshKey} searchQuery={searchQuery} />
    </main>
  );
}
