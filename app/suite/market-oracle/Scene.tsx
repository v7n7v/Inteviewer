'use client';

import { useState, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html, Stars } from '@react-three/drei';
import * as THREE from 'three';

// Types (duplicated to avoid circular deps for now, or could share in a types file)
export interface JobStar {
    id: string;
    title: string;
    company: string;
    salary: number;
    skills: string[];
    fitScore: number;
    position: [number, number, number];
    color: string;
    isConstellation: boolean;
}

export interface BridgeSkill {
    skill: string;
    impact: number;
    newPosition: [number, number, number];
    salaryIncrease: number;
    newFitScore: number;
}

export interface MarketAnalysis {
    currentPosition: [number, number, number];
    talentDensityPercentile: number;
    topSkills: string[];
    missingSkills: string[];
    bridgeSkills: BridgeSkill[];
    jobs: JobStar[];
    marketTrends: { skill: string; growth: number }[];
    industryInsights: string[];
}

// 3D Star Component
function JobStarMesh({
    job,
    onClick,
    isSelected,
    showBridge
}: {
    job: JobStar;
    onClick: () => void;
    isSelected: boolean;
    showBridge: boolean;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    useFrame((state) => {
        if (meshRef.current) {
            // Pulse effect for high-fit jobs
            if (job.isConstellation) {
                meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.1);
            }
            // Glow effect on hover/select
            if (hovered || isSelected) {
                meshRef.current.scale.setScalar(1.5);
            }
        }
    });

    const size = 0.15 + job.fitScore * 0.2;

    return (
        <mesh
            ref={meshRef}
            position={job.position}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            <sphereGeometry args={[size, 16, 16]} />
            <meshStandardMaterial
                color={job.color}
                emissive={job.color}
                emissiveIntensity={hovered || isSelected ? 2 : job.isConstellation ? 1 : 0.5}
                transparent
                opacity={showBridge && !job.isConstellation ? 0.3 : 1}
            />
            {(hovered || isSelected) && (
                <Html distanceFactor={10}>
                    <div className="px-3 py-2 rounded-lg bg-slate-900/90 border border-white/20 backdrop-blur-xl whitespace-nowrap">
                        <p className="text-sm font-bold text-white">{job.title}</p>
                        <p className="text-xs text-cyan-400">{job.company}</p>
                        <p className="text-xs text-green-400">${job.salary.toLocaleString()}</p>
                    </div>
                </Html>
            )}
        </mesh>
    );
}

// Constellation Lines Component
function ConstellationLines({ jobs, userPosition }: { jobs: JobStar[]; userPosition: [number, number, number] }) {
    const lineRef = useRef<THREE.LineSegments>(null);

    const geometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        const constellationJobs = jobs.filter(j => j.isConstellation);

        constellationJobs.forEach(job => {
            points.push(new THREE.Vector3(...userPosition));
            points.push(new THREE.Vector3(...job.position));
        });

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return geo;
    }, [jobs, userPosition]);

    return (
        <lineSegments ref={lineRef} geometry={geometry}>
            <lineBasicMaterial color="#a855f7" transparent opacity={0.4} linewidth={2} />
        </lineSegments>
    );
}

// User Position Marker
function UserMarker({ position, showBridge, bridgePosition }: {
    position: [number, number, number];
    showBridge: boolean;
    bridgePosition?: [number, number, number];
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const bridgeRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.01;
            meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.1);
        }
        if (bridgeRef.current && showBridge) {
            bridgeRef.current.rotation.y -= 0.01;
        }
    });

    return (
        <>
            <mesh ref={meshRef} position={position}>
                <octahedronGeometry args={[0.4, 0]} />
                <meshStandardMaterial color="#00f2ff" emissive="#00f2ff" emissiveIntensity={2} />
            </mesh>
            {showBridge && bridgePosition && (
                <>
                    <mesh ref={bridgeRef} position={bridgePosition}>
                        <octahedronGeometry args={[0.4, 0]} />
                        <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={2} transparent opacity={0.8} />
                    </mesh>
                    {/* Bridge path line */}
                    <line>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                count={2}
                                array={new Float32Array([...position, ...bridgePosition])}
                                itemSize={3}
                            />
                        </bufferGeometry>
                        <lineDashedMaterial color="#a855f7" dashSize={0.3} gapSize={0.1} />
                    </line>
                </>
            )}
        </>
    );
}

// Main 3D Scene
export default function OracleScene({
    analysis,
    selectedJob,
    setSelectedJob,
    showBridge,
    activeBridgeSkill
}: {
    analysis: MarketAnalysis;
    selectedJob: JobStar | null;
    setSelectedJob: (job: JobStar | null) => void;
    showBridge: boolean;
    activeBridgeSkill: BridgeSkill | null;
}) {
    return (
        <>
            <ambientLight intensity={0.3} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#a855f7" />

            <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />

            {/* Job Stars */}
            {analysis.jobs.map((job) => (
                <JobStarMesh
                    key={job.id}
                    job={job}
                    onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                    isSelected={selectedJob?.id === job.id}
                    showBridge={showBridge}
                />
            ))}

            {/* Constellation Lines */}
            <ConstellationLines jobs={analysis.jobs} userPosition={analysis.currentPosition} />

            {/* User Position */}
            <UserMarker
                position={analysis.currentPosition}
                showBridge={showBridge}
                bridgePosition={activeBridgeSkill?.newPosition}
            />

            {/* Axis Labels */}
            <Text position={[12, 0, 0]} fontSize={0.5} color="#6b7280">Skill X →</Text>
            <Text position={[0, 12, 0]} fontSize={0.5} color="#6b7280">Skill Y →</Text>
            <Text position={[0, 0, 7]} fontSize={0.5} color="#22c55e">$$$</Text>

            <OrbitControls
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                minDistance={5}
                maxDistance={50}
                autoRotate
                autoRotateSpeed={0.5}
            />
        </>
    );
}
