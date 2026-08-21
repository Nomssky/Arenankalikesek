import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../../lib/supabase-server'
import { requireAdmin } from '../../../../../../lib/admin-guard'
import { slugify } from '../../../../../../lib/utils'

const ALLOWED_FIELDS = [
  'slug',
  'title',
  'date',
  'author',
  'category',
  'type',
  'excerpt',
  'content',
  'image',
  'imageAlt',
  'published',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  try {
    const { slug } = await params
    const body = await request.json()
    const updates: Record<string, unknown> = {}

    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        const value = body[field]
        if (field === 'image' || field === 'imageAlt') {
          updates[field === 'image' ? 'image' : 'image_alt'] = value?.trim() || null
        } else if (field === 'slug') {
          updates.slug = slugify(String(value ?? ''))
          if (!updates.slug) {
            return NextResponse.json({ error: 'Slug tidak valid' }, { status: 400 })
          }
        } else if (field === 'title') {
          const title = String(value ?? '').trim()
          if (!title) {
            return NextResponse.json({ error: 'Judul tidak boleh kosong' }, { status: 400 })
          }
          updates.title = title
        } else if (field === 'content') {
          const content = String(value ?? '').trim()
          if (!content) {
            return NextResponse.json({ error: 'Isi artikel tidak boleh kosong' }, { status: 400 })
          }
          updates.content = content
        } else {
          updates[field] = value
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan yang dikirim' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('blog_posts')
      .update(updates)
      .eq('slug', slug)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Slug artikel sudah dipakai' }, { status: 409 })
      }
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Artikel tidak ditemukan' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Gagal menyimpan artikel' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Update blog post error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  try {
    const { slug } = await params
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('blog_posts').delete().eq('slug', slug).select()

    if (error) {
      return NextResponse.json({ error: 'Gagal menghapus artikel' }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Artikel tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete blog post error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
