"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { IslandSettings, TerrainData } from "@/lib/terrain";

function IslandScene({ data, settings, showMarkers, showGrid }: { data: TerrainData; settings: IslandSettings; showMarkers: boolean; showGrid: boolean }) {
  const terrainGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }, [data]);

  const oceanGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(settings.width * 1.65, settings.length * 1.65, 1, 1);
    return geometry;
  }, [settings.width, settings.length]);

  const markerColors: Record<string, string> = {
    city: "#f0b76b",
    port: "#6cb9d5",
    airport: "#9ca8ff",
    nature: "#7bc49b",
    tourism: "#e8a6b1",
  };

  return (
    <>
      <PerspectiveCamera makeDefault position={[settings.width * 0.92, -settings.length * 1.05, settings.maxHeight * 1.85 + 1800]} up={[0, 0, 1]} fov={38} near={1} far={50000} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[-5000, -3500, 7000]} intensity={2.3} castShadow />
      <mesh geometry={oceanGeometry} position={[0, 0, -8]} rotation={[0, 0, 0]}>
        <meshStandardMaterial color="#123f50" roughness={0.34} metalness={0.12} />
      </mesh>
      <mesh geometry={terrainGeometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0.0} side={THREE.DoubleSide} />
      </mesh>
      {showMarkers && data.landmarks.map((landmark) => (
        <group key={landmark.id} position={[landmark.x, landmark.y, landmark.z]}>
          <mesh>
            <sphereGeometry args={[settings.width / 150, 12, 12]} />
            <meshBasicMaterial color={markerColors[landmark.type] ?? "#fff"} />
          </mesh>
          <mesh position={[0, 0, -settings.width / 260]}>
            <cylinderGeometry args={[settings.width / 700, settings.width / 700, settings.width / 130, 8]} />
            <meshBasicMaterial color={markerColors[landmark.type] ?? "#fff"} />
          </mesh>
        </group>
      ))}
      {showGrid && <gridHelper args={[settings.width * 1.3, 26, "#29414a", "#20323a"]} position={[0, 0, -7]} rotation={[Math.PI / 2, 0, 0]} />}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={settings.width * 0.25} maxDistance={settings.width * 3.5} maxPolarAngle={Math.PI * 0.49} />
    </>
  );
}

export default function IslandCanvas({ data, settings, showMarkers, showGrid }: { data: TerrainData; settings: IslandSettings; showMarkers: boolean; showGrid: boolean }) {
  return (
    <Canvas dpr={[1, 1.7]} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.setClearColor("#0a141b"); }}>
      <IslandScene data={data} settings={settings} showMarkers={showMarkers} showGrid={showGrid} />
    </Canvas>
  );
}
