import { createHash } from "node:crypto";

/** PRD: never store raw VPAs. Salted SHA-256, truncated. */
export function hashVpa(vpa: string, salt = process.env.HASH_SALT ?? "vyapaar-demo-salt"): string {
  return createHash("sha256").update(`${salt}:${vpa.trim().toLowerCase()}`).digest("hex").slice(0, 16);
}
