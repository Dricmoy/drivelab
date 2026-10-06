# DriveLab — Technical Noir refinement

Completed October 5, 2026. Scope: visual 3D vehicles, responsive layouts and
interaction polish. No ML retraining, remote deployment, publication or dataset
import. Existing assets and recorded runs were preserved.

## User tasks and initial problems

Primary tasks are to run a planner, replay its recorded result, inspect the
decision and surrounding traffic, compare planners, and inspect the provenance
before connecting real data or training a model. Computation completion is
distinct from playback, waiting prerequisites and unverified changed settings.

The five biggest baseline problems were:

1. At 1024px the persistent library and inspector squeezed the road into a narrow
   middle column; at 768px the library still occupied too much width.
2. Camera/actor controls and path callouts occluded the replay, especially on phones.
3. Toy-like orange traffic did not match the neutral traffic legend; vehicle
   silhouettes and material depth did little to support spatial inspection.
4. Phone results were buried beneath model-training and comparison forms, while
   candidate costs rounded to one decimal obscured near ties.
5. Tablet comparison rows, phone peak-jerk aggregates and short-screen dialogs
   were cramped. Export actions could require scrolling inside a small dialog.

The baseline idle views did not exhibit global horizontal overflow. The fix was
not merely hiding overflow: it changed composition, wrapping and control placement.

## Design and implementation

Preserved the already selected Technical Noir direction and existing stack.
Hallmark and frontend-design guidance influenced material craft, consistent
tokens, restrained typography and evidence-first hierarchy, not a new theme.

- Original bevelled sedan, touring-ego and van shells with glass, pillars,
  mirrors, wheels/rims/spokes, lamps and an ego sensor pod. Recorded length,
  width, position and yaw remain authoritative; appearance and height are
  illustrative. No invented steering animation, cosmetic wheel motion or bloom.
- Demand-rendered 3D with warm key light and restrained cyan rim light. Framing
  considers nearby forward traffic; controls and trajectory keys sit outside
  the plot. Other paths recede without moving them. Equal candidate geometry is
  labelled “same geometry”; it is not artificially separated.
- Library collapses at 960px; inspector moves below replay at 1200px. Mobile
  camera selection is native, actor selection remains available, and a compact
  selected-decision summary appears near the scene.
- Paired-comparison cards retain labels/scenario context and semantic table
  roles. Metrics state higher/lower-is-better and show actual improved/regressed
  deltas. Finished results precede configuration; the method becomes a disclosure.
- Candidate costs use three decimals and explicit deltas/near ties. Previous
  verified evidence remains distinct from changed, not-yet-run configuration.
- Short-screen dialogs have scrolling bodies and reachable fixed action areas.
  Long IDs/text wrap. History fetch supports up to 100 saved runs; existing QA
  and user records were not deleted.
- Fixed Space activation on a 2D actor starting playback through event bubbling.
  Global shortcuts ignore interactive controls; collapsed-library search opens
  before focus. Native disclosures remain compatible with dialog focus trapping.

## Inspiration inspected

[Framer's official gallery](https://www.framer.com/community/gallery/) led to
[Midu](https://midu.design/): confident dark hierarchy and tactile material
detail. [Awwwards' car-showroom publication](https://www.awwwards.com/inspiration/enter-car-transition-virtual-car-showroom)
informed material lighting and deliberate camera framing. Its linked live demo
had a certificate error; it was not bypassed. The publication preview was used
instead. The established Santioni influence remains documented in design.md.
No third-party brand assets or model files were copied; no dependencies added.

Reference screenshots are retained locally for inspection and excluded from the
published repository; the original reference sites are linked above.

## Two independent critique rounds

Both critics received screenshots, user goals and the design brief, not the
implementation rationale or code.

**Round 1:** excessive mobile content before the graphic, overlapping path labels
and weak spatial clarity, and hidden candidate-cost distinctions. Changes:
compact camera/view controls, a nearby Compare action, below-canvas trajectory
key, restrained secondary paths, revised framing and three-decimal cost/deltas.
Evidence: [desktop](round1-replay-desktop.jpg),
[phone](round1-replay-mobile.jpg), [comparison](round1-evaluation-mobile.jpg).

**Round 2:** configuration preceded phone evidence; uniformly cyan metric values
implied improvement even when progress or jerk regressed; scene inspection still
needed stronger clarity. Changes: collapsed shared test method after completion,
results-first Model layout, explicit metric direction/deltas and semantic color,
tighter framing and an honest identical-geometry label. On-scene labels were not
reintroduced: they would recreate occlusion. Actor selection, path key and zoom
remain available outside the plot.
Evidence: [desktop](round2-replay-desktop.jpg),
[phone comparison](round2-evaluation-mobile.jpg), [phone model](round2-model-mobile.jpg).
Round screenshots precede their respective fixes; final screenshots below supersede them.

## Verification

- Production build passed. Motion tests: **23 passed**. Vehicle geometry/bounds
  tests: **5 passed**. Total: **28 unit tests**.
- Browser layout sweep: Replay, Evaluation, Dataset and Model at **320, 375,
  414, 768, 1024, 1280, 1440 and 1920px** (32 view/width checks). Actual DOM
  dimensions were checked after viewport changes. No document horizontal overflow,
  inspected controls/headings/table cells escaping the viewport, or internal
  clipping in the tested controls, transport, aggregates and comparison areas.
- Completed an actual **nine-scenario paired comparison** and inspected all 18
  result rows. These are synthetic local results, not a driving safety guarantee.
- Playback advanced from reset, next-frame moved to 0.1s, and Play/Pause advanced
  and stopped recorded time. 2D/3D, camera presets, zoom/follow and actor
  inspection were exercised. Space on a 2D actor now inspects without starting
  playback. A camera transition reported transitioning then finished with finite
  pose/target; this is not an FPS or perceptual-fluidity benchmark.
- Settings: applied a speed change and observed “settings changed / previous
  run”; restoring settings cleared it. Focus wrap, Escape restoration and native
  Help disclosure keyboard behavior were checked.
- Settings/export checked at **320×480** and **844×390**. Final landscape export
  copy/download actions occupy y=317–361 inside a y=12–378 dialog; phone actions
  are also visible without scrolling the body. Summary includes 101 recorded
  frames. Actual export download/copy was not exercised in this refinement.
- Empty library search displayed “No matching scenarios”; Clear search restored
  it. An intentionally missing local TFRecord produced a genuine FAILED state
  and actionable error without claiming a new verified result; then it was cleared.
- Eight sampled text/control color pairs calculated from observed OKLCH colors
  had WCAG contrast ratios **7.14:1–14.87:1**. This is a sample, not full WCAG
  certification. Focus indicators and semantic/non-color state labels remain.
- Final browser error log was empty. Final handoff restores run
  `078d7946103b40aba4fe562087e2cb3f`, paused at **3.6s / frame 37**, with sound off,
  system motion preference restored, no open dialogs and temporary viewport reset.

## Before and after

Matched desktop captures use the same recorded run and time. “Dimensional models”
describes the visualization, not new ML weights or a reconstructed real vehicle.

| Before | After |
| --- | --- |
| [Desktop baseline](before-replay-desktop.jpg) | [Desktop refinement](after-replay-desktop.jpg) |
| [320px baseline](before-replay-320.jpg) | [Final phone replay](after-replay-mobile.jpg) |
| [Model baseline](before-model-320.jpg) | [Results-first phone model](after-model-375.jpg) |
| [Comparison baseline](before-evaluation-320.jpg) | [Phone comparison](after-evaluation-375.jpg) |

![Final replay](after-replay-desktop.jpg)

Additional evidence: [tablet replay](after-replay-768.jpg),
[small export](after-export-small.jpg), [landscape export](after-export-landscape.jpg),
[small settings](after-settings-small.jpg), [landscape settings](after-settings-landscape.jpg),
[import error](after-import-error.jpg), [empty library](after-empty-library.jpg).
The eight-width final sweep captures use `after-{view}-{width}.jpg`.

## Remaining limits

- Vite warns about the lazy 3D chunk: **978.42KB raw / 263.44KB gzip**. Rendering
  remains lazy and demand-driven, but bundle optimization is still outstanding.
- No physical-phone GPU/FPS/battery testing or independent cross-browser sweep.
- The full Playwright CLI E2E suite was not run; browser interactions were manually
  exercised through the in-app browser. Tests were updated for disclosure and
  Space inspection behavior, but unrun E2E assertions are not claimed as passes.
- No valid Waymo import, full backend regression suite, ML retraining, real-data
  validation, actual export download or audible sound test in this refinement.
- QA created saved local synthetic runs. Existing records/assets are retained;
  no destructive cleanup or remote writes occurred.
