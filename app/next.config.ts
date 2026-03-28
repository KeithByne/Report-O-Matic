import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: stops logging every GET/POST line (still shows compile errors and crashes).
  logging: {
    incomingRequests: false,
  },
};

export default nextConfig;
