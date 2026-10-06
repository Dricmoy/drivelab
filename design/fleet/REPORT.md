# DriveLab — typography and urban fleet

## Implemented

The old default was the deliberately small Parked car fixture. The new first
fixture is Busy boulevard: 36 surrounding actors plus ego, 28 moving and eight
parked. Four lanes include opposing traffic; headways, speeds, dimensions and
paint vary deterministically. Actors are real planner/forecast/metric inputs,
not duplicates inserted only into the renderer. Existing nine fixtures remain.

Functional headings, decisions, controls and evidence use IBM Plex Sans; the
Instrument Serif wordmark is the only serif role. Shared heading sizes and tabular
figures replace per-page display-font choices. Noir colors/motion are preserved.

Original vehicle models distinguish hatchback, sedan, SUV, van and ego touring
silhouettes. Footprints and poses stay authoritative. Stable paint, wheel motion,
lamps, mirrors and plates improve presentation. Illustrative buildings, curbs,
sidewalks and street lamps provide scale; they are not scored obstacles.

## Screenshot review

Two separate self-review passes; no independent design critic was used this turn.
This is not an independent usability study or exhaustive design certification.

Round 1 (`round-1.jpg`): camera too distant; all-actor forecasts compete with car
silhouettes; plain building fronts weaken street context. Fixes: closer, flatter
urban framing; faint unselected forecasts with emphasis on inspected actors;
floor-by-floor windows and street lamps.

Round 2 (`round-2.jpg` plus phone captures): even spacing looks staged; inherited
650-weight labels differ from loaded font weights; terminal-frame copy incorrectly
calls the trajectory planner a baseline. Fixes: varied but non-overlapping headways
and speeds; consistent 500/600 control/title weights; explicit final-frame copy,
tested separately from baseline and awaiting states.

## Verification

- Production TypeScript/Vite build passed. Lazy 3D bundle warning remains
  (~981 KB raw, ~264 KB gzip); no performance/FPS guarantee is made.
- 39 frontend unit tests passed: 23 motion, eight vehicle geometry/paint,
  eight design/token/replay-copy tests.
- 105 backend checks passed across fleet, simulation, API, native scoring and
  Waymax modules before the final speed/headway adjustment. The final fleet tests
  were rerun after that adjustment and passed (two tests), as did four final
  native parity checks. No claim that the entire backend suite was run.
- All four work modes inspected at actual 320/375/414/768/1280/1440 CSS px:
  no document horizontal overflow or offscreen headings/controls in the DOM sweep.
  Phone/tablet screenshots visually reviewed at the four required small widths.
- Browser observed completed synthetic Waymax/native run with 101 frames and
  36 traffic options; 2D has 37 keyboard-selectable vehicle elements and 36
  forecast elements before the terminal frame. At the terminal frame all 37
  vehicles remain and forecasts correctly cease.
- Recorded actor selection and Home/End/arrow timeline seeking inspected. Final
  frame now visibly says Replay complete with no new candidate search. Top/chase
  camera selection and play/pause verified; playback advanced the timeline. Final
  handoff is angled, paused at 3.0 s, 36 surrounding actors, sound off and system
  reduced motion. No error-level console messages were returned. Viewport reset.

Before: `before.jpg`. Final overview: `after.jpg`. Vehicle detail: `chase-detail.jpg`.
Phone/tablet captures: `mobile-320.jpg`, `mobile-375.jpg`, `mobile-414.jpg`, `mobile-768.jpg`.

## Limits

Prescribed synthetic motion is not reactive driver behavior. No lane-direction
rule or traffic-signal compliance model was added. Real Waymo data, learned-model
retraining, photorealistic licensed vehicle assets, mobile-device GPU performance,
full end-to-end automation and exhaustive cross-browser/a11y checks are unverified.
The dataset and model checkpoint are unchanged and excluded from publication.
