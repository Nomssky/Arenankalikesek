-- 026: Rate-limit pembuatan booking per-IP (DB-backed).
-- Melengkapi MAX_PENDING_PER_PHONE (per nomor) dengan pembatas per-IP agar
-- spam slot-hold lintas nomor teratasi. Pola sama dengan admin_login_attempts:
-- hitungan + window dihitung atomik di DB, bukan Map in-memory per-instance.

CREATE TABLE IF NOT EXISTS public.booking_create_attempts (
  id_key TEXT PRIMARY KEY,
  attempt_count INT NOT NULL DEFAULT 1,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_create_attempts ENABLE ROW LEVEL SECURITY;

-- Atomik: reset window bila sudah lewat, lalu increment. Mengembalikan jumlah
-- percobaan dalam window aktif. Pemanggil (service_role) yang memutuskan batas.
CREATE OR REPLACE FUNCTION public.record_booking_create_attempt(
  p_id_key TEXT,
  p_window_minutes INT DEFAULT 15
)
RETURNS INT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.booking_create_attempts (id_key, attempt_count, window_started_at, updated_at)
  VALUES (p_id_key, 1, now(), now())
  ON CONFLICT (id_key) DO UPDATE
    SET attempt_count = CASE
          WHEN booking_create_attempts.window_started_at <= now() - make_interval(mins => p_window_minutes)
            THEN 1
          ELSE booking_create_attempts.attempt_count + 1
        END,
        window_started_at = CASE
          WHEN booking_create_attempts.window_started_at <= now() - make_interval(mins => p_window_minutes)
            THEN now()
          ELSE booking_create_attempts.window_started_at
        END,
        updated_at = now()
  RETURNING attempt_count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_booking_create_attempt(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_booking_create_attempt(TEXT, INT) TO service_role;
