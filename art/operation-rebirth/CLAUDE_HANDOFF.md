# Claude integration brief

Use this pack to replace visuals in LAST STOP while preserving all game logic. Read README and manifest first. Start with the modular Ashvale scene and all32 repair combinations, then17 inventory icons,12 discovery icons,9 portraits,9 character poses, UI skin and optional small effects. Keep all browser text live.

IMPORTANT: This is an asset delivery, not completed integration. Adapt the existing Canvas loader and sprite URL functions; do not overwrite the current renderer with preview.html. Integrate on a separate branch and run existing tests/build. Compare the source commit in the manifest with your current content IDs before proceeding. Never rename `reinforcedStorage` to `reinforcedTender` or add discoveries to inventory.

Use actual image files. Do not redraw approximations or replace the imagery with emoji. Preserve 384×216 logical scene composition and256×102 train alignment. Use decoded image preloading, nearest-neighbor rendering, static caching, safe-area handling, reduced motion, and clear loading/error fallback. Test each individual repair plus all32 combinations. Check portrait iPhone Safari and desktop at integer scale. The blank station sign needs live ASHVALE text. Match labels to existing content names.

See QA.json for exact validations and README for remaining limitations. Generated originals were normalized to a52-color palette; human pixel refinement can be a future polish pass. Assets do not modify gameplay files.
