export type CameraVector = [number, number, number];
export type CameraPose = { position: CameraVector; target: CameraVector };
export type CameraTransition = { from: CameraPose; to: CameraPose; startedAt: number; duration: number };
export type CameraOwner = { phase: 'idle' | 'orbit' } | { phase: 'transitioning'; transition: CameraTransition };
export type CameraMotionSample = CameraPose & {
  timestamp: number; progress: number; phase: CameraOwner['phase'];
  outcome?: 'finished' | 'cancelled'; reason?: string;
};

export function appendCameraMotionSample(samples: CameraMotionSample[], sample: CameraMotionSample): CameraMotionSample[] {
  const last = samples.at(-1);
  if (last?.outcome || (!sample.outcome && last && sample.timestamp - last.timestamp < 45)) return samples;
  // Terminal evidence bypasses the interval and keeps its actual progress.
  // Preserve the first visible pose plus the most recent eleven observations.
  const next = [...samples, { ...sample, position: [...sample.position] as CameraVector, target: [...sample.target] as CameraVector }];
  return next.length > 12 ? [next[0], ...next.slice(-11)] : next;
}

export function cameraInterruptionAction({ framingChanged, seek, follow, followWasEnabled, explicit, phase }: {
  framingChanged: boolean; seek: boolean; follow: boolean; followWasEnabled: boolean; explicit: boolean; phase: CameraOwner['phase'];
}): 'reframe' | 'preserve' | null {
  if (framingChanged) return 'reframe';
  if (seek) return follow ? 'reframe' : 'preserve';
  // A deliberate preset/reset still wins when it also disables follow. The
  // standalone follow toggle stops a follow transition at its visible pose.
  if (!explicit && followWasEnabled && !follow && phase === 'transitioning') return 'preserve';
  return null;
}

export function cameraFrameIsSeek(previous: number | undefined, next: number | undefined, playbackActive: boolean): boolean {
  if (previous === next) return false;
  // Forward playback may legitimately skip rendered frames under load. Use the
  // actual playback signal, rather than treating a larger delta as a seek.
  return !playbackActive || previous === undefined || next === undefined || next < previous;
}

const copy = (pose: CameraPose): CameraPose => ({ position: [...pose.position], target: [...pose.target] });
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function finiteCameraPose(pose: CameraPose): boolean {
  const radius = Math.hypot(...pose.position.map((value, i) => value - pose.target[i]));
  return [...pose.position, ...pose.target].every(Number.isFinite)
    && Number.isFinite(radius) && radius > 1e-6;
}

export function createCameraTransition(from: CameraPose, to: CameraPose, startedAt: number, duration = 620): CameraTransition {
  if (!finiteCameraPose(from) || !finiteCameraPose(to) || !Number.isFinite(startedAt) || !Number.isFinite(duration) || duration <= 0) {
    throw new RangeError('Camera transitions need finite, nondegenerate poses and a positive duration');
  }
  return { from: copy(from), to: copy(to), startedAt, duration };
}

// Interpolate around the target, so opposite views never pass through the road
// or collapse the orbit radius. Quintic easing has quiet velocity/acceleration
// at both ends; every interruption starts from the currently displayed pose.
export function sampleCameraTransition(transition: CameraTransition, now: number) {
  const progress = Number.isFinite(now) ? Math.max(0, Math.min(1, (now - transition.startedAt) / transition.duration)) : 1;
  if (progress === 0 || progress === 1) {
    return { pose: copy(progress === 0 ? transition.from : transition.to), progress, done: progress === 1 };
  }
  const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10);
  const spherical = (pose: CameraPose) => {
    const [x, y, z] = pose.position.map((value, i) => value - pose.target[i]);
    const radius = Math.hypot(x, y, z);
    return { radius, polar: Math.acos(Math.max(-1, Math.min(1, y / radius))), azimuth: Math.atan2(x, z) };
  };
  const from = spherical(transition.from), to = spherical(transition.to);
  const angle = Math.atan2(Math.sin(to.azimuth - from.azimuth), Math.cos(to.azimuth - from.azimuth));
  const radius = mix(from.radius, to.radius, eased);
  const polar = mix(from.polar, to.polar, eased);
  const azimuth = from.azimuth + angle * eased;
  const target = transition.from.target.map((value, i) => mix(value, transition.to.target[i], eased)) as CameraVector;
  const horizontal = radius * Math.sin(polar);
  const position: CameraVector = [target[0] + horizontal * Math.sin(azimuth), target[1] + radius * Math.cos(polar), target[2] + horizontal * Math.cos(azimuth)];
  return { pose: { position, target }, progress, done: false };
}

export function translateCameraPose(pose: CameraPose, delta: CameraVector): CameraPose {
  return { position: pose.position.map((value, i) => value + delta[i]) as CameraVector, target: pose.target.map((value, i) => value + delta[i]) as CameraVector };
}

export function zoomCameraPose(pose: CameraPose, ratio: number, minDistance = 8, maxDistance = 2500): CameraPose {
  if (!finiteCameraPose(pose) || !Number.isFinite(ratio) || ratio <= 0) throw new RangeError('Camera zoom needs a finite pose and a positive ratio');
  const offset = pose.position.map((value, i) => value - pose.target[i]);
  const radius = Math.hypot(...offset);
  const scale = Math.max(minDistance, Math.min(maxDistance, radius * ratio)) / radius;
  return { position: offset.map((value, i) => pose.target[i] + value * scale) as CameraVector, target: [...pose.target] };
}
