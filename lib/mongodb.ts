import { MongoClient, type Db } from "mongodb";

// Create the client on first use, then share its connection pool across routes.
const mongo = globalThis as typeof globalThis & { _mongoClient?: MongoClient };

export async function getDb(): Promise<Db> {
  if (!mongo._mongoClient) {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI environment variable is not set");
    mongo._mongoClient = new MongoClient(uri);
  }

  await mongo._mongoClient.connect();
  return mongo._mongoClient.db("gallery");
}

export async function closeDb() {
  await mongo._mongoClient?.close();
  mongo._mongoClient = undefined;
}
