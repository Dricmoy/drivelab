import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { highlightFrames, resolveReducedMotion } from './motionMath';

type MotionPreference = 'auto' | 'full' | 'reduced';
const MotionContext = createContext({ reduced: false, preference: 'auto' as MotionPreference, systemReduced: false, setPreference: (_value: MotionPreference) => {} });
const easeOut = 'cubic-bezier(.16,1,.3,1)';

export function MotionProvider({ children }: { children: ReactNode }) {
  const [preference, updatePreference] = useState<MotionPreference>(() => {
    try { return localStorage.getItem('drivelab-motion') === 'reduced' ? 'reduced' : 'auto'; } catch { return 'auto'; }
  });
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reduced = resolveReducedMotion(preference, systemReduced);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setSystemReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
    document.documentElement.dataset.motionPreference = preference;
    if (reduced) document.getAnimations().filter(animation => animation.id.startsWith('lab-')).forEach(animation => animation.cancel());
  }, [reduced, preference]);
  const setPreference = (next: MotionPreference) => {
    updatePreference(next);
    try { if (next === 'full') localStorage.removeItem('drivelab-motion'); else localStorage.setItem('drivelab-motion', next); } catch { /* Motion remains available without storage. */ }
  };
  return <MotionContext.Provider value={{ reduced, preference, systemReduced, setPreference }}>{children}</MotionContext.Provider>;
}

export const useReducedMotion = () => useContext(MotionContext).reduced;
export const useMotionSettings = () => useContext(MotionContext);

let traceVersion = 0;
function traceMotion(element: Element, animation: Animation) {
  const token = String(++traceVersion);
  element.setAttribute('data-motion-token', token);
  const samples: { time: number; elapsed: number | null; playState: string; transform: string; opacity: string; width: string }[] = [];
  let request = 0, last = -Infinity;
  const sample = () => {
    const style = getComputedStyle(element);
    samples.push({ time: performance.now(), elapsed: animation.currentTime === null ? null : Number(animation.currentTime), playState: animation.playState, transform: style.transform, opacity: style.opacity, width: style.width });
    element.setAttribute('data-motion-samples', JSON.stringify(samples.slice(-10)));
  };
  const step = () => {
    if (element.getAttribute('data-motion-token') !== token) return;
    element.setAttribute('data-motion-phase', animation.playState === 'running' || animation.pending ? 'animating' : animation.playState);
    if (Number(animation.currentTime) - last >= 45) { last = Number(animation.currentTime); sample(); }
    if (animation.playState === 'running' || animation.pending) request = requestAnimationFrame(step);
  };
  const finish = (outcome: 'finished' | 'cancelled') => {
    cancelAnimationFrame(request);
    if (element.getAttribute('data-motion-token') !== token) return;
    sample(); element.setAttribute('data-motion-phase', outcome);
  };
  element.setAttribute('data-motion-effect', animation.id);
  sample(); request = requestAnimationFrame(step);
  animation.finished.then(() => finish('finished')).catch(() => finish('cancelled'));
  return animation;
}

function animate(element: Element, frames: Keyframe[], id: string, duration = 260, delay = 0, fill: FillMode = 'backwards') {
  return traceMotion(element, element.animate(frames, { id: 'lab-' + id, duration, delay, easing: easeOut, fill }));
}

export function usePageMotion(ref: RefObject<HTMLElement | null>, page: string) {
  const reduced = useReducedMotion();
  const previous = useRef(page);
  useLayoutEffect(() => {
    const changed = previous.current !== page;
    const order = ['replay', 'evaluation', 'dataset', 'model'];
    const direction = order.indexOf(page) >= order.indexOf(previous.current) ? 1 : -1;
    previous.current = page;
    if (!changed || reduced) return;
    const content = ref.current?.querySelector('.replay-page,.evaluation-page,.dataset-page,.model-page');
    if (!content) return;
    const animation = animate(content, [{ opacity: .55, transform: `translateX(${direction * 12}px)` }, { opacity: 1, transform: 'translateX(0)' }], 'workspace-' + page, 280);
    return () => animation.cancel();
  }, [page, reduced, ref]);
}

export function useArrival(ref: RefObject<HTMLElement | null>, key: string | null | undefined, selector: string) {
  const reduced = useReducedMotion();
  const previous = useRef(key);
  useLayoutEffect(() => {
    const changed = previous.current !== key;
    previous.current = key;
    if (!changed || !key || reduced) return;
    const element = ref.current?.querySelector(selector);
    if (!element) return;
    const animation = animate(element, [{ opacity: .55, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], 'arrival', 240);
    return () => animation.cancel();
  }, [key, reduced, ref, selector]);
}

export function useStatusMotion(ref: RefObject<HTMLElement | null>, state: string) {
  const reduced = useReducedMotion();
  const previous = useRef(state);
  useLayoutEffect(() => {
    const changed = previous.current !== state;
    previous.current = state;
    if (!changed || reduced || !ref.current) return;
    const icon = ref.current.querySelector('.operation-symbol');
    const copy = ref.current.querySelector('.operation-copy');
    const animations = [icon && animate(icon, [{ transform: 'scale(.86)' }, { transform: 'scale(1.04)', offset: .65 }, { transform: 'scale(1)' }], 'activity-icon', 300), copy && animate(copy, [{ opacity: .7 }, { opacity: 1 }], 'activity-copy', 200)].filter((value): value is Animation => !!value);
    return () => animations.forEach(animation => animation.cancel());
  }, [state, reduced, ref]);
}

export function NavigationHighlight({ navigation, selected }: { navigation: RefObject<HTMLElement | null>; selected: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const ready = useRef(false);
  const animation = useRef<Animation | null>(null);
  useEffect(() => () => animation.current?.cancel(), []);
  // The parent navigation ref attaches after this child's layout effects.
  // Measure after the entire commit, retaining the static selected style until ready.
  useEffect(() => {
    const nav = navigation.current, highlight = ref.current;
    if (!nav || !highlight) return;
    const position = (allowMotion: boolean) => {
      const button = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!button) return;
      const bounds = nav.getBoundingClientRect(), target = button.getBoundingClientRect(), current = highlight.getBoundingClientRect();
      const destination = { x: target.left - bounds.left, width: target.width };
      const origin = { x: current.left - bounds.left, width: current.width };
      animation.current?.cancel();
      highlight.style.width = destination.width + 'px';
      highlight.style.height = target.height + 'px';
      highlight.style.top = target.top - bounds.top + 'px';
      highlight.style.transform = `translateX(${destination.x}px)`;
      highlight.style.opacity = '1';
      nav.dataset.highlightReady = 'true';
      if (ready.current && allowMotion && !reduced) animation.current = traceMotion(highlight, highlight.animate(highlightFrames(origin, destination), { id: 'lab-navigation', duration: 420, easing: 'linear' }));
      ready.current = true;
    };
    position(true);
    let width = nav.clientWidth, height = nav.clientHeight;
    const observer = new ResizeObserver(() => {
      if (nav.clientWidth === width && nav.clientHeight === height) return;
      width = nav.clientWidth; height = nav.clientHeight;
      position(false);
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, [navigation, selected, reduced]);
  return <span ref={ref} className="navigation-highlight" aria-hidden="true" />;
}

export function MotionPresence({ show, children }: { show: boolean; children: ReactNode }) {
  const [retained, setRetained] = useState(show);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const backdrop = root.querySelector('.modal-backdrop'), panel = root.querySelector('.modal');
    if (show) setRetained(true);
    if (!backdrop || !panel) { if (!show) setRetained(false); return; }
    if (reduced) {
      (backdrop as HTMLElement).style.opacity = '1';
      (panel as HTMLElement).style.transform = 'none';
      if (!show) setRetained(false);
      return;
    }
    const currentOpacity = getComputedStyle(backdrop).opacity;
    const currentTransform = getComputedStyle(panel).transform;
    (backdrop as HTMLElement).style.opacity = '1';
    (panel as HTMLElement).style.transform = 'none';
    const entering = show;
    const opacity = animate(backdrop, [{ opacity: entering && !retained ? 0 : currentOpacity }, { opacity: entering ? 1 : 0 }], entering ? 'dialog-open-backdrop' : 'dialog-close-backdrop', entering ? 240 : 200, 0, 'both');
    const movement = animate(panel, [{ transform: entering && !retained ? 'translateY(18px) scale(.97)' : currentTransform }, { transform: entering ? 'translateY(0) scale(1)' : 'translateY(10px) scale(.98)' }], entering ? 'dialog-open-panel' : 'dialog-close-panel', entering ? 340 : 200, 0, 'both');
    let cancelled = false;
    if (!show) Promise.all([opacity.finished, movement.finished]).then(() => { if (!cancelled) setRetained(false); }).catch(() => {});
    return () => {
      cancelled = true;
      (backdrop as HTMLElement).style.opacity = getComputedStyle(backdrop).opacity;
      (panel as HTMLElement).style.transform = getComputedStyle(panel).transform;
      opacity.cancel(); movement.cancel();
    };
    // retained tracks exit lifetime, not an animation trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reduced]);
  if (!show && !retained) return null;
  return <div ref={ref} className="motion-presence" data-presence={show ? 'present' : 'closing'} aria-hidden={!show || undefined} inert={!show}>{children}</div>;
}
