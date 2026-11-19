import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30_000,
    // Hard guard: tests must never spend API credits or touch the real DB. Empty keys make any real client throw.
    env: { ANTHROPIC_API_KEY: "", SARVAM_API_KEY: "", DATABASE_URL: "" },
  },
});
