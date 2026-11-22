/**
 * Keep the existing webpack build path while evaluating Next.js 16.
 * Next.js 16 defaults to Turbopack; this project has a deliberate webpack
 * memory configuration, so package scripts explicitly pass --webpack.
 */
const nextConfig = {
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  experimental: {
    typedRoutes: false,
    workerThreads: false,
    cpus: 1
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false
    }
    return config
  }
}

module.exports = nextConfig
