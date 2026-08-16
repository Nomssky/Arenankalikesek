import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-server'
import { requireAdmin } from '../../../../lib/admin-guard'
import { slugify } from '../../../../lib/utils'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const available = searchParams.get('available')

  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })

    if (category && category !== 'semua') {
      query = query.eq('category', category)
    }
    if (available === 'true') {
      query = query.eq('available', true)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Gagal memproses produk' }, { status: 500 })
    }

    let result = data || []

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p: { name: string; description: string }) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Fetch products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  try {
    const body = await request.json()

    if (!body.name || !body.category) {
      return NextResponse.json({ error: 'Nama dan kategori harus diisi' }, { status: 400 })
    }
    if (body.price === undefined || body.price === null || isNaN(Number(body.price))) {
      return NextResponse.json({ error: 'Harga harus diisi dengan angka' }, { status: 400 })
    }
    // Form admin tidak punya field slug — generate dari nama bila tidak dikirim.
    // ponytail: nama duplikat bisa kena unique index slug → 500; upgrade: counter/suffix.
    const slug = body.slug || slugify(body.name)
    if (!slug) {
      return NextResponse.json({ error: 'Slug harus diisi' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: body.name,
        price: Number(body.price),
        category: body.category,
        image: body.image || '',
        description: body.description || '',
        unit: body.unit || '',
        available: body.available ?? true,
        sort_order: body.sort_order || 0,
        slug,
        price_type: body.price_type || 'fixed',
        store_visible: body.store_visible ?? false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Gagal memproses produk' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
