import sharp from "sharp";
import { saveImage } from "@/lib/image-storage";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_REQUEST_SIZE = MAX_FILE_SIZE + 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const CONTENT_TYPES: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

class UploadTooLarge extends Error {}

async function readUpload(req: Request) {
  if (Number(req.headers.get("content-length")) > MAX_REQUEST_SIZE) {
    throw new UploadTooLarge();
  }

  let bytes = 0;
  const body = req.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_REQUEST_SIZE) throw new UploadTooLarge();
      controller.enqueue(chunk);
    },
  }));

  return new Response(body, { headers: req.headers }).formData();
}

function tooLarge() {
  return Response.json({ error: "Maximum upload size is 50 MB." }, { status: 413 });
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await readUpload(req);
  } catch (error) {
    if (error instanceof UploadTooLarge) return tooLarge();
    return Response.json({ error: "Invalid upload form." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Select a non-empty image." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) return tooLarge();

  const buffer = Buffer.from(await file.arrayBuffer());
  let contentType: string;
  let thumbnail: Buffer;
  try {
    const image = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning" });
    const { format, compression } = await image.metadata();
    const detected = format === "heif" && compression === "av1" ? "avif" : format;
    contentType = CONTENT_TYPES[detected];
    if (!contentType) throw new Error("Unsupported image format");
    thumbnail = await image
      .autoOrient()
      .resize(640, 640, { fit: "inside", withoutEnlargement: true })
      .webp()
      .toBuffer();
  } catch {
    return Response.json({
      error: "Use a valid JPEG, PNG, WebP, GIF, or AVIF image up to 40 megapixels.",
    }, { status: 415 });
  }

  try {
    return Response.json(await saveImage(file, buffer, contentType, thumbnail));
  } catch (error) {
    console.error("Image upload failed", error);
    return Response.json({ error: "Could not save the image. Try again." }, { status: 503 });
  }
}
