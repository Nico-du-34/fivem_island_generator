"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { TerrainData } from "@/lib/terrain";

export type GtaMapStyle = "satelite" | "atlas" | "grid";
export type GtaMapMode = "2d" | "3d";
export type GtaPlacedAsset = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  scale: number;
};

type Props = {
  x: number;
  y: number;
  size: number;
  mode: GtaMapMode;
  style: GtaMapStyle;
  terrain: TerrainData | null;
  assets: GtaPlacedAsset[];
  onMove: (x: number, y: number) => void;
};

const TILE_ROOT = "https://viruxe.github.io/gtav-map-tiles";
const IMAGE_SIZE = 8192;
const ZOOM_3D = 2;
const MAP_SIZE_3D = 256 * 2 ** ZOOM_3D;

// Calibration adapted from the FiveMAd GTA-world Leaflet CRS to the
// 8192px master used by gtav-map-tiles. One helper serves both map views.
export function gtaWorldToMapPixel(x: number, y: number) {
  return {
    x: (0.02072 * x + 117.3) * 32,
    y: (-0.0205 * y + 172.8) * 32,
  };
}

export function gtaMapPixelToWorld(x: number, y: number) {
  return {
    x: (x / 32 - 117.3) / 0.02072,
    y: (172.8 - y / 32) / 0.0205,
  };
}

function MapTile({ style, tx, ty }: { style: GtaMapStyle; tx: number; ty: number }) {
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    return loader.load(`${TILE_ROOT}/${style}/${ZOOM_3D}/${tx}-${ty}.webp`);
  }, [style, tx, ty]);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return () => texture.dispose();
  }, [texture]);

  return (
    <mesh position={[tx * 256 - MAP_SIZE_3D / 2 + 128, MAP_SIZE_3D / 2 - ty * 256 - 128, -2]}>
      <planeGeometry args={[256, 256]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function WorldTiles({ style }: { style: GtaMapStyle }) {
  const tiles = useMemo(() => Array.from({ length: 16 }, (_, index) => ({
    x: index % 4,
    y: Math.floor(index / 4),
  })), []);
  return <>{tiles.map((tile) => <MapTile key={tile.x + "-" + tile.y} style={style} tx={tile.x} ty={tile.y} />)}</>;
}

function TerrainOnWorldMap({ data, x, y, size }: {
  data: TerrainData | null; x: number; y: number; size: number;
}) {
  const geometry = useMemo(() => {
    if (!data) return null;
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(new Float32Array(data.positions), 3));
    result.setAttribute("color", new THREE.BufferAttribute(new Float32Array(data.colors), 3));
    result.setIndex(new THREE.BufferAttribute(new Uint32Array(data.indices), 1));
    result.computeVertexNormals();
    result.computeBoundingSphere();
    return result;
  }, [data]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  const map = gtaWorldToMapPixel(x, y);
  const centerX = map.x / 8 - MAP_SIZE_3D / 2;
  const centerY = MAP_SIZE_3D / 2 - map.y / 8;
  const worldToMapX = 0.02072 * 4;
  const worldToMapY = 0.0205 * 4;

  return (
    <group position={[centerX, centerY, 0]} scale={[worldToMapX, worldToMapY, worldToMapX]}>
      {geometry && (
        <mesh geometry={geometry} receiveShadow castShadow>
          <meshStandardMaterial vertexColors roughness={0.96} metalness={0.02} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh position={[0, 0, -0.8]}>
        <boxGeometry args={[size, size, 1.1]} />
        <meshBasicMaterial color="#7996ff" wireframe transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 0, 1.8]}>
        <sphereGeometry args={[Math.max(7, size * 0.012), 16, 12]} />
        <meshBasicMaterial color="#9ab4ff" />
      </mesh>
    </group>
  );
}

function AssetPins({ assets }: { assets: GtaPlacedAsset[] }) {
  return (
    <>
      {assets.map((asset) => {
        const point = gtaWorldToMapPixel(asset.x, asset.y);
        const x = point.x / 8 - MAP_SIZE_3D / 2;
        const y = MAP_SIZE_3D / 2 - point.y / 8;
        return (
          <group key={asset.id} position={[x, y, Math.max(1, asset.z * 0.08288 + 2)]}>
            <mesh>
              <sphereGeometry args={[2.8, 10, 8]} />
              <meshBasicMaterial color="#f6b75b" />
            </mesh>
            <Html distanceFactor={180} center style={{ pointerEvents: "none" }}>
              <span className="world-asset-label">{asset.name}</span>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function ThreeDWorld({ style, terrain, x, y, size, assets }: Omit<Props, "mode" | "onMove">) {
  return (
    <Canvas
      camera={{ position: [0, -720, 760], up: [0, 0, 1], near: 0.1, far: 8000, fov: 42 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={["#0a111c"]} />
      <ambientLight intensity={1.7} />
      <directionalLight position={[-250, -350, 700]} intensity={2.1} />
      <Suspense fallback={null}>
        <WorldTiles style={style} />
        <TerrainOnWorldMap data={terrain} x={x} y={y} size={size} />
        <AssetPins assets={assets} />
      </Suspense>
      <gridHelper args={[1024, 32, "#55718b", "#243449"]} position={[0, 0, -2]} rotation={[Math.PI / 2, 0, 0]} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.09} minDistance={130} maxDistance={3000} target={[0, 0, 0]} />
    </Canvas>
  );
}

export default function GtaWorldView(props: Props) {
  const mapElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.mode !== "2d" || !mapElement.current) return;
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void import("leaflet").then((leaflet) => {
      if (disposed || !mapElement.current) return;
      const L = leaflet;
      map = L.map(mapElement.current, {
        crs: L.CRS.Simple,
        minZoom: 0,
        maxZoom: 5,
        zoomSnap: 0.25,
        zoomControl: false,
        attributionControl: false,
        maxBoundsViscosity: 0.78,
      });
      const bounds: L.LatLngBoundsExpression = [[0, 0], [IMAGE_SIZE, IMAGE_SIZE]];
      L.tileLayer(`${TILE_ROOT}/${props.style}/{z}/{x}-{y}.webp`, {
        minZoom: 0,
        maxZoom: 5,
        noWrap: true,
        bounds,
        keepBuffer: 4,
        updateWhenIdle: true,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.setMaxBounds(bounds);

      const current = gtaWorldToMapPixel(props.x, props.y);
      map.setView([current.y, current.x], 2.1, { animate: false });

      const marker = L.circleMarker([current.y, current.x], {
        radius: 7,
        color: "#eef2ff",
        weight: 2,
        fillColor: "#7898ff",
        fillOpacity: 0.98,
      }).addTo(map).bindTooltip("Centre de votre île", { direction: "top" });

      const half = props.size / 2;
      const nw = gtaWorldToMapPixel(props.x - half, props.y + half);
      const se = gtaWorldToMapPixel(props.x + half, props.y - half);
      L.rectangle([[nw.y, nw.x], [se.y, se.x]], {
        color: "#7898ff",
        weight: 2,
        fillColor: "#7898ff",
        fillOpacity: 0.12,
        dashArray: "5 4",
      }).addTo(map);

      const pins = L.layerGroup().addTo(map);
      for (const asset of props.assets) {
        const p = gtaWorldToMapPixel(asset.x, asset.y);
        L.circleMarker([p.y, p.x], {
          radius: 5,
          color: "#ffe0a8",
          weight: 1,
          fillColor: "#eea64d",
          fillOpacity: 1,
        }).addTo(pins).bindTooltip(asset.name, { direction: "top" });
      }

      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        const world = gtaMapPixelToWorld(event.latlng.lng, event.latlng.lat);
        props.onMove(Math.round(world.x / 10) * 10, Math.round(world.y / 10) * 10);
      });
      resizeObserver = new ResizeObserver(() => map?.invalidateSize());
      resizeObserver.observe(mapElement.current);
      window.setTimeout(() => map?.invalidateSize(), 40);
    }).catch((error) => {
      console.error("Impossible de charger la carte GTA :", error);
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      map?.remove();
      map = null;
    };
  }, [props.mode, props.style, props.x, props.y, props.size, props.assets, props.onMove]);

  if (props.mode === "3d") {
    return (
      <div className="gta-world-stage">
        <ThreeDWorld style={props.style} terrain={props.terrain} x={props.x} y={props.y} size={props.size} assets={props.assets} />
        <div className="gta-world-3d-caption">Carte GTA en perspective · relief 3D de l'île générée</div>
      </div>
    );
  }

  return (
    <div className="gta-world-stage">
      <div ref={mapElement} className="gta-world-leaflet" aria-label="Carte GTA V interactive" />
      <div className="gta-world-credit">Carte GTA V non officielle · <a href="https://github.com/VIRUXE/gtav-map-tiles" target="_blank" rel="noreferrer">VIRUXE / GTA V Map Tiles</a></div>
    </div>
  );
}
