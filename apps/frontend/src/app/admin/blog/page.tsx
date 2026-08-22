'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import BlogPostForm from '@/components/blog/BlogPostForm'
import type { Post } from '@/lib/blog'

// Kelola reportase/blog terpusat di panel admin. Semua artikel termasuk draf
// dimuat dari GET /api/admin/blog/posts supaya artikel yang tidak sengaja
// di-unpublish tetap bisa ditemukan dan diterbitkan kembali dari sini.
export default function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unauthorized, setUnauthorized] = useState(false)
  const [formPost, setFormPost] = useState<Post | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [confirmingSlug, setConfirmingSlug] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    fetchPosts()
  }, [])

  // Semua setState terjadi setelah await pertama — tanpa setState sinkron di
  // jalur effect (aturan react-hooks). Spinner awal memakai nilai loading=true.
  async function fetchPosts() {
    try {
      const res = await fetch('/api/admin/blog/posts')
      if (res.status === 401) {
        setUnauthorized(true)
        setError('Sesi admin berakhir atau belum masuk.')
        return
      }
      if (!res.ok) {
        setError('Gagal memuat artikel')
        return
      }
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : [])
      setError('')
    } catch {
      setError('Gagal memuat artikel')
    } finally {
      setLoading(false)
    }
  }

  async function togglePublished(post: Post) {
    setActionError('')
    try {
      const res = await fetch(`/api/admin/blog/posts/${post.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !(post.published ?? true) }),
      })
      if (res.ok) fetchPosts()
      else {
        const body = await res.json().catch(() => ({}))
        setActionError(body.error || 'Gagal mengubah status artikel')
      }
    } catch {
      setActionError('Gagal mengubah status artikel')
    }
  }

  async function remove(post: Post) {
    if (confirmingSlug !== post.slug) {
      setConfirmingSlug(post.slug)
      return
    }
    setActionError('')
    try {
      const res = await fetch(`/api/admin/blog/posts/${post.slug}`, { method: 'DELETE' })
      if (res.ok) {
        setConfirmingSlug(null)
        fetchPosts()
      } else {
        const body = await res.json().catch(() => ({}))
        setActionError(body.error || 'Gagal menghapus artikel')
      }
    } catch {
      setActionError('Gagal menghapus artikel')
    }
  }

  function openCreate() {
    // Tanggal di templat selalu hari ini saat form dibuka.
    setFormPost(null)
    setFormOpen(true)
  }

  function openEdit(post: Post) {
    setFormPost(post)
    setFormOpen(true)
  }

  return (
    <div>
      <div className="admin-page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportase &amp; Blog</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tulis, sunting, terbitkan, dan hapus artikel reportase.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">
          + Tambah Reportase
        </button>
      </div>

      {actionError && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      )}

      <div
        className="admin-table-scroll mt-4 rounded-xl bg-white shadow-sm"
        data-lenis-prevent
        data-scroll-container
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-6 text-center text-red-700">
            <p className="text-lg font-medium">{error}</p>
            {unauthorized && (
              <Link href="/admin/login" className="btn-primary mt-4 inline-flex text-sm">
                Masuk sebagai Admin
              </Link>
            )}
          </div>
        ) : posts.length === 0 ? (
          <p className="py-12 text-center text-gray-500">
            Belum ada artikel. Klik “+ Tambah Reportase” untuk menulis yang pertama.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Judul</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Kategori</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {posts.map((post) => {
                const published = post.published ?? true
                return (
                  <tr key={post.slug} className="hover:bg-gray-50">
                    <td className="max-w-[22rem] px-4 py-3 font-medium text-gray-900">
                      <span className="break-anywhere">{post.title}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {post.date ? formatDate(post.date) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{post.category || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => togglePublished(post)}
                        aria-pressed={published}
                        title={published ? 'Klik untuk jadikan draf' : 'Klik untuk terbitkan'}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                          published
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${published ? 'bg-white' : 'bg-yellow-500'}`} />
                        {published ? 'Terbit' : 'Draf'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(post)}
                          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(post)}
                          className={`text-sm font-medium ${
                            confirmingSlug === post.slug
                              ? 'text-white'
                              : 'text-red-600 hover:text-red-700'
                          }`}
                        >
                          {confirmingSlug === post.slug ? 'Yakin hapus?' : 'Hapus'}
                        </button>
                        {confirmingSlug === post.slug && (
                          <button
                            type="button"
                            onClick={() => setConfirmingSlug(null)}
                            className="text-sm font-medium text-gray-500 hover:text-gray-700"
                          >
                            Batal
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <BlogPostForm
          initialPost={formPost}
          onClose={() => setFormOpen(false)}
          onSaved={() => fetchPosts()}
        />
      )}
    </div>
  )
}
