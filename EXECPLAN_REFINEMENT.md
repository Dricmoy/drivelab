# DriveLab: Technical Noir refinement

## Goal and boundaries
Refresh the 3D vehicle presentation and make Replay, Evaluation, Dataset, Model,
and dialogs usable at narrow, intermediate, and wide widths. Keep recorded poses,
planner decisions, provenance, loading/error states, sound opt-in, and reduced
motion intact. This is a visual-model update, not ML retraining or deployment.

## Plan and progress
- [x] Inspect all four screens at 320, 768, and 1024px; capture baseline screenshots.
- [x] Inspect live Framer/Midu and the Awwwards car-showroom publication.
- [x] Add original dimensional vehicle geometry and unit checks.
- [x] Separate 3D controls from the canvas; refine lighting and framing.
- [x] Repair intermediate layout, mobile comparison, and short-screen dialogs.
- [x] Build, run motion/model tests, and verify interactions in the browser.
- [x] Two screenshot critique/refinement rounds; save final evidence and limitations.

## Findings and decisions
Baseline does not exhibit global horizontal overflow in idle views. Problems are
primarily constrained canvas width at 1024px, an oversized sidebar at 768px,
overlay controls occluding the road, toy-like orange traffic inconsistent with
the legend, and cramped phone forms/tables. Move controls outside the canvas;
collapse library earlier; put inspector below the replay before it becomes too
narrow. Reuse the existing detail disclosure and status components.

Use original procedural vehicle shells, windows, wheels, lamps, and an ego sensor
pod. Footprint dimensions and world transforms remain derived from recorded data.
Vehicle appearance/height are illustrative, not a reconstructed Waymo model.
Keep demand rendering; no cosmetic perpetual animation or new motion dependency.

## References
- https://www.framer.com/community/gallery/
- https://midu.design/ — restrained black, hierarchy, tactile keycaps.
- https://www.awwwards.com/inspiration/enter-car-transition-virtual-car-showroom
  — material/lighting and deliberate camera presentation.
Otherlife's live demo has a certificate error. Do not bypass it; use the published
Awwwards preview only. Do not copy any brand assets or model files.

## Verification and deliverables
Screenshots: `design/noir-refinement/`. Test widths: 320, 375, 414, 768, 1024,
1280, 1440, 1920 plus a short landscape viewport. Check controls, document
overflow, populated evaluation, empty search, import error, export/settings,
camera presets/zoom/follow, 2D fallback, playback and inspection. Record actual
results here and in REPORT.md, not assumed success.

## Outcomes
Completed 2026-10-05. Original sedan, van, and touring-ego geometry preserves
recorded footprints/poses; glass, rims, lamps, pillars and material lighting add
depth without inventing vehicle motion. Library collapses at 960px; inspector
moves below replay at 1200px. Camera, actor selection and trajectory keys live
outside the canvas. Mobile paired-comparison cards retain meaningful labels.

Independent screenshot round 1 led to compact mobile controls, a nearby Compare
action, unobstructed trajectory keys, and honest three-decimal near-tie costs.
Round 2 led to results-first mobile layouts, collapsible test configuration,
explicit improved/regressed metric deltas, and identical-geometry path labels.
No artificial path offsets were added to make equal trajectories look different.

Build, 23 motion tests and 5 vehicle-geometry tests pass. Browser checks covered
all four modes at eight widths (320–1920px), populated nine-scenario comparisons,
empty search, a genuine invalid-import error, playback, 2D/3D, actor inspection,
camera controls, short-screen settings/export, and keyboard focus restoration.
Fixed Space on a 2D actor bubbling into the playback shortcut. Export actions are
pinned above a scrolling body at 320×480 and 844×390.

Final screenshots restore recorded run 078d7946103b40aba4fe562087e2cb3f at 3.6s,
matching the desktop baseline. Sound remains off; motion follows system settings.
QA generated local synthetic runs; existing runs and assets were retained.
Full evidence and unresolved limitations: design/noir-refinement/REPORT.md.
Large lazy 3D bundle, physical-device performance, full E2E and cross-browser
coverage remain unverified. No ML retraining, Waymo import, remote deployment,
publication or destructive cleanup occurred.
