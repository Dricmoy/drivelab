import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scenePalette } from '../src/scenePalette.ts';
import { emptyDecisionCopy } from '../src/replayCopy.ts';

const css = fs.readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
const token = name => {
  const value = css.match(new RegExp(`--color-${name}: ([^;]+)`))?.[1];
  assert.ok(value, `Missing ${name}`);
  if (value.startsWith('var(')) return token(value.match(/--color-([\w-]+)/)[1]);
  const match = value.match(/oklch\(([\d.]+)% ([\d.]+) ([\d.]+)/);
  assert.ok(match, `Unsupported ${value}`);
  const [, L, C, h] = match.map(Number);
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l = (L / 100 + .3963377774*a + .2158037573*b)**3;
  const m = (L / 100 - .1055613458*a - .0638541728*b)**3;
  const s = (L / 100 - .0894841775*a - 1.291485548*b)**3;
  return [4.0767416621*l - 3.3077115913*m + .2309699292*s,
    -1.2684380046*l + 2.6097574011*m - .3413193965*s,
    -.0041960863*l - .7034186147*m + 1.707614701*s].map(x => Math.max(0, Math.min(1, x)));
};
const luminance = c => .2126*c[0] + .7152*c[1] + .0722*c[2];
const contrast = (a, b) => (Math.max(luminance(a), luminance(b))+.05)/(Math.min(luminance(a), luminance(b))+.05);
const hex = c => '#' + c.map(x => Math.round(255*(x <= .0031308 ? 12.92*x : 1.055*x**(1/2.4)-.055)).toString(16).padStart(2,'0')).join('');

test('UI and 2D/3D semantic colors stay identical across renderers', () => {
  for (const [role, ui] of Object.entries({ selected:'selected', alternative:'warning', feasible:'success', rejected:'error', inspected:'ink' })) {
    assert.equal(scenePalette[role], hex(token(ui)), `${role} drifted from CSS`);
  }
});
test('body, muted, link and status text clear 4.5:1 on ordinary surfaces', () => {
  for (const fg of ['ink','muted','selected','success','warning','error']) {
    for (const bg of ['paper','paper-2','paper-3','selected-surface']) assert.ok(contrast(token(fg),token(bg))>=4.5, `${fg} on ${bg}`);
  }
});
test('primary actions and semantic notices clear 4.5:1', () => {
  for (const [fg,bg] of [['accent-ink','accent'],['success','success-surface'],['warning','warning-surface'],['error','error-surface']]) assert.ok(contrast(token(fg),token(bg))>=4.5, `${fg} on ${bg}`);
});
test('keyboard focus and control outlines clear 3:1 against dark surfaces', () => {
  for (const bg of ['paper','paper-2','paper-3']) for (const fg of ['focus','control-rule']) assert.ok(contrast(token(fg),token(bg))>=3, `${fg} on ${bg}`);
});
test('coherence layer consumes semantic colors instead of adding raw values', () => {
  const surface = fs.readFileSync(new URL('../src/coherence.css',import.meta.url),'utf8');
  assert.doesNotMatch(surface, /#[\da-f]{3,8}\b|\b(?:oklch|rgba?|hsla?)\(/i);
});
test('functional titles and decisions share the heading font; wordmark stays distinct', () => {
  assert.match(css, /--font-heading: var\(--font-body\)/);
  const source = fs.readFileSync(new URL('../src/coherence.css',import.meta.url),'utf8');
  assert.match(source, /\.field-lab h1 \{ font-family: var\(--font-heading\)/);
  assert.match(source, /\.decision-summary strong \{ font-family: var\(--font-heading\)/);
  assert.match(source, /font-variant-numeric: tabular-nums/);
});
test('terminal replay is never mistaken for a baseline or a new decision', () => {
  for (const planner of ['baseline','lattice']) {
    const copy = emptyDecisionCopy(planner, true);
    assert.equal(copy.title, 'Replay complete');
    assert.match(copy.detail, /No new decision/);
    assert.doesNotMatch(copy.candidates, /baseline/);
  }
  assert.match(emptyDecisionCopy('baseline', false).detail, /without candidate search/);
  assert.match(emptyDecisionCopy(undefined, false).detail, /Awaiting/);
});
test('editorial imagery keeps provenance, fallback and local assets', () => {
  const source = fs.readFileSync(new URL('../src/EditorialFigure.tsx',import.meta.url),'utf8');
  assert.match(source, /not simulation output/);
  assert.match(source, /onError=/);
  assert.match(source, /alt=\{photo.alt\}/);
  for (const name of ['desert-intersection','night-motion']) assert.ok(fs.statSync(new URL(`../public/photography/${name}.jpg`,import.meta.url)).size>1000);
});
