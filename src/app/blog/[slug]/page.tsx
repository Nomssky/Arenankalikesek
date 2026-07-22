import { getPostBySlug, getAllSlugs } from '@/lib/content'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'

export async function generateStaticParams() {
  const slugs = getAllSlugs('posts')
  return slugs.map((slug) => ({ slug }))
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post || post.published === false) {
    notFound()
  }

  return (
    <article className="py-12">
      <div className="container-page max-w-4xl">
        <Link
          href="/blog"
          className="text-emerald-600 hover:text-emerald-700 font-medium text-sm mb-6 inline-block"
        >
          &larr; Kembali ke Blog
        </Link>

        {post.image && (
          <div className="aspect-video bg-emerald-100 rounded-2xl overflow-hidden mb-8">
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url(${post.image})` }}
            />
          </div>
        )}

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          {post.title}
        </h1>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 pb-8 border-b">
          <span>{formatDate(post.date)}</span>
          {post.author && <span>Oleh: {post.author}</span>}
          {post.category && (
            <span className="badge-green">{post.category}</span>
          )}
        </div>

        <div className="max-w-none text-gray-700 leading-relaxed space-y-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-6 [&_p]:leading-relaxed [&_a]:text-emerald-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </div>
    </article>
  )
}
