import { setTimeout as sleep } from "node:timers/promises";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { autoTagImage, generateImageEmbedding } from "../lib/embeddings.ts";
import { getS3 } from "../lib/garage.ts";
import {
  claimIndexingJob,
  failIndexing,
  finishIndexing,
  LEASE_MS,
  MAX_INDEX_ATTEMPTS,
  prepareIndexingQueue,
  renewIndexingLease,
} from "../lib/indexing.ts";
import { closeDb } from "../lib/mongodb.ts";

const shutdown = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => shutdown.abort());
}

async function embedOriginal(key: string) {
  const { Body } = await getS3().send(new GetObjectCommand({
    Bucket: process.env.GARAGE_BUCKET!,
    Key: key,
  }));
  if (!Body) throw new Error("Image object has no body");
  return generateImageEmbedding(Buffer.from(await Body.transformToByteArray()));
}

let queueReady = false;
while (!shutdown.signal.aborted) {
  try {
    if (!queueReady) {
      await prepareIndexingQueue();
      queueReady = true;
      console.log("Indexing queue ready. Waiting for images.");
    }

    const claim = await claimIndexingJob();
    if (!claim) {
      await sleep(2_000, undefined, { signal: shutdown.signal });
      continue;
    }

    if (claim.attempts > MAX_INDEX_ATTEMPTS) {
      await failIndexing(claim);
      continue;
    }

    const heartbeat = setInterval(() => {
      void renewIndexingLease(claim).catch((error: unknown) => {
        console.error("Could not renew indexing lease", claim.id, error);
      });
    }, LEASE_MS / 4);

    try {
      const embedding = claim.embedding ?? await embedOriginal(claim.key);
      const tags = await autoTagImage(embedding);
      await finishIndexing(claim, embedding, tags);
    } catch (error) {
      console.error("Image indexing attempt failed", claim.id, claim.attempts, error);
      await failIndexing(claim);
    } finally {
      clearInterval(heartbeat);
    }
  } catch (error) {
    if (shutdown.signal.aborted) break;
    console.error("Indexing queue unavailable", error);
    await sleep(5_000, undefined, { signal: shutdown.signal }).catch(() => {});
  }
}

await closeDb();
