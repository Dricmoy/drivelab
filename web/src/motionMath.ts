export const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function resolveReducedMotion(preference: 'auto' | 'full' | 'reduced', systemReduced: boolean) {
  return preference === 'reduced' || (preference === 'auto' && systemReduced);
}

export function springProgress(value: number) {
  const t = clamp01(value);
  if (t === 0 || t === 1) return t;
  return 1 - Math.exp(-8 * t) * (Math.cos(10 * t) + .8 * Math.sin(10 * t));
}

export function highlightFrames(from: { x: number; width: number }, to: { x: number; width: number }) {
  return Array.from({ length: 25 }, (_, index) => {
    const progress = springProgress(index / 24);
    return { offset: index / 24, transform: `translateX(${from.x + (to.x - from.x) * progress}px)`, width: `${Math.max(0, from.width + (to.width - from.width) * progress)}px` };
  });
}
