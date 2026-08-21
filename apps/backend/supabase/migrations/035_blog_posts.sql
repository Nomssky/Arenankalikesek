-- 035: Editor reportase — konten blog pindah dari file markdown
-- (apps/frontend/reportase/md, apps/frontend/src/content/posts) ke tabel
-- blog_posts agar admin bisa menambah/mengedit/menghapus saat runtime
-- (Vercel serverless tidak bisa menulis filesystem/git).
--
-- Baca publik lewat API (route backend); semua tulis lewat service role —
-- RLS aktif tanpa policy sehingga hanya service role yang bisa menyentuh tabel.

CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  author text NOT NULL DEFAULT 'Admin Arenan Kalikesek',
  category text NOT NULL DEFAULT 'Reportase',
  type text NOT NULL DEFAULT 'Reportase',
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  image text,
  image_alt text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_blog_posts_date ON blog_posts (date DESC);

-- Bucket publik untuk gambar sampul reportase (dibaca browser langsung);
-- unggahan hanya lewat service role (RLS storage tanpa policy tulis).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blog-images', 'blog-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Baca publik untuk gambar di bucket blog-images; tulis hanya service role.
DROP POLICY IF EXISTS "Public read blog images" ON storage.objects;
CREATE POLICY "Public read blog images" ON storage.objects
  FOR SELECT USING (bucket_id = 'blog-images');
