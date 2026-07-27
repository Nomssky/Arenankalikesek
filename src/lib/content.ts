import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const contentDir = path.join(process.cwd(), 'src', 'content')

export function getContentByType<T>(type: string): T[] {
  const dir = path.join(contentDir, type)
  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
    const { data, content } = matter(raw)
    return { ...data, content, slug: file.replace(/\.mdx?$/, '') } as T
  })
}

export function getContentBySlug<T>(type: string, slug: string): T | null {
  const dir = path.join(contentDir, type)
  const files = ['.md', '.mdx'].map((ext) => path.join(dir, `${slug}${ext}`))

  for (const file of files) {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8')
      const { data, content } = matter(raw)
      return { ...data, content, slug } as T
    }
  }

  return null
}

export function getAllSlugs(type: string) {
  const dir = path.join(contentDir, type)
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx?$/, ''))
}

interface Post {
  slug: string
  title: string
  date: string
  author?: string
  category?: string
  excerpt: string
  content: string
  image?: string
  published: boolean
}

export function getAllPosts() {
  return getContentByType<Post>('posts')
}

export function getPostBySlug(slug: string) {
  return getContentBySlug<Post>('posts', slug)
}
