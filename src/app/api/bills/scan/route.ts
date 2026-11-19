import { getCtx, handle, HttpError, json } from "@/lib/server/http";
import { scanBill } from "@/lib/ingest/bill-scan";
import { extractBill, type ImageInput } from "@/lib/ingest/vision";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel rejects request bodies over 4.5 MB. The browser shrinks photos first; this is the backstop. */
const MAX_BYTES = 4 * 1024 * 1024;
const MIMES: Record<string, ImageInput["mime"]> = { "image/jpeg": "image/jpeg", "image/png": "image/png", "image/webp": "image/webp" };

/**
 * multipart: `image` (jpeg/png/webp ≤ 4 MB), optional `vendorId`.
 * Reads the bill and returns a review. Saves nothing: the owner then accepts or rejects via POST /api/actions/[pendingId].
 * Response: { pendingId | null, expiresAt | null, review }.
 */
export const POST = (req: Request) =>
  handle(async () => {
    if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) throw new HttpError(400, "Send the photo as multipart form data");
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof Blob)) throw new HttpError(400, "image is required");
    const mime = MIMES[file.type];
    if (!mime) throw new HttpError(415, "Photo must be JPG, PNG or WebP");
    if (file.size === 0) throw new HttpError(400, "Photo is empty");
    if (file.size > MAX_BYTES) throw new HttpError(413, "Photo is too big (max 4 MB)");
    const vendorRaw = form.get("vendorId");
    const vendorId = typeof vendorRaw === "string" && vendorRaw ? vendorRaw : null;
    if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, "ANTHROPIC_API_KEY is not set");

    const c = await getCtx();
    const image: ImageInput = { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mime };
    // only the model call is mapped to 502; a DB error stays a plain 500
    const read = async (i: ImageInput) => {
      try {
        return await extractBill(i);
      } catch (e) {
        console.error("[bills/scan]", e);
        throw new HttpError(502, "Bill padhne mein dikkat aayi. Thodi der baad dobara try karo");
      }
    };
    return json(await scanBill(c.db, c.merchantId, image, { vendorId, now: c.now }, read));
  });
