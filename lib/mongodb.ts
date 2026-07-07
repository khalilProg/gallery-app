import { MongoClient, Db } from "mongodb";

// Prevent multiple connections during Next.js hot reload in dev.
// The client is created lazily inside getDb() so that the Next.js build
// process never instantiates MongoClient (and never needs MONGO_URI).
declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

function getClient(): MongoClient {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not set");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClient) {
      global._mongoClient = new MongoClient(uri);
    }
    return global._mongoClient;
  }

  return new MongoClient(uri);
}

export async function getDb(): Promise<Db> {
  const client = getClient();
  await client.connect();
  return client.db("gallery");
}
