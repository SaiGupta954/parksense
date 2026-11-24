import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useAt } from '../lib/hooks';
import { daylightAt } from './daylight';
import { asphaltTexture, concreteTexture, facadeTexture } from './textures';

const BUILDINGS: Array<{ x: number; w: number; h: number; d: number; tint: string }> = [
  { x: -16, w: 7, h: 6.5, d: 5, tint: '#22252b' },
  { x: -9, w: 6, h: 8.5, d: 5, tint: '#1d2026' },
  { x: -3, w: 5, h: 5, d: 5, tint: '#272a31' },
  { x: 2.5, w: 6, h: 7, d: 5, tint: '#1f2227' },
  { x: 9, w: 7, h: 5.5, d: 5, tint: '#24272d' },
  { x: 16, w: 6, h: 9, d: 5, tint: '#1c1f24' },
];

function Building({ x, w, h, d, tint, seed }: (typeof BUILDINGS)[number] & { seed: number }) {
  const tex = useMemo(
    () => facadeTexture(seed, Math.round(w * 1.4), Math.round(h / 1.6)),
    [seed, w, h],
  );
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const at = useAt();
  const night = 1 - daylightAt(at).day;
  useFrame((_, dt) => {
    if (!mat.current) return;
    mat.current.emissiveIntensity +=
      (0.15 + night * 1.1 - mat.current.emissiveIntensity) * (1 - Math.exp(-dt * 5));
  });
  return (
    <mesh position={[x, h / 2, -12 - d / 2]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial
        ref={mat}
        color={tint}
        map={tex}
        emissive="#ffffff"
        emissiveMap={tex}
        emissiveIntensity={0.5}
        roughness={0.9}
      />
    </mesh>
  );
}

function StreetLamp() {
  const at = useAt();
  const night = 1 - daylightAt(at).day;
  const light = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.MeshBasicMaterial>(null);
  const cone = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 5);
    const on = night > 0.45 ? 1 : 0;
    if (light.current) light.current.intensity += (on * 38 - light.current.intensity) * k;
    if (bulb.current) bulb.current.color.lerp(new THREE.Color(on ? '#ffc56b' : '#5c5850'), k);
    if (cone.current) cone.current.opacity += (on * 0.07 - cone.current.opacity) * k;
  });
  return (
    <group position={[4.6, 0, -0.8]}>
      <mesh position={[0, 2.7, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 5.4, 12]} />
        <meshStandardMaterial color="#3d4249" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 5.35, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.5, 8]} />
        <meshStandardMaterial color="#3d4249" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 5.25, 1.45]}>
        <boxGeometry args={[0.5, 0.12, 0.3]} />
        <meshStandardMaterial color="#2c3036" />
      </mesh>
      <mesh position={[0, 5.17, 1.45]}>
        <boxGeometry args={[0.4, 0.04, 0.22]} />
        <meshBasicMaterial ref={bulb} color="#ffc56b" toneMapped={false} />
      </mesh>
      {/* soft volumetric-ish cone */}
      <mesh position={[0, 2.6, 1.45]}>
        <coneGeometry args={[2.4, 5.1, 32, 1, true]} />
        <meshBasicMaterial
          ref={cone}
          color="#ffb347"
          transparent
          opacity={0.06}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 5, 1.45]}
        color="#ffb347"
        intensity={30}
        distance={16}
        decay={1.6}
      />
    </group>
  );
}

export function Street() {
  const asphalt = useMemo(() => {
    const t = asphaltTexture();
    t.repeat.set(12, 3);
    return t;
  }, []);
  const concrete = useMemo(() => {
    const t = concreteTexture();
    t.repeat.set(30, 2.5);
    return t;
  }, []);

  const dashes = useMemo(() => Array.from({ length: 16 }, (_, i) => -30 + i * 4), []);
  const stalls = useMemo(() => [-7.4, -2.6 + 2.4, 2.2 + 2.4, 7.0 + 2.4].map((x) => x - 2.4), []);

  return (
    <group>
      {/* road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 7]}>
        <planeGeometry args={[64, 14]} />
        <meshStandardMaterial map={asphalt} roughness={0.95} />
      </mesh>
      {/* parking lane edge line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 2.45]}>
        <planeGeometry args={[64, 0.08]} />
        <meshStandardMaterial color="#cfcac0" roughness={0.8} />
      </mesh>
      {/* parking stall ticks */}
      {stalls.map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 2.2]}>
          <planeGeometry args={[0.08, 0.5]} />
          <meshStandardMaterial color="#cfcac0" roughness={0.8} />
        </mesh>
      ))}
      {/* center dashes */}
      {dashes.map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 7.5]}>
          <planeGeometry args={[2, 0.12]} />
          <meshStandardMaterial color="#c99a3b" roughness={0.8} />
        </mesh>
      ))}
      {/* sidewalk */}
      <mesh position={[0, 0.08, -9]}>
        <boxGeometry args={[64, 0.16, 18]} />
        <meshStandardMaterial map={concrete} roughness={0.95} />
      </mesh>
      {/* curb */}
      <mesh position={[0, 0.09, -0.02]}>
        <boxGeometry args={[64, 0.18, 0.2]} />
        <meshStandardMaterial color="#6b6e73" roughness={0.8} />
      </mesh>
      {/* red curb paint near the pole (classic no-stopping cue) */}
      <mesh position={[1.6, 0.185, -0.02]}>
        <boxGeometry args={[2.2, 0.01, 0.21]} />
        <meshStandardMaterial color="#9e2420" roughness={0.7} />
      </mesh>
      {BUILDINGS.map((b, i) => (
        <Building key={b.x} {...b} seed={i * 17 + 3} />
      ))}
      <StreetLamp />
    </group>
  );
}
