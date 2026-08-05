import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { tourServices, storeProducts } from '../../../packages/shared-utils/src/pricing.ts'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const norm = (v) => String(v ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const tour = tourServices.map((s) => ({ id: s.id, name: s.name, n: norm(s.name), priceType: s.priceType, price: s.price, maxPrice: s.maxPrice ?? null, category: s.category, rates: s.rates ?? null }))
const product = storeProducts.map((s) => ({ id: s.id, name: s.name, n: norm(s.name), price: s.price, priceType: s.priceType, unit: s.unit ?? '', category: s.category }))

// match db row to fallback by: exact normalized, or normalized name stripped of parenthetical/qualifier
function match(fb, name) {
  const n = norm(name)
  if (fb.some((f) => f.n === n)) return fb.find((f) => f.n === n)
  const base = n.replace(/\b\([^)]*\)|\bkap\b.*|\b\d+\s*(?:-\s*\d+)?\s*org.*$/g, '').trim()
  const hit = fb.find((f) => f.n === base)
  if (hit) return hit
  return fb.find((f) => n.startsWith(f.n) && f.n.length >= 4)
}

async function main() {
  const { data: dbTour } = await sb.from('tour_packages').select('id,name,slug,price_type,rates')
  const seen = new Set()
  let upd = 0, ins = 0
  for (const row of dbTour || []) {
    const fb = match(tour, row.name)
    const slug = row.slug || (fb ? fb.id : null)
    const priceType = (fb && fb.priceType !== 'fixed') ? fb.priceType : (row.price_type || (fb ? fb.priceType : 'fixed'))
    const rates = Array.isArray(row.rates) && row.rates.length ? row.rates : (fb && fb.priceType === 'rates' ? fb.rates : null)
    if (slug && (slug !== row.slug || priceType !== row.price_type || (rates && JSON.stringify(rates) !== JSON.stringify(row.rates)))) {
      const { error } = await sb.from('tour_packages').update({ slug, price_type: priceType, rates }).eq('id', row.id)
      if (error) console.error('upd err', row.name, error.message)
      else { upd++; console.log('  slug →', slug, '|', row.name) }
    }
    if (slug) seen.add(slug)
  }
  for (const f of tour) {
    if (seen.has(f.id)) continue
    const { error } = await sb.from('tour_packages').insert({
      slug: f.id, name: f.name, category: f.category, price: f.price,
      max_price: ['range', 'market'].includes(f.priceType) ? f.maxPrice : null,
      price_type: f.priceType, rates: f.priceType === 'rates' ? f.rates : null,
      available: true, sort_order: 999,
    })
    if (error) console.error('ins err', f.name, error.message)
    else { ins++; console.log('  +insert →', f.id, '|', f.name) }
  }

  const { data: dbProd } = await sb.from('products').select('id,name,slug,price_type')
  const seenP = new Set()
  for (const row of dbProd || []) {
    const fb = match(product, row.name)
    const slug = row.slug || (fb ? fb.id : null)
    const priceType = (fb && fb.priceType !== 'fixed') ? fb.priceType : (row.price_type || (fb ? fb.priceType : 'fixed'))
    if (slug && (slug !== row.slug || priceType !== row.price_type)) {
      const { error } = await sb.from('products').update({ slug, price_type: priceType }).eq('id', row.id)
      if (error) console.error('upd err', row.name, error.message)
      else { upd++; console.log('  [P] slug →', slug, '|', row.name) }
    }
    if (slug) seenP.add(slug)
  }
  for (const f of product) {
    if (seenP.has(f.id)) continue
    if (!f.price) continue // hanya seed yang berharga tetap
    const { error } = await sb.from('products').insert({
      slug: f.id, name: f.name, category: f.category, price: f.price,
      price_type: f.priceType, unit: f.unit, description: '', available: true, sort_order: 999,
    })
    if (error) console.error('ins err', f.name, error.message)
    else { ins++; console.log('  [P] +insert →', f.id, '|', f.name) }
  }
  console.log(`\nDONE updates=${upd} inserts=${ins}`)
}
main()