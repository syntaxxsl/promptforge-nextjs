/** @type {import('next').NextConfig} */

/**
 * Build memory tuning.
 *
 * The sandbox this project is built in has ~2 GB of usable RAM and no swap, and
 * `next build` was previously OOM-killed. The knobs below cut the peak RSS of
 * the build without changing what ships:
 *
 *  - `webpack.cache = false`  : the filesystem cache was serialising multi-hundred
 *                               kilobyte strings and holding them in memory.
 *  - `productionBrowserSourceMaps: false` : browser source maps are the single
 *                               largest build artefact.
 *  - `experimental.cpus = 1` / `workerThreads: false` : one page-compile worker
 *                               instead of one per core (8 cores x worker heap was
 *                               the main spike).
 *  - `eslint.ignoreDuringBuilds` : linting is a separate, cheaper command
 *                               (`npm run lint`) and does not need to run inside
 *                               the build.
 *
 * Type checking stays enabled in the build: `npm run typecheck` is also run
 * separately, but a build that silently skips types would be a lie.
 */
const nextConfig = {
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    typedRoutes: false,
    workerThreads: false,
    cpus: 1
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      // Avoid the filesystem cache (large string serialisation).
      config.cache = false
    }
    return config
  }
}

module.exports = nextConfig
