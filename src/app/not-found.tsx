import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-[#fbfaf5] px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-emerald-700">404</h1>
        <p className="mt-4 text-lg text-gray-600">Halaman tidak ditemukan</p>
        <Link
          href="/"
          className="btn-primary mt-6 inline-block"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  )
}
