import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Permite compilar en otra carpeta (p. ej. para verificar) sin pisar la de `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // pdf-parse (pdfjs) se carga tal cual desde node_modules en el servidor.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
