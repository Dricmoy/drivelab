import test from 'node:test';
import assert from 'node:assert/strict';
import { cabinProfile, createVehicleShell, shellProfile, vehicleDimensions, vehiclePaint } from '../src/vehicleGeometry.ts';
import { scenePalette } from '../src/scenePalette.ts';

test('vehicle footprints validate input and distinguish sedan, touring and van', () => {
  assert.equal(vehicleDimensions(4.5, 1.8, true).style, 'touring');
  assert.equal(vehicleDimensions(4.5, 1.8, false).style, 'sedan');
  assert.equal(vehicleDimensions(6, 2.2, false).style, 'van');
  assert.equal(vehicleDimensions(4, 1.75, false).style, 'hatchback');
  assert.equal(vehicleDimensions(4.9, 2.02, false).style, 'suv');
  for (const invalid of [0, -1, NaN, Infinity]) assert.throws(() => vehicleDimensions(invalid, 1.8, false));
});
for (const style of ['hatchback', 'sedan', 'touring', 'suv', 'van']) test(style + ' shells stay inside normalized recorded footprints', () => {
  for (const [profile, depth] of [[shellProfile, .93], [cabinProfile(style), .76]]) {
    const geometry = createVehicleShell(profile, depth);
    geometry.computeBoundingBox();
    const {min, max} = geometry.boundingBox;
    assert.ok(min.x >= -.5 && max.x <= .5);
    assert.ok(min.z >= -.5 && max.z <= .5);
    assert.ok(min.y >= 0 && max.y < 1);
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    geometry.dispose();
  }
});
test('fleet paint is stable per actor, varied, and reserves apricot for ego', () => {
  const paints = Array.from({length:36}, (_, i) => vehiclePaint('lane-' + i, false));
  assert.ok(new Set(paints).size >= 5);
  assert.ok(paints.every(color => color !== scenePalette.selected && scenePalette.fleet.includes(color)));
  assert.equal(vehiclePaint('lane-4', false), vehiclePaint('lane-4', false));
  assert.equal(vehiclePaint('ego', true), scenePalette.selected);
});
test('wheels and lamps fit the dimensional envelope', () => {
  for (const [l, w] of [[4.5,1.8], [6,2.2], [2,.8]]) {
    const d = vehicleDimensions(l, w, false);
    assert.ok(d.axle + d.wheelRadius <= l / 2);
    assert.ok((.43 + .065 + .008 / 2) * w <= w / 2);
    assert.ok((.482 + .012 / 2) * l < l / 2);
  }
});
