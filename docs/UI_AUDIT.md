# UI audit — before Operation First Class (main @ 9e80d50)

## What exists

| Area | Finding |
| --- | --- |
| Framework / build | Vite 8, strict TypeScript, no UI framework. DOM built with a 70-line hyperscript helper (`src/ui/dom.ts`). Vitest for the pure core. |
| Rendering | `src/ui/scene.ts` draws Astra's 384×216 scene on one canvas at ~12 fps: a cached static layer, 32 cached train combinations, then figures and effects. The canvas is CSS-scaled to the container width, which gives uneven pixel widths at most sizes. The 0.2 procedural scene is the loading and error fallback. |
| State → UI | `src/ui/app.ts` owns the `GameState`, a 250 ms tick, autosave and a requestAnimationFrame loop. Any change sets `dirty`, which rebuilds the whole tab with `replaceChildren`. Keyboard focus is lost and the entrance animation replays on every rebuild (every ~3 s while an activity runs). |
| Screens | Station, Skills (4 skills), Train (5 repairs + 3 improvements), Satchel, Journal (Finds, People, Feats, Progress). |
| Chrome | Header wordmark; scene with caption and hotspots; fixed "now" bar plus a 5-tab bar (~116 px plus safe area); bottom sheet; toasts over the scene; onboarding cards. |
| Styling | One 1,835-line stylesheet that grew in three layers (0.1 base, 0.2 overrides, 0.3 nine-slice skin). Every surface uses the same nine-slice frame. Fonts are system rounded plus system mono. Breakpoints: one at 700 px and one at 860 px (which only widens the column). |
| Assets | `public/art/rebirth` (113 PNGs, BASE_URL-resolved), code-drawn 16×16 placeholders for the 19 items added in 0.3, decoded preloading in `art.ts`. |
| Saves | `core/save.ts` (v3 plus migrations). The UI only calls `serialize`/`deserialize` through `platform/storage.ts`. |

## Problems found

1. **Station:** one long stack. Objective card, then one row per unread *conversation* (the same NPC repeated up to 6×), a skill grid, an 8-line raw log and a strip of 8 pip buttons. The scene is pushed to the top and every tab repeats it.
2. **Dock:** the activity bar and tab bar together take about 116 px. The activity progress is shown twice on the Skills screen.
3. **Surfaces:** every block is the same framed box, so nothing stands out.
4. **Typography:** there is no hierarchy between titles, narrative, counts and buttons. Dialogue uses the UI font.
5. **Rendering:** a full rebuild every few seconds loses focus and replays the entrance animation. The scene keeps drawing even on screens that hide it.
6. **Notifications:** up to 3 toasts at a time, positioned over the scene only.
7. **Train:** a list of form-like cards. The locomotive itself can't be inspected.
8. **Desktop:** the mobile column is simply widened.
9. **Accessibility:** focus is lost on rebuild, several icon-only controls lack labels, and live progress isn't announced in a polite way.

## Decisions

- **Keep untouched:** everything in `src/core` (rules, economy, saves, offline), `public/art/rebirth`, the 0.3 placeholder sprites, `scene-fallback.ts`, and the scene composition (layers, coordinates, overlays, effects).
- **Keep and extend:** `art.ts` (registry and loader), `scene.ts` (adds integer device-pixel scaling, a pause when hidden, and hotspot geometry), `dom.ts`.
- **Replace:** `views.ts`, which is split into per-screen modules over a shared kit. Also `styles.css` (replaced by tokens, base, components and screens), `index.html` chrome, and the presentation half of `app.ts`. The tick, absorb, save and actions logic is kept as-is.
