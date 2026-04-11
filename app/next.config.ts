import path from "node:path";
import type { NextConfig } from "next";

const securityHeaders: { key: string; value: string }[] = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" });
}

const nextConfig: NextConfig = {
  // Monorepo: silence inferred workspace-root warning (multiple lockfiles).
  outputFileTracingRoot: path.join(__dirname, ".."),
  async headers() {
    return [{ source: "/:path*", headers: [...securityHeaders] }];
  },
  // Dev-only: stops logging every GET/POST line (still shows compile errors and crashes).
  logging: {
    incomingRequests: false,
  },
  // Keep native packages out of webpack so runtime files resolve (Sharp binaries, PDFKit .afm fonts).
  serverExternalPackages: ["sharp", "pdfkit"],
  // Letterhead uploads: 4 MB cap + multipart overhead (Vercel-friendly).
  experimental: {
    proxyClientMaxBodySize: "5mb",
  },
};

export default nextConfig;
