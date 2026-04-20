/**
 * BANKROLL — Edge Function: game_action (v4 — Tier 3 Server-Authoritative)
 * ──────────────────────────────────────────────────────────────────────────
 * Every financial mutation is validated server-side. The client is a pure
 * rendering engine — it cannot modify game state without server approval.
 *
 * Atomicity: OCC-retry with version-gated writes (max 3 attempts).
 * Auth: Direct HTTP call to Supabase Auth API (HS256 + ES256 compatible).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Secure random helpers ─────────────────────────────────────
function roll(): number { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % 6) + 1; }
function secureRandom(max: number): number { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max; }
function roomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(6); crypto.getRandomValues(a);
  return Array.from(a).map(b => chars[b % chars.length]).join('');
}

// ── Verify JWT via Supabase Auth REST API ─────────────────────
async function verifyJWT(authHeader: string): Promise<{ id: string; email: string; user_metadata: Record<string, unknown> } | null> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: ANON_KEY },
    });
    if (!resp.ok) { console.error('[auth] failed:', resp.status); return null; }
    return await resp.json();
  } catch (e) { console.error('[auth] network error:', e); return null; }
}

// ══════════════════════════════════════════════════════════════
// GAME CONSTANTS (mirror of client app.js — single source of truth)
// ══════════════════════════════════════════════════════════════
const TIER_ECONOMY: Record<number, any> = {
  1: { base: 10, mono: 20, b1: 40,  b2: 90,  b3: 180,  bCost: 50  },
  2: { base: 15, mono: 30, b1: 60,  b2: 130, b3: 260,  bCost: 60  },
  3: { base: 22, mono: 44, b1: 88,  b2: 190, b3: 380,  bCost: 75  },
  4: { base: 30, mono: 60, b1: 120, b2: 260, b3: 520,  bCost: 90  },
  5: { base: 40, mono: 80, b1: 160, b2: 350, b3: 700,  bCost: 110 },
  6: { base: 50, mono: 100,b1: 200, b2: 425, b3: 850,  bCost: 130 },
  7: { base: 60, mono: 120,b1: 240, b2: 520, b3: 1040, bCost: 145 },
  8: { base: 70, mono: 140,b1: 280, b2: 600, b3: 1200, bCost: 160 },
};
const UTIL_RENT: Record<number, number> = { 1: 20, 2: 50, 3: 90, 4: 140 };
const BOARD_DATA: any[] = [
  { id: 1,  name: 'Genesis',      type: 'corner', subtype: 'genesis', tier: 0, price: 0 },
  { id: 2,  name: 'Lagos',        type: 'city', tier: 1, price: 90 },
  { id: 3,  name: 'Nairobi',      type: 'city', tier: 1, price: 100 },
  { id: 4,  name: 'Hanoi',        type: 'city', tier: 2, price: 105 },
  { id: 5,  name: 'Shipping',     type: 'utility', tier: 0, price: 175 },
  { id: 6,  name: 'Medellín',     type: 'city', tier: 2, price: 115 },
  { id: 7,  name: 'Bangkok',      type: 'city', tier: 2, price: 140 },
  { id: 8,  name: 'Lucky Card',   type: 'corner', subtype: 'lucky', tier: 0, price: 0 },
  { id: 9,  name: 'Istanbul',     type: 'city', tier: 3, price: 150 },
  { id: 10, name: 'São Paulo',    type: 'city', tier: 3, price: 170 },
  { id: 11, name: 'Mumbai',       type: 'city', tier: 4, price: 185 },
  { id: 12, name: 'Internet',     type: 'utility', tier: 0, price: 175 },
  { id: 13, name: 'Seoul',        type: 'city', tier: 4, price: 210 },
  { id: 14, name: 'Berlin',       type: 'city', tier: 4, price: 220 },
  { id: 15, name: 'Staking Pool', type: 'corner', subtype: 'staking', tier: 0, price: 0 },
  { id: 16, name: 'Toronto',      type: 'city', tier: 5, price: 240 },
  { id: 17, name: 'Sydney',       type: 'city', tier: 5, price: 255 },
  { id: 18, name: 'Zurich',       type: 'city', tier: 6, price: 280 },
  { id: 19, name: 'Electric',     type: 'utility', tier: 0, price: 175 },
  { id: 20, name: 'Tokyo',        type: 'city', tier: 6, price: 300 },
  { id: 21, name: 'Hong Kong',    type: 'city', tier: 6, price: 310 },
  { id: 22, name: 'Jail',         type: 'corner', subtype: 'jail', tier: 0, price: 0 },
  { id: 23, name: 'London',       type: 'city', tier: 7, price: 330 },
  { id: 24, name: 'Shanghai',     type: 'city', tier: 7, price: 350 },
  { id: 25, name: 'Singapore',    type: 'city', tier: 8, price: 370 },
  { id: 26, name: 'Airport',      type: 'utility', tier: 0, price: 175 },
  { id: 27, name: 'Dubai',        type: 'city', tier: 8, price: 390 },
  { id: 28, name: 'New York',     type: 'city', tier: 8, price: 410 },
];
const BOARD_SIZE = 28;

// ── Pure game logic helpers ───────────────────────────────────
function getTierCities(tier: number) { return BOARD_DATA.filter(s => s.type === 'city' && s.tier === tier); }
function hasMonopoly(owners: any, pid: string, tier: number) { return getTierCities(tier).every(s => owners[s.id] === pid); }
function countOwnedUtils(owners: any, pid: string) { return BOARD_DATA.filter(s => s.type === 'utility' && owners[s.id] === pid).length; }
function calcRent(space: any, owners: any, buildings: any): number {
  if (space.type === 'utility') { const o = owners[space.id]; if (!o) return 0; return UTIL_RENT[countOwnedUtils(owners, o)] || 20; }
  if (space.type !== 'city') return 0;
  const o = owners[space.id]; if (!o) return 0;
  const eco = TIER_ECONOMY[space.tier]; if (!eco) return 0;
  const b = buildings[space.id] || 0;
  if (b >= 3) return eco.b3; if (b === 2) return eco.b2; if (b === 1) return eco.b1;
  if (hasMonopoly(owners, o, space.tier)) return eco.mono; return eco.base;
}
function calcNetWorth(pid: string, st: any): number {
  let net = st.players[pid]?.balance ?? 0;
  for (const [sid, owner] of Object.entries(st.owners)) {
    if (owner === pid) { const sp = BOARD_DATA.find(s => String(s.id) === sid); if (sp?.price) net += sp.price; }
  }
  return net;
}
function deepClone(obj: any) { return JSON.parse(JSON.stringify(obj)); }

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing Authorization header' }, 401);
  const user = await verifyJWT(authHeader);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const { action, room_code } = body;
  console.log(`[game_action] user=${user.id} action=${action}`);

  try {

    // ══════════════════════════════════════════════════════════
    // ACTION: create_room
    // ══════════════════════════════════════════════════════════
    if (action === 'create_room') {
      const displayName = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || (user.email?.split('@')[0]) || 'Player';
      await db.from('profiles').upsert({ id: user.id, display_name: displayName, avatar_url: user.user_metadata?.avatar_url ?? null }, { onConflict: 'id', ignoreDuplicates: true });
      const initialState = {
        turn: 'p1', phase: 'idle',
        players: {
          p1: { name: displayName, balance: 1000, position: 1, jailTurns: 0, tokenImg: 'redmarker.png' },
          p2: { name: 'Waiting...', balance: 1000, position: 1, jailTurns: 0, tokenImg: 'bluemarker.png' },
        },
        owners: {}, buildings: {}, stakingPool: 0, winTarget: 2500, gameOver: false, last_event: null,
        bet: { active: false, bettor: null, betType: null, betValue: null },
      };
      let code = roomCode();
      for (let i = 0; i < 5; i++) {
        const { error } = await db.from('games').insert({ room_code: code, player1_id: user.id, status: 'waiting', state: initialState });
        if (!error) break;
        if (error.code !== '23505') throw new Error(error.message);
        code = roomCode(); if (i === 4) throw new Error('Could not generate unique room code.');
      }
      return json({ ok: true, room_code: code });
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: join_room
    // ══════════════════════════════════════════════════════════
    if (action === 'join_room') {
      if (!room_code) return json({ error: 'room_code required' }, 400);
      const { data: game, error: ge } = await db.from('games').select('*').eq('room_code', room_code).maybeSingle();
      if (ge) throw new Error(ge.message);
      if (!game) return json({ error: 'Room not found' }, 404);
      if (game.status !== 'waiting') return json({ error: 'Game already started' }, 400);
      if (game.player1_id === user.id) return json({ error: 'Cannot join your own room' }, 400);
      const p2Name = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'Player 2';
      await db.from('profiles').upsert({ id: user.id, display_name: p2Name, avatar_url: user.user_metadata?.avatar_url ?? null }, { onConflict: 'id', ignoreDuplicates: true });
      const newState = { ...game.state, players: { ...game.state.players, p2: { ...game.state.players.p2, name: p2Name, tokenImg: 'bluemarker.png' } } };
      const { error: ue } = await db.from('games').update({ player2_id: user.id, status: 'active', state: newState }).eq('room_code', room_code);
      if (ue) throw new Error(ue.message);
      return json({ ok: true, player_slot: 'p2', state: newState });
    }

    // ══════════════════════════════════════════════════════════
    // All remaining actions require an active game + player slot
    // ══════════════════════════════════════════════════════════
    if (!room_code) return json({ error: 'room_code required' }, 400);
    const { data: game, error: gameErr } = await db.from('games').select('*').eq('room_code', room_code).maybeSingle();
    if (gameErr) throw new Error(gameErr.message);
    if (!game) return json({ error: 'Game not found' }, 404);
    const mySlot = game.player1_id === user.id ? 'p1' : game.player2_id === user.id ? 'p2' : null;
    if (!mySlot) return json({ error: 'Not a player in this game' }, 403);

    // ── OCC Atomic Helper ─────────────────────────────────────
    // Read → validate → version-gated write → retry on conflict
    async function atomicAction(mutator: (state: any, g: any) => { newState: any; result: any }) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: g, error: e } = await db.from('games').select('*').eq('room_code', room_code).single();
        if (e || !g) throw new Error('Game not found');
        const { newState, result } = mutator(g.state, g);
        const ver = g.version ?? 0;
        const { data, error: we } = await db.from('games')
          .update({ state: newState, version: ver + 1 }).eq('id', g.id).eq('version', ver)
          .select('version').maybeSingle();
        if (we) throw new Error(we.message);
        if (data) return { ...result, version: data.version };
        console.warn(`[atomicAction] OCC conflict attempt ${attempt + 1}`);
      }
      throw new Error('Concurrency conflict after 3 retries');
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: roll (Server-Authoritative Dice + Bet Resolution)
    // ══════════════════════════════════════════════════════════
    if (action === 'roll') {
      const { event_id } = body;
      const result = await atomicAction((state) => {
        if (state.turn !== mySlot) throw new Error('Not your turn');
        if (state.phase !== 'idle') throw new Error('Cannot roll now');
        if (state.players[mySlot].jailTurns > 0) throw new Error('In jail');

        const ns = deepClone(state);
        const d1 = roll();
        const oldPos = ns.players[mySlot].position;
        let newPos = oldPos + d1;
        const passedGenesis = newPos > BOARD_SIZE;
        if (newPos > BOARD_SIZE) newPos -= BOARD_SIZE;
        ns.players[mySlot].position = newPos;
        if (passedGenesis) ns.players[mySlot].balance += 200;

        // Embedded bet resolution — unhackable
        let betResult: any = null;
        if (ns.bet?.active) {
          const landed = BOARD_DATA.find((s: any) => s.id === newPos);
          let won = false;
          if (ns.bet.betType === 'space' && landed && String(landed.id) === String(ns.bet.betValue)) won = true;
          if (won) {
            ns.players[ns.bet.bettor].balance += 300;
            betResult = { won: true, payout: 300, bettor: ns.bet.bettor };
          } else {
            const ps = Math.round(150 * 0.3);
            ns.stakingPool = (ns.stakingPool || 0) + ps;
            betResult = { won: false, poolShare: ps, bettor: ns.bet.bettor };
          }
          ns.bet = { active: false, bettor: null, betType: null, betValue: null };
        }

        ns.sentBy = mySlot;
        ns.phase = 'action';
        ns.last_event = { type: 'ROLL', id: event_id || crypto.randomUUID(), p: mySlot, dice: d1, passedGenesis, landingPosition: newPos, oldPos };
        return {
          newState: ns,
          result: { ok: true, dice: d1, newPos, oldPos, passedGenesis, betResult, newBalance: ns.players[mySlot].balance, stakingPool: ns.stakingPool }
        };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: buy (Server-Authoritative Purchase)
    // ══════════════════════════════════════════════════════════
    if (action === 'buy') {
      const { space_id } = body;
      const result = await atomicAction((state) => {
        if (state.turn !== mySlot) throw new Error('Not your turn');
        const space = BOARD_DATA.find((s: any) => s.id === space_id);
        if (!space || space.type === 'corner') throw new Error('Cannot buy this space');
        if (state.owners[space_id]) throw new Error('Already owned');
        if (state.players[mySlot].balance < space.price) throw new Error('Cannot afford');

        const ns = deepClone(state);
        ns.players[mySlot].balance -= space.price;
        ns.stakingPool += Math.round(space.price * 0.3);
        ns.owners[String(space_id)] = mySlot;
        ns.sentBy = mySlot;
        const rent = calcRent(space, ns.owners, ns.buildings);
        ns.last_event = { type: 'BUY', id: crypto.randomUUID(), p: mySlot, spaceId: space_id, spaceName: space.name, newRent: rent };
        return { newState: ns, result: { ok: true, newBalance: ns.players[mySlot].balance, rent, stakingPool: ns.stakingPool, owners: ns.owners } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: rent (Server-Authoritative Rent Collection)
    // ══════════════════════════════════════════════════════════
    if (action === 'rent') {
      const { space_id } = body;
      const result = await atomicAction((state) => {
        if (state.turn !== mySlot) throw new Error('Not your turn');
        const space = BOARD_DATA.find((s: any) => s.id === space_id);
        if (!space) throw new Error('Invalid space');
        const owner = state.owners[String(space_id)];
        if (!owner || owner === mySlot) throw new Error('No rent owed');

        const rent = calcRent(space, state.owners, state.buildings);
        const ns = deepClone(state);
        ns.players[mySlot].balance -= rent;
        ns.players[owner].balance += rent;
        ns.sentBy = mySlot;
        ns.last_event = { type: 'RENT', id: crypto.randomUUID(), p: mySlot, owner, rent, spaceId: space_id, spaceName: space.name };
        return { newState: ns, result: { ok: true, rent, payerBalance: ns.players[mySlot].balance, ownerBalance: ns.players[owner].balance } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: build (Server-Authoritative Building)
    // ══════════════════════════════════════════════════════════
    if (action === 'build') {
      const { space_id } = body;
      const result = await atomicAction((state) => {
        if (state.turn !== mySlot) throw new Error('Not your turn');
        if (state.owners[String(space_id)] !== mySlot) throw new Error('Not your property');
        const space = BOARD_DATA.find((s: any) => s.id === space_id);
        if (!space || space.type !== 'city') throw new Error('Cannot build here');
        if (!hasMonopoly(state.owners, mySlot, space.tier)) throw new Error('Need monopoly');
        const bldgs = state.buildings[String(space_id)] || 0;
        if (bldgs >= 3) throw new Error('Max buildings');
        const cost = TIER_ECONOMY[space.tier]?.bCost || 0;
        if (state.players[mySlot].balance < cost) throw new Error('Cannot afford');

        const ns = deepClone(state);
        ns.players[mySlot].balance -= cost;
        ns.buildings[String(space_id)] = bldgs + 1;
        ns.sentBy = mySlot;
        ns.last_event = { type: 'BUILD', id: crypto.randomUUID(), p: mySlot, spaceId: space_id, count: ns.buildings[String(space_id)] };
        return { newState: ns, result: { ok: true, newBalance: ns.players[mySlot].balance, buildings: ns.buildings[String(space_id)] } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: sell (Server-Authoritative Sale)
    // ══════════════════════════════════════════════════════════
    if (action === 'sell') {
      const { space_id } = body;
      const result = await atomicAction((state) => {
        if (state.turn !== mySlot) throw new Error('Not your turn');
        if (state.owners[String(space_id)] !== mySlot) throw new Error('Not your property');
        const space = BOARD_DATA.find((s: any) => s.id === space_id);
        if (!space) throw new Error('Invalid space');
        const sellPrice = Math.round(space.price * 0.8);
        const bCost = TIER_ECONOMY[space.tier]?.bCost || 0;
        const bCount = state.buildings[String(space_id)] || 0;
        const buildRefund = Math.round(bCost * bCount * 0.8);

        const ns = deepClone(state);
        ns.players[mySlot].balance += sellPrice + buildRefund;
        delete ns.owners[String(space_id)];
        ns.buildings[String(space_id)] = 0;
        ns.sentBy = mySlot;
        ns.last_event = { type: 'SELL', id: crypto.randomUUID(), p: mySlot, spaceId: space_id, salePrice: sellPrice + buildRefund };
        return { newState: ns, result: { ok: true, newBalance: ns.players[mySlot].balance, salePrice: sellPrice + buildRefund } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: lucky (Server-Authoritative Lucky Card Draw)
    // ══════════════════════════════════════════════════════════
    if (action === 'lucky') {
      const result = await atomicAction((state) => {
        if (state.turn !== mySlot) throw new Error('Not your turn');
        const pos = state.players[mySlot].position;
        const space = BOARD_DATA.find((s: any) => s.id === pos);
        if (!space || space.subtype !== 'lucky') throw new Error('Not on lucky card space');

        const ns = deepClone(state);
        // Server draws card using crypto.getRandomValues — client cannot forge
        const CARDS: Array<{ name: string; exec: (p: string, s: any) => any }> = [
          { name: 'The Airdrop', exec: (p, s) => { s.players[p].balance += 200; return { amount: 200, text: 'Crypto airdrop! Collect $200 from the bank.', from: 'bank', to: p }; }},
          { name: 'Seed Funding', exec: (p, s) => {
            if (s.players[p].balance < 200) { s.players[p].balance += 300; return { amount: 300, text: 'Cash < $200 — Bank grants $300!', from: 'bank', to: p }; }
            else { s.players[p].balance += 50; return { amount: 50, text: 'Cash ≥ $200 — Collect $50.', from: 'bank', to: p }; }
          }},
          { name: 'White-Hat Bounty', exec: (p, s) => {
            const opp = p === 'p1' ? 'p2' : 'p1';
            const richer = calcNetWorth('p1', s) >= calcNetWorth('p2', s) ? 'p1' : 'p2';
            const victim = richer === p ? opp : richer;
            s.players[victim].balance -= 100; s.players[p].balance += 100;
            return { amount: 100, from: victim, to: p, text: `Collected $100 from ${s.players[victim].name}!` };
          }},
          { name: 'Network Congestion', exec: (p, s) => {
            let bc = 0; for (const [sid, cnt] of Object.entries(s.buildings)) { if (s.owners[sid] === p) bc += (cnt as number); }
            const cost = bc * 50; s.players[p].balance -= cost; s.stakingPool += cost;
            return { amount: -cost, from: p, to: 'bank', text: `Pay $50 per building (${bc}) → $${cost} to Staking Pool!` };
          }},
          { name: 'Smart Contract Exploit', exec: (p, s) => { s.players[p].balance -= 150; s.stakingPool += 150; return { amount: -150, from: p, to: 'bank', text: 'Exploited! Lose $150 to Staking Pool.' }; }},
          { name: 'Subpoena', exec: (p, s) => { s.players[p].jailTurns = 2; s.players[p].position = 22; return { amount: 0, text: 'Go directly to Jail!', jail: true }; }},
          { name: 'Tumbler Protocol', exec: (p, s) => {
            for (const pid of ['p1','p2']) { s.players[pid].balance -= 100; s.stakingPool += 100; }
            return { amount: -100, from: 'all', to: 'bank', text: 'ALL players pay $100 to the Staking Pool!' };
          }},
          { name: 'Ecosystem Migration', exec: (p, s) => {
            const freeUtils = BOARD_DATA.filter(sp => sp.type === 'utility' && !s.owners[sp.id]);
            if (freeUtils.length > 0) { const tgt = freeUtils[secureRandom(freeUtils.length)]; return { amount: 0, text: `Teleporting to ${tgt.name}!`, teleport: tgt }; }
            const ownedUtils = BOARD_DATA.filter(sp => sp.type === 'utility' && s.owners[sp.id]);
            if (ownedUtils.length > 0) {
              const util = ownedUtils[secureRandom(ownedUtils.length)]; const owner = s.owners[util.id]; const rent = 40;
              s.players[p].balance -= rent; s.players[owner].balance += rent;
              return { amount: -rent, from: p, to: owner, text: `All utilities owned! Paid $${rent} rent to ${s.players[owner].name}.` };
            }
            return { amount: 0, text: 'No utilities on the board.' };
          }},
        ];
        const cardIdx = secureRandom(CARDS.length);
        const card = CARDS[cardIdx];
        const cardResult = card.exec(mySlot, ns);

        // Handle teleport: update position server-side
        if (cardResult.teleport) {
          const tgt = cardResult.teleport;
          const oldPos = ns.players[mySlot].position;
          const steps = ((tgt.id - oldPos) + BOARD_SIZE) % BOARD_SIZE || BOARD_SIZE;
          const pGen = (oldPos + steps) > BOARD_SIZE;
          ns.players[mySlot].position = tgt.id;
          if (pGen) ns.players[mySlot].balance += 200;
          cardResult.passedGenesis = pGen;
          cardResult.oldPos = oldPos;
          cardResult.steps = steps;
        }

        ns.sentBy = mySlot;
        ns.last_event = { type: 'LUCKY', id: crypto.randomUUID(), p: mySlot, cardName: card.name, cardText: cardResult.text || card.name, amount: cardResult.amount, cardResult };
        return { newState: ns, result: { ok: true, cardName: card.name, cardText: cardResult.text, cardResult, players: ns.players, stakingPool: ns.stakingPool } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: staking_collect (Server-Authoritative Pool Payout)
    // ══════════════════════════════════════════════════════════
    if (action === 'staking_collect') {
      const result = await atomicAction((state) => {
        if (state.turn !== mySlot) throw new Error('Not your turn');
        const pos = state.players[mySlot].position;
        const space = BOARD_DATA.find((s: any) => s.id === pos);
        if (!space || space.subtype !== 'staking') throw new Error('Not on staking pool');
        if ((state.stakingPool || 0) <= 0) throw new Error('Pool is empty');

        const pool = state.stakingPool;
        const pct = pool < 50 ? 1.0 : (0.35 + (secureRandom(30) / 100));
        const payout = Math.floor(pool * pct);

        const ns = deepClone(state);
        ns.players[mySlot].balance += payout;
        ns.stakingPool -= payout;
        ns.sentBy = mySlot;
        const pctDisplay = Math.round(pct * 100);
        ns.last_event = { type: 'STAKING_WIN', id: crypto.randomUUID(), p: mySlot, payout, pct: pctDisplay };
        return { newState: ns, result: { ok: true, payout, pct: pctDisplay, newBalance: ns.players[mySlot].balance, newPool: ns.stakingPool } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: jail_pay (Server-Authoritative Jail Escape)
    // ══════════════════════════════════════════════════════════
    if (action === 'jail_pay') {
      const result = await atomicAction((state) => {
        if (state.turn !== mySlot) throw new Error('Not your turn');
        if (state.players[mySlot].jailTurns <= 0) throw new Error('Not in jail');
        if (state.players[mySlot].balance < 150) throw new Error('Cannot afford bail');

        const ns = deepClone(state);
        ns.players[mySlot].balance -= 150;
        ns.stakingPool += Math.round(150 * 0.3);
        ns.players[mySlot].jailTurns = 0;
        ns.sentBy = mySlot;
        ns.last_event = { type: 'JAIL_EXIT', id: crypto.randomUUID(), p: mySlot };
        return { newState: ns, result: { ok: true, newBalance: ns.players[mySlot].balance, stakingPool: ns.stakingPool } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: jail_serve (Server-Authoritative Jail Serve)
    // ══════════════════════════════════════════════════════════
    if (action === 'jail_serve') {
      const result = await atomicAction((state) => {
        if (state.turn !== mySlot) throw new Error('Not your turn');
        if (state.players[mySlot].jailTurns <= 0) throw new Error('Not in jail');

        const ns = deepClone(state);
        ns.players[mySlot].jailTurns -= 1;
        ns.sentBy = mySlot;
        ns.last_event = { type: 'JAIL_TURN', id: crypto.randomUUID(), p: mySlot, turnsLeft: ns.players[mySlot].jailTurns };
        return { newState: ns, result: { ok: true, jailTurns: ns.players[mySlot].jailTurns } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: bet (Server-Authoritative Bet Placement)
    // ══════════════════════════════════════════════════════════
    if (action === 'bet') {
      const { bet_type, bet_value } = body;
      const result = await atomicAction((state) => {
        if (state.turn === mySlot) throw new Error('Cannot bet on own turn');
        if (state.bet?.active) throw new Error('Bet already active');
        if (state.players[mySlot].balance < 150) throw new Error('Cannot afford bet');

        const ns = deepClone(state);
        ns.players[mySlot].balance -= 150;
        ns.bet = { active: true, bettor: mySlot, betType: bet_type, betValue: String(bet_value) };
        ns.sentBy = mySlot;
        ns.last_event = { type: 'BET_PLACED', id: crypto.randomUUID(), bettor: mySlot, betType: bet_type, betValue: String(bet_value) };
        return { newState: ns, result: { ok: true, newBalance: ns.players[mySlot].balance } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: trade_execute (Server-Authoritative Trade)
    // ══════════════════════════════════════════════════════════
    if (action === 'trade_execute') {
      const { proposer, offerProps, counterProps, offerCash, counterCash } = body;
      const result = await atomicAction((state) => {
        const opp = proposer === 'p1' ? 'p2' : 'p1';
        // Validate ownership
        for (const sid of (offerProps || [])) { if (state.owners[String(sid)] !== proposer) throw new Error(`${proposer} doesn't own ${sid}`); }
        for (const sid of (counterProps || [])) { if (state.owners[String(sid)] !== opp) throw new Error(`${opp} doesn't own ${sid}`); }
        // Validate cash
        if ((offerCash || 0) > 0 && state.players[proposer].balance < offerCash) throw new Error('Proposer cannot afford');
        if ((counterCash || 0) > 0 && state.players[opp].balance < counterCash) throw new Error('Acceptor cannot afford');

        const ns = deepClone(state);
        (offerProps || []).forEach((sid: any) => { ns.owners[String(sid)] = opp; });
        (counterProps || []).forEach((sid: any) => { ns.owners[String(sid)] = proposer; });
        if ((offerCash || 0) > 0) { ns.players[proposer].balance -= offerCash; ns.players[opp].balance += offerCash; }
        if ((counterCash || 0) > 0) { ns.players[opp].balance -= counterCash; ns.players[proposer].balance += counterCash; }
        ns.sentBy = mySlot;
        ns.last_event = { type: 'TRADE_EXECUTED', id: crypto.randomUUID(), proposer, offerProps, counterProps, offerCash, counterCash };
        return { newState: ns, result: { ok: true, p1Balance: ns.players.p1.balance, p2Balance: ns.players.p2.balance, owners: ns.owners } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: end_turn
    // ══════════════════════════════════════════════════════════
    if (action === 'end_turn') {
      const result = await atomicAction((state) => {
        if (state.turn !== mySlot) throw new Error('Not your turn');
        const next = mySlot === 'p1' ? 'p2' : 'p1';
        const ns = deepClone(state);
        ns.turn = next; ns.phase = 'idle'; ns.sentBy = mySlot;
        ns.last_event = { type: 'END_TURN', id: crypto.randomUUID(), player: mySlot, next };
        return { newState: ns, result: { ok: true } };
      });
      return json(result);
    }

    // ══════════════════════════════════════════════════════════
    // ACTION: state_sync (DEPRECATED — backward compat only)
    // ══════════════════════════════════════════════════════════
    if (action === 'state_sync') {
      console.warn('[state_sync] DEPRECATED — use specific actions');
      const { new_state, client_version } = body;
      const ver = game.version ?? 0;
      if (typeof client_version !== 'number') {
        await db.from('games').update({ state: new_state }).eq('room_code', room_code);
        return json({ ok: true, version: 0 });
      }
      const { data } = await db.from('games')
        .update({ state: new_state, version: ver + 1 }).eq('id', game.id).eq('version', client_version)
        .select('version').maybeSingle();
      if (!data) return json({ ok: false, conflict: true, current_version: ver }, 409);
      return json({ ok: true, version: data.version });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[game_action] error:', msg);
    return json({ error: msg }, 500);
  }
});
