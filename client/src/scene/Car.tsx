import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useAt, useReducedMotion } from '../lib/hooks';
import { daylightAt } from './daylight';

const PARK_X = -3.4;
const LANE_Z = 1.25;
const ENTER_X = 26;
const EXIT_X = -28;
const WHEEL_R = 0.3;

const BODY = '#2f4a6b';

function Wheel({
  position,
  spin,
}: {
  position: [number, number, number];
  spin: React.RefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current && spin.current != null) ref.current.rotation.z = spin.current;
  });
  return (
    <group position={position} ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.22, 14]} />
        <meshStandardMaterial color="#121315" roughness={0.9} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, position[2] > 0 ? 0.115 : -0.115]}>
        <cylinderGeometry args={[0.16, 0.16, 0.01, 10]} />
        <meshStandardMaterial color="#8d939b" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* spoke so you can see it turning */}
      <mesh position={[0, 0.08, position[2] > 0 ? 0.12 : -0.12]}>
        <boxGeometry args={[0.04, 0.16, 0.01]} />
        <meshStandardMaterial color="#5d6168" />
      </mesh>
    </group>
  );
}

/** Low-poly car that parks when allowed and drives away when not. */
export function Car({ parked }: { parked: boolean }) {
  const reduced = useReducedMotion();
  const group = useRef<THREE.Group>(null);
  const headMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#fff2d0', toneMapped: false }),
    [],
  );
  const tailMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#c0141a', toneMapped: false }),
    [],
  );
  const x = useRef(parked ? PARK_X : EXIT_X);
  const v = useRef(0);
  const gone = useRef(!parked);
  const spin = useRef(0);
  const at = useAt();
  const night = 1 - daylightAt(at).day;

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    if (reduced) {
      // No motion: the car simply is (or isn't) there.
      x.current = PARK_X;
      g.visible = parked;
    } else if (parked) {
      if (gone.current) {
        x.current = ENTER_X;
        gone.current = false;
      }
      const d = PARK_X - x.current;
      const speed = Math.min(Math.abs(d) * 2.4, 13);
      const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
      x.current += step;
      spin.current += -step / WHEEL_R;
      v.current = 0;
      g.visible = true;
    } else if (!gone.current) {
      v.current = Math.min(v.current + 10 * dt, 18);
      const step = -v.current * dt;
      x.current += step;
      spin.current += -step / WHEEL_R;
      if (x.current < EXIT_X) gone.current = true;
      g.visible = !gone.current;
    } else {
      g.visible = false;
    }
    g.position.x = x.current;
    const moving = Math.abs(PARK_X - x.current) > 0.05 || (!parked && !gone.current);
    headMat.color.setScalar(0.25 + night * (moving ? 2.6 : 0.4));
    tailMat.color.setRGB(0.4 + night * (moving ? 2.2 : 0.4), 0.02, 0.02);
  });

  return (
    <group ref={group} position={[x.current, 0, LANE_Z]}>
      {/* body */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[3.7, 0.55, 1.6]} />
        <meshStandardMaterial color={BODY} metalness={0.55} roughness={0.35} />
      </mesh>
      {/* cabin, slightly toward the rear */}
      <mesh position={[0.25, 1.05, 0]}>
        <boxGeometry args={[1.9, 0.5, 1.45]} />
        <meshStandardMaterial color="#1a2430" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[0.25, 1.31, 0]}>
        <boxGeometry args={[1.7, 0.04, 1.4]} />
        <meshStandardMaterial color={BODY} metalness={0.55} roughness={0.35} />
      </mesh>
      {/* headlights (front = -x) */}
      {[-0.55, 0.55].map((z) => (
        <mesh key={`h${z}`} position={[-1.86, 0.62, z]} material={headMat}>
          <boxGeometry args={[0.03, 0.12, 0.32]} />
        </mesh>
      ))}
      {[-0.6, 0.6].map((z) => (
        <mesh key={`t${z}`} position={[1.86, 0.65, z]} material={tailMat}>
          <boxGeometry args={[0.03, 0.1, 0.3]} />
        </mesh>
      ))}
      <Wheel position={[-1.15, WHEEL_R, 0.72]} spin={spin} />
      <Wheel position={[1.15, WHEEL_R, 0.72]} spin={spin} />
      <Wheel position={[-1.15, WHEEL_R, -0.72]} spin={spin} />
      <Wheel position={[1.15, WHEEL_R, -0.72]} spin={spin} />
      {/* contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[4, 1.9]} />
        <meshBasicMaterial color="#000" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}
