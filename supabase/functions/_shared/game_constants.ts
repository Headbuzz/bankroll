/**
 * BANKROLL — Shared Game Constants (Server-Side)
 * ───────────────────────────────────────────────
 * Mirror of client-side game rules. Used by all Edge Function actions
 * to validate and compute game state mutations.
 *
 * IMPORTANT: Keep in sync with bankroll-board/js/app.js lines 73–244.
 * These are pure data + pure functions — no DOM, no state, no side effects.
 */

// ── Tier Economy (rent tables + building costs) ───────────────────
export const TIER_ECONOMY: Record<number, {
  base: number; mono: number; b1: number; b2: number; b3: number; bCost: number;
}> = {
  1: { base: 10, mono: 20, b1: 40,  b2: 90,  b3: 180,  bCost: 50  },
  2: { base: 15, mono: 30, b1: 60,  b2: 130, b3: 260,  bCost: 60  },
  3: { base: 22, mono: 44, b1: 88,  b2: 190, b3: 380,  bCost: 75  },
  4: { base: 30, mono: 60, b1: 120, b2: 260, b3: 520,  bCost: 90  },
  5: { base: 40, mono: 80, b1: 160, b2: 350, b3: 700,  bCost: 110 },
  6: { base: 50, mono: 100,b1: 200, b2: 425, b3: 850,  bCost: 130 },
  7: { base: 60, mono: 120,b1: 240, b2: 520, b3: 1040, bCost: 145 },
  8: { base: 70, mono: 140,b1: 280, b2: 600, b3: 1200, bCost: 160 },
};

export const UTIL_RENT: Record<number, number> = { 1: 20, 2: 50, 3: 90, 4: 140 };

// ── Board: 28 spaces ─────────────────────────────────────────────
export interface BoardSpace {
  id: number;
  name: string;
  type: 'city' | 'utility' | 'corner';
  subtype?: 'genesis' | 'lucky' | 'staking' | 'jail';
  tier?: number;
  price?: number;
  icon?: string;
  image?: string;
}

export const BOARD: BoardSpace[] = [
  { id: 1,  name: 'Genesis',      type: 'corner', subtype: 'genesis' },
  { id: 2,  name: 'Lagos',        type: 'city', tier: 1, price: 90  },
  { id: 3,  name: 'Nairobi',      type: 'city', tier: 1, price: 100 },
  { id: 4,  name: 'Hanoi',        type: 'city', tier: 2, price: 105 },
  { id: 5,  name: 'Shipping',     type: 'utility', icon: '🚢', price: 175 },
  { id: 6,  name: 'Medellín',     type: 'city', tier: 2, price: 115 },
  { id: 7,  name: 'Bangkok',      type: 'city', tier: 2, price: 140 },
  { id: 8,  name: 'Lucky Card',   type: 'corner', subtype: 'lucky' },
  { id: 9,  name: 'Istanbul',     type: 'city', tier: 3, price: 150 },
  { id: 10, name: 'São Paulo',    type: 'city', tier: 3, price: 170 },
  { id: 11, name: 'Mumbai',       type: 'city', tier: 4, price: 185 },
  { id: 12, name: 'Internet',     type: 'utility', icon: '☁️', price: 175 },
  { id: 13, name: 'Seoul',        type: 'city', tier: 4, price: 210 },
  { id: 14, name: 'Berlin',       type: 'city', tier: 4, price: 220 },
  { id: 15, name: 'Staking Pool', type: 'corner', subtype: 'staking' },
  { id: 16, name: 'Toronto',      type: 'city', tier: 5, price: 240 },
  { id: 17, name: 'Sydney',       type: 'city', tier: 5, price: 255 },
  { id: 18, name: 'Zurich',       type: 'city', tier: 6, price: 280 },
  { id: 19, name: 'Electric',     type: 'utility', icon: '⚡', price: 175 },
  { id: 20, name: 'Tokyo',        type: 'city', tier: 6, price: 300 },
  { id: 21, name: 'Hong Kong',    type: 'city', tier: 6, price: 310 },
  { id: 22, name: 'Jail',         type: 'corner', subtype: 'jail' },
  { id: 23, name: 'London',       type: 'city', tier: 7, price: 330 },
  { id: 24, name: 'Shanghai',     type: 'city', tier: 7, price: 350 },
  { id: 25, name: 'Singapore',    type: 'city', tier: 8, price: 370 },
  { id: 26, name: 'Airport',      type: 'utility', icon: '✈️', price: 175 },
  { id: 27, name: 'Dubai',        type: 'city', tier: 8, price: 390 },
  { id: 28, name: 'New York',     type: 'city', tier: 8, price: 410 },
];

const BOARD_SIZE = 28;

// ── Game State Types ─────────────────────────────────────────────
export interface PlayerState {
  name: string;
  balance: number;
  position: number;
  jailTurns: number;
  tokenImg: string;
}

export interface GameState {
  turn: string;
  phase: string;
  players: Record<string, PlayerState>;
  owners: Record<string, string>;      // spaceId → playerSlot
  buildings: Record<string, number>;   // spaceId → count (0–3)
  stakingPool: number;
  winTarget: number;
  gameOver: boolean;
  last_event: any;
  sentBy?: string;
  bet?: { active: boolean; bettor: string | null; betType: string | null; betValue: string | null };
}

// ── Pure helper functions ────────────────────────────────────────

/** Get all cities in a given tier */
export function getTierCities(tier: number): BoardSpace[] {
  return BOARD.filter(s => s.type === 'city' && s.tier === tier);
}

/** Check if a player owns all cities in a tier */
export function hasMonopoly(owners: Record<string, string>, playerId: string, tier: number): boolean {
  return getTierCities(tier).every(s => owners[s.id] === playerId);
}

/** Count how many utilities a player owns */
export function countOwnedUtils(owners: Record<string, string>, playerId: string): number {
  return BOARD.filter(s => s.type === 'utility' && owners[s.id] === playerId).length;
}

/** Calculate rent for a space given current state */
export function calculateRent(
  space: BoardSpace,
  owners: Record<string, string>,
  buildings: Record<string, number>
): number {
  if (space.type === 'utility') {
    const owner = owners[space.id];
    if (!owner) return 0;
    const count = countOwnedUtils(owners, owner);
    return UTIL_RENT[count] || 20;
  }
  if (space.type !== 'city') return 0;
  const owner = owners[space.id];
  if (!owner) return 0;
  const eco = TIER_ECONOMY[space.tier!];
  if (!eco) return 0;
  const bldgs = buildings[space.id] || 0;
  const mono = hasMonopoly(owners, owner, space.tier!);
  if (bldgs >= 3) return eco.b3;
  if (bldgs === 2) return eco.b2;
  if (bldgs === 1) return eco.b1;
  if (mono) return eco.mono;
  return eco.base;
}

/** Calculate net worth (for lucky cards) */
export function calculateNetWorth(
  playerId: string,
  state: GameState
): number {
  let net = state.players[playerId]?.balance ?? 0;
  for (const [sid, owner] of Object.entries(state.owners)) {
    if (owner === playerId) {
      const sp = BOARD.find(s => String(s.id) === sid);
      if (sp?.price) net += sp.price;
      const bCount = state.buildings[sid] || 0;
      if (sp?.tier) net += (TIER_ECONOMY[sp.tier]?.bCost || 0) * bCount;
    }
  }
  return net;
}

// ── Secure random (server-side) ──────────────────────────────────
function secureRandom(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

// ── Lucky Cards (server-side — uses crypto.getRandomValues) ──────
interface LuckyResult {
  amount: number;
  text?: string;
  from?: string;
  to?: string;
  jail?: boolean;
  teleport?: BoardSpace | null;
}

interface LuckyCard {
  name: string;
  text: string;
  type: string;
  execute: (p: string, s: GameState) => LuckyResult;
}

export const LUCKY_CARDS: LuckyCard[] = [
  {
    name: 'The Airdrop', text: 'Crypto airdrop! Collect $200 from the bank.', type: 'gain',
    execute(p, s) { s.players[p].balance += 200; return { amount: 200, from: 'bank', to: p }; }
  },
  {
    name: 'Seed Funding', text: '', type: 'gain',
    execute(p, s) {
      if (s.players[p].balance < 200) {
        s.players[p].balance += 300;
        return { amount: 300, text: 'Cash < $200 — Bank grants $300!', from: 'bank', to: p };
      } else {
        s.players[p].balance += 50;
        return { amount: 50, text: 'Cash ≥ $200 — Collect $50.', from: 'bank', to: p };
      }
    }
  },
  {
    name: 'White-Hat Bounty', text: 'Collect $100 from the richest player!', type: 'gain',
    execute(p, s) {
      const opp = p === 'p1' ? 'p2' : 'p1';
      const richest = calculateNetWorth('p1', s) >= calculateNetWorth('p2', s)
        ? (p === 'p1' ? opp : 'p1') : (p === 'p2' ? opp : 'p2');
      const target = richest === p ? opp : richest;
      s.players[target].balance -= 100;
      s.players[p].balance += 100;
      return { amount: 100, from: target, to: p, text: `Collected $100 from ${s.players[target].name}!` };
    }
  },
  {
    name: 'Network Congestion', text: '', type: 'drain',
    execute(p, s) {
      let bCount = 0;
      for (const [sid, cnt] of Object.entries(s.buildings)) {
        if (s.owners[sid] === p) bCount += (cnt as number);
      }
      const cost = bCount * 50;
      s.players[p].balance -= cost;
      s.stakingPool += cost;
      return { amount: -cost, from: p, to: 'bank', text: `Pay $50 per building (${bCount}) → $${cost} to Staking Pool!` };
    }
  },
  {
    name: 'Smart Contract Exploit', text: 'Exploited! Lose $150 to Staking Pool.', type: 'drain',
    execute(p, s) { s.players[p].balance -= 150; s.stakingPool += 150; return { amount: -150, from: p, to: 'bank' }; }
  },
  {
    name: 'Subpoena', text: 'Go directly to Jail!', type: 'drain',
    execute(p, s) {
      s.players[p].jailTurns = 2;
      s.players[p].position = 22;
      return { amount: 0, text: 'Sent to Jail! No Genesis salary.', jail: true };
    }
  },
  {
    name: 'Tumbler Protocol', text: 'ALL players pay $100 to the Staking Pool!', type: 'chaos',
    execute(p, s) {
      for (const pid of ['p1', 'p2']) { s.players[pid].balance -= 100; s.stakingPool += 100; }
      return { amount: -100, from: 'all', to: 'bank', text: 'All players pay $100 → Staking Pool!' };
    }
  },
  {
    name: 'Ecosystem Migration', text: 'Machine assigns you a random Utility!', type: 'chaos',
    execute(p, s) {
      const freeUtils = BOARD.filter(sp => sp.type === 'utility' && !s.owners[sp.id]);
      if (freeUtils.length > 0) {
        const target = freeUtils[secureRandom(freeUtils.length)];
        return { amount: 0, text: `Teleporting to ${target.name}!`, teleport: target };
      }
      const ownedUtils = BOARD.filter(sp => sp.type === 'utility' && s.owners[sp.id]);
      if (ownedUtils.length > 0) {
        const util = ownedUtils[secureRandom(ownedUtils.length)];
        const owner = s.owners[util.id];
        const rent = 40;
        s.players[p].balance -= rent;
        s.players[owner].balance += rent;
        return { amount: -rent, from: p, to: owner, text: `All utilities owned! Paid $${rent} rent to ${s.players[owner].name}.` };
      }
      return { amount: 0, text: 'No utilities on the board.' };
    }
  },
];

// Server-side deck state (per-request, not global — each action reads fresh from DB)
// The deck order is stored in game state to maintain consistency between calls
export function drawLuckyCardServer(): LuckyCard {
  const idx = secureRandom(LUCKY_CARDS.length);
  return LUCKY_CARDS[idx];
}

// ── Atomic Game Action Helper ────────────────────────────────────
// OCC-retry wrapper: read → validate → version-gated write → retry on conflict
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function atomicGameAction(
  db: SupabaseClient,
  room_code: string,
  mutator: (state: GameState, game: any) => { newState: GameState; result: Record<string, any> }
): Promise<Record<string, any>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: game, error } = await db
      .from('games').select('*')
      .eq('room_code', room_code).single();
    if (error || !game) throw new Error('Game not found');

    // Run game logic (pure function on fresh DB state)
    const { newState, result } = mutator(game.state, game);

    // Version-gated write — succeeds only if nobody else wrote since our read
    const currentVersion = game.version ?? 0;
    const { data, error: writeErr } = await db
      .from('games')
      .update({ state: newState, version: currentVersion + 1 })
      .eq('id', game.id)
      .eq('version', currentVersion)
      .select('version')
      .maybeSingle();

    if (writeErr) throw new Error(writeErr.message);
    if (data) return { ...result, version: data.version };

    console.warn(`[atomicGameAction] OCC conflict on attempt ${attempt + 1}, retrying...`);
  }
  throw new Error('Concurrency conflict after 3 retries');
}
