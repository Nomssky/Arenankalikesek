import { getAllPosts } from '@/lib/content'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import { formatDate } from '@/lib/utils'
import { ArrowRightIcon, NewspaperIcon } from '@heroicons/react/24/outline'

export const metadata: Metadata = {
  title: 'Blog & Berita',
  description:
    'Baca artikel, reportase, dan berita terbaru dari Desa Wisata Arenan Kalikesek dan Desa Sriwulan.',
}

export default function BlogPage() {
  const posts = getAllPosts().filter((post) => post.published !== false)

  return (
    <>
      <Hero
        title="Blog & Berita"
        subtitle="Artikel dan berita terbaru dari Arenan Kalikesek"
        image="/images/village-landscape.jpg"
        height="full"
      />

      <Section>
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">Belum ada artikel.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.slug} className="card flex h-full flex-col overflow-hidden">
                <Link
                  href={`/blog/${post.slug}`}
                  className="group relative block aspect-video overflow-hidden bg-emerald-100"
                  aria-label={`Baca artikel ${post.title}`}
                >
                  {post.image ? (
                    <Image
                      src={post.image}
                      alt={post.imageAlt ?? `Sampul artikel ${post.title}`}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-emerald-300">
                      <NewspaperIcon className="h-12 w-12" />
                    </div>
                  )}
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="break-anywhere mb-3 text-lg font-semibold leading-7 text-gray-900">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="transition-colors hover:text-emerald-600"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mb-4 text-sm leading-6 text-gray-600">{post.excerpt}</p>
                  <div className="mt-auto border-t border-gray-100 pt-4">
                    <div className="mb-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500">
                      {post.author && <span>Oleh {post.author}</span>}
                      {post.author && post.date && <span aria-hidden="true">&bull;</span>}
                      {post.date && <time dateTime={post.date}>{formatDate(post.date)}</time>}
                    </div>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      Baca selengkapnya
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
