/* ══════════════════════════════════════════════
   BANKROLL — Board Engine v6
   Features: Monopoly, Buildings, Scaled Rent, Trade, Prediction Market
   Win: $2,500 NW | Bankrupt: -$500
   ============================================== */

'use strict';

import { supabase, getUser } from './supabase.js';

let roomCode = sessionStorage.getItem('bankroll_room');
let localId = null;
let lastProcessedEventId = null;
let gameId = null;        // UUID primary key for Realtime filter
let gameVersion = 0;      // OCC sequence counter
let channel = null;       // Supabase Realtime channel (broadcast + postgres_changes)

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
  { id: 2,  name: 'Lagos',        type: 'city', tier: 1, price: 80,  image: 'lagos.png?v=3' },
  { id: 3,  name: 'Nairobi',      type: 'city', tier: 1, price: 85,  image: 'nairobi.png' },
  { id: 4,  name: 'Hanoi',        type: 'city', tier: 2, price: 90,  image: 'hanoi.png' },
  { id: 5,  name: 'Shipping',     type: 'utility', icon: '🚢', price: 150, image: 'shipping.png' },
  { id: 6,  name: 'Medellín',     type: 'city', tier: 2, price: 100, image: 'medellin.png' },
  { id: 7,  name: 'Bangkok',      type: 'city', tier: 2, price: 120, image: 'bangkok.png' },
  { id: 8,  name: 'Lucky Card',   type: 'corner', subtype: 'lucky' },
  { id: 9,  name: 'Istanbul',     type: 'city', tier: 3, price: 130, image: 'istanbul.png' },
  { id: 10, name: 'São Paulo',    type: 'city', tier: 3, price: 145, image: 'saopaoulo.png' },
  { id: 11, name: 'Mumbai',       type: 'city', tier: 4, price: 160, image: 'mumbai.png' },
  { id: 12, name: 'Internet',     type: 'utility', icon: '☁️', price: 150, image: 'internet.png' },
  { id: 13, name: 'Seoul',        type: 'city', tier: 4, price: 180, image: 'seoul.png' },
  { id: 14, name: 'Berlin',       type: 'city', tier: 4, price: 190, image: 'berlin.png' },
  { id: 15, name: 'Staking Pool', type: 'corner', subtype: 'staking' },
  { id: 16, name: 'Toronto',      type: 'city', tier: 5, price: 205, image: 'toronto.png' },
  { id: 17, name: 'Sydney',       type: 'city', tier: 5, price: 220, image: 'sydney.png' },
  { id: 18, name: 'Zurich',       type: 'city', tier: 6, price: 240, image: 'zurich.png' },
  { id: 19, name: 'Electric',     type: 'utility', icon: '⚡', price: 150, image: 'electric.png' },
  { id: 20, name: 'Tokyo',        type: 'city', tier: 6, price: 255, image: 'tokyo.png' },
  { id: 21, name: 'Hong Kong',    type: 'city', tier: 6, price: 265, image: 'hongkong.png' },
  { id: 22, name: 'Jail',         type: 'corner', subtype: 'jail' },
  { id: 23, name: 'London',       type: 'city', tier: 7, price: 280, image: 'london.png' },
  { id: 24, name: 'Shanghai',     type: 'city', tier: 7, price: 300, image: 'shanghai.png' },
  { id: 25, name: 'Singapore',    type: 'city', tier: 8, price: 315, image: 'singapore.png' },
  { id: 26, name: 'Airport',      type: 'utility', icon: '✈️', price: 150, image: 'airport.png' },
  { id: 27, name: 'Dubai',        type: 'city', tier: 8, price: 335, image: 'dubai.png' },
  { id: 28, name: 'New York',     type: 'city', tier: 8, price: 350, image: 'newyork.png' },
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
  { name: 'Ecosystem Migration',   text: 'Move to any unowned Utility and buy it!', type: 'chaos',
    execute(p, s) {
      const freeUtils = BOARD.filter(sp => sp.type === 'utility' && !s.owners[sp.id]);
      if (freeUtils.length > 0) {
        return { amount: 0, text: `Choose a free Utility to move to!`, chooseUtil: freeUtils };
      }
      return { amount: 0, text: 'All Utilities owned. Pay rent to nearest owner!', noUtil: true };
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
  phase: 'idle', // idle | rolling | trading | betting
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
  el.textContent = count > 0 ? '🏠'.repeat(count) : '';
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
function animateDice(val) {
  return new Promise(resolve => {
    SFX_DICE.currentTime = 0; SFX_DICE.play().catch(()=>{});
    die1El.classList.add('rolling');
    setTimeout(() => {
      die1El.classList.remove('rolling');
      die1El.style.transform = `rotateX(${720+Math.random()*360}deg) rotateY(${720+Math.random()*360}deg)`;
      setTimeout(() => {
        die1El.style.transition = 'transform 400ms cubic-bezier(.2,1.2,.5,1)';
        die1El.style.transform = FACE_ROTATIONS[val];
        setTimeout(() => { die1El.style.transition = ''; resolve(); }, 420);
      }, 100);
    }, 700);
  });
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
function showCenterDecision(text, imageSrc, buttons) {
  return new Promise(resolve => {
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
function flashCenterEvent(text, imageSrc, priceText, ms = 2000) {
  showCenterEvent(text, imageSrc, priceText);
  return new Promise(r => setTimeout(() => { showCenterIdle(); r(); }, ms));
}


/* ══════════════════════════════════════════════
   CORNER HANDLERS
   ============================================== */
async function handleCorner(space, playerId) {
  const player = state.players[playerId];

  if (space.subtype === 'lucky') {
    const card = drawLuckyCard();
    const result = card.execute(playerId, state);
    const displayText = result.text || card.text;
    renderHUD();
    if (result.jail) {
      removeStaticToken(playerId);
      placeStaticToken(playerId);
      await flashCenterEvent(card.name + ': ' + displayText, 'luckycard.png', null, 2500);
    } else {
      await flashCenterEvent(card.name + ': ' + displayText, 'luckycard.png', result.amount !== 0 ? `${result.amount > 0 ? '+' : ''}$${result.amount}` : null, 2500);
      if (result.amount > 0) await animateCoins(result.from, result.to, Math.min(Math.ceil(Math.abs(result.amount) / 50), 8));
      else if (result.amount < 0) await animateCoins(result.from, result.to, Math.min(Math.ceil(Math.abs(result.amount) / 50), 6));
    }
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
      renderHUD();
      await flashCenterEvent(`${player.name} won ${pctDisplay}% of the Staking Pool!`, 'centralpool.png', `+$${payout}`, 2500);
      await animateCoins('bank', playerId, Math.min(Math.ceil(payout / 50), 10));
      checkWin();
    }
  }

  else if (space.subtype === 'jail') {
    const decision = await showCenterDecision('JAIL! Pay $150 to leave or stay locked for 2 rounds.', 'jail.png', [
      { id: 'jail-pay', label: 'PAY $150', cls: 'btn--buy-center', value: 'pay' },
      { id: 'jail-stay', label: 'STAY 2 ROUNDS', cls: 'btn--pass-center', value: 'stay' },
    ]);
    if (decision === 'pay') {
      player.balance -= 150; state.stakingPool += 150; renderHUD();
      await animateCoins(playerId, 'bank', 3);
      await flashCenterEvent(`${player.name} paid $150 to escape Jail.`, 'jail.png', '-$150', 1500);
    } else {
      player.jailTurns = 2; renderHUD();
      await flashCenterEvent(`${player.name} is locked in Jail for 2 rounds!`, 'jail.png', '🔒 2 Turns', 1800);
    }
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

async function animateTokenAlongPath(playerId, fromId, steps, skipGenesisBonus = false) {
  const player = state.players[playerId];
  const path = getPathIds(fromId, steps);
  if (!path.length) return;
  player.position = path[path.length - 1];
  removeStaticToken(playerId);
  const token = document.createElement('img');
  token.className = 'token-float'; token.src = IMG + player.tokenImg; token.draggable = false;
  document.body.appendChild(token);
  const startPos = getTileCenter(fromId);
  if (startPos) { token.style.left = startPos.x + 'px'; token.style.top = startPos.y + 'px'; }
  token.getBoundingClientRect();
  for (const spaceId of path) {
    SFX_STEP.currentTime = 0; SFX_STEP.play().catch(()=>{});
    const pos = getTileCenter(spaceId);
    if (pos) { token.style.left = pos.x + 'px'; token.style.top = pos.y + 'px'; }
    
    if (spaceId === 1 && !skipGenesisBonus) {
      // Only add balance if not already handled by the caller
      player.balance += 200; renderHUD();
      flashCenterEvent(`${player.name} collected $200!`, null, '+$200', 1200);
      animateCoins('bank', playerId, 5);
      checkWin();
    }
    
    await sleep(200);
  }
  token.classList.add('token-float--bounce'); await sleep(400);
  token.remove(); placeStaticToken(playerId);
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
  state.stakingPool += 60;
  renderHUD();
  animateCoins(ap, 'bank', 2);

  state.trade = { active: true, proposer: ap, step: 'select', offerProps: [], offerCash: 0, counterProps: [], counterCash: 0, timer: null, timeLeft: 40 };
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
      <div class="trade-panel__header">💱 SELECT PROPERTIES TO OFFER</div>
      <div class="trade-panel__info">Click your pulsing tiles on the board to select/deselect.</div>
      <div class="trade-panel__selected" id="trade-selected-list">None selected</div>
      <div class="trade-panel__cash-row">
        <label>Add Cash: $</label>
        <input type="number" id="trade-cash-input" min="0" max="${state.players[playerId].balance}" value="0" class="trade-panel__cash"/>
      </div>
      <div class="trade-panel__actions">
        <button class="btn btn--buy-center" id="trade-propose">PROPOSE</button>
        <button class="btn btn--pass-center" id="trade-cancel">CANCEL</button>
      </div>
      <div class="trade-panel__timer">⏱ <span id="trade-timer">${t.timeLeft}</span>s</div>
    `;
    document.getElementById('trade-propose')?.addEventListener('click', onTradePropose);
    document.getElementById('trade-cancel')?.addEventListener('click', cancelTrade);
    startTradeTimer();
  }
  else if (step === 'counter') {
    const opp = playerId === 'p1' ? 'p2' : 'p1';
    const offerText = t.offerProps.map(id => BOARD.find(s => s.id === id)?.name).join(', ') || 'None';
    panel.innerHTML = `
      <div class="trade-panel__header">📨 TRADE OFFER from ${state.players[t.proposer].name}</div>
      <div class="trade-panel__info">Offers: ${offerText}${t.offerCash > 0 ? ` + $${t.offerCash}` : ''}</div>
      <div class="trade-panel__info">Click your pulsing tiles to offer back.</div>
      <div class="trade-panel__selected" id="trade-selected-list">None selected</div>
      <div class="trade-panel__cash-row">
        <label>Add Cash: $</label>
        <input type="number" id="trade-cash-input" min="0" max="${state.players[opp].balance}" value="0" class="trade-panel__cash"/>
      </div>
      <div class="trade-panel__actions">
        <button class="btn btn--buy-center" id="trade-confirm">CONFIRM</button>
        <button class="btn btn--pass-center" id="trade-cancel">PASS</button>
      </div>
      <div class="trade-panel__timer">⏱ <span id="trade-timer">${t.timeLeft}</span>s</div>
    `;
    document.getElementById('trade-confirm')?.addEventListener('click', onTradeConfirm);
    document.getElementById('trade-cancel')?.addEventListener('click', cancelTrade);
  }
  else if (step === 'review') {
    const offerText = t.offerProps.map(id => BOARD.find(s => s.id === id)?.name).join(', ') || 'None';
    const counterText = t.counterProps.map(id => BOARD.find(s => s.id === id)?.name).join(', ') || 'None';
    const opp = t.proposer === 'p1' ? 'p2' : 'p1';
    panel.innerHTML = `
      <div class="trade-panel__header">📋 FINAL DEAL</div>
      <div class="trade-panel__deal">
        <div><strong>You give:</strong> ${offerText}${t.offerCash > 0 ? ` + $${t.offerCash}` : ''}</div>
        <div><strong>You get:</strong> ${counterText}${t.counterCash > 0 ? ` + $${t.counterCash}` : ''}</div>
      </div>
      <div class="trade-panel__actions">
        <button class="btn btn--buy-center" id="trade-accept">ACCEPT ✔</button>
        <button class="btn btn--pass-center" id="trade-cancel">CANCEL ✘</button>
      </div>
      <div class="trade-panel__timer">⏱ <span id="trade-timer">${t.timeLeft}</span>s</div>
    `;
    document.getElementById('trade-accept')?.addEventListener('click', executeTrade);
    document.getElementById('trade-cancel')?.addEventListener('click', cancelTrade);
  }
}

function onTileClickTrade(spaceId) {
  const t = state.trade;
  if (!t.active) return;
  const space = BOARD.find(s => s.id === spaceId);
  if (!space) return;
  const tile = boardEl.querySelector(`[data-space-id="${spaceId}"]`);

  if (t.step === 'select') {
    if (state.owners[spaceId] !== t.proposer) return;
    const idx = t.offerProps.indexOf(spaceId);
    if (idx >= 0) { t.offerProps.splice(idx, 1); tile?.classList.remove('tile--selected-trade'); }
    else { t.offerProps.push(spaceId); tile?.classList.add('tile--selected-trade'); }
    updateTradeSelectedList(t.offerProps);
  }
  else if (t.step === 'counter') {
    const opp = t.proposer === 'p1' ? 'p2' : 'p1';
    if (state.owners[spaceId] !== opp) return;
    const idx = t.counterProps.indexOf(spaceId);
    if (idx >= 0) { t.counterProps.splice(idx, 1); tile?.classList.remove('tile--selected-trade'); }
    else { t.counterProps.push(spaceId); tile?.classList.add('tile--selected-trade'); }
    updateTradeSelectedList(t.counterProps);
  }
}

function updateTradeSelectedList(props) {
  const el = document.getElementById('trade-selected-list');
  if (!el) return;
  if (props.length === 0) { el.textContent = 'None selected'; return; }
  el.textContent = props.map(id => BOARD.find(s => s.id === id)?.name).join(', ');
}

function onTradePropose() {
  const t = state.trade;
  const cashInput = document.getElementById('trade-cash-input');
  t.offerCash = parseInt(cashInput?.value) || 0;
  if (t.offerProps.length === 0 && t.offerCash === 0) { return; }
  stopAllPulse();
  t.step = 'counter';
  const opp = t.proposer === 'p1' ? 'p2' : 'p1';
  startTradePulse(opp);
  showTradePanel(opp, 'counter');
}

function onTradeConfirm() {
  const t = state.trade;
  const cashInput = document.getElementById('trade-cash-input');
  t.counterCash = parseInt(cashInput?.value) || 0;
  stopAllPulse();
  t.step = 'review';
  showTradePanel(t.proposer, 'review');
}

async function executeTrade() {
  const t = state.trade;
  const opp = t.proposer === 'p1' ? 'p2' : 'p1';

  // Swap properties
  t.offerProps.forEach(sid => { state.owners[sid] = opp; updateTileOwnerBand(sid, opp); });
  t.counterProps.forEach(sid => { state.owners[sid] = t.proposer; updateTileOwnerBand(sid, t.proposer); });

  // Swap cash
  if (t.offerCash > 0) { state.players[t.proposer].balance -= t.offerCash; state.players[opp].balance += t.offerCash; }
  if (t.counterCash > 0) { state.players[opp].balance -= t.counterCash; state.players[t.proposer].balance += t.counterCash; }

  renderHUD();

  // Heartbeat animation on traded tiles
  const allTraded = [...t.offerProps, ...t.counterProps];
  allTraded.forEach(sid => {
    const tile = boardEl.querySelector(`[data-space-id="${sid}"]`);
    if (tile) { tile.classList.add('tile--heartbeat'); setTimeout(() => tile.classList.remove('tile--heartbeat'), 1200); }
  });

  if (t.offerCash > 0) await animateCoins(t.proposer, opp, Math.min(Math.ceil(t.offerCash / 80), 5));
  if (t.counterCash > 0) await animateCoins(opp, t.proposer, Math.min(Math.ceil(t.counterCash / 80), 5));

  await flashCenterEvent('Trade completed!', null, '🤝', 1500);
  closeTrade();
  pushSyncState();
  checkWin();
}

function cancelTrade() {
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

function startTradeTimer() {
  clearInterval(state.trade.timer);
  state.trade.timer = setInterval(() => {
    state.trade.timeLeft--;
    const el = document.getElementById('trade-timer');
    if (el) el.textContent = state.trade.timeLeft;
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
      pushSyncState(); // fire-and-forget, no await
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
  let won = false;

  // The bet looks exactly at the ID of the space they landed on
  if (b.betType === 'space' && String(landedSpace.id) === String(b.betValue)) {
    won = true;
  } 

  if (won) {
    const payout = 300;
    bettor.balance += payout;
    renderHUD();
    await flashCenterEvent(`${bettor.name} won the bet!`, null, `+$${payout}`, 1500);
    await animateCoins('bank', b.bettor, 6);
  } else {
    state.stakingPool += 150;
    renderHUD();
    await flashCenterEvent(`${bettor.name} lost the bet. $150 → Pool`, null, '-$150', 1200);
  }

  state.bet = { active: false, bettor: null, betType: null, betValue: null };
}


/* ══════════════════════════════════════════════
   MAIN ROLL
   ============================================== */
async function onRollClick() {
  if (state.rolling || state.gameOver || state.trade.active) return;
  if (state.turn !== localId) return; // only active player rolls
  state.rolling = true;
  stopTurnTimer();
  hideBettingPanel();

  const ap = state.turn;
  const player = state.players[ap];

  if (player.jailTurns > 0) {
    player.jailTurns--;
    await flashCenterEvent(`${player.name} is in Jail. ${player.jailTurns > 0 ? player.jailTurns + ' round(s) left.' : 'Released next turn!'}`, 'audit.png', '\uD83D\uDD12', 1800);
    state.rolling = false;
    switchTurn(null);
    return;
  }

  const d1 = Math.ceil(Math.random() * 6);
  const oldPos = player.position;
  let newPos = oldPos + d1;
  const passedGenesis = (oldPos + d1) > 28;
  if (newPos > 28) newPos -= 28;

  // Pre-apply final state so DB push is authoritative immediately
  player.position = newPos;
  if (passedGenesis) player.balance += 200;

  // ROLL event: broadcast via fast channel (P2 animates in <200ms),
  // and persist to DB in background (no await = P1 animates immediately)
  pushSyncState({ type: 'ROLL', dice: d1, oldPos, newPos, p: ap, passedGenesis });

  // P1's local animations start immediately (no waiting for server)
  await animateDice(d1);
  await animateTokenAlongPath(ap, oldPos, d1, true); // skipGenesisBonus=true (already applied)
  if (passedGenesis) {
    renderHUD();
    flashCenterEvent(`${player.name} collected $200!`, null, '+$200', 1200);
    animateCoins('bank', ap, 5);
    checkWin();
  } else {
    renderHUD();
  }

  resumeTurnTimer();
  const landed = BOARD.find(s => s.id === newPos);
  await resolveBet(d1, landed);

  let finalEvent = null;

  if (landed?.type === 'corner') { await handleCorner(landed, ap); }

  if (landed && (landed.type === 'city' || landed.type === 'utility')) {
    if (!state.owners[landed.id]) {
      if (player.balance >= 0 && player.balance >= landed.price) {
        const decision = await showCenterBuyDecision(landed);
        if (decision === 'buy') {
          player.balance -= landed.price;
          state.stakingPool += landed.price;
          state.owners[landed.id] = ap;
          updateTileOwnerBand(landed.id, ap);
          renderHUD();
          await animateCoins(ap, 'bank', 4);
          await flashCenterEvent(`${player.name} bought ${landed.name}!`, landed.image, `$${landed.price}`, 1500);
          if (landed.type === 'city' && hasMonopoly(ap, landed.tier)) {
            await flashCenterEvent('\uD83C\uDFC6 MONOPOLY SECURED!', null, 'Rent doubled! You can build!', 2000);
          }
          checkWin();
          finalEvent = { type: 'BUY', p: ap, landed };
        } else { showCenterIdle(); }
      } else if (player.balance < 0) {
        await flashCenterEvent(`${player.name} is in debt \u2014 can't buy!`, landed.image, null, 1200);
      } else {
        await flashCenterEvent(`${player.name} can't afford ${landed.name}!`, landed.image, `$${landed.price}`, 1500);
      }
    } else if (state.owners[landed.id] !== ap) {
      const rentOwed = calculateRent(landed);
      const owner = state.owners[landed.id];
      player.balance -= rentOwed;
      state.players[owner].balance += rentOwed;
      renderHUD();
      await animateCoins(ap, owner, Math.min(Math.ceil(rentOwed / 40), 8));
      await flashCenterEvent(`${player.name} paid $${rentOwed} rent to ${state.players[owner].name}`, landed.image, `-$${rentOwed}`, 1500);
      checkBankruptcy(ap);
      checkWin();
      finalEvent = { type: 'RENT', p: ap, owner, rent: rentOwed, landed };
    } else { showCenterIdle(); }
  }

  state.rolling = false;
  switchTurn(finalEvent); // fire-and-forget internally
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

function showPropertyCard(space) {
  if (!overlayEl || !cardEl) return;
  hideTooltip();
  cardEl.querySelector('.property-card__image').src = IMG + space.image;
  const ownerKey = state.owners[space.id];
  const color = ownerKey ? PLAYER_COLORS[ownerKey] : space.type === 'city' ? TIERS[space.tier].color : '#78909C';
  cardEl.querySelector('.property-card__hero').style.borderTop = `3px solid ${color}`;
  cardEl.querySelector('.property-card__name').textContent = space.name;
  cardEl.querySelector('.property-card__tier').textContent = space.type === 'city' ? `Tier ${space.tier} — ${TIERS[space.tier].label}` : 'Utility';
  cardEl.querySelector('.property-card__price-value').textContent = `$${space.price}`;

  const table = cardEl.querySelector('.property-card__rent-table');
  table.innerHTML = '';
  getRentTable(space).forEach((r, i) => {
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
    if (state.turn !== ownerKey) return; // Can only sell on your turn
    const sellPrice = Math.round(space.price * 0.8);
    state.players[state.turn].balance += sellPrice;
    // Sell buildings too
    const bCost = TIER_ECONOMY[space.tier]?.bCost || 0;
    const bCount = state.buildings[space.id] || 0;
    state.players[state.turn].balance += Math.round(bCost * bCount * 0.8);
    state.buildings[space.id] = 0;
    updateBuildingIcons(space.id);
    resetTileBandColor(space.id, space);
    delete state.owners[space.id];
    animateCoins('bank', state.turn, 3);
    renderHUD(); hidePropertyCard(); cleanup();
    pushSyncState();
  };
  const onBuild = () => {
    if (state.turn !== ownerKey) return; // Only on your turn
    const cost = TIER_ECONOMY[space.tier]?.bCost || 0;
    if (state.players[ownerKey].balance < cost) return;
    state.players[ownerKey].balance -= cost;
    state.buildings[space.id] = (state.buildings[space.id] || 0) + 1;
    updateBuildingIcons(space.id);
    renderHUD();
    showPropertyCard(space); // Refresh card
    pushSyncState();
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
  updateTimerUI();
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
// switchTurn is synchronous - pushSyncState fires in background, no awaiting
function switchTurn(finalEvent = null) {
  if (state.gameOver) return;
  state.turn = state.turn === 'p1' ? 'p2' : 'p1';
  state.bet = { active: false, bettor: null, betType: null, betValue: null };
  pushSyncState(finalEvent); // fire-and-forget: broadcasts instantly, DB syncs in background
  startTurnTimer();
  renderHUD();
  hideBettingPanel();
  const waitingPlayer = state.turn === 'p1' ? 'p2' : 'p1';
  if (localId === waitingPlayer && state.players[waitingPlayer].balance >= 150) {
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
  updateTimerUI();
  turnTimerInterval = setInterval(() => {
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
  // Only the active turn player handles timeout — prevents both players from switching simultaneously
  if (state.gameOver || state.turn !== localId) return;
  if (window.resolveActiveDecision) {
    window.resolveActiveDecision();
  } else if (!state.rolling) {
    state.rolling = true;
    flashCenterEvent(`${state.players[state.turn].name} ran out of time!`, null, '', 1500).then(() => {
      state.rolling = false;
      switchTurn(null);
    });
  }
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

  // Broadcast to Realtime channel instead of just local injection
  if (roomCode) {
    try {
      window.supabase.channel(`public:games:${roomCode}`).send({
        type: 'broadcast', event: 'chat', payload: { sender: senderId, text }
      });
    } catch(e) {}
  }
}

function pushChatMessage(senderId, text) {
  chatLog.push({ sender: senderId, text });
  
  const logEl = document.getElementById('chat-log');
  if (logEl) {
    const msgEl = document.createElement('div');
    const isMe = senderId === state.turn;
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
// Slow path: Edge Function persists state to DB (~1-5s), fires postgres_changes.
function pushSyncState(eventPayload = null) {
  if (!localId) return;

  if (eventPayload) {
    state.last_event = Object.assign({ id: crypto.randomUUID(), p: localId }, eventPayload);
    lastProcessedEventId = state.last_event.id; // mark as self-processed so we don't replay it
  } else {
    state.last_event = null;
  }

  // FAST PATH: Broadcast the event immediately via WebSocket (P2 gets this in <200ms)
  // Only broadcast animation events — state-only pushes don't need fast path
  if (channel && state.last_event) {
    channel.send({
      type: 'broadcast',
      event: 'game_event',
      payload: { ev: state.last_event, sentBy: localId }
    }).catch(() => {}); // ignore broadcast errors (best-effort)
  }

  // SLOW PATH: Persist full state to DB in the background (no await)
  supabase.functions.invoke('game_action', {
    body: {
      action: 'state_sync',
      room_code: roomCode,
      new_state: getCleanSyncState(),
      client_version: gameVersion,
    }
  }).then(res => {
    if (res.data?.version) gameVersion = res.data.version;
    if (res.data?.conflict) {
      console.warn('[sync] OCC conflict, re-fetching state...');
      supabase.from('games').select('state, version').eq('id', gameId).single().then(({ data }) => {
        if (data) { gameVersion = data.version; playbackRender(data.state); }
      });
    }
  }).catch(e => console.error('[sync] DB push error:', e));
}

// FIX E: Smart merge — update Domain Model from server, preserve local View Model.
async function playbackRender(payloadState) {
  if (!payloadState) return;
  const ev = payloadState.last_event;
  const prevTurn = state.turn;

  if (ev && ev.id !== lastProcessedEventId) {
    lastProcessedEventId = ev.id;
    if (ev.type === 'ROLL') {
      // ev.oldPos = pre-roll position, ev.newPos = destination
      // Do NOT call mergeServerState here — let animateTokenAlongPath handle position
      // State.players[ev.p].position at this point is already ev.oldPos on P2 (never echoed to P1)
      await animateDice(ev.dice);
      await animateTokenAlongPath(ev.p, ev.oldPos, ev.dice, ev.passedGenesis); // passedGenesis=true means genesis bonus was pre-applied
    } else if (ev.type === 'BUY') {
      await animateCoins(ev.p, 'bank', 4);
      await flashCenterEvent(`${payloadState.players[ev.p]?.name} bought ${ev.landed.name}!`, ev.landed.image, `$${ev.landed.price}`, 1500);
    } else if (ev.type === 'RENT') {
      await animateCoins(ev.p, ev.owner, Math.min(Math.ceil(ev.rent / 40), 8));
      await flashCenterEvent(`${payloadState.players[ev.p]?.name} paid $${ev.rent} rent`, ev.landed.image, `-$${ev.rent}`, 1500);
    }
  }

  mergeServerState(payloadState);

  // Restart timer only when turn changed (detected from payload, not local state which just merged)
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

// Extract the domain field merge so it can be called from both paths above
function mergeServerState(payloadState) {
  state.turn        = payloadState.turn        ?? state.turn;
  state.phase       = payloadState.phase       ?? state.phase;
  state.owners      = payloadState.owners      ?? state.owners;
  state.buildings   = payloadState.buildings   ?? state.buildings;
  state.stakingPool = payloadState.stakingPool ?? state.stakingPool;
  state.winTarget   = payloadState.winTarget   ?? state.winTarget;
  state.gameOver    = payloadState.gameOver    ?? false;
  state.last_event  = payloadState.last_event  ?? null;
  // Sync bet from server (rolling player needs to see the waiting player's bet)
  if (payloadState.bet !== undefined) state.bet = payloadState.bet;

  // Merge players but ALWAYS preserve tokenImg
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

  // Safety net: release any stuck animation lock
  state.rolling = false;
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
  
  // FAST PATH: game_event broadcast — P2 animates dice+token in <200ms (no DB round-trip)
  channel.on('broadcast', { event: 'game_event' }, async (payload) => {
    const { ev, sentBy } = payload.payload ?? {};
    if (!ev || sentBy === localId) return; // suppress self
    if (ev.id === lastProcessedEventId) return; // already processed
    lastProcessedEventId = ev.id; // mark so postgres_changes skips animation

    if (ev.type === 'ROLL') {
      await animateDice(ev.dice);
      await animateTokenAlongPath(ev.p, ev.oldPos, ev.dice, ev.passedGenesis);
      if (ev.passedGenesis) {
        flashCenterEvent(`${state.players[ev.p]?.name || 'Opponent'} collected $200!`, null, '+$200', 1200);
        animateCoins('bank', ev.p, 5);
      }
    }
    // BUY/RENT come via postgres_changes full state — no broadcast handling needed
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
  });
}

init();
