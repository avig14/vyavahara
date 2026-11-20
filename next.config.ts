import type { NextConfig } from "next";

// Cache Components is OFF on purpose: the PRD needs `runtime`/`maxDuration`
// route exports (Twilio webhook, PDF route), and Cache Components rejects `runtime`.
const nextConfig: NextConfig = {
  // react-pdf loads the TTF fonts and the logo PNG from disk at runtime; make sure Vercel ships them with the PDF route.
  outputFileTracingIncludes: {
    "/api/reports/pdf/[token]": ["./assets/fonts/**/*", "./public/brand/vyavahara-logo-256.png"],
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
