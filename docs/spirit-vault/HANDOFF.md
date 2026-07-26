# Spirit Vault — Handoff (Claude → Codex)

**Date:** 2026-07-26
**Owner:** Sean Austin — Echo's Reserve / Stone Grille & Taphouse (rebranding to Barrel & Bond), York PA
**Deliverable:** `spirit-vault-prototype.html` (same folder) — single-file, self-contained, no build step.

## What this is

Brag Book v2. Guests scan a temporary QR code from the bartender and get a data-rich
per-bottle dashboard ("dossier") for the Echo's Reserve spirits program — Apple
Health / OutfrontData energy, not a webpage or digital menu. QR sessions expire
after 4 hours by design: the Vault is only open while you're in the building.

The prototype implements the full design brief with **5 of 164 dossiers built**:
Penelope Barrel Strength, Chicken Cock 5 Year, Macallan 12 Double Cask,
Don Fulano Blanco Fuerte, Diplomático Reserva Exclusiva.

## What's implemented (per dossier)

- Hero: category, bottle silhouette (SVG, per-category), name, distillery,
  availability chips, proof / age / price / category spec row, style line
- Flavor Dashboard: 7-axis SVG radar (Sweet, Oak, Spice, Fruit, Smoke, Earth,
  Herbal, 0–10) + intensity bars + Body / Finish meta bars
- Production spec grid + attribute tags (Small Batch, Cask Strength, etc.)
- Why It Matters (curated commentary, not marketing copy)
- Recognition badges (medal SVG icons)
- "If You Enjoy This" compare cards — cross-linked; cards whose target has a
  built dossier deep-link to it, others say "dossier at launch"
- At the Table pairings (cheese / charcuterie / entrée / dessert / cocktail)
- Distillery: location plate w/ coordinates + ping graphic, history paragraph,
  vertical timeline
- Behind the Bottle: stat grid + fact list
- Sean's Notes: signed curator card (visually distinct, gold-bordered)
- Availability states: available / low / reserve-room-only / flight / event bottle

App-level: Vault browse view (grid + working filters: category, proof bucket,
flavor lean), swipe + arrow-key navigation between bottles, dot pager, mock
4-hour session countdown chip in the header.

## Architecture / conventions

- Single HTML file. Fonts: Playfair Display / Cormorant Garamond / DM Mono
  (Google Fonts) — same design DNA as `echo-reserve.html` on the live site,
  evolved data-forward. CSS custom props at top (`--ink`, `--gold`, etc.).
- All data lives in the `BOTTLES` array (top of the `<script>`). One object per
  bottle; `FLAVOR_AXES` order is fixed. Adding a dossier = adding an object.
  No framework, no dependencies, no localStorage.
- Renderers: `renderDetail(i)`, `renderVault()`, `radarSVG()`, `bottleSVG()`.
- Live site context: stonegrilleandtaphouse.com, static files on Bluehost at
  `/home1/thecopp3/website_f69777da/` (index.html, echo-reserve.html,
  chicken-cock-event.html). Existing Cloudflare Workers owned by Sean:
  `toast-proxy.seanaustin1.workers.dev` (calendar events),
  `mailchimp-proxy.seanaustin1.workers.dev` (signups).

## Known placeholders — DO NOT ship without fixing

1. **Pour prices** ($11–$16) are guesses. Sean supplies real numbers.
2. **Award badges** are directionally right but unverified. Verify every claim
   before launch/print.
3. **Availability statuses** are staged for demo variety.
4. **Sean's Notes** are drafted in his voice; he reviews/rewrites.
5. Session countdown is cosmetic — no real token check yet.
6. Bottle images are SVG silhouettes; real bottle photography planned.

## Planned next steps (agreed direction, not yet built)

1. **QR session backend:** Cloudflare Worker issuing signed 4-hour tokens
   (matches Sean's existing worker stack). Bartender screen generates QR →
   dashboard validates token → expired = "come back to the bar" screen.
2. Scale data entry from 5 → 164 dossiers (full list lives in
   `echo-reserve.html`'s `DEFAULT_SPIRITS` array — names, categories, details).
3. Future features (footer teaser already in UI): Save Favorites, Build Your
   Own Flight, Recently Viewed, Upcoming Tastings, Cocktail Recipes.
4. Real bottle photos to replace silhouettes.

## Design brief (source of truth)

Layered information; first screen answers "What am I drinking / why is it
special / what does it taste like." Cards, not walls of text. Graphics over
paragraphs. Bloomberg Terminal meets luxury whiskey library. Guests should
think: "I've never seen a spirits experience like this before."
