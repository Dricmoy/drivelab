import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { DoubleSide, Shape, ShapeGeometry, Vector2, Vector3 } from 'three';
import { Crosshair, Maximize2, Minus, Plus } from 'lucide-react';
import type { SceneProps } from './Scene';
import type { Point, StreetContext, Vehicle } from './types';
import { world } from './sceneGeometry';
import VehicleModel from './VehicleModel';
import { appendCameraMotionSample, cameraFrameIsSeek, cameraInterruptionAction, createCameraTransition, finiteCameraPose, sampleCameraTransition, translateCameraPose, zoomCameraPose } from './cameraMotion';
import type { CameraMotionSample, CameraOwner, CameraPose, CameraVector } from './cameraMotion';
import { useReducedMotion } from './motion';
import { scenePalette as paint } from './scenePalette';

type CameraMode = 'angled' | 'top' | 'chase';

class AssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Road({ polygon, origin }: { polygon: Point[]; origin: Point }) {
  const geometry = useMemo(() => {
    const shape = new Shape(polygon.map(([x, y]) => new Vector2(x - origin[0], y - origin[1])));
    return new ShapeGeometry(shape).rotateX(-Math.PI / 2);
  }, [polygon, origin]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={[0, .01, 0]} receiveShadow><meshStandardMaterial color={paint.road} roughness={.92} side={DoubleSide} /></mesh>;
}

function BoulevardContext({ context, origin }: { context: StreetContext; origin: Point }) {
  const midpoint = (context.x_min + context.x_max) / 2;
  const length = context.x_max - context.x_min;
  return <group>
    {context.curb_y.map((y, side) => <group key={side}>
      <mesh position={world([midpoint, y + (side ? 1.8 : -1.8)], origin, .12)} receiveShadow>
        <boxGeometry args={[length, .22, 3.6]} /><meshStandardMaterial color={paint.sidewalk} roughness={.95} />
      </mesh>
      <Path points={[[context.x_min, y], [context.x_max, y]]} origin={origin} color={paint.rim} height={.24} opacity={.6} />
    </group>)}
    <Path points={[[context.x_min, 1.66], [context.x_max, 1.66]]} origin={origin} color={paint.alternative} width={1.5} opacity={.7} />
    <Path points={[[context.x_min, 1.94], [context.x_max, 1.94]]} origin={origin} color={paint.alternative} width={1.5} opacity={.7} />
    {context.buildings.map((building, index) => <group key={index} position={world([building.x, building.y], origin, 0)}>
      <mesh position={[0, building.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[building.length, building.height, building.width]} />
        <meshStandardMaterial color={paint.building} roughness={.9} />
      </mesh>
      <mesh position={[0, building.height + .12, 0]} castShadow>
        <boxGeometry args={[building.length + .3, .24, building.width + .3]} />
        <meshStandardMaterial color={paint.rooftop} roughness={.9} />
      </mesh>
      {Array.from({length:Math.floor(building.height / 3)}, (_, floor) => [-6, -2, 2, 6].map(x => <mesh key={floor + ':' + x} position={[x, 2 + floor * 3, (building.y < 0 ? -1 : 1) * (building.width / 2 + .01)]}>
        <boxGeometry args={[1.6, 1.5, .04]} /><meshStandardMaterial color={paint.window} metalness={.3} roughness={.5} />
      </mesh>))}
    </group>)}
    {context.curb_y.flatMap((y, side) => [0,30,60,90,120].map(x => <group key={side + ':' + x} position={world([x, y + (side ? 1.2 : -1.2)], origin, 0)}>
      <mesh position={[0, 2.4, 0]} castShadow><cylinderGeometry args={[.06,.09,4.8,6]} /><meshStandardMaterial color={paint.trim} roughness={.7} /></mesh>
      <mesh position={[0, 4.8, side ? .45 : -.45]}><boxGeometry args={[.45,.14,1.1]} /><meshStandardMaterial color={paint.rim} metalness={.4} roughness={.4} /></mesh>
    </group>))}
  </group>;
}

function Path({ points, origin, color, width = 1, dashed = false, opacity = 1, height = .09 }: {
  points: Point[]; origin: Point; color: string; width?: number; dashed?: boolean; opacity?: number; height?: number;
}) {
  const vertices = useMemo(() => points.map(p => world(p, origin, height)), [points, origin, height]);
  if (vertices.length < 2) return null;
  return <Line points={vertices} color={color} lineWidth={width} dashed={dashed} dashSize={.7} gapSize={.5} transparent opacity={opacity} depthWrite={false} />;
}

function ContextGuard({ onFallback }: { onFallback: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', onFallback);
    // Intentional renderer disposal must not change the saved view preference.
    return () => canvas.removeEventListener('webglcontextlost', onFallback);
  }, [gl, onFallback]);
  return null;
}

function VehicleMesh({ vehicle, ego = false, selected, origin, onActor, onReady, onFailure }: {
  vehicle: Vehicle; ego?: boolean; selected: boolean; origin: Point; onActor: (id: string) => void; onReady: (asset: string) => void; onFailure: () => void;
}) {
  const color = ego ? paint.selected : paint.traffic;
  const primitive = <mesh position={[0, .6, 0]} castShadow><boxGeometry args={[vehicle.length, 1.2, vehicle.width]} /><meshStandardMaterial color={color} /></mesh>;
  const footprint: Point[] = [[-vehicle.length / 2 - .25, -vehicle.width / 2 - .25], [vehicle.length / 2 + .25, -vehicle.width / 2 - .25], [vehicle.length / 2 + .25, vehicle.width / 2 + .25], [-vehicle.length / 2 - .25, vehicle.width / 2 + .25], [-vehicle.length / 2 - .25, -vehicle.width / 2 - .25]];
  return <group position={world([vehicle.x, vehicle.y], origin, .03)} rotation={[0, vehicle.yaw, 0]} onClick={e => { e.stopPropagation(); onActor(vehicle.id); }}>
    {vehicle.kind === 'pedestrian' ? <mesh position={[0, .85, 0]} castShadow><capsuleGeometry args={[Math.max(.15, vehicle.width / 2), 1, 4, 8]} /><meshStandardMaterial color={paint.alternative} /></mesh>
      : vehicle.kind === 'cyclist' ? primitive : <AssetBoundary fallback={primitive} onFailure={onFailure}><VehicleModel vehicle={vehicle} ego={ego} onReady={onReady} /></AssetBoundary>}
    {(ego || selected) && <Path points={footprint} origin={[0, 0]} color={selected ? paint.inspected : color} width={selected ? 3 : 2.5} />}
  </group>;
}

function CameraRig({ ego, actors, frameTime, playbackActive, origin, scenario, mode, follow, zoom, reset, reducedMotion, onOrbit }: {
  ego: Vehicle; actors: Vehicle[]; frameTime?: number; playbackActive: boolean; origin: Point; scenario: SceneProps['scenario']; mode: CameraMode; follow: boolean; zoom: number; reset: number; reducedMotion: boolean; onOrbit: () => void;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, gl, invalidate, size } = useThree();
  const previous = useRef<{ position: Vector3; yaw: number; time?: number } | null>(null);
  const previousRequest = useRef<{ mode: CameraMode; zoom: number; reset: number; follow: boolean; scenario: SceneProps['scenario']; origin: Point; width: number; height: number; reducedMotion: boolean } | null>(null);
  const owner = useRef<CameraOwner>({ phase: 'idle' });
  const progress = useRef(1);
  const renderFrames = useRef(0);
  const samples = useRef<CameraMotionSample[]>([]);
  const samplesJSON = useRef('[]');
  const outcome = useRef<'none' | 'transitioning' | 'finished' | 'cancelled' | 'instant'>('none');

  const readPose = useCallback((): CameraPose => ({
    position: camera.position.toArray() as CameraVector,
    target: (controls.current?.target.toArray() ?? [0, 0, 0]) as CameraVector,
  }), [camera]);
  const publish = useCallback(() => {
    const element = gl.domElement.closest<HTMLElement>('[data-testid="scene-3d"]');
    if (!element) return;
    const pose = readPose();
    element.dataset.cameraMotion = owner.current.phase;
    element.dataset.cameraMotionProgress = String(progress.current);
    element.dataset.cameraMotionSamples = samplesJSON.current;
    element.dataset.cameraMotionOutcome = outcome.current;
    element.dataset.cameraPosition = JSON.stringify(pose.position);
    element.dataset.cameraTarget = JSON.stringify(pose.target);
    element.dataset.cameraFinite = String(finiteCameraPose(pose));
    element.dataset.cameraReducedMotion = String(reducedMotion);
    element.dataset.cameraDamping = String(controls.current?.enableDamping ?? false);
    element.dataset.cameraRenderFrames = String(renderFrames.current);
  }, [gl, readPose, reducedMotion]);
  const recordSample = useCallback((terminal?: CameraMotionSample['outcome'], reason?: string, timestamp = performance.now()) => {
    const next = appendCameraMotionSample(samples.current, { ...readPose(), timestamp, progress: progress.current, phase: owner.current.phase, ...(terminal ? { outcome: terminal, reason } : {}) });
    if (next === samples.current) return;
    samples.current = next;
    samplesJSON.current = JSON.stringify(next);
    if (terminal) outcome.current = terminal;
    publish();
  }, [readPose, publish]);
  const cancelTransition = useCallback((reason: string, phase: 'idle' | 'orbit' = 'idle') => {
    if (owner.current.phase !== 'transitioning') return;
    owner.current = { phase };
    // Record the live cancellation pose before seeking/reframing or clearing
    // momentum, and before idle diagnostics reset progress to one.
    recordSample('cancelled', reason);
  }, [recordSample]);
  const writePose = useCallback((pose: CameraPose) => {
    camera.position.fromArray(pose.position);
    camera.lookAt(new Vector3(...pose.target));
    if (controls.current) {
      controls.current.target.fromArray(pose.target);
      controls.current.enableDamping = false;
      controls.current.update();
      controls.current.enableDamping = !reducedMotion && owner.current.phase !== 'transitioning';
    }
    publish();
  }, [camera, publish, reducedMotion]);
  const desiredPose = useCallback((): CameraPose => {
    const [x0, y0, x1, y1] = scenario.bounds;
    const span = Math.max(x1 - x0, (y1 - y0) * size.width / Math.max(size.height, 1), 35);
    const narrow = size.width < 480;
    // Frame nearby forward traffic on load/seek without moving any recorded pose.
    const forwardGaps = actors.map(a => ({ forward: (a.x - ego.x) * Math.cos(ego.yaw) + (a.y - ego.y) * Math.sin(ego.yaw), lateral: Math.abs(-(a.x - ego.x) * Math.sin(ego.yaw) + (a.y - ego.y) * Math.cos(ego.yaw)) }))
      .filter(a => a.forward > 0 && a.forward < 60 && a.lateral < 8).map(a => a.forward);
    const gap = forwardGaps.length ? Math.min(...forwardGaps) : 0;
    const followDistance = Math.max(narrow ? 28 : 30, gap * (narrow ? 1.3 : .95));
    const urbanOverview = !!scenario.environment && !follow;
    const distance = (follow ? followDistance : span * (urbanOverview ? narrow ? .5 : .65 : .85)) / zoom;
    const lookAhead = Math.max(narrow ? 8 : 10, Math.min(18, gap / 2));
    const center: Point = follow ? [ego.x + Math.cos(ego.yaw) * lookAhead, ego.y + Math.sin(ego.yaw) * lookAhead] : urbanOverview && narrow ? [scenario.ego.x + 35, 1.8] : [(x0 + x1) / 2, (y0 + y1) / 2];
    const target = new Vector3(...world(center, origin, 0));
    const offset = mode === 'top' ? new Vector3(0, distance * 1.25, .01) : mode === 'chase'
      ? new Vector3(-Math.cos(ego.yaw) * distance * .65, distance * .4, Math.sin(ego.yaw) * distance * .65)
      : new Vector3(-distance * (urbanOverview ? .20 : .48), distance * .92, distance * .75);
    offset.setLength(Math.max(8, Math.min(2500, offset.length())));
    return { position: target.clone().add(offset).toArray() as CameraVector, target: target.toArray() as CameraVector };
  }, [scenario, actors, size.width, size.height, follow, ego.x, ego.y, ego.yaw, origin, mode, zoom]);

  useLayoutEffect(() => {
    const last = previousRequest.current;
    previousRequest.current = { mode, zoom, reset, follow, scenario, origin, width: size.width, height: size.height, reducedMotion };
    const current = new Vector3(...world([ego.x, ego.y], origin, 0));
    const lastFrame = previous.current;
    previous.current = { position: current, yaw: ego.yaw, time: frameTime };
    const framingChanged = !last || last.scenario !== scenario || last.origin !== origin || last.width !== size.width || last.height !== size.height;
    const explicit = !!last && (last.mode !== mode || last.zoom !== zoom || last.reset !== reset);
    const poseChanged = !!lastFrame && (!current.equals(lastFrame.position) || ego.yaw !== lastFrame.yaw);
    const seek = !!lastFrame && (cameraFrameIsSeek(lastFrame.time, frameTime, playbackActive) || (!playbackActive && poseChanged));
    const interruption = cameraInterruptionAction({ framingChanged, seek, follow, followWasEnabled: last?.follow ?? false, explicit, phase: owner.current.phase });
    // One owner decides between exact recorded-frame framing, a presentation
    // transition, and manual orbit. There is no separate follow camera writer.
    if (interruption) {
      // Snapshot before clearing OrbitControls momentum. A seek without follow
      // or disabling follow must retain the actual view, not a preset endpoint.
      const pose = interruption === 'reframe' ? desiredPose() : readPose();
      cancelTransition(framingChanged ? 'framing' : seek ? 'seek' : 'follow-off');
      owner.current = { phase: 'idle' }; progress.current = 1;
      if (controls.current) { controls.current.enableDamping = false; controls.current.update(); }
      writePose(pose);
      invalidate();
      return;
    }
    if (explicit) {
      const from = readPose();
      const zoomOnly = last.mode === mode && last.reset === reset;
      // Repeated zooms scale the intended orbit destination, while the next
      // move still starts at the live camera. This preserves manual framing
      // and accumulates each click even before the previous zoom settles.
      const zoomBase = owner.current.phase === 'transitioning' ? owner.current.transition.to : from;
      const to = zoomOnly ? zoomCameraPose(zoomBase, last.zoom / zoom) : desiredPose();
      cancelTransition('superseded');
      // Clear residual drag deltas, then restore the visible snapshot before
      // starting. OrbitControls momentum must never fight the tween.
      if (controls.current) { controls.current.enableDamping = false; controls.current.update(); }
      samples.current = []; samplesJSON.current = '[]';
      outcome.current = reducedMotion ? 'instant' : 'transitioning';
      owner.current = reducedMotion ? { phase: 'idle' } : { phase: 'transitioning', transition: createCameraTransition(from, to, performance.now(), zoomOnly ? 320 : 620) };
      progress.current = reducedMotion ? 1 : 0;
      writePose(reducedMotion ? to : from);
      if (!reducedMotion) recordSample();
      invalidate();
      return;
    }
    if (follow && lastFrame && owner.current.phase !== 'orbit' && (poseChanged || (!last?.follow && follow))) {
      const delta = current.clone().sub(lastFrame.position).toArray() as CameraVector;
      if (owner.current.phase === 'transitioning') {
        const active = owner.current.transition;
        active.from = translateCameraPose(active.from, delta);
        active.to = mode === 'chase' ? desiredPose() : translateCameraPose(active.to, delta);
      } else {
        writePose(mode === 'chase' ? desiredPose() : translateCameraPose(readPose(), delta));
      }
      invalidate();
    }
    if (last?.reducedMotion !== reducedMotion) {
      const pose = reducedMotion && owner.current.phase === 'transitioning' ? owner.current.transition.to : readPose();
      if (reducedMotion) { cancelTransition('reduced-motion'); owner.current = { phase: 'idle' }; progress.current = 1; }
      // Reduced motion also settles manual momentum, retaining its live pose.
      if (controls.current) { controls.current.enableDamping = false; controls.current.update(); }
      writePose(pose);
      invalidate();
    }
  }, [mode, zoom, reset, follow, scenario, origin, size.width, size.height, reducedMotion, desiredPose, readPose, writePose, recordSample, cancelTransition, ego.x, ego.y, ego.yaw, frameTime, playbackActive, invalidate]);

  useFrame(() => {
    renderFrames.current += 1;
    if (owner.current.phase !== 'transitioning') { publish(); return; }
    const timestamp = performance.now();
    const sample = sampleCameraTransition(owner.current.transition, timestamp);
    progress.current = sample.progress;
    if (sample.done) owner.current = { phase: 'idle' };
    writePose(sample.pose);
    recordSample(sample.done ? 'finished' : undefined, undefined, timestamp);
    if (!sample.done) invalidate();
  });
  useEffect(() => () => { owner.current = { phase: 'idle' }; }, []);
  return <OrbitControls ref={controls} makeDefault enableDamping={!reducedMotion} minDistance={8} maxDistance={2500} maxPolarAngle={Math.PI / 2.05}
    onChange={publish} onStart={() => {
      cancelTransition('orbit', 'orbit');
      owner.current = { phase: 'orbit' }; progress.current = 1;
      if (controls.current) controls.current.enableDamping = !reducedMotion;
      publish(); onOrbit();
    }} onEnd={() => { if (owner.current.phase === 'orbit') owner.current = { phase: 'idle' }; publish(); }} />;
}

export default function Scene3D({ scenario, frame, playbackActive = false, showCandidates, showRoute, showForecasts, inspectedCandidate, selectedActor, onActor, busy, busyLabel, viewControls, onFallback }: SceneProps & { viewControls: ReactNode; onFallback: () => void }) {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<CameraMode>('angled');
  const [follow, setFollow] = useState(!scenario.tags.includes('urban-fleet'));
  const [zoom, setZoom] = useState(1);
  const [reset, setReset] = useState(0);
  const [ready, setReady] = useState(false);
  const [assets, setAssets] = useState<string[]>([]);
  const [assetFailed, setAssetFailed] = useState(false);
  const onReady = useMemo(() => (asset: string) => setAssets(previous => previous.includes(asset) ? previous : [...previous, asset]), []);
  const onFailure = useMemo(() => () => setAssetFailed(true), []);
  const origin = useMemo<Point>(() => [scenario.ego.x, scenario.ego.y], [scenario]);
  const ego = frame?.ego ?? scenario.ego;
  const actors = (frame?.actors ?? scenario.actors).filter(a => a.valid !== false);
  const candidates = frame?.candidates ?? [];
  const chosen = candidates.find(c => c.id === frame?.selected_candidate);
  const alternative = candidates.filter(c => c.feasible && c.id !== chosen?.id).sort((a, b) => a.cost - b.cost)[0];
  const sameGeometry = !!chosen && !!alternative && chosen.points.length === alternative.points.length && chosen.points.every((p, i) => Math.hypot(p[0] - alternative.points[i][0], p[1] - alternative.points[i][1]) < .001);
  const inspected = candidates.find(c => c.id === inspectedCandidate);
  const span = Math.max(scenario.bounds[2] - scenario.bounds[0], scenario.bounds[3] - scenario.bounds[1], 200);
  const center = world([(scenario.bounds[0] + scenario.bounds[2]) / 2, (scenario.bounds[1] + scenario.bounds[3]) / 2], origin, -.01);
  return <div className="scene scene-3d" data-testid="scene-3d" data-renderer={ready ? 'webgl' : 'loading'} data-models={assets.join(',')} data-actor-count={actors.length} data-camera={mode} data-camera-motion-kind="presentation" data-camera-motion-label="Camera presentation only; recorded vehicle poses remain exact">
    <div className="scene-control-bar">
      {viewControls}
      <div className="camera-presets" role="group" aria-label="3D camera">{(['angled', 'top', 'chase'] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => { setMode(m); if (m === 'chase') setFollow(true); setReset(n => n + 1); }}>{m === 'angled' ? 'Angled' : m === 'top' ? 'Top-down' : 'Chase'}</button>)}</div>
      <select className="camera-select" aria-label="Camera view" value={mode} onChange={e => { const next = e.target.value as CameraMode; setMode(next); if (next === 'chase') setFollow(true); setReset(n => n + 1); }}><option value="angled">Angled</option><option value="top">Top-down</option><option value="chase">Chase</option></select>
      <div className="actor-picker"><button aria-label="Select ego vehicle" aria-pressed={selectedActor === ego.id} onClick={() => onActor(ego.id)}>Inspect ego</button><select aria-label="Inspect traffic actor" value={actors.some(a => a.id === selectedActor) ? selectedActor! : ''} onChange={e => { if (e.target.value) onActor(e.target.value); }}><option value="">Traffic ({actors.length})</option>{actors.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}</select></div>
    </div>
    {scenario.environment && <div className="scene-fleet-note"><strong>{actors.length + 1} vehicles · {actors.filter(a => a.speed > 0).length} moving traffic · {actors.filter(a => a.speed === 0).length} parked</strong><span>Synthetic, prescribed motion · street context illustrative</span></div>}
    <div className="scene-canvas">
    <Canvas shadows="percentage" frameloop="demand" dpr={[1, 1.5]} camera={{ position: [-20, 40, 30], fov: 42, near: .1, far: Math.max(5000, span * 3) }} gl={{ antialias: true }} onCreated={() => setReady(true)} fallback={<div className="scene-placeholder" role="status">WebGL is unavailable.<button className="button button-secondary" onClick={onFallback}>Use 2D replay</button></div>}>
      <ContextGuard onFallback={onFallback} />
      <color attach="background" args={[paint.ground]} />
      <hemisphereLight args={[paint.paper, paint.ground, 1.1]} />
      <directionalLight position={[30, 100, 25]} intensity={2.8} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-160} shadow-camera-right={160} shadow-camera-top={160} shadow-camera-bottom={-160} shadow-camera-far={300} shadow-normalBias={.04} />
      <directionalLight position={[-35, 20, -25]} color={paint.selected} intensity={.9} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={center} receiveShadow><planeGeometry args={[span + 300, span + 300]} /><meshStandardMaterial color={paint.ground} roughness={.9} /></mesh>
      <gridHelper args={[Math.ceil((span + 150) / 10) * 10, Math.ceil((span + 150) / 10), paint.gridMajor, paint.grid]} position={[center[0], 0, center[2]]} />
      {scenario.road_polygons.filter(p => p.length >= 3).map((p, i) => <Road key={i} polygon={p} origin={origin} />)}
      {scenario.environment && <BoulevardContext context={scenario.environment} origin={origin} />}
      {scenario.lanes.map(lane => <Path key={lane.id} points={lane.points} origin={origin} color={paint.lane} dashed opacity={.45} />)}
      {showRoute && <Path points={scenario.route} origin={origin} color={paint.paper} dashed opacity={.5} height={.11} />}
      {showCandidates && candidates.filter(c => c.id !== chosen?.id && c.id !== inspected?.id && c.id !== alternative?.id).map(c => <Path key={c.id} points={c.points} origin={origin} color={c.feasible ? paint.feasible : paint.rejected} width={1} dashed opacity={.10} height={.12} />)}
      {showCandidates && alternative && !sameGeometry && alternative.id !== inspected?.id && <Path points={alternative.points} origin={origin} color={paint.alternative} width={2.5} dashed opacity={.9} height={.14} />}
      {chosen && <Path points={chosen.points} origin={origin} color={paint.selected} width={5} height={.15} />}
      {inspected && inspected.id !== chosen?.id && <Path points={inspected.points} origin={origin} color={paint.inspected} width={4} dashed height={.18} />}
      {showForecasts && frame?.actor_forecasts?.map(path => <Path key={path.actor_id} points={path.points} origin={origin} color={paint.alternative} width={scenario.environment && selectedActor !== path.actor_id ? 1.2 : 2.5} opacity={scenario.environment && selectedActor !== path.actor_id ? .28 : 1} dashed height={.2} />)}
      {actors.map(vehicle => <VehicleMesh key={vehicle.id} vehicle={vehicle} origin={origin} selected={selectedActor === vehicle.id} onActor={onActor} onReady={onReady} onFailure={onFailure} />)}
      <VehicleMesh vehicle={ego} ego origin={origin} selected={selectedActor === ego.id} onActor={onActor} onReady={onReady} onFailure={onFailure} />
      {frame?.metrics.collision && <mesh position={world([ego.x, ego.y], origin, .24)} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[3.8, 4, 48]} /><meshBasicMaterial color={paint.rejected} side={DoubleSide} /></mesh>}
      <CameraRig ego={ego} actors={actors} frameTime={frame?.time} playbackActive={playbackActive} origin={origin} scenario={scenario} mode={mode} follow={follow} zoom={zoom} reset={reset} reducedMotion={reducedMotion} onOrbit={() => setFollow(false)} />
    </Canvas>
    {busy && <div className="scene-loading"><span className="spinner" />{busyLabel ?? 'Computing driving decisions…'}</div>}
    </div>
    {!!chosen && <div className="scene-path-key" aria-label="Displayed trajectories"><span>Selected · Path {Number(chosen.id.split('-').at(-1)) + 1}</span>{showCandidates && alternative && alternative.id !== inspected?.id && <span className={sameGeometry ? 'path-key-shared' : 'path-key-alternative'}>Alternative · Path {Number(alternative.id.split('-').at(-1)) + 1}{sameGeometry ? ' · same geometry' : ''}</span>}{inspected && inspected.id !== chosen.id && <span className="path-key-inspected">Inspecting · Path {Number(inspected.id.split('-').at(-1)) + 1}</span>}</div>}
    <div className="scene-bottom-bar">
    <div className="map-legend"><span><i className="legend-ego" />Ego</span><span><i className="legend-traffic" />Traffic</span>{showCandidates && <span><i className="legend-rejected" />Rejected paths</span>}{showForecasts && !!frame?.actor_forecasts?.length && <span><i className="legend-forecast" />Forecast</span>}</div>
    <div className="map-tools"><button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(3, z + .25))}><Plus size={16} /></button><button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.4, z - .25))}><Minus size={16} /></button><button aria-label="Reset view" onClick={() => { setZoom(1); setFollow(false); setReset(n => n + 1); }}><Maximize2 size={15} /></button><button aria-label="Follow ego vehicle" aria-pressed={follow} className={follow ? 'active' : ''} onClick={() => { setFollow(f => !f); if (!follow) setReset(n => n + 1); }}><Crosshair size={16} /></button></div>
    </div>
    <div className="scene-3d-note" role="status">{assetFailed ? 'Model unavailable · simplified vehicles' : assets.length ? 'Dimensional models · illustrative appearance' : 'Preparing vehicle models…'}<span>Drag to orbit · scroll to zoom · meters</span></div>
  </div>;
}
