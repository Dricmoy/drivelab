# DriveLab coordinated motion — 3 October 2026

The Field Lab redesign is extended with coordinated, interruptible motion. Recorded frames, vehicle poses, numerical results and request state remain authoritative. Native Web Animations and the installed Three/React stack are used without adding a motion dependency.

The original [UI report](../ui-refresh/REPORT.md) contains the five-problem audit, three visual directions, generated artwork, before/after captures and two independent screenshot-only correction rounds. This report covers the subsequent motion goal, not a new autonomous-driving benchmark.

## Implemented interactions

- A measured navigation highlight travels between selected tabs; workspace entry follows navigation direction. Static selection remains visible before initialization and under reduced motion.
- Dialogs enter and exit as one coordinated surface. Interrupted exit/reopening uses the current visual pose. Closing content is immediately inert; focus moves to the actual usable opener or selected-navigation fallback.
- Actual state changes receive restrained icon/copy feedback. New recorded receipts, candidate/actor inspection and 2D/3D changes receive short arrival motion; frame-by-frame playback does not replay workspace entrances.
- Explicit camera preset/reset moves use a 620ms eased spherical orbit; zoom uses 320ms. A single owner handles camera transitions, manual orbit and follow. Repeated zooms accumulate toward their intended destination.
- Seeking cancels presentation interpolation. Manual framing is retained when follow is off. Playback can translate a transition with the recorded ego pose without restarting progress. Damping and animation stop under reduction; paused demand rendering settles.
- Help → Interface motion offers Follow system (default), Full motion (session-only preview) and Reduce motion (remembered). An explicit Full preview never changes OS settings and does not restore after reload. Sound remains opt-in and was left off.

Numbers do not animate through invented values. Completing a simulation is not safe driving. Pause affects recorded playback, not backend computation; no backend cancellation was added.

## Independent feedback loops

### Loop one: plan risks → implementation → verification

The correctness reviewer identified retained-dialog focus ownership, competing camera/follow writers and incomplete reduction coverage as the largest risks. Main implementation added active-layer/generation focus handling, inert closing/background content and guarded shortcuts. The disjoint camera worker received explicit playback/seek and ownership constraints. Main reviewed integration before browser checks.

### Loop two: source findings → corrections → independent recheck

Reviewer findings led to resolved-preference CSS, session-only Full behavior, nullable cancellation diagnostics, reduced-mode dialog endpoint reset, held exit fill and actual-trigger focus restoration. Main review also caught manual-view reset on seek/follow-off; the camera worker fixed it and added tests. Independent source recheck cleared the reviewed focus/presence/preference paths. Browser checks then verified actual motion and interruption instead of relying on source alone.

Final runtime checks found narrow navigation overflow and a first-load navigation-ref initialization problem. Grid sizing at narrow widths and post-commit measurement with a static selection fallback correct these. Initial library loading now says Loading scenarios rather than falsely reporting an empty search.

A separate final screenshot-only follow-up found mobile setup dominance, buried motion preferences and an overlong inspector delaying outcomes. The implementation now puts compact run/export actions beside the mobile title, motion preferences first with tutorial disclosure, three initial candidates with actual-count expansion, and whole-run results directly beneath the replay column. The reviewer rechecked fresh captures and found all three materially improved, with no blocking visual issue. Minor tradeoffs remain: icon-only mobile export discoverability and small secondary scene metadata.

Source review caught that the new disclosure summary was omitted from the dialog focus trap. It now participates in traversal, and the browser verified forward/reverse wrapping, Enter expansion, Space collapse and Escape restoration. Independent source recheck cleared this correction. Still images cannot establish temporal fluidity; actual sampled transforms and camera poses supply the motion evidence below.

## Current verification evidence

| Requirement | Actual observation |
| --- | --- |
| Fluid tab/workspace motion | Full preview: nav x131.27 → x251.41 → x363.84 → x348.62 over420ms; workspace x12 → x3.56 → x0 over280ms. Samples are computed rendered styles, not expected keyframes. |
| Meaningful result feedback | Returned run a58e2f16 shows101 frames,30.6km/h requested speed,0.49s compute and its own measured results. Receipt arrival sampled y5/opacity.55 → y0/opacity1 over240ms. |
| Honest planned/running/completed | Staged speed change left the old28.8km/h recording intact; Running showed Previous completed run; the returned new receipt showed30.6km/h. |
| Waiting/failed | Dataset reports0 imported scenes and local-shard prerequisite. A missing-file request returned Failed with No new result was verified; dismissal restored Waiting. No dataset was imported. |
| Reversible dialog/focus | Shift+Tab wraps settings controls; Escape restores the opener. Rapid Help close/reopen left exactly one present, interactive layer, with focus on Close help. Closing layers were inert. |
| Mid-entry reduction | Reduced chosen14ms into dialog entry recorded cancelled/currentTime null, then visible transform none and opacity1. Close left zero layers and focus on Help. |
| Camera continuity | Top-down at replay0.0: progress0 position[-8.24,34.96,28.50] → .460[3.39,43.54,19.49] → .783[9.89,47.51,2.63] →1[10,47.5,.01], finished/idle. |
| Playback/follow ownership | Chase transition during playback progressed0→1 while target x10.80→16.58, finished/idle. Finite poses remained valid. |
| Real interruption | Next frame cancelled a preset at.438 with reason seek and exact recorded0.1s. Native pointer drag cancelled another at.586 with reason orbit and follow off. Manual seek retained framing rather than resetting it. |
| Mid-camera reduction | Angled transition cancelled at.598 with reason reduced-motion; displayed camera snapped to its intended endpoint, progress1/idle, finite=true and damping=false. |
| Paused rendering | With no UI actions between reads, idle render-frame counter stayed970 over roughly20s. No continuing presentation invalidation observed. |
| Meaningful inspection | Selecting actual Path39 changed its measured cost to-49.64 and played a short arrival while timeline remained0.0. 2D/3D switching preserved the recording/frame. |
| Responsive | Requested390px override produced300 CSS px at the browser's existing zoom. Initial nav overflow corrected; final clientWidth/scrollWidth both288 (scrollbar excluded). Compact layout moved scene top728→634. Motion control fits inside the dialog without scrolling. Wide check at actual1280CSS: client/scroll1268, correcttwo-column grid. Inspect decision expands/focuses details. |
| Complete evidence access | Three candidates initially; Show all35 paths expands all actual options and Show fewer returns3. Earlier8.5m/s run had42 options; counts derive from the recorded frame. Exactly one whole-run results group remains, independent of inspector height. |
| Loading/empty | Engine and saved-run loading were observed; absent results use dashes/disabled controls. Library loading is distinct from no search matches. Original refresh verified search-empty/clear and untrained/unavailable UI paths. |

Diagnostics are bounded actual samples: DOM animations retain at most10 samples; camera traces retain12, preserve the start and record distinct terminal finished/cancelled outcomes. Camera diagnostics describe presentation only, never simulation progress.

## Checks and limits

- `npm run test:motion --prefix web`:23 tests passed, none skipped. These include actual OrbitControls settling/momentum clearing, finite endpoints, short arcs, retargeting, repeated zoom accumulation, manual seek/follow-off, preferences and bounded diagnostic evidence.
- `npm run build --prefix web`: TypeScript and production Vite build pass. Main UI approximately297.3kB minified/91.6kB gzip; lazy3D chunk1.056MB/287kB gzip still triggers Vite's warning.
- Maintained browser integration tests include preference/reload/focus cases, but the CLI browser suite was not run this turn. Browser verification used the running in-app browser instead. Backend/ML/native suites were not rerun.
- Existing Three.Clock deprecation warnings remain. No new error-level console messages were observed in the final check.
- This is not an exhaustive assistive-technology, cross-browser or GPU performance audit. Reduced mode was verified against the actual system preference and app setting, not OS manipulation. A disappearing/disabled opener fallback was source-reviewed, not manufactured through DOM mutation in the browser.
- Dataset remains0; no downloaded Waymo validation or retraining is claimed. Verification created additional saved synthetic runs, including automatic startup runs; none were deleted. Original full-export download/clipboard round-trip and human-audible sound quality gaps remain.
- Capture density varies with existing browser zoom. New captures are not pixel-exact viewport comparisons. Static screenshots show composition, not proof of transitions.

## Screenshot evidence

[Final wide replay](after-wide.jpg), [earlier narrow composition](desktop.jpg), [motion preferences](preferences.jpg), [final narrow replay](mobile.jpg), [final narrow help](mobile-preferences.jpg), [real failed import](failed-import.jpg), [camera composition](camera-transition.jpg).

Final preview is completed run6aed4321 at0.0s, paused, sound off, no open dialog, Follow system/Reduced matching actualOS. Browser viewport override was reset. Capture sizes/scenarios differ from original before images; comparison is about hierarchy, not pixel-exact performance.

Original before/after and wide-screen evidence: [before](../ui-refresh/before-replay.jpg), [after](../ui-refresh/after-replay.jpg), [wide Field Lab](../ui-refresh/after-desktop.jpg). Original screenshots remain unchanged.

## Skill influence and references

[Frontend Design](/Users/dricmoybhattacharjee/.codex/skills/frontend-design/SKILL.md) concentrated expression in meaningful task transitions rather than ambient effects. [Structured Dev](/Users/dricmoybhattacharjee/.codex/skills/structured-dev/SKILL.md) enforced research→plan→implementation and explicit test gates; the user's autonomous instruction overrode its usual approval pause. [Execution Plan](/Users/dricmoybhattacharjee/.codex/skills/execution-plan/SKILL.md) maintained the living plan and requirement-by-requirement audit.

Primary API references: [Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate), [Animation.finished](https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished), [interpolate-size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size). Native cancellation and completion semantics inform presentation lifetimes; unsupported disclosure interpolation falls back to normal expansion.
