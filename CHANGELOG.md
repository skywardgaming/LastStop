# Changelog

## 0.3.0 — Operation Ascension

Ashvale becomes a four-skill idle RPG with tools, research and a second
set of goals, and now wears Astra's Operation Rebirth art.

### Art: Operation Rebirth v1.0 (by Astra) — integrated

- All 113 runtime PNGs from the Drive pack, copied to `public/art/rebirth/`
  and checked byte-for-byte against the pack's `QA.json` (0 mismatches).
  The README, manifest, QA and the optional skin CSS are kept in
  `docs/art-rebirth/` for provenance.
- **Scene:** a new 384×216 renderer built from the five modular layers and
  props, with No. 9 at (99,95) plus its repair overlays. All 32 repair
  combinations are cached, and each was checked in the browser: every repair
  changes only its manifest region. The station sign is blank in the art, so
  ASHVALE is live text. The cabinet and sign were moved to where they're
  visible instead of behind the train.
- **Characters:** the conductor, Mara and Tobin use the posed figures (working
  poses while busy; NPCs gesture when they have something to say). The nine
  portraits are used in dialogue, with expressions tagged line by line.
- **Effects:** rain, steam, lantern glow, window light, headlamp glow, the
  cyan signal pulse and a one-shot sparkle on rare finds, all from the pack's
  sprite sheets. Reduced motion hides or freezes them as the manifest says.
- **Icons:** all 17 item icons, 12 discovery icons (now shown in the journal,
  never added to inventory), navigation icons and location markers.
- **UI skin:** nine-slice panel, slot and progress frames applied per
  component. URLs go through `BASE_URL`, so they work on GitHub Pages.
- **Loading:** the 0.2 procedural scene shows while the art loads, and stays
  as a fallback if any file fails. Tappable hotspots on the scene jump to the
  relevant skill or the Train tab. On desktop the scene shows at an exact 2×.

### Gameplay

- **Salvaging (new skill).** Five targets, from the bottomless Scrap Wagon
  (level 1) up to the Dead Dynamo (level 12). Machinery comes from
  Scavenging, and salvage produces Brass Fittings, Ball Bearings, Coil Springs
  and Field Magnets, which recipes and repairs need. It also has a chance of
  a double yield.
- **Railway Research (new skill).** The repeatable Catalogue of the Archive,
  plus 11 projects. Each project needs a journal discovery and uses
  Waterlogged Notes (a new scavenging drop) on every action. Finishing one
  unlocks tool blueprints, permanent bonuses (faster searching, double Fuel
  Bricks, more XP, rare-find and salvage boosts), the boiler prerequisite,
  and a new chapter of Mara's story.
- **Tools and equipment.** One tool slot per skill and 10 tools in three
  tiers. Higher tiers need a skill level to equip, and some need a research
  blueprint to craft. A newly crafted tool equips itself if it's an upgrade.
- **Crafting tiers.** Engineering is split into Parts (tiers 1–3) and Tools.
- **Train.** Repairs now also need salvaged parts and research. Three new
  improvements, unlocked after their repairs, each change the scene:
  - **Cab Lanterns:** Research +20%.
  - **Tender Winch:** Salvaging +20% and double yields.
  - **Signal Receiver:** rare finds ×1.25 and XP +10%. Completes Night Works.
- **Progression.**
  - **Feats:** 21 in total; most grant a small permanent bonus.
  - **Objectives:** 20 across *Chapter One · The Cyan Signal* and *Night Works*.
  - **Unlock lists:** each skill has an expandable list of what it unlocks
    at each level.
  - **Journal → Progress:** a skills overview, both chapters' checklists and
    a records table.
- **Story.** Six new conversations, including who "E.V." was, and a Night
  Works finale.
- **Balance.** The XP curve is unchanged up to level 12 and steeper above
  it, so level 20 is a long-term goal.
  - **Chapter One:** the goal-directed test bot finishes in ~4.1 h of
    efficient play; the first repair comes at ~3.5 min.
  - **Night Works:** ~5.6 h for the bot.
  - **Luck:** pity guarantees keep progress-critical discoveries from
    blocking anyone.

### Engine and saves

- One timestamp engine now runs all four activity types, with the same 8-hour
  cap and clock high-water protection.
- **Stopping:** crafting, salvaging and research stop by themselves when
  materials run out. Research also stops when a project finishes.
- **Save v3:** v2 → v3 and v1 → v3 migrations, plus sanitizing of tool slots
  (right skill only), research progress (capped) and projects.

### Interface

- Skills tab: a 2×2 skill grid (level, progress, which one is training), then
  the skill header with the next unlock, its tool slot, and that skill's
  actions.
- New screens: a tool picker, salvage target cards, and research project cards
  with progress bars.
- **Train tab:** Repairs and Improvements sections, plus a summary of all
  bonuses.
- **Satchel:** Materials / Parts / Machines / Tools filters and a rarity label
  on each slot.
- **Item sheets:** what uses each item; tool sheets have an Equip button.
- **Discovery sheets:** link to the matching research project.

### Tests

99 tests across 12 files (up from 62), covering:
- Salvaging, research, tools and equipment (including equip-spam and
  duplication checks).
- Improvements; all 32 repair combinations produce the right bonuses.
- v2 → v3 and v1 → v3 migration, and sanitizing.
- Offline progress for every activity type; activity switching across all four.
- Content integrity: no dead ends, every research gate and blueprint resolves.
- The goal-directed full-game bot across several random seeds.

### Known issues

- The 19 new items (notes, machinery, salvaged parts and the 10 tools) use
  code-drawn 16×16 placeholder icons. They need matching 32×32 art from Astra.
- Astra's README notes that the generated masters were normalized to a
  52-color palette; a human pixel-cleanup pass is optional.
- Several conversations can unlock at once after a long absence.
- The art pack has no fog animation (the README says so). The procedural fog
  from 0.2 is used only in the fallback scene.

### Next priorities

1. Icons from Astra for the 19 Ascension items.
2. Chapter Two: No. 9 leaves Ashvale — a second station and a travel loop.
3. Cooking and Expeditions skills, now that the four-skill core is stable.
4. Mastery per location/recipe/target for long-term goals.
5. Settings: sound with mute, save export/import, text size.

## 0.2.0 — Ashvale Station ("Operation Night Shift")

The prototype becomes a full first chapter: two connected skills, three
places to search, five locomotive repairs that change the engine on screen,
a discovery journal, two characters and a short mystery with an ending.

### Gameplay

- **Three Scavenging locations**, each with its own loot table, timing, XP,
  look and unlock:
  - *Derelict Platform* (Lv 1, 3.0 s): scrap, coal, glass, wire, rare Brass Cogs.
  - *Signal Cabinet* (Lv 3 + Firebox Door, 4.2 s): wire, relays, rare Cyan Prisms.
  - *Maintenance Shed* (Lv 7 + Shed Key, 5.5 s): timber, rivets, rare Pressure Gauges.
- **Engineering skill** (levels 1–20) with 7 recipes: Iron Plate, Fuel Brick,
  Polished Lens, Copper Coil, Timber Beam, Riveted Panel, Gauge Assembly.
  Crafting is timed, consumes inputs per action, runs offline, and stops by
  itself when materials run out.
- **Five locomotive repairs**, each with a visible change and a bonus:
  - Firebox Door: Scavenging +10% speed; opens the Signal Cabinet.
  - Headlamp: rare finds ×1.5.
  - Dry Cab: Engineering +20% speed.
  - Reinforced Tender: all XP +15%.
  - Boiler Components: all activities +10% speed; completes Chapter One.
- **Item rarity** (common / uncommon / rare) on 17 items, with descriptions,
  sources and uses.
- **Discovery journal**: 12 discoveries across the three locations (documents,
  belongings, mechanisms, clues, history). Key finds are guaranteed after a
  set number of searches so progress never stalls.
- **Characters**: Mara Venn (night signalwoman) and Tobin Harrow (retired
  fireman), with 11 conversations triggered by repairs, discoveries and
  levels, and a Chapter One finale.
- **Chapter objectives** (10 steps) with a "Show me" shortcut, **12 feats**,
  and a progress overview with records.
- **Optional onboarding** (3 cards, skippable).
- **Balance**: a simulated greedy player finishes Chapter One in about
  3 hours of active play; first repair at about 3 minutes.

### Offline and saves

- One timestamp engine for both skills; 8-hour cap; return summary shows XP,
  items gained and spent, level-ups and discoveries.
- **Clock high-water mark**: time before the latest moment ever credited is
  never paid again, so winding the device clock forward and back (even while
  switching activities) cannot farm rewards.
- **Save v2** with automatic migration from Prototype 0.1 saves (XP, items,
  Firebox Door, RNG, running activity and search count are kept).

### Presentation

- New 256×144 **Ashvale scene**: rain with splashes and canopy drips, bottle
  kilns with drifting smoke, dithered sky and kiln glow, drifting fog, a
  pulsing cyan signal, the station canopy with lamps and puddle reflections,
  ASHVALE sign, Tobin's shed (opens when unlocked), the signal cabinet
  (opens when unlocked), and Mara and Tobin on scene once met.
- **Locomotive No. 9** redrawn with tender, cab, boiler, dome, chimney,
  motion and cowcatcher, and five distinct repair states: firebox glow,
  headlamp beam, mended roof with lit windows, riveted tender with crates,
  and a green-and-brass restored livery with steam.
- The scavenger moves to wherever you're working and animates.
- **Mobile UI redesign**: five-tab bottom navigation (Station, Skills, Train,
  Satchel, Journal) with badges, a persistent "now" bar with live progress and
  Stop, toasts for rare finds, discoveries, levels, feats and conversations,
  bottom sheets for items, discoveries and dialogue, filter and sort in the
  Satchel, original pixel icons for every item and tab, and pixel portraits.

### Tests

62 tests across 9 files: XP, inventory, crafting, repairs, save round-trip and
v1→v2 migration, offline rewards, duplication exploits (reloads, clock
rewinds, forward/back cycles, stop/start spam), invalid timestamps, activity
switching, unlock progression, no-dead-end content checks, story/feat
triggers, and a full Chapter One simulation.

### Known issues

- If the device clock was set far into the future and then corrected, timed
  progress pauses until real time catches up. This is deliberate (it is what
  blocks clock-farming) but could surprise an honest player.
- Several conversations can unlock at once after a long absence; they queue
  on the Station tab rather than playing in order of the events.
- Scene animation runs at ~12 fps by design; there is no reduced-motion mode
  for the canvas itself (UI animations do respect it).
- No sound yet.
- GitHub Pages deploy is manual (Actions → Deploy to GitHub Pages).

### Next priorities

1. Chapter Two: No. 9 leaves Ashvale — a second station and a travel loop.
2. Sound: rain loop, firebox crackle, find chimes (with a mute toggle).
3. A third skill tied to the train as a community (e.g. Firing / Stoking or
   Hospitality for passengers).
4. Mastery per location/recipe for long-term goals.
5. Settings panel: export/import save, reduced motion, text size.
