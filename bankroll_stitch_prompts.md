# BANKROLL — Stitch Screen Prompts

> Copy-paste each prompt into Stitch to generate the corresponding screen.  
> All prompts use the finalized GDD v3.1 specs: Premium Luxury palette, DM Serif Display + Inter fonts, desktop-first (1440×900).

---

## SCREEN INDEX

| # | Screen | Flow |
|---|---|---|
| 1 | Landing Page | Pre-Game |
| 2 | Auth / Connect | Pre-Game |
| 3 | Lobby / Dashboard | Pre-Game |
| 4 | Matchmaking Queue | Pre-Game |
| 5 | Escrow Deposit Confirmation | Pre-Game |
| 6 | Game Board (Overview) | Core Gameplay |
| 7 | Player Turn HUD | Core Gameplay |
| 8 | Opponent Turn + Prediction Market | Core Gameplay |
| 9 | Property Card Popup | Core Gameplay |
| 10 | OTC Trade Modal | Core Gameplay |
| 11 | Lucky Card Reveal | Core Gameplay |
| 12 | Audit (Jail) Screen | Core Gameplay |
| 13 | Building Purchase Panel | Core Gameplay |
| 14 | Bankruptcy Screen | End Game |
| 15 | Victory Screen | End Game |
| 16 | Wallet & Profile | Meta |
| 17 | Leaderboard | Meta |

---

## 1. LANDING PAGE

```
Design a premium landing page for "BANKROLL" — a high-stakes Web3 real estate trading board game. Desktop layout, 1440x900.

Background: Deep charcoal #1A1A2E.

Hero section centered vertically:
- Game logo "BANKROLL" in large bold DM Serif Display font, color warm gold #D4A843, with subtle letter spacing
- Tagline below in Inter font, 18px, color cream #F0E6D2: "High-Stakes Real Estate. Fast Matches. Real Payouts."
- Below that, two key stats in cream text: "$5 Entry • 2-4 Players • Winner Takes All"
- Large CTA button: "PLAY NOW" with solid warm gold #D4A843 background, near-black #0F0F0F text, rounded corners (8px), subtle shadow, no gradient
- Secondary text link below button in cream: "How It Works"

Below hero, three feature cards in a horizontal row, each with:
- Rich dark navy #16213E background, rounded corners (12px), subtle shadow
- Small icon on top (simple, geometric)
- Feature title in gold #D4A843, DM Serif Display
- Description in cream #F0E6D2, Inter 14px

Card 1: "Skill-Based Strategy" — "No luck-only mechanics. Every decision carries real financial weight."
Card 2: "Instant Payouts" — "Winners receive prizes directly to their wallet via Solana smart contracts."
Card 3: "45-Second Turns" — "Fast-paced matches designed to respect your time and your buy-in."

Very bottom: minimal footer with "Powered by Solana" in muted gray text.

Overall feel: Premium, clean, luxury board game aesthetic. No neon, no gradients, no glowing effects. Think high-end casino meets clean product design.
```

---

## 2. AUTH / CONNECT SCREEN

```
Design a clean authentication modal/page for "BANKROLL" game. Desktop, 1440x900.

Background: Deep charcoal #1A1A2E with a very subtle, blurred view of the game board behind it (barely visible).

Centered card (480px wide, rounded 16px corners):
- Background: Rich dark navy #16213E
- Top: "BANKROLL" logo in warm gold #D4A843, DM Serif Display, 28px
- Below logo: "Sign in to play" in cream #F0E6D2, Inter 16px

Three sign-in buttons stacked vertically, full-width within the card, 48px height each, rounded 8px:
- Button 1: White background, black text "Continue with Google" with Google icon on left
- Button 2: Black background, white text "Continue with X" with X/Twitter icon on left  
- Button 3: Dark charcoal #1A1A2E background, cream text "Continue with Email" with envelope icon on left

Each button has a subtle 1px border in muted gray #333.

Below buttons: thin horizontal divider line in #333

Below divider: small text in muted gray #666, Inter 12px: "By continuing, you agree to our Terms of Service"

Bottom of card: small text "Your Solana wallet will be automatically created" in warm gold #D4A843, Inter 13px

No gradients, no glowing effects. Clean, trustworthy, premium feel.
```

---

## 3. LOBBY / DASHBOARD

```
Design the main lobby dashboard for "BANKROLL" game. Desktop, 1440x900.

Background: Deep charcoal #1A1A2E.

TOP NAV BAR (64px height, rich dark navy #16213E):
- Left: "BANKROLL" logo in warm gold #D4A843, DM Serif Display
- Center: Nav links in cream #F0E6D2, Inter 14px: "Play" (active, gold underline), "Leaderboard", "Profile"
- Right: Wallet balance chip showing "◎ 12.5 SOL" in warm gold with a small Solana icon, and a circular user avatar

MAIN CONTENT (centered, max-width 1100px):

Left column (60%):
- Section title "Choose Your Arena" in cream, DM Serif Display, 24px
- Two large mode selection cards side by side:

  Card 1 "HEAD-TO-HEAD":
  - Background: #16213E, rounded 12px, subtle shadow
  - Icon: Two crossed swords or two player silhouettes (simple)
  - Title in gold #D4A843: "Head-to-Head Duel"
  - Details in cream: "2 Players • $5 Entry • $9 Prize"
  - Win condition: "First to $3,000 Net Worth"
  - CTA button: "FIND MATCH" in solid gold background, black text

  Card 2 "FREE-FOR-ALL":
  - Same styling as Card 1
  - Title: "Free-for-All Rumble"
  - Details: "4 Players • $5 Entry • $18 Prize"
  - Win condition: "First to $5,000 Net Worth"
  - CTA button: "FIND MATCH"

Right column (40%):
- Player stats card (dark navy background, rounded):
  - "Your Stats" title in gold
  - Wins: 14, Losses: 8, Win Rate: 63%
  - Total Earnings: $126.00
  - Current ELO: 1,340
  - All numbers in cream, labels in muted gray

- Below: "Recent Matches" mini list showing 3 recent results:
  - Each row: opponent name, result (W/L in green/red), prize amount
  - Green for wins: Rich emerald #2D6A4F
  - Red for losses: Deep crimson #9B1B30

Clean, premium aesthetic. No neon, no gradients. Warm gold accents on dark backgrounds.
```

---

## 4. MATCHMAKING QUEUE

```
Design a matchmaking waiting screen for "BANKROLL" game. Desktop, 1440x900.

Background: Deep charcoal #1A1A2E.

Centered content:

Top: "Finding Your Opponent..." in cream #F0E6D2, DM Serif Display, 32px

Below: An animated-style loading indicator — a simple gold #D4A843 ring/circle that suggests rotation (show it as a thin circular outline with a brighter arc segment, implying spin)

Below the spinner: Match details card (dark navy #16213E, rounded 12px, 400px wide):
- Mode: "Head-to-Head Duel" in gold
- Entry Fee: "$5.00 USDC" in cream
- Prize Pool: "$9.00" in warm gold, slightly larger
- Win Target: "$3,000 Net Worth" in cream
- Thin horizontal divider
- "Estimated Wait: ~15 seconds" in muted gray #888

Below card: "Cancel" text link in muted red #9B1B30, Inter 14px

At the bottom of the visible area: A very subtle animated dots pattern "..." in cream to convey waiting state.

Clean, minimal, premium. The player should feel like they're about to enter something important. No flashy effects.
```

---

## 5. ESCROW DEPOSIT CONFIRMATION

```
Design an escrow deposit confirmation modal for "BANKROLL" game. Desktop, 1440x900.

Background: Deep charcoal #1A1A2E with a subtle dark overlay suggesting the lobby is behind.

Centered modal card (500px wide, rounded 16px):
- Background: Rich dark navy #16213E
- Top: Gold shield/lock icon (simple, geometric)
- Title: "Confirm Entry" in cream #F0E6D2, DM Serif Display, 24px

Match details section:
- "Head-to-Head Duel" in gold #D4A843
- Opponent found: "Player_0x7F...3a2" with a small avatar circle
- Entry Fee: "$5.00 USDC" in large cream text
- Your Balance: "◎ 12.5 SOL ($247.50)" in muted gray

Thin gold divider line

Transaction breakdown:
- Entry Fee: $5.00
- Network Gas: ~$0.001
- Total: $5.001
All in cream text, right-aligned values

Two buttons at bottom:
- Primary: "DEPOSIT & PLAY" — solid warm gold #D4A843 background, near-black text, full width, 48px height
- Secondary: "Cancel" — transparent background, cream text border, full width, 48px height

Small text at very bottom in muted gray: "Funds locked in escrow smart contract until match concludes"

Premium, trustworthy feel. This is where real money is committed — design should convey security and clarity.
```

---

## 6. GAME BOARD (Main Overview)

```
Design the main game board screen for "BANKROLL" — a premium digital board game. Desktop, 1440x900. This is the most important screen.

Background: Deep charcoal #1A1A2E.

THE BOARD (centered, approximately 700x700px):
A square board game layout with 28 spaces (7 per side including corners). The board surface is rich dark navy #16213E with a very subtle wood grain texture on the border/frame.

4 CORNER TILES (slightly larger, square):
- Bottom-left: "GENESIS" with "+$200" — warm gold accent
- Bottom-right: "AUDIT" with jail bars icon — muted gray
- Top-right: "STAKING POOL" with "$450" jackpot amount — highlighted with subtle gold shimmer
- Top-left: "LUCKY CARD" with a card icon — cream colored

PROPERTY TILES along each side (rectangular, oriented inward):
Each property tile has a MATTE COLORED HEADER BAND (the tier color) and a clean warm off-white #F5F0E8 body showing city name and price.

Bottom side (left to right after Genesis): 
- Lagos $80 (forest green #2D6A4F header)
- Nairobi $85 (forest green header)
- Airport $150 (neutral gray header, airplane icon)
- Hanoi $90 (forest green header)
- Medellín $100 (forest green header)
- Bangkok $120 (deep navy #1D3557 header)

Right side (bottom to top after Audit):
- Istanbul $130 (deep navy header)
- São Paulo $145 (deep navy header)
- Electric $150 (neutral gray, lightning icon)
- Mumbai $160 (deep navy header)
- Seoul $180 (terracotta #E76F51 header)
- Berlin $190 (terracotta header)

Top side (right to left after Staking Pool):
- Toronto $205 (terracotta header)
- Sydney $220 (terracotta header)
- Internet $150 (neutral gray, cloud icon)
- Zurich $240 (amethyst #6A4C93 header)
- Tokyo $255 (amethyst header)
- Hong Kong $265 (amethyst header)

Left side (top to bottom after Lucky Card):
- London $280 (amethyst header)
- Shanghai $300 (crimson #C1121F header)
- Shipping $150 (neutral gray, ship icon)
- Singapore $315 (crimson header)
- Dubai $335 (crimson header)
- New York $350 (crimson header)

CENTER OF BOARD: "BANKROLL" text in warm gold, DM Serif Display. Below it show Staking Pool counter: "$450" in gold.

PLAYER TOKENS: Two small circular tokens on the board — one gold, one silver — positioned on different tiles.

Some properties should show ownership (small colored dot) and 1-2 tiny building icons on them.

TOP OF SCREEN — TURN TIMER BAR:
A horizontal bar spanning the full width, showing a countdown timer. Bar is emerald green #2D6A4F (about 60% filled), with text "Player 1's Turn — 28s" in cream on the left.

LEFT SIDE HUD — PLAYER 1 PANEL (your player):
- Small card with dark navy background
- Avatar (gold circle), name "You" in cream
- Cash: "$620" in warm gold #D4A843
- Net Worth: "$1,870" in cream with a small progress bar below showing progress toward $3,000
- Owned properties shown as small colored dots (3 green dots, 2 navy dots)

RIGHT SIDE HUD — PLAYER 2 PANEL (opponent):
- Same layout as Player 1 panel
- Avatar (silver circle), name "Player_0x7F" in cream  
- Cash: "$340" in gold
- Net Worth: "$1,490" in cream with progress bar

BOTTOM OF SCREEN — ACTION BAR:
A horizontal bar with action buttons:
- "ROLL DICE" — large, solid warm gold button, near-black text (primary action)
- "TRADE ($60)" — outlined button, cream text
- "SELL PROPERTY" — outlined button, cream text

Overall feel: Premium tabletop board game rendered digitally. Matte colors, clean typography (DM Serif Display for names, Inter for numbers), subtle shadows. No neon, no gradients, no glowing effects. Think luxury casino table.
```

---

## 7. PLAYER TURN HUD (Active Turn State)

```
Design the game board during an active player's turn for "BANKROLL" game. Desktop, 1440x900.

Same board layout as the main game board screen, but now showing the POST-DICE-ROLL state:

TURN TIMER BAR (top): Emerald green bar about 70% full. Text: "Your Turn — 32s remaining" in cream.

CENTER OVERLAY — DICE RESULT:
Two dice shown in the center-top area of the board, slightly overlapping the board. Dice are warm off-white #F5F0E8 with near-black dots, showing a roll of 4 and 3 (total 7). Clean, physical-looking dice with subtle shadow.

PLAYER TOKEN has moved to a new position — landed on an UNOWNED property: "Seoul $180" (terracotta header).

RIGHT SIDE — PROPERTY PURCHASE POPUP:
A card slides in from the right side (320px wide, dark navy #16213E background, rounded 12px):
- Terracotta #E76F51 header band with city name "SEOUL" in white, DM Serif Display
- Below header on off-white body:
  - "Tier 3 — Orange Block" in muted gray
  - "Buy Price: $180" in large near-black text
  - Divider line
  - Rent table:
    - Base Rent: $35
    - Monopoly (4/4): $70
    - +1 Building: $140
    - +2 Buildings: $280
    - +3 Buildings: $500
  - Building Cost: $100 each
  All in Inter font, clean rows

- Two buttons at bottom of card:
  - "BUY — $180" solid warm gold button, black text
  - "PASS" outlined button, muted cream text

LEFT SIDE HUD shows updated player stats:
- Cash: "$620" (will become $440 if purchased)
- Net Worth: "$1,870"
- Properties: colored dots showing current holdings

BOTTOM ACTION BAR:
- "ROLL DICE" button is now grayed out/disabled
- "TRADE ($60)" and "SELL PROPERTY" remain active
- "END TURN" button appears in outlined style

Premium, clean design. No flashy effects. Information-rich but not cluttered.
```

---

## 8. OPPONENT TURN + PREDICTION MARKET

```
Design the game board during an opponent's turn for "BANKROLL" game, showing the Prediction Market betting interface. Desktop, 1440x900.

TURN TIMER BAR (top): Shows opponent's timer. Amber #E9A820 bar about 40% full. Text: "Player_0x7F's Turn — 18s" in cream.

The board is slightly dimmed (not fully, maybe 90% opacity) to indicate it's not your turn. The opponent's token is highlighted.

BOTTOM SLIDE-UP PANEL — PREDICTION MARKET:
A sleek panel (full width, 160px tall) slides up from the bottom. Background: rich dark navy #16213E with a thin gold #D4A843 top border line.

Panel title: "PREDICTION MARKET" in warm gold, DM Serif Display, 18px, left-aligned.
Subtitle: "Bet on where they'll land" in cream #F0E6D2, Inter 13px.

Two betting option cards side by side (each about 300px wide, centered):

Card 1 — COLOR TIER BET:
- Background: slightly lighter navy #1E2A4A, rounded 8px
- Title: "Color Tier" in cream, Inter 14px bold
- Five selectable tier options in a horizontal row, each a small colored square:
  - Green #2D6A4F, Navy #1D3557, Terracotta #E76F51, Amethyst #6A4C93, Crimson #C1121F
  - One is selected (terracotta has a gold border ring around it)
- Below: "Cost: $30 → Win: $175 (5.8x)" in cream
- "PLACE BET" small gold button

Card 2 — BOARD HALF BET:
- Same background styling
- Title: "Board Half" in cream
- Two selectable options: "Tiles 1-14" and "Tiles 15-28" as pill buttons
  - One selected (gold background, black text), other unselected (outlined, cream text)
- Below: "Cost: $30 → Win: $52 (1.7x)" in cream
- "PLACE BET" small gold button

Far right of panel: "SKIP" text link in muted gray

Left side of panel: Your current cash shown: "Your Cash: $620" in gold

The overall feel should be minimal and non-intrusive — the panel doesn't overwhelm the board but offers a clear, fast betting interface. Premium styling, no neon.
```

---

## 9. PROPERTY CARD POPUP (Detail View)

```
Design a property detail card popup for "BANKROLL" game. Desktop, 1440x900.

Background: The game board is visible but darkened/blurred (overlay at 60% opacity dark).

Centered popup card (380px wide, rounded 16px):

TOP SECTION — Color header:
- Full-width crimson #C1121F header band (40px tall)
- City name "NEW YORK" in white, DM Serif Display, 22px, centered
- Below in smaller white text: "Tier 5 — Red Block"

BODY SECTION — Off-white #F5F0E8 background:

Owner info:
- "Owned by: You" with a small gold avatar dot — or "Unowned" in muted gray
- If owned, show a gold border highlight

Price and Rent Table (Inter font, clean rows with alternating subtle backgrounds):
- Buy Price: $350
- ─────────────
- Base Rent: $70
- Monopoly Rent (4/4): $140
- With 1 Building: $280
- With 2 Buildings: $600
- With 3 Buildings: $1,000
- ─────────────
- Building Cost: $150 each

Current Upgrade Status:
- Three building slot indicators: ■ ■ □ (two filled gold squares, one empty outlined square)
- Text: "2/3 Buildings" in near-black

Monopoly Progress:
- "Red Block: 3/4 owned" with four small squares — three crimson filled, one outlined gray
- Cities listed small: "Shanghai ✓ Singapore ✓ New York ✓ Dubai ✗"

Bottom buttons:
- If owned and monopoly complete: "BUILD (+$150)" solid gold button
- "CLOSE" outlined button in cream

Footer text in muted gray, Inter 12px: "Selling to Bank returns 80% ($280)"

Clean, informational, feels like a real property deed card. No effects, just clear data presentation.
```

---

## 10. OTC TRADE MODAL

```
Design an OTC (Over-The-Counter) trade proposal modal for "BANKROLL" game. Desktop, 1440x900.

Background: Game board darkened/blurred at 60% overlay.

Centered modal (600px wide, rounded 16px, dark navy #16213E background):

Header:
- "PROPOSE TRADE" in warm gold #D4A843, DM Serif Display, 22px
- Subtitle: "Fee: $60 → Staking Pool" in muted amber, Inter 13px
- Thin gold divider

Two-column layout:

LEFT COLUMN — "YOU OFFER":
- Header: "Your Offer" in cream, Inter 14px bold
- Cash input field: A number input with "$" prefix, showing "200", on dark background #1A1A2E with cream text, gold border when focused
- Your properties list (selectable checkboxes):
  - Each property shows: colored dot + city name + price
  - ☑ Lagos ($80) with green dot
  - ☐ Nairobi ($85) with green dot  
  - ☑ Airport ($150) with gray dot
  - Selected items have gold checkbox fills
- Your available cash shown below: "Available: $620" in muted gray

RIGHT COLUMN — "YOU WANT":
- Header: "You Want" in cream, Inter 14px bold
- Cash input field: showing "0"
- Opponent's properties list (selectable):
  - ☐ Seoul ($180) with terracotta dot
  - ☑ Berlin ($190) with terracotta dot
  - ☐ Mumbai ($160) with navy dot
  - Selected items have gold checkbox fills

TRADE SUMMARY (full width bar at bottom of modal, slightly lighter background):
- Left: "You Give: $200 + Lagos + Airport" in cream
- Right: "You Get: Berlin" in cream
- Center divider: "⇄" swap icon in gold

Bottom buttons:
- "SEND PROPOSAL — $60 FEE" solid warm gold button, near-black text, full width
- "CANCEL" text link in muted gray below

Small text: "Opponent has 15 seconds to accept or reject" in muted gray, Inter 12px

Clean, transactional design. Should feel like a serious financial negotiation interface.
```

---

## 11. LUCKY CARD REVEAL

```
Design a Lucky Card reveal overlay for "BANKROLL" game. Desktop, 1440x900.

Background: Game board visible but heavily darkened (80% dark overlay) to focus attention on the card.

Centered — a playing card (280px wide, 400px tall, rounded 12px):

Card is shown face-up (revealed state):

Card back design reference: Dark navy #16213E with a subtle geometric pattern and "BANKROLL" watermark in slightly lighter navy.

Card face (revealed):
- Background: Warm off-white #F5F0E8
- Top band: Rich emerald #2D6A4F (for positive cards — this example is a positive card)
- Card category icon centered in the band: Simple upward arrow/coins icon in white
- Category label: "CAPITAL INJECTION" in white, Inter 11px uppercase tracking

Card body:
- Card name: "THE AIRDROP" in near-black #0F0F0F, DM Serif Display, 20px, centered
- Decorative thin gold line divider
- Card effect text: "Your wallet has received a random airdrop. Instantly collect $200 from the Bank." in near-black, Inter 14px, centered, with generous line spacing
- Amount highlight: "$200" is displayed in warm gold #D4A843 and slightly larger/bolder

Bottom of card:
- Small "BANKROLL" text in muted gray

Below the card:
- "TAP TO CONTINUE" in cream #F0E6D2, Inter 14px, with a subtle pulsing opacity animation implied

For NEGATIVE cards, the top band would be deep crimson #9B1B30 with a downward arrow icon.
For CHAOS cards, the top band would be amethyst #6A4C93 with a shuffle/lightning icon.

The card should look and feel like a real, physical playing card — premium paper stock aesthetic, clean typography, no flashy effects.
```

---

## 12. AUDIT (JAIL) SCREEN

```
Design the Audit/Jail decision overlay for "BANKROLL" game. Desktop, 1440x900.

Background: Game board visible, slightly dimmed. The Audit corner tile (bottom-right) is highlighted with a subtle pulsing gold border.

Player's token is visually "trapped" on the Audit tile.

Centered decision card (420px wide, dark navy #16213E, rounded 16px):

Top: Simple jail/bars icon in muted gray, geometric style (just vertical lines suggesting bars)

Title: "AUDIT DETENTION" in cream #F0E6D2, DM Serif Display, 22px
Subtitle: "Your transactions are being audited" in muted gray, Inter 14px

Status info:
- "Turns Remaining: 2" in cream
- "Bail Cost: $150 → Staking Pool" in warm gold #D4A843
- "Your Cash: $620" in cream

Thin divider

Two large option buttons stacked:

Button 1: "PAY BAIL — $150"
- Solid warm gold #D4A843 background, near-black text
- Subtitle below button: "Pay $150, resume playing immediately" in muted gray, Inter 12px

Button 2: "WAIT IT OUT"  
- Dark charcoal #1A1A2E background, cream text, 1px cream border
- Subtitle: "Skip turn, try to roll doubles for free release" in muted gray, Inter 12px

Info text at bottom in muted gray:
"Rolling doubles on a jailed turn = free release. Bail fee goes to the Staking Pool."

Clean, somber mood. The player is making a financial decision under pressure. No flashy effects.
```

---

## 13. BUILDING PURCHASE PANEL

```
Design a building purchase panel for "BANKROLL" game. Desktop, 1440x900.

The game board is visible. The player has a completed monopoly (Green block — all 4 properties: Lagos, Nairobi, Hanoi, Medellín highlighted with a gold border on the board).

Right side panel (360px wide, dark navy #16213E, rounded 12px on the left edge, slides in from right):

Header: "BUILD ON GREEN BLOCK" in warm gold #D4A843, DM Serif Display, 18px
Subtitle: "Monopoly Complete — 4/4 owned" with a small gold checkmark icon

Property list — each property is a row:

Row 1 — Lagos ($80):
- Forest green #2D6A4F color dot
- City name "Lagos" in cream, Inter 14px
- Current buildings: ■ □ □ (1/3) — one gold filled square, two outlined
- "ADD BUILDING — $50" small gold button on the right
- Rent preview: "$40 → $90" in muted gray showing rent change

Row 2 — Nairobi ($85):
- Same layout
- Buildings: □ □ □ (0/3)
- "ADD BUILDING — $50" button
- Rent preview: "$20 → $40"

Row 3 — Hanoi ($90):
- Buildings: ■ ■ □ (2/3)
- "ADD BUILDING — $50" button  
- Rent preview: "$90 → $180"

Row 4 — Medellín ($100):
- Buildings: ■ ■ ■ (3/3 — MAXED)
- "MAXED" label in muted gray instead of button
- Current rent: "$180" in warm gold

Divider line

Summary section:
- "Total Build Cost: $100" (for 2 buildings selected) in cream
- "Your Cash: $620 → $520" in cream with arrow
- "Net Worth Impact: +$100" in emerald #2D6A4F

Bottom buttons:
- "CONFIRM BUILD" solid gold button, full width
- "CANCEL" text link in muted gray

Clean, data-rich panel. Builder should feel like they're making strategic investments. Premium card aesthetic.
```

---

## 14. BANKRUPTCY SCREEN

```
Design a bankruptcy/elimination screen for "BANKROLL" game. Desktop, 1440x900.

Background: Deep charcoal #1A1A2E. The game board is very faintly visible in the background (barely 10% opacity).

Centered content:

A large shattered/cracked avatar circle (120px) at the top — the player's gold avatar with visible crack lines through it (like broken glass, drawn with thin lines — not a 3D effect, just a flat illustration of cracks). The avatar is desaturated/grayed out.

Title: "BANKRUPT" in deep crimson #9B1B30, DM Serif Display, 40px

Below: "Your Net Worth dropped below $0" in cream #F0E6D2, Inter 16px

Match summary card (dark navy #16213E, 450px wide, rounded 12px):

- "Final Stats" in muted gold, DM Serif Display, 16px
- Divider
- Final Cash: $0 (in crimson)
- Final Net Worth: -$120 (in crimson)
- Properties Owned: 0 (returned to bank)
- Turns Survived: 23
- Rent Paid Total: $1,480
- Rent Collected Total: $620
All in cream text, right-aligned values, Inter font

Below card:
- "Your properties have been returned to the bank and are available for remaining players."  in muted gray, Inter 13px

Bottom:
- "RETURN TO LOBBY" solid warm gold button
- "SPECTATE MATCH" outlined cream button (to watch remaining players)

Somber, definitive. The player has been eliminated. Respect the moment — no silly animations in the static design, but convey the weight of the loss.
```

---

## 15. VICTORY SCREEN

```
Design a victory/winner screen for "BANKROLL" game. Desktop, 1440x900.

Background: Deep charcoal #1A1A2E.

Centered content:

Top: A large trophy icon or a crown in warm gold #D4A843 (simple, geometric, elegant — not cartoony). About 100px tall.

Title: "VICTORY" in warm gold #D4A843, DM Serif Display, 48px, with very subtle letter spacing

Below: Player name "You" with a glowing gold avatar circle (gold border, slightly larger than normal)

Net Worth reached: "$3,120" in large cream text, 32px
"Win Target: $3,000 ✓" in emerald #2D6A4F

Prize payout card (dark navy #16213E, 450px wide, rounded 12px, gold 1px border):
- "PRIZE PAYOUT" in gold, DM Serif Display, 18px
- Divider
- Total Prize Pool: $10.00
- Platform Fee (10%): -$1.00
- Network Gas: ~$0.001  
- Divider
- "YOUR WINNINGS: $9.00 USDC" in large warm gold, 24px, bold
- "Deposited to your wallet" in emerald with a small checkmark
All values in cream, Inter font, right-aligned

Match stats below:
- Turns Played: 31
- Properties Owned at Win: 8
- Highest Rent Collected: $500 (Toronto)
- Prediction Market Wins: 3
All in cream, smaller text

Bottom buttons:
- "PLAY AGAIN" large solid gold button
- "RETURN TO LOBBY" outlined cream button

The feeling should be triumphant but classy — like winning at a high-end poker table. Gold accents, premium typography, clean layout. No confetti in the static design (that's for animation).
```

---

## 16. WALLET & PROFILE

```
Design a wallet and profile page for "BANKROLL" game. Desktop, 1440x900.

Background: Deep charcoal #1A1A2E.

TOP NAV BAR: Same as lobby — "BANKROLL" logo in gold, nav links, wallet chip.

Main content (centered, max-width 900px):

LEFT SECTION (55%) — WALLET:
- Section title: "Your Wallet" in cream, DM Serif Display, 24px
- Wallet address: "7xKQ...3mPn" with a copy icon, in muted gray, Inter 13px monospace

Balance card (dark navy #16213E, rounded 12px, full width):
  - Large balance: "◎ 12.5 SOL" in warm gold #D4A843, DM Serif Display, 36px
  - USD equivalent: "≈ $247.50 USD" in cream, Inter 16px
  - USDC balance: "42.00 USDC" in cream (game currency)
  - Divider
  - Two buttons side by side:
    - "DEPOSIT" solid gold button
    - "WITHDRAW" outlined cream button

Transaction history (below balance card):
- "Recent Transactions" in cream, DM Serif Display, 18px
- List of 4-5 transactions:
  - "Match Win — +$9.00 USDC" in emerald #2D6A4F, timestamp in muted gray
  - "Match Entry — -$5.00 USDC" in crimson #9B1B30, timestamp
  - "Match Win — +$9.00 USDC" in emerald
  - "Deposit — +$50.00 USDC" in cream
  Each row has a subtle bottom border in #333

RIGHT SECTION (45%) — PROFILE:
- Section title: "Profile" in cream, DM Serif Display, 24px

Profile card (dark navy, rounded 12px):
  - Large avatar circle (80px) in warm gold
  - Display name: "CryptoKing_42" in cream, editable (small pencil icon)
  - Member since: "March 2026" in muted gray

Stats grid (2x3 grid of stat boxes):
  - Total Matches: 22
  - Win Rate: 63%
  - Total Earnings: $126.00
  - Current ELO: 1,340
  - Highest Net Worth: $4,280
  - Favorite City: New York
  Each stat: value in gold, label in muted gray, inside a subtle dark charcoal box

Clean, financial dashboard aesthetic. Feels like a crypto portfolio app — trustworthy, data-rich, premium.
```

---

## 17. LEADERBOARD

```
Design a leaderboard page for "BANKROLL" game. Desktop, 1440x900.

Background: Deep charcoal #1A1A2E.

TOP NAV BAR: Same as lobby.

Main content (centered, max-width 900px):

Header section:
- "LEADERBOARD" in warm gold #D4A843, DM Serif Display, 32px
- Season label: "Season 1 — April 2026" in cream, Inter 14px
- Tab filters as pill buttons: "All Time" (selected — gold background, black text), "This Week", "Today" (unselected — outlined, cream text)

Top 3 podium section (horizontal, special treatment):
Three player cards side by side, the middle one (#1) slightly taller:

  #1 (center, tallest):
  - Gold border (2px), dark navy background
  - Crown/trophy icon in gold above
  - Avatar circle in gold
  - "Player_Alpha" in cream
  - "47 Wins" in gold, large
  - "$423.00 Earned" in cream
  - ELO: 1,890 in muted gray

  #2 (left):
  - Silver/cream border
  - "Player_Beta" 
  - "39 Wins" in cream
  - "$351.00 Earned"

  #3 (right):
  - Terracotta #E76F51 border (bronze feel)
  - "Player_Gamma"
  - "34 Wins"
  - "$306.00 Earned"

Below podium — Full leaderboard table (dark navy #16213E, rounded 12px):

Table headers in muted gray, Inter 12px uppercase: RANK | PLAYER | WINS | LOSSES | WIN % | EARNINGS | ELO

Table rows (alternating very subtle backgrounds — #16213E and #1A1A2E):
  4. Player_Delta | 31 | 14 | 69% | $279.00 | 1,720
  5. Player_Echo | 28 | 18 | 61% | $252.00 | 1,650
  6. Player_Foxtrot | 26 | 12 | 68% | $234.00 | 1,610
  7. Player_Golf | 25 | 20 | 56% | $225.00 | 1,580
  ... (show about 8 rows)

Highlighted row (your rank): 
  12. You (CryptoKing_42) — highlighted with a subtle gold left border and slightly lighter background

Numbers in cream, player names in cream, earnings in warm gold.

Bottom: Pagination — "← Previous | Page 1 of 24 | Next →" in cream, Inter 13px

Clean, competitive, data-driven. Like a sports ranking table with premium dark styling.
```

---

## DESIGN SYSTEM NOTES FOR STITCH

If Stitch supports setting a design system, use these tokens:

```
Colors:
- Primary Background: #1A1A2E (deep charcoal)
- Secondary Background: #16213E (rich dark navy) 
- Surface/Cards: #16213E
- Tile/Card Body: #F5F0E8 (warm off-white)
- Primary Text: #F0E6D2 (cream)
- Secondary Text: #888888 (muted gray)
- Accent: #D4A843 (warm gold)
- Success: #2D6A4F (rich emerald)
- Danger: #9B1B30 (deep crimson)  
- Warning: #E9A820 (warm amber)

Tier Colors:
- Green: #2D6A4F
- Blue: #1D3557
- Orange: #E76F51
- Purple: #6A4C93
- Red: #C1121F

Typography:
- Headings/Names: DM Serif Display
- Body/Numbers/UI: Inter
- Corner radius: 8px buttons, 12px cards, 16px modals

General Rules:
- No gradients
- No glow effects  
- No neon colors
- Subtle shadows only (2px blur, 10% opacity)
- Solid color fills for buttons
- 1px borders in #333 for subtle separation
```
