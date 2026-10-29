# LAST STOP

A mobile-first idle RPG set on a forgotten railway. At Ashvale — a rain-soaked
pottery town at the end of a closed line — you scavenge the station, engineer
parts, and bring Locomotive No. 9 back to life, while a signal that should not
exist burns cyan every night.

**Play:** https://skywardgaming.github.io/LastStop/ · **Changes:** [CHANGELOG.md](CHANGELOG.md)

## The loop

Scavenging finds materials, machinery and old notes → Salvaging strips
machinery for fittings, bearings, springs and magnets → Engineering makes
parts and tools → Railway Research studies your discoveries for blueprints
and better methods → repairs and improvements change No. 9, speed everything
up and open new places to search.

- 4 skills (Scavenging, Engineering, Salvaging, Railway Research), levels 1–20
- 3 locations, 5 salvage targets, 17 recipes, 12 research projects
- 36 items with rarity, 10 tools in three tiers, one tool slot per skill
- 5 repairs + 3 improvements to No. 9, each visible and granting a bonus
- 12 discoveries, 2 characters, 17 conversations, 21 feats with rewards,
  20 objectives across two chapters
- Up to 8 hours of offline progress for every activity

Art: **Operation Rebirth v1.0 by Astra** (`public/art/rebirth/`, provenance in
`docs/art-rebirth/`).

## Play locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173/LastStop/
npm run dev -- --host  # also reachable from a phone on the same Wi-Fi
```

| Command              | What it does                         |
| -------------------- | ------------------------------------ |
| `npm test`           | Run the automated tests              |
| `npm run test:watch` | Re-run tests on change               |
| `npm run typecheck`  | Strict TypeScript check              |
| `npm run build`      | Type-check and build into `dist/`    |
| `npm run preview`    | Serve the production build locally   |

## Deploy to GitHub Pages

The build uses `base: '/LastStop/'`. With **Settings → Pages → Source: GitHub
Actions** set, run **Actions → Deploy to GitHub Pages** on `main`. CI runs
type-checking, tests and a build on every pull request.

## Architecture

```
src/
  core/                 Pure rules — no DOM, fully unit-tested
    content/
      items.ts            36 items, rarity, descriptions
      world.ts            Skills, locations, salvage, research, tools,
                          recipes, repairs/improvements and their bonuses
      story.ts            Discoveries, characters, dialogue, feats, objectives
    activity.ts         advance(): timestamp engine for all four activities
    game.ts             Player operations (start/stop/repair/equip/tick) + story evaluation
    rules.ts            Modifiers, unlocks, durations, blockers
    inventory.ts        Atomic add/remove; never negative
    save.ts             Versioned saves, migrations, sanitising
    state.ts            GameState shape
    rng.ts, xp.ts
  platform/storage.ts   localStorage wrapper and single-tab Web Lock
  ui/
    app.ts              Controller: loop, saving, feedback, sheets, onboarding
    views.ts            Station / Skills / Train / Satchel / Journal
    art.ts              Rebirth asset registry and decoded-image loader
    scene.ts            384×216 Rebirth scene (layers, 32 cached repair combos, effects)
    scene-fallback.ts   0.2 procedural scene, shown while art loads or if it fails
    sprites.ts          Icon/portrait URLs (art first, code-drawn fallback)
    sprites-extra.ts    16×16 placeholders for items not in the art pack
    dom.ts              Tiny hyperscript helper
public/art/rebirth/     Astra's Operation Rebirth PNGs
docs/art-rebirth/       Pack README, manifest, QA checksums, skin reference
tests/                  Vitest (sim.ts: goal-directed full-game bot)
```

### Progression and anti-exploit rules

- Each activity stores `lastProcessedAt`; `advance(state, now)` credits whole
  actions since then and carries the remainder. Timers only decide *when* to
  call it.
- At most 8 hours is credited; older time is discarded for good.
- `clockHighWater` records the latest moment ever credited. Any `now` before
  it credits nothing, and new activities never start before it — so clock
  rewinds, forward/back cycles and rapid reloads cannot duplicate rewards.
- Drops and discoveries use a seeded RNG stored in the save: deterministic,
  online or offline.
- The game saves after every action, every 15 s, and on `visibilitychange`,
  `pagehide` and `beforeunload`.

### Saves

Stored in `localStorage` under `laststop.save` with a version number. Older
versions are migrated step by step in `save.ts` (`migrate()`); every value is
then sanitised. An unreadable save is kept under `laststop.save.corrupt`.

### Adding content

- **Item:** add to `ITEM_IDS`/`ITEMS` and draw an icon in `ITEM_SPRITES`.
- **Location / salvage target / research project / tool / recipe / repair:**
  add to `world.ts`. The no-dead-end test and the full-game bot fail if
  anything required can't be obtained.
- **Discovery / dialogue / feat / objective:** add to `story.ts`.
- **Save shape change:** bump `SAVE_VERSION` and add a migration step.

## Art

Scene, characters, item and discovery icons, UI frames and effects are
Astra's original **Operation Rebirth v1.0** pack, integrated per its README
(384×216 logical scene, 256×102 train with per-repair overlays, nearest-
neighbour rendering, live station-sign text). Icons for items added in 0.3
are code-drawn 16×16 placeholders until matching art arrives.
