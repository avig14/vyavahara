import type { NextConfig } from "next";

// Cache Components is OFF on purpose: the PRD needs `runtime`/`maxDuration`
// route exports (Twilio webhook, PDF route), and Cache Components rejects `runtime`.
const nextConfig: NextConfig = {
  // react-pdf loads TTF files at runtime; make sure Vercel ships them with the PDF routes.
  outputFileTracingIncludes: {
    "/api/reports/pdf/[token]": ["./assets/fonts/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
