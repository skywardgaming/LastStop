# LAST STOP — Interface design system ("The Conductor's World")

A short reference for anyone adding screens. The interface frames Astra's
pixel art; it never redraws it. Everything below lives in `src/ui/styles/`
and `src/ui/kit.ts`.

## Principles

1. **The world comes first.** The station scene and the engine are the
   heroes. Chrome stays dark, quiet and out of the way.
2. **Brass means "you can act", cyan means "the signal".** Amber/brass for
   buttons, progress and anything ready; cyan only for restored parts,
   research results and the mystery. Rust for blocked.
3. **Pixel art at whole sizes.** Icons render at 24/32/48/64/96 CSS px
   (`art(src, size)`), scenes and the inspector scale by whole device
   pixels when that fills ≥82–85% of the box, otherwise nearest-neighbour.
4. **Every control does something.** No placeholders, no fake numbers.
   Locked things say exactly why and link to where to fix it.
5. **Motion explains, never decorates.** All durations are tokens and drop
   to 0 under `prefers-reduced-motion`.

## Tokens (`tokens.css`)

| Group | Tokens |
| --- | --- |
| Surfaces | `--c-night`, `--c-plum-900…500`, `--c-line`, `--c-line-soft` |
| Text | `--c-text`, `--c-text-2`, `--c-muted`, `--c-faint` |
| Action | `--c-brass(-hi/-lo)`, `--c-amber(-hi/-lo)` |
| Signal | `--c-cyan(-hi/-lo)` |
| State | `--c-rust`, `--c-good`, `--c-danger` |
| Journal paper | `--c-paper(-2)`, `--c-ink(-2)`, `--c-ink-faint`, `--c-stamp` |
| Rarity | `--c-common`, `--c-uncommon`, `--c-rare` (always with a text label) |
| Space | `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 20 · `--s-6` 24 · `--s-8` 32 |
| Shape | `--r-1` 4 · `--r-2` 8 · `--r-3` 14 · `--r-pill` |
| Depth | `--shadow-1/2`, `--shadow-lift`, `--glow-amber`, `--glow-cyan` |
| Motion | `--dur-1` 110ms · `--dur-2` 200ms · `--dur-3` 320ms, `--ease-out`, `--ease-spring` |
| Layout | `--tap` 44px, `--masthead-h`, `--nav-h`, `--dock-h`, `--safe-*`, `--content-max` |

## Type roles

Self-hosted (no network fonts): **Barlow Condensed** for signage,
**Barlow** for UI, **Alegreya** for story.

| Role | Token / class | Use |
| --- | --- | --- |
| Title | `--t-title` / `.label-title` | Sheet and screen titles |
| Heading | `--t-heading` / `.label-heading` | Plate titles |
| Section | `--t-section` / `.label-section` | Uppercase tracked group labels |
| Body | `--t-body` | Default UI text |
| Small / micro | `.text-small`, `.label-micro` | Meta lines, captions |
| Story | `--t-story` / `.text-story` | Item lore, dialogue, journal |
| Numbers | `.num` | Tabular figures for counts and timers |

## Primitives (`kit.ts`)

| Primitive | What it is |
| --- | --- |
| `art(src, size, {silhouette})` | Pixel image at a whole size; silhouette for unknown things |
| `button({label, variant, size, …})` | `primary` (amber), `secondary`, `ghost`, `repair` (rust→amber), `stop`, `signal` |
| `tabs(items, value, onChange, label, 'pill' \| 'index')` | Roving-focus tablist; `index` is the journal's paper tabs |
| `progress(f, tone, {live})` | Rail bar; `live: 'activity'` is updated every frame by the controller |
| `gauge(f, value, tone, size)` | 270° boiler dial for skill levels |
| `plate`, `group`, `stamp`, `emptyState` | Surfaces, labelled groups, status stamps, honest empty states |
| `requirements(list)` | Have/need rows; each row links to where to get it |
| `rewardChips(list, max, sign)` | Item + quantity chips (`+` for gains, `×` for costs) |
| `yieldStrip(list)` | Possible rewards for an activity |

Formatting: `fmtQty` (9,876 · 12.3k · 1.2M), `fmtSeconds`, `fmtAgo`.

## Shell (`shell.css`)

- **Masthead**: place + chapter, save pip, No. 9 progress chip, menu.
- **Stage**: the scene with real hotspots. Mobile shows it on Station only;
  desktop (≥1024px) keeps it in a sticky centre column.
- **Dock**: current activity, live progress, Stop. Goes quiet on the skill's
  own screen so progress isn't shown twice.
- **Nav**: five destinations; bottom bar on mobile, left rail on desktop.
  Badges only for real counts (unread conversations, parts ready).
- **Drawer**: bottom sheet on mobile, right panel on desktop. Focus is
  trapped, Escape closes, focus returns to the opener. `paper: true` for
  journal pages.
- **Notices**: at most two on screen; routine ones are dropped first.

## Patterns

| Pattern | Where | Notes |
| --- | --- | --- |
| Timetable rows (`.tt-row`) | Skills | Toggle for details, play/stop disc, live bar while running |
| Inspection pit + selector | Train | Hotspots and chips share `ui.trainPart`; confirm before spending |
| Slot grid | Satchel | Astra's rarity frames; rarity also in the label |
| Notebook pages | Journal | `JOURNAL_SECTIONS` registry; add a page with `{ id, label, render }` |
| Medallions | Station | One per character, badge = unread conversations |

## Adding a future screen (crew, expeditions, map, construction)

1. Add the tab id to `Tab` and `TABS`/`TAB_TITLE` in `app.ts`, and a nav icon.
2. Write `screens/<name>.ts` exporting `(ctx: ScreenCtx) => HTMLElement`.
   Read state from `ctx.state`, view state from `ctx.ui`, and call only
   `ctx.act` — never mutate state in a screen.
3. Compose from kit primitives and existing patterns before adding CSS; new
   styles go in `screens.css` and use tokens only.
4. Give rebuilt controls a `data-key` so focus survives re-renders, and
   horizontal scrollers `data-scrollx`.
5. Check 320px, 390px, 768px and 1280px with the nav and dock in place.
