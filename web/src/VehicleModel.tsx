import { useEffect, useMemo } from 'react';
import type { Vehicle } from './types';
import { scenePalette as paint } from './scenePalette';
import { cabinProfile, createVehicleShell, shellProfile, vehicleDimensions, vehiclePaint } from './vehicleGeometry';

/** Original dimensional models: no downloaded mesh, no invented vehicle motion. */
export default function VehicleModel({ vehicle, ego, onReady }: {
  vehicle: Vehicle; ego: boolean; onReady: (asset: string) => void;
}) {
  const dims = useMemo(() => vehicleDimensions(vehicle.length, vehicle.width, ego), [vehicle.length, vehicle.width, ego]);
  const geometry = useMemo(() => ({
    body: createVehicleShell(shellProfile, .93),
    glass: createVehicleShell(cabinProfile(dims.style), .76),
  }), [dims.style]);
  useEffect(() => () => { geometry.body.dispose(); geometry.glass.dispose(); }, [geometry]);
  useEffect(() => { onReady('drivelab-' + dims.style + '-v2'); }, [dims.style, onReady]);
  const { length: l, width: w, height: h, wheelRadius: r, axle } = dims;
  const bodyColor = vehiclePaint(vehicle.id, ego);
  const wheelRotation = -(vehicle.x * Math.cos(vehicle.yaw) + vehicle.y * Math.sin(vehicle.yaw)) / r;
  return <group>
    <group scale={[l, h, w]}>
      <mesh geometry={geometry.body} castShadow receiveShadow>
        <meshPhysicalMaterial color={bodyColor} metalness={.48} roughness={.28} clearcoat={.65} clearcoatRoughness={.22} />
      </mesh>
      <mesh geometry={geometry.glass} castShadow>
        <meshPhysicalMaterial color={paint.glass} metalness={.30} roughness={.15} clearcoat={1} />
      </mesh>
      <mesh position={[-.035, .943, 0]} castShadow>
        <boxGeometry args={[['van','suv','hatchback'].includes(dims.style) ? .42 : .25, .025, .72]} />
        <meshStandardMaterial color={bodyColor} metalness={.45} roughness={.3} />
      </mesh>
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[-.06, .73, side * .387]} castShadow>
          <boxGeometry args={[.025, .32, .02]} /><meshStandardMaterial color={bodyColor} metalness={.5} roughness={.3} />
        </mesh>
        <mesh position={[.19, .61, side * .455]} castShadow>
          <boxGeometry args={[.047, .05, .05]} /><meshStandardMaterial color={bodyColor} metalness={.6} roughness={.25} />
        </mesh>
        <mesh position={[.474, .39, side * .31]}>
          <boxGeometry args={[.014, .035, .23]} />
          <meshStandardMaterial color={paint.paper} emissive={paint.paper} emissiveIntensity={.55} toneMapped={false} />
        </mesh>
        <mesh position={[-.482, .38, side * .31]}>
          <boxGeometry args={[.012, .045, .20]} />
          <meshStandardMaterial color={paint.rejected} emissive={paint.rejected} emissiveIntensity={.35} />
        </mesh>
        <mesh position={[-.08, .49, side * .477]}>
          <boxGeometry args={[.40, .018, .01]} /><meshStandardMaterial color={paint.trim} roughness={.4} metalness={.6} />
        </mesh>
      </group>)}
      <mesh position={[.476, .28, 0]}>
        <boxGeometry args={[.012, .07, .43]} /><meshStandardMaterial color={paint.trim} roughness={.7} />
      </mesh>
      {[-1, 1].map(end => <mesh key={'plate-' + end} position={[end * .488, .32, 0]}>
        <boxGeometry args={[.006, .045, .15]} /><meshStandardMaterial color={paint.paper} roughness={.6} />
      </mesh>)}
    </group>
    {[-axle, axle].flatMap(x => [-1, 1].map(side => <group key={x + ':' + side} position={[x, r, side * w * .43]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[r, r, w * .13, 20]} /><meshStandardMaterial color={paint.tire} roughness={.94} />
      </mesh>
      <group position={[0, 0, side * w * .065]} rotation={[0, 0, wheelRotation]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * .70, r * .70, w * .006, 20]} /><meshStandardMaterial color={paint.trim} roughness={.55} />
        </mesh>
        {[0, 1, 2, 3, 4].map(i => <mesh key={i} rotation={[0, 0, i * Math.PI / 5]}>
          <boxGeometry args={[r * 1.26, r * .10, w * .008]} /><meshStandardMaterial color={paint.rim} metalness={.8} roughness={.25} />
        </mesh>)}
      </group>
    </group>))}
    {ego && <group position={[0, h * .98, 0]}>
      <mesh castShadow><boxGeometry args={[.65, .08, .45]} /><meshStandardMaterial color={paint.trim} metalness={.4} roughness={.4} /></mesh>
      <mesh position={[0, .09, 0]} castShadow><cylinderGeometry args={[.16, .19, .12, 16]} /><meshStandardMaterial color={paint.rim} metalness={.7} roughness={.25} /></mesh>
      <mesh position={[0, .10, 0]}><cylinderGeometry args={[.165, .165, .028, 16]} /><meshBasicMaterial color={paint.selected} /></mesh>
    </group>}
  </group>;
}
