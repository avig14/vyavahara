import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getCtx, handle, HttpError } from "@/lib/server/http";
import { loadSnapshot } from "@/lib/db/queries";
import { buildContext } from "@/lib/analytics/recommendations";
import { CARD_KINDS, dailyCardData, stockCardData, udhaarCardData, type CardKind } from "@/lib/wa/cards-data";
import { DailyCard, SIZES, StockCard, UdhaarCard } from "@/lib/wa/cards";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ kind: string }> };

/**
 * The photo that goes with a WhatsApp reply, drawn from live data (layouts follow assets/social).
 * Public like the pay page: it shows shop figures, so the link is not guessable-secret; do not share it outside the owner chat.
 */
export const GET = (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const { kind } = await params;
    if (!CARD_KINDS.includes(kind as CardKind)) throw new HttpError(404, "Unknown card");
    const c = await getCtx();
    const snap = await loadSnapshot(c.db, c.merchantId, { now: c.now });
    const [regular, bold, logoPng] = await Promise.all([
      // literal paths on purpose: a computed path makes the bundler trace the whole project into the deployment
      readFile(path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf")),
      readFile(path.join(process.cwd(), "assets/fonts/NotoSans-Bold.ttf")),
      readFile(path.join(process.cwd(), "public/wa/logo.png")),
    ]);
    const logo = `data:image/png;base64,${logoPng.toString("base64")}`;
    const ctx = buildContext(snap);
    const el =
      kind === "daily" ? <DailyCard d={dailyCardData(snap, ctx)} logo={logo} /> : kind === "udhaar" ? <UdhaarCard d={udhaarCardData(snap)} logo={logo} /> : <StockCard d={stockCardData(snap, ctx)} logo={logo} />;
    const size = SIZES[kind as CardKind];
    return new ImageResponse(el, {
      ...size,
      fonts: [
        { name: "Noto Sans", data: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength) as ArrayBuffer, weight: 400, style: "normal" },
        { name: "Noto Sans", data: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength) as ArrayBuffer, weight: 700, style: "normal" },
      ],
      headers: { "cache-control": "no-store" },
    });
  });
