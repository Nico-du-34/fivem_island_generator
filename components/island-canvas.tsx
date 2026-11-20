"use client";

import {
  forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { applyBrushInPlace, type IslandSettings, type TerrainData } from "@/lib/terrain";
import { getGunwareMaterial } from "@/lib/gunware-materials";

export type BrushTool = "orbit" | "raise" | "lower" | "smooth" | "flatten" | "paint" | "erase" | "vegRemove" | "vegAdd";
export type ViewMode = "render" | "height" | "material" | "wireframe";
export type CanvasLayers = { grass: boolean; props: boolean; water: boolean; grid: boolean; chunks: boolean; context: boolean };
export type PlayerStatus = { x: number; y: number; z: number; speed: number; swimming: boolean; firstPerson: boolean };
export type HistoryStatus = { canUndo: boolean; canRedo: boolean };
export type IslandCanvasHandle = {
  undo: () => void;
  redo: () => void;
  clearEdits: () => void;
  setTopView: (top: boolean) => void;
  frameIsland: () => void;
};

type Props = {
  data: TerrainData;
  settings: IslandSettings;
  activeTool: BrushTool;
  brushRadius: number;
  brushStrength: number;
  activeLayer: number;
  viewMode: ViewMode;
  layers: CanvasLayers;
  hour: number;
  playMode: boolean;
  onPlayModeChange: (active: boolean) => void;
  onPlayerStatus: (status: PlayerStatus) => void;
  onHistoryChange: (status: HistoryStatus) => void;
  onEditChanged: () => void;
  onClearEdits: () => void;
};

type StrokeEntry = { index: number; values: Float32Array };
type HistoryState = {
  undo: Map<number, StrokeEntry>[];
  redo: Map<number, StrokeEntry>[];
  active: Map<number, StrokeEntry> | null;
};

function makeSnapshotEntry(data: TerrainData, index: number): StrokeEntry {
  const values = new Float32Array(9);
  values[0] = data.heights[index];
  values.set(data.blendWeights.subarray(index * 4, index * 4 + 4), 1);
  values[5] = data.vegetationMask[index];
  values.set(data.colors.subarray(index * 3, index * 3 + 3), 6);
  return { index, values };
}

function captureBrushRegion(data: TerrainData, x: number, y: number, radius: number, map: Map<number, StrokeEntry>) {
  const gx = Math.round((x + data.half) / data.cell);
  const gy = Math.round((y + data.half) / data.cell);
  const cells = Math.ceil(radius / data.cell);
  for (let iy = Math.max(0, gy - cells); iy <= Math.min(data.n - 1, gy + cells); iy++) {
    for (let ix = Math.max(0, gx - cells); ix <= Math.min(data.n - 1, gx + cells); ix++) {
      if (Math.hypot((ix - gx) * data.cell, (iy - gy) * data.cell) > radius) continue;
      const index = iy * data.n + ix;
      if (!map.has(index)) map.set(index, makeSnapshotEntry(data, index));
    }
  }
}

function restoreEntries(data: TerrainData, entries: Map<number, StrokeEntry>) {
  for (const { index, values } of entries.values()) {
    data.heights[index] = values[0];
    data.blendWeights.set(values.subarray(1, 5), index * 4);
    data.vegetationMask[index] = values[5];
    data.positions[index * 3 + 2] = values[0];
    data.colors.set(values.subarray(6, 9), index * 3);
  }
}

function restoreGeometry(geometry: THREE.BufferGeometry, data: TerrainData) {
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const col = geometry.getAttribute("color") as THREE.BufferAttribute;
  const blend = geometry.getAttribute("blendWeights") as THREE.BufferAttribute;
  for (let i = 0; i < data.heights.length; i++) {
    pos.setZ(i, data.heights[i]);
    col.setXYZ(i, data.colors[i * 3], data.colors[i * 3 + 1], data.colors[i * 3 + 2]);
    blend.setXYZW(i, data.blendWeights[i * 4], data.blendWeights[i * 4 + 1], data.blendWeights[i * 4 + 2], data.blendWeights[i * 4 + 3]);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  blend.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

function updateBrushPatch(geometry: THREE.BufferGeometry, data: TerrainData, x: number, y: number, radius: number) {
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const col = geometry.getAttribute("color") as THREE.BufferAttribute;
  const blend = geometry.getAttribute("blendWeights") as THREE.BufferAttribute;
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const gx = Math.round((x + data.half) / data.cell);
  const gy = Math.round((y + data.half) / data.cell);
  const cells = Math.ceil(radius / data.cell) + 2;
  for (let iy = Math.max(1, gy - cells); iy <= Math.min(data.n - 2, gy + cells); iy++) {
    for (let ix = Math.max(1, gx - cells); ix <= Math.min(data.n - 2, gx + cells); ix++) {
      const index = iy * data.n + ix;
      pos.setZ(index, data.heights[index]);
      col.setXYZ(index, data.colors[index * 3], data.colors[index * 3 + 1], data.colors[index * 3 + 2]);
      blend.setXYZW(index, data.blendWeights[index * 4], data.blendWeights[index * 4 + 1], data.blendWeights[index * 4 + 2], data.blendWeights[index * 4 + 3]);
      const nx = (data.heights[index - 1] - data.heights[index + 1]) / (2 * data.cell);
      const ny = (data.heights[index - data.n] - data.heights[index + data.n]) / (2 * data.cell);
      const length = Math.hypot(nx, ny, 1);
      normal.setXYZ(index, nx / length, ny / length, 1 / length);
    }
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  blend.needsUpdate = true;
  normal.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function TerrainMesh({
  data, settings, activeTool, brushRadius, brushStrength, activeLayer, viewMode,
  onStrokeStart, onStrokeEnd, recordStrokeRegion, refreshRevision,
}: {
  data: TerrainData;
  settings: IslandSettings;
  activeTool: BrushTool;
  brushRadius: number;
  brushStrength: number;
  activeLayer: number;
  viewMode: ViewMode;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
  recordStrokeRegion: (x: number, y: number, radius: number) => void;
  refreshRevision: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const brushRef = useRef<THREE.Mesh>(null);
  const isDown = useRef(false);
  const flattenTarget = useRef<number | undefined>(undefined);
  const lastTime = useRef(0);

  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    result.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    result.setAttribute("blendWeights", new THREE.BufferAttribute(data.blendWeights, 4));
    result.setIndex(new THREE.BufferAttribute(data.indices, 1));
    result.computeVertexNormals();
    result.computeBoundingSphere();
    return result;
  }, [data]);

  const material = useMemo(() => {
    if (viewMode === "wireframe") {
      return new THREE.MeshBasicMaterial({ color: "#8996b9", wireframe: true, transparent: true, opacity: 0.62 });
    }
    const mode = viewMode === "height" ? 1 : viewMode === "material" ? 2 : 0;
    const layerRoles = [0, 1, 2, 3] as const;
    const layerColors = settings.layers.map((layer, index) =>
      new THREE.Color(getGunwareMaterial(layer, layerRoles[index]).tint),
    );
    return new THREE.ShaderMaterial({
      uniforms: {
        uMaxHeight: { value: Math.max(1, data.maxHeight) },
        uViewMode: { value: mode },
        uLayer0: { value: layerColors[0] ?? new THREE.Color("#c8b17d") },
        uLayer1: { value: layerColors[1] ?? new THREE.Color("#3f713c") },
        uLayer2: { value: layerColors[2] ?? new THREE.Color("#77766e") },
        uLayer3: { value: layerColors[3] ?? new THREE.Color("#6e5f45") },
        uTexScale: { value: Math.max(1, settings.texScale) },
      },
      vertexShader: `
        attribute vec4 blendWeights;
        varying vec4 vWeights;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying float vHeight;
        void main() {
          vWeights = blendWeights;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vNormal = normalize(normalMatrix * normal);
          vHeight = position.z;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uMaxHeight;
        uniform float uViewMode;
        uniform vec3 uLayer0;
        uniform vec3 uLayer1;
        uniform vec3 uLayer2;
        uniform vec3 uLayer3;
        uniform float uTexScale;
        varying vec4 vWeights;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying float vHeight;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 5; i++) {
            value += noise2(p) * amplitude;
            p *= 2.03;
            amplitude *= 0.5;
          }
          return value;
        }
        void main() {
          vec4 weights = max(vWeights, vec4(0.0));
          weights /= max(dot(weights, vec4(1.0)), 0.0001);
          vec2 uv = vWorldPosition.xy / max(uTexScale, 1.0);
          float fine = fbm(uv * 1.65);
          float broad = fbm(uv * 0.34);
          float grain = noise2(uv * 13.0);
          float ridge = 1.0 - abs(noise2(uv * 2.8) * 2.0 - 1.0);

          vec3 sand = uLayer0 * (0.88 + fine * 0.18 + grain * 0.08);
          vec3 grass = uLayer1 * (0.72 + broad * 0.28 + fine * 0.12);
          vec3 rock = uLayer2 * (0.78 + ridge * 0.34 + fine * 0.07);
          vec3 dirt = uLayer3 * (0.78 + broad * 0.18 + grain * 0.10);
          vec3 color = sand * weights.r + grass * weights.g + rock * weights.b + dirt * weights.a;

          if (uViewMode > 0.5 && uViewMode < 1.5) {
            float h = clamp(vHeight / uMaxHeight, -0.25, 1.0);
            color = mix(vec3(0.055, 0.15, 0.22), vec3(0.25, 0.43, 0.26), smoothstep(0.0, 0.55, h));
            color = mix(color, vec3(0.72, 0.70, 0.63), smoothstep(0.62, 0.94, h));
          } else if (uViewMode > 1.5) {
            color = vec3(weights.r, weights.g, weights.b);
          }

          vec3 normal = normalize(vNormal);
          vec3 lightDirection = normalize(vec3(-0.42, -0.48, 0.77));
          float slopeShade = 0.80 + 0.20 * max(normal.z, 0.0);
          float diffuse = 0.66 + 0.34 * max(dot(normal, lightDirection), 0.0);
          float microShade = 0.97 + (noise2(uv * 3.0) - 0.5) * 0.08;
          color *= diffuse * slopeShade * microShade;
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,

      side: THREE.DoubleSide,
      toneMapped: true,
    });
  }, [viewMode, data.maxHeight, settings.layers, settings.texScale]);

  useEffect(() => {
    if (meshRef.current && refreshRevision > 0) restoreGeometry(meshRef.current.geometry, data);
  }, [refreshRevision, data]);

  useEffect(() => {
    if (!brushRef.current) return;
    brushRef.current.scale.setScalar(brushRadius);
    const mat = brushRef.current.material as THREE.MeshBasicMaterial;
    const color = activeTool === "paint"
      ? ["#cbb783", "#608b4d", "#77776f", "#795d42"][activeLayer]
      : activeTool === "lower" || activeTool === "erase" ? "#d97e73"
      : activeTool === "raise" ? "#7db04f"
      : activeTool === "vegRemove" ? "#d1a15d"
      : activeTool === "vegAdd" ? "#2eaa71" : "#8fb9bf";
    mat.color.set(color);
  }, [activeTool, activeLayer, brushRadius]);

  function applyAt(x: number, y: number, z: number, dt: number) {
    recordStrokeRegion(x, y, brushRadius);
    applyBrushInPlace(data, settings, x, y, activeTool, brushRadius, brushStrength, dt, activeLayer, flattenTarget.current);
    if (meshRef.current) updateBrushPatch(meshRef.current.geometry, data, x, y, brushRadius);
  }

  function pointerMove(event: any) {
    if (activeTool === "orbit") return;
    event.stopPropagation();
    const x = event.point.x, y = event.point.y;
    if (brushRef.current) {
      brushRef.current.position.set(x, y, event.point.z + 0.9);
      brushRef.current.visible = true;
    }
    if (!isDown.current) return;
    const now = performance.now();
    const dt = Math.max(0.012, Math.min(0.05, (now - lastTime.current) / 1000));
    lastTime.current = now;
    applyAt(x, y, event.point.z, dt);
  }

  function pointerDown(event: any) {
    if (activeTool === "orbit" || event.button !== 0) return;
    event.stopPropagation();
    (event.target as { setPointerCapture?: (pointerId: number) => void }).setPointerCapture?.(event.pointerId);
    const x = event.point.x, y = event.point.y;
    isDown.current = true;
    flattenTarget.current = event.point.z;
    lastTime.current = performance.now();
    onStrokeStart();
    applyAt(x, y, event.point.z, 0.03);
  }

  function pointerUp(event: any) {
    if (!isDown.current) return;
    event.stopPropagation();
    (event.target as { releasePointerCapture?: (pointerId: number) => void }).releasePointerCapture?.(event.pointerId);
    isDown.current = false;
    flattenTarget.current = undefined;
    if (meshRef.current) meshRef.current.geometry.computeVertexNormals();
    onStrokeEnd();
  }

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onPointerMove={pointerMove}
        onPointerDown={pointerDown}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onPointerOut={() => { if (brushRef.current) brushRef.current.visible = false; }}
        onPointerOver={() => { if (brushRef.current && activeTool !== "orbit") brushRef.current.visible = true; }}
      />
      <mesh ref={brushRef} position={[0, 0, -1000]} visible={false}>
        <ringGeometry args={[0.985, 1, 64]} />
        <meshBasicMaterial color="#f1d58a" transparent opacity={0.9} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
    </>
  );
}

function PropsBatch({ data, visible, vegetationRevision }: { data: TerrainData; visible: boolean; vegetationRevision: number }) {
  const split = useMemo(() => {
    const trees: number[] = [], rocks: number[] = [];
    for (let i = 0; i < data.props.length; i += 6) {
      const x = data.props[i], y = data.props[i + 1];
      const gx = Math.max(0, Math.min(data.n - 1, Math.round((x + data.half) / data.cell)));
      const gy = Math.max(0, Math.min(data.n - 1, Math.round((y + data.half) / data.cell)));
      const density = data.vegetationMask[gy * data.n + gx] ?? 0;
      if (density < 0.18) continue;
      const item = [...data.props.subarray(i, i + 6)];
      item[3] *= density;
      (item[5] > 0.5 ? rocks : trees).push(...item);
    }
    return { trees: new Float32Array(trees), rocks: new Float32Array(rocks) };
  }, [data, vegetationRevision]);
  const frondRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const frondGeo = useMemo(() => {
    const geometry = new THREE.ConeGeometry(0.13, 2.2, 5, 1);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }, []);
  const trunkGeo = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.08, 0.15, 2.5, 7);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }, []);
  const rockGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const frondMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3d7840", roughness: 1 }), []);
  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#806044", roughness: 1 }), []);
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#77766e", roughness: 1 }), []);
  useEffect(() => {
    const temp = new THREE.Object3D();
    const up = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < split.trees.length; i += 6) {
      const j = i / 6;
      const x = split.trees[i], y = split.trees[i + 1], z = split.trees[i + 2];
      const scale = split.trees[i + 3], rot = split.trees[i + 4];
      temp.position.set(x, y, z + scale * 1.1);
      temp.rotation.set(0, 0, rot);
      temp.scale.set(scale * 0.9, scale * 0.9, scale * 0.95);
      temp.updateMatrix();
      trunkRef.current?.setMatrixAt(j, temp.matrix);

      // Six tapered fronds create a readable low-poly tropical palm crown.
      for (let frond = 0; frond < 6; frond++) {
        const angle = rot + (frond / 6) * Math.PI * 2;
        const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.34).normalize();
        temp.position.set(x + Math.cos(angle) * scale * 0.33, y + Math.sin(angle) * scale * 0.33, z + scale * 2.2);
        temp.quaternion.setFromUnitVectors(up, direction);
        temp.scale.set(scale * 0.82, scale * 0.82, scale * 0.9);
        temp.updateMatrix();
        frondRef.current?.setMatrixAt(j * 6 + frond, temp.matrix);
      }
    }
    if (frondRef.current) frondRef.current.instanceMatrix.needsUpdate = true;
    if (trunkRef.current) trunkRef.current.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < split.rocks.length; i += 6) {
      const j = i / 6, x = split.rocks[i], y = split.rocks[i + 1], z = split.rocks[i + 2], scale = split.rocks[i + 3], rot = split.rocks[i + 4];
      temp.position.set(x, y, z + scale * 0.4);
      temp.rotation.set(rot * 0.25, rot, 0);
      temp.scale.set(scale, scale * 0.8, scale * 0.65);
      temp.updateMatrix();
      rockRef.current?.setMatrixAt(j, temp.matrix);
    }
    if (rockRef.current) rockRef.current.instanceMatrix.needsUpdate = true;
  }, [split]);
  return (
    <>
      <instancedMesh ref={frondRef} args={[frondGeo, frondMat, split.trees.length / 6 * 6]} visible={visible} castShadow receiveShadow />
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, split.trees.length / 6]} visible={visible} castShadow receiveShadow />
      <instancedMesh ref={rockRef} args={[rockGeo, rockMat, split.rocks.length / 6]} visible={visible} castShadow receiveShadow />
    </>
  );
}

function GrassBatch({ data, visible, vegetationRevision }: { data: TerrainData; visible: boolean; vegetationRevision: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => { const shape = new THREE.ConeGeometry(0.075, 0.58, 3); shape.rotateX(Math.PI / 2); return shape; }, []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: "#528c4a", roughness: 1 }), []);
  useEffect(() => {
    const temp = new THREE.Object3D();
    for (let i = 0; i < data.grass.length; i += 4) {
      const j = i / 4, x = data.grass[i], y = data.grass[i + 1], z = data.grass[i + 2], scale = data.grass[i + 3];
      const gx = Math.max(0, Math.min(data.n - 1, Math.round((x + data.half) / data.cell)));
      const gy = Math.max(0, Math.min(data.n - 1, Math.round((y + data.half) / data.cell)));
      const density = data.vegetationMask[gy * data.n + gx] ?? 0;
      temp.position.set(x, y, z + scale * 0.28);
      temp.rotation.set(0, 0, (j * 2.399) % (Math.PI * 2));
      temp.scale.setScalar(density < 0.12 ? 0 : scale * density);
      temp.updateMatrix();
      mesh.current?.setMatrixAt(j, temp.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [data, vegetationRevision]);
  return <instancedMesh ref={mesh} args={[geometry, material, data.grass.length / 4]} visible={visible} castShadow />;
}

function Ocean({ size, visible, waves }: { size: number; visible: boolean; waves: boolean }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, uWaves: { value: waves ? 1 : 0 } },
    vertexShader: `varying vec2 vUv; uniform float uTime; uniform float uWaves;
      void main(){ vUv=uv; vec3 p=position; p.z += sin(p.x*0.0018+uTime*0.6)*0.25*uWaves + cos(p.y*0.0024-uTime*0.4)*0.18*uWaves; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){ float w=sin(vUv.x*80.0+uTime)*0.025+cos(vUv.y*68.0-uTime*0.7)*0.02; vec3 c=mix(vec3(0.015,0.12,0.20),vec3(0.035,0.38,0.47),clamp(vUv.y*0.7+0.25+w,0.0,1.0)); gl_FragColor=vec4(c,0.94); }`,
    depthWrite: false,
  }), [waves]);
  useFrame((state) => { material.uniforms.uTime.value = state.clock.elapsedTime; });
  return <mesh position={[0, 0, -0.5]} visible={visible}><planeGeometry args={[size * 1.8, size * 1.8]} /><primitive object={material} attach="material" /></mesh>;
}

function Player({
  data, active, onStatus, onExit,
}: {
  data: TerrainData;
  active: boolean;
  onStatus: (status: PlayerStatus) => void;
  onExit: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const position = useRef(new THREE.Vector3(0, 0, 1));
  const direction = useRef(new THREE.Vector3());
  const firstPerson = useRef(false);
  const verticalVelocity = useRef(0);
  const lastReport = useRef(0);
  const body = useMemo(() => new THREE.CapsuleGeometry(0.34, 0.95, 4, 8), []);
  const shirt = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4b79a0", roughness: 0.9 }), []);
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d1a37c", roughness: 1 }), []);

  useEffect(() => {
    if (!active) return;
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keys.current.add(key);
      if (key === "c") firstPerson.current = !firstPerson.current;
      if (key === "escape") { keys.current.delete("escape"); onExit(); }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      keys.current.clear();
    };
  }, [active, onExit]);

  useFrame((_, delta) => {
    if (!active || !group.current) return;
    const dt = Math.min(delta, 0.05), k = keys.current;
    const forward = (k.has("w") || k.has("z") ? 1 : 0) - (k.has("s") ? 1 : 0);
    const side = (k.has("d") ? 1 : 0) - (k.has("a") || k.has("q") ? 1 : 0);
    const length = Math.hypot(forward, side) || 1;
    const sprint = k.has("shift"), walk = k.has("alt");
    const speed = sprint ? 17 : walk ? 2.4 : 6.2;
    direction.current.set(side / length, forward / length, 0);
    position.current.x += direction.current.x * speed * dt;
    position.current.y += direction.current.y * speed * dt;
    position.current.x = THREE.MathUtils.clamp(position.current.x, -data.half * 0.92, data.half * 0.92);
    position.current.y = THREE.MathUtils.clamp(position.current.y, -data.half * 0.92, data.half * 0.92);
    const ix = THREE.MathUtils.clamp(Math.round((position.current.x + data.half) / data.cell), 0, data.n - 1);
    const iy = THREE.MathUtils.clamp(Math.round((position.current.y + data.half) / data.cell), 0, data.n - 1);
    const index = iy * data.n + ix;
    const ground = data.heights[index], swimming = data.land[index] < 0.3;
    if (k.has(" ") && position.current.z <= ground + 1.1) verticalVelocity.current = 6;
    verticalVelocity.current -= 18 * dt;
    position.current.z += verticalVelocity.current * dt;
    const floor = swimming ? 0.2 : ground + 1.05;
    if (position.current.z < floor) { position.current.z = floor; verticalVelocity.current = 0; }
    group.current.position.copy(position.current);
    if (forward || side) group.current.rotation.z = Math.atan2(side, forward);
    if (firstPerson.current) {
      camera.position.set(position.current.x, position.current.y, position.current.z + 0.42);
      camera.lookAt(position.current.x + direction.current.x * 10, position.current.y + direction.current.y * 10, position.current.z + 0.35);
    } else {
      const target = new THREE.Vector3(position.current.x + 12, position.current.y - 17, position.current.z + 9);
      camera.position.lerp(target, 1 - Math.pow(0.001, dt));
      camera.lookAt(position.current.x, position.current.y, position.current.z + 1.0);
    }
    if (performance.now() - lastReport.current > 120) {
      lastReport.current = performance.now();
      onStatus({ x: position.current.x, y: position.current.y, z: position.current.z, speed: (forward || side) ? speed : 0, swimming, firstPerson: firstPerson.current });
    }
  });

  return (
    <group ref={group} visible={active} position={[0, 0, 1]}>
      <mesh geometry={body} position={[0, 0, 0.72]} material={shirt} castShadow />
      <mesh position={[0, 0, 1.55]} material={skin} castShadow><sphereGeometry args={[0.25, 12, 12]} /></mesh>
    </group>
  );
}

function IslandScene({
  data, settings, activeTool, brushRadius, brushStrength, activeLayer, viewMode, layers, hour,
  playMode, onPlayModeChange, onPlayerStatus, onHistoryChange, onEditChanged,
  history, refreshRevision, topView,
}: Props & {
  history: MutableRefObject<HistoryState>;
  refreshRevision: number;
  topView: boolean;
}) {
  const controls = useRef<any>(null);
  const [vegetationRevision, setVegetationRevision] = useState(0);
  const ambient = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const { camera } = useThree();
  const recordStrokeRegion = (x: number, y: number, radius: number) => {
    const active = history.current.active;
    if (active) captureBrushRegion(data, x, y, radius, active);
  };
  const onStrokeStart = () => { history.current.active = new Map(); };
  const onStrokeEnd = () => {
    const active = history.current.active;
    if (active?.size) {
      history.current.undo.push(active);
      if (history.current.undo.length > 12) history.current.undo.shift();
      history.current.redo = [];
    }
    history.current.active = null;
    setVegetationRevision((revision) => revision + 1);
    onHistoryChange({ canUndo: history.current.undo.length > 0, canRedo: history.current.redo.length > 0 });
    onEditChanged();
  };

  useEffect(() => {
    camera.up.set(0, 0, 1);
    if (topView) {
      camera.position.set(0, 0, settings.worldSize * 1.5 + 200);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      if (controls.current) {
        controls.current.target.set(0, 0, 0);
        controls.current.enableRotate = false;
        controls.current.update();
      }
    } else {
      camera.up.set(0, 0, 1);
      camera.position.set(settings.worldSize * 0.62, -settings.worldSize * 0.75, Math.max(350, data.maxHeight * 2.3));
      camera.lookAt(0, 0, data.maxHeight * 0.1);
      if (controls.current) {
        controls.current.target.set(0, 0, data.maxHeight * 0.1);
        controls.current.enableRotate = true;
        controls.current.update();
      }
    }
  }, [camera, data, settings.worldSize, topView]);

  useEffect(() => {
    if (controls.current) controls.current.enabled = !playMode && activeTool === "orbit";
  }, [playMode, activeTool]);

  useFrame(() => {
    const normalized = (hour - 6) / 12;
    const sunHeight = Math.max(0.08, Math.sin(Math.PI * normalized));
    const angle = (hour - 12) * 0.22;
    sun.current?.position.set(Math.cos(angle) * 8000, Math.sin(angle) * 8000, 2500 + sunHeight * 6000);
    if (sun.current) sun.current.intensity = 0.65 + sunHeight * 2.15;
    if (ambient.current) ambient.current.intensity = 0.35 + sunHeight * 0.4;
  });

  const exitPlay = () => onPlayModeChange(false);
  const foliageRevision = vegetationRevision + refreshRevision;

  return (
    <>
      <ambientLight ref={ambient} intensity={0.75} />
      <directionalLight ref={sun} position={[-3000, -2000, 7000]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} />
      <Ocean size={settings.worldSize} visible={layers.water} waves={settings.waves} />
      <TerrainMesh
        data={data} settings={settings} activeTool={activeTool}
        brushRadius={brushRadius} brushStrength={brushStrength}
        activeLayer={activeLayer} viewMode={viewMode}
        onStrokeStart={onStrokeStart} onStrokeEnd={onStrokeEnd}
        recordStrokeRegion={recordStrokeRegion} refreshRevision={refreshRevision}
      />
      <PropsBatch data={data} visible={layers.props} vegetationRevision={foliageRevision} />
      <GrassBatch data={data} visible={layers.grass} vegetationRevision={foliageRevision} />
      {layers.grid && <gridHelper args={[settings.worldSize, 32, "#53657d", "#26374b"]} position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]} />}
      {layers.chunks && <gridHelper args={[settings.worldSize, 8, "#c18c4b", "#6a6047"]} position={[0, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]} />}
      {layers.context && data.landmarks.map((mark) => (
        <group key={mark.id} position={[mark.x, mark.y, mark.z + 1.2]}>
          <mesh><sphereGeometry args={[Math.max(4, settings.worldSize / 420), 10, 10]} /><meshBasicMaterial color={mark.type === "city" ? "#e8bc76" : mark.type === "port" ? "#78c3d2" : mark.type === "airport" ? "#9d9af0" : "#84bf8f"} /></mesh>
        </group>
      ))}
      <Player data={data} active={playMode} onExit={exitPlay} onStatus={(status) => onPlayerStatus({
        ...status, x: status.x + settings.originX, y: status.y + settings.originY,
      })} />
      <OrbitControls
        ref={controls}
        makeDefault
        enabled={!playMode && (activeTool === "orbit" || topView)}
        enableDamping
        dampingFactor={0.08}
        minDistance={settings.worldSize * 0.08}
        maxDistance={settings.worldSize * 3.4}
        maxPolarAngle={Math.PI * 0.49}
        target={[0, 0, Math.max(0, data.maxHeight * 0.12)]}
      />
    </>
  );
}

const IslandCanvas = forwardRef<IslandCanvasHandle, Props>(function IslandCanvas(props, ref) {
  const history = useRef<HistoryState>({ undo: [], redo: [], active: null });
  const [topView, setTopView] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);

  const restore = (entries: Map<number, StrokeEntry>) => {
    restoreEntries(props.data, entries);
    setRefreshRevision((value) => value + 1);
    props.onEditChanged();
  };

  useImperativeHandle(ref, () => ({
    undo: () => {
      const entries = history.current.undo.pop();
      if (!entries) return;
      const reverse = new Map<number, StrokeEntry>();
      for (const index of entries.keys()) reverse.set(index, makeSnapshotEntry(props.data, index));
      history.current.redo.push(reverse);
      restore(entries);
      props.onHistoryChange({ canUndo: history.current.undo.length > 0, canRedo: true });
    },
    redo: () => {
      const entries = history.current.redo.pop();
      if (!entries) return;
      const reverse = new Map<number, StrokeEntry>();
      for (const index of entries.keys()) reverse.set(index, makeSnapshotEntry(props.data, index));
      history.current.undo.push(reverse);
      restore(entries);
      props.onHistoryChange({ canUndo: history.current.undo.length > 0, canRedo: history.current.redo.length > 0 });
    },
    clearEdits: () => { props.onClearEdits(); history.current = { undo: [], redo: [], active: null }; },
    setTopView: (top) => setTopView(top),
    frameIsland: () => setTopView(false),
  }), [props.data, props.onClearEdits, props.onEditChanged, props.onHistoryChange]);

  useEffect(() => {
    history.current = { undo: [], redo: [], active: null };
    props.onHistoryChange({ canUndo: false, canRedo: false });
  }, [props.data]);

  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      shadows
      camera={{ position: [props.settings.worldSize * 0.65, -props.settings.worldSize * 0.8, Math.max(900, props.settings.maxHeight * 2)], fov: 42, near: 0.1, far: 60000, up: [0, 0, 1] }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor("#121a28");
        camera.up.set(0, 0, 1);
      }}
    >
      <color attach="background" args={["#121a28"]} />
      <fog attach="fog" args={["#121a28", props.settings.worldSize * 1.4, props.settings.worldSize * 4.2]} />
      <IslandScene
        {...props}
        history={history}
        refreshRevision={refreshRevision}
        topView={topView}
      />
    </Canvas>
  );
});

export default IslandCanvas;
