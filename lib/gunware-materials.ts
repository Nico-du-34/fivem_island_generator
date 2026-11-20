/**
 * Material references recovered from the user-provided GunWare Island Creator
 * source bundle. The diffuse/normal values are GTA V texture dictionary names,
 * not standalone image files; the export manifest preserves them for the
 * native Windows conversion stage.
 */
export type GunwareMaterialRole = 0 | 1 | 2 | 3;

export const GUNWARE_MATERIALS = [
  { id: "sand_beach", label: "Sable de plage (Cayo)", role: 0, diffuse: "cs_islx_bchsand_5", normal: "cs_islx_bchsand_5_n", collision: 19, tint: "#d9c9a3" },
  { id: "sand_beach_b", label: "Sable de plage B", role: 0, diffuse: "cs_rsn_sl_bchsand_03", normal: "nxg_cs_rsn_sl_bchsand_03_n", collision: 18, tint: "#cdb98f" },
  { id: "sand_under", label: "Sable sous-marin", role: 0, diffuse: "cs_rsn_sl_uwsand_0001", normal: "cs_rsn_sl_uwsand_0001_n", collision: 19, tint: "#bfae88" },
  { id: "sand_shell", label: "Sable coquillages", role: 0, diffuse: "cs_rsn_sl_uwshell_0001", normal: "cs_rsn_sl_uwshell_0001_n", collision: 19, tint: "#c4b48f" },
  { id: "sand_veg", label: "Sable végétalisé", role: 0, diffuse: "cs_rsn_sl_bchsandveg_01", normal: "cs_rsn_sl_bchsandveg_01_n", collision: 19, tint: "#a9a07a" },

  { id: "grass_lush", label: "Herbe tropicale", role: 1, diffuse: "cs_rsn_sl_wetlandsgrass2", normal: "cs_rsn_sl_wetlandsgrass2_n", collision: 47, tint: "#5d7134" },
  { id: "grass_dark", label: "Herbe sombre", role: 1, diffuse: "cs_rsn_sl_agrgrass_02_dark", normal: "cs_rsn_sl_agrgrass_02_n", collision: 47, tint: "#4f6230" },
  { id: "grass_scrub", label: "Herbe broussailleuse", role: 1, diffuse: "cs_islx_hillsscrub", normal: "cs_hp_rsl_hillsscrub_n", collision: 48, tint: "#6f7440" },
  { id: "grass_farm", label: "Prairie", role: 1, diffuse: "dc_rsn_cs2_03_farm_04_lush", normal: "dc_rsn_cs2_03_farm_04_n", collision: 47, tint: "#6b7a3c" },
  { id: "grass_dry", label: "Herbe sèche", role: 1, diffuse: "cs_rsn_sl_wetlandsdrygrass1b", normal: "cs_rsn_sl_wetlandsdrygrass1_n", collision: 46, tint: "#8a7f55" },

  { id: "rock_cliff", label: "Falaise côtière", role: 2, diffuse: "cs_islx_cstcliff_0001b", normal: "cs_rsn_sl_cstcliff_0001_n", collision: 9, tint: "#7d7466" },
  { id: "rock_canyon", label: "Roche canyon", role: 2, diffuse: "cs_islx_rsn_canyon_rock_01", normal: "cs_islx_rsn_canyon_rock_01_n", collision: 9, tint: "#8a7660" },
  { id: "rock_canyon_b", label: "Roche canyon B", role: 2, diffuse: "cs_islx_rsn_canyon_rock_02", normal: "cs_islx_rsn_canyon_rock_02_n", collision: 9, tint: "#82705d" },
  { id: "rock_spine", label: "Roche grise", role: 2, diffuse: "cs_rsn_sl_spinerock3", normal: "cs_rsn_sl_spinerock3_n", collision: 9, tint: "#77746c" },
  { id: "rock_moss", label: "Roche moussue", role: 2, diffuse: "cs_islx_river_rck_moss01b", normal: "cs_islx_river_rck_moss01b_n", collision: 9, tint: "#5f6447" },
  { id: "rock_shale", label: "Schiste", role: 2, diffuse: "cs_rsn_sl_dryhills_rock_03", normal: "cs_rsn_sl_dryhills_rock_03_n", collision: 9, tint: "#857a69" },

  { id: "dirt_forest", label: "Terre caillouteuse", role: 3, diffuse: "cs_rsn_dor_mntearthstonesveg02", normal: "cs_rsn_dor_mntearthstonesveg02_n", collision: 43, tint: "#6e5f45" },
  { id: "dirt_track", label: "Piste de terre", role: 3, diffuse: "cs_rsn_sl_agrdirttrack4", normal: "cs_rsn_sl_agrdirttrack4_n", collision: 35, tint: "#8a7556" },
  { id: "dirt_earthrock", label: "Terre rocheuse", role: 3, diffuse: "cs_rsn_sl_mntearthrock01", normal: "cs_rsn_sl_mntearthrock01_n", collision: 43, tint: "#7a6650" },
  { id: "dirt_bank", label: "Talus", role: 3, diffuse: "cs_dd_earthbank_001", normal: "cs_dd_earthbank_001_n", collision: 43, tint: "#7c6a51" },
  { id: "dirt_riverbed", label: "Galets de rivière", role: 3, diffuse: "cs_rsn_sl_riverbedstones_01", normal: "cs_rsn_sl_riverbedstones_01_n", collision: 31, tint: "#7f7766" },
  { id: "dirt_lakebed", label: "Pierres de lac", role: 3, diffuse: "cs_rsn_sl_lakebedstones1", normal: "cs_rsn_sl_lakebedstones1_n", collision: 31, tint: "#77705f" },
] as const;

export type GunwareMaterialId = (typeof GUNWARE_MATERIALS)[number]["id"];
export type GunwareMaterial = (typeof GUNWARE_MATERIALS)[number];

export const GUNWARE_MATERIALS_BY_ROLE = [0, 1, 2, 3].map((role) =>
  GUNWARE_MATERIALS.filter((material) => material.role === role),
);

const MATERIAL_MAP = new Map<string, GunwareMaterial>(
  GUNWARE_MATERIALS.map((material) => [material.id, material]),
);

export function getGunwareMaterial(id: string | undefined, role?: GunwareMaterialRole): GunwareMaterial {
  const found = id ? MATERIAL_MAP.get(id) : undefined;
  if (found && (role === undefined || found.role === role)) return found;
  return GUNWARE_MATERIALS_BY_ROLE[role ?? 0][0] as GunwareMaterial;
}
