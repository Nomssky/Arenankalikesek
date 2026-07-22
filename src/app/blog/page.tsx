import { getAllPosts } from '@/lib/content'
import Link from 'next/link'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import { formatDate } from '@/lib/utils'

export default function BlogPage() {
  const posts = getAllPosts().filter((p) => p.published !== false)

  return (
    <>
      <Hero
        title="Blog & Berita"
        subtitle="Artikel dan berita terbaru dari Arenan Kalikesek"
        height="sm"
      />

      <Section>
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">Belum ada artikel.</p>
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
                    <div className="w-full h-full flex items-center justify-center text-emerald-300 text-4xl">
                      📝
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
                    <span className="text-emerald-600 group-hover:underline">Baca &rarr;</span>
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
