"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Anchor, ArrowDownToLine, Building2, Check, ChevronDown, CircleHelp,
  Compass, Dice5, Download, Expand, Info, Layers3, MapPinned, Mountain,
  Plane, RefreshCw, SlidersHorizontal, Sparkles, Trees, Waves,
} from "lucide-react";
import { DEFAULT_SETTINGS, generateIsland, type IslandSettings } from "@/lib/terrain";
import { exportIslandPackage } from "@/lib/exporter";

const IslandCanvas = dynamic(() => import("@/components/island-canvas"), {
  ssr: false,
  loading: () => <div className="canvas-loading"><div className="loading-orb" />Préparation du viewport 3D…</div>,
});

function SliderField({
  label, value, min, max, step = 1, suffix = "", onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  suffix?: string; onChange: (value: number) => void;
}) {
  return (
    <label className="slider-field">
      <span className="field-heading"><span>{label}</span><strong>{value.toLocaleString("fr-FR")}{suffix}</strong></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="range-labels"><small>{min.toLocaleString("fr-FR")}{suffix}</small><small>{max.toLocaleString("fr-FR")}{suffix}</small></span>
    </label>
  );
}

function NumberField({
  label, value, onChange, suffix = "",
}: { label: string; value: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /><em>{suffix}</em></div>
    </label>
  );
}

const regionIcons = {
  city: Building2,
  port: Anchor,
  airport: Plane,
  nature: Trees,
  tourism: Waves,
};

export default function IslandStudio() {
  const [settings, setSettings] = useState<IslandSettings>({ ...DEFAULT_SETTINGS });
  const [generatedSettings, setGeneratedSettings] = useState<IslandSettings>({ ...DEFAULT_SETTINGS });
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("Prêt à générer");
  const [showMarkers, setShowMarkers] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const terrain = useMemo(() => generateIsland(generatedSettings), [generatedSettings]);
  const isDirty = JSON.stringify(settings) !== JSON.stringify(generatedSettings);
  const triangles = terrain.indices.length / 3;

  const update = <K extends keyof IslandSettings>(key: K, value: IslandSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const generate = () => {
    setGeneratedSettings({ ...settings });
    setNotice("Terrain régénéré avec succès");
  };

  const randomize = () => {
    update("seed", Math.floor(Math.random() * 999999));
  };

  const exportPackage = async () => {
    setExporting(true);
    setNotice("Préparation du package…");
    try {
      const blob = await exportIslandPackage(generatedSettings, terrain);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeName = generatedSettings.islandName.toLowerCase().trim().replace(/[^a-z0-9-_]+/g, "_").replace(/^_+|_+$/g, "") || "tropical_island";
      anchor.href = url;
      anchor.download = `${safeName}_fivem_source.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice("Package FiveM exporté");
    } catch (error) {
      console.error(error);
      setNotice("Erreur pendant l'export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Waves size={19} strokeWidth={2.2} /></div>
          <div className="brand-copy"><strong>ISLAND<span>FORGE</span></strong><small>FIVEM WORLD GENERATOR</small></div>
        </div>
        <div className="topbar-center">
          <span className="breadcrumb-muted">Workspace</span><span className="crumb-slash">/</span><strong>Island project</strong>
          <span className="version-pill">BETA 0.1</span>
        </div>
        <div className="topbar-actions">
          <span className="save-state"><i />{isDirty ? "Modifications en attente" : "Projet synchronisé localement"}</span>
          <button className="top-icon-button" title="Aide"><CircleHelp size={17} /></button>
          <div className="avatar">IG</div>
        </div>
      </header>

      <div className="workspace">
        <nav className="tool-rail" aria-label="Outils">
          <div className="rail-active"><Mountain size={19} /></div>
          <div className="rail-item"><Layers3 size={19} /></div>
          <div className="rail-item"><MapPinned size={19} /></div>
          <div className="rail-spacer" />
          <div className="rail-item"><SlidersHorizontal size={19} /></div>
        </nav>

        <aside className="control-panel">
          <div className="panel-title">
            <div><span className="eyebrow">GENERATOR</span><h1>Island settings</h1></div>
            <button className="icon-button subtle" onClick={() => setSettings({ ...DEFAULT_SETTINGS })} title="Réinitialiser"><RefreshCw size={15} /></button>
          </div>

          <section className="control-section">
            <div className="section-heading"><span className="section-icon"><Compass size={15} /></span><h2>Identité</h2><ChevronDown size={14} /></div>
            <label className="text-field"><span>Nom de l'île</span><input value={settings.islandName} onChange={(event) => update("islandName", event.target.value)} placeholder="Tropical Island" /></label>
            <div className="seed-row">
              <label className="text-field"><span>Seed procédurale</span><input type="number" value={settings.seed} onChange={(event) => update("seed", Number(event.target.value))} /></label>
              <button className="square-action" onClick={randomize} title="Seed aléatoire"><Dice5 size={17} /></button>
            </div>
          </section>

          <section className="control-section">
            <div className="section-heading"><span className="section-icon"><Expand size={15} /></span><h2>Dimensions</h2><ChevronDown size={14} /></div>
            <div className="two-fields">
              <NumberField label="Largeur" value={settings.width} suffix="m" onChange={(v) => update("width", Math.max(2000, Math.min(16000, v || 2000)))} />
              <NumberField label="Longueur" value={settings.length} suffix="m" onChange={(v) => update("length", Math.max(2000, Math.min(16000, v || 2000)))} />
            </div>
            <div className="field-stack">
              <span className="standalone-label">Résolution terrain</span>
              <select className="select-field" value={settings.resolution} onChange={(event) => update("resolution", Number(event.target.value))}>
                <option value={129}>129 × 129 · Draft</option>
                <option value={193}>193 × 193 · Balanced</option>
                <option value={257}>257 × 257 · High</option>
                <option value={385}>385 × 385 · Ultra</option>
                <option value={513}>513 × 513 · Extreme</option>
              </select>
            </div>
            <SliderField label="Découpage en tuiles" value={settings.tiles} min={1} max={8} onChange={(v) => update("tiles", v)} suffix=" × " />
          </section>

          <section className="control-section">
            <div className="section-heading"><span className="section-icon"><Mountain size={15} /></span><h2>Relief & montagnes</h2><ChevronDown size={14} /></div>
            <SliderField label="Altitude maximale" value={settings.maxHeight} min={150} max={1800} step={25} suffix=" m" onChange={(v) => update("maxHeight", v)} />
            <SliderField label="Intensité montagneuse" value={Math.round(settings.mountainStrength * 100)} min={10} max={150} suffix="%" onChange={(v) => update("mountainStrength", v / 100)} />
            <SliderField label="Largeur des massifs" value={Math.round(settings.mountainWidth * 100)} min={10} max={80} suffix="%" onChange={(v) => update("mountainWidth", v / 100)} />
            <SliderField label="Profondeur des vallées" value={Math.round(settings.valleyStrength * 100)} min={0} max={80} suffix="%" onChange={(v) => update("valleyStrength", v / 100)} />
          </section>

          <section className="control-section">
            <div className="section-heading"><span className="section-icon"><Waves size={15} /></span><h2>Littoral</h2><ChevronDown size={14} /></div>
            <SliderField label="Découpe de la côte" value={Math.round(settings.coastline * 100)} min={45} max={88} suffix="%" onChange={(v) => update("coastline", v / 100)} />
            <SliderField label="Irrégularité" value={Math.round(settings.coastRoughness * 100)} min={0} max={150} suffix="%" onChange={(v) => update("coastRoughness", v / 100)} />
            <SliderField label="Largeur des plages" value={settings.sandWidth} min={5} max={90} step={1} suffix=" m" onChange={(v) => update("sandWidth", v)} />
          </section>

          <section className="control-section export-origin">
            <div className="section-heading"><span className="section-icon"><MapPinned size={15} /></span><h2>Position FiveM</h2><ChevronDown size={14} /></div>
            <div className="three-fields">
              <NumberField label="X" value={settings.originX} onChange={(v) => update("originX", v)} />
              <NumberField label="Y" value={settings.originY} onChange={(v) => update("originY", v)} />
              <NumberField label="Z" value={settings.originZ} onChange={(v) => update("originZ", v)} />
            </div>
            <p className="field-help">Coordonnées GTA à valider avec CodeWalker. 1 unité Blender = 1 mètre dans le package.</p>
          </section>

          <div className="generate-dock">
            <button className="generate-button" onClick={generate}><Sparkles size={16} /> Générer l'île <span>↵</span></button>
            <p><Info size={12} /> Les modifications sont appliquées après génération.</p>
          </div>
        </aside>

        <section className="viewport-area">
          <div className="viewport-header">
            <div className="viewport-heading"><span className="live-dot" /><strong>3D Viewport</strong><span className="viewport-divider" /> <span>Perspective · Terrain preview</span></div>
            <div className="viewport-tools">
              <button className={showMarkers ? "view-tool active" : "view-tool"} onClick={() => setShowMarkers(!showMarkers)}><MapPinned size={14} /> Zones</button>
              <button className={showGrid ? "view-tool active" : "view-tool"} onClick={() => setShowGrid(!showGrid)}><Layers3 size={14} /> Grille</button>
            </div>
          </div>
          <div className="viewport-canvas">
            <IslandCanvas data={terrain} settings={generatedSettings} showMarkers={showMarkers} showGrid={showGrid} />
            <div className="viewport-overlay-top">
              <div className="overlay-chip"><span className="chip-pulse" /> LIVE PREVIEW</div>
              <div className="overlay-chip muted-chip">SEED {generatedSettings.seed}</div>
            </div>
            <div className="viewport-overlay-bottom">
              <div className="view-caption"><span className="caption-icon"><Compass size={15} /></span><div><strong>{generatedSettings.islandName}</strong><small>Procédural · Tropical · Z-up</small></div></div>
              <div className="axis-widget"><span className="axis-z">Z</span><span className="axis-x">X</span><span className="axis-y">Y</span><i /></div>
            </div>
            {isDirty && <div className="dirty-banner"><Info size={14} /> Paramètres modifiés — clique sur Générer l'île pour actualiser l'aperçu.</div>}
          </div>
          <div className="viewport-footer">
            <span><i className="legend-sand" /> Sable</span><span><i className="legend-grass" /> Végétation</span><span><i className="legend-rock" /> Roche</span>
            <div className="footer-right">Glisser : orbiter <b>·</b> Molette : zoom <b>·</b> Clic droit : déplacer</div>
          </div>
        </section>

        <aside className="inspector-panel">
          <div className="inspector-heading"><div><span className="eyebrow">PROJECT OVERVIEW</span><h2>Island data</h2></div><span className="ready-tag"><Check size={12} /> READY</span></div>
          <div className="stat-grid">
            <div className="stat-card"><span>Surface cible</span><strong>{((generatedSettings.width * generatedSettings.length) / 1000000).toFixed(1)} <small>km²</small></strong><em>Emprise rectangulaire</em></div>
            <div className="stat-card"><span>Altitude max</span><strong>{Math.round(terrain.maxHeight)} <small>m</small></strong><em>Relief généré</em></div>
            <div className="stat-card"><span>Triangles</span><strong>{(triangles / 1000).toFixed(0)} <small>k</small></strong><em>Maillage visible</em></div>
            <div className="stat-card"><span>Terrain tiles</span><strong>{generatedSettings.tiles ** 2} <small>pcs</small></strong><em>Découpage export</em></div>
          </div>

          <div className="inspector-section">
            <div className="inspector-section-title"><span>Régions suggérées</span><span>{terrain.landmarks.length} ZONES</span></div>
            <div className="region-list">
              {terrain.landmarks.map((landmark) => {
                const Icon = regionIcons[landmark.type];
                return <div className="region-row" key={landmark.id}><span className={`region-icon ${landmark.type}`}><Icon size={14} /></span><div><strong>{landmark.label}</strong><small>{landmark.type === "city" ? "Urban center" : landmark.type === "port" ? "Maritime hub" : landmark.type === "airport" ? "Air transport" : landmark.type === "tourism" ? "Coastal district" : "Natural region"}</small></div><span className="region-dot" /></div>;
              })}
            </div>
          </div>

          <div className="export-card">
            <div className="export-card-top"><div className="export-icon"><ArrowDownToLine size={18} /></div><span className="export-version">EXPORT · ZIP</span></div>
            <h3>FiveM package</h3>
            <p>Géométrie source, heightmap, configuration, repères et ressource FiveM de démarrage.</p>
            <div className="export-includes"><span><Check size={12} /> OBJ / MTL</span><span><Check size={12} /> GLB preview</span><span><Check size={12} /> Heightmap 16-bit</span><span><Check size={12} /> FiveM scaffold</span></div>
            <button className="export-button" onClick={exportPackage} disabled={exporting || isDirty}>
              {exporting ? <><RefreshCw size={15} className="spin" /> Export en cours…</> : <><Download size={15} /> Exporter pour FiveM</>}
            </button>
            {isDirty && <small className="export-disabled-note">Génère d'abord les dernières modifications.</small>}
          </div>

          <div className="pipeline-note"><Info size={15} /><p><strong>À savoir</strong> Le ZIP contient les sources de terrain. La conversion en assets natifs GTA V avec Sollumz et leur validation CodeWalker restent nécessaires avant le démarrage FiveM.</p></div>
          <div className="status-line"><span className="status-check"><Check size={11} /></span>{notice}</div>
        </aside>
      </div>
    </main>
  );
}
