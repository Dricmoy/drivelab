import test from 'node:test';
import assert from 'node:assert/strict';
import { cabinProfile, createVehicleShell, shellProfile, vehicleDimensions } from '../src/vehicleGeometry.ts';

test('vehicle footprints validate input and distinguish sedan, touring and van', () => {
  assert.equal(vehicleDimensions(4.5, 1.8, true).style, 'touring');
  assert.equal(vehicleDimensions(4.5, 1.8, false).style, 'sedan');
  assert.equal(vehicleDimensions(6, 2.2, false).style, 'van');
  for (const invalid of [0, -1, NaN, Infinity]) assert.throws(() => vehicleDimensions(invalid, 1.8, false));
});
for (const style of ['sedan', 'touring', 'van']) test(style + ' shells stay inside normalized recorded footprints', () => {
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
test('wheels and lamps fit the dimensional envelope', () => {
  for (const [l, w] of [[4.5,1.8], [6,2.2], [2,.8]]) {
    const d = vehicleDimensions(l, w, false);
    assert.ok(d.axle + d.wheelRadius <= l / 2);
    assert.ok((.43 + .065 + .008 / 2) * w <= w / 2);
    assert.ok((.482 + .012 / 2) * l < l / 2);
  }
});
