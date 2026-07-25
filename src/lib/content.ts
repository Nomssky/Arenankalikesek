import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const contentDir = path.join(process.cwd(), 'src', 'content')

export function getContentByType(type: string) {
  const dir = path.join(contentDir, type)
  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
    const { data, content } = matter(raw)
    return {
      ...data,
      content,
      slug: file.replace(/\.mdx?$/, ''),
    }
  })
}

export function getContentBySlug(type: string, slug: string) {
  const dir = path.join(contentDir, type)
  const files = ['.md', '.mdx'].map((ext) => path.join(dir, `${slug}${ext}`))

  for (const file of files) {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8')
      const { data, content } = matter(raw)
      return { ...data, content, slug }
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

export function getAllPosts() {
  return getContentByType('posts') as unknown as {
    slug: string
    title: string
    date: string
    author?: string
    category?: string
    excerpt: string
    content: string
    image?: string
    published: boolean
  }[]
}

export function getPostBySlug(slug: string) {
  return getContentBySlug('posts', slug) as unknown as {
    slug: string
    title: string
    date: string
    author?: string
    category?: string
    excerpt: string
    content: string
    image?: string
    published: boolean
  } | null
}

export function getAllProducts() {
  return getContentByType('products') as unknown as {
    slug: string
    id: string
    name: string
    description: string
    price: number
    image?: string
    category: string
    stock: number
  }[]
}

export function getAllTourPackages() {
  return getContentByType('tours') as unknown as {
    slug: string
    id: string
    name: string
    description: string
    price: number
    priceType: string
    maxPrice?: number
    image?: string
    category: string
    available: boolean
  }[]
}

export function getPageBySlug(slug: string) {
  return getContentBySlug('pages', slug) as unknown as {
    slug: string
    title: string
    content: string
    image?: string
  } | null
}
