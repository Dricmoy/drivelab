# Coordinate DriveLab motion and independent feedback loops

This living execution plan follows the execution-plan and structured-dev skills. Keep Progress, Decisions, Discoveries and Outcomes current. The user requested autonomous implementation and continuation; that explicit instruction overrides the structured-dev skill's usual user approval pause. Research and plan are still reviewed before implementation; independent reviewers annotate risks without receiving authority to change scope.

## Purpose

The user should feel a continuous relationship between choosing a view, opening a control, inspecting a decision, and receiving a verified result. Motion should connect cause and effect, not decorate every card. Preserve Field Lab's porcelain/ink/cobalt/amber palette and DM Sans. Spend the expressive motion on navigation, the active workspace, dialogs, result feedback and explicit 3D camera moves. Keep precise recorded results visible and support reduced motion.

## Progress

- [x] (2026-10-03) Inspect actual app/source, read applicable skills and write/review research.md.
- [x] Write motion architecture, constraints and test strategy; review against actual capabilities and the user's autonomous instruction.
- [x] Implement shared preference, interruptible animations and deterministic tested motion math (combined motion/camera tests now23 pass).
- [x] Integrate traveling nav, direction-aware page transitions, reversible dialogs, status/result/inspection feedback and disclosures; TypeScript/build pass.
- [x] Delegate and integrate camera motion; independent/main review fixes manual view preservation, follow ownership and bounded sample outcomes.
- [x] Run unit/type/build checks and browser motion/state/focus/reduced/mobile tests;23 Node tests and final production build pass, live keyboard traversal/Enter/Space/restore and actual1280CSS/300CSS layouts verified.
- [x] Independent reviewer loop one: concrete plan risks → ownership/reduction corrections → first build/unit/browser verification.
- [x] Independent reviewer loop two: implementation findings → preference/presence/focus corrections → final independent source recheck clear and real interruption traces verified.
- [x] Requirement-by-requirement completion audit, evidence/report, final paused preview; System motion, sound off, no dialogs, saved capture evidence and deliverable browser preserved.

## Context

Project root is `/Users/dricmoybhattacharjee/Desktop/drivelab`. `research.md` explains current source/data flows. `web/src/App.tsx` owns pages, status and dialogs. `Scene3D.tsx` owns CameraRig. `main.tsx` imports CSS and renders App. `OperationStatus.tsx` derives only icon presentation from actual state. Server serves `web/dist` at `http://127.0.0.1:8765/`; build with `npm run build --prefix web`, then reload the browser. No backend restart or data reset is needed.

## Implementation milestones

First add `web/src/motion.tsx`, `web/src/motion.css`, and `web/src/motionMath.ts`. A MotionProvider resolves OS preference plus explicit reduction and exposes `useReducedMotion(): boolean`. A measured shared highlight retargets from its current position; entrance effects depend on a semantic key, not frames. A MotionPresence wrapper mounts while open, keeps a closing dialog for a short exit, makes it inert/aria-hidden immediately on close, cancels/reverses effects on rapid reopening, and then unmounts. Cleanup handles rejected finished promises. Use <=420ms spring-like navigation, <=280ms workspace entry and <=220ms modal exit; no timed backend-success choreography.

    <MotionProvider><App /></MotionProvider>
    <MotionPresence show={configOpen}>…existing dialog…</MotionPresence>
    useReducedMotion() // shared by camera and DOM motion

Second wire these into App without replacing its data/request logic. Mark selected nav with aria-current, introduce one traveling background, animate the newly mounted page in the direction of navigation and receipt arrival on a new report ID, and animate inspector only for deliberate candidate/actor changes. OperationStatus changes immediately; only its arrival/icon feedback animates. Keep all numerical labels exact. Add a Reduce motion toggle in Help, explaining that OS preference is also respected. Restore focus on closing modal and ensure its exit is inert; make the background inert only while a dialog is actually open. Guard keyboard shortcuts while a dialog is open. Keep stable headings/controls accessible throughout.

Third a disjoint worker edits only `Scene3D.tsx` and new camera math/test files if necessary. Animate explicit preset/zoom/reset from the current camera/target with a finite smooth curve. Initial mount, reduced motion and recorded ego/failure seek remain exact. Orbit input cancels tween; resize can reset framing; follow updates must not fight a preset. Expose presentation diagnostics on the scene (transition phase/progress/camera pose) for read-only browser evidence, not invented simulation data. Maintain demand-rendering and stop invalidation when settled.

Fourth use actual browser interactions and read-only DOM/animation observations to verify motions occur and settle, repeated interruptions don't leave duplicate dialogs/stale state, paused scenes become idle, keyboard focus remains correct, and Reduce motion immediately disables JavaScript/CSS/camera interpolation. The in-app DOM inspection proxy does not expose getAnimations; bounded actual computed transform/currentTime samples on animated DOM elements supply readable evidence instead. These are real observations while animations run, not synthetic expected keyframes. Check real planned → running → completed/error behavior. Capture desktop/mobile/dialog/reduced evidence. Two feedback cycles must have independent concrete findings, implemented corrections and retest evidence. No web download/copy payload or real Waymo validation is implied by this motion goal.

## Decision log

Native animation primitives preserve the installed stack and avoid a large new motion dependency. Do not interpolate metrics or vehicles: hypothetical intermediate positions could contradict failure/actor overlays. Explicit camera interpolation supplies spatial continuity without changing scientific data. Keep reduced motion a real end-user setting so browser verification does not need OS manipulation. Actual browser reports OS reduction: Follow system remains default, explicit Full motion is a session-only preview and Reduce motion is remembered. Never change OS settings or restore a full override on reload. This replaces the initially proposed OS-or-user-only checkbox after browser evidence showed full motion could not be tested or deliberately selected. Use a bounded correctness reviewer and disjoint camera worker, then an isolated screenshot/trace critic; reuse reviewers for retests.

## Validation and acceptance

From root, `npm run build --prefix web` must pass TypeScript and Vite. Motion math gets deterministic tests via Node; unit tests cover finite endpoints, clamped progress and interruption-safe planning values. The maintained browser integration suite receives tests for reduced preference and dialog focus but is not run as a CLI browser without user authorization. Current browser checks must observe an active animation after action and the settled authoritative state afterward, not infer motion from source. Camera evidence must show changing finite camera pose during a preset and an idle final pose with controls still usable. Reduced mode must show zero nonessential animation and immediate camera state. Each critic response goes into `implementation-log.md` with actual fixes/results.

## Idempotence and recovery

Local source/doc edits only; no new threads, publishing, commits, destructive Git operations, dataset/checkpoint changes or backend job cancellation. Cancel presentation animation rather than data requests when motion is interrupted. If motion support is absent, rendering stays usable and state changes immediately. Existing data remain unchanged except new synthetic runs/comparison records created by verification. Do not retrain the user's checkpoint. Recover broken presentation by removing only the new wrappers/imports, not resetting user files.

## Surprises and discoveries

The browser exposes exact paused frame and scene, but screenshot dimensions depend on viewport overrides. Preserve existing before images and capture new motion evidence separately. Original focus trap assumes one immediately mounted dialog; exit presence needs explicit closing/inert handling and a query excluding closing layers. Independent plan review identified competing camera writers and incomplete reduction: camera worker now receives playbackActive to distinguish exact seeking and must disable damping under reduction. Shared nav must measure current visual position before canceling a running animation; the initial ResizeObserver callback must not cancel an otherwise valid transition.

## Outcomes and retrospective

The motion objective is achieved: coordinated DOM/state/dialog/camera transitions are implemented and actually observed; reduced motion, cancellation, exact data, keyboard behavior and responsive layouts were checked; independent findings produced corrections and retests. Final screenshot-only follow-up judged all three issues materially improved with no blocking visual issue. The source reviewer also cleared the final disclosure focus correction.

Completion audit:

| Goal requirement | Evidence |
| --- | --- |
| Fluid transitions between states | Real navigation/workspace/dialog/receipt/inspector samples; verified planned/running/returned completion and real import failure/waiting. |
| Advanced motion | Interrupted/reversible presence, measured spring-like nav, single-owner eased spherical camera, playback retargeting, live reduction, finite idle settling. |
| Positive feedback loops with subagents | Two independent source loops plus camera worker/main corrections; original two screenshot-only UI rounds and final isolated screenshot follow-up→implemented fixes→clear recheck. |
| Browser implementation verification |23 unit checks, TypeScript/build, actual keyboard/timeline/candidate/view/preset/interruption/reduction checks, narrow/wide readbacks, no error-level console messages. |
| Evidence/handoff |design/motion/REPORT.md, screenshots, implementation-log.md, original before/after preserved, current app paused with System/default and sound off. |

Unresolved items are explicitly outside the motion goal or bounded verification: full CLI E2E/backend/ML/native suites, downloaded Waymo data, exhaustive accessibility/cross-browser/audibility/export confirmation and dependency bundle/clock cleanup. No success is inferred for those. Their existence does not turn a verified presentation extension into a real-driving validation claim.

Change note (2026-10-03): Added a self-contained motion plan grounded in current source and user-authorized autonomous continuation, preserving evidence and scientific accuracy.

Final change note: Completed motion implementation, two feedback loops, isolated screenshot follow-up, corrective keyboard/mobile/initialization fixes, real runtime checks and final handoff audit.
