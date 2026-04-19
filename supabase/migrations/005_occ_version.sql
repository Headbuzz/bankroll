-- ═══════════════════════════════════════════════════════════
-- BANKROLL — Database Migration 005
-- Add version column for Optimistic Concurrency Control (OCC)
-- ═══════════════════════════════════════════════════════════
-- Run this in your Supabase Dashboard → SQL Editor

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
