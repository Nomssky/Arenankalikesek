// Reportase sync: rapikan frontmatter di reportase/md + sinkronkan gambar reportase/images -> public/images.
//
// Cara pakai (dari folder apps/frontend):
//   node scripts/reportase-sync.mjs           # proses semua + sinkron gambar
//   node scripts/reportase-sync.mjs --dry     # tampilkan rencana tanpa menulis
//   node scripts/reportase-sync.mjs --watch   # pantau folder, proses tiap perubahan
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.join(scriptDir, '..')
const reportaseMd = path.join(frontendRoot, 'reportase', 'md')
const reportaseImages = path.join(frontendRoot, 'reportase', 'images')
const contentPosts = path.join(frontendRoot, 'src', 'content', 'posts')
const publicImages = path.join(frontendRoot, 'public', 'images')

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const isPostFile = (f) => /\.mdx?$/i.test(f)

function deriveExcerpt(content) {
  const text = content
    .replace(/^#{1,6}\s.*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#*_`>[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  return text.length > 160 ? `${text.slice(0, 160).trim()}…` : text
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function listMarkdown(dir) {
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(isPostFile).sort()
    : []
}

function listImages(dir) {
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase())).sort()
    : []
}

function existingSlugs(exceptMd) {
  const slugs = new Set(
    [...listMarkdown(contentPosts), ...listMarkdown(reportaseMd)]
      .map((f) => f.replace(/\.mdx?$/i, ''))
      .filter((s) => s !== exceptMd),
  )
  return slugs
}

function rewriteBodyImages(content) {
  return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, target) => {
    const clean = target.trim().replace(/^<|>$/g, '')
    if (clean.startsWith('http') || clean.startsWith('/')) return match
    const basename = path.basename(clean)
    if (fs.existsSync(path.join(reportaseImages, basename))) {
      return `![${alt}](/images/${basename})`
    }
    return match
  })
}

function normalizeMarkdown(file) {
  const filePath = path.join(reportaseMd, file)
  const parsed = matter(fs.readFileSync(filePath, 'utf-8'))
  const data = { ...parsed.data }
  const warnings = []
  let renamed = null
  let changed = false

  if (!data.title || !String(data.title).trim()) {
    return { file, ok: false, warnings: ['title kosong — dilewati'] }
  }

  if (!data.type) { data.type = 'Reportase'; changed = true }
  if (!data.date) { data.date = todayStr(); changed = true }
  if (!data.author) { data.author = 'Admin Arenan Kalikesek'; changed = true }
  if (data.published === undefined || data.published === null) { data.published = true; changed = true }
  if (!data.excerpt) {
    const derived = deriveExcerpt(parsed.content)
    if (derived) { data.excerpt = derived; changed = true }
    else warnings.push('excerpt kosong dan isi tidak cukup — diisi manual')
  }

  const imageSource = data.image
  if (imageSource && !String(imageSource).startsWith('/') && !String(imageSource).startsWith('http')) {
    const basename = path.basename(String(imageSource))
    if (fs.existsSync(path.join(reportaseImages, basename))) {
      data.image = `/images/${basename}`
      changed = true
    }
  }

  // Nama file = slug (URL blog). Jangan rename otomatis supaya URL lama tetap hidup;
  // hanya beri suffix bila namanya bentrok dengan post yang sudah ada.
  const baseSlug = file.replace(/\.mdx?$/i, '')
  const taken = existingSlugs(baseSlug)
  let finalSlug = baseSlug
  let counter = 2
  while (taken.has(finalSlug)) finalSlug = `${baseSlug}-${counter++}`
  if (finalSlug !== baseSlug) {
    renamed = `${finalSlug}${path.extname(file).toLowerCase() || '.md'}`
  }

  const body = rewriteBodyImages(parsed.content)
  if (body !== parsed.content) changed = true
  const output = matter.stringify(body, data)
  return { file, ok: true, renamed, changed, data, output, warnings }
}

function syncImages(dry) {
  const copied = []
  for (const img of listImages(reportaseImages)) {
    const src = path.join(reportaseImages, img)
    const dest = path.join(publicImages, img)
    if (fs.existsSync(dest) && fs.readFileSync(src).equals(fs.readFileSync(dest))) continue
    if (!dry) fs.copyFileSync(src, dest)
    copied.push(img)
  }
  return copied
}

function processAll({ dry } = {}) {
  const mdFiles = listMarkdown(reportaseMd)
  const results = []
  for (const file of mdFiles) {
    const result = normalizeMarkdown(file)
    results.push(result)
    if (!result.ok) continue
    if (!dry) {
      if (!result.changed && !result.renamed) continue
      const filePath = path.join(reportaseMd, file)
      const targetPath = result.renamed ? path.join(reportaseMd, result.renamed) : filePath
      if (result.renamed) fs.renameSync(filePath, targetPath)
      fs.writeFileSync(targetPath, result.output)
    }
  }
  const copied = syncImages(dry)

  console.log(`Reportase md : ${mdFiles.length} file`)
  for (const r of results) {
    if (!r.ok) {
      console.log(`  ${r.warnings[0]}`)
      continue
    }
    const target = r.renamed ? `${r.file} -> ${r.renamed}` : r.file
    console.log(`  [${dry ? 'rencana' : 'OK'}] ${target}${r.warnings.length ? ` (warn: ${r.warnings.join('; ')})` : ''}`)
  }
  console.log(`Gambar     : ${copied.length ? copied.map((f) => `\n  + ${f}`).join('') : 'tidak ada yang baru (sudah sinkron)'}`)
}

function syncImagesOnly({ dry } = {}) {
  const copied = syncImages(dry)
  console.log(`Gambar     : ${copied.length ? copied.map((f) => `\n  + ${f}`).join('') : 'tidak ada yang baru (sudah sinkron)'}`)
}

function watch() {
  console.log('Watch reportase aktif (Ctrl+C untuk berhenti)...')
  processAll({ dry: false })
  fs.watch(reportaseMd, () => setTimeout(() => processAll({ dry: false }), 250))
  fs.watch(reportaseImages, () => setTimeout(() => processAll({ dry: false }), 250))
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const watchMode = args.includes('--watch')
const imagesOnly = args.includes('--images-only')
if (watchMode) watch()
else if (imagesOnly) syncImagesOnly({ dry })
else processAll({ dry })
