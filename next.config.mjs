import path from 'path';
import { fileURLToPath } from 'url';
import { buildAllowedDevOrigins } from './next-dev-origins.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: buildAllowedDevOrigins(),
  // 正確的 Turbopack 設定（Next.js 15/16 推薦寫法）
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;