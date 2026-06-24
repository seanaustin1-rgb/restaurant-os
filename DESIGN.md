---
name: OutFront Data
description: A calm, dark instrument panel that turns scattered financial signals into an industry-specific heartbeat.
colors:
  ink: "#0B0D0B"
  surface: "#141614"
  line: "#232623"
  ink-text: "#E6E8E4"
  muted: "#8A8F89"
  copper: "#C8873A"
  copper-soft: "#D9A35E"
  copper-dim: "#7A5526"
  health-green: "#5FA777"
  health-yellow: "#D9A35E"
  health-red: "#C8643A"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "normal"
  title:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.2
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.08em"
  numeric:
    fontFamily: "Space Mono, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 400
    letterSpacing: "-0.01em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.copper-soft}"
    textColor: "{colors.ink}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: OutFront Data

## 1. Overview

**Creative North Star: "The Operator's Instrument Panel"**

OutFront Data reads like the instrument panel of a well-run business after dark — a calm, low-glow surface where a tired owner can glance once and know whether they are safe, profitable, and what is pressuring them. The mood is a quiet cockpit, not a trading floor: matte near-black surfaces, warm copper for the one thing that matters right now, and crisp monospaced figures that feel measured and true. It is credible the way a good ledger is credible — and warm the way a serif headline is warm — without ever tipping into flashy.

The system rejects the visual clichés of its category. It is **not** generic SaaS (no cream-and-navy, no gradient hero metric, no identical card grid), **not** a bank-connection scare screen, **not** over-technical accounting software that buries meaning in jargon, and **not** a flashy AI toy that promises intelligence without showing real numbers. Every screen must show the heartbeat first and explain the money in plain language, so the owner feels informed, never judged or trapped in setup.

Density is earned: scan-friendly and calm on a phone for a quick check, dense and repeatable on desktop for daily work. Color is rationed — the surface is quiet so that a single copper accent or a health signal carries real weight.

**Key Characteristics:**
- Matte near-black canvas; warmth from copper + serif, never from a tinted "warm" background.
- Monospaced tabular figures for every number, so columns align and metrics feel exact.
- One copper accent, rationed. Health status (green/yellow/red) is a separate, labeled vocabulary.
- Serif display headings over a clean sans body — credible, calm, a little editorial.
- Restraint as the default; "cool factor" comes from precision and motion, not decoration.

## 2. Colors

A rationed dark palette: a near-black ground, two quiet panel neutrals, one copper voice, and a strictly-separate health-status triad.

### Primary
- **Copper** (#C8873A): The single brand voice. Primary actions (Start free, See my estimate), the current selection, brand marks, and the one number on a screen that should pull the eye. Used sparingly — its rarity is the point.
- **Copper Soft** (#D9A35E): Hover/active state for copper, and copper-on-dark links and icon accents where the deep copper would read too dim.
- **Copper Dim** (#7A5526): Quiet copper for borders, tinted callout backgrounds (`copper-dim/10`), and de-emphasized accent edges.

### Neutral
- **Ink** (#0B0D0B): The app ground and the inside of input fields. The matte near-black everything sits on.
- **Surface** (#141614): Cards, panels, popovers, the second tonal layer that lifts content off Ink.
- **Line** (#232623): Hairline borders and dividers. Structure is drawn with thin lines, not shadows.
- **Ink Text** (#E6E8E4): Primary body and heading text — an off-white tuned for long, comfortable reading on Ink.
- **Muted** (#8A8F89): Secondary text, labels, captions. Use for de-emphasis only; never for primary numbers or body a user must read at length.

### Tertiary — Health Status (a separate, labeled vocabulary)
- **Health Green** (#5FA777): On-target / safe / healthy.
- **Health Yellow** (#D9A35E): Watch / thin / approaching a limit.
- **Health Red** (#C8643A): Off-target / shortfall / warning.

### Named Rules
**The One Voice Rule.** Copper appears on roughly ≤10% of any screen. It marks the primary action, the current selection, and the single most important figure — nothing decorative. If two things are copper, one is wrong.

**The Status-Is-Not-Decoration Rule.** Green/yellow/red belong to financial health *only*, and never carry meaning by color alone — always pair with a word, number, or icon (PRODUCT.md: "Financial status cannot rely on color alone"). Note that Health Yellow and Copper Soft share a hex (#D9A35E); never let a copper accent read as a "watch" status or vice versa — separate them by context, label, and shape.

**The Quiet-Ground Rule.** The background stays Ink. Warmth is carried by copper, the serif, and the data — never by tinting the canvas toward cream, sand, or "warm" neutral.

## 3. Typography

**Display Font:** Cormorant Garamond (fallback Georgia, serif)
**Body Font:** DM Sans (fallback system-ui, sans-serif)
**Numeric/Mono Font:** Space Mono (fallback ui-monospace) — every metric, via the `.tnum` utility

**Character:** A high-contrast pairing on purpose: a warm, slightly editorial serif for headings gives the product gravity and calm, while a clean geometric-humanist sans keeps the working UI legible and modern. Numbers break to monospace so financial figures align in columns and read as exact.

### Hierarchy
- **Display** (Cormorant, 500, ~2.25rem / text-4xl, line-height ~1.1): Page and hero headings ("What would your dashboard say?"), restaurant/tenant name on the dashboard.
- **Title** (Cormorant, 500, ~1.25rem / text-xl–2xl): Section and module headings ("Modules", module titles).
- **Body** (DM Sans, 400, 0.875rem / text-sm, line-height ~1.6): Explanatory copy, helper text, descriptions. Cap prose at 65–75ch.
- **Label** (DM Sans, 500, ~0.6875rem / text-[11px], letter-spacing 0.08em, UPPERCASE): Tile kickers and metadata ("OVERALL REPUTATION", source names). The one place tracked-uppercase is sanctioned — as a tile label, not as a section eyebrow.
- **Numeric** (Space Mono, `.tnum`, tabular-nums, letter-spacing -0.01em): Every dollar figure, percentage, rating, and count. Sizes scale with emphasis (text-xl → text-4xl) but the family never changes.

### Named Rules
**The Every-Number-Is-Mono Rule.** All metrics use `.tnum` (Space Mono, tabular figures). A dollar amount or percentage rendered in the body sans is a bug.

**The Serif-Stays-In-Headings Rule.** Cormorant is for display and titles only — never for buttons, labels, inputs, table data, or anything a user operates. UI controls are DM Sans.

## 4. Elevation

A flat, line-drawn system. Depth comes from **tonal layering** (Ink ground → Surface panels) and **hairline borders** (Line), not from shadows. The interface looks like matte cards cut from slightly different shades of the same dark material, separated by thin strokes — calm and precise, never lifted or glassy.

### Named Rules
**The No-Shadow Rule.** Surfaces are flat. Separation is achieved with the Ink→Surface tonal step and a 1px Line border. Drop shadows, glows, and glassmorphism (blur/backdrop-filter as decoration) are prohibited — they read as the "flashy AI toy" PRODUCT.md rejects. The rare exception is a functional focus ring or a deliberate dropdown/popover lift, never ambient decoration.

## 5. Components

### Buttons
- **Shape:** Gently rounded (md, 8px). Never pill-shaped, never square.
- **Primary:** Solid Copper (#C8873A) background, Ink (#0B0D0B) text, ~10px/20px padding, weight 500. The page's main commitment (Start free, See my estimate).
- **Hover / Focus:** Background shifts to Copper Soft (#D9A35E); 150–250ms transition. Focus shows a visible ring (never remove the outline).
- **Secondary / Ghost:** Surface (#141614) background with a Line (#232623) border, Ink Text label; hover lifts the border to Copper Dim. For sign-in, "Adjust numbers", and tertiary actions.

### Cards / Containers
- **Corner Style:** 8px (lg use 12px for marketing/demo tiles).
- **Background:** Surface (#141614) on the Ink ground; de-emphasized/locked cards use `surface/40–50` with reduced opacity.
- **Shadow Strategy:** None — see Elevation. Lift with the tonal step + Line border.
- **Border:** 1px Line (#232623); hover may raise to Copper Dim. Dashed Line for "not connected / empty" states.
- **Internal Padding:** 16px (md) typical; 12–20px range.

### Inputs / Fields
- **Style:** Ink (#0B0D0B) field on Surface, 1px Line border, 8px radius, Ink Text value, Muted placeholder. Numeric inputs carry `.tnum`.
- **Focus:** Border shifts to Copper Soft (#D9A35E). Keep the focus visible and high-contrast.
- **Prefix/Suffix:** `$` / `%` adornments sit Muted inside the field.

### Chips / Badges
- **Style:** Pill (full radius), 1px border, ~10–11px label. Two families: a neutral metadata pill (Line border, Muted text) and a status badge that tints toward its health hue (e.g. green badge = `health-green/10` fill, `health-green/30` border, Health Green text).

### Health Gauge / Status Signal (signature component)
The product's defining pattern: a metric with a green/yellow/red zone bar, a value marker, the figure in mono, and — always — a text note ("3.2 pts over — high vs. peers"). The color is the fast read; the label and number are the honest read. This component is where "show the math, never overclaim" lives. Status must remain legible to a color-blind user with the bar, label, and value removed of color.

### Navigation
- App shell: a sticky top bar on Ink with a tenant switcher (serif name), a role selector, and a single nav menu; copper marks the active context. Mobile collapses to the menu; keep targets ≥44px and the bar dense but scannable.

## 6. Do's and Don'ts

### Do:
- **Do** show the heartbeat first — meaningful financial feedback before every source is connected (manual estimates, sample tours, live data all point to action).
- **Do** render every number in Space Mono via `.tnum`.
- **Do** pair every green/yellow/red signal with a label, number, or icon, and verify AA contrast on the dark surface (body text ≥4.5:1; large/bold ≥3:1).
- **Do** ration copper to ~one accent per view; let the quiet ground give it weight.
- **Do** separate panels with the Ink→Surface tonal step and a 1px Line border.
- **Do** make each industry *feel* modeled — metrics, copy, and emphasis that match a contractor vs. a brokerage vs. a restaurant, not the same dashboard relabeled.
- **Do** write the money in plain language; teach while diagnosing.
- **Do** keep motion to 150–250ms, conveying state (change, feedback, loading), and honor `prefers-reduced-motion`.

### Don't:
- **Don't** make it look like generic SaaS — no cream/sand body background, no gradient hero-metric template, no endless identical icon-heading-text card grid.
- **Don't** use glassmorphism, decorative drop shadows/glows, or gradient text (`background-clip: text`). The brand is calm and credible, not a flashy AI toy.
- **Don't** use a colored `border-left`/`border-right` stripe as an accent on cards, alerts, or list items. Use full borders, tints, or leading numbers/icons.
- **Don't** convey financial status with color alone (PRODUCT.md: "red/yellow/green signals need labels, text, or icons").
- **Don't** let Copper and Health Yellow (both #D9A35E) blur roles — an accent is not a "watch" status.
- **Don't** tint the Ink ground toward warm "because the brand feels warm"; warmth is copper + serif + data.
- **Don't** put the serif (Cormorant) in buttons, labels, inputs, or table data; UI controls are DM Sans.
- **Don't** trap the owner in setup before showing value, or bury meaning in accountant jargon.
- **Don't** reach for a modal as the first answer; exhaust inline / progressive disclosure first.
