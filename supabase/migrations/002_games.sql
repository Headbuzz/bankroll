-- ═══════════════════════════════════════════════════════════
-- BANKROLL — Database Migration 002
-- Games table (authoritative game state)
-- ═══════════════════════════════════════════════════════════

create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  room_code   text unique not null,
  player1_id  uuid references public.profiles(id),
  player2_id  uuid references public.profiles(id),
  status      text default 'waiting',      -- waiting | active | finished
  state       jsonb not null default '{}'::jsonb,  -- full game state snapshot
  winner_id   uuid references public.profiles(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Index for fast room code lookups
create index games_room_code_idx on public.games(room_code);
create index games_status_idx on public.games(status);

-- Enable Row-Level Security
alter table public.games enable row level security;

-- Players can only read games they are part of
create policy "games_players_can_read"
  on public.games for select
  using (
    auth.uid() = player1_id or
    auth.uid() = player2_id
  );

-- Only the game server (Edge Function via service role) can write state
-- Players CANNOT directly update the games table — all writes go through Edge Functions
-- No client-facing update/insert/delete policies

-- Auto-update updated_at (triggers Realtime broadcast to subscribers)
create trigger games_updated_at
  before update on public.games
  for each row execute function public.handle_updated_at();

-- Enable Realtime on this table so clients get live state updates
alter publication supabase_realtime add table public.games;
