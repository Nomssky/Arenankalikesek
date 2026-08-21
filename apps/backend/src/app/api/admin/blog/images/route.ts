import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-server'
import { requireAdmin } from '../../../../../lib/admin-guard'

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  try {
    const formData = await request.formData()
    const file = formData.get('image')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File gambar wajib dikirim (field image)' }, { status: 400 })
    }
    const ext = ALLOWED_MIME[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'Hanya gambar JPG, PNG, atau WebP yang diizinkan' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Ukuran gambar maksimal 5 MB' }, { status: 400 })
    }

    const path = `uploads/${crypto.randomUUID()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: uploadError } = await getSupabaseAdmin().storage
      .from('blog-images')
      .upload(path, bytes, { contentType: file.type, upsert: false })
    if (uploadError) {
      console.error('Blog image upload error:', uploadError)
      return NextResponse.json({ error: 'Gagal mengunggah gambar' }, { status: 500 })
    }

    const { data } = getSupabaseAdmin().storage.from('blog-images').getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    console.error('Blog image upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
