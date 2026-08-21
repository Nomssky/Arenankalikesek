'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRightIcon } from '@heroicons/react/24/outline'

interface NewsItem {
  title: string
  excerpt: string
  image: string
  href: string
  category: string
}

interface ApiPost {
  slug: string
  title: string
  excerpt: string
  image?: string
  category?: string
}

// Beranda tetap statis (SSG); artikel 3 terbaru diambil client-side dari
// /api/blog/posts agar beranda tidak ikut force-dynamic.
export default function HomeNews() {
  const [items, setItems] = useState<NewsItem[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/blog/posts', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((posts: ApiPost[]) =>
        setItems(
          posts.slice(0, 3).map((post) => ({
            title: post.title,
            excerpt: post.excerpt,
            image: post.image ?? '/images/village-landscape.jpg',
            href: `/blog/${post.slug}`,
            category: post.category ?? 'Artikel',
          })),
        ),
      )
      .catch(() => setItems([]))
    return () => controller.abort()
  }, [])

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          className="motion-card group flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_18px_42px_-28px_rgba(12,54,27,0.5)]"
        >
          <Link
            href={item.href}
            aria-label={`Baca artikel ${item.title}`}
            className="block aspect-[4/3] overflow-hidden"
            data-gallery-reveal
          >
            <div
              className="h-full w-full bg-cover bg-center transition duration-700 group-hover:scale-[1.03]"
              data-gallery-media
              style={{ backgroundImage: `url(${item.image})` }}
            />
          </Link>
          <div className="flex flex-1 flex-col p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-500">
              {item.category}
            </p>
            <h3 className="mt-3 line-clamp-3 text-lg font-semibold leading-7 text-emerald-950">
              <Link href={item.href}>{item.title}</Link>
            </h3>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">{item.excerpt}</p>
            <Link
              href={item.href}
              className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-emerald-700"
            >
              Baca selengkapnya
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  )
}