# Give DriveLab a tactile, evidence-first interface

This living plan follows the execution-plan skill. Preserve the existing React/TypeScript/Fiber frontend and all Python/Rust simulation behavior. Existing capabilities are documented in README.md and EXECPLAN_3D.md. No new backend job cancellation, progress percentages, dataset validation or autonomy is implied.

## Purpose / Big Picture

Users should immediately see the driving scene, understand whether computation or playback is active, inspect the recorded evidence for a completed run, identify missing dataset/model prerequisites, and change settings or pause playback. Redesign Replay, Evaluation, Dataset and Model with a coherent tactile Field Lab visual language. Capture current screens before edits, compare three directions, implement the recommended direction, then conduct two independent screenshot critique/improvement rounds and verify actual interactions.

## Progress

- [x] (2026-10-03) Read product-design audit/ideation, frontend-design, imagegen and execution-plan guidance. No saved Product Design context exists. Captured current Replay, Evaluation, Dataset and Model through the in-app browser in design/ui-refresh.
- [x] Identified primary tasks, five concrete UI issues and three distinct directions. User explicitly requested a recommendation followed by implementation, overriding the ideation skill's usual wait-for-selection step.
- [x] Generate three grounded concept images and a project-bound personality illustration.
- [x] Implement Field Lab components, status/evidence system, accessible tactile controls, opt-in sound and restrained graphics.
- [x] Capture round-one screens, obtain independent screenshot-only critique, implement fixes: recorded run/checkpoint receipts, signed-cost explanations and rejected reasons, mobile decision summary/disclosure.
- [x] Capture round-two screens, obtain independent screenshot-only critique, implement fixes: unclipped library/candidate layout, separate comparison footer, actual selected/runner-up path labels, clearer secondary type and grouped labeled playback.
- [x] (2026-10-03) Verify real interactions and states, capture final before/after evidence, and prepare paused browser preview. TypeScript/Vite build passes; exact browser checks and validation limits recorded in design/ui-refresh/REPORT.md and design-qa.md.

## Context and Orientation

web/src/App.tsx owns current scenario, report, playback, import, training, comparison and dialogs. api.ts reads localhost FastAPI; completed reports include frames, source, recorded scorer, engine and timings. Scene.tsx switches SVG/Three renderers; Scene3D.tsx renders measured XY footprints with illustrative 1.5-meter model height. styles.css holds existing styles; introduce explicit field-lab tokens and component styles without discarding working selectors. Browser is http://127.0.0.1:8765; API serves web/dist, so npm run build --prefix web refreshes production assets without backend restart.

## Milestones

First capture and audit actual screens. Generate distinct visual targets grounded in before screenshots, then implement Field Lab: one large replay, compact outcomes, a persistent operation/status strip and recorded run receipt. Keep models and roads grounded in actual data, using render-only materials/shading for personality. Introduce opt-in Web Audio click sounds triggered only by user interaction, with a visible persistent mute control and no automatic success sounds.

Second separate planned settings, active computation, completed reports, simulation failures, request errors and missing prerequisites. Pause operates on replay only. Backend computations have no cancellation or streaming progress; label this honestly instead of adding fake controls. Preserve past reports while recomputing and never label them current verification. Improve loading/empty/error/long text, focus, keyboard targets, mobile layout and reduced motion.

Third capture images after the first implementation. Spawn a context-isolated design critic with only screenshots and the user brief, never source or our rationale. Apply its three highest-priority fixes. Repeat with fresh screenshots and another critique round, applying fixes before final checks. Verify scenario selection, timeline/transport, camera, actor/candidate inspection, staged settings, comparison, import errors, model status and sound toggling in the in-app browser. Build and type-check frontend. Existing automated test files should be maintained; browser CLI is not used without authorization under Product Design browser guidance.

## Design system and Decision Log

Field Lab uses porcelain #f6f7f9, white #ffffff, ink #182a39, steel #c9d1d7, cobalt #285fea and amber #f4ae46. Use a geometric rounded sans for readable UI, with tabular numerals rather than a tiny monospace data aesthetic. Align content left and preserve generous road-view space. Use 4/8/12/16/24/32 spacing, 12px field radii, 18px main viewport corners and 44px primary controls. Control elevation signifies pressability, not container decoration. Status combines words/icons/color. Graphics are concentrated in actual replay geometry; generated illustration supports the dataset empty state and is not presented as measured data.

## Surprises & Discoveries

The in-app viewport override and screenshot capture can differ from requested dimensions. Initial oversized capture was rejected because its right side was clipped; retained fresh natural-viewport captures instead. Further captures must be checked visually, not trusted from requested size alone.

The application exposes replay pause but no backend cancellation endpoint or streaming job progress. Do not add a misleading pause-computation button, percentage or fabricated task feed. A completed simulation with collision is a completed run containing recorded failures, not a failed API request or a safety certification.

Final interaction checks caught two additional issues: opening a saved report was incorrectly labeled computation (now a separate restoring state), and rendering full JSON in a textarea was impractical. A curved-road report was measured at 13,747,726 pretty-printed characters. The export dialog now renders a bounded summary and copies/downloads the complete report only on explicit action. The initial oversized dialog caused in-app verification timeouts; recovered testing must use the bounded final build and preserve the user's original tab.

## Validation and Acceptance

From project root run npm run build --prefix web. Use the selected in-app browser for all interaction and screenshot verification. Preserve existing report/selection/settings contracts and update tests if selectors legitimately change. Screenshots must include the four main screens, replay mobile/desktop, and examples of waiting/error/running/planned/completed states. Verify visible keyboard focus, sound on/off persistence, no horizontal overflow, meaningful labels, no invented result metrics, and appropriate reduced-motion behavior. Record exact successful/failed checks, critic responses and changes in design/ui-refresh/REPORT.md.

## Idempotence and Recovery

All edits are local and additive. Preserve models, database, checkpoints, saved runs and unrelated user files. No destructive cleanup, publishing or commits. Copy generated project assets into web/public/art; do not reference agent-only generated-image paths at runtime. Before images stay alongside final images.

## Outcomes & Retrospective

Field Lab implemented in the existing stack, including coherent tactile controls, opt-in sound, a generated dataset illustration, refined actual 3D materials/path labels and truthful activity/evidence states. Two independent screenshot-only critique rounds completed; fixes verified in fresh captures. Actual scenario computation, staged settings, replay controls, inspections, failure jumps, comparison, saved-run restoration, import errors, keyboard dialogs, sound preference and 390px responsive layout checked through the in-app browser. Final TypeScript and Vite production build passes.

The large-report dialog now shows a bounded summary rather than rendering a 13.7-million-character report. Copy API completion was observed but payload round-trip and file-download completion remain unverified. No CLI integration/backend/Rust tests or model retraining were performed during this UI turn. Reduced-motion emulation and human sound audibility are untested. The lazy 3D chunk size and existing dependency clock deprecation warning remain. Dataset count is still zero; actual-user Waymo download/verification gate is unchanged. No datasets, checkpoints or old reports were removed.

Change note (2026-10-03): Added complete audit/design/implementation/critique plan grounded in current capabilities and the user's tactile visual brief.

Completion note (2026-10-03): Recorded both critique rounds, export recovery and restoration-copy corrections, final screenshots, successful build/browser checks and bounded unresolved validation issues.
