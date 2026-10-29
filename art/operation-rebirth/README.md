# LAST STOP — Operation Rebirth, asset pack v1.0

Original railway art produced for skywardgaming/LastStop. **Assets and an inspection viewer only; gameplay integration has not been performed.** Repository inspected at `def8e066477acebd1369f6b868dc616aaafe6013` on 2026-10-29. Do not replace gameplay, saves, balance, dialogue or progression with the viewer.

## Start here, Claude

1. Inspect `manifest.json`, `REPOSITORY_AUDIT.md`, `QA.json`, and `assets/previews/scene_repaired_3x.png`.
2. Open `preview.html` in a browser. It uses local relative assets and has no dependency on the game or a server. Repairs can be toggled independently. It is an asset inspector, not a playable build.
3. Copy `assets/` to `public/art/rebirth/` in the Vite game. Resolve URLs with `import.meta.env.BASE_URL + 'art/rebirth/' + asset.path.replace(/^assets\//, '')`. The game's base is `/LastStop/`; root-relative `/assets/...` URLs will break Pages deployment.
4. Preload and decode all scene images before rendering. Keep the existing scene visible if loading fails. Cache static layers and the 32 possible repair combinations. Never recreate images every animation frame.
5. Map `itemIconUrl`, `portraitUrl`, and navigation icons in `src/ui/sprites.ts` to the manifest, retaining existing exported APIs. Discoveries need a new icon hook in the journal; these are separate from inventory and must not be inserted into `ITEM_IDS`.
6. Adapt `src/ui/scene.ts` to a 384 × 216 logical canvas and the layer composition below. Update figure spots/hit areas and scene CSS together. Existing 256 × 144 coordinates cannot simply be kept. Set `imageSmoothingEnabled = false` after any canvas resize. Use CSS `image-rendering: pixelated`.
7. Apply the optional scoped `rebirth.css` skin selectively. Use shared frames for cards/modal panels rather than separate raster images for every content length. Browser-render all body copy, button labels, quantities, station-sign text and rarity labels.
8. Run the game's normal tests/build, test saves and all repair orders, then test iPhone Safari safe areas, sheets, accessibility and loading. This art-only delivery does not certify those integration behaviours.

## Visual rules

Night indigo and violet; warm amber light from upper left; soot brick and cream ceramic; weathered olive, rust, brass; cyan reserved for the signal and anomalous discoveries. `palette.hex` contains the shared 52-color RGB palette. Sprite alpha is binary; effects deliberately use stepped partial alpha. Previews include browser/raster labels which are not sprite colors.

The generated masters were larger pixel-style illustrations, not exact logical sprite sheets. Exports are sliced, normalized using **nearest-neighbor**, mapped to the shared palette without dithering, and inspected at target size. This produces usable exact-grid assets; it is not a claim that image generation natively produced hand-authored 1:1 pixel clusters. Fine texture is denser than classic low-detail sprites. Further human pixel cleanup is an optional art-polish pass.

## File layout and sizes

- `assets/environments/`: 384 × 216 stack layers, 48 × 48 props, standalone architecture pieces, optional static backdrop.
- `assets/locomotive/`: 256 × 102 train and same-size repair overlays. All at the same origin.
- `assets/characters/`: 96 × 96 portraits; 32 × 48 figure poses; 96 × 48 three-pose atlases.
- `assets/items/`: 32 × 32 inventory and discovery icons, plus a satchel utility icon.
- `assets/ui/`: 48 × 48 nine-slice frames, 24 × 24 navigation/marker icons, 32 × 8 progress fills.
- `assets/effects/`: horizontal animation sheets; exact frames and timings in manifest.
- `assets/previews/`: inspection images only, not dependencies of gameplay assets.
- `manifest.json`: every final PNG, dimensions, purpose, mappings, timings and anchors.
- `preview.html`, `rebirth.css`: opt-in inspection and skin reference.
- `tools/verify.cjs`: run with Node and Sharp from this repository checkout. Validates against the inspected game's content source files.
- `tools/export.cjs`, `tools/previews.cjs`: provenance/export implementation. Export requires the original generated masters at `REBIRTH_SOURCE_DIR`; those large intermediate masters are not runtime dependencies and are not included in this compact delivery. Do not run export to integrate the existing PNGs.

## Render order and default scene coordinates

All full-canvas layers use origin `(0,0)`. Coordinates are logical pixels; y increases downward.

| Order | Layer / sprite | Origin |
|---|---|---|
| 0 | sky | 0,0 |
| 10 | skyline | 0,0 |
| 20 | station_buildings | 0,0 |
| 30 | platform_architecture | 0,0 |
| 40 | tracks_ground | 0,0 |
| 45 | shed_closed/open | 0,108 |
| 45 | cyanSignal | 334,100 |
| 45 | bench / luggage / ashPlanter | 73,113 / 127,116 / 41,113 |
| 45 | stationSign / cabinet_closed/open | 199,102 / 310,112 |
| 50 | no9_base_damaged + selected repair overlays | 99,95 |
| 60 | Mara / conductor poses | 63,110 / 85,112 |
| 70 | lantern/window/signal/headlamp effects | see effect anchors below |
| 80 | optional steam and rain | local sprites/tiles only |
| 90 | scenery shortcut markers | DOM controls with 44px minimum tap area |

Alternative: `ashvale_static_alternative.png` is an optional flattened architectural background **without train or characters**. Use it instead of the five modular architecture layers, not on top of them. It has its own baked lights, and is explicitly not an animation-ready substitute for the modular pack.

Station signage is blank by design. Add `ASHVALE` as live DOM text or runtime canvas text. Never stretch an entire scene to portrait: keep a 16:9 diorama above scrollable controls. Foreground props have padded 48px cells; their apparent physical size should be chosen deliberately. Do not treat a shed prop as the large main station.

## Locomotive restoration — exact alignment

Base and overlays are **256 × 102**, origin `(0,0)`, scene origin `(99,95)`. Draw base then enabled overlays using ordinary `source-over`. Do not independently trim, resize or center overlays. The clean chassis, rods, wheels and alpha silhouette are immutable. The base combines generated damage only within disjoint opaque interior masks; this prevents regenerated source art from moving the train.

| Game repair ID | Overlay | Regions [x,y,width,height] |
|---|---|---|
| fireboxDoor | repair_fireboxDoor.png | [93,52,16,20] |
| headlamp | repair_headlamp.png | [226,20,16,17] |
| dryCab | repair_dryCab.png | [77,18,40,27] |
| reinforcedStorage | repair_reinforcedStorage.png | [10,47,66,18] |
| boiler | repair_boiler.png | [117,25,84,32], [132,24,10,9] |

`no9_stage_0` through `_5` are convenience before/after previews in the above sequence. **Do not use stage count as the gameplay state**: repairs may be purchased in other orders. `no9_all_repaired.png` is the expected exact composition with all five patches. All 32 combinations are checked for unchanged alpha silhouette. These overlays restore interior visual regions; the damaged cab roof is weathered and dark rather than having a silhouette-breaking hole.

## Characters and content mappings

Only the conductor plus the two implemented NPCs are included. Player maps to dialogue speaker `you`; manifest art key is `conductor`. NPC keys `mara` and `tobin` match the repository. Portrait columns: neutral, concerned, relieved. Poses are **state-selected images, not a walk cycle**. Conductor pose 1 is crouching/scavenging; NPC pose 1 is concerned. Pose 2 is relieved. No speaking lip sync or movement animation is claimed.

All 17 inventory IDs and all 12 discoveries are mapped exactly in manifest. Discovery `kilnToken` is displayed in the game as **Bottle Works Token**, `stationPhoto` as **Faded Photograph**, `patchPanel` as **Riveted Panel**. Use existing game names, not filenames, for display labels. Rarity belongs to game data: render text and corner-bracket slot styles; never bake rarity into item art or rely on color alone. The satchel icon is a utility asset, not a new game item. Repair ingredients are the existing item icons; no invented repair items are added.

## UI component assignment

| Game component | Shared art |
|---|---|
| Main navigation | station, skills, train, satchel, journal; settings optional |
| Scavenging/skill panels | panel_ceramic / panel_iron |
| Engineering recipes / repair cards | panel_engineering |
| Chapter objectives / notifications | panel_iron, selected state when achieved |
| NPC dialogue / journal | panel_wood |
| Inventory slots | slot_common, slot_uncommon, slot_rare + rarity text |
| Buttons / modal frames | panel_selected, panel_disabled, panel_iron |
| Progress bars | progress_amber, progress_cyan, progress_copper |

Nine-slice insets: 10 logical pixels for 48px frames; 2px for progress fills. `border-image: url(...) 10 fill stretch` provides plain centers for live text. Keep corners fixed; stretch the edges/center, not the entire panel. Preferred body text 15–16 CSS px and 44px or larger tap targets. Inventory icons display at 32px or 64px; portrait art at 96px or 192px where space allows. Scaling to arbitrary widths with nearest-neighbor can produce uneven pixel widths; for pixel-perfect desktop inspection use integer scaling. On a small phone, preserve full-scene framing rather than crop the signal or train.

## Effects

| Sheet | Frame size | Frames | Frame duration | Reduced motion |
|---|---|---|---|---|
| rain | 32×32 | 4 | 140ms | hidden |
| steam | 32×32 | 6 | 160ms | hidden |
| lantern_glow | 32×32 | 4 | 240ms | freeze frame 0 |
| signal_pulse | 32×32 | 4 | 240ms | freeze frame 0 |
| window_light | 16×16 | 4 | 300ms | freeze frame 0 |
| rare_discovery | 32×32 | 6 | 100ms | hidden |
| headlamp_glow | 48×48 | 4 | 250ms | freeze frame 0 |

Frames are arranged left to right, no padding. Use `drawImage(sheet, frame*w, 0, w,h, x,y,w,h)` or background-position with `steps(frames)`. Rare discovery is a one-shot in game, though the inspector loops it to aid inspection. Steam is a small stylized puff, not physically simulated vapor; no fog animation is included. Apply 1–3 local glow sprites, not a full-screen blur. Approximate scene anchors: smokestack (310,110), headlamp (335,124), cyan signal (362,111); tune against the actual displayed props. Effect anchors describe the **center**; subtract half frame size when drawing. Reuse lantern glow for ambient lamp pools. Pause animation when hidden and honor `prefers-reduced-motion` changes.

## Scope and remaining work

This delivers a verified asset pack, not a premium-commercial quality certification or an integrated game. Integration and device testing remain Claude's task. Additional walk cycles, directional views, lip sync, full fog simulation and new stations are not included. The existing game's shader-free Canvas approach can consume these images without adding a new renderer. No external artwork was copied or traced. Existing gameplay files were not modified.
