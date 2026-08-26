import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://js.paystack.co",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' https://*.supabase.co data: blob:",
            "connect-src 'self' https://api.paystack.co https://*.supabase.co",
            "frame-src https://checkout.paystack.com",
            "font-src 'self'",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;
