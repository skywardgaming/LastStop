# Repository audit

Source: skywardgaming/LastStop, commit `def8e066477acebd1369f6b868dc616aaafe6013`.

- No PNG asset directory in the inspected tree. `src/ui/scene.ts` draws a 256×144 Canvas scene with static backdrop cache, cached per-repair locomotive, then animated lighting/weather/figures. Horizon 86; platform top 104; rail y128.
- `src/ui/sprites.ts`: character-map pixel sprites, generated Canvas PNG data URLs cached for DOM images. Inventory icons 12×12; navigation icons 12×12; NPC portraits 20×20. New files require loader adaptation, not a blind filename replacement.
- `src/core/content/items.ts`: 10 materials and 7 components. Every ID is in manifest.itemMap.
- `src/core/content/world.ts`: scavenging locations derelictPlatform, signalCabinet, maintenanceShed. Seven recipes produce the seven components. Repairs fireboxDoor, headlamp, dryCab, reinforcedStorage, boiler.
- `src/core/content/story.ts`: 12 discoveries; Mara Venn/night signalwoman and Tobin Harrow/retired fireman. The player is speaker `you`, not an additional named NPC. Dialogue describes Mara's grandfather Edric Venn but does not implement him as an on-screen character; no Edric sprite is included.
- Dialogue was read to guide appearance and expression: Mara keeps the signal box lit and investigates cyan at 03:17; Tobin has kept the shed's oak dry for fifty years, was Edric's fireman, and remembers stopping No. 9 at the yard limit. Their names, roles and dialogue are unchanged.
- `src/ui/views.ts`: Station, Skills (Scavenging/Engineering), Train, Satchel, Journal; cards for objectives, achievements, recipes, repairs, NPC conversations, recent finds; detail sheets and notifications are coordinated through app.ts. Cosmetic frames in this delivery are shared across these components.
- `src/styles.css`: app max-width520px, 12px side padding, 15px body text; safe-area support; bottom dock height116px plus safe-area inset. Scene preserves16:9. Existing icons20/36/64 CSS px and portraits56/40/28 CSS px need review for the new32/96px art. Preserve accessibility, focus, live text, modal focus handling and scrolling.
- `vite.config.ts`: base `/LastStop/`, target es2022. Resolve art URLs through BASE_URL. Preload and cache images. Do not alter game state/save serialization to store images.

No need to request a technical manifest from Claude: repository access succeeded. This manifest describes the inspected commit, not later changes Claude may make in another branch.
