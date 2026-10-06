# DriveLab Technical Noir

## Purpose / Big Picture
Implement the approved Technical Noir direction into the existing autonomous-driving research app. A visitor should identify the current operation, its recorded evidence, pending decisions, and how to inspect or pause playback. Awwwards-inspired composition and material detail should serve this workflow rather than hide it.

## Progress
- [x] 2026-10-05: Inspect running replay, four existing views, source, prior screenshots, and Santioni reference. Capture `design/technical-noir/before-desktop.jpg`.
- [x] 2026-10-05: User approves Technical Noir; read Hallmark, frontend-design, execution-plan and imagegen instructions.
- [x] 2026-10-05: Generate original etched-road onboarding illustration; distinguish it from dataset evidence.
- [x] Implement scoped visual system, coherent renderer colors, compact replay framing and reachable dialog actions.
- [x] Build and run motion and relevant browser tests: production build and 23/23 motion tests pass; manual in-app browser checks, not the Playwright suite.
- [x] Capture round-one desktop, mobile, secondary-view screenshots; independent screenshot-only critic; apply fixes.
- [x] Capture round-two screenshots; independent screenshot-only critic; apply fixes.
- [x] Browser-verify replay, camera/view switching, pending settings, JSON copy, comparison, actionable error/search-empty states, keyboard and narrow layouts. Download completion remains unconfirmed.
- [x] Final screenshots and evidence-bounded handoff recorded in `design/technical-noir/REPORT.md`.

## Surprises & Discoveries
The app computes a recorded simulation, then replays it. Pausing playback does not cancel server computation. Preserve this distinction. Existing native `summary` controls are included in the custom dialog focus trap; do not regress that behavior. The API serves `web/dist`, so building and deliberately reloading is necessary to view edits.

Older higher-specificity mobile selectors overrode the new heading layout, and the active navigation highlight used a different class than expected. Both were corrected in the scoped stylesheet. Reserving the native scrollbar gutter fixed cropped right-edge captures. The browser's range `fill()` adapter changed the DOM thumb without React state; natural keyboard scrubbing verified actual timeline/scene/inspector synchronization. Settings labels moved onto one row so all controls and the fixed footer fit a 720px desktop viewport. Mobile tool controls now form a row; redundant floating path labels are hidden only on narrow screens, with the selected path ID retained below the scene.

## Decision Log
- Use the user's already approved Technical Noir, not a new design-choice round.
- Keep React/TypeScript, native motion, R3F/Three.js and current Lucide controls. Add no animation runtime.
- Preserve global styles; append a final scoped stylesheet via `main.tsx`.
- Use cyan for selected trajectory, amber dashed alternatives, labelled red rejected paths. Vermilion is the action/brand accent, not a claim of safety.
- No remote publish, deployment, destructive file operations or personal-memory writes.

## Context and Orientation
Project: `/Users/dricmoybhattacharjee/Desktop/drivelab`. `web/src/App.tsx` owns real API state, navigation, dialogs and controls. `Scene.tsx` renders SVG debug and lazy-loads `Scene3D.tsx`, which preserves exact recorded vehicle poses and existing camera motion. `web/src/field-lab.css` and `styles.css` are older global styles. Local API is http://127.0.0.1:8765/. Existing motion/browser tests live in `web/tests`.

## Plan of Work
Milestone 1: add `web/src/tokens.css`, `technical-noir.css`, `scenePalette.ts` and shared `design.md`; import theme last. Update App framing and settings dialog body without changing requests or state. Recolor real geometry/materials in both renderers, preserving coordinates and camera algorithms. Add project-bound generated onboarding art.
Milestone 2: build, verify motion math, and exercise app in browser. Capture multiple widths and all primary views. Request a fresh critic who sees screenshots, user goals and brief only. Fix its largest actionable weaknesses.
Milestone 3: repeat screenshot-only critique independently; improve again; verify final interactions and document remaining limitations.

## Concrete Steps
From `web`, run `npm run build`, `npm run test:motion`, and relevant `npm run test:e2e` when compatible with browser-use instructions. Use the in-app browser for visual verification, keyboard and actions. Save screenshots under `design/technical-noir`. Restore temporary viewport override before handoff.

## Validation and Acceptance
Build must pass. Recorded metrics/configuration must remain unchanged by theme. Completed means API result returned, not predicted. Synthetic provenance remains explicit. Settings show planned state before rerun and footer actions are accessible within viewport. Mobile has no horizontal document overflow at 320, 375, 414 and 768 widths. Play/pause, timeline, actor/candidate inspection, 2D/3D camera, export, paired comparison and actionable import error remain operable. Preserve reduced-motion settings, visible keyboard focus and opt-in audio. Two screenshot-only critique rounds must be documented before completion.

## Idempotence and Recovery
Do not replace old CSS or remove files. New theme is isolated and imported last; removing that import recovers old appearance, while layout changes can be reverted individually. Generated image is a new sibling asset. Keep earlier screenshots and plans. Rebuilding is repeatable; local UI test runs create additional saved simulation reports, not imported real data.

## Artifacts and Notes
Before: `design/technical-noir/before-desktop.jpg`. Previous audit: `design/hallmark-audit-2026-10-05/REPORT.md`. Reference observations: `design/hallmark-audit-2026-10-05/SANTIONI-STUDY.md`.

## Interfaces and Dependencies
No API contract changes. Existing real run/evaluation/model/dataset interfaces remain intact. Use semantic CSS tokens and one central rendering palette. Generated bitmap is concept art with an explicit caption, not a replacement for real scene rendering.

## Outcomes & Retrospective
Technical Noir is implemented across all four work modes and dialogs. Two independent critics reviewed screenshots and the brief without code or implementation rationale; both rounds produced fixes. Current build and all 23 motion tests pass. Browser checks confirm replay, keyboard seek, views, inspection, planned settings, comparison, saved-run restoration, JSON copying, failure handling and responsive layouts. No real Waymo shard was imported or model trained in this UI task. Download completion was not confirmed in the in-app browser, and the existing lazy Three.js chunk still produces Vite's large-bundle warning. Cross-browser, GPU-performance and full end-to-end suites were not run.
