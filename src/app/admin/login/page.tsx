'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        const redirect = searchParams.get('redirect') || '/admin'
        router.push(redirect)
        router.refresh()
      } else {
        setError('Password salah')
      }
    } catch {
      setError('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl sm:p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-emerald-900">Admin Panel</h1>
          <p className="mt-1 text-sm text-gray-500">Arenan Kalikesek</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-white border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
