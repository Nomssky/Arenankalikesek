import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  // Anti-pola: slug tidak valid langsung 404, jangan sampai masuk query.
  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    return NextResponse.json({ error: 'Artikel tidak ditemukan' }, { status: 404 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('blog_posts')
      .select('slug,title,date,author,category,type,excerpt,content,image,imageAlt:image_alt,published')
      .eq('slug', slug)
      .eq('published', true)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Artikel tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Fetch blog post error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
