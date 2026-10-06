# DriveLab 3D replay

This living plan follows the execution-plan skill. The original build and unresolved actual-Waymo-download gate remain in EXECPLAN.md.

## Purpose and scope

Add a Three.js view of the existing recorded driving decisions, not another simulator. The same frame, selection, candidates, forecasts, metrics and timeline must work in either view. Preserve the SVG debug view, including no-WebGL fallback. Use freely downloadable, locally served CC0 low-poly models rather than requiring Blender, accounts or runtime asset services.

## Design review

Keep the road as the focal surface, with pale ground, slate pavement, blue ego/selected trajectory, amber predictions, muted red rejected candidates and purple inspected paths. Retain the current typography, toolbar, inspector and timeline. An angled camera conveys spatial relationships; top-down remains the precision view and follow tracks the ego. Avoid decorative buildings that would suggest unrecorded map details. Imported models are illustrative; ground-plane dimensions and poses derive from observations, height does not claim to be measured.

## Progress

- [x] (2026-10-03) Read execution-plan and frontend-design skills, inspected existing contracts and tests, verified React 19-compatible Fiber 9/Drei 10 and Kenney Car Kit CC0 license.
- [x] (2026-10-03) Downloaded official Kenney Car Kit 3.1; retained three GLBs, shared texture, original license, official URL and SHA-256 hashes (about 538 KiB total models plus 12 KiB texture).
- [x] (2026-10-03) Added lazy 3D renderer, saved view preference, three camera presets, orbit/follow/zoom, model picking and keyboard-accessible actor controls, shared path overlays, asset fallback and 2D renderer fallback.
- [x] (2026-10-03) Final production build and all 13 geometry/browser checks passed in 1.0 minute, including the eight existing backend-connected tests and actual graphics-context loss. Scenario changes retain the selected renderer.
- [x] (2026-10-03) Inspected desktop/mobile/curved-road screenshots and actual in-app angled/chase views. Left the production app open on Sweeping bend; reset temporary viewport overrides.

## Implementation

Install Three/Fiber/Drei under web. Add Scene3D.tsx and a small wrapper around existing Scene.tsx. Localize large map coordinates around the initial ego; map backend (x,y) to Three (x,up,-y), preserving yaw and meters. Normalize model bounds to each vehicle footprint, retaining illustrative proportions vertically. Render actual road polygons and recorded paths on separate shallow height layers. Use on-demand rendering while paused and orbit controls with bounded camera distances. Explicit 2D/3D and camera controls remain keyboard accessible. Model load failures use simple vehicle geometry; renderer failures expose the original 2D view.

## Validation and acceptance

Run npm run build in web and npm run test:e2e against isolated port 8766. Existing eight tests explicitly use 2D for SVG assertions; new tests exercise actual WebGL and local assets, view switches without new simulation, timeline continuity, camera presets, actor inspection, overlay switches, mobile overflow and asset/renderer failure paths. Inspect desktop/mobile screenshots and actual in-app browser at localhost:8765. No backend or scoring semantics change. Model attribution and README explain rendering versus simulation and the real-data gate remains open.

## Discoveries and decisions

- Fiber 9.8.1 and Drei 10.7.9 peer dependencies support the installed React 19. Use a separate lazy chunk so 2D fallback does not depend on successful Three initialization.
- Default to 3D for visual replay, with an explicit 2D debug view. Existing precise SVG tests select 2D after opening.
- Normalizing a rotated child's local axes would incorrectly swap vehicle dimensions. The renderer rotates the imported clone first, then scales its parent in replay axes; a geometry test checks dimensions, grounding, front direction and no source mutation.
- OrbitControls starts interaction on clicks as well as drags. Turning follow off must preserve the camera pose instead of reframing the full map; otherwise pointer-down moves the model before pointer-up and breaks picking. Actual raycast selection now passes.
- Preserve view preference across scenario remounts. Clean up graphics-context listeners before intentional renderer disposal, so an ordinary view/scenario switch cannot be mistaken for a lost graphics context.
- Production renderer chunk is approximately 1.04 MB (282 KB gzip), independently lazy-loaded from the 277 KB application chunk. This is a current bundle-size tradeoff, not a measured frame-rate claim. No performance claim is made for 128-actor maps.
- The first complete checkpoint passed all 12 checks, including the eight pre-existing backend-connected browser tests. Desktop/mobile screenshots show recognizable imported vehicles, visible trajectories, meter-based roads and no horizontal overflow.

## Outcomes

Completed renderer upgrade without backend, physics, forecast or report-contract changes. Locally served licensed models render recorded meter-based geometry; replay and selection stay shared with 2D. Actual raycast picking, camera controls, scenario preference, play/scrub, mobile overflow, failed model loading, unsupported WebGL and genuine context loss passed. Screenshot evidence is in web/test-results/replay-3d-desktop.png, replay-3d-mobile.png and replay-3d-curved.png. README documents controls and illustrative-versus-measured fields. Existing production server remains at http://127.0.0.1:8765 with Waymax and native scoring available. The original actual-user-download verification remains unresolved; dataset_count is still zero, and no new dataset or ML performance claim is made.

Change note (2026-10-03): Added focused plan for the user-approved downloadable-model 3D upgrade; original actual-download verification is not replaced.

Change note (2026-10-03, completion): Recorded final 13-check pass, screenshot/UI inspection, asset provenance and remaining data/performance boundaries.
