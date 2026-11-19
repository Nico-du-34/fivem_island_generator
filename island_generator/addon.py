import bpy
import math
import json
import os
import random
import tempfile
import zipfile
from mathutils import Vector
from bpy.props import (
    IntProperty, FloatProperty, BoolProperty, StringProperty,
    EnumProperty, PointerProperty
)

COLLECTION_NAME = "TW_Island_Generator"


def _collection():
    col = bpy.data.collections.get(COLLECTION_NAME)
    if not col:
        col = bpy.data.collections.new(COLLECTION_NAME)
        bpy.context.scene.collection.children.link(col)
    return col


def _clear_generated():
    col = bpy.data.collections.get(COLLECTION_NAME)
    if not col:
        return
    for obj in list(col.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def _smoothstep(a, b, x):
    if a == b:
        return 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def _noise(x, y, seed, scale):
    # Deterministic multi-octave value noise; intentionally dependency-free.
    def hash2(ix, iy):
        n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0xFFFFFFFF
        n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
        n ^= n >> 16
        return n / 4294967295.0

    def smooth(t):
        return t * t * (3.0 - 2.0 * t)

    px, py = x * scale, y * scale
    x0, y0 = math.floor(px), math.floor(py)
    tx, ty = smooth(px - x0), smooth(py - y0)
    a = hash2(x0, y0)
    b = hash2(x0 + 1, y0)
    c = hash2(x0, y0 + 1)
    d = hash2(x0 + 1, y0 + 1)
    return ((a * (1 - tx) + b * tx) * (1 - ty) +
            (c * (1 - tx) + d * tx) * ty) * 2.0 - 1.0


def _terrain_height(nx, ny, p):
    # Elliptical, mildly irregular island mask with a broad bay on the south.
    radial = math.sqrt((nx * 0.93) ** 2 + (ny * 1.05) ** 2)
    coast_noise = _noise(nx, ny, p.seed, 5.0) * p.coast_irregularity
    radial += coast_noise
    # Bite a broad bay into the southern shoreline without disconnecting the land.
    bay = math.exp(-(((nx + 0.10) / 0.34) ** 2 + ((ny + 0.91) / 0.22) ** 2))
    radial += bay * 0.20
    land = 1.0 - _smoothstep(p.coast_start, 1.0, radial)
    land = max(0.0, min(1.0, land))
    coast_ease = _smoothstep(0.0, 0.20, land)

    # North-eastern mountain spine and a central green valley.
    ridge_axis = nx * 0.55 + ny * 0.75 + 0.08
    ridge = math.exp(-((ridge_axis / 0.34) ** 2))
    ridge *= _smoothstep(-0.75, 0.10, ny)
    valley_cut = math.exp(-(((nx + 0.18) / 0.32) ** 2 + ((ny - 0.02) / 0.55) ** 2))
    broad = (0.30 + 0.70 * ridge) * p.relief
    detail = (
        _noise(nx, ny, p.seed, 2.2) * 0.20 +
        _noise(nx, ny, p.seed + 17, 6.0) * 0.08 +
        _noise(nx, ny, p.seed + 31, 15.0) * 0.025
    ) * p.relief
    height = p.sea_level + (broad + detail) * coast_ease
    height -= valley_cut * p.relief * 0.22 * coast_ease
    height = max(p.sea_level, height)
    return height, land


def _material(name, color, roughness=0.85):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.roughness = roughness
    return mat


def _add_terrain_tile(name, verts, faces, materials, indices, collection):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    for mat in materials:
        mesh.materials.append(mat)
    for poly, idx in zip(mesh.polygons, indices):
        poly.material_index = idx
    # Smooth shading; retain a small number of sharp coastal edges automatically.
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj


def _assign_material_index(height, slope, sea_level, p):
    if height < sea_level + p.sand_height:
        return 0
    if slope > p.rock_slope:
        return 2
    return 1


class TWIslandSettings(bpy.types.PropertyGroup):
    island_name: StringProperty(name="Island name", default="Tropical Island")
    seed: IntProperty(name="Seed", default=42, min=0, max=999999)
    size_x: FloatProperty(name="Width (m)", default=12000.0, min=2000.0, max=30000.0)
    size_y: FloatProperty(name="Length (m)", default=12000.0, min=2000.0, max=30000.0)
    resolution: IntProperty(name="Resolution", default=257, min=65, max=1025)
    tiles: IntProperty(name="Tiles per axis", default=4, min=1, max=16)
    relief: FloatProperty(name="Relief (m)", default=650.0, min=50.0, max=2000.0)
    sea_level: FloatProperty(name="Sea level (m)", default=0.0)
    coast_start: FloatProperty(name="Coast start", default=0.72, min=0.3, max=0.95)
    coast_irregularity: FloatProperty(name="Coast irregularity", default=0.045, min=0.0, max=0.2)
    sand_height: FloatProperty(name="Sand band (m)", default=14.0, min=1.0, max=80.0)
    rock_slope: FloatProperty(name="Rock slope", default=0.55, min=0.05, max=2.0)
    export_origin_x: FloatProperty(name="FiveM origin X", default=0.0)
    export_origin_y: FloatProperty(name="FiveM origin Y", default=0.0)
    export_origin_z: FloatProperty(name="FiveM origin Z", default=0.0)
    include_preview: BoolProperty(name="Include GLB preview", default=True)
    generate_guides: BoolProperty(name="Generate road guide", default=True)
    generate_scatter: BoolProperty(name="Generate vegetation points", default=True)
    scatter_count: IntProperty(name="Vegetation points", default=2500, min=0, max=50000)
    export_path: StringProperty(name="Export ZIP", default="//tropical_island_fivem.zip", subtype="FILE_PATH")


class TW_OT_Generate(bpy.types.Operator):
    bl_idname = "tw_island.generate"
    bl_label = "Generate Island"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        p = context.scene.tw_island_settings
        if p.resolution % p.tiles != 1 % p.tiles and (p.resolution - 1) % p.tiles != 0:
            self.report({"ERROR"}, "Resolution must satisfy (resolution - 1) divisible by tile count.")
            return {"CANCELLED"}
        _clear_generated()
        col = _collection()
        sand = _material("TW_Sand", (0.72, 0.62, 0.40))
        grass = _material("TW_Tropical_Grass", (0.16, 0.34, 0.16))
        rock = _material("TW_Rock", (0.28, 0.27, 0.23))
        mats = [sand, grass, rock]

        n = p.resolution
        step = (n - 1) // p.tiles
        heights = [[0.0] * n for _ in range(n)]
        lands = [[0.0] * n for _ in range(n)]
        for iy in range(n):
            ny = (iy / (n - 1)) * 2.0 - 1.0
            for ix in range(n):
                nx = (ix / (n - 1)) * 2.0 - 1.0
                h, land = _terrain_height(nx, ny, p)
                heights[iy][ix] = h
                lands[iy][ix] = land

        for ty in range(p.tiles):
            for tx in range(p.tiles):
                verts, faces, indices = [], [], []
                x0, y0 = tx * step, ty * step
                x1 = (tx + 1) * step if tx < p.tiles - 1 else n - 1
                y1 = (ty + 1) * step if ty < p.tiles - 1 else n - 1
                width = x1 - x0 + 1
                for iy in range(y0, y1 + 1):
                    for ix in range(x0, x1 + 1):
                        x = (ix / (n - 1) - 0.5) * p.size_x
                        y = (iy / (n - 1) - 0.5) * p.size_y
                        verts.append((x, y, heights[iy][ix]))
                for ly in range(y1 - y0):
                    for lx in range(x1 - x0):
                        a = ly * width + lx
                        b, c, d = a + 1, a + width + 1, a + width
                        faces.append((a, b, c, d))
                        h = (heights[y0 + ly][x0 + lx] + heights[y0 + ly][x0 + lx + 1] +
                             heights[y0 + ly + 1][x0 + lx] + heights[y0 + ly + 1][x0 + lx + 1]) / 4.0
                        dx = (heights[y0 + ly][x0 + lx + 1] - heights[y0 + ly][x0 + lx]) / max(1.0, p.size_x / n)
                        dy = (heights[y0 + ly + 1][x0 + lx] - heights[y0 + ly][x0 + lx]) / max(1.0, p.size_y / n)
                        slope = math.sqrt(dx * dx + dy * dy)
                        indices.append(_assign_material_index(h, slope, p.sea_level, p))
                _add_terrain_tile(f"TRN_{tx:02d}_{ty:02d}", verts, faces, mats, indices, col)

        if p.generate_guides:
            _create_road_guide(col, p)
        if p.generate_scatter and p.scatter_count:
            _create_scatter(col, p)
        self.report({"INFO"}, f"Generated {p.tiles * p.tiles} terrain tiles.")
        return {"FINISHED"}


def _create_road_guide(collection, p):
    # Non-final guide curve: marks a broad loop through accessible lowland.
    points = [
        (-0.34 * p.size_x, -0.12 * p.size_y, p.sea_level + 18),
        (-0.22 * p.size_x, 0.04 * p.size_y, p.sea_level + 32),
        (-0.05 * p.size_x, 0.18 * p.size_y, p.sea_level + 24),
        (0.18 * p.size_x, 0.24 * p.size_y, p.sea_level + 28),
        (0.34 * p.size_x, 0.08 * p.size_y, p.sea_level + 20),
        (0.25 * p.size_x, -0.20 * p.size_y, p.sea_level + 16),
        (0.02 * p.size_x, -0.32 * p.size_y, p.sea_level + 12),
    ]
    curve = bpy.data.curves.new("TW_Road_Guide_Curve", "CURVE")
    curve.dimensions = "3D"
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = co
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new("GUIDE_Road_Network_NOT_FINAL", curve)
    collection.objects.link(obj)


def _create_scatter(collection, p):
    rng = random.Random(p.seed)
    mesh = bpy.data.meshes.new("TW_Vegetation_Scatter_Points_Mesh")
    verts = []
    attempts = 0
    while len(verts) < p.scatter_count and attempts < p.scatter_count * 8:
        attempts += 1
        nx, ny = rng.uniform(-0.86, 0.86), rng.uniform(-0.86, 0.86)
        h, land = _terrain_height(nx, ny, p)
        if land < 0.30 or h < p.sea_level + p.sand_height * 1.5:
            continue
        x, y = nx * p.size_x * 0.5, ny * p.size_y * 0.5
        verts.append((x, y, h))
    mesh.from_pydata(verts, [], [])
    obj = bpy.data.objects.new("GUIDE_Vegetation_Scatter_Points", mesh)
    collection.objects.link(obj)


def _settings_dict(p):
    return {
        "project": "FiveM Island Generator",
        "island_name": p.island_name,
        "seed": p.seed,
        "size_m": {"x": p.size_x, "y": p.size_y},
        "resolution": p.resolution,
        "tiles_per_axis": p.tiles,
        "relief_m": p.relief,
        "sea_level_m": p.sea_level,
        "coast_start": p.coast_start,
        "coast_irregularity": p.coast_irregularity,
        "sand_band_m": p.sand_height,
        "rock_slope_threshold": p.rock_slope,
        "export_origin": {"x": p.export_origin_x, "y": p.export_origin_y, "z": p.export_origin_z},
        "export_note": "OBJ/GLB are interchange formats, not native GTA V assets."
    }


def _export_obj(obj, filepath):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"# {obj.name} - Blender interchange OBJ\n")
            for v in mesh.vertices:
                world = obj.matrix_world @ v.co
                f.write(f"v {world.x:.6f} {world.y:.6f} {world.z:.6f}\n")
            for poly in mesh.polygons:
                indices = [str(i + 1) for i in poly.vertices]
                f.write("f " + " ".join(indices) + "\n")
    finally:
        evaluated.to_mesh_clear()


class TW_OT_Export(bpy.types.Operator):
    bl_idname = "tw_island.export_fivem"
    bl_label = "Export FiveM Package"
    bl_options = {"REGISTER"}

    def execute(self, context):
        p = context.scene.tw_island_settings
        col = bpy.data.collections.get(COLLECTION_NAME)
        if not col or not any(o.type == "MESH" and o.name.startswith("TRN_") for o in col.objects):
            self.report({"ERROR"}, "Generate an island before exporting.")
            return {"CANCELLED"}

        path = bpy.path.abspath(p.export_path)
        if not path.lower().endswith(".zip"):
            path += ".zip"
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)

        with tempfile.TemporaryDirectory(prefix="tw_island_") as temp:
            root = os.path.join(temp, "tropical_island_fivem")
            os.makedirs(root)
            for folder in ("config", "manifest", "geometry/terrain", "geometry/preview", "fivem_resource/stream"):
                os.makedirs(os.path.join(root, folder), exist_ok=True)

            config = _settings_dict(p)
            with open(os.path.join(root, "config", "island_config.json"), "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2, ensure_ascii=False)

            objects = [o for o in col.objects if o.type == "MESH" and o.name.startswith("TRN_")]
            origin = Vector((p.export_origin_x, p.export_origin_y, p.export_origin_z))
            manifest = {"name": p.island_name, "coordinate_units": "meters/Blender Units", "origin": list(origin),
                        "tiles": [], "native_gta_assets_generated": False}
            for obj in objects:
                obj.location += origin
                filename = obj.name + ".obj"
                _export_obj(obj, os.path.join(root, "geometry", "terrain", filename))
                obj.location -= origin
                manifest["tiles"].append({"object": obj.name, "file": filename, "format": "OBJ", "requires_sollumz_conversion": True})

            if p.include_preview:
                preview_path = os.path.join(root, "geometry", "preview", "island_preview.glb")
                bpy.ops.export_scene.gltf(filepath=preview_path, export_format="GLB", use_selection=False)

            with open(os.path.join(root, "manifest", "island_manifest.json"), "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2, ensure_ascii=False)

            resource = os.path.join(root, "fivem_resource")
            with open(os.path.join(resource, "fxmanifest.lua"), "w", encoding="utf-8") as f:
                f.write("fx_version 'cerulean'\ngame 'gta5'\n\nauthor 'FiveM Island Generator'\ndescription 'Generated island resource scaffold'\nversion '0.1.0'\n\nthis_is_a_map 'yes'\n")
            with open(os.path.join(resource, "README.md"), "w", encoding="utf-8") as f:
                f.write("# Generated FiveM Resource\\n\\nThis is a scaffold only. Convert OBJ terrain tiles into GTA V assets with Sollumz, create valid YBN collision and appropriate YMAP/YTYP data, place native assets in stream/, then validate in CodeWalker.\\n")
            with open(os.path.join(resource, "stream", "README_ASSET_PIPELINE.txt"), "w", encoding="utf-8") as f:
                f.write("No native GTA V map files are generated by this exporter. Add validated .ydr/.ybn/.ymap/.ytyp/.ytd assets here after Sollumz/CodeWalker processing.\\n")

            with open(os.path.join(root, "README_EXPORT.txt"), "w", encoding="utf-8") as f:
                f.write("FIVEM ISLAND EXPORT\\n\\nThis package contains Blender interchange geometry and a FiveM resource scaffold. It is NOT a ready-to-run native GTA V map. Convert and validate geometry with Sollumz and CodeWalker before deployment.\\n")

            with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
                for base, _, files in os.walk(root):
                    for filename in files:
                        full = os.path.join(base, filename)
                        zf.write(full, os.path.relpath(full, temp))
        self.report({"INFO"}, f"Exported package: {path}")
        return {"FINISHED"}


class TW_PT_Panel(bpy.types.Panel):
    bl_label = "FiveM Island Generator"
    bl_idname = "TW_PT_island_generator"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Island Gen"

    def draw(self, context):
        layout = self.layout
        p = context.scene.tw_island_settings
        box = layout.box()
        box.label(text="Island")
        box.prop(p, "island_name")
        box.prop(p, "seed")
        box.prop(p, "size_x")
        box.prop(p, "size_y")
        box.prop(p, "resolution")
        box.prop(p, "tiles")
        box = layout.box()
        box.label(text="Terrain")
        box.prop(p, "relief")
        box.prop(p, "sea_level")
        box.prop(p, "coast_start")
        box.prop(p, "coast_irregularity")
        box.prop(p, "sand_height")
        box.prop(p, "rock_slope")
        box = layout.box()
        box.label(text="Guides")
        box.prop(p, "generate_guides")
        box.prop(p, "generate_scatter")
        if p.generate_scatter:
            box.prop(p, "scatter_count")
        layout.operator("tw_island.generate", icon="RNDCURVE", text="Generate Island")
        layout.separator()
        box = layout.box()
        box.label(text="FiveM Export")
        box.prop(p, "export_origin_x")
        box.prop(p, "export_origin_y")
        box.prop(p, "export_origin_z")
        box.prop(p, "include_preview")
        box.prop(p, "export_path")
        layout.operator("tw_island.export_fivem", icon="EXPORT", text="Export FiveM Package")


classes = (TWIslandSettings, TW_OT_Generate, TW_OT_Export, TW_PT_Panel)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.tw_island_settings = PointerProperty(type=TWIslandSettings)


def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    del bpy.types.Scene.tw_island_settings
