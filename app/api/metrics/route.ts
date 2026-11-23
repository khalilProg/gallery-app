import { NextResponse } from 'next/server';
import { getRegistry, setImagesStored } from '@/lib/metrics';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const count = await db.collection('images').countDocuments();
    setImagesStored(count);
  } catch {
  }

  const registry = getRegistry();
  const metrics = await registry.metrics();
  return new NextResponse(metrics, {
    headers: {
      'Content-Type': registry.contentType,
    },
  });
}
