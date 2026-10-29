# LAST STOP

A mobile-first idle RPG set on a forgotten railway. At Ashvale — a rain-soaked
pottery town at the end of a closed line — you scavenge the station, engineer
parts, and bring Locomotive No. 9 back to life, while a signal that should not
exist burns cyan every night.

**Play:** https://skywardgaming.github.io/LastStop/ · **Changes:** [CHANGELOG.md](CHANGELOG.md)

## The loop

Scavenging gathers materials → Engineering turns them into parts → repairs
make No. 9 visibly whole, speed up your work and unlock new places to search →
new places hold new materials and the clues to Ashvale's mystery.

- 2 skills (Scavenging, Engineering), levels 1–20
- 3 locations, 7 recipes, 17 items with rarity
- 5 locomotive repairs, each visible in the scene and granting a bonus
- 12 discoveries, 2 characters, 11 conversations, 12 feats, 10 chapter goals
- Up to 8 hours of offline progress for either skill

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
      items.ts            17 items, rarity, descriptions
      world.ts            Locations, recipes, repairs and their bonuses
      story.ts            Discoveries, characters, dialogue, feats, objectives
    activity.ts         advance(): timestamp engine for both skills
    game.ts             Player operations (start/stop/repair/tick) + story evaluation
    rules.ts            Modifiers, unlocks, durations, blockers
    inventory.ts        Atomic add/remove; never negative
    save.ts             Versioned saves, migrations, sanitising
    state.ts            GameState shape
    rng.ts, xp.ts
  platform/storage.ts   localStorage wrapper and single-tab Web Lock
  ui/
    app.ts              Controller: loop, saving, feedback, sheets, onboarding
    views.ts            Station / Skills / Train / Satchel / Journal
    scene.ts            256×144 Ashvale canvas scene
    sprites.ts          Character-map pixel art: items, tabs, portraits, figures
    dom.ts              Tiny hyperscript helper
tests/                  Vitest
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
- **Location / recipe / repair:** add to `world.ts`. The no-dead-end test will
  fail if anything required can't be obtained.
- **Discovery / dialogue / feat / objective:** add to `story.ts`.
- **Save shape change:** bump `SAVE_VERSION` and add a migration step.

## Art

All art is original placeholder pixel art drawn in code — no external assets.
