import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp01, springProgress, highlightFrames, resolveReducedMotion } from '../src/motionMath.ts';

test('system is the default and only an explicit full preference overrides reduction', () => {
  assert.equal(resolveReducedMotion('auto', true), true);
  assert.equal(resolveReducedMotion('auto', false), false);
  assert.equal(resolveReducedMotion('reduced', false), true);
  assert.equal(resolveReducedMotion('reduced', true), true);
  assert.equal(resolveReducedMotion('full', true), false);
  assert.equal(resolveReducedMotion('full', false), false);
});

test('motion progress is bounded for elapsed time and finite at endpoints', () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(NaN), 0);
  assert.equal(springProgress(0), 0);
  assert.equal(springProgress(1), 1);
  for (let i = 0; i <= 100; i++) assert.ok(Number.isFinite(springProgress(i / 100)));
});

test('shared highlight starts at current visual position and ends exactly at selected control', () => {
  const frames = highlightFrames({ x: 41.5, width: 86 }, { x: 211, width: 104 });
  assert.equal(frames[0].transform, 'translateX(41.5px)');
  assert.equal(frames[0].width, '86px');
  assert.equal(frames.at(-1).transform, 'translateX(211px)');
  assert.equal(frames.at(-1).width, '104px');
  assert.ok(frames.every((frame, i) => frame.offset === i / 24 && !frame.transform.includes('NaN')));
});

test('retargeting in either direction and zero-width controls stays finite', () => {
  const forward = highlightFrames({ x: 0, width: 0 }, { x: 100, width: 90 });
  const back = highlightFrames({ x: 70, width: 91 }, { x: 0, width: 0 });
  assert.equal(back.at(-1).width, '0px');
  assert.ok([...forward, ...back].every(frame => parseFloat(frame.width) >= 0));
});
