/**
 * BANKROLL — Edge Function: game_action (v3 — complete rewrite)
 * ─────────────────────────────────────────────────────────────
 * Auth: Direct HTTP call to Supabase Auth API — works with both
 *       HS256 and ES256 JWT algorithms, no local verification.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── JSON response helper ──────────────────────────────────────
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Secure dice roll (1–6) ────────────────────────────────────
function roll(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 6) + 1;
}

// ── Random 6-char room code ───────────────────────────────────
function roomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
}

// ── Verify JWT via Supabase Auth REST API ─────────────────────
// This is the ONLY approach that works with both HS256 and ES256.
// Never verify locally — let Supabase's auth server do it.
async function verifyJWT(authHeader: string): Promise<{ id: string; email: string; user_metadata: Record<string, unknown> } | null> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: ANON_KEY,
      },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('[auth] /auth/v1/user failed:', resp.status, err);
      return null;
    }
    return await resp.json();
  } catch (e) {
    console.error('[auth] network error:', e);
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // ── 1. Verify auth ──────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const user = await verifyJWT(authHeader);
  if (!user) {
    return json({ error: 'Unauthorized — invalid or expired token' }, 401);
  }

  // ── 2. Admin DB client (bypasses RLS) ──────────────────────
  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 3. Parse request body ───────────────────────────────────
  let body: { action?: string; room_code?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { action, room_code } = body;
  console.log(`[game_action] user=${user.id} action=${action}`);

  try {

    // ══════════════════════════════════════════════════════════
    // ACTION: create_room
    // ══════════════════════════════════════════════════════════
    if (action === 'create_room') {
      // Auto-upsert a minimal profile so player name is available
      const displayName =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        (user.email?.split('@')[0]) ||
        'Player';

      const { error: profileErr } = await db.from('profiles').upsert({
        id: user.id,
        display_name: displayName,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      }, { onConflict: 'id', ignoreDuplicates: true });

      if (profileErr) console.warn('[create_room] profile upsert warning:', profileErr.message);

      const initialState = {
        turn: 'p1',
        phase: 'idle',
        players: {
          p1: { name: displayName, balance: 1000, position: 1, jailTurns: 0, tokenImg: 'redmarker.png' },
          p2: { name: 'Waiting...', balance: 1000, position: 1, jailTurns: 0, tokenImg: 'bluemarker.png' },
        },
        owners: {},
        buildings: {},
        stakingPool: 0,
        winTarget: 2500,
        gameOver: false,
        last_event: null,
      };

      // Generate a unique room code (retry on collision)
      let code = roomCode();
      for (let i = 0; i < 5; i++) {
        const { error } = await db.from('games').insert({
          room_code: code,
          player1_id: user.id,
          status: 'waiting',
          state: initialState,
        });
        if (!error) break;
        if (error.code !== '23505') throw new Error(error.message); // only retry on unique violation
        code = roomCode();
        if (i === 4) throw new Error('Could not generate unique room code. Try again.');
      }

      console.log('[create_room] ✅ created:', code, 'for user:', user.id);
      return json({ ok: true, room_code: code });
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: join_room
    // ══════════════════════════════════════════════════════════
    if (action === 'join_room') {
      if (!room_code) return json({ error: 'room_code required' }, 400);

      const { data: game, error: gameErr } = await db
        .from('games').select('*').eq('room_code', room_code).maybeSingle();
      if (gameErr) throw new Error(gameErr.message);
      if (!game)   return json({ error: 'Room not found' }, 404);
      if (game.status !== 'waiting') return json({ error: 'Game already started' }, 400);
      if (game.player1_id === user.id) return json({ error: 'You cannot join your own room' }, 400);

      const p2Name =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        user.email?.split('@')[0] ||
        'Player 2';

      await db.from('profiles').upsert({
        id: user.id,
        display_name: p2Name,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      }, { onConflict: 'id', ignoreDuplicates: true });

      const newState = {
        ...game.state,
        players: {
          ...game.state.players,
          p2: { ...game.state.players.p2, name: p2Name, tokenImg: 'bluemarker.png' },
        },
      };

      const { error: updateErr } = await db.from('games').update({
        player2_id: user.id,
        status: 'active',
        state: newState,
      }).eq('room_code', room_code);
      if (updateErr) throw new Error(updateErr.message);

      console.log('[join_room] ✅ player2 joined:', room_code);
      return json({ ok: true, player_slot: 'p2', state: newState });
    }

    // ══════════════════════════════════════════════════════════
    // All remaining actions require an active game
    // ══════════════════════════════════════════════════════════
    if (!room_code) return json({ error: 'room_code required' }, 400);

    const { data: game, error: gameErr } = await db
      .from('games').select('*').eq('room_code', room_code).maybeSingle();
    if (gameErr) throw new Error(gameErr.message);
    if (!game)   return json({ error: 'Game not found' }, 404);

    const mySlot = game.player1_id === user.id ? 'p1'
                 : game.player2_id === user.id ? 'p2'
                 : null;
    if (!mySlot) return json({ error: 'You are not a player in this game' }, 403);

    // ══════════════════════════════════════════════════════════
    // ACTION: roll (Event-Sourced)
    // ══════════════════════════════════════════════════════════
    if (action === 'roll') {
      if (game.state.turn !== mySlot) return json({ error: 'Not your turn' }, 403);
      if (game.state.phase !== 'idle') return json({ error: 'Cannot roll right now' }, 400);

      const player = { ...game.state.players[mySlot] };

      if (player.jailTurns > 0) {
        return json({ error: 'Player is in jail — use jail actions' }, 400);
      }

      // Client passes event_id so broadcast + DB share the same dedup key
      const { event_id } = body as any;

      // Single die (1–6) using cryptographically secure randomness
      const d1 = roll();
      const BOARD_SIZE = 28;
      const oldPos = player.position;
      let newPos = oldPos + d1;
      const passedGenesis = newPos > BOARD_SIZE;
      if (newPos > BOARD_SIZE) newPos -= BOARD_SIZE;

      player.position = newPos;
      if (passedGenesis) player.balance += 200;

      const newState = {
        ...game.state,
        sentBy: mySlot, // self-echo suppression for postgres_changes on the roller's client
        phase: 'action',
        players: { ...game.state.players, [mySlot]: player },
        last_event: {
          type: 'ROLL',
          id: event_id || crypto.randomUUID(), // shared with broadcast for dedup
          p: mySlot,
          dice: d1,
          passedGenesis,
          landingPosition: newPos,
          oldPos,
        }
      };

      const { error: err } = await db.from('games').update({ state: newState }).eq('room_code', room_code);
      if (err) throw new Error(err.message);

      return json({ ok: true, dice: d1, newPos, oldPos, passedGenesis });
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: state_sync (Client pushes clean domain state)
    // FIX D: Optimistic Concurrency Control — reject stale writes atomically
    // ══════════════════════════════════════════════════════════
    if (action === 'state_sync') {
      const { new_state, client_version } = body as any;

      // Check if version column exists (backward-compatible — works before migration)
      const hasVersionColumn = game.version !== undefined;

      if (!hasVersionColumn || typeof client_version !== 'number') {
        // Fallback: simple update (no OCC) — safe until 005_occ_version.sql is run
        const { error: err } = await db
          .from('games')
          .update({ state: new_state })
          .eq('room_code', room_code);
        if (err) throw new Error(err.message);
        console.log('[state_sync] simple update (no OCC — version column missing or client_version not sent)');
        return json({ ok: true, version: 0 });
      }

      // OCC: Atomic conditional update — only succeeds if version hasn't changed
      const { data, error: err } = await db
        .from('games')
        .update({ state: new_state, version: game.version + 1 })
        .eq('id', game.id)
        .eq('version', client_version)
        .select('version')
        .maybeSingle();

      if (err) throw new Error(err.message);

      if (!data) {
        // Another write beat us — tell the client to re-fetch
        console.warn(`[state_sync] OCC conflict for room ${room_code}. client_version=${client_version}, db_version=${game.version}`);
        return json({ ok: false, conflict: true, current_version: game.version }, 409);
      }

      return json({ ok: true, version: data.version });
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: end_turn
    // ══════════════════════════════════════════════════════════
    if (action === 'end_turn') {
      if (game.state.turn !== mySlot) return json({ error: 'Not your turn' }, 403);
      const nextSlot = mySlot === 'p1' ? 'p2' : 'p1';
      
      const newState = {
        ...game.state,
        turn: nextSlot,
        phase: 'idle',
        last_event: { type: 'END_TURN', player: mySlot, next: nextSlot }
      };

      const { error: err } = await db.from('games').update({ state: newState }).eq('room_code', room_code);
      if (err) throw new Error(err.message);

      return json({ ok: true, state: newState });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[game_action] 500:', msg);
    return json({ error: msg }, 500);
  }
});
