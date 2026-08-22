'use client'

import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import AdminModal from '@/components/admin/AdminModal'
import type { Post } from '@/lib/blog'
import { formatDate } from '@/lib/utils'

interface BlogPostFormProps {
  // null = membuat artikel baru; terisi = menyunting artikel tersebut.
  initialPost?: Post | null
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

// Templat format tetap reportase (pola sama dengan 5 reportase terstandar:
// judul tebal + Author + dateline Sriwulan). Baris panduan berkurung siku
// tinggal diganti; baris foto sengaja teks miring biasa agar aman di Pratinjau.
function emptyForm(): EditorForm {
  return {
    title: '',
    date: new Date().toISOString().slice(0, 10),
    author: 'Admin Arenan Kalikesek',
    category: 'Reportase',
    excerpt: '',
    content: [
      '**[Tulis judul lengkap reportase di sini]**',
      '',
      '**Author :** [Nama penulis / kelompok]',
      '',
      `Sriwulan, ${formatDate(new Date().toISOString())} – [Paragraf pembuka: siapa, apa, di mana, kapan]`,
      '',
      '*Baris ini penanda tempat foto: letakkan kursor di sini, klik tombol "Sisipkan gambar ke isi", setelah foto masuk hapus baris ini.*',
      '',
      '[Isi lanjutan...]',
      '',
      '*[Penutup: kesan-pesan atau kutipan tokoh]*',
    ].join('\n'),
    image: '',
    imageAlt: '',
    published: true,
  }
}

function formFromPost(source: Post): EditorForm {
  return {
    title: source.title,
    date: (source.date ?? '').slice(0, 10),
    author: source.author ?? '',
    category: source.category ?? 'Reportase',
    excerpt: source.excerpt ?? '',
    content: source.content,
    image: source.image ?? '',
    imageAlt: source.imageAlt ?? '',
    published: source.published ?? true,
  }
}

export default function BlogPostForm({ initialPost = null, onClose, onSaved }: BlogPostFormProps) {
  const [form, setForm] = useState<EditorForm>(() => (initialPost ? formFromPost(initialPost) : emptyForm()))
  const [preview, setPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      setError('Judul dan isi artikel wajib diisi')
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
      content: form.content,
      image: form.image.trim() || null,
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

  type MarkdownAction = 'h2' | 'h3' | 'bold' | 'italic' | 'list' | 'quote' | 'link'

  // Toolbar ramah awam: tulis markdown di posisi kursor sehingga penyimpanan
  // tetap markdown murni (tanpa editor WYSIWYG / dependency baru).
  function applyMarkdown(action: MarkdownAction) {
    const el = contentRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = el.value.slice(start, end)
    let replaced: string
    switch (action) {
      case 'h2':
        replaced = prefixEachLine(selected, '## ')
        break
      case 'h3':
        replaced = prefixEachLine(selected, '### ')
        break
      case 'list':
        replaced = prefixEachLine(selected, '- ')
        break
      case 'quote':
        replaced = prefixEachLine(selected, '> ')
        break
      case 'bold':
        replaced = `**${selected || 'teks tebal'}**`
        break
      case 'italic':
        replaced = `*${selected || 'teks miring'}*`
        break
      case 'link':
        replaced = `[${selected || 'teks tautan'}](https://…)`
        break
      default:
        replaced = selected
    }
    insertIntoContentAt(el.value, start, end, replaced)
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
              list="blog-editor-category-options"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={field}
              aria-describedby="blog-editor-category-hint"
            />
            {/* Saran kategori tetap agar tidak pecah jadi banyak ejaan;
                pengguna tetap boleh menulis kategori sendiri. */}
            <datalist id="blog-editor-category-options">
              <option value="Reportase" />
              <option value="Berita" />
              <option value="Info Wisata" />
              <option value="Kegiatan Desa" />
            </datalist>
            <p id="blog-editor-category-hint" className="mt-1 text-xs text-gray-400">
              Pilih dari daftar atau tulis kategori sendiri.
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
          <label htmlFor="blog-editor-image" className={label}>
            Sampul
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="blog-editor-image"
              type="url"
              placeholder="https://… atau /images/…"
              value={form.image}
              onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
              className={`${field} sm:max-w-[24rem]`}
            />
            <label className="inline-flex cursor-pointer items-center rounded-full border border-emerald-950/15 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 transition hover:border-emerald-600 hover:text-emerald-700">
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
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor="blog-editor-content" className={label + ' mb-0'}>
              Isi artikel *
            </label>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="rounded-full border border-emerald-950/15 bg-white px-3 py-1 text-xs font-semibold text-emerald-900 transition hover:border-emerald-600 hover:text-emerald-700"
            >
              {preview ? 'Tulis' : 'Pratinjau'}
            </button>
          </div>
          {!preview && (
            <div
              role="toolbar"
              aria-label="Alat format tulisan"
              className="mb-2 flex flex-wrap gap-1.5"
            >
              {(
                [
                  ['Judul', 'h2'],
                  ['Subjudul', 'h3'],
                  ['Tebal', 'bold'],
                  ['Miring', 'italic'],
                  ['Daftar', 'list'],
                  ['Kutipan', 'quote'],
                  ['Tautan', 'link'],
                ] as [string, MarkdownAction][]
              ).map(([name, action]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => applyMarkdown(action)}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:border-emerald-500 hover:text-emerald-700"
                >
                  {name}
                </button>
              ))}
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
          )}
          {preview ? (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
              <ReactMarkdown>{form.content}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              id="blog-editor-content"
              ref={contentRef}
              rows={12}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className={`${field} font-mono text-xs`}
              placeholder={'Tulis artikel di sini, atau pakai tombol format di atas…'}
              required
            />
          )}
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
