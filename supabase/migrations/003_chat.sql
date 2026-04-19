-- ═══════════════════════════════════════════════════════════
-- BANKROLL — Database Migration 003
-- Chat messages (per game, real-time via Supabase Realtime)
-- ═══════════════════════════════════════════════════════════

create table if not exists public.chat_messages (
  id          bigserial primary key,
  game_id     uuid references public.games(id) on delete cascade,
  sender_id   uuid references public.profiles(id),
  content     text not null,
  created_at  timestamptz default now()
);

-- Index for fast per-game chat lookups
create index chat_game_id_idx on public.chat_messages(game_id, created_at desc);

-- Enable Row-Level Security
alter table public.chat_messages enable row level security;

-- Both players in the game can read and write chat
create policy "chat_players_can_read"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id
      and (g.player1_id = auth.uid() or g.player2_id = auth.uid())
    )
  );

create policy "chat_players_can_insert"
  on public.chat_messages for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.games g
      where g.id = game_id
      and (g.player1_id = auth.uid() or g.player2_id = auth.uid())
    )
  );

-- Enable Realtime so chat messages pop up live
alter publication supabase_realtime add table public.chat_messages;
