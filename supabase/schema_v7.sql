-- ── schema_v7: critical column fixes ────────────────────────────────────────
-- Run this in Supabase → SQL Editor.
-- Safe to re-run: all statements use IF NOT EXISTS or are idempotent.

-- 1. profiles.points must be numeric to store 0.5-point deductions.
--    The INTEGER type was rounding 6.5 → 7, making deductions disappear on refresh.
ALTER TABLE profiles
  ALTER COLUMN points TYPE numeric(4,2) USING points::numeric(4,2);

-- 2. profiles.current_activity: stores ISO timestamp of last Apploye activity.
--    Missing column caused the sync route to fail on every run.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_activity TEXT;

-- Done.
