import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpRight, BookOpen, BrainCircuit, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Database, FlaskConical, Gauge, History, Layers3, LoaderCircle, Pause, Play, RotateCcw, Route, Search, Settings2, ShieldCheck, SlidersHorizontal, TriangleAlert, Volume2, VolumeX, X } from 'lucide-react';
import { api, post } from './api';
import Scene, { ScenarioThumbnail } from './Scene';
import OperationStatus from './OperationStatus';
import type { OperationState } from './OperationStatus';
import { clickSound } from './feedback';
import { MotionPresence, NavigationHighlight, useArrival, useMotionSettings, usePageMotion } from './motion';
import type { Candidate, Evaluation, ForecastStatus, Health, PlannerConfig, RunReport, RunSummary, Scenario, ScenarioSummary, Vehicle } from './types';

type Tab = 'replay' | 'evaluation' | 'dataset' | 'model';
const defaults: PlannerConfig = { target_speed: 8, safety_margin: 1, horizon: 3, prediction: 'constant_velocity', scoring: 'auto' };
const f = (n: number | undefined, digits = 1) => n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(digits);
const plannerName = (p: string) => p === 'lattice' ? 'Trajectory planner' : 'Route baseline';
const isWaymo = (s: string) => s.toLowerCase().includes('waymo');
const sameSettings = (a: PlannerConfig, b: PlannerConfig) => a.target_speed === b.target_speed && a.safety_margin === b.safety_margin && a.horizon === b.horizon && (a.prediction ?? 'constant_velocity') === (b.prediction ?? 'constant_velocity') && (a.scoring ?? 'auto') === (b.scoring ?? 'auto');
const scoringName = (backend?: string) => backend === 'rust' ? 'Rust native' : backend === 'numpy' ? 'Python / NumPy' : 'Not recorded (legacy run)';

function Metric({ label, value, unit, icon, warn, subtitle }: { label: string; value: string; unit?: string; icon: React.ReactNode; warn?: boolean; subtitle: string }) {
  return <div className={'metric ' + (warn ? 'metric-warn' : '')}><div className="metric-label">{label}{icon}</div><div className="metric-number">{value}<span>{unit}</span></div><div className="metric-note">{subtitle}</div></div>;
}

function CandidateCosts({ candidate }: { candidate?: Candidate }) {
  const costs = candidate ? [{ label: 'Collision risk', value: candidate.collision_cost }, { label: 'Road departure', value: candidate.offroad_cost }, { label: 'Progress', value: candidate.progress_cost }, { label: 'Comfort', value: candidate.comfort_cost }] : [];
  const max = Math.max(1, ...costs.map(c => Math.abs(c.value)));
  return <div className="cost-list">{costs.map(c => <div className="cost-row" key={c.label}><div><span>{c.label}</span><strong>{f(c.value, 2)}</strong></div><div className="cost-track"><span style={{ width: Math.max(2, Math.abs(c.value) / max * 100) + '%' }} /></div></div>)}</div>;
}

function RunMetrics({ report }: { report: RunReport | null }) {
  return <section className="run-outcomes" aria-label="Whole-run results"><h2>{report ? `Entire recorded run · ${isWaymo(report.source) ? 'imported data' : 'synthetic'}` : 'Run outcomes · awaiting a result'}</h2><div className="metrics-strip">
    <Metric label="Collision" value={report ? report.metrics.collision ? 'Detected' : 'None' : '—'} icon={<ShieldCheck size={16} />} warn={report?.metrics.collision} subtitle="Across the entire run" />
    <Metric label="Route progress" value={report ? f(report.metrics.progress * 100, 0) : '—'} unit="%" icon={<Route size={16} />} subtitle="Distance along the route" />
    <Metric label="Average speed" value={report ? f(report.metrics.mean_speed * 3.6) : '—'} unit="km/h" icon={<Gauge size={16} />} subtitle="Measured from the simulation" />
    <Metric label="Peak jerk" value={report ? f(report.metrics.max_jerk) : '—'} unit="m/s³" icon={<SlidersHorizontal size={16} />} subtitle="Change in acceleration" />
  </div></section>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('replay');
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioId, setScenarioId] = useState('');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [planner, setPlanner] = useState<'baseline' | 'lattice'>('lattice');
  const [config, setConfig] = useState(defaults);
  const [draftConfig, setDraftConfig] = useState(defaults);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showCandidates, setShowCandidates] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [showForecasts, setShowForecasts] = useState(true);
  const [inspectedCandidate, setInspectedCandidate] = useState<string | null>(null);
  const [candidateFilter, setCandidateFilter] = useState<'best' | 'rejected'>('best');
  const [candidatesExpanded, setCandidatesExpanded] = useState(false);
  const [selectedActor, setSelectedActor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('drivelab-sound') === 'on'; } catch { return false; } });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [datasetPath, setDatasetPath] = useState('');
  const [importLimit, setImportLimit] = useState(5);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [model, setModel] = useState<ForecastStatus | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState('');
  const [training, setTraining] = useState(false);
  const [trainingSeed, setTrainingSeed] = useState(42);
  const [epochs, setEpochs] = useState(80);
  const requestVersion = useRef(0);
  const pendingRun = useRef<{ report: RunReport; scenario: Scenario } | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const plannerRef = useRef(planner);
  plannerRef.current = planner;
  const mainRef = useRef<HTMLElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const dialogGeneration = useRef(0);
  const dialogOpener = useRef<HTMLElement | null>(null);
  const dialogActive = configOpen || helpOpen || historyOpen || exportOpen;
  const motion = useMotionSettings();
  usePageMotion(mainRef, tab);
  useArrival(mainRef, report?.id, '.run-receipt');
  useArrival(mainRef, scenario?.id, '.page-heading');
  useArrival(mainRef, evaluation?.id, '.comparison-table-wrap');
  useArrival(mainRef, inspectedCandidate ?? selectedActor, '.inspector-section');

  useEffect(() => {
    api<ForecastStatus>('/model').then(setModel).catch(e => setModelError(e.message)).finally(() => setModelLoading(false));
    Promise.all([api<ScenarioSummary[]>('/scenarios'), api<Health>('/health')])
      .then(([items, h]) => { setScenarios(items); setHealth(h); if (items.length) setScenarioId(items[0].id); })
      .catch(e => setError('Could not connect to DriveLab. Start the local server and reload. ' + e.message));
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if (sound && target && !(target as HTMLButtonElement).disabled) clickSound();
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [sound]);

  useEffect(() => {
    if (!scenarioId) return;
    if (pendingRun.current?.report.scenario_id === scenarioId) {
      const saved = pendingRun.current; pendingRun.current = null;
      setScenario(saved.scenario); setReport(saved.report); setPlanner(saved.report.planner);
      setConfig(saved.report.config); setFrameIndex(0); setPlaying(false);
      setInspectedCandidate(null); setSelectedActor(null); setBusy(false);
      return;
    }
    const version = ++requestVersion.current;
    const controller = new AbortController();
    setBusy(true); setRestoring(false); setError(''); setPlaying(false); setFrameIndex(0); setInspectedCandidate(null); setSelectedActor(null); setCandidateFilter('best'); setReport(null);
    api<Scenario>('/scenarios/' + encodeURIComponent(scenarioId), { signal: controller.signal })
      .then(s => { if (version === requestVersion.current) setScenario(s); return post<RunReport>('/runs', { scenario_id: scenarioId, planner: plannerRef.current, config: configRef.current }, controller.signal); })
      .then(r => { if (version === requestVersion.current) setReport(r); })
      .catch(e => { if (e.name !== 'AbortError' && version === requestVersion.current) setError(e.message); })
      .finally(() => { if (version === requestVersion.current) setBusy(false); });
    return () => controller.abort();
  }, [scenarioId]);

  const runPlanner = useCallback(async () => {
    if (!scenarioId) return;
    const version = ++requestVersion.current;
    setBusy(true); setRestoring(false); setError(''); setPlaying(false);
    try {
      const r = await post<RunReport>('/runs', { scenario_id: scenarioId, planner, config });
      if (version === requestVersion.current) { setReport(r); setFrameIndex(0); setInspectedCandidate(null); }
    } catch (e) { if (version === requestVersion.current) setError((e as Error).message); }
    finally { if (version === requestVersion.current) setBusy(false); }
  }, [scenarioId, planner, config]);

  useEffect(() => {
    if (!playing || !report) return;
    const timer = window.setInterval(() => setFrameIndex(i => {
      if (i >= report.frames.length - 1) { setPlaying(false); return i; }
      return i + 1;
    }), (scenario?.dt ?? .1) * 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, report, scenario]);

  const frame = report?.frames[frameIndex];
  const chosenCandidate = frame?.candidates.find(c => c.id === frame.selected_candidate);
  const alternative = frame?.candidates.filter(c => c.feasible && c.id !== frame.selected_candidate).sort((a, b) => a.cost - b.cost)[0];
  const candidateOptions = (frame?.candidates ?? []).filter(c => candidateFilter === 'best' || !c.feasible).sort((a, b) => a.cost - b.cost);
  const candidatePreview = candidateFilter === 'best' && chosenCandidate ? [chosenCandidate, ...candidateOptions.filter(c => c.id !== chosenCandidate.id)] : candidateOptions;
  useEffect(() => setCandidatesExpanded(false), [report?.id, candidateFilter]);
  const candidate = frame?.candidates.find(c => c.id === (inspectedCandidate ?? frame.selected_candidate));
  const runNeedsUpdate = !!report && (report.planner !== planner || !sameSettings(report.config, config));
  const evaluationConfig = evaluation?.results[0]?.baseline.config ?? config;
  const evaluationNeedsUpdate = !!evaluation && !sameSettings(evaluationConfig, config);
  const actor: Vehicle | undefined = selectedActor ? [frame?.ego ?? scenario?.ego, ...(frame?.actors ?? scenario?.actors ?? [])].find(a => a?.id === selectedActor) : undefined;
  const filtered = scenarios.filter(s => (s.name + ' ' + s.tags.join(' ') + ' ' + s.source).toLowerCase().includes(query.toLowerCase()));
  const hasFailures = !!report?.failures.length;
  const seek = (index: number) => { setFrameIndex(Math.max(0, Math.min(report ? report.frames.length - 1 : 0, index))); setPlaying(false); setInspectedCandidate(null); };
  const togglePlay = useCallback(() => {
    if (!report || busy || tab !== 'replay') return;
    if (frameIndex === report.frames.length - 1) setFrameIndex(0);
    setPlaying(p => !p);
  }, [report, busy, tab, frameIndex]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (dialogActive || e.defaultPrevented) return;
      if (e.target instanceof Element && e.target.closest('input,select,textarea,button,summary,a,[role="button"],[contenteditable="true"]')) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.key === '/') { e.preventDefault(); setLibraryOpen(true); requestAnimationFrame(() => searchInput.current?.focus()); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, dialogActive]);

  useEffect(() => {
    if (configOpen) setDraftConfig(configRef.current);
  }, [configOpen]);

  useEffect(() => {
    if (!dialogActive) return;
    const generation = ++dialogGeneration.current;
    const previouslyFocused = dialogOpener.current ?? document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('.motion-presence[data-presence="present"] [role="dialog"]');
    const focus = requestAnimationFrame(() => {
      if (generation === dialogGeneration.current) dialog?.querySelector<HTMLElement>('button, input, select, a')?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setConfigOpen(false); setHelpOpen(false); setHistoryOpen(false); setExportOpen(false); }
      if (e.key !== 'Tab' || !dialog) return;
      const targets = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary')].filter(target => target.getClientRects().length > 0 && !target.closest('[hidden], [inert]'));
      const first = targets[0], last = targets.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(focus);
      window.removeEventListener('keydown', onKey);
      if (generation !== dialogGeneration.current) return;
      const usable = previouslyFocused?.isConnected && previouslyFocused.getClientRects().length > 0 && getComputedStyle(previouslyFocused).visibility !== 'hidden' && previouslyFocused.matches('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]') && !previouslyFocused.closest('[inert],.motion-presence');
      if (usable) previouslyFocused.focus();
      if (!usable || document.activeElement !== previouslyFocused) navigationRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    };
  }, [configOpen, helpOpen, historyOpen, exportOpen, dialogActive]);

  async function compare(all: boolean) {
    setTab('evaluation'); setPlaying(false); setEvaluating(true); setError('');
    try { setEvaluation(await post<Evaluation>('/evaluations', { scenario_ids: all ? scenarios.map(s => s.id) : [scenarioId], config })); }
    catch (e) { setError((e as Error).message); }
    finally { setEvaluating(false); }
  }

  async function showHistory() {
    setHistoryOpen(true); setHistoryLoading(true); setHistoryError('');
    try { setHistory(await api<RunSummary[]>('/runs?limit=100')); } catch (e) { setHistoryError((e as Error).message); }
    finally { setHistoryLoading(false); }
  }

  async function loadRun(id: string) {
    const version = ++requestVersion.current;
    setBusy(true); setRestoring(true); setError(''); setHistoryOpen(false); setPlaying(false); setTab('replay');
    try {
      const r = await api<RunReport>('/runs/' + id);
      const s = await api<Scenario>('/scenarios/' + r.scenario_id);
      if (version === requestVersion.current) {
        if (scenarioId !== r.scenario_id) { pendingRun.current = { report: r, scenario: s }; setScenarioId(r.scenario_id); }
        setScenario(s); setReport(r); setPlanner(r.planner); setConfig(r.config); setFrameIndex(0);
        setInspectedCandidate(null); setSelectedActor(null);
      }
    } catch (e) { if (version === requestVersion.current) setError((e as Error).message); } finally { if (version === requestVersion.current) { setBusy(false); setRestoring(false); } }
  }

  function exportRun() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'drivelab-' + report.scenario_id + '-' + report.planner + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportMessage('Download requested. If no file appears, use Copy full JSON.');
  }

  async function copyReport() {
    if (!report) return;
    try { await navigator.clipboard.writeText(JSON.stringify(report)); setExportMessage('Recorded report copied to clipboard.'); }
    catch { setExportMessage('Clipboard is unavailable. Select the JSON below and copy it manually.'); }
  }

  async function importDataset(e: React.FormEvent) {
    e.preventDefault(); setImporting(true); setImportMessage(''); setError('');
    try {
      const response = await post<{ count?: number; imported?: number; message?: string }>('/datasets/import', { path: datasetPath, limit: importLimit });
      const items = await api<ScenarioSummary[]>('/scenarios'); setScenarios(items); setHealth(await api<Health>('/health'));
      setImportMessage(response.message ?? 'Imported ' + (response.count ?? response.imported ?? items.filter(s => isWaymo(s.source)).length) + ' scenarios. Open the replay workspace to explore them.');
    } catch (e) { setError((e as Error).message); } finally { setImporting(false); }
  }

  async function trainModel() {
    setTraining(true); setError('');
    try { setModel(await post<ForecastStatus>('/model/train', { seed: trainingSeed, epochs })); }
    catch (e) { setError((e as Error).message); }
    finally { setTraining(false); }
  }

  const active = busy || evaluating || training || importing;
  const operation: { state: OperationState; title: string; detail: string; action?: string; onAction?: () => void } = active
    ? { state: 'running', title: training ? 'Training and validating motion' : importing ? 'Reading your local dataset' : evaluating ? 'Comparing both planners' : restoring ? 'Opening a recorded run' : 'Computing the driving run', detail: 'Results appear only after the server returns. Pause applies to recorded playback, not computation.' }
    : error ? { state: 'failed', title: 'The last request failed', detail: 'No new result was verified. Any previous result below remains unchanged.', action: 'Dismiss', onAction: () => setError('') }
    : !health ? { state: 'waiting', title: 'Connecting to the local engine', detail: 'Checking runtime and available scenarios. No result is ready yet.' }
    : tab === 'replay' && runNeedsUpdate ? { state: 'planned', title: 'New settings are ready to run', detail: 'The replay still shows the previous recorded settings. Run the planner to apply your changes.' }
    : tab === 'replay' && report ? { state: 'completed', title: playing ? 'Simulation complete · replay playing' : hasFailures ? 'Run complete with recorded failures' : 'Simulation complete · replay paused', detail: `${report.frames.length} recorded frames. ${isWaymo(report.source) ? 'Imported traffic' : 'Synthetic demonstration'}, not a safety certification.`, ...(playing ? { action: 'Pause playback', onAction: () => setPlaying(false) } : {}) }
    : tab === 'dataset' ? { state: importMessage || health.dataset_count ? 'completed' : 'waiting', title: importMessage ? 'Local import complete' : health.dataset_count ? 'Dataset scenes available' : 'Waiting for a local Waymo shard', detail: importMessage || (health.dataset_count ? `${health.dataset_count} downloaded-data scenes available. Inspect geometry before benchmarking.` : 'Synthetic scenes work now. Add a local TFExample file to test downloaded data.') }
    : tab === 'model' ? { state: modelError ? 'failed' : model?.trained && model.metrics ? 'completed' : 'waiting', title: modelError ? 'Could not read model status' : modelLoading ? 'Checking the model runtime' : model?.trained && model.metrics ? 'Checkpoint and measured validation available' : 'Waiting for a trained checkpoint', detail: modelError || (modelLoading ? 'No model result has been loaded yet.' : model?.trained ? 'Scores below come from held-out synthetic trajectories, not a Waymo benchmark.' : model?.available ? 'Choose a seed and train on synthetic motion to measure prediction error.' : 'PyTorch is unavailable. Run make ml, then reload.') }
    : tab === 'evaluation' ? { state: evaluationNeedsUpdate ? 'planned' : evaluation ? 'completed' : 'planned', title: evaluationNeedsUpdate ? 'New comparison settings are ready' : evaluation ? 'Paired simulation results available' : 'Ready for a first comparison', detail: evaluation ? `${evaluation.results.length} paired ${evaluation.results.length === 1 ? 'scenario' : 'scenarios'}. Each table row opens its recorded run.` : 'Run the library or compare the selected scenario. No comparison has run in this session.' }
    : { state: 'waiting', title: 'Choose a driving scenario', detail: 'Select a scene from the library to compute a replay.' };

  return <div className="app-shell field-lab" onClickCapture={event => {
    const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-dialog-trigger]') : null;
    if (trigger && !trigger.closest('.motion-presence')) dialogOpener.current = trigger;
  }}>
    <header className="app-header" inert={dialogActive}>
      <a className="brand" href="/" aria-label="DriveLab home"><span className="brand-mark"><Route size={21} strokeWidth={2.4} /></span><span>DriveLab<small>A driving decision, made visible.</small></span></a>
      <nav ref={navigationRef} aria-label="Main navigation">
        <NavigationHighlight navigation={navigationRef} selected={tab} />
        <button aria-current={tab === 'replay' ? 'page' : undefined} className={tab === 'replay' ? 'nav-active' : ''} onClick={() => setTab('replay')}><Route size={16} />Replay</button>
        <button aria-current={tab === 'evaluation' ? 'page' : undefined} className={tab === 'evaluation' ? 'nav-active' : ''} onClick={() => { setTab('evaluation'); setPlaying(false); }}><FlaskConical size={16} />Evaluation</button>
        <button aria-current={tab === 'dataset' ? 'page' : undefined} className={tab === 'dataset' ? 'nav-active' : ''} onClick={() => { setTab('dataset'); setPlaying(false); }}><Database size={16} />Dataset</button>
        <button aria-current={tab === 'model' ? 'page' : undefined} className={tab === 'model' ? 'nav-active' : ''} onClick={() => { setTab('model'); setPlaying(false); }}><BrainCircuit size={16} />Model</button>
      </nav>
      <div className="header-end"><button className="icon-button" data-dialog-trigger="history" aria-label="Saved runs" title="Inspect recorded runs" onClick={showHistory}><History size={18} /></button><span className={'connection ' + (health ? '' : 'connection-off')}><i />{health ? 'Local engine online' : 'Connecting…'}</span><button className="sound-toggle" aria-label={sound ? 'Mute interface sounds' : 'Enable interface sounds'} aria-pressed={sound} title="Optional click sounds" onClick={() => { setSound(!sound); try { localStorage.setItem('drivelab-sound', !sound ? 'on' : 'off'); } catch { /* Preference is optional. */ } if (!sound) clickSound(); }}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}<span>Sound {sound ? 'on' : 'off'}</span></button><button className="icon-button" data-dialog-trigger="help" aria-label="Help" onClick={() => setHelpOpen(true)}><CircleHelp size={19} /></button></div>
    </header>
    {error && <div className="error-banner" inert={dialogActive} role="alert"><TriangleAlert size={17} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
    <div className="workspace" inert={dialogActive}>
      <aside className={'sidebar ' + (libraryOpen ? 'library-expanded' : '')}>
        <button className="mobile-library-toggle" aria-label="Scenario library" aria-expanded={libraryOpen} onClick={() => setLibraryOpen(!libraryOpen)}><Layers3 size={18} />{scenario?.name ?? 'Scenario library'}<span>{scenarios.length} scenes</span><ChevronDown size={16} /></button>
        <div className="sidebar-heading"><h2>Scenario library</h2><span>{scenarios.length}</span></div>
        <label className="search-box"><Search size={15} /><input ref={searchInput} aria-label="Search scenarios" placeholder="Search scenes…" value={query} onChange={e => setQuery(e.target.value)} /><kbd>/</kbd></label>
        <div className="library-caption">Choose a driving challenge</div>
        <div className="scenario-list">{filtered.map(s => <button className={'scenario-item ' + (s.id === scenarioId ? 'scenario-active' : '')} key={s.id} data-scenario-id={s.id} onClick={() => { setScenarioId(s.id); setTab('replay'); }} aria-pressed={s.id === scenarioId}>
          <ScenarioThumbnail route={s.route} /><div><strong>{s.name}</strong><span>{s.tags.slice(0, 2).join(' · ') || 'Driving scenario'}</span><small><i className={isWaymo(s.source) ? 'source-real' : ''} />{isWaymo(s.source) ? 'Waymo' : 'Synthetic'}<span>{f(s.duration, 0)}s</span></small></div><ChevronRight className="scenario-arrow" size={15} />
        </button>)}
        {!filtered.length && <div className="empty-library" role="status">{!health ? error ? 'Scenario library unavailable.' : 'Loading scenarios…' : query ? 'No matching scenarios.' : 'No scenarios available.'}{health && query && <button onClick={() => setQuery('')}>Clear search</button>}</div>}</div>
        <div className="sidebar-bottom">
          <div className="library-info"><Layers3 size={18} /><div><strong>{health?.dataset_count ? 'Local dataset connected' : 'Waiting for your dataset'}</strong><p>{health?.dataset_count ? `${health.dataset_count} downloaded-data scenes.` : 'Synthetic scenes are ready. Real-data tests need a local shard.'}</p><button onClick={() => setTab('dataset')}>Connect a dataset<ArrowUpRight size={13} /></button></div></div>
        </div>
      </aside>

      <main ref={mainRef} data-workspace={tab}>
        <OperationStatus {...operation} />
        {tab === 'replay' && <section className="replay-page">
          <div className="page-heading"><div><div className="breadcrumb">Workspace<ChevronRight size={12} />Replay</div><h1>{scenario?.name ?? 'Your driving laboratory'}</h1><p>{scenario?.description ?? 'Select a scenario to inspect your planner in motion.'}</p></div><div className="heading-actions"><button data-dialog-trigger="export" className="button button-secondary" disabled={!report} onClick={() => { setExportMessage(''); setExportOpen(true); }}><ArrowDownToLine size={15} />Export run</button><button className="button button-primary" disabled={busy || !scenario} onClick={runPlanner}>{busy ? <LoaderCircle className="spin" size={16} /> : <Play size={15} fill="currentColor" />}Run planner</button></div></div>
          {runNeedsUpdate && <div className="settings-notice" role="status">Settings changed. Run planner to apply them; the replay below still shows the previous run.</div>}
          {busy && report && <p className="previous-result" role="status">{restoring ? 'Previous result shown while the recorded run loads.' : 'Previous recorded run shown while the new run computes.'}</p>}
          <div className="replay-workbench">
            <div className="replay-column">
            <div className="replay-main">
              {report && <div className="run-receipt"><span><strong>{busy ? 'Previous completed run' : 'Recorded run'} <span title={report.id}>{report.id.slice(0, 8)}</span></strong><small>{plannerName(report.planner)} · {isWaymo(report.source) ? 'Waymo data' : 'Synthetic scene'} · {report.frames.length} frames</small></span><span className="receipt-settings">{f(report.config.target_speed * 3.6)} km/h · {f(report.config.horizon)}s horizon<small className="scoring-provenance">{scoringName(report.scoring_backend)} · {f(report.timing?.total_seconds, 2)}s compute</small></span></div>}
              <div className="scene-toolbar"><div className="planner-select"><Route size={15} /><select aria-label="Planner" value={planner} onChange={e => setPlanner(e.target.value as typeof planner)} disabled={busy}><option value="lattice">Trajectory planner</option><option value="baseline">Route baseline</option></select><ChevronDown size={13} /></div>{(busy || hasFailures || !report) && <span className={'run-status ' + (hasFailures ? 'status-warn' : '')}>{busy ? <><LoaderCircle className="spin" size={12} />{restoring ? 'Opening run…' : 'Computing…'}</> : hasFailures ? <><TriangleAlert size={12} />Failure recorded</> : 'Awaiting result'}</span>}<button className="toolbar-button" aria-label="Configure" data-dialog-trigger="settings" onClick={() => setConfigOpen(true)}><Settings2 size={15} /><span>Configure</span></button><button className="toolbar-button toolbar-compare" aria-label="Compare this scene" title="Compare this scene" onClick={() => compare(false)} disabled={!scenario || busy || evaluating}><ArrowLeftRight size={15} /><span>Compare</span></button></div>
              <div className="playback">
                <div className="scrubber"><input aria-label="Replay timeline" type="range" min="0" max={Math.max(1, (report?.frames.length ?? 1) - 1)} value={frameIndex} onChange={e => seek(Number(e.target.value))} disabled={!report || busy} />
                  {report?.failures.map((failure, i) => <button key={i} className="failure-marker" style={{ left: failure.frame_index / Math.max(1, report.frames.length - 1) * 100 + '%' }} aria-label={'Jump to ' + failure.type + ' at ' + f(failure.time) + ' seconds'} title={failure.message} onClick={() => seek(failure.frame_index)} />)}
                </div>
                <div className="playback-row"><div className="transport"><button aria-label="Restart replay" onClick={() => seek(0)} disabled={!report}><RotateCcw size={15} /></button><button aria-label="Previous frame" onClick={() => seek(frameIndex - 1)} disabled={!report}><ChevronLeft size={19} /></button><button className="play-button" aria-label={playing ? 'Pause replay' : 'Play replay'} onClick={togglePlay} disabled={!report || busy}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}<span>{playing ? 'Pause' : 'Play'}</span></button><button aria-label="Next frame" onClick={() => seek(frameIndex + 1)} disabled={!report}><ChevronRight size={19} /></button><span className="time-display"><strong>{f(frame?.time, 1)}s</strong> / {f(report?.frames.at(-1)?.time, 1)}s</span></div><div className="playback-right"><select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select><span className="frame-count">Frame {report ? frameIndex + 1 : 0} / {report?.frames.length ?? 0}</span></div></div>
              </div>
              {scenario ? <Scene key={scenario.id} scenario={scenario} frame={frame} playbackActive={playing} showCandidates={showCandidates} showRoute={showRoute} showForecasts={showForecasts} inspectedCandidate={inspectedCandidate} selectedActor={selectedActor} onActor={id => { setSelectedActor(id); setDetailsOpen(true); }} busy={busy} busyLabel={restoring ? 'Opening recorded frames…' : undefined} /> : <div className="scene-placeholder"><LoaderCircle className="spin" size={25} /><p>Loading the road scene…</p></div>}
              <div className="scene-footer"><label><input type="checkbox" checked={showCandidates} onChange={e => setShowCandidates(e.target.checked)} />Candidate paths</label><label><input type="checkbox" checked={showRoute} onChange={e => setShowRoute(e.target.checked)} />Reference route</label><label><input type="checkbox" checked={showForecasts} disabled={!report || report.frames[0]?.actor_forecasts === undefined} onChange={e => setShowForecasts(e.target.checked)} />Traffic forecasts</label><span>{report?.engine ?? 'Simulation engine'}<i />{report ? plannerName(report.planner) : 'Awaiting run'}</span></div>
              <div className="mobile-decision"><small>Selected decision · {f(frame?.time)} s</small><strong>{chosenCandidate ? chosenCandidate.acceleration < -.5 ? 'Slow down' : Math.abs(chosenCandidate.offset) > .5 ? 'Adjust position' : 'Follow the route' : report ? 'Route following' : 'Awaiting a recorded decision'}</strong><span>{chosenCandidate ? `Path ${Number(chosenCandidate.id.split('-').at(-1)) + 1} · ${report?.planner === 'baseline' ? 'route baseline' : chosenCandidate.feasible ? 'feasible' : 'emergency selection'} · cost ${f(chosenCandidate.cost, 2)}` : 'Inspect the decision and measured state below.'}</span><span className="instant-evidence">Nearest actor: {frame ? frame.actors.length ? `${f(frame.metrics.clearance)} m` : 'clear' : '—'} · Ego: {frame ? f(frame.ego.speed * 3.6) : '—'} km/h</span><button onClick={() => { setDetailsOpen(true); const inspector = document.getElementById('decision-inspector'); inspector?.scrollIntoView({ behavior: motion.reduced ? 'auto' : 'smooth', block: 'start' }); inspector?.focus({ preventScroll: true }); }}>Inspect decision<ChevronRight size={14} /></button></div>
              <div className="frame-telemetry"><span>At this instant<strong>{f(frame?.time)} s</strong></span><span>Ego speed<strong>{frame ? f(frame.ego.speed * 3.6) : '—'} km/h</strong></span><span>Nearest actor<strong>{frame ? frame.actors.length ? frame.metrics.clearance >= 100 ? '≥100 m' : f(frame.metrics.clearance) + ' m' : 'Clear' : '—'}</strong></span><span>Acceleration<strong>{f(frame?.metrics.acceleration)} m/s²</strong></span></div>
            </div>
            <RunMetrics report={report} />
            </div>
            <aside id="decision-inspector" tabIndex={-1} className={'inspector ' + (detailsOpen ? 'details-open' : '')}>
              <button className="mobile-details-toggle" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(!detailsOpen)}>Decision details<ChevronDown size={16} /></button>
              <div className="inspector-heading"><h2>Decision inspector</h2><span>t = {f(frame?.time)}s</span></div>
              <div className="decision-summary"><span className="decision-icon"><Route size={19} /></span><div><strong>{chosenCandidate ? chosenCandidate.acceleration < -.5 ? 'Slow down' : Math.abs(chosenCandidate.offset) > .5 ? 'Adjust position' : 'Follow the route' : 'Route following'}</strong><span>{report?.planner === 'baseline' ? 'Route following without candidate search.' : chosenCandidate ? chosenCandidate.feasible ? 'Lowest-cost feasible path at this instant.' : 'Emergency selection: no feasible path.' : report ? 'Route following without candidate search.' : 'Awaiting a recorded decision.'}</span><details className="planner-explanation"><summary>Read planner explanation</summary><p>{frame?.explanation ?? 'Run a planner to inspect its decisions.'}</p></details></div></div>
              <div className="inspector-section"><div className="section-heading"><h3>{inspectedCandidate ? 'Inspected candidate' : 'Selected trajectory'}</h3>{candidate && <span className={'pill ' + (!candidate.feasible ? 'pill-warn' : '')}>{candidate.feasible ? 'Feasible' : 'Rejected'}</span>}</div>
                {candidate ? <><div className="candidate-stat"><span>Total cost · lower is better</span><strong>{f(candidate.cost, 3)}</strong></div><p className="score-explanation">Weighted contributions below. Negative progress rewards forward motion; bar lengths show magnitude, not probability.</p><CandidateCosts candidate={candidate} />{!inspectedCandidate && chosenCandidate && alternative && <p className="alternative-explanation">{Math.abs(alternative.cost - chosenCandidate.cost) < .0005 ? `Costs equal at 0.001 precision. Path ${Number(alternative.id.split('-').at(-1)) + 1} is a near tie, not a meaningful win.` : `${f(alternative.cost - chosenCandidate.cost, 3)} lower cost than the next feasible path (${Number(alternative.id.split('-').at(-1)) + 1}).`}</p>}<div className="candidate-meta"><span>Acceleration<strong>{f(candidate.acceleration)} m/s²</strong></span><span>Lateral offset<strong>{f(candidate.offset)} m</strong></span></div></> : <p className="muted-copy">{!report ? 'Awaiting a recorded decision.' : 'The baseline follows the route at its target speed. Choose the trajectory planner to inspect candidate costs.'}</p>}
              </div>
              {actor && <div className="inspector-section actor-inspector"><div className="section-heading"><h3>{actor.id === frame?.ego.id ? 'Ego vehicle' : 'Actor ' + actor.id}</h3><button className="icon-button" aria-label="Clear actor selection" onClick={() => setSelectedActor(null)}><X size={13} /></button></div><div className="candidate-meta"><span>Speed<strong>{f(actor.speed * 3.6)} km/h</strong></span><span>Position<strong>{f(actor.x)}, {f(actor.y)} m</strong></span></div></div>}
              <div className="inspector-section candidate-section"><div className="section-heading"><h3>Candidate paths</h3><span className="count-pill">{frame?.candidates.length ?? 0}</span></div><div className="candidate-filters"><button aria-pressed={candidateFilter === 'best'} onClick={() => setCandidateFilter('best')}>Top candidates</button><button aria-pressed={candidateFilter === 'rejected'} onClick={() => setCandidateFilter('rejected')}>Rejected</button></div><div className="candidate-list">{candidatePreview.slice(0, candidatesExpanded ? candidatePreview.length : 3).map(c => <button key={c.id} className={'candidate-item ' + ((inspectedCandidate ?? frame?.selected_candidate) === c.id ? 'candidate-active' : '')} onClick={() => setInspectedCandidate(c.id === frame?.selected_candidate ? null : c.id)}><span className={'candidate-dot ' + (!c.feasible ? 'dot-risk' : '')} /><span>Path {Number(c.id.split('-').at(-1)) + 1}<small>{!c.feasible ? c.offroad_cost > 0 ? 'Rejected · road departure' : 'Rejected · safety overlap' : `${c.acceleration >= 0 ? '+' : ''}${f(c.acceleration)} m/s² · ${f(c.offset)} m`}</small></span><strong>{f(c.cost, 3)}{chosenCandidate && c.id !== chosenCandidate.id && <small className="cost-delta">{Math.abs(c.cost - chosenCandidate.cost) < .0005 ? 'Near tie' : `Δ ${c.cost > chosenCandidate.cost ? '+' : ''}${f(c.cost - chosenCandidate.cost, 3)}`}</small>}</strong>{c.id === frame?.selected_candidate && <Check size={13} />}</button>)}
              {candidateFilter === 'rejected' && frame?.candidates.length && !frame.candidates.some(c => !c.feasible) ? <p className="muted-copy">All paths satisfy this step’s overlap and road checks.</p> : null}
              {!frame?.candidates.length && <p className="muted-copy">{report ? 'No candidate search in the baseline.' : 'Candidate results are not ready yet.'}</p>}</div>{candidatePreview.length > 3 && <button className="candidate-expand" aria-expanded={candidatesExpanded} onClick={() => setCandidatesExpanded(!candidatesExpanded)}>{candidatesExpanded ? 'Show fewer paths' : `Show all ${candidatePreview.length} paths`}<ChevronDown size={14} /></button>}</div>
              <button className="compare-button" onClick={() => compare(false)} disabled={!scenario || busy || evaluating}><ArrowLeftRight size={16} />Compare planners<ArrowUpRight size={14} /></button>
            </aside>
          </div>
          <div className="run-notes"><div><Clock3 size={16} /><span>{report ? 'Completed at ' + new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Preparing run'}<small>{scenario && isWaymo(scenario.source) ? 'Recorded traffic replays while the ego replans.' : 'Deterministic synthetic traffic; these are demonstration results.'}</small>{report && <small className="planning-provenance">Planning backend: {report.engine}</small>}{report?.timing && <small className="run-timing" title="Local wall-clock measurements. Decision time excludes forecast inference and simulation stepping; not a real-time safety guarantee.">Computed in {f(report.timing.total_seconds, 2)} s; planning {f(report.timing.mean_decision_ms, 2)} ms/decision</small>}</span></div>{hasFailures ? <button className="failure-jump" onClick={() => seek(report!.failures[0].frame_index)}><TriangleAlert size={14} />Inspect first failure<ChevronRight size={14} /></button> : <span className="run-note-status">{report && <><BookOpen size={14} />No recorded collision or road departure</>}</span>}</div>
        </section>}

        {tab === 'evaluation' && <div className="evaluation-page">
          <div className="page-heading"><div><div className="breadcrumb">Workspace<ChevronRight size={12} />Evaluation</div><h1>Put your planner to the test.</h1><p>{`Compare both planners across ${scenarios.length} available scenes using shared settings.`}</p></div><button className="button button-primary" disabled={evaluating || !scenarios.length} onClick={() => compare(true)}>{evaluating ? <LoaderCircle size={16} className="spin" /> : <FlaskConical size={16} />}Evaluate library</button></div>
          <details className="evaluation-context" open={evaluation ? undefined : true}><summary>Test method &amp; shared settings</summary><div className="evaluation-intro"><div><FlaskConical size={25} /><h2>Route baseline vs. trajectory planner.</h2><p>Both planners start with the same state. The trajectory planner observes current traffic and predicts its motion; recorded future positions stay inside the simulation.</p></div><div className="evaluation-settings"><span>Target speed<strong>{f(evaluationConfig.target_speed * 3.6)} km/h</strong></span><span>Safety margin<strong>{f(evaluationConfig.safety_margin)} m</strong></span><span>Planning horizon<strong>{f(evaluationConfig.horizon)} s</strong></span><span>Traffic forecast<strong>{evaluationConfig.prediction === 'learned' ? 'Learned residuals' : 'Constant velocity'}</strong></span><span>Trajectory scoring<strong>{evaluation ? scoringName(evaluation.results[0]?.baseline.scoring_backend) : (config.scoring ?? 'auto') === 'auto' ? 'Automatic' : scoringName(config.scoring)}</strong></span><button data-dialog-trigger="settings" onClick={() => setConfigOpen(true)}><Settings2 size={14} />Adjust settings</button></div></div></details>
          {evaluationNeedsUpdate && <div className="settings-notice" role="status">Settings changed. Evaluate again to apply them; the results below retain their original settings.</div>}
          {evaluating && <div className="evaluation-loading"><LoaderCircle className="spin" size={22} /><div><strong>Running paired simulations…</strong><span>Metrics will appear when every selected scene has finished.</span></div></div>}
          {evaluating && evaluation && <p className="previous-result">Previous completed comparison shown below. New results are still running.</p>}
          {evaluation ? <>
            <div className="evaluation-aggregates">{([
              ['Collision rate', 'collision_rate', 100, '%'],
              ['Off-road rate', 'offroad_rate', 100, '%'],
              ['Mean progress', 'progress', 100, '%'],
              ['Mean peak jerk', 'max_jerk', 1, 'm/s³'],
            ] as const).map(([label, key, multiplier, unit]) => {
              const delta = (evaluation.summary.lattice[key] - evaluation.summary.baseline[key]) * multiplier;
              const unchanged = Math.abs(delta) < .05;
              const improved = key === 'progress' ? delta > 0 : delta < 0;
              return <div key={key}><span>{label}<small className="metric-direction">{key === 'progress' ? 'Higher is better' : 'Lower is better'}</small></span><div><small>Baseline</small><strong>{f(evaluation.summary.baseline[key] * multiplier, key === 'max_jerk' ? 1 : 0)}<em>{unit}</em></strong></div><div><small>Planner</small><strong>{f(evaluation.summary.lattice[key] * multiplier, key === 'max_jerk' ? 1 : 0)}<em>{unit}</em></strong></div><p className={'evaluation-delta ' + (unchanged ? '' : improved ? 'delta-improved' : 'delta-regressed')}>{unchanged ? 'No change at this precision' : `${delta > 0 ? '+' : ''}${f(delta, 1)} ${unit === '%' ? 'pp' : unit} · ${improved ? 'improved' : 'regressed'}`}</p></div>;
            })}</div>
            <div className="evaluation-title"><h2>Paired results</h2><span>{evaluation.results.length} {evaluation.results.length === 1 ? 'scenario' : 'scenarios'} · {evaluation.results.some(r => isWaymo(r.baseline.source)) ? 'Includes imported dataset scenes' : 'Synthetic demonstration suite'}</span></div>
            <div className="comparison-table-wrap"><table className="comparison-table" role="table" aria-label="Recorded planner comparison"><thead><tr><th scope="col">Scenario</th><th scope="col">Planner</th><th scope="col">Collision</th><th scope="col">Off-road</th><th scope="col">Progress</th><th scope="col">Peak jerk</th><th scope="col"><span className="sr-only">Inspect</span></th></tr></thead><tbody>{evaluation.results.map(result => [result.baseline, result.lattice].map((r, i) => <tr key={r.id} className={i ? 'paired-row' : ''} role="row"><td className="comparison-scene" role="cell"><strong>{scenarios.find(s => s.id === result.scenario_id)?.name ?? result.scenario_id}</strong><small>{isWaymo(r.source) ? 'Waymo' : 'Synthetic'}</small></td><td className="comparison-planner" role="cell">{plannerName(r.planner)}</td><td data-label="Collision" role="cell"><span className={'table-status ' + (r.metrics.collision ? 'table-fail' : '')}>{r.metrics.collision ? 'Detected' : 'None'}</span></td><td data-label="Off-road" role="cell">{r.metrics.offroad ? 'Yes' : 'No'}</td><td data-label="Progress" role="cell">{f(r.metrics.progress * 100, 0)}%</td><td data-label="Peak jerk" role="cell">{f(r.metrics.max_jerk)} m/s³</td><td className="comparison-action" role="cell"><button className="text-button" aria-label={'Replay ' + (scenarios.find(s => s.id === result.scenario_id)?.name ?? result.scenario_id) + ' · ' + plannerName(r.planner)} onClick={() => loadRun(r.id)}>Replay<ArrowUpRight size={13} /></button></td></tr>))}</tbody></table></div>
            <p className="evaluation-footnote">Results describe this selected scenario set. Logged surrounding actors do not react to the ego vehicle. Collision and comfort outcomes are measured per run.</p>
          </> : !evaluating && <div className="empty-state"><ArrowLeftRight size={35} /><h2>No comparison recorded yet.</h2><p>Use Evaluate library to compare route following with candidate search. Results may improve or regress; every row opens its recorded replay.</p></div>}
        </div>}

        {tab === 'dataset' && <div className="dataset-page">
          <div className="page-heading"><div><div className="breadcrumb">Workspace<ChevronRight size={12} />Dataset</div><h1>Bring real traffic into the lab.</h1><p>Import a local Waymo Open Motion TFRecord shard.</p></div><span className="dataset-count"><Database size={16} />{scenarios.filter(s => isWaymo(s.source)).length} imported scenes</span></div>
          <div className="dataset-layout"><section className="dataset-form-panel"><span className="dataset-illustration"><Database size={31} /></span><h2>Import a local shard</h2><p>DriveLab reads the shard on this computer and adds its scenes to your library. Start with a few scenarios before running a larger comparison.</p><form onSubmit={importDataset}><label htmlFor="dataset-path">Local TFRecord path</label><input id="dataset-path" value={datasetPath} onChange={e => setDatasetPath(e.target.value)} placeholder="/path/to/validation.tfrecord" required /><label htmlFor="import-limit">Scenarios to import</label><select id="import-limit" value={importLimit} onChange={e => setImportLimit(Number(e.target.value))}><option value="1">1 scenario</option><option value="5">5 scenarios</option><option value="10">10 scenarios</option><option value="20">20 scenarios</option></select><button className="button button-primary" disabled={importing || !datasetPath.trim()}>{importing ? <LoaderCircle size={16} className="spin" /> : <Database size={16} />}{importing ? 'Reading scenarios…' : 'Import scenarios'}</button></form>{importMessage && <div className="import-success" role="status"><Check size={17} /><span>{importMessage}</span></div>}</section>
            <aside className="dataset-guide"><figure className="lab-art"><img src="/art/noir-road-concept.png" alt="Original ivory etching of a research car following a cyan trajectory on a winding road" width="1536" height="1024" /><figcaption>Original AI-generated concept illustration. Not dataset output.</figcaption></figure><BookOpen size={23} /><h2>Before you import</h2><ol><li><strong>Get the Motion Dataset</strong><p>Use a TFExample shard from the Waymo Open Motion Dataset. Camera and LiDAR perception shards use a different format.</p></li><li><strong>Keep the file local</strong><p>Download a small validation shard and paste its full path. The importer reads the file without moving it.</p></li><li><strong>Inspect before benchmarking</strong><p>Check the extracted road geometry and route. Compare both planners on the same scenes.</p></li></ol><a href="https://waymo.com/open/data/motion/" target="_blank" rel="noreferrer">Waymo Motion Dataset<ArrowUpRight size={14} /></a><div className="engine-status"><i className={health?.waymax_available ? 'online' : ''} /><span>{health?.waymax_available ? 'Waymax runtime available' : 'Waymax dependencies need setup'}<small>{health?.waymax_available ? 'Ready to decode and simulate dataset scenes.' : 'See README for the dataset environment setup.'}</small></span></div></aside></div>
        </div>}
        {tab === 'model' && <div className="model-page">
          <div className="page-heading"><div><div className="breadcrumb">Workspace<ChevronRight size={12} />Model</div><h1>Predict the traffic ahead.</h1><p>Train a small motion model, measure its error, then use it inside the planner.</p></div><span className="dataset-count"><BrainCircuit size={16} />{training && model?.trained ? 'Previous checkpoint shown' : model?.trained ? 'Checkpoint ready' : 'No trained checkpoint'}</span></div>
          <div className="model-layout" data-checkpoint={model?.trained ? 'ready' : 'waiting'}><section className="model-training-panel"><span className="dataset-illustration"><BrainCircuit size={31} /></span><h2>Learn the residual motion</h2><p>A compact PyTorch network predicts how observed acceleration and turning change an actor’s future path relative to constant velocity. The planner receives only the actor’s current and past states.</p><h3 className="next-run-label">Next training run</h3><div className="model-training-settings"><label>Random seed<input aria-label="Training seed" type="number" min="0" max="100000" value={trainingSeed} onChange={e => setTrainingSeed(Number(e.target.value))} /></label><label>Training epochs<select aria-label="Training epochs" value={epochs} onChange={e => setEpochs(Number(e.target.value))}><option value="40">40 epochs</option><option value="80">80 epochs</option><option value="120">120 epochs</option></select></label></div><button className="button button-primary" disabled={training || !model?.available} onClick={trainModel}>{training ? <LoaderCircle className="spin" size={16} /> : <BrainCircuit size={16} />}{training ? 'Training and evaluating…' : 'Train on synthetic motion'}</button><p className="model-provenance">Synthetic accelerated and turning trajectories. Entire trajectories are held out for validation. These scores describe the generated test distribution.</p>{!modelLoading && !modelError && !model?.available && <div className="model-setup">Install PyTorch with <code>make ml</code>, then reload the app.</div>}</section>
            <section className="model-results-panel"><div className="section-heading"><h2>Held-out prediction error</h2><span className="pill">Synthetic validation</span></div>{model?.trained && <div className="checkpoint-receipt"><strong>{training ? 'Previous checkpoint' : 'Recorded checkpoint'}</strong><span>Seed {model.seed} · {model.epochs} epochs · synthetic validation</span></div>}<p>Lower is better. Errors are measured in meters against the held-out trajectories.</p>{model?.trained && model.metrics ? <><div className="model-error-table"><div><span /><strong>Constant velocity</strong><strong>Learned model</strong></div>{([['Mean displacement', 'baseline_ade', 'learned_ade'], ['Final displacement', 'baseline_fde', 'learned_fde']] as const).map(([label, baseline, learned]) => <div key={baseline}><span>{label}</span><strong>{f(model.metrics![baseline], 2)} m</strong><strong className="learned-score">{f(model.metrics![learned], 2)} m</strong></div>)}</div><div className="model-facts"><span>Training trajectories<strong>{model.train_trajectories}</strong></span><span>Validation trajectories<strong>{model.validation_trajectories}</strong></span><span>Forecast horizon<strong>{model.horizon_seconds} seconds</strong></span><span>Seed / epochs<strong>{model.seed} / {model.epochs}</strong></span></div><button className="button button-secondary" onClick={() => { setConfig({ ...config, prediction: 'learned' }); setTab('replay'); }}>Use learned forecasting<ArrowUpRight size={14} /></button></> : <div className="model-empty" role="status"><BrainCircuit size={30} /><span>{modelLoading ? 'Checking model status…' : modelError ? 'Model status unavailable. Reload to retry.' : 'Train the model to see measured validation scores.'}</span></div>}</section>
          </div><p className="evaluation-footnote">A lower forecast error does not guarantee a safer planner. Compare complete driving runs to measure collision, progress, and comfort outcomes under either forecast.</p>
        </div>}
      </main>
    </div>
    <MotionPresence show={exportOpen && !!report}>{report && <div className="modal-backdrop" onClick={() => setExportOpen(false)}><section className="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><h2 id="export-title">Recorded run JSON</h2><button className="icon-button" aria-label="Close report" onClick={() => setExportOpen(false)}><X size={18} /></button></div><div className="export-body"><p>Run {report.id} · {report.frames.length} frames. Summary below; the complete report includes every decision and trajectory. If your browser does not download, copy the full report.</p><textarea aria-label="Recorded report summary JSON" readOnly value={JSON.stringify({ id: report.id, scenario_id: report.scenario_id, source: report.source, planner: report.planner, config: report.config, metrics: report.metrics, timing: report.timing, scoring_backend: report.scoring_backend, recorded_frames: report.frames.length, failures: report.failures.slice(0, 10), failure_count: report.failures.length }, null, 2)} spellCheck={false} /><p className="export-message" role="status">{exportMessage}</p></div><div className="modal-actions"><button className="button button-secondary" onClick={copyReport}>Copy full JSON</button><button className="button button-primary" onClick={exportRun}><ArrowDownToLine size={16} />Download full JSON</button></div></section></div>}</MotionPresence>
    <MotionPresence show={configOpen}><div className="modal-backdrop" onClick={() => setConfigOpen(false)}><section className="modal config-modal" role="dialog" aria-modal="true" aria-labelledby="config-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><Settings2 size={20} /><h2 id="config-title">Planner settings</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => setConfigOpen(false)}><X size={18} /></button></div><div className="config-body"><p>Apply these settings to your next run or comparison.</p>
      <label className="slider-label">Target speed<strong>{f(draftConfig.target_speed * 3.6)} km/h</strong><input aria-label="Target speed" type="range" min="2" max="16" step=".5" value={draftConfig.target_speed} onChange={e => setDraftConfig({ ...draftConfig, target_speed: Number(e.target.value) })} /><small className="slider-range">7.2–57.6 km/h · 1.8 km/h steps</small></label>
      <label className="slider-label">Safety margin<strong>{f(draftConfig.safety_margin)} m</strong><input aria-label="Safety margin" type="range" min="0" max="3" step=".25" value={draftConfig.safety_margin} onChange={e => setDraftConfig({ ...draftConfig, safety_margin: Number(e.target.value) })} /><small className="slider-range">0–3 meters · 0.25 m steps</small></label>
      <label className="slider-label">Planning horizon<strong>{f(draftConfig.horizon)} seconds</strong><input aria-label="Planning horizon" type="range" min="1" max="5" step=".5" value={draftConfig.horizon} onChange={e => setDraftConfig({ ...draftConfig, horizon: Number(e.target.value) })} /><small className="slider-range">1–5 seconds · 0.5 s steps</small></label>
      <label className="forecast-label">Traffic forecasting<select aria-label="Traffic forecasting" value={draftConfig.prediction ?? 'constant_velocity'} onChange={e => setDraftConfig({ ...draftConfig, prediction: e.target.value as 'learned' | 'constant_velocity' })}><option value="constant_velocity">Constant velocity</option><option value="learned" disabled={!model?.trained}>Learned motion model{model?.trained ? '' : ' (train first)'}</option></select></label>
      <label className="forecast-label">Trajectory scoring<select aria-label="Trajectory scoring" value={draftConfig.scoring ?? 'auto'} onChange={e => setDraftConfig({ ...draftConfig, scoring: e.target.value as 'auto' | 'numpy' | 'rust' })}><option value="auto">Automatic{health ? health.native_available ? ' (Rust available)' : ' (NumPy fallback)' : ''}</option><option value="numpy">Python / NumPy</option><option value="rust" disabled={!health?.native_available}>Rust native{health?.native_available ? '' : ' (run make native)'}</option></select><small>Only collision and clearance scoring changes. Road checks and planning rules stay the same.</small></label>
      </div><div className="modal-actions"><button className="button button-secondary" onClick={() => setDraftConfig(defaults)}>Reset defaults</button><button className="button button-primary" onClick={() => { setConfig(draftConfig); setConfigOpen(false); }}>Apply settings</button></div></section></div></MotionPresence>
    <MotionPresence show={helpOpen}><div className="modal-backdrop" onClick={() => setHelpOpen(false)}><section className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}>
      <div className="modal-heading"><h2 id="help-title">Help & preferences</h2><button className="icon-button" aria-label="Close help" onClick={() => setHelpOpen(false)}><X size={18} /></button></div>
      <label className="motion-preference"><span><strong>Interface motion</strong><small>{motion.systemReduced ? 'System: reduced motion. Full motion is a session preview.' : 'System: full motion. Reduce motion is remembered.'}</small></span><select aria-label="Interface motion" value={motion.preference} onChange={e => motion.setPreference(e.target.value as 'auto' | 'full' | 'reduced')}><option value="auto">Follow system</option><option value="full">Full motion</option><option value="reduced">Reduce motion</option></select></label>
      <p className="motion-scope">Affects interface animation; replay playback is controlled separately.</p>
      <details className="help-instructions"><summary>How to use DriveLab</summary><p>Choose a scene, configure the planner, and run it. Use the timeline to inspect any instant.</p><ul><li><strong>Space</strong> plays or pauses the replay.</li><li><strong>Click a car</strong> to see its speed and position.</li><li><strong>Select a candidate</strong> to inspect its cost and path.</li><li><strong>Compare planners</strong> evaluates both from the same initial state.</li><li><strong>Export run</strong> saves the complete measured report as JSON.</li></ul><p className="muted-copy">Surrounding vehicles replay scripted or recorded motion. The ego vehicle replans from current observations at each step.</p></details>
    </section></div></MotionPresence>
    <MotionPresence show={historyOpen}><div className="modal-backdrop" onClick={() => setHistoryOpen(false)}><section className="modal history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><h2 id="history-title">Saved runs</h2><button className="icon-button" aria-label="Close saved runs" onClick={() => setHistoryOpen(false)}><X size={18} /></button></div><div className="history-list">{historyLoading ? <p role="status">Loading recorded runs…</p> : historyError ? <div role="alert"><p>{historyError}</p><button className="button button-secondary" onClick={showHistory}>Retry saved runs</button></div> : <>{history.map(r => <button key={r.id} onClick={() => loadRun(r.id)}><span><strong>{scenarios.find(s => s.id === r.scenario_id)?.name ?? r.scenario_id}</strong><small>{plannerName(r.planner)} · {new Date(r.created_at).toLocaleString()}</small></span><span className={r.metrics.collision ? 'history-fail' : 'history-pass'}>{r.metrics.collision ? 'Collision' : 'No collision'}</span><ChevronRight size={16} /></button>)}{!history.length && <p>No saved runs yet. Run a planner to create one.</p>}</>}</div></section></div></MotionPresence>
  </div>;
}
