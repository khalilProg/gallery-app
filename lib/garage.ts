import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.GARAGE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.GARAGE_ACCESS_KEY!,
    secretAccessKey: process.env.GARAGE_SECRET_KEY!,
  },
});
