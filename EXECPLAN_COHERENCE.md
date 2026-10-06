# DriveLab visual coherence

## Purpose / Big Picture

Make Replay, Evaluation, Dataset, Model and every dialog feel like one Technical
Noir instrument. Preserve measured results, provenance, keyboard controls and
honest operation states. Published main is unchanged by this local redesign.

## Progress

- [x] Inspect current app and stylesheet cascade; verify public GitHub repository.
- [x] Research primary Apple and Waymo design guidance, Tesla presentation and an
  officially awarded reference: Terminal Industries (Awwwards SOTD 2025-09-03).
- [x] Save baseline screenshots of all modes and responsive layouts.
- [x] Implement warm semantic tokens across UI and rendered scene, with licensed
  editorial road photography clearly separate from simulation evidence.
- [x] Build and test; verify main interactions and widths in the actual browser.
- [x] Run two screenshot critique rounds, fix findings, record bounded evidence.

## Surprises & Discoveries

Three legacy style layers precede Technical Noir. The override does not cover
every hover, sticky heading or cool accent. Scene colors are maintained separately
from CSS. These sources must be reconciled; a single screenshot is not sufficient.

## Decision Log

Keep the existing Workbench layout, Instrument Serif/Plex pairing, and warm ink.
Use coral for actions and selected paths, ivory for keyboard focus and amber for
inspected alternatives. Preserve sage success and red failure meanings with text.
Terminal Industries informs restrained industrial photography and warm materials,
not its assets, navigation or marketing copy. Photo candidates must be verified
against their primary source and license before downloading.

## Context and Orientation

React/TypeScript/Vite frontend is web/src; backend serves web/dist at port 8765.
main.tsx loads styles.css, field-lab.css, motion.css and technical-noir.css in that
order. tokens.css controls semantic roles; scenePalette.ts supplies sRGB render
colors. Existing motion/model tests live under web/tests. Existing data and
checkpoint must not be replaced or retrained for this visual task.

## Plan of Work

Capture baseline modes. Append scoped coherence overrides, update shared tokens
and scene palette, introduce a reusable editorial figure and two licensed photos.
Keep photos in secondary Dataset/Model content, never as fabricated driving
output. Inspect normal, hover, selected, error, empty and dialog surfaces. Then
build, run existing tests, and test responsive main flows in the in-app browser.
Send only screenshots and the brief to an independent critic for two rounds.

## Concrete Steps

From /Users/dricmoybhattacharjee/Desktop/drivelab/web run npm run build,
npm run test:motion and npm run test:models. Reload http://127.0.0.1:8765/.
Browser captures and the final bounded report belong in design/coherence/.
Use source credits in web/public/photography/ATTRIBUTION.md.

## Validation and Acceptance

All four modes and settings/help/history/export dialogs share warm surfaces,
typography and status roles. No visibly cool blue selection, track, hover or
scene material remains. No horizontal page overflow at 320, 375, 768, 1024 and
1440px. Photo images load with intrinsic dimensions, useful alt text and source
credits. Keyboard focus and transport work; important labels remain reachable.
Claims about loading/error states and mobile interaction must identify actual
checks, not imply an unrun full integration or cross-browser suite.

## Idempotence and Recovery

Changes are additive/scoped where possible. Preserve legacy layout rules and
existing data. Do not reset local work or publish this redesign without renewed
authorization. Rebuild and reload after adjustments; remove no user files.

## Artifacts and Notes

Reference: https://www.awwwards.com/sites/terminal-industries
Guidance: https://developer.apple.com/design/human-interface-guidelines/color
and https://waymo.com/blog/2019/08/driven-by-waymo-designed-with-trust/.
Tesla visual restraint is an inference from https://www.tesla.com/model3,
not a claimed official Tesla design framework.

## Interfaces and Dependencies

Keep React, Three.js, Lucide and existing motion components. No runtime dependency
or external asset request is needed for locally bundled photos.

## Outcomes & Retrospective

Completed locally. Four modes and dialogs use warm semantic roles; scene colors
are tested against UI values. Two licensed editorial photographs have source
credits and explicit provenance. Independent screenshot round 1 improved evidence
proximity, path distinction and import guidance; round 2 improved phone scene
priority, sample scope, engine-path explanation and direct training access.
Build and 34 unit tests pass. Actual browser matrix covers four modes at eight
widths; important request, keyboard, replay and dialog interactions verified.
Evidence and explicit unverified limits: design/coherence/REPORT.md. Existing
checkpoint/data preserved, original run restored, no redesign publication.
