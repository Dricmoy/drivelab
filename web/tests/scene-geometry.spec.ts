import { expect, test } from '@playwright/test';
import { Box3, BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { normalizeCar, world } from '../src/sceneGeometry';

test('large map coordinates, positive yaw and model footprint share meter axes', () => {
  expect(world([120004, 340002], [120000, 340000], .15)).toEqual([4, .15, -2]);
  const front = new Vector3(1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
  expect(front.z).toBeCloseTo(-1); // backend positive yaw points toward positive y.
  const original = new Group();
  const mesh = new Mesh(new BoxGeometry(2, 1, 4));
  mesh.position.set(.2, .6, -.3); original.add(mesh);
  const normalized = normalizeCar(original, 4.8, 1.9);
  const bounds = new Box3().setFromObject(normalized), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
  expect(size.x).toBeCloseTo(4.8); expect(size.z).toBeCloseTo(1.9); expect(size.y).toBeCloseTo(1.5);
  expect(center.x).toBeCloseTo(0); expect(center.z).toBeCloseTo(0); expect(bounds.min.y).toBeCloseTo(0);
  expect(original.rotation.y).toBe(0); expect(mesh.position.x).toBe(.2);
  const frontOfModel = new Vector3(0, 0, 1).transformDirection(normalized.children[0].matrixWorld);
  expect(frontOfModel.x).toBeCloseTo(1);
  mesh.geometry.dispose();
});
