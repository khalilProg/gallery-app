import { ObjectId } from "mongodb";
import { deleteImage } from "@/lib/image-storage";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid image ID." }, { status: 400 });
  }

  try {
    await deleteImage(new ObjectId(id));
    return Response.json({ success: true });
  } catch (error) {
    console.error("Image deletion failed", { id, error });
    return Response.json({ error: "Could not delete the image. Try again." }, { status: 503 });
  }
}
