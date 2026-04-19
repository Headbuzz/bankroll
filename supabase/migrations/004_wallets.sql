-- ═══════════════════════════════════════════════════════════
-- BANKROLL — Database Migration 004
-- Wallets (encrypted, server-only access)
-- ═══════════════════════════════════════════════════════════
--
-- SECURITY MODEL:
--   - Public address stored in profiles (safe to show)
--   - Encrypted private key lives ONLY in this table
--   - NO client-facing SELECT policy — only Edge Functions
--     with the service role key can read encrypted keys
--   - Each key encrypted with AES-256-GCM in the Edge Function
--     using WALLET_ENCRYPTION_KEY stored in Supabase Vault (env secret)
--   - The IV (initialization vector) is unique per wallet — stored alongside
--   - Even if the DB is dumped, keys are useless without the Vault secret
-- ═══════════════════════════════════════════════════════════

create table if not exists public.wallets (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users on delete cascade unique not null,

  -- Public — safe to read from profiles table instead
  wallet_address      text unique not null,

  -- Encrypted private key (AES-256-GCM output, base64-encoded)
  encrypted_key       text not null,

  -- AES-GCM Initialization Vector (base64-encoded, unique per wallet)
  iv                  text not null,

  -- Encryption algorithm metadata (for future key rotation)
  algorithm           text not null default 'AES-256-GCM',
  key_version         int  not null default 1,

  created_at          timestamptz default now()
);

-- ─────────────────────────────────────────────────────────
-- Row-Level Security: STRICT
-- ─────────────────────────────────────────────────────────
alter table public.wallets enable row level security;

-- ❌ NO select policy for authenticated users
-- ❌ NO insert policy for authenticated users  
-- ❌ NO update policy for authenticated users
-- ✅ ONLY the service role (Edge Functions) can access this table
--    The service role bypasses RLS entirely — this is intentional and correct.

-- Confirm: authenticated users CANNOT read any wallet rows
-- (No policy = deny by default in Postgres RLS)

-- ─────────────────────────────────────────────────────────
-- Helper: check if a user already has a wallet
-- ─────────────────────────────────────────────────────────
create or replace function public.user_has_wallet(user_uuid uuid)
returns boolean
language sql
security definer  -- runs as DB owner, bypasses RLS for this check
as $$
  select exists (select 1 from public.wallets where user_id = user_uuid);
$$;

-- Only authenticated users can call this check (to show "Create Wallet" button)
grant execute on function public.user_has_wallet(uuid) to authenticated;
