import { headers } from 'next/headers'

export interface Post {
  slug: string
  title: string
  date?: string
  author?: string
  category?: string
  type?: string
  excerpt: string
  content: string
  image?: string
  imageAlt?: string
  published?: boolean
}

// Basis URL dari request agar selalu mengarah ke deployment yang sama
// (lokal: localhost, Vercel: domain produksi) — bukan NEXT_PUBLIC_SITE_URL
// yang bisa menunjuk ke deployment lain saat build.
async function baseUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export async function getAllPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${await baseUrl()}/api/blog/posts`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(`${await baseUrl()}/api/blog/posts/${slug}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
