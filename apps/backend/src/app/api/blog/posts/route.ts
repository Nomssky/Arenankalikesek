import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-server'

// Daftar publik: hanya artikel terbit, tanpa isi konten (payload ringan untuk
// halaman blog & News di beranda). Detail lengkap ada di /api/blog/posts/[slug].
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('blog_posts')
      .select('slug,title,date,author,category,type,excerpt,image,imageAlt:image_alt')
      .eq('published', true)
      .order('date', { ascending: false })
    if (error) {
      console.error('Fetch blog posts error:', error)
      return NextResponse.json({ error: 'Gagal memuat artikel' }, { status: 500 })
    }
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Fetch blog posts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
