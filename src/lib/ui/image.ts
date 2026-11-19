/**
 * Shrink a phone photo before upload. Vercel refuses request bodies over 4.5 MB and a phone photo is often 5 to 12 MB;
 * Claude reads a bill fine at a 1600 px long edge. Rotation from the camera is applied. Output is JPEG.
 */
export class ImageReadError extends Error {}

export async function shrinkImage(file: Blob, maxEdge = 1600, quality = 0.85): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageReadError("Yeh photo khul nahi payi. JPG ya PNG photo lo.");
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageReadError("Photo process nahi ho payi. Dobara try karo.");
    ctx.fillStyle = "#fff"; // PNG with transparency would turn black as JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!out) throw new ImageReadError("Photo process nahi ho payi. Dobara try karo.");
    return out;
  } finally {
    bmp.close();
  }
}
