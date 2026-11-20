from __future__ import annotations

import argparse
import importlib
import json
import math
import os
import sys
import traceback
from pathlib import Path

import bpy
import numpy as np
from mathutils import Euler


def progress(stage: str, done: int, warning: str | None = None):
    data = {"stage": stage, "done": done}
    if warning:
        data["warning"] = warning
    print("ISLAND_PROGRESS:" + json.dumps(data), flush=True)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


ADDON_MODULE = None

def load_sollumz():
    global ADDON_MODULE
    addon_path = os.environ.get("SOLLUMZ_ADDON_PATH")
    module_name = os.environ.get("SOLLUMZ_ADDON_MODULE", "Sollumz")
    if addon_path:
        sys.path.insert(0, str(Path(addon_path).resolve().parent))
    if hasattr(bpy.types.Object, "sollum_type"):
        ADDON_MODULE = module_name
        return
    errors = []
    for candidate in (module_name, "Sollumz", "sollumz"):
        try:
            importlib.import_module(candidate)
            bpy.ops.preferences.addon_enable(module=candidate)
            if hasattr(bpy.types.Object, "sollum_type"):
                ADDON_MODULE = candidate
                return
        except Exception as exc:
            errors.append(candidate + ": " + str(exc))
    raise RuntimeError(
        "Sollumz n'est pas installé/activé dans ce profil Blender. "
        "Configure SOLLUMZ_ADDON_PATH et SOLLUMZ_ADDON_MODULE. " + " | ".join(errors)
    )


def addon_import(relative_module: str):
    if not ADDON_MODULE:
        raise RuntimeError("Sollumz n'est pas encore chargé.")
    return importlib.import_module(ADDON_MODULE + "." + relative_module)


def read_buffers(job_path: Path, meta: dict):
    counts = meta["counts"]
    total = sum(int(v) for v in counts.values())
    raw_path = job_path.parent / meta["binaryFile"]
    values = np.fromfile(raw_path, dtype="<f4")
    if values.size != total:
        raise RuntimeError(f"Buffer terrain invalide : {values.size} float32 reçus, {total} attendus.")
    offset = 0

    def take(name):
        nonlocal offset
        length = int(counts[name])
        result = values[offset:offset + length]
        offset += length
        return result

    n = int(meta["terrain"].get("resolution") or 0)
    if not n:
        n = int(meta["params"].get("resolution") or round(math.sqrt(int(counts["heights"]))))
    heights = take("heights").reshape((n, n))
    weights = take("blendWeights").reshape((n, n, 4))
    vegetation = take("vegetationMask").reshape((n, n))
    land = take("land").reshape((n, n))
    props = take("props").reshape((-1, 6))
    grass = take("grass").reshape((-1, 4))
    if offset != total:
        raise RuntimeError("Le buffer contient des données non consommées.")
    if not np.isfinite(heights).all() or not np.isfinite(weights).all():
        raise RuntimeError("Le terrain contient des valeurs NaN/Inf.")
    return n, heights, weights, vegetation, land, props, grass


def material_texture_paths(material, textures_dir: Path):
    material_id = material["id"]
    configured = Path(os.environ.get("GUNWARE_TEXTURE_DIR", "")) if os.environ.get("GUNWARE_TEXTURE_DIR") else None
    roots = [configured] if configured else []
    roots.append(textures_dir)
    result = []
    for suffix in ("diffuse", "normal"):
        found = None
        candidates = [material_id + "_" + suffix + ext for ext in (".png", ".tga", ".dds", ".jpg")]
        for root in roots:
            if root and root.exists():
                for candidate in candidates:
                    path = root / candidate
                    if path.exists():
                        found = path
                        break
            if found:
                break
        result.append(found)
    return result


def generate_fallback_texture(path: Path, tint_hex: str, role: int, normal: bool):
    size = 256
    tint = tuple(int(tint_hex.lstrip("#")[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    u = xx / size * math.tau
    v = yy / size * math.tau
    broad = np.sin(u * (0.8 if role == 2 else 1.7) + np.cos(v * 1.1) * 1.3)
    fine = np.sin(u * 8.0 + np.sin(v * 7.0)) * np.cos(v * 10.0)
    grain = np.sin(u * 43.0 + v * 17.0) * np.sin(v * 37.0 - u * 13.0)
    ridge = np.sin((u * 0.8 + v * 0.23) * math.pi * 4 + np.sin(v * 2.1))
    if role == 0:
        height = 0.50 + broad * 0.04 + fine * 0.035 + grain * 0.018
    elif role == 1:
        height = 0.48 + broad * 0.10 + fine * 0.055 + grain * 0.025
    elif role == 2:
        height = 0.50 + ridge * 0.13 + fine * 0.07 + grain * 0.025
    else:
        height = 0.49 + broad * 0.07 + fine * 0.055 + grain * 0.03

    if normal:
        strength = 5.5 if role == 2 else 3.8 if role == 1 else 2.2
        dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
        dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
        nx, ny, nz = -dx, -dy, np.ones_like(height)
        length = np.sqrt(nx * nx + ny * ny + nz * nz)
        rgba = np.stack((nx / length * 0.5 + 0.5, ny / length * 0.5 + 0.5, nz / length * 0.5 + 0.5, np.ones_like(height)), axis=-1)
    else:
        brightness = 0.88 + (height - 0.5) * 0.85 + grain * 0.035
        rgb = np.clip(np.asarray(tint)[None, None, :] * brightness[..., None], 0, 1)
        rgba = np.concatenate((rgb, np.ones((size, size, 1), dtype=np.float32)), axis=-1)

    pixels = np.clip(rgba, 0, 1).astype(np.float32).reshape(-1)
    image = bpy.data.images.new(path.stem, width=size, height=size, alpha=True, float_buffer=False)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.colorspace_settings.name = "Non-Color" if normal else "sRGB"
    image.save()
    image.pack()
    return image



def ensure_materials(meta: dict, artifact_root: Path):
    from szio.gta5.shader import ShaderManager
    create_shader = addon_import("ydr.shader_materials").create_shader

    texture_dir = artifact_root / "generated-textures"
    texture_dir.mkdir(parents=True, exist_ok=True)
    shader_defs = list(ShaderManager.shaders())
    available = {shader.preset_name: shader for shader in shader_defs}
    preferred = [
        "normal_spec.sps",
        "normal_spec_tnt.sps",
        "default.sps",
    ]
    shader_name = next((name for name in preferred if name in available), None)
    if shader_name is None:
        suitable = [
            shader.preset_name for shader in shader_defs
            if any(parameter.name == "DiffuseSampler" for parameter in shader.parameters)
            and not shader.is_decal and not shader.is_alpha and not shader.is_cutout
        ]
        if not suitable:
            raise RuntimeError("Sollumz ne contient aucun shader opaque avec DiffuseSampler.")
        shader_name = suitable[0]

    mats = []
    images = []
    for role, material in enumerate(meta.get("materials", [])[:4]):
        paths = material_texture_paths(material, texture_dir)
        images_for_role = []
        for slot, is_normal in enumerate((False, True)):
            suffix = "normal" if is_normal else "diffuse"
            existing = paths[slot]
            if existing:
                image = bpy.data.images.load(str(existing), check_existing=True)
                image.name = material["id"] + "_" + suffix
                image.colorspace_settings.name = "Non-Color" if is_normal else "sRGB"
            else:
                image = generate_fallback_texture(
                    texture_dir / (material["id"] + "_" + suffix + ".png"),
                    material.get("previewTint", "#777777"),
                    role,
                    is_normal,
                )
            images_for_role.append(image)
            images.append(image)

        mat = create_shader(shader_name)
        mat.name = "IF_" + material["id"]
        diffuse_node = mat.node_tree.nodes.get("DiffuseSampler")
        bump_node = mat.node_tree.nodes.get("BumpSampler")
        if diffuse_node:
            diffuse_node.image = images_for_role[0]
        if bump_node:
            bump_node.image = images_for_role[1]
        if not diffuse_node:
            raise RuntimeError("Le shader " + shader_name + " n'expose pas DiffuseSampler.")
        mat.diffuse_color = tuple(int(material.get("previewTint", "#777777")[i:i + 2], 16) / 255 for i in (1, 3, 5)) + (1.0,)
        mats.append(mat)

    # A single texture dictionary makes the selected fallback/replacement maps available
    # to YDR/YTYP consumers. It does not claim the PNGs are original GunWare bitmaps.
    txd_name = meta["params"]["name"][:38] + "_terrain"
    txd = bpy.context.scene.sz_txds.new_texture_dictionary(txd_name)
    for image in images:
        txd.new_texture(image)
    return mats, images, txd_name


def make_grid_indices(n: int, x0: int, x1: int, y0: int, y1: int, step: int):
    xs = list(range(x0, x1, step))
    ys = list(range(y0, y1, step))
    if not xs or xs[-1] != x1:
        xs.append(x1)
    if not ys or ys[-1] != y1:
        ys.append(y1)
    return xs, ys


def build_mesh(name: str, n: int, heights: np.ndarray, weights: np.ndarray, land: np.ndarray,
               x0: int, x1: int, y0: int, y1: int, step: int,
               world_size: float, origin_x: float, origin_y: float, tex_scale: float,
               materials: list, base_collision: bool = False, collision_indices: list[int] | None = None):
    xs, ys = make_grid_indices(n, x0, x1, y0, y1, step)
    cell = world_size / (n - 1)
    center_x = origin_x + ((x0 + x1) * 0.5 - (n - 1) * 0.5) * cell
    center_y = origin_y + ((y0 + y1) * 0.5 - (n - 1) * 0.5) * cell
    vertices = []
    uvs = []
    for gy in ys:
        for gx in xs:
            world_x = origin_x + (gx - (n - 1) * 0.5) * cell
            world_y = origin_y + (gy - (n - 1) * 0.5) * cell
            vertices.append((world_x - center_x, world_y - center_y, float(heights[gy, gx])))
            uvs.append(((world_x - origin_x) / max(1.0, tex_scale), (world_y - origin_y) / max(1.0, tex_scale)))

    width = len(xs)
    faces = []
    material_ids = []
    collision_ids = []
    for row in range(len(ys) - 1):
        for col in range(width - 1):
            gx0, gx1 = xs[col], xs[col + 1]
            gy0, gy1 = ys[row], ys[row + 1]
            land_avg = float((land[gy0, gx0] + land[gy0, gx1] + land[gy1, gx0] + land[gy1, gx1]) * 0.25)
            if land_avg < 0.08:
                continue
            a = row * width + col
            b = a + 1
            c = a + width
            d = c + 1
            faces.append((a, b, d, c))
            blend = (
                weights[gy0, gx0] + weights[gy0, gx1] +
                weights[gy1, gx0] + weights[gy1, gx1]
            ) * 0.25
            slot = int(np.argmax(blend))
            material_ids.append(slot)
            collision_ids.append(slot)

    if not faces:
        return None, center_x, center_y

    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        polygon.material_index = material_ids[polygon.index]
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = (center_x, center_y, 0.0)
    for material in materials:
        mesh.materials.append(material)

    if base_collision and collision_indices:
        create_collision_material_from_index = addon_import("ybn.collision_materials").create_collision_material_from_index
        mesh.materials.clear()
        for index in collision_indices:
            mesh.materials.append(create_collision_material_from_index(int(index)))
        for polygon in mesh.polygons:
            polygon.material_index = min(material_ids[polygon.index], len(collision_indices) - 1)

    return obj, center_x, center_y


def convert_visual_to_drawable(obj, name: str):
    convert_obj_to_drawable = addon_import("tools.drawablehelper").convert_obj_to_drawable
    obj.name = name
    root = convert_obj_to_drawable(obj)
    root.name = name
    return root


def convert_collision_mesh(obj, name: str):
    convert_obj_to_composite = addon_import("tools.boundhelper").convert_obj_to_composite
    SollumType = addon_import("sollumz_properties").SollumType
    obj.name = name
    composite = convert_obj_to_composite(obj, SollumType.BOUND_GEOMETRYBVH)
    composite.name = name
    return composite


def create_ytyp_and_archetype(scene, ytyp, asset, texture_dictionary: str, lod_dist: float, physics_dictionary: str = ""):
    archetype = ytyp.new_archetype()
    archetype.name = asset.name
    archetype.asset = asset
    archetype.texture_dictionary = texture_dictionary
    archetype.physics_dictionary = physics_dictionary
    archetype.lod_dist = lod_dist
    return archetype


def main():
    args = parse_args()
    job_path = Path(args.job).resolve()
    output_root = Path(args.output).resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    meta = json.loads(job_path.read_text(encoding="utf-8"))
    params = meta["params"]
    generation = int(meta["generation"])
    n, heights, weights, vegetation, land, props, grass = read_buffers(job_path, meta)

    progress("Chargement de Sollumz et PyMateria", 1)
    load_sollumz()
    from szio.gta5 import AssetFormat, is_provider_available
    get_addon_preferences = addon_import("sollumz_preferences").get_addon_preferences
    get_maps = addon_import("ymap_next.properties.map").get_maps

    if not is_provider_available(AssetFormat.NATIVE):
        raise RuntimeError(
            "PyMateria n'est pas disponible. Installe Sollumz 2.9.1+ et PyMateria sur ce Windows, "
            "puis relance Blender en mode background."
        )
    if bpy.app.version < (4, 0, 0):
        raise RuntimeError("Blender 4.0 ou supérieur est requis par Sollumz récent.")

    scene = bpy.context.scene
    prefs = get_addon_preferences()
    export_settings = prefs.export_settings
    export_settings.target_formats = {"NATIVE", "CWXML"}
    export_settings.target_versions = {"GEN" + str(generation)}
    export_settings.limit_to_selected = False
    export_settings.export_ytyps = True
    export_settings.export_ytyps_include = "ALL"
    export_settings.export_ymaps = True
    export_settings.export_ymaps_include = "ALL"
    export_settings.export_ytds = True
    export_settings.export_ytds_include = "ALL"

    world_size = float(params["worldSize"])
    origin_x = float(params.get("originX", 0))
    origin_y = float(params.get("originY", 0))
    tex_scale = float(params.get("texScale", 6))
    resource = params["name"]
    output_assets = output_root / "sollumz"
    output_assets.mkdir(parents=True, exist_ok=True)

    progress("Création des matériaux GunWare et du TXD", 2)
    materials, images, txd_name = ensure_materials(meta, output_root)

    # Create one YTYP containing the terrain and LOD archetypes, and one YMAP group
    # containing the complete streaming hierarchy.
    ytyp = scene.ytyps.add()
    ytyp.name = resource + "_terrain"
    scene.ytyp_index = len(scene.ytyps) - 1
    ytyp.last_archetype_id = 0

    maps = get_maps(create_if_missing=True)
    group = maps.new_group()
    group.name = resource + "_world"
    map_data = group.new_map()
    map_data.name = resource + "_main"
    map_data.partition_mode = "NONE"

    size_cells = n - 1
    tile_cells = min(120, max(32, size_cells))
    starts = list(range(0, size_cells, tile_cells))
    total_tiles = len(starts) * len(starts)
    tile_count = 0
    skipped_tiles = 0
    collision_indices = [
        int(material.get("collisionMaterial", 0))
        for material in meta.get("materials", [])[:4]
    ]
    while len(collision_indices) < 4:
        collision_indices.append(0)

    prop_models = []
    entities_total = 0
    for iy, y0 in enumerate(starts):
        y1 = min(size_cells, y0 + tile_cells)
        for ix, x0 in enumerate(starts):
            x1 = min(size_cells, x0 + tile_cells)
            tile_name = f"{resource}_t{iy:02d}{ix:02d}"
            tile_count += 1
            level_entities = []

            for level_index, (lod_level, step, distance) in enumerate((
                ("HD", 1, 1200.0),
                ("LOD", 2, 3200.0),
                ("SLOD1", 4, 8000.0),
                ("SLOD2", 8, 16000.0),
                ("SLOD3", 16, 32000.0),
                ("SLOD4", 32, 64000.0),
            )):
                visual_name = tile_name + "_" + lod_level.lower()
                visual_obj, cx, cy = build_mesh(
                    visual_name, n, heights, weights, land, x0, x1, y0, y1,
                    step, world_size, origin_x, origin_y, tex_scale, materials,
                )
                if visual_obj is None:
                    if level_index == 0:
                        skipped_tiles += 1
                    break
                drawable = convert_visual_to_drawable(visual_obj, visual_name)
                physics_name = ""
                if level_index == 0:
                    # Collision is deliberately coarser than the render mesh; keeping it separate
                    # avoids exporting millions of visual triangles into the YBN.
                    collision_step = max(1, math.ceil((x1 - x0) / 72))
                    collision_obj, _, _ = build_mesh(
                        visual_name, n, heights, weights, land, x0, x1, y0, y1,
                        collision_step, world_size, origin_x, origin_y, tex_scale,
                        materials, True, collision_indices,
                    )
                    if collision_obj is None:
                        raise RuntimeError("Collision terrain vide pour " + visual_name)
                    collision = convert_collision_mesh(collision_obj, visual_name)
                    physics_name = visual_name

                create_ytyp_and_archetype(
                    scene, ytyp, drawable, txd_name, distance,
                    physics_dictionary=physics_name,
                )
                entity = group.new_entity()
                entity.map_data_uuid = map_data.uuid
                entity.archetype_name = drawable.name.lower()
                entity.linked_object = drawable
                entity.lod_level = lod_level
                entity.lod_dist = distance
                entity.priority_level = "REQUIRED"
                level_entities.append(entity)
                entities_total += 1

            for child_level in range(len(level_entities) - 1):
                level_entities[child_level].parent_uuid = level_entities[child_level + 1].uuid

            if tile_count % 8 == 0:
                progress(f"Maillage et collision : {tile_count}/{total_tiles} tuiles", 2)

    # Built-in GTA models are referenced as YMAP entities; they are not copied or renamed.
    # The model names are checked later against the target game's installed archetypes.
    tree_types = params.get("treeTypes") or ["prop_palm_med_01b"]
    rock_types = params.get("rockTypes") or ["prop_rock_1_d"]
    max_prop_entities = int(os.environ.get("ISLAND_WORKER_MAX_PROP_ENTITIES", "5000"))
    props_written = 0
    for index, placement in enumerate(props):
        if props_written >= max_prop_entities:
            break
        x, y, z, scale, rotation, kind = [float(v) for v in placement]
        models = rock_types if kind > 0.5 else tree_types
        if not models:
            continue
        model_name = str(models[index % len(models)]).lower()
        if not model_name or len(model_name) > 128:
            continue
        entity = group.new_entity()
        entity.map_data_uuid = map_data.uuid
        entity.archetype_name = model_name
        entity.position = (x + origin_x, y + origin_y, z)
        entity.rotation = Euler((0.0, 0.0, rotation), "XYZ").to_quaternion()
        entity.scale_xy = scale
        entity.scale_z = scale
        entity.lod_level = "HD"
        entity.lod_dist = 250.0
        entity.priority_level = "OPTIONAL_MEDIUM"
        props_written += 1

    map_data.extents_manual = False
    group.refresh_ui()

    progress("Export natif YDR/YBN/YMAP/YTYP/YTD via PyMateria", 5)
    result = bpy.ops.sollumz.export_assets(directory=str(output_assets), direct_export=True)
    if "FINISHED" not in result:
        raise RuntimeError("Sollumz a annulé l'export des assets : " + str(result))

    # Preserve a useful scene file for debugging/re-export on the Windows machine.
    bpy.ops.wm.save_as_mainfile(filepath=str(output_root / (resource + "_" + "gen" + str(generation) + ".blend")))

    progress("Rapport et validation des fichiers", 6)
    config_dir = output_root / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    origin_x = float(params.get("originX", 0))
    origin_y = float(params.get("originY", 0))
    props_types = {
        "trees": params.get("treeTypes") or ["prop_palm_med_01b"],
        "rocks": params.get("rockTypes") or ["prop_rock_1_d"],
    }
    vegetation_placements = []
    for index, placement in enumerate(props):
        x, y, z, scale, rotation, kind = [float(v) for v in placement]
        models = props_types["rocks"] if kind > 0.5 else props_types["trees"]
        if models:
            vegetation_placements.append({
                "x": x + origin_x, "y": y + origin_y, "z": z,
                "scale": scale, "rotation": rotation,
                "kind": "rock" if kind > 0.5 else "tree",
                "model": models[index % len(models)],
            })
    grass_types = params.get("grassTypes") or ["proc_grasses01"]
    grass_placements = [
        {
            "x": float(item[0]) + origin_x,
            "y": float(item[1]) + origin_y,
            "z": float(item[2]),
            "scale": float(item[3]),
            "model": grass_types[index % len(grass_types)],
        }
        for index, item in enumerate(grass)
    ]
    (config_dir / "materials.json").write_text(json.dumps({
        "source": "GunWare GTA texture dictionary names supplied with Island Forge",
        "materials": meta.get("materials", []),
        "actualImages": "User-supplied overrides or generated fallback PNG maps; original GTA bitmap files are not bundled.",
    }, indent=2), encoding="utf-8")
    (config_dir / "vegetation-placements.json").write_text(json.dumps({
        "nativeEntitiesWritten": props_written,
        "placements": vegetation_placements,
        "note": "Tree/rock model names reference game archetypes; check their availability on the target game build.",
    }, indent=2), encoding="utf-8")
    (config_dir / "grass-placements.json").write_text(json.dumps({
        "nativeGrassBatchWritten": False,
        "placements": grass_placements,
        "note": "Grass is exported as source placement data, not yet as a native YMAP grass batch.",
    }, indent=2), encoding="utf-8")
    (config_dir / "water.json").write_text(json.dumps({
        "waterLevel": 0,
        "seaDepth": float(params.get("seaDepth", 60)),
        "wavesPreview": bool(params.get("waves", False)),
        "nativeWaterQuadWritten": False,
        "note": "Native GTA water quad authoring remains a separate step.",
    }, indent=2), encoding="utf-8")
    written = [str(path.relative_to(output_assets)) for path in output_assets.rglob("*") if path.is_file()]
    report = {
        "resource": resource,
        "generation": generation,
        "blenderVersion": bpy.app.version_string,
        "terrainResolution": n,
        "tileCells": tile_cells,
        "tilesPlanned": total_tiles,
        "tilesWithNoLand": skipped_tiles,
        "mapEntities": entities_total + props_written,
        "lodLevelsPerTile": ["HD", "LOD", "SLOD1", "SLOD2", "SLOD3", "SLOD4"],
        "treeRockPlacements": props_written,
        "grassPlacementsProvided": int(grass.shape[0]),
        "grassNativeBatch": False,
        "nativeWater": False,
        "textureDictionary": txd_name,
        "textureSource": "GUNWARE_TEXTURE_DIR override if supplied; otherwise procedural fallback PNG maps",
        "binaryAssets": {
            "ydr": [item for item in written if item.lower().endswith(".ydr")],
            "ybn": [item for item in written if item.lower().endswith(".ybn")],
            "ytyp": [item for item in written if item.lower().endswith(".ytyp")],
            "ytd": [item for item in written if item.lower().endswith(".ytd")],
            "ymap": [item for item in written if item.lower().endswith(".ymap")],
        },
        "ymapCodeWalkerXml": [item for item in written if item.lower().endswith(".ymap.xml")],
        "ymapBinaryProduced": any(item.lower().endswith(".ymap") for item in written),
        "nativeExportBackend": "Sollumz + szio + PyMateria",
        "notes": [
            "YMAP is written as a native RSC resource by the Sollumz/szio PyMateria provider.",
            "Gen9 map data uses the shared native MapData writer exposed by the Gen9 provider fallback.",
            "Grass is retained in the source package but is not yet emitted as a native MapGrassInstanceList.",
            "Water settings are retained as metadata; a native GTA water quad pass remains separate.",
        ],
    }
    (output_root / "blender-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    missing = [kind for kind in ("ydr", "ybn", "ytyp", "ytd", "ymap") if not report["binaryAssets"][kind]]
    if missing:
        raise RuntimeError("Export natif incomplet : assets manquants " + ", ".join(missing) + ". Voir blender-report.json.")
    progress("YDR/YBN/YMAP/YTYP/YTD natifs générés via PyMateria", 7)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("ISLAND_WORKER_ERROR: " + str(exc), file=sys.stderr, flush=True)
        traceback.print_exc()
        raise
