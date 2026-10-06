import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Crosshair, Minus, Plus, Maximize2 } from 'lucide-react';
import type { Candidate, Frame, Point, Scenario, Vehicle } from './types';
import { useArrival } from './motion';
import { scenePalette as paint } from './scenePalette';

const points = (p: Point[]) => p.map(([x, y]) => x + ',' + y).join(' ');

export function ScenarioThumbnail({ route }: { route?: Point[] }) {
  const coordinates = route ?? [[0, 0], [100, 0]];
  const xs = coordinates.map(p => p[0]), ys = coordinates.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const scale = 80 / Math.max(x1 - x0, y1 - y0, 1);
  const mapped = coordinates.map(([x, y]) => [10 + (x - x0) * scale, 32 - (y - (y0 + y1) / 2) * scale * .5] as Point);
  const paths = 'M' + mapped.map(p => p.join(' ')).join(' L');
  return <svg className="scenario-thumb" viewBox="0 0 100 64" aria-hidden="true">
    <rect width="100" height="64" rx="8" fill={paint.ground} />
    <path d={paths} fill="none" stroke={paint.road} strokeWidth="18" />
    <path d={paths} fill="none" stroke={paint.lane} strokeWidth="1" strokeDasharray="5 4" />
    <rect x="17" y="28" width="13" height="7" rx="2" fill={paint.selected} />
    {route && <title>Scenario route</title>}
  </svg>;
}

function Car({ vehicle, ego, selected, onSelect, size }: { vehicle: Vehicle; ego?: boolean; selected: boolean; onSelect: (id: string) => void; size: number }) {
  const color = ego ? paint.selected : vehicle.kind === 'pedestrian' ? paint.alternative : paint.traffic;
  return <g transform={'translate(' + vehicle.x + ' ' + vehicle.y + ') rotate(' + vehicle.yaw * 180 / Math.PI + ')'}
    className="car" tabIndex={0} role="button" aria-label={ego ? 'Select ego vehicle' : 'Select vehicle ' + vehicle.id}
    onClick={() => onSelect(vehicle.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(vehicle.id); } }}>
    {selected && <rect x={-vehicle.length / 2 - .65} y={-vehicle.width / 2 - .65} width={vehicle.length + 1.3} height={vehicle.width + 1.3} rx=".8" fill="none" stroke={color} strokeWidth=".15" strokeDasharray=".35 .3" />}
    <rect x={-vehicle.length / 2} y={-vehicle.width / 2} width={vehicle.length} height={vehicle.width} rx=".45" fill={color} stroke={paint.paper} strokeWidth=".12" />
    <rect x={vehicle.length * .12} y={-vehicle.width * .35} width={vehicle.length * .16} height={vehicle.width * .7} rx=".1" fill={paint.glass} />
    <rect x={-vehicle.length * .3} y={-vehicle.width * .32} width={vehicle.length * .1} height={vehicle.width * .64} rx=".1" fill={paint.glass} />
    {ego && <path d={'M' + (vehicle.length / 2 + .8) + ' -.55 l.65 .55 -.65 .55'} fill="none" stroke={paint.selected} strokeWidth=".18" />}
    <title>{(ego ? 'Ego vehicle' : vehicle.id) + ' · ' + (vehicle.speed * 3.6).toFixed(1) + ' km/h'}</title>
    {size < 0 && null}
  </g>;
}

export type SceneProps = {
  scenario: Scenario; frame?: Frame; playbackActive?: boolean; showCandidates: boolean; showRoute: boolean; showForecasts: boolean; inspectedCandidate: string | null; selectedActor: string | null; onActor: (id: string) => void; busy: boolean; busyLabel?: string;
};

const Scene3D = lazy(() => import('./Scene3D'));

class RendererBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function Scene(props: SceneProps) {
  const viewer = useRef<HTMLDivElement>(null);
  const [mode, updateMode] = useState<'2d' | '3d'>(() => {
    try { return localStorage.getItem('drivelab-view') === '2d' ? '2d' : '3d'; } catch { return '3d'; }
  });
  const setMode = (next: '2d' | '3d') => {
    updateMode(next);
    try { localStorage.setItem('drivelab-view', next); } catch { /* Private/storage-disabled browsers still switch. */ }
  };
  useArrival(viewer, mode, '.scene,.scene-placeholder');
  const fallback = <><div className="renderer-notice" role="status">3D unavailable. The 2D replay still works.</div><Scene2D {...props} /></>;
  const viewControls = <div className="view-switch" role="group" aria-label="Replay view">
      <span>View</span><button aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>2D debug</button>
      <button aria-pressed={mode === '3d'} onClick={() => setMode('3d')}>3D replay</button>
    </div>;
  return <div className="scene-viewer" ref={viewer}>
    {mode === '2d' ? <>{viewControls}<Scene2D {...props} /></> : <RendererBoundary fallback={<>{viewControls}{fallback}</>}>
      <Suspense fallback={<div className="scene-placeholder" role="status"><span className="spinner" />Loading 3D replay…</div>}>
        <Scene3D {...props} viewControls={viewControls} onFallback={() => setMode('2d')} />
      </Suspense>
    </RendererBoundary>}
  </div>;
}

function Scene2D({ scenario, frame, showCandidates, showRoute, showForecasts, inspectedCandidate, selectedActor, onActor, busy, busyLabel }: SceneProps) {
  const [zoom, setZoom] = useState(1);
  const [follow, setFollow] = useState(true);
  const container = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(.6);
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const size = entries[0].contentRect;
      if (size.width) setAspect(size.height / size.width);
    });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const [minX, minY, maxX, maxY] = scenario.bounds;
  const ego = frame?.ego ?? scenario.ego;
  const actors = frame?.actors ?? scenario.actors;
  const width = (follow ? 70 : Math.max(maxX - minX + 12, (maxY - minY + 12) / aspect)) / zoom;
  const height = width * aspect;
  const centerX = follow ? ego.x + Math.cos(ego.yaw) * 18 : (minX + maxX) / 2;
  const centerY = follow ? ego.y + Math.sin(ego.yaw) * 18 : (minY + maxY) / 2;
  const candidates = frame?.candidates ?? [];
  const chosen = candidates.find(c => c.id === frame?.selected_candidate);
  const inspected = candidates.find(c => c.id === inspectedCandidate);
  const renderPath = (candidate: Candidate, selected = false, inspecting = false) => <polyline key={candidate.id + (selected ? 's' : 'a')}
    points={points(candidate.points)} fill="none" stroke={inspecting ? paint.inspected : selected ? paint.selected : candidate.feasible ? paint.feasible : paint.rejected}
    strokeWidth={selected || inspecting ? '.45' : '.15'} opacity={selected || inspecting ? 1 : .48}
    strokeDasharray={selected || inspecting ? undefined : '.4 .4'} strokeLinecap="round" strokeLinejoin="round" />;
  const view = [centerX - width / 2, -centerY - height / 2, width, height].join(' ');
  return <div ref={container} className={'scene ' + (busy ? 'scene-busy' : '')} data-testid="scene">
    <div className="scene-hud"><span className="map-dot" />{scenario.name}<span className="hud-separator" /><span>{scenario.source.toLowerCase().includes('waymo') ? 'Waymo scene' : 'Synthetic scene'}</span></div>
    <svg className="road-canvas" viewBox={view} aria-label={'Road replay of ' + scenario.name}>
      <defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".055" fill={paint.gridMajor} /></pattern></defs>
      <rect x={centerX - width / 2} y={-centerY - height / 2} width={width} height={height} fill="url(#grid)" />
      <g transform="scale(1 -1)">
        {scenario.road_polygons.map((polygon, i) => <polygon key={i} points={points(polygon)} fill={paint.road} stroke={paint.traffic} strokeWidth=".15" />)}
        {scenario.lanes.map(lane => <polyline key={lane.id} points={points(lane.points)} stroke={paint.lane} strokeWidth=".15" strokeDasharray="1.5 1.8" fill="none" />)}
        {showRoute && <polyline points={points(scenario.route)} fill="none" stroke={paint.paper} strokeWidth=".18" strokeDasharray=".7 1.2" opacity=".5" />}
        {showCandidates && candidates.filter(c => c.id !== chosen?.id && c.id !== inspected?.id).map(c => renderPath(c))}
        {chosen && renderPath(chosen, true)}
        {inspected && inspected.id !== chosen?.id && renderPath(inspected, false, true)}
        {showForecasts && frame?.actor_forecasts?.map(path => <polyline key={path.actor_id} data-forecast-actor={path.actor_id} points={points(path.points)} fill="none" stroke={paint.alternative} strokeWidth=".3" strokeDasharray=".65 .5" strokeLinecap="round" opacity=".85"><title>Predicted movement of {path.actor_id} over {path.times.at(-1)} seconds</title></polyline>)}
        {actors.filter(a => a.valid !== false).map(a => <Car key={a.id} vehicle={a} selected={selectedActor === a.id} onSelect={onActor} size={width} />)}
        <Car vehicle={ego} ego selected={selectedActor === ego.id} onSelect={onActor} size={width} />
        {frame?.metrics.collision && <circle cx={ego.x} cy={ego.y} r="4" fill="none" stroke="#d65462" strokeWidth=".25" strokeDasharray=".4 .4" />}
        {scenario.route.length > 0 && <circle cx={scenario.route[scenario.route.length - 1][0]} cy={scenario.route[scenario.route.length - 1][1]} r=".55" fill="#42a998" opacity=".65" />}
      </g>
    </svg>
    <div className="map-legend"><span><i className="legend-ego" />Ego</span><span><i className="legend-traffic" />Traffic</span>{showCandidates && <span><i className="legend-rejected" />Rejected paths</span>}{showForecasts && !!frame?.actor_forecasts?.length && <span><i className="legend-forecast" />Forecast</span>}</div>
    <div className="map-tools">
      <button title="Zoom in" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(3, z + .25))}><Plus size={16} /></button>
      <button title="Zoom out" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.65, z - .25))}><Minus size={16} /></button>
      <button title="Reset view" aria-label="Reset view" onClick={() => { setZoom(1); setFollow(false); }}><Maximize2 size={15} /></button>
      <button title="Follow ego vehicle" aria-label="Follow ego vehicle" aria-pressed={follow} className={follow ? 'active' : ''} onClick={() => setFollow(x => !x)}><Crosshair size={16} /></button>
    </div>
    <div className="map-scale">Coordinates in meters</div>
    {busy && <div className="scene-loading"><span className="spinner" />{busyLabel ?? 'Computing driving decisions…'}</div>}
  </div>;
}
