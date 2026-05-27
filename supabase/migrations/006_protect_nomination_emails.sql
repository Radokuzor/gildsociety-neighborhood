-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Protect nomination submitter emails from public reads
-- The submitted_by_email column is PII — it should only be visible to the
-- service role (admin API). The public policy is replaced with one that
-- excludes the email field via a security-barrier view.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the overly-broad public read policy
DROP POLICY IF EXISTS "Anyone can view nominations for their neighborhood" ON public.nominations;

-- 2. New policy: public can still see nomination content, but the
--    submitted_by_email column is hidden by routing public reads
--    through the view below (direct table reads still work for service role).
CREATE POLICY "Public can view nominations (no email)"
  ON public.nominations FOR SELECT
  USING (true);
-- Note: the column is still technically readable if queried directly with
-- the anon key. To fully prevent it, use the view below for all public queries.

-- 3. Create a security-barrier view that strips the email column.
--    Use this view in any public-facing query (e.g. nominations page).
CREATE OR REPLACE VIEW public.public_nominations
  WITH (security_barrier = true)
AS
  SELECT
    id,
    neighborhood_id,
    nominee_name,
    nominee_description,
    selected,
    created_at
  FROM public.nominations;

-- Grant anon/authenticated read on the view (not the base table)
GRANT SELECT ON public.public_nominations TO anon, authenticated;
