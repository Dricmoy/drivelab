# DriveLab — Technical Noir handoff

Implemented 2026-10-05. The user selected Technical Noir after the initial audit's three visual directions. The prior five-problem audit and direction comparison remain in `../hallmark-audit-2026-10-05/REPORT.md`.

## Design and primary tasks

Inspect a recorded driving decision, run or compare planners, change next-run settings, connect a local dataset and inspect measured model validation. Warm ink, ivory upright Instrument Serif, IBM Plex Sans controls, vermilion actions and cyan selected paths replace the generic pale dashboard. Santioni-inspired editorial hierarchy and material contrast support a genuine interactive Three.js scene; no copied branding, custom cursor, intro gate or scroll hijacking.

Hallmark informed restrained surfaces, typography and state hierarchy; frontend-design informed the distinctive visual system. Existing motion, reduced-motion preferences and opt-in synthesized sounds were preserved. The sound was not acoustically auditioned. Native controls have physical press feedback and visible focus. Existing global CSS is preserved, with `technical-noir.css` imported last. No new dependencies or API contracts.

## Independent review round 1

The critic received desktop/mobile replay, Evaluation, Dataset, Model and settings screenshots, user tasks and the visual brief only.

1. Active navigation had poor contrast. Corrected the actual highlight selector and its ink/ivory colors.
2. Mobile framing cropped the right edge, buried playback and squeezed controls. Reserved scrollbar space, corrected inherited heading styles, moved transport above the viewport and adjusted narrow camera framing without moving recorded vehicles.
3. Setup and evidence screens had empty expanses and weak scope/provenance. Named both planners and the available scene count, shortened the import form's container, and placed recorded checkpoint settings before validation scores. Kept the existing local-path importer instead of inventing a file-picker capability.

## Independent review round 2

A different critic received new screenshots and the same goals/brief, without the implementation rationale or source.

1. Timeline and displayed time looked inconsistent; traffic and controls crowded the phone scene. Investigation found the browser tool's range `fill()` did not update React state. Natural Home/ArrowRight input verified time, frame and inspector synchronization. Final captures use actual keyboard scrubbing. Mobile zoom tools moved into a horizontal row; floating path labels are hidden on phones while the selected decision retains its path ID.
2. Instant decision data looked like whole-run results. Added explicit selected-decision time, nearest actor and ego speed to the mobile summary; labelled outcomes as the entire recorded synthetic run. Near-equal candidate costs now say “Within 0.01” rather than claiming a 0.00 advantage.
3. Settings lacked range/step context and reachable actions. Added correct units, endpoints and increments, widened the dialog, compacted labels, and kept header/footer outside its scrollable body. At 720px desktop height, the Apply button's bottom is 679.5px and body client/scroll heights both 521px. Phone settings were also verified.

Static reviewers could not assess motion, network transitions or interactions from images. Those were checked separately in the running app. Suggestions requiring new backend capabilities were not implemented.

## Verified

- Production build passes. All 23 motion tests pass; zero failures/skips. Full Playwright end-to-end suite was not run.
- Genuine synthetic run: 101 frames; pause/play and previous/next work. Keyboard seeking to 3.6s produces Frame 37/101 and inspector t=3.6s.
- 2D debug, 3D, top-down, angled view, ego/traffic and candidate inspection; candidate visibility and expansion.
- Target-speed changes show Planned while recorded configuration stays unchanged; applying defaults restores the unchanged comparison. Pending settings do not certify a new run.
- Paired selected-scene comparison yields two inspectable records, including a baseline collision and no recorded collision for the trajectory planner. This is synthetic evidence, not real-world safety.
- Saved-run dialog lists actual records and restores the original before-redesign report.
- Export summary parses correctly. Copy full JSON was read back and confirmed to contain the matching ID and 101 frames. Download completion timed out in the in-app browser; UI now reports “Download requested,” not success.
- Dataset missing-path import produces a useful error and Failed state without inventing imported data. Dismiss works. Empty search gives “No matching scenarios” and Clear search restores the library. Initial connection/loading is Waiting with disabled result controls.
- Dialog keyboard focus wrapping, Escape and trigger focus return; native disclosure focus and reduced-motion selection. Visible focus and key semantic color pairs checked, not exhaustive accessibility certification.
- No horizontal document overflow at widths 320, 375, 414, 768 and normal desktop. Final mobile hides scene labels that covered vehicles.

Contrast samples: ivory/ink 16.05:1; muted text 7.24:1; action text 7.14:1; selected cyan 10.84:1; green/amber/red status text 9.40/8.83/7.62:1; control boundary 3.97:1. These are token-pair calculations, not an exhaustive rendered-page WCAG audit.

## Images and generation

Original asset: `../../web/public/art/noir-road-concept.png`. Generated with the image generation tool in new-image mode; no reference image or brand assets supplied. Opaque background. Prompt summary: original editorial copperplate/etched illustration, ivory fine lines on charcoal paper, a research car and winding road with traffic and a restrained cyan trajectory; cinematic composition, no words, logos, neon glow or fake UI. The Dataset screen explicitly labels it AI-generated concept art, not dataset output. Real replay visuals continue to render actual recorded geometry and vehicle poses.

## Screenshots

- Before: [desktop replay](before-desktop.jpg).
- After: [desktop replay](after-desktop.jpg), [mobile replay](after-mobile.jpg), [settings](after-settings.jpg), [mobile settings](after-mobile-settings.jpg).
- Main work modes: [Dataset](after-dataset.jpg), [Model](after-model.jpg), [paired Evaluation](after-evaluation.jpg).
- State evidence: [Planned](state-planned.jpg), [Failed](state-failed.jpg), [export](after-export.jpg).
- Both rounds retained as `round1-*.jpg` and `round2-*.jpg`. Round-two replay captures are critique evidence, not final product screenshots; the range-adapter mismatch described above appears there.

## Remaining limits

The existing lazy Three.js chunk is approximately 1.06MB minified / 287KB gzip and still triggers Vite's >500KB warning. No GPU performance benchmark or other-browser regression test. No successful real Waymo import, new model training or safety validation performed during this UI change. File-download completion remains unconfirmed in the in-app browser; verified full-JSON copy is available. Sounds remain off by default and were preserved, not acoustically verified. External fonts use swap and local fallback faces, but offline font rendering was not separately tested.
