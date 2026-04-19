# Design System Specification: The Gilded Table

## 1. Overview & Creative North Star: "The Digital Collector"
This design system is built upon the concept of **The Digital Collector**. We are moving away from the "utility app" aesthetic and toward a high-fidelity, tactile experience that feels like opening a bespoke, limited-edition board game box. 

The design rejects the rigid, flat-web standards of the last decade. Instead, it embraces **Atmospheric Depth**. By using intentional asymmetry, overlapping physical layers, and a "No-Line" philosophy, we create an environment that feels expensive, quiet, and authoritative. Every element should feel like a physical object placed on a dark, polished surface—weighted, intentional, and permanent.

---

## 2. Color & Materiality
The palette is rooted in deep, nocturnal tones juxtaposed against high-luster metallic accents and matte "paper" surfaces.

### The Palette (Material Mapping)
- **Primary / Accent:** `primary` (#f2c35b) & `primary_container` (#d4a843). This represents the "Gold" leafing. Use it sparingly for critical actions and brand moments.
- **Surface Foundations:** `surface` (#111125) and `surface_container_low` (#1a1a2e). These are your "Dark Charcoal" bases.
- **The "Board" Layer:** `on_secondary_container` (#aab4d9) and `secondary_container` (#3b4665). These provide the "Dark Navy" depth.
- **The Property Tiers:** Use the tertiary and error tokens for game-specific logic:
  - **Forest Green:** `on_tertiary_fixed_variant` (#0e5138)
  - **Amethyst:** `on_secondary_fixed_variant` (#3b4665) / Custom
  - **Crimson:** `error_container` (#93000a)

### The "No-Line" Rule
**Prohibit 1px solid borders.** To define sections, you must use color shifts. A property card (`surface_container_highest`) sits on the board (`surface_container_low`) without a stroke. The boundary is the color change itself.

### The Glass & Gradient Rule
Floating HUD elements must utilize **Glassmorphism**. 
- **Recipe:** `surface_container` at 80% opacity + 20px Backdrop Blur.
- **CTAs:** Use a subtle linear gradient from `primary` (#f2c35b) to `primary_container` (#d4a843) at a 135-degree angle to simulate the shimmer of gold leaf.

---

## 3. Typography: Editorial Authority
We pair a high-contrast serif with a technical sans-serif to bridge the gap between "Vintage Wealth" and "Modern Precision."

*   **Display & Headlines (DM Serif Display / Noto Serif):** Used for property names, major titles, and "Bankroll" moments. It should feel like a masthead.
    *   `display-lg`: 3.5rem. Use for win/loss states.
    *   `headline-md`: 1.75rem. Use for Property Titles on cards.
*   **UI & Data (Inter):** Used for numbers, button labels, and descriptions.
    *   `title-sm`: 1rem (Bold). Use for currency values.
    *   `label-md`: 0.75rem. Use for micro-copy and legal/fine print on cards.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "web." We use **Ambient Occlusion** logic.

- **The Layering Principle:** 
    1.  **Floor:** `surface_dim` (#111125)
    2.  **The Board:** `surface_container_low` (#1a1a2e)
    3.  **The HUD/Cards:** `surface_container_highest` (#333348)
- **Ambient Shadows:** For floating elements, use a `48px` blur with 6% opacity, using the color `surface_container_lowest`. It should feel like the element is hovering 2 inches off the table, caught in soft room light.
- **The Ghost Border:** If a property card needs a container (e.g., on a similar colored background), use `outline_variant` (#4e4636) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: The Tactile Kit

### Buttons (The "Seal")
- **Primary:** `primary_container` background with `on_primary` text. No border. Roundedness: `md` (0.75rem).
- **Secondary (Ghost):** No background. `outline` (#9a8f7d) text. Underline on hover only.
- **Tactile State:** On press, scale the button to 98% to simulate physical depression into the "felt."

### Property Cards (The "Matte Paper")
- **Header:** Use Tier Colors (Forest, Crimson, etc.) as a solid block at the top.
- **Body:** `surface_container_highest` (#333348) or Cream (#F5F0E8) for light-mode variants.
- **Typography:** Center-aligned `headline-sm` (Serif) for the name, followed by a `label-md` (Inter) for the price.
- **Separation:** No lines. Use 16px of vertical whitespace between the title and the rent table.

### Floating HUD (The "Dashboard")
- **Construction:** A single, centered floating pill at the bottom of the screen. 
- **Material:** Glassmorphic `surface_container` with a `lg` (1rem) corner radius.
- **Content:** Icons should be `primary` gold. Text should be `on_surface` cream.

### Input Fields
- **Style:** Bottom-border only, using `outline_variant` at 40%. 
- **Focus State:** Border transitions to `primary` gold with a soft glow (4px blur).

---

## 6. Do's and Don'ts

### Do:
- **Do** use asymmetrical layouts for the HUD. If the player's balance is on the left, balance it with a "Trade" action on the far right, leaving the center empty for "The Board."
- **Do** treat "White Space" as "Expensive Space." Breathing room is the ultimate sign of luxury.
- **Do** use `inter` for all numbers. Serifs are for names; Sans-serifs are for math.

### Don't:
- **Don't** use pure black (#000) or pure white (#FFF). Use our charcoal and cream tokens to maintain the "matte" feel.
- **Don't** use standard "Material Design" FABs (Floating Action Buttons). Our actions should feel integrated into the game's architecture.
- **Don't** use dividers or "HR" lines. If two pieces of content are different, move them further apart or change their container tone.

### Accessibility Note:
While we lean into subtle tonal shifts, ensure that `on_surface` text on `surface_container` maintains at least a 4.5:1 contrast ratio. Use the `primary` gold for critical interactive cues to ensure they are never missed.