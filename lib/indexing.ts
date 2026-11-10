import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import { getDb } from "./mongodb.ts";

export const CLIP_MODEL = "Xenova/clip-vit-base-patch32";
const CLIP_VECTOR_SIZE = 512;
export const MAX_INDEX_ATTEMPTS = 4;
export const LEASE_MS = 120_000;

export type IndexingState = "pending" | "ready" | "failed";

interface IndexingJob {
  _id: ObjectId;
  key: string;
  embedding?: number[];
  embeddingModel?: string;
  indexing: {
    state: IndexingState;
    attempts: number;
    availableAt?: Date;
    leaseToken?: string;
  };
}

export function pendingIndexing(now = new Date()) {
  return { state: "pending" as const, attempts: 0, availableAt: now };
}

async function jobs() {
  return (await getDb()).collection<IndexingJob>("images");
}

export async function prepareIndexingQueue() {
  await (await jobs()).createIndex({ "indexing.state": 1, "indexing.availableAt": 1 });
}

export async function claimIndexingJob(now = new Date()) {
  const leaseToken = randomUUID();
  const job = await (await jobs()).findOneAndUpdate(
    { "indexing.state": "pending", "indexing.availableAt": { $lte: now } },
    {
      $set: {
        "indexing.availableAt": new Date(now.getTime() + LEASE_MS),
        "indexing.leaseToken": leaseToken,
      },
      $inc: { "indexing.attempts": 1 },
    },
    { sort: { "indexing.availableAt": 1 }, returnDocument: "after", projection: { key: 1, indexing: 1, embedding: 1, embeddingModel: 1 } },
  );
  if (!job) return null;
  const embedding = job.embeddingModel === CLIP_MODEL && Array.isArray(job.embedding) &&
    job.embedding.length === CLIP_VECTOR_SIZE && job.embedding.every(Number.isFinite)
    ? job.embedding : undefined;
  return { id: job._id, key: job.key, attempts: job.indexing.attempts, leaseToken, embedding };
}

type Claim = NonNullable<Awaited<ReturnType<typeof claimIndexingJob>>>;

function ownedJob(claim: Claim) {
  return { _id: claim.id, "indexing.state": "pending", "indexing.leaseToken": claim.leaseToken };
}

export async function renewIndexingLease(claim: Claim, now = new Date()) {
  return (await jobs()).updateOne(ownedJob(claim), {
    $set: { "indexing.availableAt": new Date(now.getTime() + LEASE_MS) },
  });
}

export async function finishIndexing(claim: Claim, embedding: number[], tags: string[]) {
  return (await jobs()).updateOne(ownedJob(claim), {
    $set: { embedding, tags, embeddingModel: CLIP_MODEL, indexing: { state: "ready", attempts: claim.attempts } },
    $unset: { caption: "", captionModel: "" },
  });
}

export async function failIndexing(claim: Claim, now = new Date()) {
  const indexing: IndexingJob["indexing"] = { state: "failed", attempts: claim.attempts };
  if (claim.attempts < MAX_INDEX_ATTEMPTS) {
    indexing.state = "pending";
    indexing.availableAt = new Date(now.getTime() + 5_000 * 2 ** (claim.attempts - 1));
  }
  return (await jobs()).updateOne(ownedJob(claim), { $set: { indexing } });
}
