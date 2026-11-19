import { describe, expect, it } from "vitest";
import { isQuotaError } from "./client";

describe("isQuotaError", () => {
  it("spots Neon's 402 quota error, also when drizzle wraps it", () => {
    const neon = new Error("Server error (HTTP status 402): Your account or project has exceeded the quota. Upgrade your plan to increase limits.");
    expect(isQuotaError(neon)).toBe(true);
    const wrapped = new Error("Failed query: select ...", { cause: neon });
    expect(isQuotaError(wrapped)).toBe(true);
  });

  it("ignores everything else", () => {
    expect(isQuotaError(new Error("connection reset"))).toBe(false);
    expect(isQuotaError(new Error("HTTP status 500"))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError("nope")).toBe(false);
  });
});
