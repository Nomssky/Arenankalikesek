import { getPostBySlug, getAllPostSlugs } from '@/lib/content'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export async function generateStaticParams() {
  const slugs = getAllPostSlugs()
  return slugs.map((slug) => ({ slug }))
}

type BlogPostPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post || post.published === false) {
    return { title: 'Artikel tidak ditemukan' }
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arenankalikesek.com').replace(
    /\/$/,
    '',
  )
  const canonical = `${siteUrl}/blog/${post.slug}`

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: canonical,
      siteName: 'Arenan Kalikesek',
      locale: 'id_ID',
      type: 'article',
      publishedTime: post.date,
      authors: post.author ? [post.author] : undefined,
      images: post.image
        ? [
            {
              url: `${siteUrl}${post.image}`,
              alt: post.imageAlt ?? `Sampul artikel ${post.title}`,
            },
          ]
        : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post || post.published === false) {
    notFound()
  }

  return (
    <article className="pb-12 pt-28">
      <div className="container-page max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-emerald-700 hover:underline">
                Beranda
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/blog" className="hover:text-emerald-700 hover:underline">
                Blog
              </Link>
            </li>
          </ol>
        </nav>

        <h1 className="break-anywhere mb-4 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl md:text-4xl">
          {post.title}
        </h1>

        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-gray-500 sm:gap-4">
          {post.type === 'Reportase' && (
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-600">
              Reportase
            </span>
          )}
          {post.author && <span>Oleh: {post.author}</span>}
          {post.date && <time dateTime={post.date}>{formatDate(post.date)}</time>}
        </div>

        {post.image && (
          <div className="relative mb-8 aspect-video overflow-hidden rounded-2xl bg-emerald-100">
            <Image
              src={post.image}
              alt={post.imageAlt ?? `Sampul artikel ${post.title}`}
              fill
              sizes="(min-width: 1024px) 896px, 100vw"
              className="object-cover"
            />
          </div>
        )}

        <div className="max-w-none text-justify text-gray-700 leading-relaxed space-y-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-6 [&_p]:leading-relaxed [&_a]:text-emerald-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Kembali ke Blog
          </Link>
        </div>
      </div>
    </article>
  )
}
