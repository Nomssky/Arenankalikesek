-- 023: Hardening keamanan + rate-limit admin login DB-backed.
-- 1) Kunci search_path trigger helper update_updated_at (linter: function_search_path_mutable).
-- 2) is_staff: anon/PUBLIC tidak boleh lagi execute (defense-in-depth — is_staff
--    read-only, tapi tutup permukaan RPC tanpa login). authenticated dipertahankan
--    karena dipakai policy RLS staff_manage_*; service_role bypass RLS.
-- 3) Rate-limit login admin dipindah dari Map in-memory (bypass di multi-instance
--    Vercel) ke tabel + fungsi atomik. Logika stage 5/8/12/16 kini authoritative di DB.

-- ---------- 1) search_path hardening ----------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- ---------- 2) is_staff ----------
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ---------- 3) admin login rate-limit ----------
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id_key TEXT PRIMARY KEY,
  failed_count INT NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hanya service_role yang boleh membaca/menulis. RLS aktif tanpa policy
-- = semuanya ditolak untuk anon/authenticated; service_role bypass RLS.
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

-- Atomik: increment hitungan & hitung stage secara bersamaan sehingga tidak ada
-- race antar-instance Serverless. Mengembalikan blocked_until baru (NULL bila
-- belum melewati ambang 5). Sama dengan BLOCK_STAGES lama: 5/15dtk, 8/5mnt,
-- 12/30mnt, 16/1jam.
CREATE OR REPLACE FUNCTION public.record_admin_login_attempt(p_id_key TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_blocked TIMESTAMPTZ;
BEGIN
  INSERT INTO public.admin_login_attempts (id_key, failed_count, updated_at)
  VALUES (p_id_key, 1, now())
  ON CONFLICT (id_key) DO UPDATE
    SET failed_count = admin_login_attempts.failed_count + 1,
        updated_at = now()
  RETURNING failed_count INTO v_count;

  IF v_count >= 16 THEN
    v_blocked := now() + interval '1 hour';
  ELSIF v_count >= 12 THEN
    v_blocked := now() + interval '30 minutes';
  ELSIF v_count >= 8 THEN
    v_blocked := now() + interval '5 minutes';
  ELSIF v_count >= 5 THEN
    v_blocked := now() + interval '15 seconds';
  ELSE
    v_blocked := NULL;
  END IF;

  UPDATE public.admin_login_attempts
  SET blocked_until = v_blocked
  WHERE id_key = p_id_key;

  RETURN v_blocked;
END;
$$;

REVOKE ALL ON FUNCTION public.record_admin_login_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_admin_login_attempt(TEXT) TO service_role;
