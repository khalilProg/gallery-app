import client from 'prom-client';

const globalForMetrics = globalThis as typeof globalThis & {
  _promRegistry?: client.Registry;
  _galleryMetrics?: GalleryMetrics;
};

interface GalleryMetrics {
  uploadsTotal: client.Counter<string>;
  deletionsTotal: client.Counter<string>;
  imagesStored: client.Gauge<string>;
}

function createRegistry(): { registry: client.Registry; metrics: GalleryMetrics } {
  const registry = new client.Registry();

  client.collectDefaultMetrics({ register: registry });

  const uploadsTotal = new client.Counter({
    name: 'gallery_uploads_total',
    help: 'Total number of images uploaded',
    registers: [registry],
  });

  const deletionsTotal = new client.Counter({
    name: 'gallery_deletions_total',
    help: 'Total number of images deleted',
    registers: [registry],
  });

  const imagesStored = new client.Gauge({
    name: 'gallery_images_stored',
    help: 'Number of images currently stored in MongoDB',
    registers: [registry],
  });

  return { registry, metrics: { uploadsTotal, deletionsTotal, imagesStored } };
}

function getMetricsInstance(): { registry: client.Registry; metrics: GalleryMetrics } {
  if (!globalForMetrics._promRegistry || !globalForMetrics._galleryMetrics) {
    const { registry, metrics } = createRegistry();
    globalForMetrics._promRegistry = registry;
    globalForMetrics._galleryMetrics = metrics;
  }
  return {
    registry: globalForMetrics._promRegistry,
    metrics: globalForMetrics._galleryMetrics,
  };
}

export function getRegistry(): client.Registry {
  return getMetricsInstance().registry;
}

export function incrementUploads(): void {
  getMetricsInstance().metrics.uploadsTotal.inc();
}

export function incrementDeletions(): void {
  getMetricsInstance().metrics.deletionsTotal.inc();
}

export function setImagesStored(count: number): void {
  getMetricsInstance().metrics.imagesStored.set(count);
}
