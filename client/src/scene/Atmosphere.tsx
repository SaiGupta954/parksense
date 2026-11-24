import { Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useAt } from '../lib/hooks';
import { daylightAt } from './daylight';

/** Sky color, sun/moon, ambient + key light — all driven by the scrubbed time. */
export function Atmosphere() {
  const at = useAt();
  const target = useMemo(() => daylightAt(at), [at]);
  const scene = useThree((s) => s.scene);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sunDisc = useRef<THREE.Mesh>(null);
  const moonDisc = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Points>(null);
  const day = useRef(target.day);
  const bg = useMemo(() => new THREE.Color(target.sky), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scene.background = bg;
    scene.fog = new THREE.Fog(bg.clone(), 16, 55);
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, bg]);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 6);
    day.current += (target.day - day.current) * k;
    const d = day.current;
    bg.lerp(target.sky, k);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(bg);
    if (sun.current) {
      sun.current.position.lerp(target.sunPos, k);
      sun.current.intensity = 0.15 + d * 2.2;
      sun.current.color.setHSL(0.09 - d * 0.03, 0.6 - d * 0.35, 0.55 + d * 0.2);
    }
    if (hemi.current) hemi.current.intensity = 0.25 + d * 0.9;
    if (sunDisc.current) {
      sunDisc.current.position.set(target.sunPos.x * 1.6, target.sunPos.y * 1.3, -38);
      sunDisc.current.visible = target.elevation > -0.05;
    }
    if (moonDisc.current) {
      moonDisc.current.position.set(
        -target.sunPos.x * 1.4,
        Math.max(4, -target.sunPos.y * 1.2 + 6),
        -38,
      );
      moonDisc.current.visible = d < 0.45;
    }
    if (starsRef.current) starsRef.current.visible = d < 0.35;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#8fa6c8', '#1a1410', 0.4]} />
      <directionalLight ref={sun} position={[10, 10, 10]} intensity={1} />
      <mesh ref={sunDisc}>
        <sphereGeometry args={[1.8, 24, 24]} />
        <meshBasicMaterial color="#ffd59a" toneMapped={false} />
      </mesh>
      <mesh ref={moonDisc}>
        <sphereGeometry args={[1.1, 24, 24]} />
        <meshBasicMaterial color="#dfe6f2" toneMapped={false} />
      </mesh>
      <Stars
        ref={starsRef}
        radius={60}
        depth={20}
        count={1200}
        factor={2.2}
        saturation={0}
        fade
        speed={0.4}
      />
    </>
  );
}
