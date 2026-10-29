# Production notes and validation limits

113 runtime/reference asset PNGs plus11 inspection preview PNGs,124 total. The runtime count includes optional flattened scenery and sequential train reference states; these are not all required downloads. Use manifest kinds to choose dependencies.

Image masters were generated using the built-in image generation tool. Technical export uses Sharp for slicing, alpha normalization, nearest-neighbor sizing, palette mapping and compositing. New art filenames in this pack are deliberate delivery filenames, not claims about original repository assets.

Prompt set:
- Ashvale: forgotten railway station, soot brick, cream ceramic, bottle kilns, wet horizontal platform, amber lamps, indigo/violet night, cyan signal, no train/people/UI. Separate sky and architecture atlas requested.
- No.9: isolated transparent side-view olive locomotive facing right, cream cab, rust-red rods/chassis, brass machinery, left tender, three driving wheels, warm firebox. Damaged edit constrained to firebox/headlamp/cab/tender/boiler. Final exact alignment is enforced by five disjoint masks, not trusted to generation.
- Inventory:6×5 transparent atlas with the17 source-confirmed materials/components followed by12 source-confirmed discoveries and a utility satchel, in explicit row-major order.
- Portraits:3×3 transparent atlas, conductor/Mara/Tobin by row, neutral/concerned/relieved by column, indigo shadows and warm upper-left light.
- Figures:3×3 transparent atlas using portrait designs, three states per character; conductor has scavenging crouch.
- Props:4×3 transparent atlas of sign, lantern, cyan signal, luggage, cabinet closed/open, shed closed/open, planter, bench, tool bag and fence. Hand-selected extraction bounds avoid neighboring objects.
- Interface:3×3 transparent atlas of iron/selected/disabled, wood/ceramic/engineering panels and three inventory slot styles. No baked body text.
- Shared prompt constraints: original artwork, crisp pixel clusters, limited olive/cream/rust/brass/amber/indigo/cyan palette, no copied/traced game art.

The first architecture previews visually appeared to contain haze. Byte-level inspection showed that the surrounding RGB haze was already transparent alpha; exported alpha was normalized and checked. An extra background-removal attempt was not used. No fake checkerboard was accepted as transparency.

Validated:
-124 PNGs fully decoded; manifest dimensions match.
- Sprite alpha normalized to0/255; effects intentionally retain stepped alpha.
-17 inventory IDs and12 discoveries matched to repository source.
- All32 repair combinations maintain the original alpha silhouette.
- All5 overlays reproduce the repaired master exactly.
- Contact sheets visually inspected: items, portraits, props, interface and assembled scene. Neighboring prop fragments detected and removed through corrected extraction bounds.
-390px static layout reference visually inspected. Exact software-rendered image is labeled as a reference, not a browser screenshot.

Not validated:
- The HTML preview was syntax/reference checked but could not be browser-executed: Playwright's Chromium executable was absent and its download returned an invalid archive.
- No real iPhone Safari run, game playtest, live asset loading test, or performance profile was possible in this asset-only delivery. These remain integration checks.
- No walk cycles, directional movement sets, lip-sync or fog sheet is included. Do not reinterpret static pose atlases as animation sheets.
