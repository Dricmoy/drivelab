import { ExtrudeGeometry, Shape } from 'three';

export type VehicleStyle = 'sedan' | 'touring' | 'van';

// +X is forward. Profiles stay inside the recorded length/width after beveling.
// Heights, silhouettes and detailing are presentation choices, not sensor data.
export const shellProfile: [number, number][] = [
  [-.48, .22], [-.48, .42], [-.41, .55], [-.22, .60],
  [.28, .59], [.43, .49], [.48, .36], [.46, .23],
];
export function cabinProfile(style: VehicleStyle): [number, number][] {
  return style === 'van'
    ? [[-.39, .56], [-.36, .95], [.15, .95], [.32, .56]]
    : [[-.30, .57], [-.17, .91], [.10, .94], [.29, .57]];
}
export function vehicleDimensions(length: number, width: number, ego: boolean) {
  if (!Number.isFinite(length) || !Number.isFinite(width) || length <= 0 || width <= 0)
    throw new Error('Vehicle footprint must have finite positive dimensions');
  const style: VehicleStyle = length > 5.2 ? 'van' : ego ? 'touring' : 'sedan';
  return { length, width, style, height: style === 'van' ? 2.05 : 1.48,
    wheelRadius: Math.min(width * .18, length * .075), axle: length * .30 };
}
export function createVehicleShell(profile: [number, number][], depth: number) {
  const shape = new Shape();
  profile.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: true,
    bevelThickness: .008, bevelSize: .012, bevelSegments: 2, steps: 1 })
    .translate(0, 0, -depth / 2);
}
