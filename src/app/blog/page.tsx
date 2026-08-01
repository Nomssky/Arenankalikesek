import { getAllPosts } from '@/lib/content'
import Link from 'next/link'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import { formatDate } from '@/lib/utils'
import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
} from '@heroicons/react/24/outline'

type BlogPageProps = {
  searchParams: Promise<{ q?: string | string[] }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams
  const query = Array.isArray(params.q) ? params.q[0] : (params.q ?? '')
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID')
  const publishedPosts = getAllPosts().filter((post) => post.published !== false)
  const posts = normalizedQuery
    ? publishedPosts.filter((post) =>
        [post.title, post.excerpt, post.category, post.author, post.content]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('id-ID')
          .includes(normalizedQuery),
      )
    : publishedPosts

  return (
    <>
      <Hero
        title="Blog & Berita"
        subtitle="Artikel dan berita terbaru dari Arenan Kalikesek"
        image="/images/village-landscape.jpg"
        height="full"
      />

      <Section>
        <form
          action="/blog"
          method="get"
          className="mx-auto mb-10 flex max-w-3xl flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm sm:flex-row"
          role="search"
        >
          <label className="relative flex-1">
            <span className="sr-only">Cari artikel</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Cari judul atau isi artikel..."
              className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            className="h-12 rounded-xl bg-emerald-700 px-6 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            Cari Artikel
          </button>
          {normalizedQuery && (
            <Link
              href="/blog"
              className="inline-flex h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              Reset
            </Link>
          )}
        </form>

        {normalizedQuery && (
          <p className="mb-6 text-sm text-gray-600">
            {posts.length} hasil untuk &ldquo;{query.trim()}&rdquo;
          </p>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">
              {normalizedQuery
                ? 'Artikel yang Anda cari belum ditemukan.'
                : 'Belum ada artikel.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="card group">
                <div className="aspect-video bg-emerald-100 overflow-hidden">
                  {post.image ? (
                    <div
                      className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-300"
                      style={{ backgroundImage: `url(${post.image})` }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-emerald-300">
                      <NewspaperIcon className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  {post.category && (
                    <span className="badge-green text-xs mb-2 inline-block">
                      {post.category}
                    </span>
                  )}
                  <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{formatDate(post.date)}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 group-hover:underline">
                      Baca
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
