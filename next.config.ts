import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Imagens das tortas podem vir de qualquer host https (URL informada no admin)
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
