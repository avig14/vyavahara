import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { getDb } from "../src/lib/db/client";
import { generateSnapshot } from "../src/lib/seed/generate";
import { writeSnapshot } from "../src/lib/seed/write";
import { normalizePhone } from "../src/lib/wa/cloud";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing. Copy .env.example to .env.local / .env and set it.");
    process.exit(1);
  }
  const snap = generateSnapshot({
    ownerPhoneWa: normalizePhone(process.env.OWNER_WA),
    upiId: process.env.MERCHANT_UPI_ID ?? "guptastore@paytm",
  });
  console.log("Seeding 120 days ending", snap.now.toISOString(), "…");
  const counts = await writeSnapshot(getDb(), snap);
  console.log("Done:", counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
