# Motion implementation and reviewer loop

## 3 October 2026 — research and plan

Current app inspected; research.md and plan.md reviewed before implementation. Prior goal turn classified as progress (implemented redesign, build and browser evidence). New goal requirements: fluid transitions between meaningful states; advanced, coordinated motion; independent subagent feedback yielding fixes and retests. No relevant memory entry used.

Reviewer findings, changed files, exact current tests and browser evidence will be added as implementation proceeds. This is not a completion claim.

## Independent loop one — plan risks and corrections

Archimedes identified three P1 risks: retained dialog focus ownership, competing camera/follow writers, and incomplete reduced-motion coverage/proof. Main implemented current-layer querying, a focus generation guard and usable-opener fallback, inert exit/background handling, dialog shortcut guard, OS-or-user reduction shared by CSS/JS, and interruption-safe measured navigation. Camera worker Ptolemy received the reviewer constraints and an optional playbackActive prop to distinguish playback from manual seeking. Reviewer is rechecking source independently while browser verification proceeds.

First implementation checkpoint: TypeScript/Vite build passed; three Node motion-math tests passed. MotionMath/Provider/navigation/presence/page/receipt/status integration added without new dependencies. Browser evidence still pending; camera slice is not yet integrated.

## Independent loop two — implementation review and corrections

Archimedes rechecked implementation, identifying: explicit Full conflicting with OS CSS; session-only reload policy; nullable/cancelled trace accuracy; reduction freezing a partially entered dialog; exit endpoint fill; and unusable opener fallback. These were fixed with resolved-attribute CSS, System/Full-session/Reduced-persisted preferences, distinct real animation outcomes, immediate reduced endpoint reset, held exit fill and actual-trigger capture plus verified focus restoration. Final independent source recheck reports no critical issue in reviewed focus/presence/preference paths. Its TypeScript observation was against an earlier snapshot; current build passes.

Ptolemy implemented the disjoint camera slice and self-reviewed zoom accumulation/seek classification. Main review caught manual-view reset on seek/follow-off; worker corrected ownership and added three tests. Bounded actual camera-pose sampling adds distinct finished/cancelled evidence. Combined Node checks currently pass 23 tests, including real OrbitControls behavior, and production TypeScript/Vite build passes.

## Browser evidence gathered so far

Actual OS preference is reduced. Follow system resolved to reduced. Explicit Full produced navigation x131.27 → x251.41 → x363.84 → x348.62 over 420ms; directional workspace x12 → x3.56 → x0 over 280ms; dialog scale .97/y18 → identity over 340ms. Samples use real computed transforms and animation currentTime, not expected keyframes.

Switching to Reduced 14ms into a dialog entry recorded cancellation with elapsed null/playState idle, visible transform none/opacity1; closing left zero layers and returned focus to Help. Shift+Tab wraps Close settings to Apply settings; Escape then Help moves focus into the active new dialog. New reduced Dataset page had no animation effect. Full reload returned to System; reduced preference was independently shown persistent.

Camera top-down actual samples: progress0 position[-8.24,34.96,28.50], progress.460 position[3.39,43.54,19.49], progress.783 position[9.89,47.51,2.63], progress1 position[10,47.5,.01], outcome finished/idle. Recorded time stayed0.0s. Paused Next frame during a new camera move cancelled with reason seek, progress.438 and exact replay0.1s. Direct native browser orbit interrupted another preset at progress.586, reason orbit, follow false; final phase idle. Manual seek preserved its framing (only small residual damping delta before the action), not a map reset.

Planned settings visibly retained the original28.8km/h receipt, while running read Previous completed run and actual running status. Further final/mobile/reduced-camera/idle and reviewer evidence remains pending.

## Final runtime pass

New run a58e2f16 verified completed,101 frames,30.6km/h requested speed,0.49s compute. Actual receipt arrival y5/opacity.55 → y0/opacity1 over240ms. Chase during playback showed target x10.80→16.58 with continuous0→1 camera progress and finished/idle. Reduced mid-Angled cancelled at.598 with reason reduced-motion and immediate intended endpoint/progress1/idle/dampingfalse. No UI actions between two paused reads: render counter970 unchanged over roughly20s.

Rapid Help close/reopen left one present layer focused Close help. Switching2D/3D retained frame0; inspecting actual Path39 changed cost-49.64 and played arrival motion without changing the frame. Actual missing-file import returned Failed/no new verified result, then dismissal restored waiting with0 imports.

At requested390px browser override, existing zoom yielded300 CSS px. Navigation overflow at this width was corrected with four equal grid columns and44px controls; final client/scroll widths both288 (scrollbar excluded). Mobile Inspect decision expands/focuses details. Full reload returns to System. First-load selected-nav highlight initially had no style because child layout effect preceded parent ref attachment; measurement moved after commit with a static selected fallback. Latest reload verified nonzero highlight dimensions,opacity1 anddata-highlight-ready=true under System/Reduced. Loading library copy now distinguishes initial connection from empty searches.

Two independent source feedback loops are clear; final screenshot-only follow-up and final handoff audit remain to record. Browser capture density varies with existing zoom; screenshots are composition evidence, while bounded actual transform/camera samples establish motion. Full E2E/backend/ML/native suites remain unrun this UI-motion turn.

## Final isolated screenshot critique → proportional correction → recheck

Heisenberg received only brief/goals and screenshot paths, not code or implementation rationale. Three findings: mobile setup occupied the first screen; motion controls were buried in long help; desktop inspector height delayed outcomes. Main shortened narrow spacing, put compact run/export actions beside the title, moved motion first with tutorial disclosure, initially shows the chosen path plus two alternatives with actual-count expansion, and places outcomes directly under the replay column. Mobile scene top improved from728 to634 CSS pixels at300CSS-wide zoomed browser; controls retain their targets. Native export name remains accessible, but the narrow icon-only presentation has lower discoverability.

Main verified actual35-path expansion/collapse, exactly one authoritative metrics group underreplay-column, tutorial disclosure, real nav samples after the initialization fix, and nooverflow at actual1280CSS/client1268 and300CSS/client288. The maintained E2E assertion now derives expansion count from actual UI, not hard-coded42 (the earlier8.5m/s run had42; default8m/s has35).

Source review caught summary missing from the dialog trap. Corrected selector includes visible native summaries; actual browser verified Close→motion selector→summary, Enter expansion, Tab wrap, reverse wrap, Space collapse and Escape→Help restoration. Final source recheck cleared this change. Final screenshot recheck reports all three findings materially improved, no blocking visual issue; remaining icon-export discoverability/smallmetadata are secondary tradeoffs. Stills cannot judge temporal fluidity.

Final production build and23 motion tests pass. No error-level messages in final browser check; existing Three.Clock warnings and1.056MB lazy3D chunk remain. Final preview: completed run6aed4321, replay paused, no dialog, System/Reduced per actualOS, sound off, temporary viewport override reset and tab marked deliverable. Final report/plan audit complete. No dataset import, retraining or destructive cleanup occurred.
