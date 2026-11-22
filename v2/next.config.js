// eslint-disable-next-line @typescript-eslint/no-require-imports -- Next config remains CommonJS.
const path = require('node:path')

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
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), geolocation=()' }
      ]
    }]
  },
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  eslint: { ignoreDuringBuilds: true },
  // The repo also contains the V1 app with its own lockfile, so Next.js would
  // infer the workspace root as the repository root. That mis-inference puts
  // the build output in the wrong directory and Vercel ends up deploying an
  // empty bundle (every route answers 404). Pinning the root to v2/ keeps the
  // output where Vercel expects it.
  turbopack: {
    root: path.resolve(__dirname)
  },
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
