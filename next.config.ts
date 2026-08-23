import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage (product images uploaded via the admin panel).
      // Wildcard: project refs are environment-specific.
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
