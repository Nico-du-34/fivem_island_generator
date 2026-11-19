import bpy
import json
import math
import os
import random
import struct
import tempfile
import zipfile
import zlib
from mathutils import Vector
from bpy.props import (
    IntProperty,
    FloatProperty,
    BoolProperty,
    StringProperty,
    PointerProperty,
)

COLLECTION_NAME = "TW_Island_Generator"
MATERIALS = (
    ("TW_Sand", (0.76, 0.66, 0.46)),
    ("TW_Tropical_Grass", (0.18, 0.36, 0.17)),
    ("TW_Rock", (0.30, 0.29, 0.26)),
    ("TW_Ocean_Preview", (0.025, 0.22, 0.32)),
)


def _collection():
    collection = bpy.data.collections.get(COLLECTION_NAME)
    if collection is None:
        collection = bpy.data.collections.new(COLLECTION_NAME)
        bpy.context.scene.collection.children.link(collection)
    return collection


def _clear_generated():
    collection = bpy.data.collections.get(COLLECTION_NAME)
    if collection is None:
        return
    old_objects = list(collection.objects)
    old_meshes = [obj.data for obj in old_objects if obj.type == "MESH"]
    old_curves = [obj.data for obj in old_objects if obj.type == "CURVE"]
    for obj in old_objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in old_meshes:
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for curve in old_curves:
        if curve.users == 0:
            bpy.data.curves.remove(curve)


def _smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 0.0
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def _noise(x, y, seed, scale):
    """Deterministic bilinear value noise. No external Python dependency."""
    def hash2(ix, iy):
        value = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0xFFFFFFFF
        value = ((value ^ (value >> 13)) * 1274126177) & 0xFFFFFFFF
        value ^= value >> 16
        return value / 4294967295.0

    px, py = x * scale, y * scale
    x0, y0 = math.floor(px), math.floor(py)
    tx = (px - x0) ** 2 * (3.0 - 2.0 * (px - x0))
    ty = (py - y0) ** 2 * (3.0 - 2.0 * (py - y0))
    a = hash2(x0, y0)
    b = hash2(x0 + 1, y0)
    c = hash2(x0, y0 + 1)
    d = hash2(x0 + 1, y0 + 1)
    lower = a * (1.0 - tx) + b * tx
    upper = c * (1.0 - tx) + d * tx
    return (lower * (1.0 - ty) + upper * ty) * 2.0 - 1.0


def _terrain_height(nx, ny, settings):
    # Irregular elliptical island with a broad southern bay.
    radial = math.sqrt((nx * 0.93) ** 2 + (ny * 1.05) ** 2)
    radial += _noise(nx, ny, settings.seed, 5.0) * settings.coast_irregularity
    bay = math.exp(-(((nx + 0.10) / 0.34) ** 2 + ((ny + 0.91) / 0.22) ** 2))
    radial += bay * settings.southern_bay
    land = max(0.0, min(1.0, 1.0 - _smoothstep(settings.coast_start, 1.0, radial)))
    coast_ease = _smoothstep(0.0, 0.20, land)

    # Mountain spine toward the north-east, with a central lowland valley.
    ridge_axis = nx * 0.55 + ny * 0.75 + 0.08
    ridge = math.exp(-((ridge_axis / settings.mountain_width) ** 2))
    ridge *= _smoothstep(-0.75, 0.10, ny)
    valley = math.exp(-(((nx + 0.18) / 0.32) ** 2 + ((ny - 0.02) / 0.55) ** 2))
    broad = (0.22 + settings.mountain_strength * ridge) * settings.relief
    detail = (
        _noise(nx, ny, settings.seed, 2.2) * 0.20
        + _noise(nx, ny, settings.seed + 17, 6.0) * 0.08
        + _noise(nx, ny, settings.seed + 31, 15.0) * 0.025
    ) * settings.relief
    height = settings.sea_level + (broad + detail) * coast_ease
    height -= valley * settings.relief * settings.valley_strength * coast_ease
    height = max(settings.sea_level, height)
    return height, land


def _get_material(name, color, roughness=0.88):
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.roughness = roughness
    return material


def _create_mesh_object(name, vertices, faces, collection, materials=None, material_indices=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    for material in materials or []:
        mesh.materials.append(material)
    if material_indices:
        for polygon, index in zip(mesh.polygons, material_indices):
            polygon.material_index = index
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def _material_index(height, slope, land_factor, settings):
    # Sand follows the shoreline mask; steep inland faces become rock.
    if land_factor < 0.76 or height < settings.sea_level + settings.sand_height:
        return 0
    if slope > settings.rock_slope:
        return 2
    return 1


def _create_ocean_preview(collection, settings, ocean_material):
    half_x = settings.size_x * 0.72
    half_y = settings.size_y * 0.72
    z = settings.sea_level - 0.15
    vertices = [(-half_x, -half_y, z), (half_x, -half_y, z),
                (half_x, half_y, z), (-half_x, half_y, z)]
    obj = _create_mesh_object("PREVIEW_Ocean_NOT_GTA_Water", vertices, [(0, 1, 2, 3)], collection,
                              materials=[ocean_material])
    obj["tw_preview_only"] = True
    return obj


def _create_road_guide(collection, settings):
    # Guide path only. It is not a drivable road mesh.
    normalized = [
        (-0.34, -0.12), (-0.22, 0.04), (-0.05, 0.18),
        (0.18, 0.24), (0.34, 0.08), (0.25, -0.20), (0.02, -0.32),
    ]
    points = []
    for nx, ny in normalized:
        height, land = _terrain_height(nx, ny, settings)
        points.append((nx * settings.size_x * 0.5, ny * settings.size_y * 0.5, height + 4.0))
    curve = bpy.data.curves.new("TW_Road_Guide_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new("GUIDE_Road_Network_NOT_FINAL", curve)
    collection.objects.link(obj)
    obj["tw_guide_only"] = True
    return points


def _create_scatter(collection, settings):
    rng = random.Random(settings.seed)
    vertices = []
    exported_points = []
    attempts = 0
    target = settings.scatter_count
    while len(vertices) < target and attempts < max(1, target * 12):
        attempts += 1
        nx = rng.uniform(-0.86, 0.86)
        ny = rng.uniform(-0.86, 0.86)
        height, land = _terrain_height(nx, ny, settings)
        if land < 0.34 or height < settings.sea_level + settings.sand_height * 1.7:
            continue
        x = nx * settings.size_x * 0.5
        y = ny * settings.size_y * 0.5
        vertices.append((x, y, height))
        exported_points.append({"x": round(x, 3), "y": round(y, 3), "z": round(height, 3)})
    mesh = bpy.data.meshes.new("TW_Vegetation_Scatter_Points_Mesh")
    mesh.from_pydata(vertices, [], [])
    mesh.update()
    obj = bpy.data.objects.new("GUIDE_Vegetation_Scatter_Points", mesh)
    collection.objects.link(obj)
    obj["tw_guide_only"] = True
    return exported_points


def _write_png_chunk(file_handle, chunk_type, data):
    file_handle.write(struct.pack(">I", len(data)))
    file_handle.write(chunk_type)
    file_handle.write(data)
    crc = zlib.crc32(chunk_type)
    crc = zlib.crc32(data, crc)
    file_handle.write(struct.pack(">I", crc & 0xFFFFFFFF))


def _write_heightmap_16bit(heights, path, sea_level, max_height):
    """Write a 16-bit grayscale PNG; rows are vertically flipped for image convention."""
    height = len(heights)
    width = len(heights[0]) if height else 0
    if width == 0:
        raise ValueError("Heightmap contains no samples.")
    scale = max(0.001, max_height - sea_level)
    raw = bytearray()
    for row in reversed(heights):
        raw.append(0)  # PNG filter: None
        for value in row:
            normalized = max(0.0, min(1.0, (value - sea_level) / scale))
            raw.extend(struct.pack(">H", int(round(normalized * 65535.0))))
    with open(path, "wb") as output:
        output.write(b"\\x89PNG\\r\\n\\x1a\\n")
        _write_png_chunk(output, b"IHDR", struct.pack(">2I5B", width, height, 16, 0, 0, 0, 0))
        _write_png_chunk(output, b"IDAT", zlib.compress(bytes(raw), 9))
        _write_png_chunk(output, b"IEND", b"")


def _settings_dict(settings):
    return {
        "project": "FiveM Island Generator",
        "island_name": settings.island_name,
        "seed": settings.seed,
        "size_m": {"x": settings.size_x, "y": settings.size_y},
        "resolution": settings.resolution,
        "tiles_per_axis": settings.tiles,
        "relief_m": settings.relief,
        "sea_level_m": settings.sea_level,
        "coast": {
            "start": settings.coast_start,
            "irregularity": settings.coast_irregularity,
            "southern_bay": settings.southern_bay,
            "sand_band_m": settings.sand_height,
        },
        "mountains": {
            "strength": settings.mountain_strength,
            "width": settings.mountain_width,
            "valley_strength": settings.valley_strength,
        },
        "rock_slope_threshold": settings.rock_slope,
        "export_origin": {
            "x": settings.export_origin_x,
            "y": settings.export_origin_y,
            "z": settings.export_origin_z,
        },
        "unit_note": "One Blender Unit is treated as one meter by this generator.",
        "native_gta_assets_generated": False,
    }


def _export_obj(obj, filepath, offset):
    """Write evaluated mesh geometry as OBJ. Native GTA formats are not produced here."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mtl_name = os.path.splitext(os.path.basename(filepath))[0] + ".mtl"
    try:
        with open(filepath, "w", encoding="utf-8") as output:
            output.write("# Blender interchange mesh; convert with Sollumz for GTA V.\\n")
            output.write(f"mtllib {mtl_name}\\n")
            matrix = obj.matrix_world
            for vertex in mesh.vertices:
                world = matrix @ vertex.co
                world += offset
                output.write(f"v {world.x:.6f} {world.y:.6f} {world.z:.6f}\\n")
            current_material = None
            for polygon in mesh.polygons:
                material_name = "TW_Default"
                if polygon.material_index < len(mesh.materials):
                    material = mesh.materials[polygon.material_index]
                    if material:
                        material_name = material.name.replace(" ", "_")
                if material_name != current_material:
                    output.write(f"usemtl {material_name}\\n")
                    current_material = material_name
                face = " ".join(str(index + 1) for index in polygon.vertices)
                output.write(f"f {face}\\n")
        with open(os.path.join(os.path.dirname(filepath), mtl_name), "w", encoding="utf-8") as output:
            output.write("# Approximate diffuse material colors for interchange preview.\\n")
            for material in mesh.materials:
                if not material:
                    continue
                color = material.diffuse_color
                name = material.name.replace(" ", "_")
                output.write(f"newmtl {name}\\nKd {color[0]:.4f} {color[1]:.4f} {color[2]:.4f}\\n")
                output.write("Ka 0.1000 0.1000 0.1000\\nKd 0.7000 0.7000 0.7000\\nNs 10.0000\\n\\n")
    finally:
        evaluated.to_mesh_clear()


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
    southern_bay: FloatProperty(name="Southern bay", default=0.20, min=0.0, max=0.6)
    sand_height: FloatProperty(name="Sand band (m)", default=14.0, min=1.0, max=80.0)
    mountain_strength: FloatProperty(name="Mountain strength", default=0.70, min=0.1, max=1.5)
    mountain_width: FloatProperty(name="Mountain width", default=0.34, min=0.1, max=0.8)
    valley_strength: FloatProperty(name="Valley strength", default=0.22, min=0.0, max=0.8)
    rock_slope: FloatProperty(name="Rock slope", default=0.55, min=0.05, max=2.0)
    export_origin_x: FloatProperty(name="FiveM origin X", default=0.0)
    export_origin_y: FloatProperty(name="FiveM origin Y", default=0.0)
    export_origin_z: FloatProperty(name="FiveM origin Z", default=0.0)
    include_preview: BoolProperty(name="Include GLB preview", default=True)
    generate_ocean_preview: BoolProperty(name="Ocean preview (not GTA water)", default=True)
    generate_guides: BoolProperty(name="Generate road guide", default=True)
    generate_scatter: BoolProperty(name="Generate vegetation points", default=True)
    scatter_count: IntProperty(name="Vegetation points", default=2500, min=0, max=50000)
    export_path: StringProperty(name="Export ZIP", default="//tropical_island_fivem.zip", subtype="FILE_PATH")


class TW_OT_Generate(bpy.types.Operator):
    bl_idname = "tw_island.generate"
    bl_label = "Generate Island"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        settings = context.scene.tw_island_settings
        _clear_generated()
        collection = _collection()
        sand = _get_material("TW_Sand", MATERIALS[0][1])
        grass = _get_material("TW_Tropical_Grass", MATERIALS[1][1])
        rock = _get_material("TW_Rock", MATERIALS[2][1])
        ocean = _get_material("TW_Ocean_Preview", MATERIALS[3][1])
        terrain_materials = [sand, grass, rock]

        n = settings.resolution
        heights = [[0.0 for _ in range(n)] for _ in range(n)]
        land_factors = [[0.0 for _ in range(n)] for _ in range(n)]
        for iy in range(n):
            ny = (iy / (n - 1)) * 2.0 - 1.0
            for ix in range(n):
                nx = (ix / (n - 1)) * 2.0 - 1.0
                heights[iy][ix], land_factors[iy][ix] = _terrain_height(nx, ny, settings)

        # Tile boundaries are distributed with integer rounding, so every resolution works.
        bounds = [round(i * (n - 1) / settings.tiles) for i in range(settings.tiles + 1)]
        for tile_y in range(settings.tiles):
            for tile_x in range(settings.tiles):
                x0, x1 = bounds[tile_x], bounds[tile_x + 1]
                y0, y1 = bounds[tile_y], bounds[tile_y + 1]
                tile_width = x1 - x0 + 1
                vertices, faces, material_indices = [], [], []
                for iy in range(y0, y1 + 1):
                    for ix in range(x0, x1 + 1):
                        x = (ix / (n - 1) - 0.5) * settings.size_x
                        y = (iy / (n - 1) - 0.5) * settings.size_y
                        vertices.append((x, y, heights[iy][ix]))
                for local_y in range(y1 - y0):
                    for local_x in range(x1 - x0):
                        global_x, global_y = x0 + local_x, y0 + local_y
                        average_land = (
                            land_factors[global_y][global_x]
                            + land_factors[global_y][global_x + 1]
                            + land_factors[global_y + 1][global_x]
                            + land_factors[global_y + 1][global_x + 1]
                        ) * 0.25
                        # Do not create a flat mesh over the surrounding ocean.
                        if average_land < 0.025:
                            continue
                        a = local_y * tile_width + local_x
                        faces.append((a, a + 1, a + tile_width + 1, a + tile_width))
                        average_height = (
                            heights[global_y][global_x]
                            + heights[global_y][global_x + 1]
                            + heights[global_y + 1][global_x]
                            + heights[global_y + 1][global_x + 1]
                        ) * 0.25
                        dx = (heights[global_y][global_x + 1] - heights[global_y][global_x]) / max(1.0, settings.size_x / n)
                        dy = (heights[global_y + 1][global_x] - heights[global_y][global_x]) / max(1.0, settings.size_y / n)
                        slope = math.sqrt(dx * dx + dy * dy)
                        material_indices.append(_material_index(average_height, slope, average_land, settings))
                _create_mesh_object(
                    f"TRN_{tile_x:02d}_{tile_y:02d}", vertices, faces,
                    collection, terrain_materials, material_indices
                )

        if settings.generate_ocean_preview:
            _create_ocean_preview(collection, settings, ocean)
        road_points = _create_road_guide(collection, settings) if settings.generate_guides else []
        scatter_points = _create_scatter(collection, settings) if settings.generate_scatter else []
        context.view_layer.update()
        self.report({"INFO"}, f"Generated {settings.tiles * settings.tiles} terrain tiles.")
        return {"FINISHED"}


class TW_OT_Export(bpy.types.Operator):
    bl_idname = "tw_island.export_fivem"
    bl_label = "Export FiveM Package"
    bl_options = {"REGISTER"}

    def execute(self, context):
        settings = context.scene.tw_island_settings
        collection = bpy.data.collections.get(COLLECTION_NAME)
        terrain_objects = (
            [obj for obj in collection.objects if obj.type == "MESH" and obj.name.startswith("TRN_")]
            if collection else []
        )
        if not terrain_objects:
            self.report({"ERROR"}, "Generate an island before exporting.")
            return {"CANCELLED"}

        export_path = bpy.path.abspath(settings.export_path)
        if not export_path.lower().endswith(".zip"):
            export_path += ".zip"
        os.makedirs(os.path.dirname(export_path) or ".", exist_ok=True)
        origin = Vector((settings.export_origin_x, settings.export_origin_y, settings.export_origin_z))

        try:
            with tempfile.TemporaryDirectory(prefix="tw_island_") as temp_dir:
                package_root = os.path.join(temp_dir, "tropical_island_fivem")
                folders = (
                    "config", "manifest", "heightmap", "geometry/terrain",
                    "geometry/preview", "guides", "fivem_resource/stream",
                )
                for folder in folders:
                    os.makedirs(os.path.join(package_root, folder), exist_ok=True)

                with open(os.path.join(package_root, "config", "island_config.json"), "w", encoding="utf-8") as output:
                    json.dump(_settings_dict(settings), output, indent=2, ensure_ascii=False)

                manifest = {
                    "name": settings.island_name,
                    "coordinate_units": "meters / Blender Units",
                    "origin": {"x": origin.x, "y": origin.y, "z": origin.z},
                    "tile_count": len(terrain_objects),
                    "tiles": [],
                    "native_gta_assets_generated": False,
                    "export_status": "INTERCHANGE_GEOMETRY_ONLY_REQUIRES_SOLLUＭZ_AND_CODEWALKER",
                }
                for obj in sorted(terrain_objects, key=lambda item: item.name):
                    obj_file = obj.name + ".obj"
                    _export_obj(obj, os.path.join(package_root, "geometry", "terrain", obj_file), origin)
                    manifest["tiles"].append({
                        "object": obj.name,
                        "file": obj_file,
                        "format": "OBJ",
                        "requires_sollumz_conversion": True,
                    })

                # Export 16-bit heightmap for terrain editing/re-generation.
                n = settings.resolution
                heights = []
                for iy in range(n):
                    ny = (iy / (n - 1)) * 2.0 - 1.0
                    row = []
                    for ix in range(n):
                        nx = (ix / (n - 1)) * 2.0 - 1.0
                        height, _ = _terrain_height(nx, ny, settings)
                        row.append(height)
                    heights.append(row)
                _write_heightmap_16bit(
                    heights,
                    os.path.join(package_root, "heightmap", "island_heightmap_16bit.png"),
                    settings.sea_level,
                    settings.sea_level + settings.relief * 1.6,
                )

                if settings.include_preview:
                    # Export only this generator's collection, not unrelated scene objects.
                    previous_active = context.view_layer.objects.active
                    previous_selection = [obj for obj in context.selected_objects]
                    try:
                        bpy.ops.object.select_all(action="DESELECT")
                        for obj in collection.objects:
                            obj.select_set(True)
                        context.view_layer.objects.active = terrain_objects[0]
                        bpy.ops.export_scene.gltf(
                            filepath=os.path.join(package_root, "geometry", "preview", "island_preview.glb"),
                            export_format="GLB",
                            use_selection=True,
                        )
                    except Exception as error:
                        with open(os.path.join(package_root, "geometry", "preview", "GLB_EXPORT_WARNING.txt"), "w", encoding="utf-8") as warning:
                            warning.write("GLB preview could not be generated by this Blender installation.\\n")
                            warning.write(str(error))
                    finally:
                        bpy.ops.object.select_all(action="DESELECT")
                        for obj in previous_selection:
                            if obj.name in bpy.data.objects:
                                obj.select_set(True)
                        if previous_active and previous_active.name in bpy.data.objects:
                            context.view_layer.objects.active = previous_active

                road = next((obj for obj in collection.objects if obj.name == "GUIDE_Road_Network_NOT_FINAL"), None)
                if road:
                    spline_points = []
                    for spline in road.data.splines:
                        for point in spline.bezier_points:
                            coordinate = road.matrix_world @ point.co
                            spline_points.append({
                                "x": coordinate.x + origin.x,
                                "y": coordinate.y + origin.y,
                                "z": coordinate.z + origin.z,
                            })
                    with open(os.path.join(package_root, "guides", "road_guide.json"), "w", encoding="utf-8") as output:
                        json.dump({"status": "GUIDE_ONLY_NOT_DRIVABLE_ROAD", "points": spline_points}, output, indent=2)

                scatter = next((obj for obj in collection.objects if obj.name == "GUIDE_Vegetation_Scatter_Points"), None)
                if scatter:
                    points = []
                    for vertex in scatter.data.vertices:
                        coordinate = scatter.matrix_world @ vertex.co
                        points.append({
                            "x": round(coordinate.x + origin.x, 3),
                            "y": round(coordinate.y + origin.y, 3),
                            "z": round(coordinate.z + origin.z, 3),
                        })
                    with open(os.path.join(package_root, "guides", "vegetation_scatter.json"), "w", encoding="utf-8") as output:
                        json.dump({"status": "PLACEMENT_POINTS_ONLY_NO_MODELS", "points": points}, output)

                with open(os.path.join(package_root, "manifest", "island_manifest.json"), "w", encoding="utf-8") as output:
                    json.dump(manifest, output, indent=2, ensure_ascii=False)

                resource = os.path.join(package_root, "fivem_resource")
                with open(os.path.join(resource, "fxmanifest.lua"), "w", encoding="utf-8") as output:
                    output.write(
                        "fx_version 'cerulean'\\n"
                        "game 'gta5'\\n\\n"
                        "author 'FiveM Island Generator'\\n"
                        "description 'Generated island resource scaffold'\\n"
                        "version '0.1.0'\\n\\n"
                        "this_is_a_map 'yes'\\n"
                    )
                with open(os.path.join(resource, "README.md"), "w", encoding="utf-8") as output:
                    output.write(
                        "# Generated FiveM Resource\\n\\n"
                        "This resource is a scaffold, not a ready-to-run map. The exported OBJ terrain tiles must be converted to valid GTA V assets using a compatible Sollumz workflow. Create and test the required YDR/YBN/YMAP/YTYP assets, add them to stream/, and validate the result in CodeWalker and FiveM.\\n"
                    )
                with open(os.path.join(resource, "stream", "README_ASSET_PIPELINE.txt"), "w", encoding="utf-8") as output:
                    output.write(
                        "No native GTA V assets are generated by this package. Add verified .ydr/.ybn/.ymap/.ytyp/.ytd assets here after Sollumz conversion and CodeWalker validation.\\n"
                    )
                with open(os.path.join(package_root, "README_EXPORT.txt"), "w", encoding="utf-8") as output:
                    output.write(
                        "FIVEM ISLAND GENERATOR EXPORT\\n\\n"
                        "Included: OBJ terrain tiles, MTL materials, 16-bit PNG heightmap, optional GLB preview, guide JSON files, configuration, manifest, and a FiveM resource scaffold.\\n\\n"
                        "Important: this is NOT a ready-to-start native GTA V map. Blender interchange geometry is not equivalent to YDR/YBN/YMAP/YTYP. Convert and validate the geometry with Sollumz and CodeWalker, including collision, LOD, water, placement and world-coordinate checks, before deployment.\\n"
                    )

                with zipfile.ZipFile(export_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
                    for folder, _, filenames in os.walk(package_root):
                        for filename in filenames:
                            full_path = os.path.join(folder, filename)
                            archive.write(full_path, os.path.relpath(full_path, temp_dir))
        except Exception as error:
            self.report({"ERROR"}, f"Export failed: {error}")
            return {"CANCELLED"}

        self.report({"INFO"}, f"FiveM package exported: {export_path}")
        return {"FINISHED"}


class TW_PT_Panel(bpy.types.Panel):
    bl_label = "FiveM Island Generator"
    bl_idname = "TW_PT_island_generator"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Island Gen"

    def draw(self, context):
        layout = self.layout
        settings = context.scene.tw_island_settings

        box = layout.box()
        box.label(text="Island")
        box.prop(settings, "island_name")
        box.prop(settings, "seed")
        box.prop(settings, "size_x")
        box.prop(settings, "size_y")
        box.prop(settings, "resolution")
        box.prop(settings, "tiles")

        box = layout.box()
        box.label(text="Terrain & Coast")
        box.prop(settings, "relief")
        box.prop(settings, "sea_level")
        box.prop(settings, "coast_start")
        box.prop(settings, "coast_irregularity")
        box.prop(settings, "southern_bay")
        box.prop(settings, "sand_height")

        box = layout.box()
        box.label(text="Mountains")
        box.prop(settings, "mountain_strength")
        box.prop(settings, "mountain_width")
        box.prop(settings, "valley_strength")
        box.prop(settings, "rock_slope")

        box = layout.box()
        box.label(text="Preview & Guides")
        box.prop(settings, "generate_ocean_preview")
        box.prop(settings, "generate_guides")
        box.prop(settings, "generate_scatter")
        if settings.generate_scatter:
            box.prop(settings, "scatter_count")

        layout.operator("tw_island.generate", icon="MESH_GRID", text="Generate / Regenerate Island")

        box = layout.box()
        box.label(text="FiveM Export")
        box.prop(settings, "export_origin_x")
        box.prop(settings, "export_origin_y")
        box.prop(settings, "export_origin_z")
        box.prop(settings, "include_preview")
        box.prop(settings, "export_path")
        box.operator("tw_island.export_fivem", icon="EXPORT", text="Export FiveM Package")


CLASSES = (
    TWIslandSettings,
    TW_OT_Generate,
    TW_OT_Export,
    TW_PT_Panel,
)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.tw_island_settings = PointerProperty(type=TWIslandSettings)


def unregister():
    if hasattr(bpy.types.Scene, "tw_island_settings"):
        del bpy.types.Scene.tw_island_settings
    for cls in reversed(CLASSES):
        try:
            bpy.utils.unregister_class(cls)
        except RuntimeError:
            pass
