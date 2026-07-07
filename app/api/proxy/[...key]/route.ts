import { getS3 } from "@/lib/garage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const objectKey = key.join("/");

  try {
    const response = await getS3().send(
      new GetObjectCommand({
        Bucket: process.env.GARAGE_BUCKET!,
        Key: objectKey,
      })
    );

    const body = response.Body;
    if (!body) {
      return new Response("Not found", { status: 404 });
    }

    // Stream the S3 object through Next.js to the browser
    const stream = body.transformToWebStream();

    return new Response(stream, {
      headers: {
        "Content-Type": response.ContentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
