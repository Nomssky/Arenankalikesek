import { getAllPosts, type Post } from '@/lib/blog'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import { formatDate } from '@/lib/utils'
import { ArrowRightIcon, NewspaperIcon } from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Blog & Berita',
  description:
    'Baca artikel, reportase, dan berita terbaru dari Desa Wisata Arenan Kalikesek dan Desa Sriwulan.',
}

function PostCard({ post }: { post: Post }) {
  return (
    <article className="card flex h-full flex-col overflow-hidden">
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {post.type === 'Reportase' && (
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-600">
              Reportase
            </span>
          )}
          {post.category && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              {post.category}
            </span>
          )}
        </div>
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
  )
}

function PostGrid({ posts }: { posts: Post[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <PostCard key={post.slug} post={post} />
      ))}
    </div>
  )
}

export default async function BlogPage() {
  const posts = (await getAllPosts()).filter((post) => post.published !== false)
  const reportase = posts.filter((post) => post.type === 'Reportase')
  const articles = posts.filter((post) => post.type !== 'Reportase')

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
        ) : reportase.length === 0 ? (
          <PostGrid posts={posts} />
        ) : (
          <div className="space-y-14">
            <section aria-labelledby="reportase-title">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-emerald-950/10 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                    Reportase
                  </p>
                  <h2 id="reportase-title" className="mt-1 text-2xl font-semibold text-emerald-950">
                    Reportase Terbaru
                  </h2>
                </div>
                <p className="text-sm text-gray-500">{reportase.length} reportase</p>
              </div>
              <PostGrid posts={reportase} />
            </section>

            <section aria-labelledby="articles-title">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-emerald-950/10 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                    Berita & Info
                  </p>
                  <h2 id="articles-title" className="mt-1 text-2xl font-semibold text-emerald-950">
                    Artikel Lainnya
                  </h2>
                </div>
                <p className="text-sm text-gray-500">{articles.length} artikel</p>
              </div>
              <PostGrid posts={articles} />
            </section>
          </div>
        )}
      </Section>
    </>
  )
}
