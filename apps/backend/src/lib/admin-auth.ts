import { cookies } from 'next/headers'

const COOKIE_NAME = 'admin_token'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''

export function isAdminAuthConfigured(): boolean {
  return ADMIN_PASSWORD.trim().length > 0
}

async function hmacSha256(message: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Constant-time hex compare murni JS (Edge runtime tidak punya node:crypto,
// dan file ini diimpor middleware). Panjang sudah dicek dulu oleh pemanggil.
function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// PBKDF2-SHA256 via WebCrypto (Edge-safe, tanpa dependency) — memperlambat
// brute-force per percobaan dibanding SHA256 polos. Salt statis karena password
// admin tunggal dibandingkan live (tidak ada hash tersimpan yang bisa di-crack
// offline); iterasi dipilih seimbang untuk login sekali-sekali.
const PASSWORD_SALT = 'arenankalikesek-admin-pbkdf2'
const PASSWORD_ITERATIONS = 100_000

async function derivePasswordKey(password: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(PASSWORD_SALT), iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Hash dihitung sekali di module scope, bukan per-request login
// (top-level await aman di Edge & Node).
const ADMIN_PASSWORD_KEY = isAdminAuthConfigured() ? await derivePasswordKey(ADMIN_PASSWORD) : ''

export async function generateSessionToken(): Promise<string> {
  const payload = JSON.stringify({ created: Date.now() })
  const signature = await hmacSha256(payload, ADMIN_PASSWORD)
  return btoa(`${payload}.${signature}`).replace(/=+$/, '')
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const decoded = atob(token)
    const dot = decoded.lastIndexOf('.')
    if (dot === -1) return false
    const payload = decoded.slice(0, dot)
    const signature = decoded.slice(dot + 1)
    const expected = await hmacSha256(payload, ADMIN_PASSWORD)
    if (!hexEqual(signature, expected)) return false
    const parsed = JSON.parse(payload)
    if (typeof parsed?.created !== 'number') return false
    return Date.now() - parsed.created < SESSION_TTL_MS
  } catch {
    return false
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  if (!isAdminAuthConfigured()) return false
  const hash = await derivePasswordKey(password)
  return hexEqual(hash, ADMIN_PASSWORD_KEY)
}

export async function setSessionCookie() {
  const cookieStore = await cookies()
  const token = await generateSessionToken()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
