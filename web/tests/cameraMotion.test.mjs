import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three-stdlib';
import { appendCameraMotionSample, cameraFrameIsSeek, cameraInterruptionAction, createCameraTransition, finiteCameraPose, sampleCameraTransition, translateCameraPose, zoomCameraPose } from '../src/cameraMotion.ts';

const start = { position: [-18, 35, 29], target: [0, 0, 0] };
const end = { position: [12, 48, -9], target: [12, 0, -9] };
const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('clamps time and returns exact endpoints with finite termination', () => {
  const transition = createCameraTransition(start, end, 100, 620);
  assert.deepEqual(sampleCameraTransition(transition, -500).pose, start);
  assert.equal(sampleCameraTransition(transition, 100).progress, 0);
  assert.deepEqual(sampleCameraTransition(transition, 720), { pose: end, progress: 1, done: true });
  assert.deepEqual(sampleCameraTransition(transition, 900).pose, end);
  assert.deepEqual(sampleCameraTransition(transition, NaN).pose, end);
});

test('does not retain mutable input snapshots', () => {
  const input = structuredClone(start), destination = structuredClone(end);
  const transition = createCameraTransition(input, destination, 0);
  input.position[0] = 999; destination.target[0] = 999;
  assert.deepEqual(transition.from, start);
  assert.deepEqual(transition.to, end);
  sampleCameraTransition(transition, 0).pose.target[0] = 888;
  assert.deepEqual(transition.from, start);
});

test('opposite orbit views keep a positive radius above the target', () => {
  const transition = createCameraTransition({ position: [-30, 20, 0], target: [0, 0, 0] }, { position: [30, 20, 0], target: [0, 0, 0] }, 0, 1000);
  for (let now = 0; now <= 1000; now++) {
    const { pose } = sampleCameraTransition(transition, now);
    assert.ok(finiteCameraPose(pose));
    near(Math.hypot(...pose.position), Math.hypot(30, 20));
    assert.ok(pose.position[1] >= 19.999999);
  }
});

test('azimuth takes the short arc across the wrap boundary', () => {
  const pose = angle => ({ position: [30 * Math.sin(angle), 20, 30 * Math.cos(angle)], target: [0, 0, 0] });
  const transition = createCameraTransition(pose(179 * Math.PI / 180), pose(-179 * Math.PI / 180), 0, 1000);
  const middle = sampleCameraTransition(transition, 500).pose;
  near(middle.position[0], 0);
  near(middle.position[2], -30);
});

test('rapid interruption restarts at the actual sampled position and target', () => {
  let transition = createCameraTransition(start, end, 0);
  for (let i = 1; i < 100; i++) {
    const now = i * 17;
    const visible = sampleCameraTransition(transition, now).pose;
    transition = createCameraTransition(visible, i % 2 ? start : end, now);
    assert.deepEqual(sampleCameraTransition(transition, now).pose, visible);
    assert.ok(finiteCameraPose(visible));
  }
  assert.equal(sampleCameraTransition(transition, 3000).done, true);
});

test('follow translation moves the whole orbit without restarting progress', () => {
  const transition = createCameraTransition(start, end, 0);
  const delta = [24, 0, -15];
  const translated = { ...transition, from: translateCameraPose(transition.from, delta), to: translateCameraPose(transition.to, delta) };
  const before = sampleCameraTransition(transition, 300), after = sampleCameraTransition(translated, 300);
  assert.equal(after.progress, before.progress);
  const expected = translateCameraPose(before.pose, delta);
  after.pose.position.forEach((value, i) => near(value, expected.position[i]));
  after.pose.target.forEach((value, i) => near(value, expected.target[i]));
});

test('easing approaches both endpoints with zero velocity', () => {
  const transition = createCameraTransition(start, end, 0, 1000);
  const delta = (a, b) => Math.hypot(...a.position.map((value, i) => value - b.position[i]));
  assert.ok(delta(sampleCameraTransition(transition, 1).pose, start) < 1e-5);
  assert.ok(delta(sampleCameraTransition(transition, 999).pose, end) < 1e-5);
});

test('zoom preserves manual target and orbit direction while respecting distance bounds', () => {
  const closer = zoomCameraPose(start, .5);
  assert.deepEqual(closer.target, start.target);
  closer.position.forEach((value, i) => near(value, start.position[i] * .5));
  near(Math.hypot(...zoomCameraPose(start, .0001).position), 8);
  near(Math.hypot(...zoomCameraPose(start, 1e8).position), 2500);
});

test('repeated zooms accumulate at the destination while restarting from the visible camera', () => {
  const manual = { position: [67, 35, 44], target: [85, 0, 15] };
  const first = createCameraTransition(manual, zoomCameraPose(manual, 1 / 1.25), 0, 320);
  const visible = sampleCameraTransition(first, 80).pose;
  const next = createCameraTransition(visible, zoomCameraPose(first.to, 1.25 / 1.5), 80, 320);
  assert.deepEqual(sampleCameraTransition(next, 80).pose, visible);
  assert.deepEqual(next.to.target, manual.target);
  const expected = zoomCameraPose(manual, 1 / 1.5);
  next.to.position.forEach((value, i) => near(value, expected.position[i]));
  assert.deepEqual(sampleCameraTransition(next, 400).pose, next.to);
});

test('rejects nonfinite or degenerate camera input', () => {
  const invalid = { position: [Infinity, 0, 0], target: [0, 0, 0] };
  const zero = { position: [0, 0, 0], target: [0, 0, 0] };
  assert.equal(finiteCameraPose(invalid), false);
  assert.equal(finiteCameraPose(zero), false);
  assert.equal(finiteCameraPose({ position: [Number.MAX_VALUE, Number.MAX_VALUE, 0], target: [0, 0, 0] }), false);
  for (const duration of [0, -1, Infinity, NaN]) assert.throws(() => createCameraTransition(start, end, 0, duration), RangeError);
  assert.throws(() => createCameraTransition(invalid, end, 0), RangeError);
  assert.throws(() => createCameraTransition(start, zero, 0), RangeError);
  assert.throws(() => zoomCameraPose(start, -1), RangeError);
});

test('paused single-frame seek is exact while forward playback can retarget', () => {
  assert.equal(cameraFrameIsSeek(1, 1.1, false), true);
  assert.equal(cameraFrameIsSeek(1, 1.1, true), false);
  assert.equal(cameraFrameIsSeek(1, 1, false), false);
  assert.equal(cameraFrameIsSeek(1, 5, false), true);
  assert.equal(cameraFrameIsSeek(1, 5, true), false);
  assert.equal(cameraFrameIsSeek(5, 0, true), true);
  assert.equal(cameraFrameIsSeek(undefined, 0, true), true);
  assert.equal(cameraFrameIsSeek(1, undefined, true), true);
});

test('seeking preserves the manual view and reframes only when following', () => {
  for (const phase of ['idle', 'orbit', 'transitioning']) {
    const request = { framingChanged: false, seek: true, follow: false, followWasEnabled: false, explicit: false, phase };
    assert.equal(cameraInterruptionAction(request), 'preserve');
    assert.equal(cameraInterruptionAction({ ...request, follow: true }), 'reframe');
  }
});

test('scenario/resize framing overrides manual-view preservation', () => {
  for (const seek of [false, true]) {
    assert.equal(cameraInterruptionAction({ framingChanged: true, seek, follow: false, followWasEnabled: false, explicit: false, phase: 'transitioning' }), 'reframe');
  }
});

test('turning follow off cancels its active transition without cancelling an explicit reset', () => {
  const toggle = { framingChanged: false, seek: false, follow: false, followWasEnabled: true, explicit: false, phase: 'transitioning' };
  assert.equal(cameraInterruptionAction(toggle), 'preserve');
  assert.equal(cameraInterruptionAction({ ...toggle, explicit: true }), null);
  assert.equal(cameraInterruptionAction({ ...toggle, followWasEnabled: false }), null);
  assert.equal(cameraInterruptionAction({ ...toggle, phase: 'orbit' }), null);
  assert.equal(cameraInterruptionAction({ ...toggle, phase: 'idle' }), null);
});

test('real OrbitControls accepts near-top camera samples and stops emitting changes when settled', () => {
  const camera = new PerspectiveCamera(42, 1, .1, 5000);
  const controls = new OrbitControls(camera);
  controls.enableDamping = false;
  controls.minDistance = 8; controls.maxDistance = 2500; controls.maxPolarAngle = Math.PI / 2.05;
  const transition = createCameraTransition(start, { position: [12, 48, -8.99], target: [12, 0, -9] }, 0, 620);
  for (let now = 0; now <= 620; now += 5) {
    const { pose } = sampleCameraTransition(transition, now);
    camera.position.fromArray(pose.position); controls.target.fromArray(pose.target); controls.update();
    camera.position.toArray().forEach((value, i) => near(value, pose.position[i], 1e-8));
  }
  let changes = 0;
  controls.addEventListener('change', () => { changes += 1; });
  controls.enableDamping = true;
  for (let i = 0; i < 60; i++) assert.equal(controls.update(), false);
  assert.equal(changes, 0);
  controls.dispose();
});

test('clearing real OrbitControls momentum preserves the live snapshot in full and reduced modes', () => {
  for (const reduced of [false, true]) {
    const camera = new PerspectiveCamera(); camera.position.fromArray(start.position);
    const controls = new OrbitControls(camera); controls.enableDamping = true;
    controls.setAzimuthalAngle(controls.getAzimuthalAngle() + .8);
    const visible = { position: camera.position.toArray(), target: controls.target.toArray() };
    controls.enableDamping = false; controls.update();
    camera.position.fromArray(visible.position); controls.target.fromArray(visible.target); controls.update();
    controls.enableDamping = !reduced;
    for (let i = 0; i < 60; i++) assert.equal(controls.update(), false);
    camera.position.toArray().forEach((value, i) => near(value, visible.position[i], 1e-8));
    controls.dispose();
  }
});

test('actual-pose evidence is throttled to 45ms and bounded at twelve with the start preserved', () => {
  const sample = timestamp => ({ ...structuredClone(start), timestamp, progress: timestamp / 1000, phase: 'transitioning' });
  let samples = appendCameraMotionSample([], sample(0));
  assert.equal(appendCameraMotionSample(samples, sample(44)), samples);
  samples = appendCameraMotionSample(samples, sample(45));
  assert.equal(samples.length, 2);
  for (let timestamp = 90; timestamp <= 900; timestamp += 45) samples = appendCameraMotionSample(samples, sample(timestamp));
  assert.equal(samples.length, 12);
  assert.equal(samples[0].timestamp, 0);
  assert.equal(samples.at(-1).timestamp, 900);
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i].timestamp - samples[i - 1].timestamp >= 45);
});

test('finished and cancelled evidence bypass throttling and retain distinct exact outcomes', () => {
  const source = [{ ...structuredClone(start), timestamp: 100, progress: .4, phase: 'transitioning' }];
  const cancelled = appendCameraMotionSample(source, { ...structuredClone(start), timestamp: 101, progress: .4, phase: 'idle', outcome: 'cancelled', reason: 'follow-off' });
  assert.equal(cancelled.at(-1).outcome, 'cancelled');
  assert.equal(cancelled.at(-1).progress, .4);
  assert.deepEqual(cancelled.at(-1).position, start.position);
  assert.equal(appendCameraMotionSample(cancelled, { ...end, timestamp: 200, progress: 1, phase: 'idle', outcome: 'finished' }), cancelled);
  const finished = appendCameraMotionSample(source, { ...end, timestamp: 102, progress: 1, phase: 'idle', outcome: 'finished' });
  assert.deepEqual(finished.at(-1).position, end.position);
  assert.equal(finished.at(-1).progress, 1);
  assert.equal(finished.at(-1).outcome, 'finished');
});

test('sample evidence snapshots cannot change when a live camera array is mutated or a new record begins', () => {
  const live = structuredClone(start);
  const prior = appendCameraMotionSample([], { ...live, timestamp: 1, progress: .2, phase: 'transitioning' });
  live.position[0] = 1000; live.target[0] = 1000;
  assert.deepEqual(prior[0].position, start.position);
  assert.deepEqual(prior[0].target, start.target);
  const next = appendCameraMotionSample([], { ...end, timestamp: 2, progress: 0, phase: 'transitioning' });
  assert.equal(next.length, 1);
  assert.deepEqual(next[0].position, end.position);
  assert.equal(prior[0].progress, .2);
});
