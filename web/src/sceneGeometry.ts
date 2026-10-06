import { Box3, Group, Object3D, Vector3 } from 'three';
import type { Point } from './types';

export type XYZ = [number, number, number];
export const world = ([x, y]: Point, origin: Point, height = .08): XYZ => [x - origin[0], height, -(y - origin[1])];

export function normalizeCar(scene: Object3D, length: number, width: number) {
  const clone = scene.clone(true);
  // Kenney's front is +Z; replay forward is +X. Scale the rotated parent axes.
  clone.rotation.y = Math.PI / 2;
  const normalized = new Group();
  normalized.add(clone);
  normalized.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(normalized);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  if (Math.min(size.x, size.y, size.z) <= 0) throw new Error('Vehicle model has empty bounds');
  normalized.scale.set(length / size.x, 1.5 / size.y, width / size.z);
  normalized.position.set(-center.x * normalized.scale.x, -bounds.min.y * normalized.scale.y, -center.z * normalized.scale.z);
  normalized.updateMatrixWorld(true);
  return normalized;
}
