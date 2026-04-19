# BANKROLL — REVISED Game Board Prompt (Screen #6)

> This replaces the original Screen #6 prompt. The board must feel like a GAME, not a dashboard.
> Reference: Classic Monopoly-style board where the board IS the entire screen.

---

## SCREEN 6 (REVISED): GAME BOARD — Board-Dominant Layout

```
Design the main game board for "BANKROLL" — a premium digital board game. Desktop, 1440x900.

THIS IS THE MOST IMPORTANT RULE: The board game fills the ENTIRE screen. There is NO sidebar. There is NO navigation menu. There is NO portfolio panel. The board is the game. The game is the board.

BACKGROUND: Deep charcoal #1A1A2E — visible only in the thin margins around the board.

═══════════════════════════════════════
THE BOARD (centered, as large as possible — roughly 750x750px):
═══════════════════════════════════════

A square board game layout filling the screen. Think classic Monopoly board but premium.

The board has a subtle border/frame that feels like polished dark wood — rich dark navy #16213E with very subtle grain texture and a thin gold #D4A843 inner border line.

PROPERTY TILE DESIGN (this is critical):
Every property tile has TWO parts:
1. A COLORED HEADER BAND — a solid matte strip in the tier color (no gradient)
2. A WHITE/CREAM BODY #F5F0E8 — containing the city name in dark text and price below it

The tiles look like real Monopoly property cards laid flat on the board. Text is ALWAYS readable — oriented so it reads naturally from the outside of the board looking inward.

Bottom side tiles: text reads left-to-right (normal)
Right side tiles: text reads bottom-to-top (rotated 90° counter-clockwise)
Top side tiles: text reads right-to-left (upside down from bottom perspective)
Left side tiles: text reads top-to-bottom (rotated 90° clockwise)

═══════════════════════════════════════
4 CORNER TILES (larger, square):
═══════════════════════════════════════

Bottom-left — GENESIS:
- Rich dark navy background #16213E
- "GENESIS" in warm gold #D4A843, bold
- "+$200" below in cream
- A simple golden arrow icon pointing right (direction of play)

Bottom-right — AUDIT:
- Muted dark gray background
- "AUDIT" in cream text
- Simple jail bars icon (just 3-4 vertical lines) in muted gray
- Small text "2 Turns" below

Top-right — STAKING POOL:
- Rich dark navy background
- "STAKING POOL" in warm gold
- Large "$450" amount in bright warm gold #D4A843, prominent
- A simple gold coin/stack icon above the amount
- This corner should feel special — it holds the jackpot

Top-left — LUCKY CARD:
- Rich dark navy background
- "LUCKY CARD" in cream
- A simple playing card icon (like a card with "?" on it) in cream/gold

═══════════════════════════════════════
BOTTOM SIDE (6 property tiles, left to right after Genesis):
═══════════════════════════════════════

Tile 1: Forest green #2D6A4F header band. White body: "LAGOS" in dark text, "$80" below
Tile 2: Forest green header. "NAIROBI" / "$85"
Tile 3: Neutral light gray header with small airplane ✈️ icon. "AIRPORT" / "$150" — this is a utility, not a city
Tile 4: Forest green header. "HANOI" / "$90"
Tile 5: Forest green header. "MEDELLÍN" / "$100"
Tile 6: Deep navy #1D3557 header. "BANGKOK" / "$120"

═══════════════════════════════════════
RIGHT SIDE (6 tiles, bottom to top after Audit):
═══════════════════════════════════════

Tile 7: Deep navy header. "ISTANBUL" / "$130"
Tile 8: Deep navy header. "SÃO PAULO" / "$145"
Tile 9: Neutral gray header with lightning ⚡ icon. "ELECTRIC" / "$150"
Tile 10: Deep navy header. "MUMBAI" / "$160"
Tile 11: Terracotta #E76F51 header. "SEOUL" / "$180"
Tile 12: Terracotta header. "BERLIN" / "$190"

═══════════════════════════════════════
TOP SIDE (6 tiles, right to left after Staking Pool):
═══════════════════════════════════════

Tile 13: Terracotta header. "TORONTO" / "$205"
Tile 14: Terracotta header. "SYDNEY" / "$220"
Tile 15: Neutral gray header with cloud ☁️ icon. "INTERNET" / "$150"
Tile 16: Amethyst #6A4C93 header. "ZURICH" / "$240"
Tile 17: Amethyst header. "TOKYO" / "$255"
Tile 18: Amethyst header. "HONG KONG" / "$265"

═══════════════════════════════════════
LEFT SIDE (6 tiles, top to bottom after Lucky Card):
═══════════════════════════════════════

Tile 19: Amethyst header. "LONDON" / "$280"
Tile 20: Crimson #C1121F header. "SHANGHAI" / "$300"
Tile 21: Neutral gray header with ship 🚢 icon. "SHIPPING" / "$150"
Tile 22: Crimson header. "SINGAPORE" / "$315"
Tile 23: Crimson header. "DUBAI" / "$335"
Tile 24: Crimson header. "NEW YORK" / "$350"

═══════════════════════════════════════
CENTER OF BOARD:
═══════════════════════════════════════

The center area (the open space inside the ring of tiles) has:
- Background: Rich dark navy #16213E
- "BANKROLL" in large warm gold #D4A843, DM Serif Display font, centered, semi-transparent (like a watermark, but visible and classy — about 40% opacity)
- Below the logo: "STAKING POOL" label in cream, small
- "$450" in prominent warm gold, full opacity, 32px
- A simple, elegant gold coin icon above the amount

═══════════════════════════════════════
PLAYER TOKENS ON THE BOARD:
═══════════════════════════════════════

Two circular player tokens sitting on tiles:
- Player 1 token: Small solid Red circle on one of the Green tiles (e.g., Hanoi)
- Player 2 token: Small solid Blue circle on one of the Blue tiles (e.g., Mumbai)

Properties show OWNERSHIP by changing their top header band to match the owner's player color (e.g., Red or Blue). When Player 1 (Red) buys "New York", its header band becomes Red. Some tiles show tiny building icons (1-2 small squares) to indicate upgrades.

═══════════════════════════════════════
HUD ELEMENTS (minimal, overlaid at edges, NOT in sidebars):
═══════════════════════════════════════

TOP CENTER — TURN TIMER BAR:
A thin horizontal bar (about 500px wide, 32px tall) floating above the board.
- Background: dark navy rounded pill shape
- Green bar #2D6A4F filling from left (about 65% full)
- Text inside: "PLAYER 1'S TURN — 28s" in cream, Inter 13px
- Small gold dot on the left indicating which player's turn

BOTTOM-LEFT — PLAYER 1 HUD (your player):
A small floating card (200px wide, dark navy #16213E, rounded 12px, slight shadow):
- Player name: "You" in cream, bold
- Liquid Cash: "$620" in warm gold #D4A843
- Net Worth: "$1,870 / $3,000" in cream with a thin gold progress bar below
- Small property dots showing owned colors (e.g. 4 red dots, 1 blue dot)

BOTTOM-RIGHT — PLAYER 2 HUD:
Same card style:
- "Player 2" in cream
- Cash: "$340" in gold
- Net Worth: "$1,490 / $3,000" in cream with progress bar

BOTTOM CENTER — ACTION BUTTONS:
Three buttons floating below the board in a row:
- "🎲 ROLL DICE" — solid warm gold #D4A843 background, near-black text, rounded 8px, 44px tall — this is the PRIMARY action, slightly larger
- "↔ TRADE" — dark navy background, cream text, 1px cream border, rounded 8px
- "🏷 SELL PROPERTY" — dark navy background, cream text, 1px cream border

═══════════════════════════════════════
WHAT THIS SCREEN MUST NOT HAVE:
═══════════════════════════════════════

❌ No sidebar navigation
❌ No left panel with Portfolio/Deeds/Market/Messages
❌ No top navigation bar with tabs
❌ No dark/invisible property tiles — tiles must have white/cream bodies
❌ No gradients or neon glows
❌ No competing UI elements that distract from the board

The board must feel like you're sitting at a premium table looking down at a real board game. Clean, tactile, focused. The property tiles should POP against the dark board with their colored headers and white bodies — exactly like real Monopoly property spaces.

Typography: DM Serif Display for property names and labels. Inter for numbers and prices. All text must be crisp and readable.
```

---

## Additional Notes

When generating this in Stitch, if the output adds any sidebar or navigation panel, explicitly re-prompt:

> "Remove the sidebar navigation completely. The board game should fill the entire screen. There should be no Portfolio, Deeds, Market, or Messages panel. Only the board, a small turn timer at top, two small player cards at bottom corners, and three action buttons at bottom center."
