"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Anchor, AlertTriangle, ArrowDownToLine, Check, ChevronDown, CircleHelp,
  Clock3, Compass, Dice5, Download, Eye, EyeOff, Grid2X2, Info, Layers3,
  Loader2, Map, MapPin, Maximize2, Mountain, Move, Paintbrush, Play,
  Redo2, RefreshCw, RotateCcw, Ruler, Sun, Trees, Undo2, Waves, X,
} from "lucide-react";
import GtaPlacementMap, { getPlacementVerdict, GTA_LOCATION_PRESETS } from "@/components/gta-placement-map";
import {
  DEFAULT_SETTINGS, MATERIAL_OPTIONS, PRESETS, SHAPES, WORLD_SIZES,
  allowedCellSizes, allowedMeshCells, formatWorldSize,
  type IslandSettings, type TerrainData, type MaterialLayer,
} from "@/lib/terrain";
import { GUNWARE_MATERIALS_BY_ROLE } from "@/lib/gunware-materials";
import { generateIslandAsync } from "@/lib/generation-client";
import { exportIslandPackage } from "@/lib/exporter";
import type { BrushTool, CanvasLayers, HistoryStatus, IslandCanvasHandle, PlayerStatus, ViewMode } from "@/components/island-canvas";

const IslandCanvas = dynamic(() => import("@/components/island-canvas"), { ssr: false });

function SliderField({
  label, value, min, max, step = 0.01, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  format?: (value: number) => string; onChange: (value: number) => void;
}) {
  return (
    <label className="setting-slider">
      <span className="setting-label"><span>{label}</span><strong>{format ? format(value) : value.toLocaleString("fr-FR")}</strong></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="setting-range"><small>{format ? format(min) : min.toLocaleString("fr-FR")}</small><small>{format ? format(max) : max.toLocaleString("fr-FR")}</small></span>
    </label>
  );
}

function NumberField({
  label, value, suffix = "", step = 1, onChange,
}: { label: string; value: number; suffix?: string; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div><input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />{suffix && <em>{suffix}</em>}</div>
    </label>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="setting-section">
      <button className="setting-section-head" onClick={() => setOpen(!open)} type="button">
        <span>{title}</span><ChevronDown size={13} className={open ? "" : "chevron-closed"} />
      </button>
      {open && <div className="setting-section-body">{children}</div>}
    </section>
  );
}

function CheckLine({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="check-line"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="fake-check"><Check size={10} /></span><span>{label}</span></label>;
}

function ChipList({ values, selected, onChange }: { values: string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="chip-list">
      {values.map((value) => (
        <button type="button" key={value} className={selected.includes(value) ? "type-chip is-selected" : "type-chip"} onClick={() => {
          onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
        }}>{value.replaceAll("_", " ")}</button>
      ))}
    </div>
  );
}

function TerrainPanel({
  settings, update, generate, dirty, busy,
}: {
  settings: IslandSettings;
  update: <K extends keyof IslandSettings>(key: K, value: IslandSettings[K]) => void;
  generate: () => void;
  dirty: boolean;
  busy: boolean;
}) {
  const cellChoices = allowedCellSizes(settings.worldSize);
  const meshChoices = allowedMeshCells(settings.worldSize, settings.cellSize);
  const maxHeight = Math.round(Math.max(260, Math.min(800, settings.worldSize / 12)));
  return (
    <div className="tab-pane">
      <div className="tab-head">Terrain</div>
      <div className="tab-sub">Géographie, relief et érosion procédurale</div>
      <Section title="Taille & forme">
        <div className="shape-grid">
          {SHAPES.map((shape) => (
            <button type="button" key={shape.id} className={settings.shape === shape.id ? "shape-option is-active" : "shape-option"} onClick={() => update("shape", shape.id)}>
              <span className={"shape-preview shape-" + shape.id} />
              <span>{shape.label}</span>
            </button>
          ))}
        </div>
        <div className="setting-slider size-slider">
          <span className="setting-label"><span>Taille de la carte</span><strong>{formatWorldSize(settings.worldSize)}</strong></span>
          <input type="range" min="0" max={WORLD_SIZES.length - 1} step="1" value={Math.max(0, WORLD_SIZES.indexOf(settings.worldSize))} onChange={(event) => {
            const size = WORLD_SIZES[Number(event.target.value)];
            const cells = allowedCellSizes(size);
            const cellSize = cells[0] ?? 4;
            const meshes = allowedMeshCells(size, cellSize);
            update("worldSize", size);
            update("cellSize", cellSize);
            update("meshCell", meshes.includes(2) ? 2 : (meshes[0] ?? cellSize));
          }} />
          <div className="size-value-row"><small>512 m</small><small>16 km</small></div>
        </div>
        <div className="two-field-grid">
          <label className="select-field"><span>Précision</span><select value={settings.cellSize} onChange={(event) => {
            const cell = Number(event.target.value);
            update("cellSize", cell);
            const meshes = allowedMeshCells(settings.worldSize, cell);
            update("meshCell", meshes.includes(settings.meshCell) ? settings.meshCell : (meshes.includes(2) ? 2 : (meshes[0] ?? cell)));
          }}>{cellChoices.map((cell) => <option key={cell} value={cell}>{cell === 1 ? "1 m (lourd)" : cell + " m"}</option>)}</select></label>
          <label className="select-field"><span>Détail</span><select value={settings.meshCell} onChange={(event) => update("meshCell", Number(event.target.value))}>{meshChoices.map((cell) => <option key={cell} value={cell}>{cell === 1 ? "1 m (très lourd)" : cell + " m"}</option>)}</select></label>
        </div>
        <SliderField label="Surface de terre" value={settings.coverage} min={0.3} max={0.9} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("coverage", v)} />
        <SliderField label="Côte découpée" value={settings.coastNoise} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("coastNoise", v)} />
        <SliderField label="Distorsion" value={settings.warp} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("warp", v)} />
      </Section>
      <Section title="Relief">
        <SliderField label="Altitude max" value={settings.maxHeight} min={8} max={maxHeight} step={1} format={(v) => Math.round(v) + " m"} onChange={(v) => update("maxHeight", v)} />
        <SliderField label="Montagnes" value={settings.mountains} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("mountains", v)} />
        <SliderField label="Collines" value={settings.hills} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("hills", v)} />
        <SliderField label="Plateaux" value={settings.terraces} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("terraces", v)} />
        <SliderField label="Profondeur au large" value={settings.seaDepth} min={10} max={200} step={1} format={(v) => Math.round(v) + " m"} onChange={(v) => update("seaDepth", v)} />
      </Section>
      <Section title="Érosion">
        <SliderField label="Hydraulique" value={settings.erosion} min={0} max={1.5} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("erosion", v)} />
        <SliderField label="Thermique" value={settings.thermal} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("thermal", v)} />
        <p className="setting-note">L'érosion hydraulique simule le ruissellement. L'érosion thermique adoucit les pentes et les arêtes.</p>
      </Section>
      <Section title="Plages">
        <SliderField label="Largeur des plages" value={settings.beachWidth} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("beachWidth", v)} />
        <SliderField label="Hauteur du sable" value={settings.beachHeight} min={0.5} max={6} step={0.1} format={(v) => v.toFixed(1) + " m"} onChange={(v) => update("beachHeight", v)} />
      </Section>
      <div className="panel-generate">
        <button className="btn primary btn-wide" onClick={generate} disabled={busy}><RefreshCw size={14} className={busy ? "spin" : ""} />{busy ? "Génération…" : dirty ? "Régénérer la carte" : "Générer la carte"}</button>
        <small>Les modifications sont appliquées après génération.</small>
      </div>
    </div>
  );
}

function SurfacePanel({
  settings, update, layers, setLayer,
}: {
  settings: IslandSettings;
  update: <K extends keyof IslandSettings>(key: K, value: IslandSettings[K]) => void;
  layers: CanvasLayers;
  setLayer: (key: keyof CanvasLayers, value: boolean) => void;
}) {
  const types = {
    grass: ["proc_grasses01", "proc_grassplantmix_01", "proc_meadowmix_01", "proc_grassfronds01"],
    trees: ["prop_palm_med_01b", "prop_palm_sm_01e", "prop_palm_fan_03_c", "prop_palm_fan_04_b"],
    rocks: ["prop_rock_1_d", "prop_rock_3_a", "prop_rock_3_h", "prop_rock_4_c", "prop_rock_4_d"],
  };
  return (
    <div className="tab-pane">
      <div className="tab-head">Surface</div>
      <div className="tab-sub">Matériaux, herbe, arbres et rochers</div>
      <Section title="Matériaux GunWare">
        {MATERIAL_OPTIONS.map((material, index) => (
          <div className="layer-select-row" key={material.id}>
            <span className="layer-color" style={{ background: material.color }} />
            <span className="layer-role">{["Plage", "Herbe", "Roche", "Terre"][index]}</span>
            <select value={settings.layers[index]} onChange={(event) => {
              const next = [...settings.layers] as MaterialLayer[];
              next[index] = event.target.value as MaterialLayer;
              update("layers", next);
            }}>
              {GUNWARE_MATERIALS_BY_ROLE[index].map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
        ))}
        <SliderField label="Échelle des textures" value={settings.texScale} min={2} max={16} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => update("texScale", v)} />
        <SliderField label="Pente de la roche" value={settings.rockSlope} min={0.2} max={0.8} format={(v) => Math.round(v * 90) + "°"} onChange={(v) => update("rockSlope", v)} />
        <SliderField label="Terre sèche" value={settings.dryness} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("dryness", v)} />
      </Section>
      <Section title="Végétation">
        <div className="sub-title">Herbe</div>
        <SliderField label="Densité" value={settings.grassDensity} min={0} max={1.5} format={(v) => v.toFixed(2) + " /m²"} onChange={(v) => update("grassDensity", v)} />
        <ChipList values={types.grass} selected={settings.grassTypes} onChange={(next) => update("grassTypes", next)} />
        <CheckLine label="Afficher l'herbe en preview" checked={layers.grass} onChange={(v) => setLayer("grass", v)} />
        <div className="sub-title">Herbe du jeu (visible en jeu)</div>
        {(["sand", "grass", "rock", "dirt", "underwater"] as const).map((key) => (
          <label className="select-field proc-tag" key={key}><span>{key === "underwater" ? "Sous l'eau" : key === "sand" ? "Sable" : key === "grass" ? "Herbe" : key === "rock" ? "Roche" : "Terre"}</span><select value={settings.procTags[key]} onChange={(event) => update("procTags", { ...settings.procTags, [key]: Number(event.target.value) })}>{[0, 49, 139, 164, 203, 255].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        ))}
        <div className="sub-title">Arbres</div>
        <SliderField label="Densité" value={settings.treeDensity} min={0} max={60} step={0.5} format={(v) => v.toFixed(1) + " /ha"} onChange={(v) => update("treeDensity", v)} />
        <ChipList values={types.trees} selected={settings.treeTypes} onChange={(next) => update("treeTypes", next)} />
        <div className="sub-title">Rochers</div>
        <SliderField label="Densité" value={settings.rockDensity} min={0} max={60} step={0.5} format={(v) => v.toFixed(1) + " /ha"} onChange={(v) => update("rockDensity", v)} />
        <ChipList values={types.rocks} selected={settings.rockTypes} onChange={(next) => update("rockTypes", next)} />
        <CheckLine label="Afficher arbres et rochers" checked={layers.props} onChange={(v) => setLayer("props", v)} />
      </Section>
      <Section title="Faune">
        <SliderField label="Densité de faune" value={settings.fauna} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => update("fauna", v)} />
        <ChipList values={["WORLD_DOLPHIN_SWIM", "WORLD_STINGRAY_SWIM", "WORLD_SHARK_HAMMERHEAD_SWIM", "WORLD_SHARK_SWIM", "WORLD_WHALE_SWIM"]} selected={settings.faunaTypes} onChange={(next) => update("faunaTypes", next)} />
      </Section>
    </div>
  );
}

function WorldPanel({
  settings, update,
}: {
  settings: IslandSettings;
  update: <K extends keyof IslandSettings>(key: K, value: IslandSettings[K]) => void;
}) {
  const verdict = getPlacementVerdict(settings.originX, settings.originY, settings.worldSize, settings.ignoreGtaMap);
  const [location, setLocation] = useState("");
  return (
    <div className="tab-pane">
      <div className="tab-head">Monde</div>
      <div className="tab-sub">Positionner la carte dans les coordonnées de GTA V</div>
      <Section title="Position dans GTA">
        <GtaPlacementMap x={settings.originX} y={settings.originY} size={settings.worldSize} ignoreGtaMap={settings.ignoreGtaMap} onMove={(x, y) => { update("originX", x); update("originY", y); }} />
        <div className="map-legend"><span><i className="legend-ocean" /> Océan</span><span><i className="legend-land" /> Carte GTA</span><span><i className="legend-island" /> Votre île</span></div>
        <div className="two-field-grid origin-fields">
          <NumberField label="X" value={settings.originX} step={10} onChange={(v) => update("originX", Math.round(v / 10) * 10)} />
          <NumberField label="Y" value={settings.originY} step={10} onChange={(v) => update("originY", Math.round(v / 10) * 10)} />
        </div>
        <label className="select-field"><span>Aller vers…</span><select value={location} onChange={(event) => {
          setLocation(event.target.value);
          const item = GTA_LOCATION_PRESETS[Number(event.target.value)];
          if (item) { update("originX", item.x); update("originY", item.y); }
        }}><option value="">Choisir une zone</option>{GTA_LOCATION_PRESETS.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}</select></label>
        <button className="btn btn-wide" type="button" onClick={() => { update("originX", -12000); update("originY", 0); }}> <MapPin size={13} /> Placer au large à l'ouest</button>
        <CheckLine label="Map GTA supprimée sur mon serveur" checked={settings.ignoreGtaMap} onChange={(value) => update("ignoreGtaMap", value)} />
        <div className={"place-status is-" + verdict.level}>
          <div className="place-status-title">{verdict.level === "ok" ? <Check size={13} /> : <AlertTriangle size={13} />}{verdict.label}</div>
          {verdict.issues.map((issue) => <p key={issue}>{issue}</p>)}
        </div>
        <p className="setting-note">La vue de placement est une estimation basée sur des repères connus. Charge les données exactes de ton monde dans CodeWalker pour valider les chevauchements avant déploiement.</p>
      </Section>
    </div>
  );
}

function ExportPanel({
  data, settings, setWaves, dirty, gameGen, setGameGen, xml, setXml, sourceExport, nativeExport, exporting, exportProgress, exportStatus,
}: {
  data: TerrainData | null;
  settings: IslandSettings;
  setWaves: (value: boolean) => void;
  dirty: boolean;
  gameGen: 8 | 9;
  setGameGen: (gen: 8 | 9) => void;
  xml: boolean;
  setXml: (value: boolean) => void;
  sourceExport: () => void;
  nativeExport: () => void;
  exporting: boolean;
  exportProgress: number;
  exportStatus: string;
}) {
  const triangles = data ? Math.floor(data.indices.length / 3) : 0;
  const chunks = data?.chunkCount ?? 0;
  const estimatedMb = data ? ((data.positions.byteLength + data.colors.byteLength + data.indices.byteLength + data.heights.byteLength) / 1024 / 1024 * 0.65) : 0;
  return (
    <div className="tab-pane">
      <div className="tab-head">Export</div>
      <div className="tab-sub">Préparer une ressource FiveM pour ton serveur</div>
      <Section title="Estimation">
        <dl className="export-estimate">
          <dt>Chunks</dt><dd>{chunks.toLocaleString("fr-FR")}</dd>
          <dt>Sommets</dt><dd>{data ? data.positions.length / 3 : "—"}</dd>
          <dt>Triangles</dt><dd>{triangles.toLocaleString("fr-FR")}</dd>
          <dt>Taille source estimée</dt><dd>≈ {estimatedMb.toFixed(1)} Mo</dd>
          <dt>Dimension</dt><dd>{formatWorldSize(settings.worldSize)}</dd>
        </dl>
      </Section>
      <Section title="Ressource FiveM">
        <div className="field-label">Version du jeu</div>
        <div className="gen-cards">
          <button type="button" className={gameGen === 8 ? "gen-card is-active" : "gen-card"} onClick={() => setGameGen(8)}><strong>Legacy · gen8</strong><small>GTA V classique · FiveM standard</small></button>
          <button type="button" className={gameGen === 9 ? "gen-card is-active" : "gen-card"} onClick={() => setGameGen(9)}><strong>Enhanced · gen9</strong><small>GTA V Enhanced</small></button>
        </div>
        <div className="check-stack">
          <CheckLine label="Vagues" checked={settings.waves} onChange={setWaves} />
          <CheckLine label="Fichiers XML (CodeWalker)" checked={xml} onChange={setXml} />
        </div>
        <button className="btn primary btn-wide" type="button" disabled={!data || exporting || dirty} onClick={nativeExport}><ArrowDownToLine size={14} />{exporting ? "Export en cours…" : "Exporter la ressource FiveM"}</button>
        {exporting && <div className="export-progress"><div className="export-progress-label">{exportStatus || "Traitement…"} <strong>{exportProgress}%</strong></div><div className="busy-bar"><span style={{ width: exportProgress + "%" }} /></div></div>}
        <div className="export-divider"><span>ou</span></div>
        <button className="btn btn-wide" type="button" disabled={!data || exporting || dirty} onClick={sourceExport}><Download size={14} /> Télécharger le package source (OBJ / GLB)</button>
        {dirty && <p className="setting-note">Régénère la carte pour appliquer les derniers paramètres avant l'export.</p>}
        <p className="setting-note">L'export natif nécessite un service Windows configuré avec le moteur de conversion CodeWalker. Le package source reste disponible sans ce service pour continuer le travail dans Blender / Sollumz.</p>
      </Section>
    </div>
  );
}

function PlacementStatus({ settings }: { settings: IslandSettings }) {
  const verdict = getPlacementVerdict(settings.originX, settings.originY, settings.worldSize, settings.ignoreGtaMap);
  return <span className={"placement-mini is-" + verdict.level}>{verdict.level === "ok" ? "●" : "▲"} {verdict.label}</span>;
}

export default function IslandStudio() {
  const [settings, setSettings] = useState<IslandSettings>({ ...DEFAULT_SETTINGS });
  const [generatedSettings, setGeneratedSettings] = useState<IslandSettings>({ ...DEFAULT_SETTINGS });
  const [terrain, setTerrain] = useState<TerrainData | null>(null);
  const [activeTab, setActiveTab] = useState<"terrain" | "surface" | "world" | "export">("terrain");
  const [activeTool, setActiveTool] = useState<BrushTool>("orbit");
  const [brushRadius, setBrushRadius] = useState(14);
  const [brushStrength, setBrushStrength] = useState(0.5);
  const [activeLayer, setActiveLayer] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("render");
  const [layers, setLayers] = useState<CanvasLayers>({ grass: true, props: true, water: true, grid: false, chunks: false, context: false });
  const [hour, setHour] = useState(15.5);
  const [playMode, setPlayMode] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus | null>(null);
  const [history, setHistory] = useState<HistoryStatus>({ canUndo: false, canRedo: false });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busyLabel, setBusyLabel] = useState("Génération du terrain…");
  const [notice, setNotice] = useState("Prêt");
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [variants, setVariants] = useState<{ seed: number; shape: IslandSettings["shape"] }[]>([]);
  const [gameGen, setGameGen] = useState<8 | 9>(9);
  const [xml, setXml] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const canvasRef = useRef<IslandCanvasHandle>(null);
  const generatedRef = useRef<TerrainData | null>(null);

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(generatedSettings), [settings, generatedSettings]);
  const placement = getPlacementVerdict(generatedSettings.originX, generatedSettings.originY, generatedSettings.worldSize, generatedSettings.ignoreGtaMap);
  const currentPreset = PRESETS.find((preset) => preset.id === selectedPreset)?.label ?? "Personnalisée";

  const update = useCallback(<K extends keyof IslandSettings,>(key: K, value: IslandSettings[K]) => {
    setSettings((current) => {
      if (key === "worldSize") {
        const size = Number(value);
        const cells = allowedCellSizes(size);
        const cellSize = cells[0] ?? 4;
        const meshes = allowedMeshCells(size, cellSize);
        return { ...current, worldSize: size, cellSize, meshCell: meshes.includes(2) ? 2 : (meshes[0] ?? cellSize) };
      }
      return { ...current, [key]: value };
    });
  }, []);

  const generate = useCallback(async (override?: IslandSettings) => {
    const nextSettings = { ...(override ?? settings) };
    setBusy(true);
    setProgress(8);
    setBusyLabel("Préparation du relief…");
    setNotice("Génération en cours");
    try {
      const timer = window.setInterval(() => setProgress((value) => Math.min(94, value + 3)), 250);
      const data = await generateIslandAsync(nextSettings);
      window.clearInterval(timer);
      setProgress(100);
      generatedRef.current = data;
      setTerrain(data);
      setSettings(nextSettings);
      setGeneratedSettings(nextSettings);
      setActiveTool("orbit");
      setNotice("Carte générée");
      setHistory({ canUndo: false, canRedo: false });
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? error.message : "Erreur de génération");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [settings]);

  useEffect(() => {
    let alive = true;
    generateIslandAsync(DEFAULT_SETTINGS).then((data) => {
      if (!alive) return;
      generatedRef.current = data;
      setTerrain(data);
      setGeneratedSettings({ ...DEFAULT_SETTINGS });
      setNotice("Carte prête");
    }).catch((error) => {
      console.error(error);
      if (alive) setNotice("Erreur de démarrage du générateur");
    });
    return () => { alive = false; };
  }, []);

  const setLayer = (key: keyof CanvasLayers, value: boolean) => setLayers((current) => ({ ...current, [key]: value }));
  const applyPreset = (id: string) => {
    const preset = PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setSelectedPreset(id);
    setSettings((current) => {
      const merged = { ...current, ...preset.params };
      const cells = allowedCellSizes(merged.worldSize);
      if (!cells.includes(merged.cellSize)) merged.cellSize = cells[0] ?? 4;
      const meshes = allowedMeshCells(merged.worldSize, merged.cellSize);
      if (!meshes.includes(merged.meshCell)) merged.meshCell = meshes.includes(2) ? 2 : (meshes[0] ?? merged.cellSize);
      return merged;
    });
  };

  const openVariants = () => {
    const list = Array.from({ length: 8 }, () => ({
      seed: Math.floor(Math.random() * 999999999),
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)].id,
    }));
    setVariants(list);
    setVariantsOpen(true);
  };

  const chooseVariant = async (variant: { seed: number; shape: IslandSettings["shape"] }) => {
    setVariantsOpen(false);
    const next = { ...settings, seed: variant.seed, shape: variant.shape };
    await generate(next);
  };

  const sourceExport = async () => {
    if (!terrain) return;
    setExporting(true);
    setExportStatus("Création du package source");
    setExportProgress(20);
    try {
      const blob = await exportIslandPackage(generatedSettings, terrain, gameGen);
      setExportProgress(90);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = (generatedSettings.name || "gw_island") + "_gen" + gameGen + "_source.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportProgress(100);
      setNotice("Package source téléchargé");
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? error.message : "Export source impossible");
    } finally {
      setExporting(false);
      setExportStatus("");
      setExportProgress(0);
    }
  };

  const encodeTerrainEdits = async (data: TerrainData) => {
    const counts = {
      heights: data.heights.length,
      blendWeights: data.blendWeights.length,
      vegetationMask: data.vegetationMask.length,
      props: data.props.length,
      grass: data.grass.length,
    };
    const packed = new Float32Array(Object.values(counts).reduce((total, count) => total + count, 0));
    let offset = 0;
    for (const array of [data.heights, data.blendWeights, data.vegetationMask, data.props, data.grass]) {
      packed.set(array, offset);
      offset += array.length;
    }
    const raw = new Uint8Array(packed.buffer);
    let bytes = raw;
    if ("CompressionStream" in window) {
      const compressed = new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"));
      bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
    }
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + 0x8000)));
    }
    return {
      format: "float32-le",
      compression: bytes === raw ? "none" : "gzip",
      n: data.n,
      cell: data.cell,
      counts,
      heightsCount: counts.heights,
      blendCount: counts.blendWeights,
      vegetationCount: counts.vegetationMask,
      propsCount: counts.props,
      grassCount: counts.grass,
      data: btoa(binary),
    };
  };

  const nativeExport = async () => {
    if (!terrain) return;
    setExporting(true);
    setExportProgress(0);
    setExportStatus("Envoi au service d'export…");
    try {
      const response = await fetch("/api/export/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          params: generatedSettings,
          gen: gameGen,
          edits: await encodeTerrainEdits(terrain),
          options: {
            xml,
            waves: generatedSettings.waves,
            target: gameGen === 9 ? "enhanced" : "legacy",
            createVisualYdr: true,
            createCollisionYbn: true,
            createYmapAndYtyp: true,
            createYtd: true,
            createLods: true,
          },
          materials: GUNWARE_MATERIALS_BY_ROLE.map((items, role) => {
            const selected = items.find((material) => material.id === generatedSettings.layers[role]) ?? items[0];
            return {
              slot: role,
              id: selected.id,
              label: selected.label,
              diffuseTextureDictionary: selected.diffuse,
              normalTextureDictionary: selected.normal,
              collisionMaterial: selected.collision,
              previewTint: selected.tint,
            };
          }),
          terrain: {
            axis: "Z_UP",
            units: "meters",
            resolution: terrain.n,
            cellSize: terrain.cell,
            worldSize: generatedSettings.worldSize,
            landRatio: terrain.landRatio,
            minHeight: terrain.minHeight,
            maxHeight: terrain.maxHeight,
            origin: { x: generatedSettings.originX, y: generatedSettings.originY, z: 0 },
            bounds: {
              minX: generatedSettings.originX - generatedSettings.worldSize / 2,
              maxX: generatedSettings.originX + generatedSettings.worldSize / 2,
              minY: generatedSettings.originY - generatedSettings.worldSize / 2,
              maxY: generatedSettings.originY + generatedSettings.worldSize / 2,
              minZ: terrain.minHeight,
              maxZ: terrain.maxHeight,
            },
          },
          preview: null,
        }),
      });
      const initial = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(initial.error || initial.message || (initial.code === "bridge_missing" ? "CodeWalker indisponible sur le serveur." : "Création de l'export impossible."));
      const jobId = initial.id;
      let job: any = null;
      while (jobId) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        const statusResponse = await fetch("/api/export/jobs/" + jobId);
        job = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok) throw new Error(job.error || "État d'export introuvable.");
        const percent = job.total ? Math.round((job.done / job.total) * 100) : 0;
        setExportProgress(percent);
        setExportStatus(job.stage || "Conversion CodeWalker…");
        if (job.state !== "running") break;
      }
      if (!job || job.state === "error") throw new Error(job?.error || job?.message || "Échec de la conversion.");
      const fileResponse = await fetch("/api/export/jobs/" + jobId + "/file");
      if (!fileResponse.ok) throw new Error("ZIP de sortie introuvable.");
      const blob = await fileResponse.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = generatedSettings.name + "_gen" + gameGen + ".zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice("Ressource FiveM exportée");
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? error.message : "Export natif impossible");
    } finally {
      setExporting(false);
      setExportProgress(0);
      setExportStatus("");
    }
  };

  const togglePlayer = () => {
    const next = !playMode;
    setPlayMode(next);
    if (!next) setPlayerStatus(null);
    else setActiveTool("orbit");
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); canvasRef.current?.undo(); return; }
      if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); canvasRef.current?.redo(); return; }
      if (event.key >= "1" && event.key <= "9") setActiveTool((["orbit", "raise", "lower", "smooth", "flatten", "paint", "erase", "vegRemove", "vegAdd"] as BrushTool[])[Number(event.key) - 1]);
      if (event.key === "[") setBrushRadius((radius) => Math.max(2, radius - 2));
      if (event.key === "]") setBrushRadius((radius) => Math.min(120, radius + 2));
      if (event.key.toLowerCase() === "t") canvasRef.current?.setTopView(true);
      if (event.key.toLowerCase() === "g") setLayer("grid", !layers.grid);
      if (event.key.toLowerCase() === "p") togglePlayer();
      if (event.key.toLowerCase() === "r") update("seed", Math.floor(Math.random() * 999999999));
      if (event.key.toLowerCase() === "v") openVariants();
      if (event.key === "Escape" && variantsOpen) setVariantsOpen(false);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [layers.grid, playMode, variantsOpen, update]);

  const stats = terrain ? {
    land: (terrain.landRatio * settings.worldSize * settings.worldSize / 1e6),
    triangles: terrain.indices.length / 3,
    height: terrain.maxHeight,
    chunks: terrain.chunkCount,
  } : null;

  return (
    <main className="editor-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Waves size={16} /></span>
          <div className="brand-text"><span className="title">Island Forge</span><span className="accent-mark">—</span><span className="subtitle">Creator</span></div>
          <span className="ver-tag">v0.3</span><span className="alpha-tag">alpha</span>
        </div>
        <div className="top-field">
          <label htmlFor="island-name">Nom</label>
          <input id="island-name" className="name-input" maxLength={24} value={settings.name} onChange={(event) => update("name", event.target.value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 24))} />
        </div>
        <div className="top-field seed-field">
          <label htmlFor="island-seed">Seed</label>
          <input id="island-seed" type="number" min="0" max="999999999" value={settings.seed} onChange={(event) => update("seed", Math.max(0, Math.floor(Number(event.target.value) || 0)))} />
          <button className="icon-btn" title="Nouvelle seed aléatoire (R)" onClick={() => update("seed", Math.floor(Math.random() * 999999999))}><Dice5 size={14} /></button>
        </div>
        <div className="top-field preset-field">
          <label htmlFor="island-preset">Ambiance</label>
          <select id="island-preset" value={selectedPreset} onChange={(event) => applyPreset(event.target.value)}>
            <option value="">Personnalisée</option>
            {PRESETS.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}
          </select>
        </div>
        <button className="btn" title="8 îles au hasard avec les réglages actuels (V)" onClick={openVariants}><Grid2X2 size={13} /> Variantes</button>
        <div className="top-spacer" />
        <div className="topbar-right">
          <button className={playMode ? "btn is-playing" : "btn"} title="Personnage à l'échelle et contrôle (P)" onClick={togglePlayer}><Play size={13} /> {playMode ? "Quitter" : "Jouer"}</button>
          <div className="gen-switch" role="radiogroup" aria-label="Version du jeu">
            <button type="button" className={gameGen === 8 ? "gen-opt is-active" : "gen-opt"} onClick={() => setGameGen(8)}>gen8</button>
            <button type="button" className={gameGen === 9 ? "gen-opt is-active" : "gen-opt"} onClick={() => setGameGen(9)}>gen9</button>
          </div>
          <button className="btn primary export-top" onClick={() => { setActiveTab("export"); if (!dirty) void nativeExport(); }} disabled={!terrain || exporting || dirty}><ArrowDownToLine size={13} /> Exporter</button>
        </div>
      </header>

      <div className="workspace">
        <nav className="rail">
          <button type="button" className={activeTab === "terrain" ? "rail-btn is-active" : "rail-btn"} onClick={() => setActiveTab("terrain")}><Mountain /><span>Terrain</span></button>
          <button type="button" className={activeTab === "surface" ? "rail-btn is-active" : "rail-btn"} onClick={() => setActiveTab("surface")}><Layers3 /><span>Surface</span></button>
          <button type="button" className={activeTab === "world" ? "rail-btn is-active" : "rail-btn"} onClick={() => setActiveTab("world")}><Map /><span>Monde</span></button>
          <div className="rail-sep" />
          <button type="button" className={activeTab === "export" ? "rail-btn is-active" : "rail-btn"} onClick={() => setActiveTab("export")}><Download /><span>Export</span></button>
        </nav>

        <aside className="panel">
          {activeTab === "terrain" && <TerrainPanel settings={settings} update={update} generate={() => void generate()} dirty={dirty} busy={busy} />}
          {activeTab === "surface" && <SurfacePanel settings={settings} update={update} layers={layers} setLayer={setLayer} />}
          {activeTab === "world" && <WorldPanel settings={settings} update={update} />}
          {activeTab === "export" && <ExportPanel data={terrain} settings={generatedSettings} setWaves={(value) => { setSettings((current) => ({ ...current, waves: value })); setGeneratedSettings((current) => ({ ...current, waves: value })); }} dirty={dirty} gameGen={gameGen} setGameGen={setGameGen} xml={xml} setXml={setXml} sourceExport={() => void sourceExport()} nativeExport={() => void nativeExport()} exporting={exporting} exportProgress={exportProgress} exportStatus={exportStatus} />}
        </aside>

        <main className="viewport" id="viewport">
          {!terrain ? (
            <div className="viewport-loading"><Loader2 size={24} className="spin" /><span>Initialisation du générateur…</span></div>
          ) : (
            <>
              <div className="hud hud-left" id="hud-display">
                <div className="hud-title">Affichage <ChevronDown size={13} /></div>
                <div className="hud-body">
                  <div className="view-modes">
                    {(["render", "height", "material", "wireframe"] as ViewMode[]).map((mode) => <button key={mode} className={viewMode === mode ? "view-mode is-active" : "view-mode"} onClick={() => setViewMode(mode)}>{mode === "render" ? "Rendu" : mode === "height" ? "Altitude" : mode === "material" ? "Couches" : "Wireframe"}</button>)}
                  </div>
                  <div className="hud-sep" />
                  <div className="hud-toggle-grid">
                    <CheckLine label="Herbe" checked={layers.grass} onChange={(v) => setLayer("grass", v)} />
                    <CheckLine label="Arbres & rochers" checked={layers.props} onChange={(v) => setLayer("props", v)} />
                    <CheckLine label="Eau" checked={layers.water} onChange={(v) => setLayer("water", v)} />
                    <CheckLine label="Grille (G)" checked={layers.grid} onChange={(v) => setLayer("grid", v)} />
                    <CheckLine label="Chunks" checked={layers.chunks} onChange={(v) => setLayer("chunks", v)} />
                    <CheckLine label="Repères" checked={layers.context} onChange={(v) => setLayer("context", v)} />
                  </div>
                  <div className="hud-row"><span><Sun size={12} /> Heure</span><input type="range" min="5" max="21" step="0.1" value={hour} onChange={(event) => setHour(Number(event.target.value))} /><strong>{hour.toFixed(1)} h</strong></div>
                </div>
              </div>

              <div className="hud-right-stack">
                <div className="view-cube-host">
                  <div className="cube-stage">
                    <button className="cube-top" onClick={() => canvasRef.current?.setTopView(true)}>DESSUS</button>
                    <div className="cube-faces">
                      <button onClick={() => canvasRef.current?.setTopView(false)}>3D</button>
                      <button onClick={() => canvasRef.current?.frameIsland()}>REC</button>
                    </div>
                  </div>
                </div>
                <div className="hud hud-stats">
                  <div className="hud-title">Carte</div>
                  <dl className="stats">
                    <dt>Taille</dt><dd>{formatWorldSize(generatedSettings.worldSize)}</dd>
                    <dt>Terre</dt><dd>{stats?.land.toFixed(1)} km²</dd>
                    <dt>Altitude</dt><dd>{stats?.height.toFixed(0)} m</dd>
                    <dt>Chunks</dt><dd>{stats?.chunks}</dd>
                  </dl>
                  <div className="hud-placement"><span>Seed <b>{generatedSettings.seed}</b></span><span>Centre <b>{generatedSettings.originX}, {generatedSettings.originY}</b></span><PlacementStatus settings={generatedSettings} /></div>
                </div>
              </div>

              <div className="toolbar">
                <div className="tb-tools">
                  {[
                    ["orbit", "Caméra", "1"], ["raise", "Élever", "2"], ["lower", "Creuser", "3"],
                    ["smooth", "Lisser", "4"], ["flatten", "Aplanir", "5"], ["paint", "Peindre", "6"],
                    ["erase", "Gomme", "7"], ["vegRemove", "Déboiser", "8"], ["vegAdd", "Densifier", "9"],
                  ].map(([id, label, key]) => <button type="button" key={id} className={activeTool === id ? "tb-tool is-active" : "tb-tool"} title={label + " (" + key + ")"} onClick={() => { setPlayMode(false); setActiveTool(id as BrushTool); }}><i className={"tb-dot tool-" + id} /><span>{label}</span><kbd>{key}</kbd></button>)}
                </div>
                <div className="tb-controls">
                  {activeTool === "paint" && <div className="tb-layers">{MATERIAL_OPTIONS.map((layer, index) => <button key={layer.id} className={activeLayer === index ? "tb-swatch is-active" : "tb-swatch"} title={layer.label} style={{ background: layer.color }} onClick={() => setActiveLayer(index)} />)}</div>}
                  <label className="tb-slider"><span>Rayon</span><input type="range" min="2" max={Math.min(120, Math.max(10, Math.round(generatedSettings.worldSize / 14)))} value={brushRadius} onChange={(event) => setBrushRadius(Number(event.target.value))} /><b>{brushRadius} m</b></label>
                  <label className="tb-slider"><span>Force</span><input type="range" min="0.05" max="1" step="0.05" value={brushStrength} onChange={(event) => setBrushStrength(Number(event.target.value))} /><b>{Math.round(brushStrength * 100)}%</b></label>
                  <div className="tb-actions">
                    <button className="tb-btn" disabled={!history.canUndo} onClick={() => canvasRef.current?.undo()} title="Annuler (Ctrl+Z)"><Undo2 size={15} /></button>
                    <button className="tb-btn" disabled={!history.canRedo} onClick={() => canvasRef.current?.redo()} title="Rétablir (Ctrl+Y)"><Redo2 size={15} /></button>
                    <button className="tb-btn tb-text" onClick={() => canvasRef.current?.clearEdits()} title="Effacer toutes les retouches"><RotateCcw size={13} /> Effacer</button>
                    {history.canUndo && <span className="tb-badge">Retouches en cours</span>}
                  </div>
                </div>
              </div>

              <div className="viewport-canvas">
                <IslandCanvas
                  ref={canvasRef}
                  data={terrain}
                  settings={generatedSettings}
                  activeTool={activeTool}
                  brushRadius={brushRadius}
                  brushStrength={brushStrength}
                  activeLayer={activeLayer}
                  viewMode={viewMode}
                  layers={layers}
                  hour={hour}
                  playMode={playMode}
                  onPlayModeChange={setPlayMode}
                  onPlayerStatus={setPlayerStatus}
                  onHistoryChange={setHistory}
                  onEditChanged={() => setNotice("Retouche de terrain modifiée")}
                  onClearEdits={() => void generate(generatedSettings)}
                />
              </div>

              <div className="scale-bar">
                <span>{generatedSettings.originX}, {generatedSettings.originY}</span>
                <div className="scale-line"><i /></div><strong>{formatWorldSize(Math.max(100, Math.round(generatedSettings.worldSize / 5 / 100) * 100))}</strong>
              </div>

              <div className="viewer-overlay" id="keys-overlay">
                <span><kbd>1–9</kbd> outils</span><span><kbd>[ ]</kbd> rayon</span><span><kbd>Ctrl+Z</kbd> annuler</span><span><kbd>T</kbd> dessus</span><span><kbd>G</kbd> grille</span><span><kbd>P</kbd> jouer</span><span><kbd>R</kbd> seed</span><span><kbd>V</kbd> variantes</span>
              </div>

              {playMode && <div className="play-hud">
                <div className="crosshair">+</div>
                <div className="play-keys"><span><kbd>ZQSD</kbd> bouger</span><span><kbd>Maj</kbd> sprint</span><span><kbd>Alt</kbd> marcher</span><span><kbd>Espace</kbd> sauter</span><span><kbd>C</kbd> 1re / 3e pers.</span><span><kbd>Échap</kbd> quitter</span></div>
                {playerStatus && <div className="play-coordinate"><b>{Math.round(playerStatus.x)}, {Math.round(playerStatus.y)}</b> · {playerStatus.swimming ? "nage" : "alt. " + playerStatus.z.toFixed(1) + " m"} · {Math.round(playerStatus.speed * 3.6)} km/h</div>}
              </div>}
            </>
          )}

          {busy && <div className="busy"><span>{busyLabel}</span><div className="busy-bar"><span style={{ width: progress + "%" }} /></div></div>}
        </main>
      </div>

      <footer className="statusbar">
        <span className="status-indicator" />
        <span>{notice}</span>
        <span className="status-spacer" />
        {busy ? <span>Génération {progress}%</span> : <span>{dirty ? "Modifications non générées" : "Carte synchronisée"}</span>}
        <span>·</span><span>{generatedSettings.shape} · {formatWorldSize(generatedSettings.worldSize)}</span>
      </footer>

      {variantsOpen && <div className="variants">
        <button className="variants-backdrop" aria-label="Fermer" onClick={() => setVariantsOpen(false)} />
        <div className="variants-card">
          <div className="variants-head">
            <div><div className="variants-title">Variantes</div><div className="variants-sub">Clique une île pour la garder et l'ouvrir dans l'éditeur.</div></div>
            <div className="variants-actions"><button className="btn" onClick={openVariants}>Autres îles</button><button className="icon-btn" onClick={() => setVariantsOpen(false)}><X size={15} /></button></div>
          </div>
          <div className="variant-grid">
            {variants.map((variant, index) => (
              <button key={variant.seed} className="variant-card" onClick={() => void chooseVariant(variant)}>
                <span className={"variant-shape shape-" + variant.shape} />
                <strong>{SHAPES.find((shape) => shape.id === variant.shape)?.label}</strong>
                <small>Seed {variant.seed}</small>
                <em>Variante {String(index + 1).padStart(2, "0")}</em>
              </button>
            ))}
          </div>
        </div>
      </div>}
    </main>
  );
}
