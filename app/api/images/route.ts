import { getDb } from "@/lib/mongodb";

export async function GET() {
  const db = await getDb();

  const images = await db
    .collection("images")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  // Serialize _id to string for the client
  const serialized = images.map((img) => ({
    ...img,
    _id: img._id.toString(),
  }));

  return Response.json(serialized);
}
