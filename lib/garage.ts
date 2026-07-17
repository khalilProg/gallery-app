import { S3Client } from "@aws-sdk/client-s3";

let _s3: S3Client | undefined;

export function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: "us-east-1",
      endpoint: process.env.GARAGE_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.GARAGE_ACCESS_KEY!,
        secretAccessKey: process.env.GARAGE_SECRET_KEY!,
      },
    });
  }
  return _s3;
}
