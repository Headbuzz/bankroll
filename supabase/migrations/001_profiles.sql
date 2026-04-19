-- ═══════════════════════════════════════════════════════════
-- BANKROLL — Database Migration 001
-- Profiles (linked to Supabase Auth)
-- ═══════════════════════════════════════════════════════════

-- Player profiles (auto-created on first login via Edge Function)
create table if not exists public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  display_name  text,
  avatar_url    text,
  wallet_address text unique,
  games_played  int default 0,
  games_won     int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Enable Row-Level Security
alter table public.profiles enable row level security;

-- Anyone can read any profile (for leaderboard, opponent info)
create policy "profiles_read_all"
  on public.profiles for select
  using (true);

-- Users can only update their own profile
create policy "profiles_write_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Profiles are created by the Edge Function using service role (bypass RLS)
-- No insert policy needed for users directly

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();
