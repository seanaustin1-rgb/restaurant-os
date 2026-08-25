# Gemini Handoff — Spirit Vault Content Population

## What this is

You are helping populate the Spirit Vault for **Echo**, a cocktail bar and
restaurant. The Spirit Vault is a hosted membership product where paying guests
get access to dossiers on every spirit the bar carries — tasting profiles,
curator notes, flavor radar charts, food pairings, and curated tasting flights.

The bar owner/curator is **Sean Austin**. His voice is knowledgeable but
approachable — a spirits enthusiast who wants guests to explore confidently, not
a snobby sommelier. Think "trusted friend who knows whiskey" not "whiskey
textbook."

## Your task

You will receive a JSON array of ~200 spirits. Each spirit has:
- **Read-only identity fields** (brand, expression, category, proof, age, etc.)
  — these are correct, do not change them.
- **Content fields that need populating** — many are null, empty, or carry
  generic defaults (body/finish = 5). Fill these with accurate, thoughtful
  content.

## Exact schema for the content fields you populate

For each spirit in the array, populate these fields. **Return the full array
with all fields — both read-only and populated.**

### Sensory Profile (integer 0–10 scale)

| Field | Type | Description |
|-------|------|-------------|
| `body` | integer 0–10 | Mouthfeel weight. 0 = water-thin, 5 = medium, 10 = full/viscous/chewy. |
| `finish` | integer 0–10 | How long the flavor lingers. 0 = vanishes, 5 = moderate, 10 = marathon finish. |
| `flavor.Sweet` | integer 0–10 | Caramel, honey, vanilla, brown sugar, maple. |
| `flavor.Oak` | integer 0–10 | Barrel char, wood tannins, vanilla from wood, sawdust. |
| `flavor.Spice` | integer 0–10 | Black pepper, cinnamon, clove, rye spice, ginger. |
| `flavor.Fruit` | integer 0–10 | Stone fruit, citrus, dried fruit, berry, tropical. |
| `flavor.Smoke` | integer 0–10 | Peat smoke, campfire, charcoal, smoked meat. |
| `flavor.Earth` | integer 0–10 | Leather, tobacco, mineral, wet stone, forest floor. |
| `flavor.Herbal` | integer 0–10 | Mint, eucalyptus, grass, herbal tea, botanical. |

**Guidelines for scoring:**
- A bourbon typically: Sweet 6–8, Oak 5–7, Spice 3–5, Fruit 3–5, Smoke 1–3, Earth 2–4, Herbal 1–3
- A peated Scotch typically: Sweet 2–4, Oak 4–6, Spice 3–5, Fruit 2–4, Smoke 7–9, Earth 5–7, Herbal 2–4
- An añejo tequila typically: Sweet 5–7, Oak 4–6, Spice 3–5, Fruit 3–5, Smoke 1–2, Earth 4–6, Herbal 3–5
- Don't cluster everything at 5 — be decisive. Every spirit should have a distinctive shape on the radar.

### Top Notes (exactly 3 strings)

| Field | Type | Constraint |
|-------|------|-----------|
| `topNotes` | string[3] | Exactly 3 entries. Each is a short flavor descriptor (1–3 words). |

These are the three dominant flavors a guest will notice. Examples:
- Bourbon: `["Caramel", "Vanilla", "Baking Spice"]`
- Peated Scotch: `["Peat Smoke", "Sea Salt", "Dark Fruit"]`
- Rye: `["Black Pepper", "Cherry", "Cinnamon"]`
- Mezcal: `["Roasted Agave", "Citrus", "Mineral"]`

Be specific — "Dark Cherry" is better than "Fruit." Each spirit should have
distinctive notes, not generic category defaults.

### Pairings (string array, 2–5 entries)

| Field | Type | Constraint |
|-------|------|-----------|
| `pairings` | string[] | 2–5 food pairings. Short phrases. |

These are food pairings for the bar context. Think appetizer/small plate scale,
not full entrees. Examples:
- `["Dark chocolate", "Smoked almonds", "Blue cheese", "Charcuterie"]`
- `["Grilled peach", "Aged cheddar", "Candied pecans"]`
- `["Ceviche", "Grilled pineapple", "Spicy shrimp"]`

### Editorial — whyShort (1 sentence)

| Field | Type | Constraint |
|-------|------|-----------|
| `whyShort` | string | One sentence (max ~120 chars). Objective merit statement — why this spirit matters. |

This is the above-the-fold hook. No venue-specific claims. Speak to what makes
this bottle noteworthy — its distillery, its process, its place in the category.

**Examples:**
- "A single-barrel, barrel-proof bourbon from a 200-year-old Kentucky distillery that still uses copper pot stills."
- "One of the last independently produced Highland single malts, aged exclusively in first-fill sherry casks."
- "A joven mezcal from wild tobalá agave, pit-roasted by a fourth-generation maestro mezcalero in Oaxaca."

### Sean's Voice (venue-specific, personal)

| Field | Type | Description |
|-------|------|-------------|
| `whyWeCarry` | string or null | 2–4 sentences. Why Echo carries this bottle. Guest-facing. First person plural ("we"). No fabricated claims about the venue — speak to the spirit's merit and what it offers guests. |
| `seanShort` | string or null | One short sentence (max ~80 chars). A curator cue — what Sean would say if you asked him about this bottle at the bar. Informal, confident, direct. Displayed as a pull-quote. |
| `notes` | string or null | 1–3 sentences. Sean's personal tasting note, shown in a signed gold drawer on the guest dossier. Subjective, first person ("I find…", "This reminds me of…"). Warm, not clinical. |

**Voice examples for a bourbon:**
- `whyWeCarry`: "We carry this because it's the perfect bridge for someone stepping up from standard bourbon. The barrel proof means you're tasting it exactly as the distiller intended — no water added, no dilution. It rewards patience and a single ice cube."
- `seanShort`: "Ask for it with one cube and give it two minutes."
- `notes`: "I get brown butter and toasted pecan on the nose, then a wave of dark caramel that keeps evolving. The finish is warm cinnamon that stays with you through the next bite."

**Voice examples for a mezcal:**
- `whyWeCarry`: "This is how we introduce guests to mezcal who think they don't like it. The smoke is there, but it's gentle — more smoldering campfire than ashtray. It opens up a whole world."
- `seanShort`: "This is the one that converts people."
- `notes`: "I taste roasted pineapple and a clean mineral finish that makes me think of wet river stones. It's savory without being heavy."

**Tone rules:**
- Sean is knowledgeable but never pretentious. He talks like a friend, not a textbook.
- "This is incredible" > "This exemplary expression showcases"
- Specific sensory details > vague praise
- It's OK to be enthusiastic. It's not OK to be generic.
- If you genuinely can't write a distinctive note for a spirit (too obscure, too little information), set the voice fields to `null` rather than writing something generic. Sean will fill those in himself.

## Output format

Return a single JSON array. Each entry must have ALL fields from the input
(read-only fields unchanged) plus your populated content fields.

```json
[
  {
    "venueSpirit_id": "clxyz...",
    "definition_slug": "buffalo-trace",
    "venue_slug": "buffalo-trace",
    "brand": "Buffalo Trace",
    "expression": null,
    "displayName": null,
    "category": "Bourbon",
    "subcategory": null,
    "style": null,
    "country": "USA",
    "region": "Kentucky",
    "distilleryName": "Buffalo Trace Distillery",
    "producerName": "Sazerac Company",
    "proofN": 90,
    "proofDisplay": null,
    "ageText": "NAS",
    "minYears": null,
    "maxYears": null,
    "recordStatus": "DRAFT",
    "publicationStatus": "DRAFT",
    "pours": [{"sizeOz": 2, "priceUsd": 12, "label": null, "isPrimary": true, "availability": null}],

    "body": 6,
    "finish": 6,
    "flavor": {"Sweet": 7, "Oak": 5, "Spice": 4, "Fruit": 5, "Smoke": 2, "Earth": 3, "Herbal": 2},
    "topNotes": ["Caramel", "Vanilla", "Toffee"],
    "pairings": ["Dark chocolate", "Smoked almonds", "Apple tart", "Aged gouda"],
    "whyShort": "The flagship bourbon from one of America's oldest continuously operating distilleries, using mashbill #1 since the 1800s.",
    "whyWeCarry": "We carry Buffalo Trace because it's the starting point of a conversation. At this price, there's no excuse not to explore bourbon, and this bottle punches well above its weight. It's our recommendation for anyone who says 'I don't know what I like yet.'",
    "seanShort": "The best bourbon under $15 you'll ever pour.",
    "notes": "I always come back to this one when I want something uncomplicated but not boring. Toffee and vanilla up front, a little orange peel mid-palate, and a clean finish that doesn't overstay. It's the workhorse."
  }
]
```

## Validation rules (your output MUST pass these)

- `body` and `finish`: integer, 0–10 inclusive
- `flavor.*`: all 7 axes present, each integer 0–10
- `topNotes`: exactly 3 non-empty strings
- `pairings`: 2–5 non-empty strings
- `whyShort`: non-empty string, ~120 chars max
- `whyWeCarry`: string or null, 2–4 sentences when present
- `seanShort`: string or null, ~80 chars max when present
- `notes`: string or null, 1–3 sentences when present
- All read-only fields (`venueSpirit_id`, `definition_slug`, `venue_slug`, `brand`, `expression`, etc.): returned exactly as received, unchanged

## New schema suggestions

After populating all spirits, add a separate top-level key `"schema_suggestions"`
with any fields you think are missing from our data model. For each suggestion:

```json
{
  "schema_suggestions": [
    {
      "field_name": "mashBill",
      "type": "string | null",
      "where": "SpiritDefinition",
      "reason": "Many bourbons and ryes have known mash bills (e.g., '75% corn, 21% rye, 4% malted barley') that guests ask about. Currently buried in production JSON if present at all.",
      "example_values": ["75% corn, 21% rye, 4% malted barley", "95% rye, 5% malted barley"]
    }
  ]
}
```

Think about what a spirits-knowledgeable bar guest would want to see, compare,
or filter by that we don't currently capture as a first-class field. Consider:
- Production method fields (pot still vs column, fermentation, water source)
- Classification/certification fields (bottled-in-bond, single barrel, cask strength)
- Comparison/discovery fields (similar spirits, flavor family, complexity rating)
- Serving suggestion fields (ideal glassware, recommended ice/water, temperature)
- Cocktail context (classic cocktails this spirit works in)

Flag these — don't add them to the spirit objects. We'll build them into the
schema first if we want them.

## The spirit data

Paste the contents of `spirits-export.json` below this line:

---

[PASTE spirits-export.json HERE]
