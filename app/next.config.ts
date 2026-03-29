import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
