/* ═══════════════════════════════════════════════════════════════════════
   SPIRIT VAULT — CANONICAL DATA PAYLOAD
   ───────────────────────────────────────────────────────────────────────
   External, self-contained spirit records. One canonical record per bottle
   (the two-map SPIRIT_DATA + DOSSIER_DETAILS split is retired — the five
   legacy records are now single objects here). Loaded via <script src> before
   the prototype's inline engine; no fetch(), so it works under file://, the
   local static preview, and hosted static (Bluehost). The engine consumes the
   returned array through normalizeSpiritRecords() → BOTTLES exactly as before.

   Authoring a new spirit: add ONE record to BATCH via makeBatchSpirit({...}),
   or append a single canonical object. Never split a record across two places.
   ═══════════════════════════════════════════════════════════════════════ */
window.SPIRIT_VAULT_DATA = function(ctx){
  var makeBatchSpirit = ctx.makeBatchSpirit;

  var SOURCE_URLS = {
    sagamoreSmallBatch:'https://sagamorespirit.com/spirits/sagamore-small-batch-rye-whiskey/',
    sagamoreDoubleOak:'https://sagamorespirit.com/spirits/double-oak-rye-whiskey/',
    sagamoreManhattan:'https://sagamorespirit.com/spirits/manhattan-finish/',
    knobCreekSingleBarrel:'https://www.knobcreek.com/single-barrel-experience',
    bulleit10:'https://www.bulleit.com/whiskeys/bulleit-10-year-aged-whiskeys',
    oldForester1870:'https://www.oldforester.com/products/old-forester-1870-original-batch-whisky/',
    oldForester1897:'https://www.oldforester.com/products/old-forester-1897-bottled-in-bond-whisky/',
    oldForester1910:'https://www.oldforester.com/products/old-forester-1910-old-fine-whisky/',
    oldForester1920:'https://www.oldforester.com/products/old-forester-1920-style-prohibition-whisky/',
    oldForesterRye:'https://www.oldforester.com/products/old-forester-100-proof-rye-whisky/',
    oldForesterSingleBarrelRye:'https://abc2.nc.gov/Pricing/ViewItemDetails/149785',
    whistlepigSnoutToTail:'https://www.whistlepigwhiskey.com/whiskeys/snout-to-tail-bourbon-aged-10-years',
    jepthaBib:'https://jepthacreed.com/product/bottled-in-bond-bourbon/',
    jepthaFourGrain:'https://shop.jepthacreed.com/products/jeptha-creed-straight-four-grain-bourbon',
    jepthaWheated:'https://jepthacreed.com/product/six-year-old-wheated-bourbon/',
  };

  // ── Legacy five — now single canonical records (merged from the retired
  //    SPIRIT_DATA + DOSSIER_DETAILS split; values identical to pre-migration). ──
  var LEGACY = [
  {
    "id": "penelope-barrel-strength",
    "cat": "Bourbon",
    "silo": "bourbon",
    "name": "Penelope Barrel Strength",
    "distillery": "Penelope Bourbon · Lawrenceburg, Indiana",
    "style": "Four-Grain Straight Bourbon · Barrel Strength",
    "proof": "116.2",
    "proofN": 116.2,
    "age": "4–5 yr",
    "price": "$14",
    "priceL": "2 oz pour",
    "status": [
      { "k": "available", "t": "Currently Available" },
      { "k": "flight", "t": "Flight Available" }
    ],
    "flavor": { "Sweet": 7, "Oak": 6, "Spice": 6, "Fruit": 5, "Smoke": 1, "Earth": 3, "Herbal": 2 },
    "body": 7,
    "finish": 7,
    "production": [
      ["Mash Bill", "Blend of three bourbon mash bills — corn, rye, wheat & malted barley (four-grain)", true],
      ["Distillation", "Column & doubler · MGP, Lawrenceburg IN"],
      ["Barrel", "New charred American oak · #4 char"],
      ["Entry Proof", "120"],
      ["Bottling Proof", "Barrel strength · batch varies"],
      ["Filtration", "Non-chill filtered"]
    ],
    "prodTags": ["Small Batch", "Cask Strength", "Non-Chill Filtered", "Batch Numbered"],
    "why": "Most barrel-strength bourbons lead with heat. This one leads with <em>architecture</em> — three separate mash bills blended so wheat rounds what rye sharpens. Blending is usually Scotland's game; Penelope plays it with Indiana bourbon stock and wins. Pound for pound, one of the strongest value plays in the barrel-proof category.",
    "awards": [
      { "t": "Double Gold", "s": "San Francisco World Spirits" },
      { "t": "93 Points", "s": "Whisky Advocate" }
    ],
    "compare": [
      { "name": "Penelope Project X Oloroso", "d": "Sherry Barrel Finish", "why": "Same house, darker turn", "link": null, "invault": true },
      { "name": "Maker's Mark Cask Strength", "d": "Wheated · Cask Strength", "why": "Softer grain, same muscle", "invault": true },
      { "name": "Booker's", "d": "Barrel Proof · Unfiltered", "why": "The old-guard benchmark", "invault": true },
      { "name": "New Riff Single Barrel", "d": "Single Barrel · Straight", "why": "One barrel, no blending — the counter-argument", "invault": true },
      { "name": "Old Grand-Dad 7 Year", "d": "100 Proof · High-Rye", "why": "Rye-heavy, honest, half the price", "invault": true }
    ],
    "pairings": [
      ["🧀", "Cheese", "Aged white cheddar · smoked gouda"],
      ["🥓", "Charcuterie", "Prosciutto, bourbon-glazed pecans, dark honey"],
      ["🥩", "Entrée", "Grilled ribeye, black-pepper crust"],
      ["🍮", "Dessert", "Bread pudding with salted caramel"],
      ["🥃", "Cocktail", "Barrel-strength old fashioned — one big cube, orange oil only"]
    ],
    "dist": {
      "name": "Penelope Bourbon",
      "place": "Lawrenceburg · Indiana · USA",
      "coord": "39.09° N · 84.85° W",
      "history": "Founded in 2018 by Mike Paladini and named for his daughter, Penelope started as a sourcing-and-blending house working with MGP of Indiana — the distillery behind a remarkable share of America's best rye and bourbon. The blending program was good enough that MGP bought the whole brand.",
      "timeline": [
        ["2018", "Founded by Mike Paladini; named for his newborn daughter"],
        ["2019", "Barrel Strength program debuts — numbered batches, proof printed per batch"],
        ["2023", "Acquired by MGP / Luxco — the distillery bought its best customer"],
        ["Today", "One of the fastest-growing premium bourbon brands in the U.S."]
      ]
    },
    "btb": {
      "stats": [["Est.", "2018"], ["Mash Bills", "3"], ["Char Level", "#4"], ["Batches", "Numbered"]],
      "facts": [
        "Every batch is numbered and proofed individually — no two releases are identical.",
        "Four-grain means corn, rye, wheat AND malted barley in the blend — most bourbons pick a side.",
        "The 2023 MGP acquisition validated what blenders knew: the juice was never the secret. The blending was."
      ]
    },
    "notes": "This is the bottle I hand to bourbon drinkers who think they've tried everything under fifty dollars. Barrel proof without the burn-for-burn's-sake. We keep it on the flight list on purpose — taste it against the Booker's and tell me the price difference makes sense.",
    "reviewedAt": "2026-07-26",
    "topNotes": ["Caramel depth", "Baking spice", "Toasted oak"],
    "whyShort": "Three mash bills blended into one barrel-proof bourbon — architecture over heat.",
    "seanShort": "“The bottle I hand to bourbon drinkers who think they’ve tried everything under fifty dollars.” — Sean",
    "whyWeCarry": "In York, barrel-proof usually means a seventy-dollar ask. This delivers cask-strength complexity at a number our guests will order twice, and it anchors the value end of the bourbon flight — we pour it against the Booker’s on purpose, because the comparison sells itself.",
    "press": [
      { "date": null, "type": "score", "source": "Whisky Advocate", "sourceUrl": null, "title": "93 Points", "summary": "Draft recognition claim pending source verification; prior prototype date removed.", "verified": false },
      { "date": null, "type": "award", "source": "San Francisco World Spirits Competition", "sourceUrl": null, "title": "Double Gold", "summary": "Draft recognition claim pending source verification; prior prototype date removed.", "verified": false }
    ],
    "paths": {
      "lighter": [
        { "ref": "chicken-cock-5-year", "name": "Chicken Cock 5 Year", "d": "90 Proof · Age-Stated Kentucky", "why": "Same honesty at a gentler 90 proof" },
        { "name": "Old Grand-Dad 7 Year", "d": "100 Proof · High-Rye", "why": "Rye-forward, honest, half the price" }
      ],
      "similar": [
        { "name": "Maker's Mark Cask Strength", "d": "Wheated · Cask Strength", "why": "Softer grain, same muscle" },
        { "name": "Booker's", "d": "Barrel Proof · Unfiltered", "why": "The old-guard benchmark" }
      ],
      "adventurous": [
        { "name": "Penelope Project X Oloroso", "d": "Sherry Barrel Finish", "why": "Same house, darker turn" },
        { "name": "New Riff Single Barrel", "d": "Single Barrel · Straight", "why": "One barrel, no blending — the counter-argument" }
      ]
    }
  },
  {
    "id": "chicken-cock-5-year",
    "cat": "Bourbon",
    "silo": "bourbon",
    "name": "Chicken Cock 5 Year",
    "distillery": "Grain & Barrel Spirits · Bardstown, Kentucky",
    "style": "Kentucky Straight Bourbon · The Famous Old Brand",
    "proof": "90",
    "proofN": 90,
    "age": "5 yr",
    "price": "$11",
    "priceL": "2 oz pour",
    "status": [
      { "k": "low", "t": "Low Inventory" },
      { "k": "eventb", "t": "Event Bottle · Feb Dinner" }
    ],
    "flavor": { "Sweet": 6, "Oak": 5, "Spice": 4, "Fruit": 5, "Smoke": 1, "Earth": 2, "Herbal": 2 },
    "body": 5,
    "finish": 5,
    "production": [
      ["Mash Bill", "Corn-forward Kentucky bourbon bill with rye & malted barley", true],
      ["Distillation", "Bardstown, Kentucky"],
      ["Barrel", "New charred American oak"],
      ["Age", "5 years minimum, age-stated"],
      ["Bottling Proof", "90"],
      ["Filtration", "Chill filtered"]
    ],
    "prodTags": ["Age Stated", "Heritage Brand · Est. 1856"],
    "why": "Very few bourbon labels can claim a real pre-Civil War birth certificate — this one can. Founded in Paris, Kentucky in 1856, poured in tin cans at Harlem's Cotton Club during Prohibition, then gone for half a century after a distillery fire. The revival earns its shelf space on liquid, not just legend: a clean, honest, age-stated Kentucky straight at a fair number.",
    "awards": [
      { "t": "Est. 1856", "s": "Paris, Kentucky" },
      { "t": "Cotton Club Pour", "s": "Prohibition Era · Harlem" }
    ],
    "compare": [
      { "name": "Buffalo Trace", "d": "90 Proof · Low-Rye", "why": "Same weight class, same honesty", "invault": true },
      { "name": "Elijah Craig Small Batch", "d": "94 Proof · Small Batch", "why": "A touch more oak", "invault": true },
      { "name": "Heaven Hill BiB", "d": "100 Proof · Bottled in Bond", "why": "Step up in proof, not price", "invault": true },
      { "name": "Chicken Cock Ryeteous Rye", "d": "90 Proof · Straight Rye", "why": "The sibling — spice over sweet", "invault": true }
    ],
    "pairings": [
      ["🧀", "Cheese", "Smoked gouda · mild blue"],
      ["🥓", "Charcuterie", "Classic board — country ham, pickles, mustard"],
      ["🍗", "Entrée", "Fried chicken with hot honey"],
      ["🥧", "Dessert", "Pecan pie"],
      ["🥃", "Cocktail", "The Cotton Club highball — bourbon, ginger ale, lemon"]
    ],
    "dist": {
      "name": "Grain & Barrel Spirits",
      "place": "Bardstown · Kentucky · USA",
      "coord": "37.81° N · 85.47° W",
      "history": "Born in Paris, Kentucky in 1856, Chicken Cock became \"The Famous Old Brand\" — famous enough that during Prohibition, Harlem's Cotton Club served it disguised in tin cans. A distillery fire in the 1950s killed production and the name went dark for decades until Grain & Barrel Spirits revived it with Kentucky stock.",
      "timeline": [
        ["1856", "Founded in Paris, Kentucky"],
        ["1920s", "Served in tin cans at the Cotton Club through Prohibition"],
        ["1950s", "Distillery fire — the brand goes dormant"],
        ["2017", "Revived by Grain & Barrel Spirits with Kentucky distillation"],
        ["2026", "Featured bottle — Echo’s Reserve whiskey dinner, February 17"]
      ]
    },
    "btb": {
      "stats": [["Est.", "1856"], ["Dormant", "~60 yrs"], ["Revived", "2017"], ["Age Stated", "5 yr"]],
      "facts": [
        "The tin can wasn’t a gimmick — it hid the bottle from Prohibition agents at the Cotton Club.",
        "One of the oldest bourbon trademarks still pouring in America.",
        "We ran this bottle through a six-course dinner with Chef Daniel Gramas in February — ask about the next one."
      ]
    },
    "notes": "We built a whole evening around this label in February — six whiskeys, six courses — and this 5 Year was the pour that surprised the room. History gets a bottle on my shelf once. Liquid keeps it there. This one stayed. Low inventory right now, so if the bartender offers it, say yes.",
    "reviewedAt": "2026-07-26",
    "topNotes": ["Vanilla", "Orchard fruit", "Soft oak"],
    "whyShort": "A pre–Civil War Kentucky label that survived Prohibition in tin cans at the Cotton Club.",
    "seanShort": "“History gets a bottle on my shelf once. Liquid keeps it there. This one stayed.” — Sean",
    "whyWeCarry": "It carries our event history — we built February’s six-course whiskey dinner around this label — and it gives the list a real 1856 Kentucky story at an age-stated price the York market respects. Guests who were in the room that night still ask for it by name.",
    "press": [
      { "date": "2026-02-17", "type": "venue-event", "source": "Echo's Reserve", "sourceUrl": null, "title": "Featured — Whiskey Dinner", "summary": "First-party venue-event claim pending internal event artifact/source attachment.", "verified": false }
    ],
    "paths": {
      "lighter": [
        { "name": "Buffalo Trace", "d": "90 Proof · Low-Rye", "why": "Same weight class, same honesty" }
      ],
      "similar": [
        { "name": "Elijah Craig Small Batch", "d": "94 Proof · Small Batch", "why": "A touch more oak" },
        { "name": "Heaven Hill Bottled in Bond", "d": "100 Proof", "why": "Step up in proof, not price" }
      ],
      "adventurous": [
        { "name": "Chicken Cock Ryeteous Rye", "d": "90 Proof · Straight Rye", "why": "The sibling — spice over sweet" },
        { "ref": "penelope-barrel-strength", "name": "Penelope Barrel Strength", "d": "Four-Grain · Barrel Strength", "why": "When you want the dial turned up" }
      ]
    }
  },
  {
    "id": "macallan-12-double-cask",
    "cat": "Scotch",
    "silo": "scotch",
    "name": "Macallan 12 Double Cask",
    "distillery": "The Macallan Estate · Craigellachie, Speyside",
    "style": "Speyside Single Malt · Sherry-Seasoned Oak",
    "proof": "86",
    "proofN": 86,
    "age": "12 yr",
    "price": "$16",
    "priceL": "2 oz pour",
    "status": [
      { "k": "available", "t": "Currently Available" }
    ],
    "flavor": { "Sweet": 7, "Oak": 6, "Spice": 4, "Fruit": 7, "Smoke": 1, "Earth": 2, "Herbal": 2 },
    "body": 6,
    "finish": 6,
    "production": [
      ["Grain", "100% malted barley", true],
      ["Distillation", "Double distilled · famously small copper pot stills"],
      ["Casks", "Sherry-seasoned American & European oak"],
      ["Seasoning", "Casks seasoned with oloroso sherry in Jerez, Spain"],
      ["Age", "12 years"],
      ["Colour", "Natural — no caramel added"]
    ],
    "prodTags": ["Single Malt", "Natural Colour", "Sherry Seasoned"],
    "why": "Macallan's small stills produce a heavier, oilier spirit than almost anyone in Speyside, and the house builds its whole identity on wood: casks seasoned with oloroso sherry in Jerez for years before a drop of whisky touches them. Double Cask splits the difference — American oak brings vanilla and citrus, European oak brings dried fruit and spice. It's the benchmark handshake between bourbon country and Scotland.",
    "awards": [
      { "t": "Gold", "s": "International Spirits Challenge" },
      { "t": "Icon Distillery", "s": "Speyside · Est. 1824" }
    ],
    "compare": [
      { "name": "Glenlivet 12 Double Oak", "d": "Speyside · Double Oak", "why": "Lighter, brighter take on the same idea", "invault": true },
      { "name": "Tomatin 12 Year", "d": "Highland Single Malt", "why": "Highland honey, gentler price", "invault": true },
      { "name": "Monkey Shoulder", "d": "Blended Malt", "why": "The mixable cousin", "invault": true },
      { "name": "Green Spot", "d": "Irish Single Pot Still", "why": "Creamy where this is rich", "invault": true },
      { "name": "Toki Suntory", "d": "Japanese Blended", "why": "Precision over power", "invault": true }
    ],
    "pairings": [
      ["🧀", "Cheese", "Manchego · aged gouda"],
      ["🥓", "Charcuterie", "Marcona almonds, membrillo, jamón"],
      ["🦆", "Entrée", "Roast duck · seared scallops"],
      ["🍫", "Dessert", "Dark chocolate with orange"],
      ["🥃", "Serve", "Neat. This one doesn’t need help."]
    ],
    "dist": {
      "name": "The Macallan",
      "place": "Easter Elchies Estate · Craigellachie · Scotland",
      "coord": "57.48° N · 3.20° W",
      "history": "Alexander Reid licensed The Macallan in 1824, making it one of the first legal distilleries in Speyside. Two centuries later it operates from a 485-acre estate on the River Spey, out of a distillery cut into the hillside under a living turf roof — one of the most ambitious buildings in whisky.",
      "timeline": [
        ["1824", "Alexander Reid licenses the distillery — among Speyside’s first"],
        ["1950s–60s", "Sherry cask program becomes the house signature"],
        ["2018", "New estate distillery opens beneath a flowing turf roof"],
        ["Today", "Among the most collected whisky names on earth"]
      ]
    },
    "btb": {
      "stats": [["Est.", "1824"], ["Estate", "485 acres"], ["Oak Types", "2"], ["Colour", "Natural"]],
      "facts": [
        "The \"curiously small\" stills are among the smallest in Speyside — more copper contact, richer spirit.",
        "Macallan owns its cask supply chain from Spanish and American forests through Jerez seasoning — the wood costs more than the spirit.",
        "No caramel coloring, ever. What you see is the cask."
      ]
    },
    "notes": "The sherry seasoning here is a wine-cellar play, and as a winemaker that's exactly why I respect it — Macallan spends more on oak than anyone in the business because they know the barrel IS the recipe. If you're a bourbon drinker who's never crossed the Atlantic, this is the bridge. Start here, then let us walk you toward the Tomatin.",
    "reviewedAt": "2026-07-26",
    "topNotes": ["Dried fruit", "Honeyed malt", "Sherry spice"],
    "whyShort": "The benchmark sherried Speyside — two oaks, some of the smallest stills in Scotland, no shortcuts.",
    "seanShort": "“If bourbon is home base, this is the bridge across the Atlantic.” — Sean",
    "whyWeCarry": "Every scotch shelf needs its handshake bottle — the name a guest already trusts. This is ours, and it earns the slot by being genuinely representative: real sherry seasoning, natural colour. We pour it beside the Tomatin and Glenlivet so the conversation has somewhere to go.",
    "press": [
      { "date": null, "type": "award", "source": "International Spirits Challenge", "sourceUrl": null, "title": "Gold", "summary": "Draft recognition claim pending source verification; prior prototype date removed.", "verified": false }
    ],
    "paths": {
      "lighter": [
        { "name": "Monkey Shoulder", "d": "Blended Malt", "why": "The mixable cousin" },
        { "name": "Glenlivet 12 Double Oak", "d": "Speyside Single Malt", "why": "Lighter, brighter, same idea" }
      ],
      "similar": [
        { "name": "Tomatin 12 Year", "d": "Highland Single Malt", "why": "Highland honey, gentler price" }
      ],
      "adventurous": [
        { "name": "Green Spot", "d": "Irish Single Pot Still", "why": "Creamy where this is rich" },
        { "name": "Toki Suntory", "d": "Japanese Blended", "why": "Precision over power" }
      ]
    }
  },
  {
    "id": "don-fulano-blanco-fuerte",
    "cat": "Agave",
    "silo": "tequila",
    "name": "Don Fulano Blanco Fuerte",
    "distillery": "La Tequileña · Tequila, Jalisco",
    "style": "Tequila Blanco · 100 Proof · Additive-Free",
    "proof": "100",
    "proofN": 100,
    "age": "Unaged",
    "price": "$13",
    "priceL": "2 oz pour",
    "status": [
      { "k": "reserve", "t": "Reserve Room Only" }
    ],
    "flavor": { "Sweet": 4, "Oak": 0, "Spice": 5, "Fruit": 5, "Smoke": 1, "Earth": 6, "Herbal": 7 },
    "body": 6,
    "finish": 6,
    "production": [
      ["Agave", "100% Blue Weber · estate-grown in the Los Altos highlands, harvested at 8–10 years", true],
      ["Cooking", "Slow-roasted in traditional stone & brick ovens"],
      ["Distillation", "Double distilled · copper pot"],
      ["Rest", "Unaged — briefly rested in stainless, never oak"],
      ["Bottling Proof", "100 · \"Fuerte\""],
      ["Additives", "None — additive-free"]
    ],
    "prodTags": ["Estate Grown", "Additive-Free", "100 Proof", "Highland Agave"],
    "why": "Most blanco tequila is proofed down to 80 for the American market, and the agave gets diluted with it. Fuerte means strong — bottled at 100 proof, this is the whole plant: cooked agave, black pepper, wet stone, fresh herbs. The Fonseca family has grown agave for five generations; this is what tequila tastes like when the grower owns the still.",
    "awards": [
      { "t": "Additive-Free", "s": "Verified Producer" },
      { "t": "Grower-Producer", "s": "5th Generation Estate Agave" }
    ],
    "compare": [
      { "name": "El Luchador Blanco", "d": "110 Proof · High-Proof Blanco", "why": "The only bottle here that hits harder", "invault": true },
      { "name": "Herradura Silver", "d": "80 Proof · Estate Grown", "why": "Same estate philosophy, softer landing", "invault": true },
      { "name": "Terralta Reposado", "d": "80 Proof · Highlands", "why": "Add two months of oak", "invault": true },
      { "name": "Fosforo Mezcal", "d": "Artisanal · 100% Maguey", "why": "Trade pepper for smoke", "invault": true }
    ],
    "pairings": [
      ["🧀", "Cheese", "Cotija · fresh queso fresco"],
      ["🦪", "Starter", "Oysters · citrus ceviche"],
      ["🌮", "Entrée", "Grilled fish tacos · anything al pastor"],
      ["🍧", "Dessert", "Lime sorbet"],
      ["🍹", "Cocktail", "Ranch water — but taste it neat first"]
    ],
    "dist": {
      "name": "La Tequileña · NOM 1146",
      "place": "Tequila · Jalisco · Mexico",
      "coord": "20.88° N · 103.84° W",
      "history": "The Fonseca family has farmed agave in the Los Altos highlands since the 1860s — five generations of growers who spent a century selling their best plants to the big houses. Don Fulano is the family bottling its own harvest: highland agave, valley distillation at La Tequileña under Enrique Fonseca, one of the most respected agave men in Jalisco.",
      "timeline": [
        ["1860s", "Fonseca family begins growing agave in Los Altos"],
        ["1990s", "Enrique Fonseca takes over La Tequileña distillery"],
        ["2000s", "Don Fulano launches — the growers finally keep their own agave"],
        ["Today", "A reference producer for the additive-free movement"]
      ]
    },
    "btb": {
      "stats": [["Agave Age", "8–10 yrs"], ["Generations", "5"], ["Additives", "0"], ["Proof", "100"]],
      "facts": [
        "Estate-grown is rare in tequila — most brands buy agave on the open market. The Fonsecas grow their own.",
        "Agave takes 8–10 years to mature before a single harvest. One bottle is a decade of farming.",
        "\"Fuerte\" is the same tequila as the standard blanco — just not watered down for export."
      ]
    },
    "notes": "This pours in the Reserve room only, and that's deliberate — I want a conversation happening when it's opened. If you think you know blanco tequila from the 80-proof shelf, this will reset your reference point. It's the winemaking rule all over again: great farming, minimal handling, nothing added. Ask for it neat, no lime, no salt.",
    "reviewedAt": "2026-07-26",
    "topNotes": ["Cooked agave", "White pepper", "Fresh herbs"],
    "whyShort": "Estate-grown highland agave bottled at a full 100 proof — tequila before the export waterline.",
    "seanShort": "“Ask for it neat. No lime, no salt.” — Sean",
    "whyWeCarry": "This bottle exists to make an argument: that blanco tequila belongs in the same conversation as single-barrel bourbon. It pours in the Reserve room only, so a staff member is always part of the moment — great farming, minimal handling, nothing added. The winemaking rule, applied to agave.",
    "press": [
      { "date": null, "type": "news", "source": "Tequila Matchmaker", "sourceUrl": null, "title": "Additive-Free Verified", "summary": "Draft additive-free claim pending source verification; prior prototype date removed.", "verified": false }
    ],
    "paths": {
      "lighter": [
        { "name": "Herradura Silver", "d": "80 Proof · Estate Grown", "why": "Same estate philosophy, softer landing" },
        { "name": "Mi Campo Blanco", "d": "80 Proof · Blanco", "why": "An easy first step" }
      ],
      "similar": [
        { "name": "El Luchador Blanco", "d": "110 Proof · High-Proof Blanco", "why": "The only bottle here that hits harder" }
      ],
      "adventurous": [
        { "name": "Fosforo Mezcal", "d": "Artisanal · 100% Maguey", "why": "Trade pepper for smoke" },
        { "name": "Granja Nómada", "d": "Traditional Production", "why": "Deeper into terroir" }
      ]
    }
  },
  {
    "id": "diplomatico-reserva-exclusiva",
    "cat": "Rum",
    "silo": "rum",
    "name": "Diplomático Reserva Exclusiva",
    "distillery": "Destilerías Unidas (DUSA) · La Miel, Venezuela",
    "style": "Venezuelan Dark Rum · Pot Still Blend",
    "proof": "80",
    "proofN": 80,
    "age": "Up to 12 yr",
    "price": "$12",
    "priceL": "2 oz pour",
    "status": [
      { "k": "available", "t": "Currently Available" },
      { "k": "flight", "t": "Flight Available" }
    ],
    "flavor": { "Sweet": 9, "Oak": 5, "Spice": 3, "Fruit": 6, "Smoke": 1, "Earth": 2, "Herbal": 1 },
    "body": 8,
    "finish": 6,
    "production": [
      ["Base", "Sugar cane \"honeys\" — concentrated cane juice — plus molasses", true],
      ["Distillation", "Copper pot stills & column, blended"],
      ["Barrel", "Ex-bourbon American white oak"],
      ["Age", "Blend of rums aged up to 12 years"],
      ["Bottling Proof", "80"],
      ["Style", "Sweet, rich, after-dinner profile"]
    ],
    "prodTags": ["Pot Still", "Solera-Style Blending", "Dessert Pour"],
    "why": "Every spirits program needs one bottle that converts skeptics, and in the rum section this is ours. Pot-still weight, a base of concentrated cane honeys, and up to twelve years in ex-bourbon oak produce something closer to a liquid dessert than a beach drink. It is unapologetically sweet — we say that out loud, because the guests who want this pour REALLY want it.",
    "awards": [
      { "t": "Gold", "s": "International Rum Conference · Madrid" },
      { "t": "Category Benchmark", "s": "Premium Venezuelan Rum" }
    ],
    "compare": [
      { "name": "Zaya Gran Reserva 16", "d": "16 Yr · Guatemala · Solera", "why": "Sweeter still, silkier", "invault": true },
      { "name": "Don Q Gran Reserva XO", "d": "Puerto Rico · XO Solera", "why": "Drier, more structured", "invault": true },
      { "name": "Papa's Pilar Sherry Cask", "d": "86 Proof · Sherry Finish", "why": "The wine-cask cousin", "invault": true },
      { "name": "Ron Barceló Imperial", "d": "Dominican · 10 Yr", "why": "The value play in the same lane", "invault": true }
    ],
    "pairings": [
      ["🧀", "Cheese", "Bold blue · Stilton"],
      ["🥓", "Charcuterie", "Dried figs, dates, candied nuts"],
      ["🍖", "Entrée", "Pork belly · anything off the smoker"],
      ["🍫", "Dessert", "Flourless chocolate torte"],
      ["🥃", "Cocktail", "Rum old fashioned — or one cube, after dinner"]
    ],
    "dist": {
      "name": "Destilerías Unidas",
      "place": "La Miel · Lara · Venezuela",
      "coord": "9.90° N · 69.75° W",
      "history": "DUSA was built in 1959 at the foot of the Venezuelan Andes as a Seagram's facility, inheriting an unusual arsenal of stills — copper pots, batch kettles, and columns under one roof. When Seagram's dissolved, Venezuelan owners kept the hardware and pointed it at rum. Diplomático became the export flagship.",
      "timeline": [
        ["1959", "Distillery built at the foot of the Andes as a Seagram’s plant"],
        ["2002", "Diplomático launches internationally"],
        ["2010s", "Reserva Exclusiva becomes the gateway premium rum worldwide"],
        ["Today", "Distributed in 100+ countries; still distilled at the original site"]
      ]
    },
    "btb": {
      "stats": [["Est.", "1959"], ["Aging", "Up to 12 yr"], ["Stills", "Pot + Column"], ["Countries", "100+"]],
      "facts": [
        "The pot stills are original 1959 Seagram’s hardware — batch kettles you’ll find almost nowhere else in rum.",
        "\"Sugar cane honeys\" isn’t marketing — it’s concentrated cane juice, richer than molasses alone.",
        "Yes, it’s sweet. That’s the assignment. Pour it where you’d pour dessert."
      ]
    },
    "notes": "When a table finishes dinner and wants \"something like a bourbon, but different,\" this is the pour. It converts more bourbon drinkers to rum than anything else on the shelf. We keep it on the flight list next to the Don Q XO on purpose — sweet versus structured, side by side. Taste both and you'll know which camp you're in.",
    "reviewedAt": "2026-07-26",
    "topNotes": ["Toffee", "Vanilla bean", "Baked banana"],
    "whyShort": "The dessert-rum benchmark — pot-still weight and cane honeys aged up to twelve years.",
    "seanShort": "“The pour for tables that want something like bourbon, but different.” — Sean",
    "whyWeCarry": "It closes dinners. Nothing on the shelf converts a bourbon drinker to rum faster, and it earns its flight slot next to the Don Q XO — sweet versus structured, side by side. Guests taste both and pick a camp; either way, the rum section just made a regular.",
    "press": [
      { "date": null, "type": "award", "source": "International Rum Conference, Madrid", "sourceUrl": null, "title": "Gold Medal", "summary": "Draft recognition claim pending source verification; prior prototype date removed.", "verified": false }
    ],
    "paths": {
      "lighter": [
        { "name": "Ron Barceló Imperial", "d": "Dominican · 10 Yr", "why": "The value play in the same lane" }
      ],
      "similar": [
        { "name": "Zaya Gran Reserva 16", "d": "Guatemala · Solera", "why": "Sweeter still, silkier" },
        { "name": "Don Q Gran Reserva XO", "d": "Puerto Rico · XO Solera", "why": "Drier, more structured — taste them side by side" }
      ],
      "adventurous": [
        { "name": "Papa's Pilar Dark Rye Barrel", "d": "Rye Whiskey Cask Finish", "why": "A whiskey drinker’s rum" },
        { "ref": "macallan-12-double-cask", "name": "Macallan 12 Double Cask", "d": "Sherried Speyside Malt", "why": "Cross categories entirely" }
      ]
    }
  }
  ];

  // ── Bourbon / American Whiskey Batch 1 — single canonical records via helper. ──
  var BATCH = [
  makeBatchSpirit({id:'sagamore-rye',brand:'Sagamore Spirit',expression:'Small Batch Rye',cat:'Rye',subcategory:'maryland-style-rye',producer:'Sagamore Spirit',distilleryName:'Sagamore Spirit',city:'Baltimore',region:'Maryland',style:'Maryland-Style Straight Rye Whiskey',proofN:93,ageText:'4-6 yr',minYears:4,maxYears:6,priceUsd:14,flavor:{Sweet:6,Oak:4,Spice:7,Fruit:5,Smoke:1,Earth:3,Herbal:2},body:5,finish:5,topNotes:['Baking spice','Caramel honey','Orchard fruit'],productionRows:[['Mash Bills','Blend of high-rye and low-rye straight whiskeys',true],['Distillation','Triple distilled'],['Age','4-6 years'],['Bottling Proof','93'],['Filtration','Non-chill filtered']],productionStructured:{mashBill:{summary:'Two rye mash bills: high-rye and low-rye'},maturation:{vessel:'new-charred-american-oak'},methodTags:['small-batch','maryland-style-rye','non-chill-filtered']},prodTags:['Maryland-Style Rye','Small Batch','Non-Chill Filtered'],why:'Sagamore frames this as a modern Maryland-style rye built from two rye mash bills, balancing baking spice with sweeter fruit and caramel notes.',whyShort:'Two rye mash bills blended into a balanced Maryland-style rye.',sources:[{url:SOURCE_URLS.sagamoreSmallBatch}]}),
  makeBatchSpirit({id:'sagamore-double-oak',brand:'Sagamore Spirit',expression:'Double Oak Rye',cat:'Rye',subcategory:'double-oaked-rye',producer:'Sagamore Spirit',distilleryName:'Sagamore Spirit',city:'Baltimore',region:'Maryland',style:'Maryland-Style Straight Rye · Double Oak Finish',proofN:96.6,ageText:'4-5 yr + 18 mo finish',minYears:4,maxYears:6.5,priceUsd:14,flavor:{Sweet:7,Oak:7,Spice:6,Fruit:4,Smoke:1,Earth:3,Herbal:2},body:6,finish:6,topNotes:['Caramel','Toasted coconut','Hazelnut'],productionRows:[['Base','Straight rye whiskey aged 4-5 years',true],['Finish','Toasted wave stave barrels for an additional 18 months'],['Water','Proofed with limestone-filtered spring house water'],['Bottling Proof','96.6']],productionStructured:{maturation:{vessel:'new-charred-american-oak',finishCasks:['toasted-wave-stave-barrel']},finishType:'double-oak',methodTags:['double-oak','maryland-style-rye']},prodTags:['Double Oak','Maryland-Style Rye','Toasted Finish'],why:'Sagamore uses a toasted second barrel to push its rye toward caramel, coconut, hazelnut, and richer oak without leaving the Maryland-style rye lane.',whyShort:'Maryland-style rye moved into a toasted second barrel for extra oak and caramel.',sources:[{url:SOURCE_URLS.sagamoreDoubleOak}]}),
  makeBatchSpirit({id:'sagamore-manhattan-finish',brand:'Sagamore Spirit',expression:'Manhattan Finish Rye',cat:'Rye',subcategory:'finished-rye',producer:'Sagamore Spirit',distilleryName:'Sagamore Spirit',city:'Baltimore',region:'Maryland',style:'Blend of Straight Rye Whiskeys · Cocktail Barrel Finish',proofN:103,ageText:'4 yr + 30 mo finish',minYears:4,maxYears:6.5,priceUsd:11,flavor:{Sweet:6,Oak:5,Spice:7,Fruit:7,Smoke:1,Earth:3,Herbal:5},body:6,finish:6,topNotes:['Dark cherry','Rye spice','Herbal bitters'],productionRows:[['Base','4-year-old straight rye whiskey',true],['Finish','Vermouth, bitters, and cherry brandy barrels for 30 months'],['Release','2025 limited release'],['Bottling Proof','103']],productionStructured:{maturation:{finishCasks:['vermouth','bitters','cherry-brandy']},finishType:'cocktail-barrel',methodTags:['limited-release','finished-rye']},prodTags:['Limited Release','Cocktail Finish','Maryland-Style Rye'],why:'This is a rye whiskey built around the Manhattan template: vermouth, bitters, and cherry brandy barrel influence layered onto Sagamore rye.',whyShort:'A rye finished through the flavor architecture of a Manhattan.',sources:[{url:SOURCE_URLS.sagamoreManhattan}]}),
  makeBatchSpirit({id:'knob-creek-single-barrel-9-year',brand:'Knob Creek',expression:'Single Barrel 9 Year',cat:'Bourbon',subcategory:'single-barrel-bourbon',producer:'James B. Beam Distilling Co.',distilleryName:'Knob Creek / Jim Beam Clermont',city:'Clermont',region:'Kentucky',style:'Kentucky Straight Bourbon · Single Barrel · 120 Proof',proofN:120,ageText:'9 yr',minYears:9,maxYears:9,priceUsd:16.5,flavor:{Sweet:6,Oak:8,Spice:6,Fruit:4,Smoke:2,Earth:4,Herbal:1},body:8,finish:8,topNotes:['Vanilla oak','Roasted nuts','Barrel spice'],productionRows:[['Barrel','Single barrel selected through the Knob Creek program',true],['Age','Minimum 9 years'],['Char','Level 4 char white oak'],['Bottling Proof','120']],productionStructured:{maturation:{vessel:'new-charred-american-oak',charLevel:4},methodTags:['single-barrel','high-proof']},prodTags:['Single Barrel','9 Year','120 Proof'],why:'Knob Creek positions its single barrel program around 120 proof, level-four char, and a minimum nine-year age statement from Clermont-aged barrels.',whyShort:'A 120-proof, nine-year single barrel built around deep Beam oak.',sources:[{url:SOURCE_URLS.knobCreekSingleBarrel}]}),
  makeBatchSpirit({id:'bulleit-10-year',brand:'Bulleit',expression:'10 Year Bourbon',cat:'Bourbon',subcategory:'kentucky-straight-bourbon',producer:'The Bulleit Distilling Co.',distilleryName:'The Bulleit Distilling Co.',city:'Lawrenceburg',region:'Kentucky',style:'Kentucky Straight Bourbon Whiskey · 10 Year',proofN:91.2,ageText:'10 yr',minYears:10,maxYears:10,priceUsd:10,flavor:{Sweet:6,Oak:6,Spice:5,Fruit:4,Smoke:2,Earth:3,Herbal:1},body:5,finish:5,topNotes:['Toasty oak','Soft vanilla','Dried fruit'],productionRows:[['Age','Minimum 10 years',true],['Barrel','#4 charred American white oak'],['Bottling Proof','91.2'],['Mash Bill','Pending source confirmation']],productionStructured:{maturation:{vessel:'new-charred-american-oak',charLevel:4},methodTags:['10-year']},prodTags:['10 Year','Kentucky Straight Bourbon'],why:'Bulleit describes this as a ten-year bourbon aged in #4 charred American white oak, carrying oak, vanilla, fruit, and gentle smoke.',whyShort:'Bulleit’s ten-year bourbon: oak-forward, mature, and accessible.',sources:[{url:SOURCE_URLS.bulleit10}],sourcingLimitations:['Official page does not publish mash bill for the 10 Year Bourbon.']}),
  makeBatchSpirit({id:'old-forester-1870',brand:'Old Forester',expression:'1870 Original Batch',cat:'Bourbon',subcategory:'whiskey-row-bourbon',producer:'Old Forester',distilleryName:'Old Forester Distilling Co.',city:'Louisville',region:'Kentucky',style:'Kentucky Straight Bourbon · Whiskey Row Series',proofN:90,ageText:'NAS',priceUsd:10.75,flavor:{Sweet:6,Oak:4,Spice:4,Fruit:6,Smoke:1,Earth:2,Herbal:2},body:5,finish:4,topNotes:['Apple citrus','Soft vanilla','Light baking spice'],productionRows:[['Batching','Barrels from three warehouses, different production days and age profiles',true],['Filtration','Minimally filtered'],['Bottling Proof','90'],['Age','No age statement']],productionStructured:{methodTags:['small-batch','whiskey-row'],maturation:{vessel:'new-charred-american-oak'}},prodTags:['Whiskey Row','Original Batch','90 Proof'],why:'Old Forester 1870 is built to echo George Garvin Brown’s original batching model by combining barrels from three warehouses.',whyShort:'A Whiskey Row bottle built around Old Forester’s original batching idea.',sources:[{url:SOURCE_URLS.oldForester1870},{url:'https://www.oldforester.com/our-legacy/',coversFields:['history','proof']}]}),
  makeBatchSpirit({id:'old-forester-1897-bottled-in-bond',brand:'Old Forester',expression:'1897 Bottled in Bond',cat:'Bourbon',subcategory:'bottled-in-bond-bourbon',producer:'Old Forester',distilleryName:'Old Forester Distilling Co.',city:'Louisville',region:'Kentucky',style:'Kentucky Straight Bourbon · Bottled in Bond',proofN:100,ageText:'At least 4 yr',minYears:4,priceUsd:11.75,flavor:{Sweet:7,Oak:6,Spice:6,Fruit:5,Smoke:1,Earth:3,Herbal:1},body:6,finish:6,topNotes:['Caramel vanilla','Dried fruit','Black pepper'],productionRows:[['Standard','Bottled in Bond',true],['Age','At least 4 years under Bottled-in-Bond rules'],['Bottling Proof','100'],['Series','Whiskey Row Series']],productionStructured:{methodTags:['bottled-in-bond','whiskey-row'],maturation:{vessel:'new-charred-american-oak'}},prodTags:['Bottled in Bond','Whiskey Row','100 Proof'],why:'This Whiskey Row expression uses Bottled-in-Bond rules as the product story: one distillation season, one distiller, bonded aging, and 100 proof.',whyShort:'Old Forester’s Bottled-in-Bond Whiskey Row expression.',sources:[{url:SOURCE_URLS.oldForester1897}]}),
  makeBatchSpirit({id:'old-forester-1910',brand:'Old Forester',expression:'1910 Old Fine Whisky',cat:'Bourbon',subcategory:'double-barreled-bourbon',producer:'Old Forester',distilleryName:'Old Forester Distilling Co.',city:'Louisville',region:'Kentucky',style:'Kentucky Straight Bourbon · Double Barreled',proofN:93,ageText:'NAS',priceUsd:13,flavor:{Sweet:8,Oak:6,Spice:5,Fruit:6,Smoke:2,Earth:3,Herbal:1},body:7,finish:6,topNotes:['Toffee','Baked apple','Mocha spice'],productionRows:[['Finish','Second barreling inspired by the 1910 bottling-line fire story',true],['Second Barrel','Enters second barrel at 100 proof'],['Bottling Proof','93'],['Series','Whiskey Row Series']],productionStructured:{finishType:'double-barrel',maturation:{finishCasks:['second-new-barrel']},methodTags:['double-barreled','whiskey-row']},prodTags:['Double Barreled','Whiskey Row','93 Proof'],why:'Old Forester 1910 mimics the historic second-barrel accident story with a modern double-barreled bourbon profile.',whyShort:'The sweeter, double-barreled Old Forester Whiskey Row pour.',sources:[{url:SOURCE_URLS.oldForester1910}]}),
  makeBatchSpirit({id:'old-forester-1920',brand:'Old Forester',expression:'1920 Prohibition Style',cat:'Bourbon',subcategory:'high-proof-bourbon',producer:'Old Forester',distilleryName:'Old Forester Distilling Co.',city:'Louisville',region:'Kentucky',style:'Kentucky Straight Bourbon · Prohibition Style',proofN:115,ageText:'NAS',priceUsd:14.25,flavor:{Sweet:8,Oak:7,Spice:7,Fruit:6,Smoke:2,Earth:4,Herbal:1},body:8,finish:8,topNotes:['Dark caramel','Chocolate oak','Rye spice'],productionRows:[['Historic Frame','Inspired by Old Forester medicinal whiskey during Prohibition',true],['Barrel Entry Story','100 entry proof would mature toward 115 proof'],['Bottling Proof','115'],['Series','Whiskey Row Series']],productionStructured:{methodTags:['high-proof','whiskey-row','prohibition-style'],maturation:{vessel:'new-charred-american-oak'}},prodTags:['Prohibition Style','Whiskey Row','115 Proof'],why:'Old Forester presents 1920 at 115 proof to represent the richer style tied to its medicinal whiskey permit era.',whyShort:'High-proof Whiskey Row bourbon built around Old Forester’s Prohibition-era story.',sources:[{url:SOURCE_URLS.oldForester1920}]}),
  makeBatchSpirit({id:'old-forester-single-barrel-barrel-strength-rye',brand:'Old Forester',expression:'Single Barrel Barrel Strength Rye',cat:'Rye',subcategory:'single-barrel-rye',producer:'Old Forester',distilleryName:'Old Forester Distilling Co.',city:'Louisville',region:'Kentucky',style:'Kentucky Straight Rye Whiskey · Single Barrel · Barrel Strength',proofN:124,ageText:'NAS',priceUsd:16,flavor:{Sweet:6,Oak:6,Spice:8,Fruit:5,Smoke:1,Earth:4,Herbal:4},body:8,finish:8,topNotes:['Rye spice','Vanilla caramel','Dried dill'],productionRows:[['Mash Bill','65% rye, 20% malted barley, 15% corn',true],['Barrel','Single barrel, barrel strength'],['Bottling Proof','124 shown in control-state listing; single barrels may vary'],['Filtration','Pending producer confirmation']],productionStructured:{mashBill:{components:['rye','malted-barley','corn'],summary:'65% rye, 20% malted barley, 15% corn'},methodTags:['single-barrel','barrel-strength','rye']},prodTags:['Single Barrel','Barrel Strength','Rye'],why:'This draft joins Old Forester’s historic rye mash bill to the single-barrel, barrel-strength format; exact proof should be confirmed against Echo’s bottle.',whyShort:'Old Forester rye in a single-barrel, barrel-strength format.',sources:[{url:SOURCE_URLS.oldForesterRye,coversFields:['mashBill','producer','base rye']},{url:SOURCE_URLS.oldForesterSingleBarrelRye,sourceType:'control-state',coversFields:['proof','product identity']}],sourcingLimitations:['Manufacturer page for the exact barrel-strength rye was not available in this pass; proof should be checked against Echo bottle.']}),
  makeBatchSpirit({id:'old-forester-rye-100-proof',brand:'Old Forester',expression:'Rye 100 Proof',cat:'Rye',subcategory:'kentucky-straight-rye',producer:'Old Forester',distilleryName:'Old Forester Distilling Co.',city:'Louisville',region:'Kentucky',style:'Kentucky Straight Rye Whisky · 100 Proof',proofN:100,ageText:'NAS',priceUsd:7,flavor:{Sweet:5,Oak:4,Spice:8,Fruit:4,Smoke:1,Earth:3,Herbal:5},body:5,finish:6,topNotes:['Black pepper','Molasses','Citrus oil'],productionRows:[['Mash Bill','65% rye, 20% malted barley, 15% corn',true],['Fermentation','Proprietary yeast strain'],['Bottling Proof','100'],['Recipe Origin','Inspired by historic Normandy Rye']],productionStructured:{mashBill:{components:['rye','malted-barley','corn'],summary:'65% rye, 20% malted barley, 15% corn'},methodTags:['100-proof','kentucky-straight-rye']},prodTags:['100 Proof','Kentucky Straight Rye'],why:'Old Forester Rye is built on a high-malted-barley rye mash bill that keeps the spice sharp but adds a floral, rounded edge.',whyShort:'A 100-proof Kentucky rye with a high-malted-barley mash bill.',sources:[{url:SOURCE_URLS.oldForesterRye}]}),
  makeBatchSpirit({id:'whistlepig-snout-to-tail-10-year-bourbon',brand:'WhistlePig',expression:'Snout-to-Tail 10 Year Bourbon',cat:'Bourbon',subcategory:'toasted-finish-bourbon',producer:'WhistlePig Whiskey',distilleryName:'WhistlePig Whiskey',city:'Shoreham',region:'Vermont',style:'Straight Bourbon Whiskey · Vermont Oak Toasted Barrel Finish',proofN:88,ageText:'10 yr',minYears:10,maxYears:10,priceUsd:22,flavor:{Sweet:7,Oak:7,Spice:4,Fruit:3,Smoke:2,Earth:4,Herbal:1},body:6,finish:6,topNotes:['Brown sugar','Roasted almond','Cedar'],productionRows:[['Age','10 years',true],['Finish','Vermont oak toasted barrels'],['Bottling Proof','88'],['Mash Bill','Pending producer detail']],productionStructured:{finishType:'vermont-oak-toasted',maturation:{finishCasks:['vermont-oak-toasted']},methodTags:['10-year','toasted-finish']},prodTags:['10 Year','Vermont Oak','Toasted Finish'],why:'WhistlePig frames Snout-to-Tail around a ten-year bourbon finished with two toasted Vermont oak barrel heads.',whyShort:'Ten-year bourbon with a WhistlePig toasted Vermont oak finish.',sources:[{url:SOURCE_URLS.whistlepigSnoutToTail}],sourcingLimitations:['Official page does not publish mash bill.']}),
  makeBatchSpirit({id:'jeptha-creed-bottled-in-bond',brand:'Jeptha Creed',expression:'Bottled-in-Bond Bourbon',cat:'Bourbon',subcategory:'bottled-in-bond-bourbon',producer:'Jeptha Creed Distillery',distilleryName:'Jeptha Creed Distillery',city:'Shelbyville',region:'Kentucky',style:'Kentucky Straight Bourbon · Bottled in Bond',proofN:100,ageText:'At least 4 yr',minYears:4,priceUsd:10.75,flavor:{Sweet:6,Oak:5,Spice:6,Fruit:5,Smoke:1,Earth:5,Herbal:2},body:6,finish:6,topNotes:['Orange creme brulee','Baking spice','Sweet oak'],productionRows:[['Mash Bill','75% Bloody Butcher corn, 20% malted rye, 5% malted barley',true],['Standard','Bottled in Bond'],['Bottling Proof','100'],['Corn','Bloody Butcher corn']],productionStructured:{mashBill:{components:['bloody-butcher-corn','malted-rye','malted-barley'],summary:'75/20/5'},methodTags:['bottled-in-bond','ground-to-glass']},prodTags:['Bottled in Bond','Bloody Butcher Corn','Ground-to-Glass'],why:'Jeptha Creed’s bonded bourbon centers its estate/farm identity around Bloody Butcher corn and a rye-heavy bonded mash bill.',whyShort:'A bonded Jeptha Creed bourbon built on Bloody Butcher corn.',sources:[{url:SOURCE_URLS.jepthaBib}]}),
  makeBatchSpirit({id:'jeptha-creed-four-grain',brand:'Jeptha Creed',expression:'Straight Four Grain Bourbon',cat:'Bourbon',subcategory:'four-grain-bourbon',producer:'Jeptha Creed Distillery',distilleryName:'Jeptha Creed Distillery',city:'Shelbyville',region:'Kentucky',style:'Kentucky Straight Bourbon · Four Grain',proofN:98,ageText:'NAS',priceUsd:10.75,flavor:{Sweet:6,Oak:5,Spice:5,Fruit:4,Smoke:1,Earth:5,Herbal:2},body:6,finish:5,topNotes:['Vanilla','Nutmeg clove','Toasted pecan'],productionRows:[['Grains','Bloody Butcher corn, malted rye, malted wheat, malted barley',true],['Bottling Proof','98'],['Bottle Size','750 mL'],['Age','Pending source confirmation']],productionStructured:{mashBill:{components:['bloody-butcher-corn','malted-rye','malted-wheat','malted-barley'],summary:'Four grain; percentages pending source confirmation'},methodTags:['four-grain','ground-to-glass']},prodTags:['Four Grain','Bloody Butcher Corn','98 Proof'],why:'Jeptha Creed’s four-grain bourbon uses its signature Bloody Butcher corn alongside malted rye, wheat, and barley.',whyShort:'A four-grain Jeptha Creed bourbon built around Bloody Butcher corn.',sources:[{url:SOURCE_URLS.jepthaFourGrain},{url:'https://jepthacreed.com/',coversFields:['producer background','proof']}],sourcingLimitations:['Official shop source gives grain list and proof but not full mash percentages.']}),
  makeBatchSpirit({id:'jeptha-creed-6-year-wheated',brand:'Jeptha Creed',expression:'6 Year Wheated Bourbon',cat:'Bourbon',subcategory:'wheated-bourbon',producer:'Jeptha Creed Distillery',distilleryName:'Jeptha Creed Distillery',city:'Shelbyville',region:'Kentucky',style:'Kentucky Straight Bourbon · Wheated · 6 Year',proofN:93,ageText:'6 yr',minYears:6,maxYears:6,priceUsd:10.75,flavor:{Sweet:7,Oak:5,Spice:4,Fruit:5,Smoke:1,Earth:5,Herbal:1},body:6,finish:6,topNotes:['Toasted almond','Cinnamon bread','Dark cherry'],productionRows:[['Mash Bill','75% Bloody Butcher corn, 20% malted wheat, 5% malted barley',true],['Age','6 years'],['Bottling Proof','93'],['Corn','Bloody Butcher corn']],productionStructured:{mashBill:{components:['bloody-butcher-corn','malted-wheat','malted-barley'],summary:'75/20/5'},methodTags:['wheated','6-year','ground-to-glass']},prodTags:['6 Year','Wheated','Bloody Butcher Corn'],why:'This is Jeptha Creed’s older wheated expression, using Bloody Butcher corn with malted wheat for a softer bourbon profile.',whyShort:'A six-year wheated Jeptha Creed bourbon with Bloody Butcher corn.',sources:[{url:SOURCE_URLS.jepthaWheated}]}),

  // ── Batch 2 (draft) — first agent-researched FULL dossier; price + GUID from Toast ──
  makeBatchSpirit({id:'bookers-bourbon',brand:"Booker's",expression:'Small Batch Bourbon',displayName:"Booker's Bourbon",cat:'Bourbon',subcategory:'kentucky-straight-bourbon',producer:'James B. Beam Distilling Co.',distilleryName:'James B. Beam Distilling Co.',city:'Clermont',region:'Kentucky',country:'USA',style:'Small Batch · Barrel Proof · Uncut & Unfiltered',proofN:null,proofDisplay:'Barrel',ageText:'6–8 yr',minYears:6,maxYears:8,flavor:{Sweet:7,Oak:8,Spice:6,Fruit:4,Smoke:2,Earth:4,Herbal:2},body:9,finish:8,topNotes:['Charred oak','Vanilla & caramel','Rye spice'],productionRows:[['Mash Bill','77% corn / 13% rye / 10% malted barley',true],['Age','6–8 years'],['Proof','Barrel proof, varies by batch (~121–130)'],['Filtration','Uncut & unfiltered'],['Aging','Center-cut of the rickhouse']],productionStructured:{mashBill:{summary:'77% corn, 13% rye, 10% malted barley'},maturation:{summary:'6–8 years, center-cut of the rickhouse'},methodTags:['uncut','unfiltered','barrel-proof','small-batch']},prodTags:['Uncut & Unfiltered','Barrel Proof','Small Batch'],why:"Booker's is bottled straight from the barrel — uncut and unfiltered at its natural proof — from barrels drawn from the center of the rickhouse, where the producer says temperature and humidity are most favorable for aging. It is the flagship of James B. Beam Distilling Co.'s Small Batch Bourbon Collection.",whyShort:"The original uncut, unfiltered, barrel-proof bourbon — Booker Noe's namesake.",history:"Booker's was created by Booker Noe — grandson of Jim Beam and the company's sixth-generation Master Distiller — who wanted a bourbon bottled uncut and unfiltered, 'the way bourbon was supposed to be.' He first bottled his straight-from-the-barrel selections as gifts for friends and family before launching the brand to the public in a small 1,000-case release in 1988. In 1992 it became the first expression of Jim Beam's Small Batch Bourbon Collection, which also grew to include Baker's, Basil Hayden's and Knob Creek. Today, in the tradition Booker set, his son Fred Noe personally samples barrels to decide when each batch is ready.",timeline:[['1929','Booker Noe, grandson of Jim Beam, is born'],['1988',"Booker's launches as a 1,000-case release, bottled uncut & unfiltered"],['1992',"Becomes the first release of Jim Beam's Small Batch Bourbon Collection"],['2004','Booker Noe passes; his son Fred Noe carries on the batch-by-batch tradition']],statTiles:[['Est.','1988'],['Mash Bill','77/13/10'],['Proof','121–130.6'],['Age','6–8 yr']],facts:["Booker Noe originally bottled his straight-from-the-barrel bourbon only as gifts for close friends and family before it ever became a brand.",'Every batch is drawn from the center of the rickhouse, where the distillery says temperature and humidity are most favorable for aging.',"Booker's helped launch the American small-batch bourbon category as the first release of Jim Beam's Small Batch Bourbon Collection."],pairings:[['🧀','Cheese','Aged sharp cheddar or a nutty Gruyère to stand up to the barrel-proof intensity'],['🥩','Entrée','Char-grilled ribeye or peppercorn-crusted steak — the oak and rye spice echo the crust'],['🍫','Dessert','Dark chocolate, pecan pie, or bread pudding to play off the vanilla and caramel'],['🥃','Cocktail','A big, spirit-forward Old Fashioned — a splash of water opens it up beautifully']],sources:[{url:'https://www.beamdistilling.com/bookersbourbon/about-bookers'},{url:'https://en.wikipedia.org/wiki/Booker%27s',sourceType:'publication'},{url:'https://www.whiskeyuniv.com/n-booker-noe',sourceType:'publication'}],sourcingLimitations:["Producer page cites a 1987 creation date while the public debut was the 1988 1,000-case release; proof/age ranges (121–130.6, 6–8 yr) are documented by Wikipedia, not the producer's current About page; the 1992 Small Batch Collection milestone and Booker Noe's dates are from secondary sources."],priceUsd:25.00,toastItemGuid:'acb17496-6402-4005-b466-995815b9dbca'}),
  ];

  return LEGACY.concat(BATCH);
};
