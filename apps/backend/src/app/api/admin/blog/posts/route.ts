import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-server'
import { requireAdmin } from '../../../../../lib/admin-guard'
import { slugify } from '../../../../../lib/utils'

// Ringkasan (excerpt) dihitung server bila admin tidak mengisinya:
// buang sintaks markdown lalu ambil 160 karakter pertama.
function deriveExcerpt(content: string): string {
  return content
    .replace(/[#*`>\[\]()!_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  try {
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!title || !content) {
      return NextResponse.json({ error: 'Judul dan isi artikel wajib diisi' }, { status: 400 })
    }

    // Slug dihasilkan dari judul bila tidak dikirim; judul duplikat bisa kena
    // unique index slug → 409 (ponytail: tanpa counter suffix; upgrade: akhiri
    // dengan -2, -3 dst seperti tour-packages).
    const slug = slugify(body.slug || title)
    if (!slug) {
      return NextResponse.json({ error: 'Slug tidak valid' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        slug,
        title,
        date: body.date || new Date().toISOString().slice(0, 10),
        author: typeof body.author === 'string' && body.author.trim() ? body.author.trim() : 'Admin Arenan Kalikesek',
        category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Reportase',
        type: body.type || 'Reportase',
        excerpt: body.excerpt?.trim() || deriveExcerpt(content),
        content,
        image: body.image?.trim() || null,
        image_alt: body.imageAlt?.trim() || null,
        published: body.published ?? true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Slug artikel sudah dipakai' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Gagal menyimpan artikel' }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Create blog post error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
