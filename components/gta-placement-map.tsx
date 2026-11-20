"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

export const GTA_LOCATION_PRESETS = [
  { label: "Sud-ouest", x: -3450, y: -3450 },
  { label: "Ouest de Los Santos", x: -5200, y: -1800 },
  { label: "Sud de Los Santos", x: -1200, y: -5600 },
  { label: "Ouest de Chumash", x: -5600, y: 2600 },
  { label: "Nord de Paleto Bay", x: -300, y: 9000 },
  { label: "Est de la map", x: 6600, y: 2400 },
  { label: "Vers Cayo Perico", x: 1800, y: -6800 },
  { label: "Large ouest", x: -12000, y: 0 },
  { label: "Large nord", x: 0, y: 13000 },
];

type Props = {
  x: number;
  y: number;
  size: number;
  ignoreGtaMap: boolean;
  onMove: (x: number, y: number) => void;
};

const WORLD_MIN = -17500;
const WORLD_MAX = 17500;

export default function GtaPlacementMap({ x, y, size, ignoreGtaMap, onMove }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef(false);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const width = element.width, height = element.height;
    const worldToCanvas = (wx: number, wy: number) => [
      ((wx - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)) * width,
      height - ((wy - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)) * height,
    ];
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0c1824";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(130,157,188,.10)";
    ctx.lineWidth = 1;
    for (let v = WORLD_MIN; v <= WORLD_MAX; v += 2500) {
      const [px] = worldToCanvas(v, 0);
      const [, py] = worldToCanvas(0, v);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
    }

    const mainland = [
      [-9400, -4200], [-9000, -7600], [-6900, -9200], [-2500, -9900],
      [1600, -8800], [5500, -7000], [8800, -4100], [9500, 500],
      [8500, 5200], [6500, 9300], [2200, 10800], [-2200, 10900],
      [-5200, 8500], [-7600, 5700], [-8800, 1800],
    ];
    ctx.beginPath();
    mainland.forEach((point, index) => {
      const [px, py] = worldToCanvas(point[0], point[1]);
      if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = ignoreGtaMap ? "rgba(51,79,88,.18)" : "rgba(59,75,93,.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(125,150,177,.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const places = [
      { label: "Los Santos", x: 300, y: -1100 },
      { label: "Sandy Shores", x: 1700, y: 3600 },
      { label: "Paleto Bay", x: -200, y: 6500 },
      { label: "Cayo Perico", x: 4900, y: -5700 },
    ];
    for (const place of places) {
      const [px, py] = worldToCanvas(place.x, place.y);
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = place.label === "Cayo Perico" ? "#c99b64" : "#9caabc";
      ctx.fill();
      ctx.fillStyle = "#a7b4c4";
      ctx.font = "10px Montserrat, sans-serif";
      ctx.fillText(place.label, px + 7, py - 6);
    }

    const [ix, iy] = worldToCanvas(x, y);
    const scale = width / (WORLD_MAX - WORLD_MIN);
    const side = size * scale;
    ctx.fillStyle = "rgba(81,129,220,.16)";
    ctx.strokeStyle = "#6e91ee";
    ctx.lineWidth = 2;
    ctx.fillRect(ix - side / 2, iy - side / 2, side, side);
    ctx.strokeRect(ix - side / 2, iy - side / 2, side, side);
    ctx.beginPath(); ctx.arc(ix, iy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#9ab5ff"; ctx.fill();
    ctx.strokeStyle = "#f0f4ff"; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = "#dbe5ff";
    ctx.font = "10px Montserrat, sans-serif";
    ctx.fillText("Votre île", ix + 9, iy + 14);

    ctx.strokeStyle = "rgba(220,230,245,.65)";
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }, [x, y, size, ignoreGtaMap]);

  const pick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = (event.clientX - rect.left) * (event.currentTarget.width / rect.width);
    const cy = (event.clientY - rect.top) * (event.currentTarget.height / rect.height);
    const wx = WORLD_MIN + (cx / event.currentTarget.width) * (WORLD_MAX - WORLD_MIN);
    const wy = WORLD_MIN + (1 - cy / event.currentTarget.height) * (WORLD_MAX - WORLD_MIN);
    onMove(Math.round(wx / 10) * 10, Math.round(wy / 10) * 10);
  };

  return (
    <canvas
      ref={canvas}
      width={640}
      height={460}
      className="gta-map-canvas"
      onPointerDown={(event) => { drag.current = true; event.currentTarget.setPointerCapture(event.pointerId); pick(event); }}
      onPointerMove={(event) => { if (drag.current) pick(event); }}
      onPointerUp={() => { drag.current = false; }}
      onPointerCancel={() => { drag.current = false; }}
      aria-label="Carte de placement GTA, glisser pour déplacer l'île"
    />
  );
}

export function getPlacementVerdict(x: number, y: number, size: number, ignoreGtaMap: boolean) {
  const half = size / 2;
  const bounds = { minX: x - half, maxX: x + half, minY: y - half, maxY: y + half };
  if (bounds.minX < WORLD_MIN || bounds.maxX > WORLD_MAX || bounds.minY < WORLD_MIN || bounds.maxY > WORLD_MAX) {
    return { level: "error" as const, label: "Hors des limites du monde", issues: ["L'île dépasse la zone de coordonnées configurée."] };
  }
  if (!ignoreGtaMap) {
    const losSantos = { minX: -4800, maxX: 3700, minY: -5200, maxY: 2500 };
    const blaineCounty = { minX: -6200, maxX: 6800, minY: 2100, maxY: 10300 };
    const cayo = { minX: 4200, maxX: 6100, minY: -6900, maxY: -4700 };
    const overlaps = (a: {minX:number;maxX:number;minY:number;maxY:number}, b: typeof bounds) => a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
    if (overlaps(losSantos, bounds) || overlaps(blaineCounty, bounds) || overlaps(cayo, bounds)) {
      return { level: "warn" as const, label: "Chevauchement possible", issues: ["Cette estimation peut recouper Los Santos, Blaine County ou Cayo Perico.", "Active « Map GTA supprimée » si ton serveur retire le monde original, puis vérifie dans CodeWalker."] };
    }
  }
  return { level: "ok" as const, label: "Emplacement disponible", issues: ["Vérification géographique indicative : charger les données du monde GTA pour confirmer les chevauchements."] };
}
