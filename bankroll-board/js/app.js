/* ══════════════════════════════════════════════
   BANKROLL — Board Engine v7 (Tier 3 Server-Authoritative)
   Features: Monopoly, Buildings, Scaled Rent, Trade, Prediction Market
   Win: $2,500 NW | Bankrupt: -$500
   Security: All financial mutations route through validated Edge Function actions
   ============================================== */

'use strict';

import { supabase, getUser } from './supabase.js';

let roomCode = sessionStorage.getItem('bankroll_room');
let localId = null;
// Event dedup: tracks all processed event IDs in a bounded rolling Set.
// Using a single variable (lastProcessedEventId) was the cause of the turn-replay bug:
// if a later event (LUCKY/BUY) updated the variable, the postgres_changes for an earlier
// ROLL would no longer match and would replay the dice animation.
const _seenEventIds = new Set();
function _markSeen(id) {
  _seenEventIds.add(id);
  // Cap at 40 — oldest entry is always first in insertion order
  if (_seenEventIds.size > 40) _seenEventIds.delete(_seenEventIds.values().next().value);
}
function _alreadySeen(id) { return _seenEventIds.has(id); }
let gameId = null;        // UUID primary key for Realtime filter
let gameVersion = 0;      // OCC sequence counter
let channel = null;       // Supabase Realtime channel (broadcast + postgres_changes)
let _reconnectTimer = null; // auto-reconnect timer handle

/* ── Event type constants — never use raw strings, prevents typos ──
   Keep the string VALUES identical to what is stored in the DB.
   Usage: pushSyncState({ type: EV.ROLL, ... }) */
const EV = Object.freeze({
  ROLL:           'ROLL',
  BUY:            'BUY',
  RENT:           'RENT',
  LUCKY:          'LUCKY',
  STAKING_WIN:    'STAKING_WIN',
  JAIL_TURN:      'JAIL_TURN',
  JAIL_EXIT:      'JAIL_EXIT',
  JAIL_SENT:      'JAIL_SENT',
  TRADE_PROPOSED: 'TRADE_PROPOSED',
  TRADE_COUNTERED:'TRADE_COUNTERED',
  TRADE_DONE:     'TRADE_DONE',
  TRADE_CANCEL:   'TRADE_CANCEL',
  BET:            'BET',
  BUILD:          'BUILD',
  SELL:           'SELL',
  KICK:           'KICK',
});

const IMG = 'assets/images/';

const SFX_DICE = new Audio('assets/sounds/dice.mp3');
const SFX_STEP = new Audio('assets/sounds/markerforwardsound.wav');
const SFX_COIN = new Audio('assets/sounds/coinsound.mp3');
SFX_DICE.volume = 0.6;
SFX_STEP.volume = 0.4;
SFX_COIN.volume = 0.5;

/* ── 8 Tier Colors ── */
const TIERS = {
  1: { label: 'Green',  color: '#4CAF50', darker: '#388E3C' },
  2: { label: 'Blue',   color: '#03A9F4', darker: '#0288D1' },
  3: { label: 'Gray',   color: '#78909C', darker: '#546E7A' },
  4: { label: 'Pink',   color: '#E91E63', darker: '#C2185B' },
  5: { label: 'Orange', color: '#FF9800', darker: '#E65100' },
  6: { label: 'Navy',   color: '#1565C0', darker: '#0D47A1' },
  7: { label: 'Purple', color: '#9C27B0', darker: '#7B1FA2' },
  8: { label: 'Red',    color: '#F44336', darker: '#C62828' },
};

/* ── Tier economy: rent escalation + building cost ── */
const TIER_ECONOMY = {
  1: { base: 10, mono: 20, b1: 40,  b2: 90,  b3: 180,  bCost: 50  },
  2: { base: 15, mono: 30, b1: 60,  b2: 130, b3: 260,  bCost: 60  },
  3: { base: 22, mono: 44, b1: 88,  b2: 190, b3: 380,  bCost: 75  },
  4: { base: 30, mono: 60, b1: 120, b2: 260, b3: 520,  bCost: 90  },
  5: { base: 40, mono: 80, b1: 160, b2: 350, b3: 700,  bCost: 110 },
  6: { base: 50, mono: 100,b1: 200, b2: 425, b3: 850,  bCost: 130 },
  7: { base: 60, mono: 120,b1: 240, b2: 520, b3: 1040, bCost: 145 },
  8: { base: 70, mono: 140,b1: 280, b2: 600, b3: 1200, bCost: 160 },
};

const UTIL_RENT = { 1: 20, 2: 50, 3: 90, 4: 140 };
const PLAYER_COLORS = { p1: '#E53935', p2: '#1E88E5' };

/* ── Board: 28 spaces ── */
const BOARD = [
  { id: 1,  name: 'Genesis',      type: 'corner', subtype: 'genesis' },
  { id: 2,  name: 'Lagos',        type: 'city', tier: 1, price: 90,  image: 'lagos.png?v=3' },   // T1
  { id: 3,  name: 'Nairobi',      type: 'city', tier: 1, price: 100, image: 'nairobi.png' },      // T1
  { id: 4,  name: 'Hanoi',        type: 'city', tier: 2, price: 105, image: 'hanoi.png' },        // T2
  { id: 5,  name: 'Shipping',     type: 'utility', icon: '🚢', price: 175, image: 'shipping.png' }, // UTIL
  { id: 6,  name: 'Medellín',     type: 'city', tier: 2, price: 115, image: 'medellin.png' },     // T2
  { id: 7,  name: 'Bangkok',      type: 'city', tier: 2, price: 140, image: 'bangkok.png' },      // T2
  { id: 8,  name: 'Lucky Card',   type: 'corner', subtype: 'lucky' },
  { id: 9,  name: 'Istanbul',     type: 'city', tier: 3, price: 150, image: 'istanbul.png' },     // T3
  { id: 10, name: 'São Paulo',    type: 'city', tier: 3, price: 170, image: 'saopaoulo.png' },    // T3
  { id: 11, name: 'Mumbai',       type: 'city', tier: 4, price: 185, image: 'mumbai.png' },       // T4
  { id: 12, name: 'Internet',     type: 'utility', icon: '☁️', price: 175, image: 'internet.png' }, // UTIL
  { id: 13, name: 'Seoul',        type: 'city', tier: 4, price: 210, image: 'seoul.png' },        // T4
  { id: 14, name: 'Berlin',       type: 'city', tier: 4, price: 220, image: 'berlin.png' },       // T4
  { id: 15, name: 'Staking Pool', type: 'corner', subtype: 'staking' },
  { id: 16, name: 'Toronto',      type: 'city', tier: 5, price: 240, image: 'toronto.png' },      // T5
  { id: 17, name: 'Sydney',       type: 'city', tier: 5, price: 255, image: 'sydney.png' },       // T5
  { id: 18, name: 'Zurich',       type: 'city', tier: 6, price: 280, image: 'zurich.png' },       // T6
  { id: 19, name: 'Electric',     type: 'utility', icon: '⚡', price: 175, image: 'electric.png' }, // UTIL
  { id: 20, name: 'Tokyo',        type: 'city', tier: 6, price: 300, image: 'tokyo.png' },        // T6
  { id: 21, name: 'Hong Kong',    type: 'city', tier: 6, price: 310, image: 'hongkong.png' },     // T6
  { id: 22, name: 'Jail',         type: 'corner', subtype: 'jail' },
  { id: 23, name: 'London',       type: 'city', tier: 7, price: 330, image: 'london.png' },       // T7
  { id: 24, name: 'Shanghai',     type: 'city', tier: 7, price: 350, image: 'shanghai.png' },     // T7
  { id: 25, name: 'Singapore',    type: 'city', tier: 8, price: 370, image: 'singapore.png' },    // T8
  { id: 26, name: 'Airport',      type: 'utility', icon: '✈️', price: 175, image: 'airport.png' }, // UTIL
  { id: 27, name: 'Dubai',        type: 'city', tier: 8, price: 390, image: 'dubai.png' },        // T8
  { id: 28, name: 'New York',     type: 'city', tier: 8, price: 410, image: 'newyork.png' },      // T8
];

const GRID_POS = {
  1:[8,1], 2:[7,1], 3:[6,1], 4:[5,1], 5:[4,1], 6:[3,1], 7:[2,1],
  8:[1,1], 9:[1,2], 10:[1,3], 11:[1,4], 12:[1,5], 13:[1,6], 14:[1,7],
  15:[1,8], 16:[2,8], 17:[3,8], 18:[4,8], 19:[5,8], 20:[6,8], 21:[7,8],
  22:[8,8], 23:[8,7], 24:[8,6], 25:[8,5], 26:[8,4], 27:[8,3], 28:[8,2],
};

/* ── Full Lucky Card Deck (GDD §6) ── */
const LUCKY_CARDS = [
  { name: 'The Airdrop',           text: 'Crypto airdrop! Collect $200 from the bank.', type: 'gain',
    execute(p, s) { s.players[p].balance += 200; return { amount: 200, from: 'bank', to: p }; }},
  { name: 'Seed Funding',          text: '', type: 'gain',
    execute(p, s) {
      if (s.players[p].balance < 200) { s.players[p].balance += 300; return { amount: 300, text: 'Cash < $200 — Bank grants $300!', from: 'bank', to: p }; }
      else { s.players[p].balance += 50; return { amount: 50, text: 'Cash ≥ $200 — Collect $50.', from: 'bank', to: p }; }
    }},
  { name: 'White-Hat Bounty',      text: 'Collect $100 from the richest player!', type: 'gain',
    execute(p, s) {
      const opp = p === 'p1' ? 'p2' : 'p1';
      const richest = calculateNetWorth('p1') >= calculateNetWorth('p2') ? (p === 'p1' ? opp : 'p1') : (p === 'p2' ? opp : 'p2');
      const target = richest === p ? opp : richest;
      s.players[target].balance -= 100;
      s.players[p].balance += 100;
      return { amount: 100, from: target, to: p, text: `Collected $100 from ${s.players[target].name}!` };
    }},
  { name: 'Network Congestion',    text: '', type: 'drain',
    execute(p, s) {
      let bCount = 0;
      for (const [sid, cnt] of Object.entries(s.buildings)) { if (s.owners[sid] === p) bCount += cnt; }
      const cost = bCount * 50;
      s.players[p].balance -= cost;
      s.stakingPool += cost;
      return { amount: -cost, from: p, to: 'bank', text: `Pay $50 per building (${bCount}) → $${cost} to Staking Pool!` };
    }},
  { name: 'Smart Contract Exploit', text: 'Exploited! Lose $150 to Staking Pool.', type: 'drain',
    execute(p, s) { s.players[p].balance -= 150; s.stakingPool += 150; return { amount: -150, from: p, to: 'bank' }; }},
  { name: 'Subpoena',              text: 'Go directly to Jail!', type: 'drain',
    execute(p, s) { s.players[p].jailTurns = 2; s.players[p].position = 22; return { amount: 0, text: 'Sent to Jail! No Genesis salary.', jail: true }; }},
  { name: 'Tumbler Protocol',      text: 'ALL players pay $100 to the Staking Pool!', type: 'chaos',
    execute(p, s) {
      for (const pid of ['p1','p2']) { s.players[pid].balance -= 100; s.stakingPool += 100; }
      return { amount: -100, from: 'all', to: 'bank', text: 'All players pay $100 → Staking Pool!' };
    }},
  { name: 'Ecosystem Migration',   text: 'Machine assigns you a random Utility!', type: 'chaos',
    execute(p, s) {
      const freeUtils = BOARD.filter(sp => sp.type === 'utility' && !s.owners[sp.id]);
      if (freeUtils.length > 0) {
        // Machine picks a random free utility — no player choice
        const target = freeUtils[Math.floor(Math.random() * freeUtils.length)];
        return { amount: 0, text: `Teleporting to ${target.name}!`, teleport: target };
      }
      // All utilities owned: pay rent to a random owned utility
      const ownedUtils = BOARD.filter(sp => sp.type === 'utility' && s.owners[sp.id]);
      if (ownedUtils.length > 0) {
        const util = ownedUtils[Math.floor(Math.random() * ownedUtils.length)];
        const owner = s.owners[util.id];
        const rent = 40;
        s.players[p].balance -= rent;
        s.players[owner].balance += rent;
        return { amount: -rent, from: p, to: owner, text: `All utilities owned! Paid $${rent} rent to ${s.players[owner].name}.` };
      }
      return { amount: 0, text: 'No utilities on the board.' };
    }},
];
let luckyDeck = [...Array(LUCKY_CARDS.length).keys()];
let luckyIndex = 0;
function shuffleDeck() { for (let i = luckyDeck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [luckyDeck[i], luckyDeck[j]] = [luckyDeck[j], luckyDeck[i]]; } luckyIndex = 0; }
function drawLuckyCard() { if (luckyIndex >= luckyDeck.length) shuffleDeck(); return LUCKY_CARDS[luckyDeck[luckyIndex++]]; }
shuffleDeck();

/* ── Game State ── */
let state = {
  turn: 'p1',
  phase: 'idle',
  players: {
    p1: { name: 'Player 1', balance: 1000, position: 1, tokenImg: 'redmarker.png', jailTurns: 0 },
    p2: { name: 'Player 2', balance: 1025, position: 1, tokenImg: 'bluemarker.png', jailTurns: 0 },
  },
  owners: {},
  buildings: {},
  rolling: false,
  winTarget: 2500,
  stakingPool: 0,
  gameOver: false,
  trade: { active: false, proposer: null, step: null, offerProps: [], offerCash: 0, counterProps: [], counterCash: 0, timer: null, timeLeft: 0 },
  bet: { active: false, bettor: null, betType: null, betValue: null },
  afk: { p1: 0, p2: 0 }, // consecutive AFK strike counter per player
};


/* ── DOM Refs ── */
const boardEl      = document.getElementById('board-grid');
const tooltipEl    = document.getElementById('tile-tooltip');
const overlayEl    = document.getElementById('property-overlay');
const cardEl       = overlayEl?.querySelector('.property-card');
const die1El       = document.getElementById('die-1');
let hoverTimer;


/* ══════════════════════════════════════════════
   ECONOMY HELPERS
   ============================================== */
function getTierCities(tier) { return BOARD.filter(s => s.type === 'city' && s.tier === tier); }
function hasMonopoly(playerId, tier) { return getTierCities(tier).every(s => state.owners[s.id] === playerId); }
function countOwnedUtils(playerId) { return BOARD.filter(s => s.type === 'utility' && state.owners[s.id] === playerId).length; }

function calculateRent(space) {
  if (space.type === 'utility') {
    const owner = state.owners[space.id];
    if (!owner) return 0;
    const count = countOwnedUtils(owner);
    return UTIL_RENT[count] || 20;
  }
  if (space.type !== 'city') return 0;
  const owner = state.owners[space.id];
  if (!owner) return 0;
  const eco = TIER_ECONOMY[space.tier];
  if (!eco) return 0;
  const buildings = state.buildings[space.id] || 0;
  const mono = hasMonopoly(owner, space.tier);
  if (buildings >= 3) return eco.b3;
  if (buildings === 2) return eco.b2;
  if (buildings === 1) return eco.b1;
  if (mono)  return eco.mono;
  return eco.base;
}

function getRentTable(space) {
  if (space.type === 'utility') {
    return [
      { label: 'Own 1', value: 20 }, { label: 'Own 2', value: 50 },
      { label: 'Own 3', value: 90 }, { label: 'Own 4 (Monopoly)', value: 140 },
    ];
  }
  const eco = TIER_ECONOMY[space.tier];
  if (!eco) return [];
  const tierCount = getTierCities(space.tier).length;
  return [
    { label: 'Base Rent', value: eco.base },
    { label: `Monopoly (${tierCount}/${tierCount})`, value: eco.mono },
    { label: '+1 Building', value: eco.b1 },
    { label: '+2 Buildings', value: eco.b2 },
    { label: '+3 Buildings (Max)', value: eco.b3 },
  ];
}

function calculateNetWorth(playerId) {
  let net = state.players[playerId].balance;
  for (const [sid, owner] of Object.entries(state.owners)) {
    if (owner === playerId) {
      const sp = BOARD.find(s => s.id === parseInt(sid));
      if (sp) net += sp.price;
    }
  }
  for (const [sid, count] of Object.entries(state.buildings)) {
    if (state.owners[sid] === playerId && count > 0) {
      const sp = BOARD.find(s => s.id === parseInt(sid));
      if (sp) net += (TIER_ECONOMY[sp.tier]?.bCost || 0) * count;
    }
  }
  return net;
}


/* ══════════════════════════════════════════════
   TILE CREATION
   ============================================== */
function createTile(space) {
  const [row, col] = GRID_POS[space.id];
  const tile = document.createElement('div');
  tile.dataset.spaceId = space.id;
  tile.style.gridRow = row;
  tile.style.gridColumn = col;

  if (space.type === 'corner') {
    tile.className = `tile tile--corner tile--${space.subtype}`;
    const icons = { genesis: '↑', jail: '🔒', staking: '💰', lucky: '❓' };
    const subs = { genesis: '+$200', jail: 'Pay or Stay', staking: 'Jackpot', lucky: 'Draw Card' };
    tile.innerHTML = `<span class="tile__corner-icon">${icons[space.subtype]}</span><span class="tile__name">${space.name.toUpperCase()}</span><span class="tile__corner-sub">${subs[space.subtype]}</span>`;
    return tile;
  }
  if (space.type === 'utility') {
    tile.className = 'tile tile--utility';
    tile.style.background = '#FFFFFF';
    tile.dataset.tierColor = '#FFFFFF';
    tile.innerHTML = `<div class="tile__band tile__band--util" data-original-color="#B0BEC5" style="background:#B0BEC5"><span class="tile__price">$${space.price}</span></div><div class="tile__body"><span class="tile__util-icon">${space.icon}</span><span class="tile__name tile__name--util">${space.name.toUpperCase()}</span></div>`;
    tile.addEventListener('mouseenter', () => onTileEnter(space, tile));
    tile.addEventListener('mouseleave', onTileLeave);
    tile.addEventListener('click', () => onTileClick(space));
    return tile;
  }
  tile.className = 'tile';
  const td = TIERS[space.tier];
  tile.style.background = td.color;
  tile.dataset.tierColor = td.color;
  tile.innerHTML = `<div class="tile__band" data-original-color="${td.darker}" style="background:${td.darker}"><span class="tile__price">$${space.price}</span></div><div class="tile__body"><span class="tile__name">${space.name.toUpperCase()}</span><span class="tile__buildings" id="bld-${space.id}"></span></div>`;
  tile.addEventListener('mouseenter', () => onTileEnter(space, tile));
  tile.addEventListener('mouseleave', onTileLeave);
  tile.addEventListener('click', () => onTileClick(space));
  return tile;
}

function updateBuildingIcons(spaceId) {
  const el = document.getElementById(`bld-${spaceId}`);
  if (!el) return;
  const count = state.buildings[spaceId] || 0;
  // Fix 17: use compact format instead of repeating emoji — prevents tile overflow
  el.textContent = count > 0 ? `\u00D7${count} \uD83C\uDFE0` : '';
}


/* ══════════════════════════════════════════════
   TOKENS
   ============================================== */
function placeStaticToken(playerId) {
  const player = state.players[playerId];
  document.querySelectorAll(`.tile__token[data-player="${playerId}"]`).forEach(el => el.remove());
  const tile = boardEl.querySelector(`[data-space-id="${player.position}"]`);
  if (!tile) return;
  const tok = document.createElement('img');
  tok.className = 'tile__token'; tok.dataset.player = playerId;
  tok.src = IMG + player.tokenImg; tok.alt = player.name; tok.draggable = false;
  tile.appendChild(tok);
  repositionTokensOnTile(tile);
}
function repositionTokensOnTile(tile) {
  const tokens = tile.querySelectorAll('.tile__token');
  tokens.forEach((tok, idx) => {
    tok.className = 'tile__token';
    tok.classList.add(`tile__token--count-${Math.min(tokens.length, 2)}`, `tile__token--idx-${idx}`);
  });
}
function removeStaticToken(playerId) {
  document.querySelectorAll(`.tile__token[data-player="${playerId}"]`).forEach(tok => {
    const tile = tok.parentElement; tok.remove();
    if (tile) repositionTokensOnTile(tile);
  });
}


/* ══════════════════════════════════════════════
   DICE
   ============================================== */
const PIP_POSITIONS = {
  1:[[2,2]], 2:[[1,3],[3,1]], 3:[[1,3],[2,2],[3,1]],
  4:[[1,1],[1,3],[3,1],[3,3]], 5:[[1,1],[1,3],[2,2],[3,1],[3,3]],
  6:[[1,1],[1,3],[2,1],[2,3],[3,1],[3,3]],
};
const FACE_ROTATIONS = {
  1:'rotateX(0deg) rotateY(0deg)', 2:'rotateX(0deg) rotateY(-90deg)',
  3:'rotateX(90deg) rotateY(0deg)', 4:'rotateX(-90deg) rotateY(0deg)',
  5:'rotateX(0deg) rotateY(90deg)', 6:'rotateX(0deg) rotateY(180deg)',
};
function buildDiceFaces() {
  if (!die1El) return;
  die1El.innerHTML = '';
  for (let v = 1; v <= 6; v++) {
    const face = document.createElement('div');
    face.className = `die__face die__face--${v}`;
    PIP_POSITIONS[v].forEach(([r,c]) => {
      const pip = document.createElement('div');
      pip.className = 'die__pip'; pip.style.gridRow = r; pip.style.gridColumn = c;
      face.appendChild(pip);
    });
    die1El.appendChild(face);
  }
}
// Split into spin + land for latency-hiding (spin starts instantly, server call runs concurrently)
function startDiceSpin() {
  SFX_DICE.currentTime = 0; SFX_DICE.play().catch(()=>{});
  die1El.classList.add('rolling');
}
function landDice(val) {
  return new Promise(resolve => {
    // Freeze the die at its current spinning position
    const raw = getComputedStyle(die1El).transform;
    die1El.classList.remove('rolling');
    die1El.style.transition = 'none';
    die1El.style.transform = raw; // lock at current mid-spin frame
    void die1El.offsetHeight;     // force reflow so browser commits the freeze

    // Transition FORWARD to the correct face (add 720° so it never unwinds)
    const target = FACE_ROTATIONS[val]
      .replace(/(-?\d+)deg/g, (_, n) => (parseInt(n) + 720) + 'deg');
    die1El.style.transition = 'transform 500ms cubic-bezier(.12,.85,.25,1)';
    die1El.style.transform = target;
    setTimeout(() => { die1El.style.transition = ''; resolve(); }, 520);
  });
}
// Full dice animation (used by remote playback where latency hiding isn't needed)
async function animateDice(val) {
  startDiceSpin();
  await sleep(700);
  await landDice(val);
}


/* ══════════════════════════════════════════════
   CENTER NOTIFICATIONS
   ============================================== */
const centerIdle   = document.getElementById('center-idle');
const centerEvent  = document.getElementById('center-event');
const eventText    = document.getElementById('center-event-text');
const eventImage   = document.getElementById('center-event-image');
const eventPrice   = document.getElementById('center-event-price');
const eventActions = document.getElementById('center-event-actions');

function showCenterIdle() {
  if (centerEvent) centerEvent.style.display = 'none';
  if (centerIdle) centerIdle.style.display = 'flex';
  updateStakingPoolDisplay();
}
function updateStakingPoolDisplay() {
  const el = document.getElementById('center-amount');
  if (el) el.textContent = `$${state.stakingPool}`;

  const tile = boardEl.querySelector(`[data-space-id="14"]`);
  if (tile) {
    const sub = tile.querySelector('.tile__corner-sub');
    if (sub) sub.textContent = `Pool: $${state.stakingPool}`;
  }
}
function showCenterEvent(text, imageSrc, priceText) {
  if (centerIdle) centerIdle.style.display = 'none';
  if (centerEvent) { centerEvent.style.display = 'flex'; centerEvent.style.animation = 'none'; centerEvent.offsetHeight; centerEvent.style.animation = ''; }
  if (eventText) eventText.textContent = text;
  if (eventImage) { if (imageSrc) { eventImage.src = IMG + imageSrc; eventImage.style.display = 'block'; } else { eventImage.style.display = 'none'; } }
  if (eventPrice) { if (priceText) { eventPrice.textContent = priceText; eventPrice.style.display = 'block'; } else { eventPrice.style.display = 'none'; } }
  if (eventActions) eventActions.style.display = 'none';
}
// Pending flash timer — cleared when a decision prompt takes over
let pendingFlashTimer = null;

function showCenterDecision(text, imageSrc, buttons) {
  return new Promise(resolve => {
    // Cancel any pending flash so it doesn't wipe the decision prompt
    if (pendingFlashTimer) { clearTimeout(pendingFlashTimer); pendingFlashTimer = null; }
    showCenterEvent(text, imageSrc, null);
    if (eventActions) {
      eventActions.style.display = 'flex';
      eventActions.innerHTML = buttons.map(b => `<button class="btn ${b.cls}" id="${b.id}">${b.label}</button>`).join('');
      let resolved = false;
      const unbind = () => { if (resolved) return; resolved = true; eventActions.style.display = 'none'; window.resolveActiveDecision = null; };
      window.resolveActiveDecision = () => { unbind(); resolve(buttons[buttons.length - 1].value); };
      buttons.forEach(b => { document.getElementById(b.id)?.addEventListener('click', () => { unbind(); resolve(b.value); }); });
    } else resolve(buttons[0]?.value);
  });
}
function showCenterBuyDecision(space) {
  return new Promise(resolve => {
    // Fix 3: ensure any open property overlay is hidden so it doesn't ghost behind this prompt
    if (overlayEl?.classList.contains('overlay--active')) hidePropertyCard();
    // Cancel any pending flash so it doesn't wipe the decision prompt
    if (pendingFlashTimer) { clearTimeout(pendingFlashTimer); pendingFlashTimer = null; }
    showCenterEvent(space.name, space.image, `$${space.price}`);
    if (eventActions) {
      eventActions.style.display = 'flex';
      eventActions.innerHTML = `<button class="btn btn--buy-center" id="center-buy">BUY — $${space.price}</button><button class="btn btn--pass-center" id="center-pass">PASS</button>`;
      let resolved = false;
      const unbind = () => { if (resolved) return; resolved = true; eventActions.style.display = 'none'; window.resolveActiveDecision = null; };
      window.resolveActiveDecision = () => { unbind(); resolve('pass'); };
      document.getElementById('center-buy').addEventListener('click', () => { unbind(); resolve('buy'); });
      document.getElementById('center-pass').addEventListener('click', () => { unbind(); resolve('pass'); });
    } else resolve('pass');
  });
}
// flashCenterEvent: shows notification and keeps it on screen (persistent).
// The `ms` param is used ONLY for sequencing/pacing (caller waits before continuing),
// NOT for auto-dismiss. The notification stays until the next event or roll start.
function flashCenterEvent(text, imageSrc, priceText, ms = 1200) {
  // Cancel any pending flash state (no-op since we no longer auto-dismiss)
  if (pendingFlashTimer) { clearTimeout(pendingFlashTimer); pendingFlashTimer = null; }
  showCenterEvent(text, imageSrc, priceText);
  // Wait `ms` for pacing (callers chain events sequentially) but DON'T dismiss
  return new Promise(r => { pendingFlashTimer = setTimeout(() => { pendingFlashTimer = null; r(); }, ms); });
}


/* ══════════════════════════════════════════════
   CORNER HANDLERS
   ============================================== */
async function handleCorner(space, playerId) {
  const player = state.players[playerId];

  if (space.subtype === 'lucky') {
    // Capture position BEFORE execute() — Subpoena changes player.position inside execute
    const preMovePos = player.position;
    const card = drawLuckyCard();
    const result = card.execute(playerId, state);
    const displayText = result.text || card.text;
    renderBalances(); // lucky card changed balances — no button state change

    if (result.jail) {
      // Animate token crawling to jail (position 22) instead of teleporting silently.
      // execute() already set player.position = 22 and jailTurns = 2.
      await flashCenterEvent(`${card.name}: ${displayText}`, 'luckycard.png', null, 1500);
      const jailId = 22;
      const jailSteps = ((jailId - preMovePos) + 28) % 28 || 28;
      await animateTokenAlongPath(playerId, preMovePos, jailSteps, false);
      renderBalances(); // position set, jail badge will show on next full renderHUD at turn switch
      await flashCenterEvent(`${player.name} is sent to Jail!`, 'jail.png', '\uD83D\uDD12 2 Turns', 1500);

    } else if (result.teleport) {
      // Ecosystem Migration: animate player to the randomly assigned utility
      const target = result.teleport;
      await flashCenterEvent(`${card.name}: ${displayText}`, 'luckycard.png', null, 1800);
      const steps = ((target.id - preMovePos) + 28) % 28 || 28;
      const passedGenesis = (preMovePos + steps) > 28;
      await animateTokenAlongPath(playerId, preMovePos, steps, passedGenesis);
      // FIX: update position after teleport so next roll starts from correct tile
      player.position = target.id;
      if (passedGenesis) { player.balance += 200; renderBalances(); }
      if (!state.owners[target.id]) {
        if (player.balance >= target.price) {
          resumeTurnTimer(); // only run timer during the buy decision
          const decision = await showCenterBuyDecision(target);
          stopTurnTimer();
          if (decision === 'buy') {
            player.balance -= target.price;
            state.stakingPool += Math.round(target.price * 0.3);
            state.owners[target.id] = playerId;
            updateTileOwnerBand(target.id, playerId);
            renderBalances(); // BUY deduction — no button state change before coins animate
            await animateCoins(playerId, 'bank', 3);
            const newRent = calculateRent(target);
            await flashCenterEvent(`${player.name} bought ${target.name}!`, null, `Rent: $${newRent}`, 1500);
            pushSyncState({ type: 'BUY', p: playerId, landed: target, newRent });
          } else { showCenterIdle(); }
        } else {
          await flashCenterEvent(`${player.name} can't afford ${target.name}!`, null, null, 1200);
        }
      } else if (state.owners[target.id] !== playerId) {
        const rent = calculateRent(target);
        const owner = state.owners[target.id];
        player.balance -= rent;
        state.players[owner].balance += rent;
        renderBalances(); // rent paid — both balances update, no button change
        await animateCoins(playerId, owner, 3);
        await flashCenterEvent(`${player.name} paid $${rent} rent!`, null, `-$${rent}`, 1500);
        pushSyncState({ type: 'RENT', p: playerId, owner, rent, landed: target });
      } else { showCenterIdle(); }

    } else {
      await flashCenterEvent(card.name + ': ' + displayText, 'luckycard.png', result.amount !== 0 ? `${result.amount > 0 ? '+' : ''}$${result.amount}` : null, 2500);
      if (result.amount > 0) await animateCoins(result.from, result.to, Math.min(Math.ceil(Math.abs(result.amount) / 50), 8));
      else if (result.amount < 0) await animateCoins(result.from, result.to, Math.min(Math.ceil(Math.abs(result.amount) / 50), 6));
    }
    // Broadcast lucky card draw so P2 sees notification
    pushSyncState({ type: 'LUCKY', p: playerId, cardName: card.name, cardText: displayText, amount: result.amount ?? 0 });
    checkBankruptcy(playerId);
    checkWin();
  }

  else if (space.subtype === 'staking') {
    const pool = state.stakingPool;
    if (pool <= 0) {
      await flashCenterEvent('Staking Pool is empty!', 'centralpool.png', '$0', 1500);
    } else {
      const pct = pool < 50 ? 1.0 : (0.35 + Math.random() * 0.30);
      const payout = Math.floor(pool * pct);
      const pctDisplay = Math.round(pct * 100);
      player.balance += payout;
      state.stakingPool -= payout;
      renderBalances(); // staking pool payout — balance and pool display only
      await flashCenterEvent(`${player.name} won ${pctDisplay}% of the Staking Pool!`, 'centralpool.png', `+$${payout}`, 2500);
      await animateCoins('bank', playerId, Math.min(Math.ceil(payout / 50), 10));
      // Fix 8: broadcast STAKING_WIN so P2 sees the jackpot
      pushSyncState({ type: 'STAKING_WIN', p: playerId, payout, pct: pctDisplay });
      checkWin();
    }
  }

  else if (space.subtype === 'jail') {
    // Fix 6: Landing on jail sets jailTurns only — the pay/serve decision
    // happens at the START of the jailed player's NEXT turn in onRollClick
    player.jailTurns = 2;
    renderHUD();
    await flashCenterEvent(`${player.name} is going to Jail!`, 'jail.png', '\uD83D\uDD12 2 Turns', 1800);
    pushSyncState({ type: 'JAIL_SENT', p: playerId });
    checkBankruptcy(playerId);
  }
}


/* ══════════════════════════════════════════════
   TOKEN MOVEMENT
   ============================================== */
function getTileCenter(spaceId) {
  const tile = boardEl.querySelector(`[data-space-id="${spaceId}"]`);
  if (!tile) return null;
  const rect = tile.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
function getPathIds(fromId, steps) {
  const path = [];
  let cur = fromId;
  for (let i = 0; i < steps; i++) { cur++; if (cur > 28) cur = 1; path.push(cur); }
  return path;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Track which players currently have a floating token moving
// syncBoardState skips these players to prevent ghost tokens during animation
const animatingTokens = new Set();

async function animateTokenAlongPath(playerId, fromId, steps, skipGenesisBonus = false) {
  const player = state.players[playerId];
  const path = getPathIds(fromId, steps);
  if (!path.length) return;
  // LOCK FIRST before setting destination — prevents syncBoardState placing a ghost token
  // at the destination between 'player.position = newPos' and lock acquisition
  animatingTokens.add(playerId);
  player.position = path[path.length - 1];
  removeStaticToken(playerId);
  const token = document.createElement('img');
  token.className = 'token-float'; token.src = IMG + player.tokenImg; token.draggable = false;
  document.body.appendChild(token);
  const startPos = getTileCenter(fromId);
  if (startPos) { token.style.left = startPos.x + 'px'; token.style.top = startPos.y + 'px'; }
  token.getBoundingClientRect();
  try {
    for (const spaceId of path) {
      SFX_STEP.currentTime = 0; SFX_STEP.play().catch(()=>{});
      const pos = getTileCenter(spaceId);
      if (pos) { token.style.left = pos.x + 'px'; token.style.top = pos.y + 'px'; }
      if (spaceId === 1 && !skipGenesisBonus) {
        player.balance += 200; renderBalances(); // only balance changes mid-animation
        flashCenterEvent(`${player.name} collected $200!`, null, '+$200', 1200);
        animateCoins('bank', playerId, 5);
        checkWin();
      }
      await sleep(200);
    }
    token.classList.add('token-float--bounce'); await sleep(400);
  } finally {
    // Always unlock and place static token, even if an error interrupted the animation
    token.remove();
    animatingTokens.delete(playerId);
    placeStaticToken(playerId);
  }
  return path[path.length - 1];
}


/* ══════════════════════════════════════════════
   WIN / BANKRUPT CHECKS
   ============================================== */
function checkWin() {
  if (state.gameOver) return;
  for (const pid of ['p1', 'p2']) {
    if (calculateNetWorth(pid) >= state.winTarget) {
      state.gameOver = true;
      showVictory(pid);
      return true;
    }
  }
  return false;
}

function showVictory(playerId) {
  const player = state.players[playerId];
  const overlay = document.getElementById('victory-overlay');
  if (overlay) {
    overlay.querySelector('.victory__name').textContent = player.name;
    overlay.querySelector('.victory__nw').textContent = `$${calculateNetWorth(playerId).toLocaleString()}`;
    overlay.classList.add('victory--active');
  }
}

function checkBankruptcy(playerId) {
  if (state.gameOver) return;
  const player = state.players[playerId];
  if (player.balance < -500) {
    state.gameOver = true;
    const winner = playerId === 'p1' ? 'p2' : 'p1';
    flashCenterEvent(`${player.name} went bankrupt!`, null, '💀', 2500).then(() => showVictory(winner));
    return true;
  }
  return false;
}


/* ══════════════════════════════════════════════
   TRADE SYSTEM — 2-step negotiation
   Step 1: Proposer selects props + cash → PROPOSE
   Step 2: Opponent selects counter-props + cash → CONFIRM
   Step 3: Proposer sees full deal → ACCEPT or CANCEL
   ============================================== */
function getOwnedProperties(playerId) {
  return BOARD.filter(s => (s.type === 'city' || s.type === 'utility') && state.owners[s.id] === playerId);
}

function startTradePulse(playerId) {
  const owned = getOwnedProperties(playerId);
  owned.forEach(s => {
    const tile = boardEl.querySelector(`[data-space-id="${s.id}"]`);
    if (tile) tile.classList.add('tile--pulse');
  });
}

function stopAllPulse() {
  boardEl.querySelectorAll('.tile--pulse').forEach(t => t.classList.remove('tile--pulse'));
  boardEl.querySelectorAll('.tile--selected-trade').forEach(t => t.classList.remove('tile--selected-trade'));
}

function onTradeClick() {
  if (state.gameOver || state.rolling || state.trade.active) return;
  const ap = state.turn;
  const player = state.players[ap];
  if (player.balance < 60) { flashCenterEvent("Can't afford $60 trade fee!", null, null, 1200); return; }

  player.balance -= 60;
  state.stakingPool += Math.round(60 * 0.3); // 30% of trade fee goes to staking pool
  renderHUD();
  animateCoins(ap, 'bank', 2);

  state.trade = { active: true, proposer: ap, step: 'select', offerProps: [], offerCash: 0, counterProps: [], counterCash: 0, timer: null, timeLeft: 40, timeMax: 40 };
  startTradePulse(ap);
  showTradePanel(ap, 'select');
}

function showTradePanel(playerId, step) {
  const overlay = document.getElementById('trade-overlay');
  const panel = document.getElementById('trade-panel');
  if (!overlay || !panel) return;
  overlay.classList.add('overlay--active', 'trade-overlay--active');
  const t = state.trade;

  if (step === 'select') {
    panel.innerHTML = `
      <div class="tp-header">💱 Select Properties to Offer</div>
      <div class="tp-section-label">YOUR OFFER <span class="tp-badge">$60 fee paid</span></div>
      <div class="tp-cards" id="trade-selected-list"><div class="tp-empty">Click your pulsing tiles on the board</div></div>
      <div class="tp-cash-row">
        <label>+ Cash: $</label>
        <input type="number" id="trade-cash-input" min="0" max="${state.players[playerId].balance}" value="0" class="trade-panel__cash"/>
      </div>
      <div class="tp-value-row" id="trade-offer-value">Total offer value: ~$0</div>
      <div class="tp-actions">
        <button class="btn btn--buy-center" id="trade-propose">PROPOSE →</button>
        <button class="btn btn--pass-center" id="trade-cancel">CANCEL</button>
      </div>
      ${_timerBarHtml()}
    `;
    document.getElementById('trade-propose')?.addEventListener('click', onTradePropose);
    document.getElementById('trade-cancel')?.addEventListener('click', cancelTrade);
    document.getElementById('trade-cash-input')?.addEventListener('input', _refreshSelectPreview);
    startTradeTimer(40);
  }
  else if (step === 'waiting') {
    const opp = playerId === 'p1' ? 'p2' : 'p1';
    const offerCards = t.offerProps.map(id => _buildTradeCard(id)).join('');
    panel.innerHTML = `
      <div class="tp-header">⏳ Awaiting Counter-Offer</div>
      <div class="tp-section-label">YOU OFFERED</div>
      <div class="tp-cards">${offerCards || '<div class="tp-empty">Cash only</div>'}</div>
      ${t.offerCash > 0 ? `<div class="tp-cash-chip">+ $${t.offerCash} cash</div>` : ''}
      <div class="tp-waiting-msg">Waiting for <strong>${state.players[opp].name}</strong> to respond…</div>
      <div class="tp-actions">
        <button class="btn btn--pass-center" id="trade-cancel">CANCEL TRADE</button>
      </div>
      ${_timerBarHtml()}
    `;
    document.getElementById('trade-cancel')?.addEventListener('click', cancelTrade);
    // Timer already running from select step — just patch the target element IDs by
    // overwriting the interval (startTradeTimer calls clearInterval first so it's safe)
    startTradeTimer(t.timeMax || 40);
  }
  else if (step === 'counter') {
    const opp = playerId === 'p1' ? 'p2' : 'p1';
    const offerCards = t.offerProps.map(id => _buildTradeCard(id)).join('');
    const incomingVal = _tradePortfolioValue(t.offerProps, t.offerCash);
    panel.innerHTML = `
      <div class="tp-header">📨 Offer from ${state.players[t.proposer].name}</div>
      <div class="tp-section-label">THEY OFFER YOU</div>
      <div class="tp-cards">${offerCards || '<div class="tp-empty">Cash only</div>'}</div>
      ${t.offerCash > 0 ? `<div class="tp-cash-chip tp-cash-chip--in">+ $${t.offerCash} cash</div>` : ''}
      <div class="tp-value-row">Incoming value: <strong>~$${incomingVal}</strong></div>
      <div class="tp-divider"></div>
      <div class="tp-section-label">YOUR COUNTER <span class="tp-hint">(click pulsing tiles)</span></div>
      <div class="tp-cards" id="trade-selected-list"><div class="tp-empty">Nothing selected yet</div></div>
      <div class="tp-cash-row">
        <label>+ Cash: $</label>
        <input type="number" id="trade-cash-input" min="0" max="${state.players[opp].balance}" value="0" class="trade-panel__cash"/>
      </div>
      <div class="tp-value-row" id="trade-counter-value">Counter value: ~$0</div>
      <div class="tp-net-row" id="trade-net-row">Net for you: <strong style="color:#4CAF50">+$${incomingVal}</strong> ✓</div>
      <div class="tp-actions">
        <button class="btn btn--buy-center" id="trade-confirm">CONFIRM COUNTER</button>
        <button class="btn btn--pass-center" id="trade-cancel">PASS</button>
      </div>
      ${_timerBarHtml()}
    `;
    document.getElementById('trade-confirm')?.addEventListener('click', onTradeConfirm);
    document.getElementById('trade-cancel')?.addEventListener('click', cancelTrade);
    document.getElementById('trade-cash-input')?.addEventListener('input', () => _refreshCounterPreview(incomingVal));
    startTradeTimer(t.timeLeft || 40);
  }
  else if (step === 'review') {
    const opp = t.proposer === 'p1' ? 'p2' : 'p1';
    const offerCards = t.offerProps.map(id => _buildTradeCard(id)).join('');
    const counterCards = t.counterProps.map(id => _buildTradeCard(id)).join('');
    const giveVal = _tradePortfolioValue(t.offerProps, t.offerCash);
    const getVal  = _tradePortfolioValue(t.counterProps, t.counterCash);
    const netForProposer = getVal - giveVal;
    const netColor = netForProposer >= 0 ? '#4CAF50' : '#F44336';
    const netLabel = netForProposer >= 0 ? `+$${netForProposer}` : `-$${Math.abs(netForProposer)}`;
    const isProposer = (localId === t.proposer);
    panel.innerHTML = `
      <div class="tp-header">📋 Final Deal — Review</div>
      <div class="tp-review-cols">
        <div class="tp-review-col">
          <div class="tp-section-label tp-give">YOU GIVE</div>
          <div class="tp-cards">${offerCards || '<div class="tp-empty">Nothing</div>'}</div>
          ${t.offerCash > 0 ? `<div class="tp-cash-chip tp-cash-chip--out">+ $${t.offerCash}</div>` : ''}
          <div class="tp-col-total">~$${giveVal}</div>
        </div>
        <div class="tp-review-arrow">⇄</div>
        <div class="tp-review-col">
          <div class="tp-section-label tp-get">YOU GET</div>
          <div class="tp-cards">${counterCards || '<div class="tp-empty">Nothing</div>'}</div>
          ${t.counterCash > 0 ? `<div class="tp-cash-chip tp-cash-chip--in">+ $${t.counterCash}</div>` : ''}
          <div class="tp-col-total">~$${getVal}</div>
        </div>
      </div>
      <div class="tp-net-large" style="color:${netColor}">
        NET: <strong>${netLabel}</strong> ${netForProposer >= 0 ? '✓ Good deal' : '⚠ You lose value'}
      </div>
      <div class="tp-actions">
        ${isProposer
          ? `<button class="btn btn--accept-trade" id="trade-accept">ACCEPT ✔</button>
             <button class="btn btn--pass-center" id="trade-cancel">CANCEL ✘</button>`
          : `<div class="tp-waiting-msg">Waiting for <strong>${state.players[t.proposer].name}</strong> to accept or cancel…</div>`
        }
      </div>
      ${isProposer ? _timerBarHtml() : ''}
    `;
    document.getElementById('trade-accept')?.addEventListener('click', executeTrade);
    document.getElementById('trade-cancel')?.addEventListener('click', cancelTrade);
    // ONLY proposer (P1) gets a review timer — P2 already confirmed, no timer needed
    if (isProposer) startTradeTimer(t.timeLeft || 30);
  }
}
// (old showTradePanel body removed — new version is above)


function updateTradeSelectedList(props) {
  const el = document.getElementById('trade-selected-list');
  if (!el) return;
  if (props.length === 0) {
    el.innerHTML = '<div class="tp-empty">Click your pulsing tiles on the board</div>';
  } else {
    el.innerHTML = props.map(id => _buildTradeCard(id)).join('');
  }
  // Refresh live value labels
  if (state.trade.step === 'select') _refreshSelectPreview();
  if (state.trade.step === 'counter') {
    _refreshCounterPreview(_tradePortfolioValue(state.trade.offerProps, state.trade.offerCash));
  }
}

function onTradePropose() {
  const t = state.trade;
  const cashInput = document.getElementById('trade-cash-input');
  t.offerCash = parseInt(cashInput?.value) || 0;
  if (t.offerProps.length === 0 && t.offerCash === 0) { return; }
  stopAllPulse();
  t.step = 'waiting';
  const opp = t.proposer === 'p1' ? 'p2' : 'p1';
  // P1 (proposer) sees a waiting screen — NOT the counter panel (which is P2's job)
  showTradePanel(t.proposer, 'waiting');
  // Broadcast TRADE_PROPOSED so P2's client opens the counter panel.
  // Include timeLeft so P2 inherits the same remaining time (not a fresh 40s).
  pushSyncState({
    type: 'TRADE_PROPOSED',
    proposer: t.proposer,
    offerProps: t.offerProps,
    offerCash: t.offerCash,
    timeLeft: t.timeLeft
  });
}

function onTradeConfirm() {
  const t = state.trade;
  const cashInput = document.getElementById('trade-cash-input');
  t.counterCash = parseInt(cashInput?.value) || 0;
  stopAllPulse();
  // FIX: Kill the existing P2 counter-step timer BEFORE switching to review step.
  // Without this, P2's old timer keeps running alongside the new review timer on P1,
  // causing the first-to-expire to fire cancelTrade() mid-animation.
  clearInterval(t.timer);
  t.timer = null;
  t.step = 'review';
  // P2 sees a static confirmation — NO timer started here (P2 already confirmed)
  showTradePanel(t.proposer === 'p1' ? 'p2' : 'p1', 'review');
  // Broadcast TRADE_COUNTERED so P1 opens the review panel with a fresh 30s timer.
  pushSyncState({
    type: 'TRADE_COUNTERED',
    proposer: t.proposer,
    offerProps: t.offerProps,
    offerCash: t.offerCash,
    counterProps: t.counterProps,
    counterCash: t.counterCash,
    timeLeft: 30 // P1 always gets fresh 30s to review — not the dwindling counter window
  });
}

async function executeTrade() {
  // FIX: One-shot guard — prevents double-fire if timer races the ACCEPT button click
  if (!state.trade.active) return;
  // Snapshot the trade object before closeTrade() resets state.trade to defaults.
  // This means no timer can fire cancelTrade() during the coin animations below.
  const snap = {
    proposer:     state.trade.proposer,
    offerProps:   [...state.trade.offerProps],
    counterProps: [...state.trade.counterProps],
    offerCash:    state.trade.offerCash,
    counterCash:  state.trade.counterCash,
  };
  // Kill all timers and close overlay IMMEDIATELY — prevents any race with cancelTrade
  closeTrade();

  const opp = snap.proposer === 'p1' ? 'p2' : 'p1';

  // Apply ownership swaps
  snap.offerProps.forEach(sid => { state.owners[sid] = opp; updateTileOwnerBand(sid, opp); });
  snap.counterProps.forEach(sid => { state.owners[sid] = snap.proposer; updateTileOwnerBand(sid, snap.proposer); });

  // Apply cash swaps
  if (snap.offerCash > 0) { state.players[snap.proposer].balance -= snap.offerCash; state.players[opp].balance += snap.offerCash; }
  if (snap.counterCash > 0) { state.players[opp].balance -= snap.counterCash; state.players[snap.proposer].balance += snap.counterCash; }

  renderHUD();

  // Heartbeat animation on traded tiles
  const allTraded = [...snap.offerProps, ...snap.counterProps];
  allTraded.forEach(sid => {
    const tile = boardEl.querySelector(`[data-space-id="${sid}"]`);
    if (tile) { tile.classList.add('tile--heartbeat'); setTimeout(() => tile.classList.remove('tile--heartbeat'), 1200); }
  });

  if (snap.offerCash > 0) await animateCoins(snap.proposer, opp, Math.min(Math.ceil(snap.offerCash / 80), 5));
  if (snap.counterCash > 0) await animateCoins(opp, snap.proposer, Math.min(Math.ceil(snap.counterCash / 80), 5));

  await flashCenterEvent('🤝 Trade completed!', null, '✅', 1500);

  // Broadcast event so P2 animates the result
  pushSyncState({
    type: 'TRADE_EXECUTED',
    proposer: snap.proposer,
    offerProps: snap.offerProps,
    counterProps: snap.counterProps,
    offerCash: snap.offerCash,
    counterCash: snap.counterCash
  });

  checkWin();
}

function cancelTrade() {
  // Guard: both players' timers can expire simultaneously — second call must be a no-op
  if (!state.trade.active) return;
  pushSyncState({ type: 'TRADE_CANCELLED' });
  flashCenterEvent('Trade cancelled.', null, null, 800);
  closeTrade();
}

function closeTrade() {
  clearInterval(state.trade.timer);
  state.trade = { active: false, proposer: null, step: null, offerProps: [], offerCash: 0, counterProps: [], counterCash: 0, timer: null, timeLeft: 0 };
  stopAllPulse();
  const overlay = document.getElementById('trade-overlay');
  if (overlay) overlay.classList.remove('overlay--active', 'trade-overlay--active');
  renderHUD();
}

function startTradeTimer(maxTime) {
  clearInterval(state.trade.timer);
  if (maxTime !== undefined) {
    state.trade.timeLeft = maxTime; // reset to provided max
    state.trade.timeMax  = maxTime;
  }
  const tMax = state.trade.timeMax || 40;
  state.trade.timer = setInterval(() => {
    state.trade.timeLeft--;
    // Update countdown text (new panel uses trade-timer-val, fallback to old trade-timer)
    const valEl = document.getElementById('trade-timer-val') || document.getElementById('trade-timer');
    if (valEl) valEl.textContent = state.trade.timeLeft;
    // Update progress bar color + width
    const bar = document.getElementById('trade-timer-bar');
    if (bar) {
      const pct = Math.max(0, Math.round((state.trade.timeLeft / tMax) * 100));
      bar.style.width = `${pct}%`;
      bar.style.background = pct > 50 ? '#4CAF50' : pct > 25 ? '#FF9800' : '#F44336';
    }
    if (state.trade.timeLeft <= 0) { cancelTrade(); }
  }, 1000);
}


/* ══════════════════════════════════════════════
   PREDICTION MARKET
   ============================================== */
function getReachableSpaces(fromPos) {
  const spaces = [];
  for (let i = 1; i <= 6; i++) {
    let pos = fromPos + i;
    if (pos > 28) pos -= 28;
    spaces.push(BOARD.find(s => s.id === pos));
  }
  return spaces;
}

function getReachableTiers(fromPos) {
  const reachable = getReachableSpaces(fromPos);
  const tierCounts = {};
  reachable.forEach(s => {
    if (s && s.type === 'city') {
      tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1;
    }
  });
  return tierCounts;
}

function showBettingPanel(bettorId) {
  if (bettorId !== localId) return; // Only show on the actual bettor's screen

  const panel = document.getElementById('betting-panel');
  if (!panel) return;
  const opponent = bettorId === 'p1' ? 'p2' : 'p1';
  const bettor = state.players[bettorId];

  if (bettor.balance < 150) { panel.style.display = 'none'; return; }
  if (state.bet.active) { panel.style.display = 'none'; return; } // already have an active bet

  const reachable = getReachableSpaces(state.players[opponent].position);
  const options = [...reachable].sort(() => 0.5 - Math.random()).slice(0, 2);

  let betsHtml = '';
  options.forEach(space => {
    let icon = space.type === 'city' ? '\uD83C\uDFD9\uFE0F' : space.type === 'utility' ? space.icon : '\uD83C\uDFAF';
    let colorLeft = space.type === 'city' ? TIERS[space.tier].color : '#78909C';
    betsHtml += `<button class="bet-btn" data-bet-type="space" data-bet-value="${space.id}" style="border-left:4px solid ${colorLeft}">
      ${icon} ${space.name} <span class="bet-btn__prob">WIN $300</span></button>`;
  });

  if (bettorId === 'p1') {
    panel.style.left = '16px'; panel.style.right = 'auto'; panel.style.bottom = '170px';
  } else {
    panel.style.right = '16px'; panel.style.left = 'auto'; panel.style.bottom = '170px';
  }

  panel.innerHTML = `
    <div class="bet-panel__header">\uD83C\uDFAF PREDICT ${state.players[opponent].name.toUpperCase()}'S ROLL</div>
    <div class="bet-panel__cost">Cost: $150 | Win: $300</div>
    <div class="bet-panel__options">${betsHtml}</div>
  `;
  panel.style.display = 'block';

  panel.querySelectorAll('.bet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.bet.active) return;
      const type = btn.dataset.betType;
      const value = btn.dataset.betValue;
      bettor.balance -= 150;
      state.bet = { active: true, bettor: bettorId, betType: type, betValue: value };
      renderHUD();
      const targetSpace = BOARD.find(s => String(s.id) === value);
      panel.innerHTML = `<div class="bet-panel__header">\uD83C\uDFAF Bet placed: ${targetSpace ? targetSpace.name : value}</div><div class="bet-panel__cost">Waiting for dice roll...</div>`;
      // Coin animation for the bettor
      animateCoins(bettorId, 'bank', 3);
      // Notify opponent via broadcast (fast path)
      pushSyncState({ type: 'BET_PLACED', bettor: bettorId, betType: type, betValue: value, spaceName: targetSpace ? targetSpace.name : value });
    });
  });
}

function hideBettingPanel() {
  const panel = document.getElementById('betting-panel');
  if (panel) panel.style.display = 'none';
}

async function resolveBet(diceVal, landedSpace) {
  if (!state.bet.active) return;
  const b = state.bet;
  const bettor = state.players[b.bettor];

  // Corner landing = auto-lose — clear bet state so it never lingers
  if (!landedSpace || landedSpace.type === 'corner') {
    const poolShare = Math.round(150 * 0.3);
    state.stakingPool += poolShare;
    renderHUD();
    await flashCenterEvent(`${bettor.name} bet missed (corner)! $${poolShare} \u2192 Pool`, null, '-$150', 1200);
    state.bet = { active: false, bettor: null, betType: null, betValue: null };
    return;
  }

  let won = false;
  if (b.betType === 'space' && String(landedSpace.id) === String(b.betValue)) won = true;

  if (won) {
    const payout = 300;
    bettor.balance += payout;
    renderHUD();
    await flashCenterEvent(`${bettor.name} won the prediction bet!`, null, `+$${payout}`, 1500);
    await animateCoins('bank', b.bettor, 6);
  } else {
    const poolShare = Math.round(150 * 0.3); // 30% to pool, 70% removed (intentional economy burn)
    state.stakingPool += poolShare;
    renderHUD();
    await flashCenterEvent(`${bettor.name} lost the bet. $${poolShare} \u2192 Pool`, null, '-$150', 1200);
  }

  state.bet = { active: false, bettor: null, betType: null, betValue: null };
}


/* ══════════════════════════════════════════════
   MAIN ROLL
   ══════════════════════════════════════════════ */
async function onRollClick() {
  if (state.rolling || state.gameOver || state.trade.active) return;
  if (state.turn !== localId) return;
  state.rolling = true;
  stopTurnTimer();
  hideBettingPanel();
  showCenterIdle();

  const ap = state.turn;
  const player = state.players[ap];

  // HOIST finalEvent BEFORE try — declaring inside try makes it out-of-scope at
  // switchTurn(finalEvent). That single scoping bug caused every "turn stuck" report.
  let finalEvent = null;

  try {
    /* ── JAIL PATH ───────────────────────────────────────────────── */
    if (player.jailTurns > 0) {
      if (player.jailTurns === 2) {
        // FIRST jail turn: show the pay-or-serve decision exactly once.
        // jailTurns=2 means player arrived in jail on their previous turn.
        broadcastEvent({ type: 'JAIL_TURN', p: ap, turnsLeft: 2 }); // notify P2 (no DB write yet)
        resumeTurnTimer(); // allow AFK auto-resolve
        const decision = await showCenterDecision(
          '\uD83D\uDD12 You are in Jail! Pay $150 to escape now, or serve (next turn auto-skipped).',
          'jail.png',
          [
            { id: 'jail-pay', label: 'PAY $150 \u2014 EXIT NOW', cls: 'btn--buy-center', value: 'pay' },
            { id: 'jail-stay', label: 'SERVE SENTENCE', cls: 'btn--pass-center', value: 'stay' }
          ]
        );
        stopTurnTimer();
        if (decision === 'pay' && player.balance >= 150) {
          player.balance -= 150;
          state.stakingPool += Math.round(150 * 0.3);
          player.jailTurns = 0;
          renderHUD();
          await animateCoins(ap, 'bank', 3);
          await flashCenterEvent(`${player.name} paid $150 and is free!`, 'jail.png', '-$150', 1500);
          pushSyncState({ type: 'JAIL_EXIT', p: ap });
        } else {
          // Chose to serve or couldn't afford — next turn auto-skipped, no decision shown
          player.jailTurns = 1;
          serverAction('jail_serve'); // persist jailTurns 2→1 server-side
          broadcastEvent({ type: 'JAIL_SERVE', p: ap, turnsLeft: 1 });
          await flashCenterEvent(
            `${player.name} chose to serve. Next turn will be auto-skipped.`,
            'jail.png', '\uD83D\uDD12', 1500
          );
        }
      } else {
        // jailTurns === 1: MANDATORY AUTO-SKIP — no prompt, just notify and move on
        player.jailTurns = 0;
        serverAction('jail_serve'); // persist jailTurns 1→0 server-side
        broadcastEvent({ type: 'JAIL_TURN', p: ap, turnsLeft: 0 });
        await flashCenterEvent(
          `${player.name}'s jail sentence served \u2014 turn auto-skipped!`,
          'jail.png', '\uD83D\uDD13 Released', 1800
        );
      }
      switchTurn(null);
      return; // finally fires → state.rolling = false
    }

    /* ── NORMAL PATH (Tier 2: Instant Spin, Server Confirm) ────────── */
    // Dice spins immediately (0ms delay). Edge Function generates the dice value
    // concurrently — the 700ms spin animation hides the server round-trip latency.
    const oldPos = player.position;
    const rollEventId = crypto.randomUUID();
    _markSeen(rollEventId); // pre-mark so postgres_changes never replays our own roll

    // Phase 1: Start spin instantly — user sees immediate feedback
    startDiceSpin();
    const spinWait = sleep(700); // minimum spin duration (runs concurrently)

    // Phase 2: Ask server for dice value (crypto.getRandomValues — unhackable)
    let d1, newPos, passedGenesis, edgeFnWroteToDb = false;
    try {
      const rollRes = await supabase.functions.invoke('game_action', {
        body: { action: 'roll', room_code: roomCode, event_id: rollEventId }
      });
      if (rollRes.error || !rollRes.data?.ok) throw new Error(rollRes.data?.error || 'roll failed');
      d1            = rollRes.data.dice;
      newPos        = rollRes.data.newPos;
      passedGenesis = rollRes.data.passedGenesis;
      player.position = newPos;
      if (passedGenesis) player.balance += 200;
      edgeFnWroteToDb = true;
    } catch (_rollErr) {
      // Graceful fallback: local dice only if Edge Fn is unreachable (dev/offline)
      console.warn('[roll] Edge Fn unavailable, falling back to local dice:', _rollErr);
      d1            = Math.ceil(Math.random() * 6);
      newPos        = oldPos + d1 > 28 ? oldPos + d1 - 28 : oldPos + d1;
      passedGenesis = (oldPos + d1) > 28;
      player.position = newPos;
      if (passedGenesis) player.balance += 200;
    }

    // Wait for minimum spin — may already be done if server took >700ms
    await spinWait;

    // Phase 3: Land the dice on the server's (or fallback) value
    await landDice(d1);
    animatingTokens.add(ap);

    // Broadcast to P2 (skip state_sync if Edge Fn already persisted to DB)
    pushSyncState({ id: rollEventId, type: 'ROLL', dice: d1, oldPos, newPos, p: ap, passedGenesis }, edgeFnWroteToDb);
    await animateTokenAlongPath(ap, oldPos, d1, true);
    if (passedGenesis) {
      renderHUD();
      await flashCenterEvent(`${player.name} collected $200!`, null, '+$200', 1200);
      animateCoins('bank', ap, 5);
      checkWin();
    } else {
      renderHUD();
    }

    if (state.afk) state.afk[ap] = 0;

    const landed = BOARD.find(s => s.id === newPos);

    /* ── CORNER ──────────────────────────────────────────────────── */
    // NOTE: no resumeTurnTimer here — corner animations are automatic (no player decision).
    // handleCorner itself calls resumeTurnTimer/stopTurnTimer only when a buy decision is shown.
    if (landed?.type === 'corner') { await handleCorner(landed, ap); }

    /* ── PROPERTY ────────────────────────────────────────────────── */
    if (landed && (landed.type === 'city' || landed.type === 'utility')) {
      if (!state.owners[landed.id]) {
        if (player.balance >= 0 && player.balance >= landed.price) {
          // Timer only runs during the buy/pass decision — not during animations or rent payments
          resumeTurnTimer();
          const decision = await showCenterBuyDecision(landed);
          stopTurnTimer();
          if (decision === 'buy') {
            player.balance -= landed.price;
            state.stakingPool += Math.round(landed.price * 0.3);
            state.owners[landed.id] = ap;
            updateTileOwnerBand(landed.id, ap);
            renderBalances(); // BUY deduction — buttons rebuild at switchTurn, not needed here
            await animateCoins(ap, 'bank', 4);
            const newRent = calculateRent(landed);
            await flashCenterEvent(`${player.name} bought ${landed.name}!`, landed.image, `Rent: $${newRent}`, 1800);
            if (landed.type === 'city' && hasMonopoly(ap, landed.tier)) {
              await flashCenterEvent('\uD83C\uDFC6 MONOPOLY SECURED!', null, 'Rent doubled! You can build!', 2000);
            }
            checkWin();
            finalEvent = { type: 'BUY', p: ap, landed, newRent };
          } else { showCenterIdle(); }
        } else if (player.balance < 0) {
          await flashCenterEvent(`${player.name} is in debt \u2014 can't buy!`, null, null, 1200);
        } else {
          await flashCenterEvent(`${player.name} can't afford ${landed.name}!`, null, `$${landed.price}`, 1500);
        }
      } else if (state.owners[landed.id] !== ap) {
        const rentOwed = calculateRent(landed);
        const owner = state.owners[landed.id];
        player.balance -= rentOwed;
        state.players[owner].balance += rentOwed;
        renderBalances(); // RENT paid — both balances change, buttons unchanged until switchTurn
        await animateCoins(ap, owner, Math.min(Math.ceil(rentOwed / 40), 8));
        await flashCenterEvent(`${player.name} paid $${rentOwed} rent to ${state.players[owner].name}`, null, `-$${rentOwed}`, 1500);
        checkBankruptcy(ap);
        checkWin();
        finalEvent = { type: 'RENT', p: ap, owner, rent: rentOwed, landed };
      } else { showCenterIdle(); }
    }

    // Resolve bet AFTER buy/rent so bet notification doesn't overwrite purchase/rent
    await resolveBet(d1, landed);

    // Stop landing countdown before switchTurn so it doesn't overlap next turn's timer
    stopTurnTimer();
    switchTurn(finalEvent);

  } catch (e) {
    console.error('[onRollClick] Unhandled error \u2014 recovering turn:', e);
    // Always switch turn even on error — game must never get permanently stuck
    stopTurnTimer();
    switchTurn(null);
  } finally {
    // Guaranteed reset — fires even on return/throw inside try
    state.rolling = false;
  }
}


/* ══════════════════════════════════════════════
   TOOLTIP
   ============================================== */
function onTileEnter(space, tileEl) {
  if (state.rolling || state.trade.active) return;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => showTooltip(space, tileEl), 150);
}
function onTileLeave() { clearTimeout(hoverTimer); hideTooltip(); }
function showTooltip(space, tileEl) {
  if (!tooltipEl) return;
  tooltipEl.querySelector('.tooltip__accent').style.background = space.type === 'city' ? TIERS[space.tier].color : '#78909C';
  tooltipEl.querySelector('.tooltip__name').textContent = space.name;
  tooltipEl.querySelector('.tooltip__tier').textContent = space.type === 'city' ? `Tier ${space.tier} — ${TIERS[space.tier].label}` : 'Utility';
  const rent = calculateRent(space);
  tooltipEl.querySelector('.tooltip__price').textContent = space.price ? `$${space.price}` : '';
  tooltipEl.querySelector('.tooltip__rent').textContent = rent ? `Rent: $${rent}` : '';
  const ownerKey = state.owners[space.id];
  const bldgs = state.buildings[space.id] || 0;
  tooltipEl.querySelector('.tooltip__owner').textContent = ownerKey ? `Owner: ${state.players[ownerKey]?.name}${bldgs > 0 ? ` (${bldgs} bldg)` : ''}` : 'Unowned';
  const rect = tileEl.getBoundingClientRect();
  let left = rect.right + 10, top = rect.top;
  if (left + 230 > window.innerWidth) left = rect.left - 232;
  if (top + 200 > window.innerHeight) top = window.innerHeight - 210;
  if (top < 50) top = 50;
  tooltipEl.style.left = left + 'px'; tooltipEl.style.top = top + 'px';
  tooltipEl.classList.add('tooltip--visible');
}
function hideTooltip() { tooltipEl?.classList.remove('tooltip--visible'); }


/* ══════════════════════════════════════════════
   PROPERTY CARD POPUP — with BUILD button
   ============================================== */
function onTileClick(space) {
  if (state.trade.active) { onTileClickTrade(space.id); return; }
  if (state.rolling) return;
  clearTimeout(hoverTimer); hideTooltip();
  showPropertyCard(space);
}

// Monotonically increasing counter — prevents stale rAF callbacks from an old
// showPropertyCard call overwriting content from a newer call (image race condition)
let _cardSeq = 0;

function showPropertyCard(space) {
  if (!overlayEl || !cardEl) return;
  hideTooltip();
  const mySeq = ++_cardSeq;
  // Always clear the image immediately so no old image bleeds through
  cardEl.querySelector('.property-card__image').src = '';
  // If overlay is already open, hide it first and wait 2 paint frames before
  // populating new data — prevents the old card content from flashing
  if (overlayEl.classList.contains('overlay--active')) {
    overlayEl.classList.remove('overlay--active');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (mySeq !== _cardSeq) return; // A newer showPropertyCard was called — skip
      _populateAndShowCard(space);
    }));
    return;
  }
  if (mySeq !== _cardSeq) return; // Discarded by a newer call
  _populateAndShowCard(space);
}

function _populateAndShowCard(space) {
  cardEl.querySelector('.property-card__image').src = IMG + space.image;
  const ownerKey = state.owners[space.id];
  const color = ownerKey ? PLAYER_COLORS[ownerKey] : space.type === 'city' ? TIERS[space.tier].color : '#78909C';
  cardEl.querySelector('.property-card__hero').style.borderTop = `3px solid ${color}`;
  cardEl.querySelector('.property-card__name').textContent = space.name;
  cardEl.querySelector('.property-card__tier').textContent = space.type === 'city' ? `Tier ${space.tier} — ${TIERS[space.tier].label}` : 'Utility';

  // Fix 9: Show 'Current Rent' on owned tiles, 'Buy Price' on unowned
  if (ownerKey) {
    cardEl.querySelector('.property-card__price-label').textContent = 'Current Rent';
    cardEl.querySelector('.property-card__price-value').textContent = `$${calculateRent(space)}`;
  } else {
    cardEl.querySelector('.property-card__price-label').textContent = 'Buy Price';
    cardEl.querySelector('.property-card__price-value').textContent = `$${space.price}`;
  }

  const table = cardEl.querySelector('.property-card__rent-table');
  table.innerHTML = '';
  getRentTable(space).forEach((r) => {
    const row = document.createElement('div');
    row.className = 'rent-row';
    const currentRent = calculateRent(space);
    const isActive = r.value === currentRent && ownerKey;
    row.innerHTML = `<span class="rent-row__label">${r.label}</span><span class="rent-row__value ${isActive ? 'rent-row__value--active' : ''}">$${r.value}</span>`;
    table.appendChild(row);
  });

  const bldgs = state.buildings[space.id] || 0;
  cardEl.querySelector('.property-card__building-cost').textContent = space.type === 'city' ? `Buildings: ${bldgs}/3 | Cost: $${TIER_ECONOMY[space.tier]?.bCost} each` : '';

  const sellBtn = document.getElementById('btn-sell-card');
  const buyBtn = document.getElementById('btn-buy');
  const passBtn = document.getElementById('btn-pass');
  const buildBtn = document.getElementById('btn-build-card');

  const isOwnersTurn = ownerKey === state.turn;
  sellBtn && (sellBtn.style.display = isOwnersTurn ? 'block' : 'none');
  buyBtn && (buyBtn.style.display = 'none');

  // BUILD button — only if owner, their turn, has monopoly, < 3 buildings, can afford
  if (buildBtn) {
    if (isOwnersTurn && space.type === 'city' && hasMonopoly(ownerKey, space.tier) && bldgs < 3 && state.players[ownerKey].balance >= (TIER_ECONOMY[space.tier]?.bCost || 999)) {
      buildBtn.style.display = 'block';
      buildBtn.textContent = `BUILD — $${TIER_ECONOMY[space.tier].bCost}`;
    } else { buildBtn.style.display = 'none'; }
  }

  passBtn && (passBtn.textContent = 'CLOSE');

  const onPass = () => { hidePropertyCard(); cleanup(); };
  const onSell = () => {
    if (state.turn !== ownerKey) return;
    const sellPrice = Math.round(space.price * 0.8);
    state.players[state.turn].balance += sellPrice;
    const bCost = TIER_ECONOMY[space.tier]?.bCost || 0;
    const bCount = state.buildings[space.id] || 0;
    state.players[state.turn].balance += Math.round(bCost * bCount * 0.8);
    state.buildings[space.id] = 0;
    updateBuildingIcons(space.id);
    resetTileBandColor(space.id, space);
    delete state.owners[space.id];
    animateCoins('bank', state.turn, 3);
    renderHUD(); hidePropertyCard(); cleanup();
    // Fix 4: broadcast SELL so P2 sees animation + notification immediately
    pushSyncState({ type: 'SELL', p: state.turn, spaceId: space.id, salePrice: sellPrice });
  };
  const onBuild = () => {
    if (state.turn !== ownerKey) return;
    const cost = TIER_ECONOMY[space.tier]?.bCost || 0;
    if (state.players[ownerKey].balance < cost) return;
    state.players[ownerKey].balance -= cost;
    state.buildings[space.id] = (state.buildings[space.id] || 0) + 1;
    updateBuildingIcons(space.id);
    renderHUD();
    showPropertyCard(space); // Refresh card (flicker-safe via double rAF)
    // Fix 5: broadcast BUILD so P2 sees building icon immediately
    pushSyncState({ type: 'BUILD', p: ownerKey, spaceId: space.id, count: state.buildings[space.id] });
    checkWin();
  };
  function cleanup() { passBtn?.removeEventListener('click', onPass); sellBtn?.removeEventListener('click', onSell); buildBtn?.removeEventListener('click', onBuild); }
  passBtn?.addEventListener('click', onPass);
  sellBtn?.addEventListener('click', onSell);
  buildBtn?.addEventListener('click', onBuild);

  overlayEl.classList.add('overlay--active');
  overlayEl.setAttribute('aria-hidden', 'false');
}

function hidePropertyCard() {
  overlayEl?.classList.remove('overlay--active');
  overlayEl?.setAttribute('aria-hidden', 'true');
}
function setupPopupClose() {
  overlayEl?.querySelector('.overlay__backdrop')?.addEventListener('click', hidePropertyCard);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlayEl?.classList.contains('overlay--active')) hidePropertyCard(); });
}


/* ══════════════════════════════════════════════
   HUD
   ============================================== */
function renderHUD() {
  renderPlayerCard('player1-hud', state.players.p1, 'p1');
  renderPlayerCard('player2-hud', state.players.p2, 'p2');
  // Fix 14: do NOT call updateTimerUI here — the timer updates via its own setInterval.
  // Calling it here caused a full DOM rebuild on every timer tick (once per second).
  updateStakingPoolDisplay();
}

/* ── Fast balance-only updater — called from hot animation paths (RENT, BUY, staking, genesis)
   Avoids rebuilding the full player card HTML — only touches 3 text nodes.
   Use renderHUD() when button state or turn badge may also change. */
function renderBalances() {
  for (const slot of ['p1', 'p2']) {
    const player = state.players[slot];
    // Balance
    const balEl = document.querySelector(`#${slot === 'p1' ? 'player1' : 'player2'}-hud .hud-player__balance`);
    if (balEl) {
      balEl.textContent = `$${player.balance.toLocaleString()}`;
      balEl.classList.toggle('hud-player__balance--negative', player.balance < 0);
    }
    // Net Worth bar + label
    const nw = calculateNetWorth(slot);
    const nwPct = Math.min(100, Math.round((nw / state.winTarget) * 100));
    const nwColor = nwPct >= 90 ? '#E53935' : nwPct >= 75 ? '#FF9800' : nwPct >= 50 ? '#FFC107' : '#4CAF50';
    const bar = document.querySelector(`#${slot === 'p1' ? 'player1' : 'player2'}-hud .hud-player__nw-bar`);
    if (bar) { bar.style.width = `${nwPct}%`; bar.style.background = nwColor; }
    const nwLabel = document.querySelector(`#${slot === 'p1' ? 'player1' : 'player2'}-hud .hud-player__net span:last-child`);
    if (nwLabel) { nwLabel.textContent = `$${nw.toLocaleString()} / $${state.winTarget.toLocaleString()}`; nwLabel.style.color = nwColor; }
  }
  updateStakingPoolDisplay();
}

function renderPlayerCard(elId, player, playerId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const isMyTurn = state.turn === playerId;
  const isLocalClient = playerId === localId;
  const netWorth = calculateNetWorth(playerId);
  const inJail = player.jailTurns > 0;

  let actionsHtml = '';
  if (isMyTurn && isLocalClient && !state.rolling && !state.gameOver && !state.trade.active) {
    const canTrade = player.balance >= 60 && getOwnedProperties(playerId === 'p1' ? 'p2' : 'p1').length > 0;
    actionsHtml = `
      <div class="hud-player__actions">
        <button class="btn btn--primary btn--hud" id="btn-roll-${playerId}">${inJail ? 'END TURN' : '🎲 ROLL'}</button>
        <button class="btn btn--secondary btn--hud ${canTrade ? '' : 'btn--disabled'}" id="btn-trade-${playerId}" ${canTrade ? '' : 'disabled'}>💱 TRADE</button>
      </div>
    `;
  }

  const nwPct = Math.min(100, Math.round((netWorth / state.winTarget) * 100));
  const nwBarColor = nwPct >= 90 ? '#E53935' : nwPct >= 75 ? '#FF9800' : nwPct >= 50 ? '#FFC107' : '#4CAF50';

  let timerHtml = '';
  if (isMyTurn && !state.gameOver) {
    timerHtml = `
      <div class="hud-player__turn-timer-text">TURN TIME <span><span id="turn-sec-${playerId}">40</span>s</span></div>
      <div class="hud-player__turn-timer-wrap">
        <div class="hud-player__turn-timer-bar" id="turn-bar-${playerId}" style="width:100%"></div>
      </div>
    `;
  }

  el.innerHTML = `
    ${timerHtml}
    <div class="hud-player__label">
      <img class="hud-player__token-icon" src="${IMG}${player.tokenImg}" alt="${player.name}"/>
      ${player.name}
    </div>
    <div class="hud-player__balance ${player.balance < 0 ? 'hud-player__balance--negative' : ''}">$${player.balance.toLocaleString()}</div>
    <div class="hud-player__nw-bar-wrap">
      <div class="hud-player__nw-bar" style="width:${nwPct}%;background:${nwBarColor}"></div>
    </div>
    <div class="hud-player__net">
      <span>Net Worth</span>
      <span style="color:${nwBarColor};font-weight:700">$${netWorth.toLocaleString()} / $${state.winTarget.toLocaleString()}</span>
    </div>
    ${isMyTurn ? `<span class="hud-player__turn-badge">${inJail ? '🔒 In Jail' : 'Your Turn'}</span>` : ''}
    ${actionsHtml}
  `;

  document.getElementById(`btn-roll-${playerId}`)?.addEventListener('click', onRollClick);
  document.getElementById(`btn-trade-${playerId}`)?.addEventListener('click', onTradeClick);
}


/* ══════════════════════════════════════════════
   TURN SWITCHING
   ============================================== */
// switchTurn: Tier 3 — routes financial event + end_turn through validated server actions
function switchTurn(finalEvent = null) {
  if (state.gameOver) return;
  state.turn = state.turn === 'p1' ? 'p2' : 'p1';
  state.bet = { active: false, bettor: null, betType: null, betValue: null };
  // Persist financial event if present (routes to buy/rent/etc via validated action)
  if (finalEvent) {
    pushSyncState(finalEvent, true); // broadcast only — _serverPersist handles DB
    _serverPersist(Object.assign({ id: crypto.randomUUID(), p: localId }, finalEvent));
  }
  // Persist turn switch via validated end_turn (fire-and-forget, OCC-safe)
  serverAction('end_turn').catch(() => {});
  // Broadcast full state with switched turn for instant P2 rendering
  broadcastEvent({ type: 'END_TURN', player: state.turn === 'p1' ? 'p2' : 'p1', next: state.turn });
  startTurnTimer();
  renderHUD();
  hideBettingPanel();
  const waitingPlayer = state.turn === 'p1' ? 'p2' : 'p1';
  if (localId === waitingPlayer && state.players[waitingPlayer].balance >= 150 && !state.bet?.active) {
    showBettingPanel(waitingPlayer);
  }
}


/* ══════════════════════════════════════════════
   OWNERSHIP BAND
   ============================================== */
function updateTileOwnerBand(spaceId, playerId) {
  const tile = boardEl.querySelector(`[data-space-id="${spaceId}"]`);
  if (!tile) return;
  const band = tile.querySelector('.tile__band');
  if (band) band.style.background = PLAYER_COLORS[playerId];

  // Show current rent on the tile price label (replaces purchase price)
  const priceEl = tile.querySelector('.tile__price');
  const space = BOARD.find(s => s.id === spaceId);
  if (priceEl && space) {
    const rent = calculateRent(space);
    priceEl.textContent = rent > 0 ? `Rent $${rent}` : `$${space.price}`;
  }

  // Stamp ownership token on the card
  let badge = tile.querySelector('.tile__owner-badge');
  if (!badge) {
    badge = document.createElement('img');
    badge.className = 'tile__owner-badge';
    tile.appendChild(badge);
  }
  badge.src = IMG + state.players[playerId].tokenImg;
}
function resetTileBandColor(spaceId, space) {
  const tile = boardEl.querySelector(`[data-space-id="${spaceId}"]`);
  if (!tile) return;
  const band = tile.querySelector('.tile__band');
  if (band) band.style.background = space.type === 'city' ? TIERS[space.tier].darker : '#B0BEC5';
  
  // Restore original purchase price
  const priceEl = tile.querySelector('.tile__price');
  if (priceEl) priceEl.textContent = `$${space.price}`;

  const badge = tile.querySelector('.tile__owner-badge');
  if (badge) badge.remove();
}


/* ══════════════════════════════════════════════
   COIN FLY
   ============================================== */
function getHudCenter(playerId) {
  const el = document.getElementById(playerId === 'p1' ? 'player1-hud' : 'player2-hud');
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function getBoardCenter() {
  const el = document.getElementById('board-grid');
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
async function animateCoins(fromId, toId, count = 4) {
  SFX_COIN.currentTime = 0; SFX_COIN.play().catch(()=>{});
  const from = fromId === 'bank' ? getBoardCenter() : getHudCenter(fromId);
  const to = toId === 'bank' ? getBoardCenter() : getHudCenter(toId);
  const coins = [];
  for (let i = 0; i < count; i++) {
    const coin = document.createElement('div');
    coin.className = 'coin-fly'; coin.textContent = '$';
    coin.style.left = (from.x + (Math.random() - 0.5) * 30) + 'px';
    coin.style.top = (from.y + (Math.random() - 0.5) * 30) + 'px';
    document.body.appendChild(coin); coins.push(coin);
  }
  coins[0]?.getBoundingClientRect();
  coins.forEach((coin, i) => {
    setTimeout(() => {
      coin.classList.add('coin-fly--animate');
      coin.style.left = (to.x + (Math.random() - 0.5) * 20) + 'px';
      coin.style.top = (to.y + (Math.random() - 0.5) * 20) + 'px';
    }, i * 80);
  });
  await sleep(600 + count * 80 + 200);
  coins.forEach(c => c.remove());
}


/* ══════════════════════════════════════════════
   RESPONSIVE
   ============================================== */
function resizeBoard() {
  const wrapper = document.getElementById('board-wrapper');
  if (!wrapper) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min((vw - 380) / 840, (vh - 20) / 840, 1.15);
  wrapper.style.transform = `translate(-50%, -50%) scale(${scale})`;
}


/* ══════════════════════════════════════════════
   TURN TIMER
   ============================================== */
let turnTimerInterval = null;
let turnTimeLeft = 40;

function startTurnTimer() {
  clearInterval(turnTimerInterval);
  turnTimeLeft = 40;
  resumeTurnTimer();
}

function resumeTurnTimer() {
  clearInterval(turnTimerInterval);
  // Safety clamp: if counter was exhausted (e.g. AFK auto-roll fired), reset to 20
  // so the player gets a fresh window rather than immediately timing out again at 0/-1
  if (turnTimeLeft <= 0) turnTimeLeft = 20;
  updateTimerUI();
  turnTimerInterval = setInterval(() => {
    // Check BEFORE decrement — prevents displaying -1 when the interval fires at 0
    if (turnTimeLeft <= 0) {
      clearInterval(turnTimerInterval);
      handleTurnTimeout();
      return;
    }
    turnTimeLeft--;
    updateTimerUI();
    if (turnTimeLeft <= 0) {
      clearInterval(turnTimerInterval);
      handleTurnTimeout();
    }
  }, 1000);
}

function stopTurnTimer() {
  clearInterval(turnTimerInterval);
  updateTimerUI();
}

function updateTimerUI() {
  ['p1', 'p2'].forEach(p => {
    const secEl = document.getElementById(`turn-sec-${p}`);
    const barEl = document.getElementById(`turn-bar-${p}`);
    if (secEl) secEl.textContent = turnTimeLeft;
    if (barEl) {
      barEl.style.width = `${(turnTimeLeft / 40) * 100}%`;
      barEl.style.backgroundColor = turnTimeLeft <= 10 ? '#E53935' : 'var(--accent-roll)';
    }
  });
}

function handleTurnTimeout() {
  // Only the active turn player's client handles AFK — prevents dual timeout switches
  if (state.gameOver || state.turn !== localId) return;

  if (window.resolveActiveDecision) {
    // Player is mid-decision (buy/jail choice) — resolve it and move on
    window.resolveActiveDecision();
    return;
  }

  if (state.rolling) return; // already mid-animation

  // AFK strike tracking
  if (!state.afk) state.afk = { p1: 0, p2: 0 };
  state.afk[localId] = (state.afk[localId] || 0) + 1;
  const strikes = state.afk[localId];

  if (strikes >= 3) {
    // 3rd AFK: kick the AFK player — opponent wins
    state.gameOver = true;
    const winner = localId === 'p1' ? 'p2' : 'p1';
    pushSyncState({ type: 'KICK', kicked: localId });
    flashCenterEvent(`${state.players[localId].name} was kicked for inactivity!`, null, '\uD83D\uDEAB 3x AFK', 2500).then(() => {
      showVictory(winner);
    });
    return;
  }

  // Auto-roll for AFK player (strikes 1 and 2)
  // Fix 13: guard against rolling when already mid-animation
  flashCenterEvent(`${state.players[localId].name} is AFK! Auto-rolling... (${strikes}/2)`, null, '\u23F0', 800).then(() => {
    if (!state.rolling && !state.gameOver) onRollClick();
  });
}


/* ══════════════════════════════════════════════
   CHAT SYSTEM
   ============================================== */
const chatLog = [];
let chatIsOpen = false;
let chatUnreadCount = 0;

function setupChat() {
  const input = document.getElementById('chat-input');
  const btnToggle = document.getElementById('btn-chat-toggle');
  const dropdown = document.getElementById('chat-dropdown');
  const badge = document.getElementById('chat-badge');
  
  if (btnToggle) {
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      chatIsOpen = !chatIsOpen;
      if (chatIsOpen) {
        dropdown.classList.add('is-open');
        chatUnreadCount = 0;
        if(badge) badge.style.display = 'none';
        input?.focus();
        const logEl = document.getElementById('chat-log');
        if (logEl) logEl.scrollTop = logEl.scrollHeight;
      } else {
        dropdown.classList.remove('is-open');
      }
    });
  }

  // Close if clicking outside
  document.addEventListener('click', (e) => {
    if (chatIsOpen && !e.target.closest('.chat-widget')) {
      chatIsOpen = false;
      dropdown.classList.remove('is-open');
    }
  });

  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleChatSend();
  });
}

function handleChatSend() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text) return;
  
  const senderId = localId || state.turn; // fallback to turn if not joined
  pushChatMessage(senderId, text);
  input.value = '';

  // Broadcast via the shared game channel (same one the realtime listener uses)
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'chat',
      payload: { sender: senderId, text }
    }).catch(() => {});
  }
}

function pushChatMessage(senderId, text) {
  chatLog.push({ sender: senderId, text });
  
  const logEl = document.getElementById('chat-log');
  if (logEl) {
    const msgEl = document.createElement('div');
    const isMe = senderId === localId; // use localId, not turn — player can chat when it's not their turn
    msgEl.className = `chat-message chat-message--${senderId} ${isMe ? 'chat-message--right' : ''}`;
    msgEl.innerHTML = `<strong>${state.players[senderId].name}:</strong> ${text}`;
    logEl.appendChild(msgEl);
    if(chatIsOpen) logEl.scrollTop = logEl.scrollHeight;
  }
  
  if (!chatIsOpen) {
    chatUnreadCount++;
    const badge = document.getElementById('chat-badge');
    if (badge) badge.style.display = 'block';
    showChatToast(state.players[senderId].name, text, senderId);
  }
}

function showChatToast(name, text, senderId) {
  const toast = document.getElementById('chat-toast');
  if (!toast) return;
  const color = senderId === 'p1' ? '#FF5252' : '#448AFF';
  toast.innerHTML = `<strong style="color:${color}">${name}</strong>: ${text}`;
  toast.classList.add('chat-toast--visible');
  
  if (toast.timer) clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    toast.classList.remove('chat-toast--visible');
  }, 4000);
}


/* ══════════════════════════════════════════════
   MULTIPLAYER SYNC HELPERS
   ============================================== */

// FIX A + FAST PATH: Extract Domain Model fields.
// sentBy tags every push so the sender can ignore their own Realtime echo.
function getCleanSyncState() {
  return {
    turn:        state.turn,
    phase:       state.phase,
    players:     state.players,
    owners:      state.owners,
    buildings:   state.buildings,
    stakingPool: state.stakingPool,
    winTarget:   state.winTarget,
    gameOver:    state.gameOver,
    last_event:  state.last_event ?? null,
    bet:         state.bet,
    sentBy:      localId,
  };
}

// pushSyncState: FIRE-AND-FORGET — never blocks the caller.
// Fast path: Supabase Broadcast delivers the event to P2 in <200ms.
// Slow path: Validated Edge Function action persists to DB atomically (Tier 3).
// Full state is included in broadcast so P2 can immediately apply balance/ownership changes.
function pushSyncState(eventPayload = null, skipDbWrite = false) {
  if (!localId) return;

  if (eventPayload) {
    state.last_event = Object.assign({ id: crypto.randomUUID(), p: localId }, eventPayload);
    _markSeen(state.last_event.id); // mark self-generated events as seen so we never replay them
  } else {
    state.last_event = null;
  }

  // FAST PATH: Broadcast event + FULL STATE so P2 can apply changes instantly
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'game_event',
      payload: {
        ev: state.last_event,
        fullState: getCleanSyncState(),
        sentBy: localId
      }
    }).catch(() => {});
  }

  // SLOW PATH: Route to validated Edge Function action (Tier 3 — no raw state_sync for financial actions)
  if (!skipDbWrite) {
    _serverPersist(state.last_event);
  }
}

// ── Tier 3: Route events to validated Edge Function actions ──────────────
// Financial actions go through server-validated endpoints with OCC atomicity.
// Non-financial events fall back to state_sync for backward compatibility.
function _serverPersist(ev) {
  function call(action, extra = {}) {
    return supabase.functions.invoke('game_action', {
      body: { action, room_code: roomCode, ...extra }
    }).then(res => {
      if (res.data?.version) gameVersion = res.data.version;
      if (res.data?.error) {
        console.warn(`[server:${action}]`, res.data.error);
        _refetchState();
      }
      return res.data;
    }).catch(e => { console.error(`[server:${action}]`, e); });
  }
  function _refetchState() {
    supabase.from('games').select('state, version').eq('room_code', roomCode).single().then(({ data }) => {
      if (data) { gameVersion = data.version; playbackRender(data.state); }
    });
  }
  function _syncFallback() {
    call('state_sync', { new_state: getCleanSyncState(), client_version: gameVersion });
  }

  if (!ev) { _syncFallback(); return; }

  switch (ev.type) {
    case 'ROLL':      break; // Already persisted by Edge Function (skipDbWrite=true at callsite)
    case 'BUY':       call('buy', { space_id: ev.landed?.id || ev.spaceId }); break;
    case 'RENT':      call('rent', { space_id: ev.landed?.id || ev.spaceId }); break;
    case 'BUILD':     call('build', { space_id: ev.spaceId }); break;
    case 'SELL':      call('sell', { space_id: ev.spaceId }); break;
    case 'JAIL_EXIT': call('jail_pay'); break;
    case 'JAIL_TURN': call('jail_serve'); break;
    case 'BET_PLACED': call('bet', { bet_type: ev.betType || 'space', bet_value: ev.betValue }); break;
    case 'TRADE_EXECUTED':
      call('trade_execute', {
        proposer: ev.proposer, offerProps: ev.offerProps, counterProps: ev.counterProps,
        offerCash: ev.offerCash, counterCash: ev.counterCash
      }); break;
    case 'END_TURN':  call('end_turn'); break;
    // Non-deterministic or non-financial: fallback to state_sync (v2 will make these server-first)
    default:          _syncFallback(); break;
  }
}

// serverAction: Direct Edge Function call for server-first flows (lucky, staking, jail, etc.)
function serverAction(action, params = {}) {
  return supabase.functions.invoke('game_action', {
    body: { action, room_code: roomCode, ...params }
  }).then(res => {
    if (res.data?.version) gameVersion = res.data.version;
    if (res.data?.error) console.warn(`[serverAction:${action}]`, res.data.error);
    return res.data;
  }).catch(e => {
    console.error(`[serverAction:${action}]`, e);
    return null;
  });
}

// broadcastEvent: Lightweight broadcast — no DB write.
// Used after server-first actions where the server already persisted state.
function broadcastEvent(evt) {
  if (!localId) return;
  state.last_event = Object.assign({ id: crypto.randomUUID(), p: localId }, evt);
  _markSeen(state.last_event.id);
  if (channel) {
    channel.send({
      type: 'broadcast', event: 'game_event',
      payload: { ev: state.last_event, fullState: getCleanSyncState(), sentBy: localId }
    }).catch(() => {});
  }
}

// Serialized playback queue: prevents concurrent calls from racing/dropping events.
// If playbackRender is already running, we queue the latest state and drain after.
let _isPlayingBack = false;
let _playbackQueue = null;
let _playbackQueueBroadcast = false;

async function playbackRender(payloadState, { fromBroadcast = false } = {}) {
  if (_isPlayingBack) {
    _playbackQueue = payloadState;
    _playbackQueueBroadcast = fromBroadcast;
    return;
  }
  _isPlayingBack = true;
  try { await _playbackImpl(payloadState, fromBroadcast); } finally {
    _isPlayingBack = false;
    if (_playbackQueue) {
      const next = _playbackQueue;
      const nextBr = _playbackQueueBroadcast;
      _playbackQueue = null;
      _playbackQueueBroadcast = false;
      await playbackRender(next, { fromBroadcast: nextBr });
    }
  }
}

async function _playbackImpl(payloadState, fromBroadcast = false) {
  if (!payloadState) return;
  const ev = payloadState.last_event;
  const prevTurn = state.turn; // capture BEFORE merge to detect turn change
  if (ev && !_alreadySeen(ev.id)) {
    _markSeen(ev.id);

    if (ev.type === 'ROLL') {
      state.rolling = false;
      // Only animate ROLL — state merge happens after via mergeServerState
      await animateDice(ev.dice);
      await animateTokenAlongPath(ev.p, ev.oldPos, ev.dice, ev.passedGenesis);
      if (ev.passedGenesis) {
        await flashCenterEvent(`${payloadState.players?.[ev.p]?.name || 'Opponent'} collected $200!`, null, '+$200', 1200);
        animateCoins('bank', ev.p, 5);
      }
    } else if (ev.type === 'BUY') {
      // Explicitly update state.owners so syncBoardState paints correctly
      if (ev.landed?.id !== undefined && ev.p) {
        state.owners[ev.landed.id] = ev.p;
        updateTileOwnerBand(ev.landed.id, ev.p);
      }
      await animateCoins(ev.p, 'bank', 4);
      const buyerName = payloadState.players?.[ev.p]?.name || 'Opponent';
      await flashCenterEvent(`\uD83C\uDFD9\uFE0F ${buyerName} bought ${ev.landed.name}!`, null, `Rent: $${ev.newRent ?? ev.landed.price}`, 1500);
    } else if (ev.type === 'RENT') {
      await animateCoins(ev.p, ev.owner, Math.min(Math.ceil(ev.rent / 40), 8));
      const payerName = payloadState.players?.[ev.p]?.name || 'Opponent';
      await flashCenterEvent(`${payerName} paid $${ev.rent} rent to ${payloadState.players?.[ev.owner]?.name || 'opponent'}`, null, `-$${ev.rent}`, 1500);
    } else if (ev.type === 'BET_PLACED') {
      const bettorName = payloadState.players?.[ev.bettor]?.name || 'Opponent';
      await flashCenterEvent(`\uD83C\uDFAF ${bettorName} bet on ${ev.spaceName}!`, null, '-$150', 1200);
    } else if (ev.type === 'KICK') {
      const kickedName = payloadState.players?.[ev.kicked]?.name || 'Opponent';
      await flashCenterEvent(`${kickedName} was kicked for 3x AFK!`, null, '\uD83D\uDEAB', 2500);
      const winner = ev.kicked === 'p1' ? 'p2' : 'p1';
      showVictory(winner);
      return;
    } else if (ev.type === 'TRADE_PROPOSED') {
      // P2 receives this and opens the counter panel.
      // P1 already switched to 'waiting' step locally — we must not overwrite that.
      const opp = ev.proposer === 'p1' ? 'p2' : 'p1';
      if (localId === opp) {
        state.trade = {
          active: true, proposer: ev.proposer, step: 'counter',
          offerProps: ev.offerProps, offerCash: ev.offerCash,
          counterProps: [], counterCash: 0, timer: null,
          // Inherit remaining time from proposer — P2 gets same window, not a fresh 40s
          timeLeft: ev.timeLeft ?? 40
        };
        startTradePulse(opp);
        showTradePanel(opp, 'counter'); // startTradeTimer is called inside showTradePanel
      }
    } else if (ev.type === 'TRADE_COUNTERED') {
      // P1 receives this and opens the review panel.
      if (localId === ev.proposer) {
        state.trade = {
          active: true, proposer: ev.proposer, step: 'review',
          offerProps: ev.offerProps, offerCash: ev.offerCash,
          counterProps: ev.counterProps, counterCash: ev.counterCash,
          timer: null,
          // Inherit remaining time from P2's counter step
          timeLeft: ev.timeLeft ?? 40
        };
        stopAllPulse();
        showTradePanel(ev.proposer, 'review'); // startTradeTimer called inside showTradePanel
      }
    } else if (ev.type === 'TRADE_EXECUTED') {
      // FIX: Close trade FIRST to kill the remote review timer before animations start.
      // Without this, the countdown could reach 0 during coin animations and fire cancelTrade.
      closeTrade();
      const opp2 = ev.proposer === 'p1' ? 'p2' : 'p1';
      // Explicitly update state.owners + repaint bands
      ev.offerProps.forEach(sid => { state.owners[sid] = opp2; updateTileOwnerBand(sid, opp2); });
      ev.counterProps.forEach(sid => { state.owners[sid] = ev.proposer; updateTileOwnerBand(sid, ev.proposer); });
      if (ev.offerCash > 0) await animateCoins(ev.proposer, opp2, Math.min(Math.ceil(ev.offerCash / 80), 5));
      if (ev.counterCash > 0) await animateCoins(opp2, ev.proposer, Math.min(Math.ceil(ev.counterCash / 80), 5));
      await flashCenterEvent('\uD83E\uDD1D Trade completed!', null, '\u2705', 1500);
      closeTrade();
    } else if (ev.type === 'TRADE_CANCELLED') {
      await flashCenterEvent('Trade cancelled.', null, '\u274C', 800);
      closeTrade();
    } else if (ev.type === 'SELL') {
      // Explicitly remove ownership so syncBoardState resets band correctly
      const sp = BOARD.find(s => s.id === ev.spaceId);
      if (ev.spaceId !== undefined) {
        delete state.owners[ev.spaceId];
        state.buildings[ev.spaceId] = 0;
        if (sp) resetTileBandColor(ev.spaceId, sp);
      }
      const sellerName = payloadState.players?.[ev.p]?.name || 'Opponent';
      await animateCoins('bank', ev.p, 2);
      await flashCenterEvent(`${sellerName} sold ${sp?.name || 'a property'}!`, null, `+$${ev.salePrice}`, 1200);
    } else if (ev.type === 'BUILD') {
      // Fix 5: remote player sees building icon + notification
      updateBuildingIcons(ev.spaceId);
      updateTileOwnerBand(ev.spaceId, ev.p);
      const builderName = payloadState.players?.[ev.p]?.name || 'Opponent';
      const sp2 = BOARD.find(s => s.id === ev.spaceId);
      await flashCenterEvent(`\uD83C\uDFD7\uFE0F ${builderName} built on ${sp2?.name}!`, null, `\u00D7${ev.count} \uD83C\uDFE0`, 1200);
    } else if (ev.type === 'LUCKY') {
      // Fix 1: remote player sees lucky card draw notification
      const playerName = payloadState.players?.[ev.p]?.name || 'Opponent';
      const sign = ev.amount > 0 ? '+' : '';
      await flashCenterEvent(
        `\uD83C\uDCCF ${playerName} drew: ${ev.cardName}`, null,
        ev.amount !== 0 ? `${sign}$${ev.amount}` : ev.cardText, 2000
      );
    } else if (ev.type === 'STAKING_WIN') {
      // Fix 8: remote player sees jackpot win
      const name = payloadState.players?.[ev.p]?.name || 'Opponent';
      await animateCoins('bank', ev.p, Math.min(Math.ceil(ev.payout / 50), 10));
      await flashCenterEvent(`\uD83D\uDCB0 ${name} won ${ev.pct}% of the Staking Pool!`, null, `+$${ev.payout}`, 2000);
    } else if (ev.type === 'JAIL_TURN') {
      // Show opponent notification for jailed player's turn
      const pName = payloadState.players?.[ev.p]?.name || 'Opponent';
      if (ev.turnsLeft === 0) {
        // Auto-skip turn: sentence served
        await flashCenterEvent(`\uD83D\uDD13 ${pName}'s jail sentence served \u2014 turn skipped!`, 'jail.png', '\uD83D\uDD13 Released', 1800);
      } else {
        // First jail turn: player is deciding
        await flashCenterEvent(`\uD83D\uDD12 ${pName} is in Jail \u2014 deciding their fate...`, 'jail.png', '\u23ED\uFE0F', 2000);
      }
    } else if (ev.type === 'JAIL_EXIT') {
      const pName = payloadState.players?.[ev.p]?.name || 'Opponent';
      await animateCoins(ev.p, 'bank', 3);
      await flashCenterEvent(`${pName} paid $150 and escaped Jail!`, null, '-$150', 1500);
    } else if (ev.type === 'JAIL_SENT') {
      const pName = payloadState.players?.[ev.p]?.name || 'Opponent';
      await flashCenterEvent(`${pName} was sent to Jail!`, null, '\uD83D\uDD12', 1500);
    }
  }

  // Use the fromBroadcast flag passed down from the caller:
  // broadcast path → true (skip balance), postgres_changes path → false (full merge)
  mergeServerState(payloadState, fromBroadcast);

  // Restart timer only when turn changed
  if (payloadState.turn && payloadState.turn !== prevTurn) {
    startTurnTimer();
    const waitingPlayer = state.turn === 'p1' ? 'p2' : 'p1';
    if (localId === waitingPlayer && state.players[waitingPlayer].balance >= 150 && !state.bet?.active) {
      showBettingPanel(waitingPlayer);
    } else {
      hideBettingPanel();
    }
  }

  renderHUD();
  syncBoardState();
}

// fromBroadcast=true: skip balance and ownership merge (untrusted client broadcast).
// fromBroadcast=false (default): full merge — only from postgres_changes (DB-authoritative).
function mergeServerState(payloadState, fromBroadcast = false) {
  state.turn        = payloadState.turn        ?? state.turn;
  state.phase       = payloadState.phase       ?? state.phase;
  state.stakingPool = payloadState.stakingPool ?? state.stakingPool;
  state.winTarget   = payloadState.winTarget   ?? state.winTarget;
  state.gameOver    = payloadState.gameOver    ?? false;
  state.last_event  = payloadState.last_event  ?? null;
  if (payloadState.bet !== undefined) state.bet = payloadState.bet;

  if (!fromBroadcast) {
    // DB-authoritative fields — only merge from postgres_changes, never from broadcast
    state.owners    = payloadState.owners    ?? state.owners;
    state.buildings = payloadState.buildings ?? state.buildings;

    // Merge players including balance — DB is source of truth for financial data
    if (payloadState.players) {
      const TOKEN_DEFAULTS = { p1: 'redmarker.png', p2: 'bluemarker.png' };
      for (const slot of ['p1', 'p2']) {
        if (payloadState.players[slot]) {
          state.players[slot] = {
            ...state.players[slot],
            ...payloadState.players[slot],
            tokenImg: payloadState.players[slot].tokenImg
                      || state.players[slot].tokenImg
                      || TOKEN_DEFAULTS[slot],
          };
        }
      }
    }
  } else {
    // Broadcast path: merge everything EXCEPT balance (only financial field)
    // owners + buildings are display-safe — rent is validated server-side via DB state
    state.owners    = payloadState.owners    ?? state.owners;
    state.buildings = payloadState.buildings ?? state.buildings;
    if (payloadState.players) {
      for (const slot of ['p1', 'p2']) {
        if (payloadState.players[slot]) {
          // Position, jailTurns, name, tokenImg — all safe. Only balance is DB-only.
          if (payloadState.players[slot].position !== undefined)
            state.players[slot].position  = payloadState.players[slot].position;
          if (payloadState.players[slot].jailTurns !== undefined)
            state.players[slot].jailTurns = payloadState.players[slot].jailTurns;
          if (payloadState.players[slot].name)
            state.players[slot].name = payloadState.players[slot].name;
        }
      }
    }
  }

  // NEVER reset state.rolling here for the ACTIVE player — mid-roll state must be preserved.
  if (payloadState.turn && payloadState.turn !== localId) state.rolling = false;
}

function syncBoardState() {
  BOARD.forEach(space => {
    const owner = state.owners[space.id];
    if (owner) {
      updateTileOwnerBand(space.id, owner);
    } else {
      resetTileBandColor(space.id, space);
    }
  });
  ['p1', 'p2'].forEach(p => {
    if (animatingTokens.has(p)) return; // skip: float animation is in progress
    removeStaticToken(p);
    placeStaticToken(p);
  });
}

/* ══════════════════════════════════════════════
   INIT
   ============================================== */
async function init() {
  BOARD.forEach(space => boardEl.appendChild(createTile(space)));
  buildDiceFaces();
  placeStaticToken('p1'); placeStaticToken('p2');
  setupPopupClose();
  setupChat();
  resizeBoard();
  window.addEventListener('resize', resizeBoard);
  // Preload all board tile images into browser cache so property cards show instantly.
  // Use requestIdleCallback where supported; fall back to setTimeout for older browsers.
  const preload = () => BOARD.forEach(s => { if (s.image) { new Image().src = IMG + s.image; } });
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(preload, { timeout: 3000 });
  } else {
    setTimeout(preload, 500);
  }

  if (!roomCode) {
    console.warn('[init] No room code — redirecting to lobby');
    window.location.href = 'lobby.html';
    return;
  }

  const currentUser = await getUser();
  if (!currentUser) {
    console.warn('[init] Not logged in — redirecting to login');
    window.location.href = 'login.html';
    return;
  }

  const { data: gameData } = await supabase.from('games').select('*').eq('room_code', roomCode).single();
  if (!gameData) return;

  // FIX C: Store the UUID primary key for reliable Realtime filtering
  gameId = gameData.id;
  // FIX D: Load current version counter from DB
  gameVersion = gameData.version ?? 0;

  const urlSlot = new URLSearchParams(window.location.search).get('slot');
  if (urlSlot === 'p1' || urlSlot === 'p2') {
    localId = urlSlot;
  } else {
    localId = gameData.player1_id === currentUser.id ? 'p1' : (gameData.player2_id === currentUser.id ? 'p2' : null);
  }
  console.log(`[init] Joined as ${localId} | gameId: ${gameId} | version: ${gameVersion}`);

  // Initial Sync — use FIX E merge logic
  if (gameData.state) {
    await playbackRender(gameData.state);
  } else {
    // No state in DB yet — render the default local state so board isn't blank
    renderHUD();
    syncBoardState();
  }
  startTurnTimer();

  // FIX C: Filter by primary key `id` — reliable on all Supabase plans
  // Use module-scope `channel` variable so pushSyncState can call channel.send()
  channel = supabase.channel(`room:${gameId}`);
  
  // FAST PATH: game_event broadcast — instant delivery to opponent (<200ms)
  channel.on('broadcast', { event: 'game_event' }, async (payload) => {
    const { ev, fullState, sentBy } = payload.payload ?? {};
    if (sentBy === localId) return; // suppress self

    // ROLL: animate immediately, mark as processed so postgres_changes skips animation
    if (ev?.type === 'ROLL') {
      if (_alreadySeen(ev.id)) return;
      _markSeen(ev.id);
      await animateDice(ev.dice);
      await animateTokenAlongPath(ev.p, ev.oldPos, ev.dice, ev.passedGenesis);
      if (ev.passedGenesis) {
        await flashCenterEvent(`${state.players[ev.p]?.name || 'Opponent'} collected $200!`, null, '+$200', 1200);
        animateCoins('bank', ev.p, 5);
      }
      // Merge broadcast state — fromBroadcast=true: skips balance (DB-only)
      if (fullState) mergeServerState(fullState, true);
      renderHUD();
      syncBoardState();
      return;
    }

    // All other events: run via playbackRender using the full broadcast state
    // This gives instant BUY/RENT/BET/KICK feedback WITHOUT waiting for DB round-trip
    if (fullState) {
      await playbackRender(fullState, { fromBroadcast: true });
    }
  });

  // SLOW PATH: postgres_changes — arrives after Edge Function persists state (~1-5s)
  // By then broadcast already animated ROLL; this only merges state + plays BUY/RENT
  channel.on('postgres_changes', { 
    event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` 
  }, payload => {
    if (payload.new.version !== undefined) {
      gameVersion = payload.new.version;
    }
    // Self-echo suppression: we already applied this state locally
    if (payload.new.state?.sentBy === localId) {
      return;
    }
    playbackRender(payload.new.state);
  });

  channel.on('broadcast', { event: 'chat' }, payload => {
    if (payload.payload.sender !== localId) {
      pushChatMessage(payload.payload.sender, payload.payload.text);
    }
  });

  channel.subscribe((status) => {
    console.log(`[realtime] channel status: ${status}`);
    // ── Auto-reconnect — silently re-subscribes on dropped WebSocket connections.
    // Mobile users frequently lose the channel when switching WiFi↔4G or the screen sleeps.
    // Shows a non-blocking HUD badge; no page reloads, no alerts.
    const isError = status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED';
    if (isError && gameId) {
      // Show reconnecting indicator in HUD
      const badge = document.getElementById('reconnect-badge');
      if (badge) badge.style.display = 'flex';
      // Clear any existing reconnect timer before scheduling a new one
      if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
      _reconnectTimer = setTimeout(async () => {
        _reconnectTimer = null;
        console.log('[realtime] attempting reconnect...');
        try {
          await channel.unsubscribe();
        } catch (_) { /* ignore — channel may already be dead */ }
        // Re-fetch latest DB state so we don’t miss events that occurred during outage
        const { data } = await supabase.from('games').select('state, version').eq('id', gameId).single();
        if (data) {
          gameVersion = data.version ?? gameVersion;
          await playbackRender(data.state);
        }
        channel.subscribe((s2) => {
          console.log(`[realtime] reconnect status: ${s2}`);
          if (s2 === 'SUBSCRIBED') {
            const badge = document.getElementById('reconnect-badge');
            if (badge) badge.style.display = 'none';
            console.log('[realtime] ✅ reconnected successfully');
          }
        });
      }, 2000); // 2s back-off before reconnect attempt
    } else if (status === 'SUBSCRIBED') {
      // Clear badge on successful connection (initial or reconnect)
      if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
      const badge = document.getElementById('reconnect-badge');
      if (badge) badge.style.display = 'none';
    }
  });
}

// Fix 18: Clean up timers and Supabase channel on page unload — prevents memory/subscription leaks
window.addEventListener('beforeunload', () => {
  clearInterval(turnTimerInterval);
  if (state.trade?.timer) clearInterval(state.trade.timer);
  channel?.unsubscribe().catch(() => {});
});

init();
