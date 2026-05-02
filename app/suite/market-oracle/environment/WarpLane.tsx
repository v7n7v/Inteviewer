'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface WarpLaneProps {
  startPosition: [number, number, number];
  endPosition: [number, number, number];
  skillName: string;
  salaryIncrease: number;
  active: boolean;
}

export default function WarpLane({ startPosition, endPosition, skillName, salaryIncrease, active }: WarpLaneProps) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const ghostRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);

  // Build a curved path between start and end
  const { curve, tubeGeo } = useMemo(() => {
    const start = new THREE.Vector3(...startPosition);
    const end = new THREE.Vector3(...endPosition);
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
    // Arc upward for visual clarity
    mid.y += 2;
    mid.x += (Math.random() - 0.5) * 2;

    const c = new THREE.CatmullRomCurve3([start, mid, end]);
    const geo = new THREE.TubeGeometry(c, 48, 0.04, 8, false);
    return { curve: c, tubeGeo: geo };
  }, [startPosition, endPosition]);

  useFrame((state) => {
    if (!active) return;

    // Animate entry
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + 0.02);
    }

    // Ghost marker rotation + pulse
    if (ghostRef.current) {
      ghostRef.current.rotation.y -= 0.015;
      ghostRef.current.scale.setScalar(0.8 + Math.sin(state.clock.elapsedTime * 2.5) * 0.15);
    }

    // Tube dash animation via material offset
    if (tubeRef.current) {
      const mat = tubeRef.current.material as THREE.MeshBasicMaterial;
      if (mat.map) {
        mat.map.offset.x -= 0.015;
      }
    }
  });

  if (!active) return null;

  // Midpoint for label
  const midPoint = curve.getPoint(0.5);
  const labelPos: [number, number, number] = [midPoint.x, midPoint.y + 0.8, midPoint.z];

  return (
    <group>
      {/* Warp Lane Tube */}
      <mesh ref={tubeRef} geometry={tubeGeo}>
        <meshBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.6 * progressRef.current}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer glow tube (wider, dimmer) */}
      <mesh geometry={new THREE.TubeGeometry(curve, 48, 0.12, 8, false)}>
        <meshBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.1 * progressRef.current}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Ghost marker at endpoint */}
      <mesh ref={ghostRef} position={endPosition}>
        <icosahedronGeometry args={[0.35, 1]} />
        <meshStandardMaterial
          color="#8b5cf6"
          emissive="#8b5cf6"
          emissiveIntensity={1.5}
          transparent
          opacity={0.5 * progressRef.current}
          wireframe
        />
      </mesh>

      {/* Label along the path */}
      <Html position={labelPos} center>
        <div
          style={{
            background: 'rgba(15, 15, 30, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: 8,
            padding: '4px 10px',
            whiteSpace: 'nowrap',
            opacity: progressRef.current,
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: '#a78bfa', fontSize: 11, fontWeight: 600 }}>+{skillName}</span>
          <span style={{ color: '#4ade80', fontSize: 10, marginLeft: 6 }}>+${(salaryIncrease / 1000).toFixed(0)}K</span>
        </div>
      </Html>
    </group>
  );
}
