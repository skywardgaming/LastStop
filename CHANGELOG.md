# Changelog

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
