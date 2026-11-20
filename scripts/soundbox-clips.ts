/**
 * One-time: generate the Soundbox's fixed voice clips with Sarvam and save them to public/soundbox/.
 * They then play instantly and cost no credits at runtime. Safe to skip: the simulator works without them.
 *   npx tsx scripts/soundbox-clips.ts            (needs SARVAM_API_KEY in .env.local or .env)
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });
config();

const CLIPS: Record<string, string> = {
  "ek-second": "Ek second, dekh raha hoon.",
  "samajh-nahi": "Maaf kijiye, samajh nahi aaya. Ek baar phir boliye.",
};

async function main() {
  const { speak, sarvamConfigured } = await import("../src/lib/ingest/sarvam");
  if (!sarvamConfigured()) throw new Error("SARVAM_API_KEY is not set");
  const dir = join(process.cwd(), "public", "soundbox");
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(CLIPS)) {
    const file = join(dir, `${name}.wav`);
    if (existsSync(file) && !process.argv.includes("--force")) {
      console.log(`skip ${name} (exists; --force to redo)`);
      continue;
    }
    writeFileSync(file, await speak(text));
    console.log(`wrote public/soundbox/${name}.wav`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
