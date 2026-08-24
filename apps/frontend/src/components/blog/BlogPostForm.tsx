'use client'

import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import AdminModal from '@/components/admin/AdminModal'
import type { Post } from '@/lib/blog'
import { formatDate } from '@/lib/utils'

interface BlogPostFormProps {
  // null = membuat artikel baru; terisi = menyunting artikel tersebut.
  initialPost?: Post | null
  // Kategori yang pernah dipakai artikel lain — ditampilkan sebagai chip agar
  // ejaan kategori konsisten antar-artikel (pengguna tetap boleh menulis bebas).
  knownCategories?: string[]
  onClose: () => void
  onSaved?: () => void
}

interface EditorForm {
  title: string
  date: string
  author: string
  category: string
  excerpt: string
  content: string
  image: string
  imageAlt: string
  published: boolean
}

// Kerangka reportase TIDAK ditulis di textarea — ia dirakit otomatis dari
// field Judul/Penulis/Tanggal (assembleContent) sehingga penulis tidak bisa
// menghapus atau merusaknya. Textarea hanya memuat bagian bebas artikel.
function emptyForm(): EditorForm {
  return {
    title: '',
    date: new Date().toISOString().slice(0, 10),
    author: 'Admin Arenan Kalikesek',
    category: 'Reportase',
    excerpt: '',
    content:
      '*Baris ini penanda tempat foto: letakkan kursor di sini, klik tombol "Sisipkan gambar ke isi", setelah foto masuk hapus baris ini.*',
    image: '',
    imageAlt: '',
    published: true,
  }
}

// Isi yang sudah memuat kerangka (artikel lama/impor) diteruskan apa adanya —
// jangan dirakit ulang agar tidak dobel. (ponytail: format luar-baku tidak
// dinormalkan otomatis; upgrade path: script migrasi sekali.)
const SKELETON_LIKE = /^\*\*[^\n]+\*\*\s*\n+\*\*Author :\*\*/

function assembleContent(title: string, author: string, date: string, body: string): string {
  const dateline = `Sriwulan, ${formatDate(date || new Date().toISOString())} –`
  return [
    `**${title}**`,
    '',
    `**Author :** ${author || 'Admin Arenan Kalikesek'}`,
    '',
    `${dateline} ${body.replace(/^\s+/, '')}`,
  ].join('\n')
}

// Lepas kerangka baku dari awal konten artikel lama supaya tidak dobel saat
// disimpan ulang. Coba cocokkan dengan judul artikel; bila gagal tapi pola
// kerangkanya mirip, lepas versi generik.
function stripSkeleton(content: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const exact = new RegExp(`^\\*\\*${escaped}\\*\\*\\s*\\n+\\*\\*Author :\\*\\*[^\\n]*\\n+Sriwulan,[^\\n]*?–\\s*`)
  const stripped = content.replace(exact, '')
  if (stripped !== content) return stripped
  return content.replace(/^\*\*[^\n]+\*\*\s*\n+\*\*Author :\*\*[^\n]*\n+Sriwulan,[^\n]*?–\s*/, '')
}

function formFromPost(source: Post): EditorForm {
  return {
    title: source.title,
    date: (source.date ?? '').slice(0, 10),
    author: source.author ?? '',
    category: source.category ?? 'Reportase',
    excerpt: source.excerpt ?? '',
    content: stripSkeleton(source.content, source.title),
    image: source.image ?? '',
    imageAlt: source.imageAlt ?? '',
    published: source.published ?? true,
  }
}

export default function BlogPostForm({ initialPost = null, knownCategories = [], onClose, onSaved }: BlogPostFormProps) {
  const [form, setForm] = useState<EditorForm>(() => (initialPost ? formFromPost(initialPost) : emptyForm()))
  const [mobilePreview, setMobilePreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)

  // Chip kategori: default + yang sudah pernah dipakai (tanpa duplikat).
  const categoryChips = Array.from(new Set(['Reportase', 'Berita', 'Info Wisata', 'Kegiatan Desa', ...knownCategories]))

  // Konten final yang disimpan & dipratinjau: kerangka dirakit dari field form,
  // kecuali isi sudah memuat kerangka sendiri (artikel lama) — diteruskan apa adanya.
  function finalContent(): string {
    const body = form.content.trim()
    if (!body) return ''
    if (SKELETON_LIKE.test(body)) return form.content
    return assembleContent(form.title.trim(), form.author.trim(), form.date, form.content)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      setError('Judul dan isi artikel wajib diisi')
      return
    }
    // Link sampul boleh path relatif (/images/…) atau URL absolut — type="url"
    // bawaan browser menolak path relatif, jadi divalidasi manual di sini.
    const cover = form.image.trim()
    if (cover && !/^(\/|https?:\/\/)/i.test(cover)) {
      setError('Link sampul harus diawali / (folder publik) atau https://')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      title: form.title.trim(),
      date: form.date || null,
      author: form.author.trim(),
      category: form.category.trim() || 'Reportase',
      excerpt: form.excerpt.trim(),
      content: finalContent(),
      image: cover || null,
      imageAlt: form.imageAlt.trim() || null,
      published: form.published,
    }
    const res = await fetch(
      initialPost ? `/api/admin/blog/posts/${initialPost.slug}` : '/api/admin/blog/posts',
      {
        method: initialPost ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    setSaving(false)
    if (res.ok) {
      onSaved?.()
      onClose()
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Gagal menyimpan artikel')
    }
  }

  // Sisipkan teks di posisi kursor textarea isi; kursor diletakkan setelah
  // sisipan agar pengguna bisa lanjut menulis.
  function insertIntoContent(snippet: string) {
    const el = contentRef.current
    if (!el) {
      setForm((f) => ({
        ...f,
        content: `${f.content}${f.content && !f.content.endsWith('\n') ? '\n\n' : ''}${snippet}`,
      }))
      return
    }
    insertIntoContentAt(el.value, el.selectionStart, el.selectionEnd, snippet)
  }

  function prefixEachLine(text: string, prefix: string): string {
    if (!text) return prefix
    return text
      .split('\n')
      .map((line) => (line.startsWith(prefix) ? line : prefix + line))
      .join('\n')
  }

  // Toolbar sederhana: Judul/Subjudul (heading markdown di posisi kursor),
  // Tebal (bungkus seleksi), dan sisip gambar. Penyimpanan tetap markdown
  // murni, tanpa editor WYSIWYG.
  function applyHeading(prefix: '## ' | '### ') {
    const el = contentRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const replaced = prefixEachLine(el.value.slice(start, end), prefix)
    insertIntoContentAt(el.value, start, end, replaced)
  }

  function applyBold() {
    const el = contentRef.current
    if (!el) return
    const selected = el.value.slice(el.selectionStart, el.selectionEnd) || 'teks tebal'
    insertIntoContentAt(el.value, el.selectionStart, el.selectionEnd, `**${selected}**`)
  }

  function insertIntoContentAt(value: string, start: number, end: number, snippet: string) {
    setForm((f) => ({ ...f, content: value.slice(0, start) + snippet + value.slice(end) }))
    requestAnimationFrame(() => {
      const el = contentRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(start + snippet.length, start + snippet.length)
    })
  }

  async function uploadImage(file: File, target: 'cover' | 'content' = 'cover') {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Hanya gambar JPG, PNG, atau WebP yang diizinkan')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran gambar maksimal 5 MB')
      return
    }
    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('image', file)
    const res = await fetch('/api/admin/blog/images', { method: 'POST', body: fd })
    setUploading(false)
    const body = await res.json().catch(() => ({}))
    if (res.ok && body.url) {
      if (target === 'cover') {
        setForm((f) => ({ ...f, image: body.url }))
      } else {
        insertIntoContent(`![deskripsi gambar](${body.url})`)
      }
    } else {
      setError(body.error ?? 'Gagal mengunggah gambar')
    }
  }

  const field =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
  const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500'

  return (
    <AdminModal
      title={initialPost ? 'Edit Reportase' : 'Tambah Reportase'}
      onClose={onClose}
      wide
    >
      <form onSubmit={save} className="space-y-4">
        <div>
          <label htmlFor="blog-editor-title" className={label}>
            Judul *
          </label>
          <input
            id="blog-editor-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={field}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="blog-editor-date" className={label}>
              Tanggal
            </label>
            <input
              id="blog-editor-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="blog-editor-author" className={label}>
              Penulis
            </label>
            <input
              id="blog-editor-author"
              value={form.author}
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="blog-editor-category" className={label}>
              Kategori
            </label>
            <input
              id="blog-editor-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={field}
            />
            {/* Chip selalu terlihat — <datalist> tidak andal (Safari/sering
                browser mobile tidak menampilkan daftarnya sama sekali). */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categoryChips.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category }))}
                  aria-pressed={form.category === category}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    form.category === category
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'border border-gray-300 bg-white text-gray-600 hover:border-emerald-500 hover:text-emerald-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Klik pilihan atau tulis kategori sendiri.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="blog-editor-excerpt" className={label}>
            Ringkasan (opsional, otomatis bila kosong)
          </label>
          <textarea
            id="blog-editor-excerpt"
            rows={2}
            value={form.excerpt}
            onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            className={field}
          />
        </div>

        <div>
          <span className={label}>Sampul</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700">
              {uploading ? 'Mengunggah…' : 'Unggah gambar'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadImage(file)
                  e.target.value = ''
                }}
              />
            </label>
            {form.image && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, image: '' }))}
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                Hapus sampul
              </button>
            )}
          </div>
          <label htmlFor="blog-editor-image" className="mt-2 mb-1 block text-xs text-gray-400">
            …atau tempel link gambar (/images/… atau https://…)
          </label>
          <input
            id="blog-editor-image"
            type="text"
            inputMode="url"
            placeholder="/images/foto.jpg"
            value={form.image}
            onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
            className={`${field} sm:max-w-[24rem]`}
          />
          {form.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.image}
              alt="Pratinjau sampul"
              className="mt-3 h-28 w-full rounded-lg object-cover sm:w-56"
            />
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label htmlFor="blog-editor-content" className={label + ' mb-0'}>
              Isi artikel *
            </label>
            {/* Layar sempit: tulis dan pratinjau bergantian. Layar lebar: berdampingan. */}
            <button
              type="button"
              onClick={() => setMobilePreview((p) => !p)}
              className="rounded-full border border-emerald-950/15 bg-white px-3 py-1 text-xs font-semibold text-emerald-900 transition hover:border-emerald-600 hover:text-emerald-700 lg:hidden"
            >
              {mobilePreview ? 'Tulis' : 'Pratinjau'}
            </button>
          </div>
          <p className="mb-2 text-xs text-gray-400">
            Tekan Enter dua kali untuk membuat paragraf baru. Seleksi teks lalu klik Tebal,
            atau pakai Judul/Subjudul dan sisip gambar di tempat kursor.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className={mobilePreview ? 'hidden lg:block' : ''}>
              <div
                role="toolbar"
                aria-label="Alat format tulisan"
                className="mb-2 flex flex-wrap gap-1.5"
              >
                {(
                  [
                    ['Judul', '## '],
                    ['Subjudul', '### '],
                  ] as [string, '## ' | '### '][]
                ).map(([name, prefix]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => applyHeading(prefix)}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:border-emerald-500 hover:text-emerald-700"
                  >
                    {name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={applyBold}
                  aria-label="Tebal"
                  title="Tebal"
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-bold text-gray-700 transition hover:border-emerald-500 hover:text-emerald-700"
                >
                  B
                </button>
                <label className="cursor-pointer rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:border-emerald-500 hover:text-emerald-700">
                  {uploading ? 'Mengunggah…' : 'Sisipkan gambar ke isi'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadImage(file, 'content')
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
              <textarea
                id="blog-editor-content"
                ref={contentRef}
                rows={14}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className={field}
                placeholder={'Tulis paragraf pembuka dan isi di sini — judul, penulis, dan dateline dirakit otomatis…'}
                required
              />
            </div>
            <div className={mobilePreview ? '' : 'hidden lg:block'}>
              <span className={label}>Pratinjau langsung</span>
              <div className="max-h-[24rem] min-h-[12rem] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                {form.content.trim() ? (
                  <ReactMarkdown>{finalContent()}</ReactMarkdown>
                ) : (
                  <p className="text-gray-400">Pratinjau artikel akan tampil di sini…</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          Terbitkan (tampil di blog)
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </AdminModal>
  )
}
