import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const postsDir = path.join(process.cwd(), 'src', 'content', 'posts')
const reportaseDir = path.join(process.cwd(), 'reportase', 'md')

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
  source?: string
}

function readPostFile(dir: string, file: string): Post {
  const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
  const { data, content } = matter(raw)

  return {
    ...data,
    content,
    slug: file.replace(/\.mdx?$/, ''),
  } as Post
}

function listPostFiles(dir: string) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((file) => /\.mdx?$/i.test(file))
    .sort()
}

export function getAllPostSlugs() {
  return [...listPostFiles(postsDir), ...listPostFiles(reportaseDir)].map((file) =>
    file.replace(/\.mdx?$/, ''),
  )
}

export function getAllPosts() {
  const posts = [
    ...listPostFiles(postsDir).map((file) => readPostFile(postsDir, file)),
    ...listPostFiles(reportaseDir).map((file) => readPostFile(reportaseDir, file)),
  ]

  return posts.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return -1
    if (!b.date) return 1

    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
}

export function getPostBySlug(slug: string): Post | null {
  if (!/^[a-z0-9_-]+$/i.test(slug)) return null

  for (const dir of [postsDir, reportaseDir]) {
    const file = listPostFiles(dir).find(
      (candidate) => candidate.replace(/\.mdx?$/, '') === slug,
    )
    if (file) return readPostFile(dir, file)
  }

  return null
}
