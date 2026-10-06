# DriveLab motion research — 3 October 2026

## Scope and current architecture

The application is a local driving-planner laboratory, not an autonomous task agent. React 19.2 / TypeScript / Vite own the interface; Three / React Three Fiber / Drei own the optional 3D view. No motion package is installed. Keep real API results and recorded-frame seeking exact. Existing Field Lab palette and components should remain rather than starting another visual redesign.

`web/src/App.tsx:28` owns tab selection. `App.tsx:98` scenario selection begins a versioned API request, clears the old report, and only accepts the current response. `App.tsx:116` reruns the planner while retaining explicitly previous evidence. `App.tsx:147` controls seeking and playback; metrics derive from the recorded frame rather than renderer position. `App.tsx:167` traps/restores dialog focus. `App.tsx:243` derives planned/running/completed/failed/waiting states. `App.tsx:252` starts the shell and nav; `App.tsx:278` conditionally mounts the active page; dialogs are conditionally removed at the end of the file. These direct conditional mounts currently have no outgoing transition.

    button → React state → real request / recorded frame → visible result
                 ↘ presentation-only animation → no data mutation

`web/src/OperationStatus.tsx:8` renders actual status with a word, icon, title, detail and optional action. Do not delay a state update to accommodate animation or animate intermediate metric values. `web/src/field-lab.css:4` supplies simple button color/press transitions; `field-lab.css:111` and `styles.css:18` already honor OS reduced motion for CSS, but a future JavaScript animation needs its own preference handling.

`web/src/Scene3D.tsx:99` CameraRig directly copies its camera and OrbitControls target when a preset/zoom/reset changes. It redraws on demand, follows measured ego motion, and disables follow on orbit. `Scene.tsx:45` defines renderer props; frame selection stays authoritative. Smooth only explicit camera moves, not vehicle positions or failure seeking, to preserve frame/overlay alignment. Camera animation must cancel when the user drags and must stop requesting frames when settled.

## Selected technical approach and risk boundaries

Use the browser's Web Animations API for interruptible motion, avoiding a new dependency and global page snapshots of WebGL. Shared navigation highlight is measured in its actual responsive container and retargets from its current visual position. Pages animate once on tab change, not on every 10Hz replay frame. Dialogs retain their DOM briefly on exit, become inert immediately when closing, and restore focus; repeated open/close cancels the old animation rather than queueing it. Status changes animate the icon/content once while the text is immediately authoritative. Candidate cost bars may smoothly change width, but numerical labels remain exact. Mobile inspection retains focus and uses smooth scrolling only when motion is allowed.

Initial proposal combined OS `prefers-reduced-motion` with a Reduce motion override. Actual browser requests OS reduction, so final design retains Follow system as default, with explicit session-only Full preview and remembered Reduce mode. CSS and JS obey the resolved preference and cancel effects if it changes. No OS settings are modified and Full does not override system on reload. Closing animation cannot retain a keyboard-accessible hidden dialog. Hook effects clean up Animation objects and observers. Nothing claims streaming backend progress or pausing computation.

## Tests and evidence

`web/tests/workspace.spec.ts` is an existing actual-backend Playwright integration suite. Browser verification uses the already selected in-app browser; no other browser runner will be launched without authorization. Add non-browser unit tests for deterministic motion math through Node's built-in test runner, and maintain integration tests for preference/presence/focus behavior without claiming they ran. Read browser animation objects, current transforms and rendered state at multiple times; screenshots prove visible composition, not smoothness by themselves. Record independent review → fixes → recheck cycles.

## Primary technical references

[Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) describes animations and inspecting them via getAnimations. [Animation.finished](https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished) provides completion promises; cancellation must not create unhandled rejections. [interpolate-size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size) is an optional CSS enhancement, not a requirement for core use.

Research reviewed before planning. No existing research/plan/implementation-log files or AGENTS.md were found in this project. No relevant DriveLab memory entry was used.
