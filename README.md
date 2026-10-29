# LAST STOP

A mobile-first idle RPG set on a forgotten railway. You scavenge a derelict
platform by lantern light, level up, and bring Locomotive No. 9 back to life
one repair at a time.

**Prototype 0.1** covers one complete loop: Scavenging → resources and XP →
repairing the Firebox Door.

## Play locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173/LastStop/
```

To try it on an iPhone on the same Wi-Fi network:

```bash
npm run dev -- --host
```

Vite prints a `Network:` address such as `http://192.168.1.20:5173/LastStop/`;
open that in Safari on the phone.

Other commands:

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm test`          | Run the automated tests once          |
| `npm run test:watch`| Re-run tests on every change          |
| `npm run typecheck` | Strict TypeScript check               |
| `npm run build`     | Type-check and build into `dist/`     |
| `npm run preview`   | Serve the production build locally    |

## Deploy to GitHub Pages

The site is built with `base: '/LastStop/'` (see `vite.config.ts`), matching
the repository name.

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. **Actions → Deploy to GitHub Pages → Run workflow** on `main`.
3. The game appears at `https://skywardgaming.github.io/LastStop/`.

Deployment is manual on purpose. To deploy on every merge to `main`, add a
`push` trigger in `.github/workflows/deploy.yml` (instructions are in the file).

> GitHub Pages for a **private** repository requires a GitHub Pro, Team or
> Enterprise plan. On a free plan, make the repository public or host `dist/`
> elsewhere (e.g. Cloudflare Pages or Netlify).

The `CI` workflow runs type-checking, tests and a build on every pull request.

## How it works

```
src/
  core/          Pure game rules — no DOM, fully unit-tested
    data.ts        Resources, locations, repairs, constants
    xp.ts          XP curve and levels 1–20
    rng.ts         Seeded RNG (state lives in the save)
    inventory.ts   Atomic add/remove; never negative
    scavenging.ts  Timestamp-based progression (advance)
    repair.ts      Repair checks and spending
    save.ts        Versioned, validated saves
    state.ts       GameState shape
  platform/
    storage.ts     localStorage wrapper and single-tab lock
  ui/
    app.ts         DOM, timers, saving, events
    scene.ts       Canvas pixel-art train scene
    sprites.ts     Character-map sprites, icons, pixel font
tests/           Vitest tests for the core
```

### Progression

Every activity stores `lastProcessedAt`. `advance(state, now)` computes how
many whole searches fit since then, rolls their drops with the saved RNG, and
moves `lastProcessedAt` forward by exactly those searches, keeping any
remainder. Browser timers only decide *when* to call it, so live play, a
locked phone, and a cold start after days away all share one code path.

- **Offline cap:** at most 8 hours is credited; older time is discarded.
- **No double rewards:** rewards depend only on the timestamp, which moves
  forward as they are paid, and the game saves immediately after catching
  up. A Web Lock also stops two tabs from running the game at once.
- **Clock changes:** if the device clock goes backwards, nothing is credited
  and the timestamp is not rewound.
- **Deterministic drops:** the same save advanced to the same moment always
  yields the same items, whether you were online or not.

### Saving

Saves go to `localStorage` under `laststop.save`, every 15 seconds, after
every player action, and whenever the page is hidden or unloaded
(`visibilitychange`, `pagehide`, `beforeunload` — iOS Safari does not
reliably fire `beforeunload` alone). Saves are versioned; unknown versions
are rejected, and malformed values are clamped rather than trusted. An
unreadable save is kept aside under `laststop.save.corrupt`.

### Adding content

- New resource: add an id to `RESOURCE_IDS` and a definition in `RESOURCES`,
  plus an icon in `ui/sprites.ts`.
- New location: add it to `LOCATIONS` with its drops and level requirement.
- New repair: add it to `REPAIRS`.
- Changing the save shape: bump `SAVE_VERSION` and add a step in `migrate()`.

## Art

All art is original placeholder pixel art drawn in code (`ui/scene.ts`,
`ui/sprites.ts`) on a 192×108 canvas scaled with crisp edges.
