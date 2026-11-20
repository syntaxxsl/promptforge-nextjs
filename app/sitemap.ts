import type { MetadataRoute } from 'next'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://promptforge-nextjs.vercel.app').replace(
  /\/$/,
  ''
)

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number }[] = [
    { path: '', priority: 1 },
    { path: '/faq', priority: 0.7 },
    { path: '/changelog', priority: 0.6 },
    { path: '/kvkk', priority: 0.4 },
  ]

  const now = new Date()

  return pages.map((page) => ({
    url: `${siteUrl}${page.path}`,
    lastModified: now,
    changeFrequency: page.path === '' ? 'weekly' : 'monthly',
    priority: page.priority,
  }))
}
