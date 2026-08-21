// Seed blog_posts dari file markdown (apps/frontend/reportase/md + src/content/posts).
// Idempoten: upsert per slug (ON CONFLICT slug DO UPDATE), aman dijalankan ulang.
// Penggunaan:
//   node apps/backend/scripts/seed-blog-posts.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.join(scriptDir, '..', '..', 'frontend')
const dirs = [
  path.join(frontendRoot, 'reportase', 'md'),
  path.join(frontendRoot, 'src', 'content', 'posts'),
]

const posts = []
for (const dir of dirs) {
  for (const file of readdirSync(dir).filter((f) => /\.mdx?$/i.test(f))) {
    const raw = readFileSync(path.join(dir, file), 'utf8').replace(/^\uFEFF/, '')
    const { data, content } = matter(raw)
    posts.push({
      slug: file.replace(/\.mdx?$/, ''),
      title: String(data.title ?? file),
      date: data.date ? new Date(data.date).toISOString().slice(0, 10) : undefined,
      author: data.author ?? 'Admin Arenan Kalikesek',
      category: data.category ?? 'Reportase',
      type: data.type ?? 'Artikel',
      excerpt: data.excerpt ?? '',
      content: content.trim(),
      image: data.image ?? null,
      image_alt: data.imageAlt ?? null,
      published: data.published ?? true,
    })
  }
}

for (const post of posts) {
  const { error } = await sb.from('blog_posts').upsert(post, { onConflict: 'slug' })
  if (error) {
    console.error(`✗ ${post.slug}: ${error.message}`)
    process.exitCode = 1
  } else {
    console.log(`✓ ${post.slug} — ${post.title.slice(0, 60)}`)
  }
}
console.log(`\n${posts.length} artikel di-seed ke blog_posts.`)
