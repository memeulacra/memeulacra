import { execSync } from "child_process"

const buildId = execSync('git rev-parse HEAD').toString().trim()

/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: () => buildId,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig