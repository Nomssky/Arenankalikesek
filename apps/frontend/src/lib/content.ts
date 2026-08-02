import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const postsDir = path.join(process.cwd(), 'src', 'content', 'posts')

export interface Post {
  slug: string
  title: string
  date: string
  author?: string
  category?: string
  excerpt: string
  content: string
  image?: string
  published?: boolean
  source?: string
}

function isPostFile(file: string) {
  return file.endsWith('.md') || file.endsWith('.mdx')
}

function readPostFile(file: string): Post {
  const raw = fs.readFileSync(path.join(postsDir, file), 'utf-8')
  const { data, content } = matter(raw)

  return {
    ...data,
    content,
    slug: file.replace(/\.mdx?$/, ''),
  } as Post
}

export function getAllPostSlugs() {
  if (!fs.existsSync(postsDir)) return []

  return fs
    .readdirSync(postsDir)
    .filter(isPostFile)
    .map((file) => file.replace(/\.mdx?$/, ''))
}

export function getAllPosts() {
  if (!fs.existsSync(postsDir)) return []

  return fs
    .readdirSync(postsDir)
    .filter(isPostFile)
    .map(readPostFile)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getPostBySlug(slug: string): Post | null {
  if (!/^[a-z0-9-]+$/i.test(slug) || !fs.existsSync(postsDir)) return null

  const file = fs
    .readdirSync(postsDir)
    .filter(isPostFile)
    .find((candidate) => candidate.replace(/\.mdx?$/, '') === slug)

  return file ? readPostFile(file) : null
}
