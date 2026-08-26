import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Página de captura de leads (estática) — /captura serve public/captura.html
      { source: "/captura", destination: "/captura.html" },
    ];
  },
};

export default nextConfig;
