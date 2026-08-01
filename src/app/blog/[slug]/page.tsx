import { getPostBySlug, getAllPostSlugs } from '@/lib/content'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export async function generateStaticParams() {
  const slugs = getAllPostSlugs()
  return slugs.map((slug) => ({ slug }))
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post || post.published === false) {
    notFound()
  }

  return (
    <article className="pb-12 pt-28">
      <div className="container-page max-w-4xl">
        <Link
          href="/blog"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Kembali ke Blog
        </Link>

        {post.image && (
          <div className="aspect-video bg-emerald-100 rounded-2xl overflow-hidden mb-8">
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url(${post.image})` }}
            />
          </div>
        )}

        <h1 className="break-anywhere mb-4 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl md:text-4xl">
          {post.title}
        </h1>

        <div className="mb-8 flex flex-wrap items-center gap-3 border-b pb-8 text-sm text-gray-500 sm:gap-4">
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
