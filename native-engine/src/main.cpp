#include <ragekit/ragekit.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <limits>
#include <map>
#include <numeric>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace fs = std::filesystem;
using namespace rk;

namespace {

const JsonValue* member(const JsonValue& value, const char* key) {
    return value.get(key);
}

double number(const JsonValue& value, double fallback = 0.0) {
    if (value.type == JsonValue::Type::Number) return value.number();
    if (value.type == JsonValue::Type::Bool) return value.boolean ? 1.0 : 0.0;
    return fallback;
}

double number(const JsonValue& object, const char* key, double fallback = 0.0) {
    const auto* value = member(object, key);
    return value ? number(*value, fallback) : fallback;
}

std::string string(const JsonValue& value, const std::string& fallback = {}) {
    return value.type == JsonValue::Type::String ? value.text : fallback;
}

std::string string(const JsonValue& object, const char* key, const std::string& fallback = {}) {
    const auto* value = member(object, key);
    return value ? string(*value, fallback) : fallback;
}

std::vector<std::string> strings(const JsonValue& object, const char* key) {
    std::vector<std::string> result;
    const auto* value = member(object, key);
    if (!value || value->type != JsonValue::Type::Array) return result;
    for (const auto& item : value->items) {
        const auto name = string(item);
        if (!name.empty()) result.push_back(name);
    }
    return result;
}

void progress(const std::string& stage, int done, int total) {
    std::cout << "ISLAND_PROGRESS:{\"stage\":\"" << stage
              << "\",\"done\":" << done << ",\"total\":" << total << "}" << std::endl;
}

std::vector<uint8_t> readBytes(const fs::path& path) {
    std::ifstream input(path, std::ios::binary);
    if (!input) throw std::runtime_error("Impossible de lire " + path.string());
    input.seekg(0, std::ios::end);
    const auto length = input.tellg();
    if (length < 0) throw std::runtime_error("Taille de fichier invalide : " + path.string());
    input.seekg(0, std::ios::beg);
    std::vector<uint8_t> bytes(static_cast<size_t>(length));
    if (!bytes.empty()) input.read(reinterpret_cast<char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
    if (!input && !bytes.empty()) throw std::runtime_error("Lecture incomplète : " + path.string());
    return bytes;
}

std::vector<float> readFloats(const fs::path& path, size_t expected) {
    const auto bytes = readBytes(path);
    if (bytes.size() != expected * sizeof(float)) {
        throw std::runtime_error("Le buffer terrain ne correspond pas aux compteurs déclarés.");
    }
    std::vector<float> values(expected);
    if (!bytes.empty()) std::memcpy(values.data(), bytes.data(), bytes.size());
    return values;
}

uint8_t channel(float value) {
    return static_cast<uint8_t>(std::clamp(std::lround(value), 0L, 255L));
}

struct Palette {
    std::array<std::array<float, 3>, 4> rgb{{
        {{217.0f, 201.0f, 163.0f}},
        {{93.0f, 113.0f, 52.0f}},
        {{125.0f, 116.0f, 102.0f}},
        {{110.0f, 95.0f, 69.0f}},
    }};
};

std::array<float, 3> blendColour(const float* weights, float noise = 1.0f) {
    static const Palette palette{};
    std::array<float, 3> colour{0, 0, 0};
    float total = 0;
    for (int layer = 0; layer < 4; ++layer) total += std::max(0.0f, weights[layer]);
    if (total < 0.0001f) total = 1.0f;
    for (int layer = 0; layer < 4; ++layer) {
        const float weight = std::max(0.0f, weights[layer]) / total;
        for (int channelIndex = 0; channelIndex < 3; ++channelIndex) {
            colour[channelIndex] += palette.rgb[layer][channelIndex] * weight;
        }
    }
    for (auto& component : colour) component *= noise;
    return colour;
}

struct Terrain {
    uint32_t n = 0;
    float cell = 1;
    float worldSize = 1;
    float half = 0.5f;
    float originX = 0;
    float originY = 0;
    std::vector<float> heights;
    std::vector<float> weights;
    std::vector<float> vegetation;
    std::vector<float> land;
    std::vector<float> props;
    std::vector<float> grass;

    size_t sample(uint32_t x, uint32_t y) const {
        return static_cast<size_t>(y) * n + x;
    }

    float height(uint32_t x, uint32_t y) const {
        return heights[sample(std::min(x, n - 1), std::min(y, n - 1))];
    }

    float landAt(uint32_t x, uint32_t y) const {
        return land[sample(std::min(x, n - 1), std::min(y, n - 1))];
    }

    const float* blendAt(uint32_t x, uint32_t y) const {
        return weights.data() + sample(std::min(x, n - 1), std::min(y, n - 1)) * 4;
    }
};

Terrain loadTerrain(const JsonValue& job, const fs::path& jobDirectory) {
    Terrain terrain;
    const auto* terrainJson = member(job, "terrain");
    const auto* counts = member(job, "counts");
    const auto* params = member(job, "params");
    if (!terrainJson || !counts || !params) throw std::runtime_error("Métadonnées terrain incomplètes.");

    terrain.n = static_cast<uint32_t>(number(*counts, "heights", 0) > 0
        ? std::sqrt(number(*counts, "heights", 0))
        : number(*terrainJson, "resolution", 0));
    if (terrain.n < 33 || terrain.n > 2049) throw std::runtime_error("Résolution terrain invalide.");

    terrain.worldSize = static_cast<float>(number(*terrainJson, "worldSize", number(*params, "worldSize", 1024)));
    terrain.cell = static_cast<float>(number(*terrainJson, "cellSize", number(*terrainJson, "cell", terrain.worldSize / (terrain.n - 1))));
    terrain.half = terrain.worldSize * 0.5f;

    const auto* origin = member(*terrainJson, "origin");
    terrain.originX = origin ? static_cast<float>(number(*origin, "x", 0)) : static_cast<float>(number(*params, "originX", 0));
    terrain.originY = origin ? static_cast<float>(number(*origin, "y", 0)) : static_cast<float>(number(*params, "originY", 0));

    const size_t samples = static_cast<size_t>(terrain.n) * terrain.n;
    const size_t heightsCount = static_cast<size_t>(number(*counts, "heights", 0));
    const size_t weightsCount = static_cast<size_t>(number(*counts, "blendWeights", 0));
    const size_t vegetationCount = static_cast<size_t>(number(*counts, "vegetationMask", 0));
    const size_t landCount = static_cast<size_t>(number(*counts, "land", 0));
    const size_t propsCount = static_cast<size_t>(number(*counts, "props", 0));
    const size_t grassCount = static_cast<size_t>(number(*counts, "grass", 0));

    if (heightsCount != samples || weightsCount != samples * 4 ||
        vegetationCount != samples || landCount != samples ||
        propsCount % 6 != 0 || grassCount % 4 != 0) {
        throw std::runtime_error("Compteurs du buffer terrain incohérents.");
    }

    const fs::path binaryPath = jobDirectory / string(job, "binaryFile", "terrain.f32");
    const size_t total = heightsCount + weightsCount + vegetationCount + landCount + propsCount + grassCount;
    const auto all = readFloats(binaryPath, total);
    size_t offset = 0;
    terrain.heights.assign(all.begin() + static_cast<std::ptrdiff_t>(offset), all.begin() + static_cast<std::ptrdiff_t>(offset += heightsCount));
    terrain.weights.assign(all.begin() + static_cast<std::ptrdiff_t>(offset), all.begin() + static_cast<std::ptrdiff_t>(offset += weightsCount));
    terrain.vegetation.assign(all.begin() + static_cast<std::ptrdiff_t>(offset), all.begin() + static_cast<std::ptrdiff_t>(offset += vegetationCount));
    terrain.land.assign(all.begin() + static_cast<std::ptrdiff_t>(offset), all.begin() + static_cast<std::ptrdiff_t>(offset += landCount));
    terrain.props.assign(all.begin() + static_cast<std::ptrdiff_t>(offset), all.begin() + static_cast<std::ptrdiff_t>(offset += propsCount));
    terrain.grass.assign(all.begin() + static_cast<std::ptrdiff_t>(offset), all.begin() + static_cast<std::ptrdiff_t>(offset + grassCount));
    return terrain;
}

struct Tile {
    uint32_t x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    float centreX = 0, centreY = 0;
    float minZ = std::numeric_limits<float>::max();
    float maxZ = std::numeric_limits<float>::lowest();
    std::vector<Vec3> collisionVertices;
    std::vector<uint32_t> collisionTriangles;
};

std::vector<uint32_t> axisSamples(uint32_t first, uint32_t last, uint32_t step) {
    std::vector<uint32_t> indices;
    for (uint32_t value = first; value <= last; value += step) indices.push_back(value);
    if (indices.empty() || indices.back() != last) indices.push_back(last);
    return indices;
}

Geometry buildGeometry(const Terrain& terrain, Tile& tile, uint32_t lodStep) {
    const auto xs = axisSamples(tile.x0, tile.x1, lodStep);
    const auto ys = axisSamples(tile.y0, tile.y1, lodStep);
    const uint32_t width = static_cast<uint32_t>(xs.size());
    const uint32_t height = static_cast<uint32_t>(ys.size());

    Geometry geometry;
    geometry.layout = VertexLayout::standard({
        VertexSemantic::Position, VertexSemantic::Normal,
        VertexSemantic::Colour0, VertexSemantic::TexCoord0
    });
    geometry.resize_vertices(width * height);

    std::vector<Vec3> localVertices(width * height);
    for (uint32_t gy = 0; gy < height; ++gy) {
        for (uint32_t gx = 0; gx < width; ++gx) {
            const uint32_t sourceX = xs[gx];
            const uint32_t sourceY = ys[gy];
            const size_t source = terrain.sample(sourceX, sourceY);
            const float z = terrain.heights[source];
            const float left = terrain.height(sourceX > 0 ? sourceX - 1 : sourceX, sourceY);
            const float right = terrain.height(std::min(sourceX + 1, terrain.n - 1), sourceY);
            const float down = terrain.height(sourceX, sourceY > 0 ? sourceY - 1 : sourceY);
            const float up = terrain.height(sourceX, std::min(sourceY + 1, terrain.n - 1));
            const float nx = (left - right) / std::max(terrain.cell * (sourceX == 0 || sourceX == terrain.n - 1 ? 1.0f : 2.0f), 0.001f);
            const float ny = (down - up) / std::max(terrain.cell * (sourceY == 0 || sourceY == terrain.n - 1 ? 1.0f : 2.0f), 0.001f);
            const float normalLength = std::sqrt(nx * nx + ny * ny + 1.0f);

            const float localX = static_cast<float>(sourceX) * terrain.cell - terrain.half - tile.centreX;
            const float localY = static_cast<float>(sourceY) * terrain.cell - terrain.half - tile.centreY;
            const Vec3 position{localX, localY, z};
            localVertices[static_cast<size_t>(gy) * width + gx] = position;

            geometry.set(gy * width + gx, VertexSemantic::Position, {position.x, position.y, position.z, 1});
            geometry.set(gy * width + gx, VertexSemantic::Normal, {nx / normalLength, ny / normalLength, 1.0f / normalLength, 0});
            geometry.set(gy * width + gx, VertexSemantic::Colour0, {1, 1, 1, 1});
            geometry.set(gy * width + gx, VertexSemantic::TexCoord0, {
                static_cast<float>(sourceX) * terrain.cell / 24.0f,
                static_cast<float>(sourceY) * terrain.cell / 24.0f, 0, 0
            });
            tile.minZ = std::min(tile.minZ, z);
            tile.maxZ = std::max(tile.maxZ, z);
        }
    }

    for (uint32_t y = 0; y + 1 < height; ++y) {
        for (uint32_t x = 0; x + 1 < width; ++x) {
            const uint32_t sx = xs[x], sy = ys[y];
            const uint32_t sx1 = xs[x + 1], sy1 = ys[y + 1];
            const float landAverage = (
                terrain.landAt(sx, sy) + terrain.landAt(sx1, sy) +
                terrain.landAt(sx, sy1) + terrain.landAt(sx1, sy1)
            ) * 0.25f;
            if (landAverage < 0.025f) continue;

            const uint16_t a = static_cast<uint16_t>(y * width + x);
            const uint16_t b = static_cast<uint16_t>(y * width + x + 1);
            const uint16_t c = static_cast<uint16_t>((y + 1) * width + x);
            const uint16_t d = static_cast<uint16_t>((y + 1) * width + x + 1);
            geometry.indices.insert(geometry.indices.end(), {a, b, c, b, d, c});

            if (lodStep == 1) {
                tile.collisionTriangles.insert(tile.collisionTriangles.end(), {
                    static_cast<uint32_t>(a), static_cast<uint32_t>(b), static_cast<uint32_t>(c),
                    static_cast<uint32_t>(b), static_cast<uint32_t>(d), static_cast<uint32_t>(c)
                });
            }
        }
    }

    if (lodStep == 1) tile.collisionVertices = std::move(localVertices);
    geometry.compute_bounds();
    return geometry;
}

Texture makeTileTexture(const Terrain& terrain, const Tile& tile, const std::string& name) {
    Image image;
    image.width = 128;
    image.height = 128;
    image.rgba.resize(static_cast<size_t>(image.width) * image.height * 4);
    for (uint32_t y = 0; y < image.height; ++y) {
        for (uint32_t x = 0; x < image.width; ++x) {
            const uint32_t sx = tile.x0 + static_cast<uint32_t>(std::lround(static_cast<float>(x) / (image.width - 1) * (tile.x1 - tile.x0)));
            const uint32_t sy = tile.y0 + static_cast<uint32_t>(std::lround(static_cast<float>(y) / (image.height - 1) * (tile.y1 - tile.y0)));
            const float* weights = terrain.blendAt(sx, sy);
            const float noise = 0.92f + static_cast<float>((x * 17 + y * 31 + sx * 7 + sy * 13) % 17) / 160.0f;
            const auto colour = blendColour(weights, noise);
            auto* pixel = image.px(x, y);
            pixel[0] = channel(colour[0]);
            pixel[1] = channel(colour[1]);
            pixel[2] = channel(colour[2]);
            pixel[3] = 255;
        }
    }
    return encode_texture(image, TextureFormat::DXT1, name, 0);
}

Drawable makeDrawable(const std::string& name, const Texture& texture, const Terrain& terrain, Tile& tile) {
    Drawable drawable;
    drawable.name = name;

    ShaderGroup shaderGroup;
    TextureDictionary embeddedTextures;
    embeddedTextures.add(texture);
    shaderGroup.textures = std::move(embeddedTextures);

    Shader shader;
    shader.name_hash = joaat_lower("normal_spec");
    shader.sps_hash = joaat_lower("normal_spec.sps");
    shader.render_bucket = 1;
    shader.params = {
        ShaderParam::tex("DiffuseSampler", texture.name),
        ShaderParam::tex("BumpSampler", ""),
        ShaderParam::tex("SpecSampler", ""),
        ShaderParam::vec("specularFactor", {0.08f, 0, 0, 0}),
        ShaderParam::vec("specularColorFactor", {0.16f, 0.16f, 0.16f, 1})
    };
    shaderGroup.shaders.push_back(shader);
    drawable.shader_group = std::move(shaderGroup);

    const std::array<uint32_t, 4> steps{1, 2, 4, 8};
    drawable.lod_distance = {400.0f, 900.0f, 1700.0f, 2800.0f};
    for (uint32_t lod = 0; lod < steps.size(); ++lod) {
        Model model;
        model.render_mask = 0xFF;
        model.flags = 0;
        Geometry geometry = buildGeometry(terrain, tile, steps[lod]);
        geometry.shader_index = 0;
        if (!geometry.indices.empty()) {
            model.geometries.push_back(std::move(geometry));
            model.compute_bounds();
            drawable.lods[lod].push_back(std::move(model));
        }
    }
    drawable.compute_bounds();
    return drawable;
}

void writeCollision(const fs::path& path, const Tile& tile) {
    if (tile.collisionTriangles.empty() || tile.collisionVertices.empty()) return;
    BoundMaterial material;
    material.set_type(1);
    BoundPtr mesh = Bound::make_mesh(tile.collisionVertices, tile.collisionTriangles, material);
    BoundChild child;
    child.bound = mesh;
    child.flags1 = 0x3E;
    child.flags2 = 0x7F3BEC0;
    BoundPtr composite = Bound::make_composite({child});
    rsc::write_file(path.string(), write_ybn(*composite));
    const auto check = read_ybn(rsc::read_file(path.string()));
    if (!check || check->type != BoundType::Composite) {
        throw std::runtime_error("Validation YBN impossible : " + path.filename().string());
    }
}

void includeBounds(MapData& map, const Vec3& position, float radius) {
    const Vec3 minimum{position.x - radius, position.y - radius, position.z - radius};
    const Vec3 maximum{position.x + radius, position.y + radius, position.z + radius};
    map.entities_extents_min = vmin(map.entities_extents_min, minimum);
    map.entities_extents_max = vmax(map.entities_extents_max, maximum);
}

void writeGrass(MapData& map, const Terrain& terrain, const std::vector<std::string>& grassTypes) {
    if (terrain.grass.empty() || grassTypes.empty()) return;
    const float zMin = terrain.minZ; // overwritten below; kept for clarity in the batch box
    (void)zMin;
    GrassBatch batch;
    batch.box_min = {-terrain.half, -terrain.half, -100.0f};
    batch.box_max = {terrain.half, terrain.half, 900.0f};
    batch.scale_range = {0.5f, 2.0f, 1.0f};
    batch.archetype = joaat_lower(grassTypes.front());
    batch.lod_dist = 250;
    batch.lod_fade_start_dist = 180;
    batch.lod_inst_fade_range = 70;
    batch.orient_to_terrain = 1.0f;
    batch.instances.reserve(terrain.grass.size() / 4);

    for (size_t i = 0; i + 3 < terrain.grass.size(); i += 4) {
        const float x = terrain.grass[i];
        const float y = terrain.grass[i + 1];
        const float z = terrain.grass[i + 2];
        const float scale = terrain.grass[i + 3];
        GrassInstance instance;
        instance.position[0] = static_cast<uint16_t>(std::clamp((x + terrain.half) / terrain.worldSize, 0.0f, 1.0f) * 65535.0f);
        instance.position[1] = static_cast<uint16_t>(std::clamp((y + terrain.half) / terrain.worldSize, 0.0f, 1.0f) * 65535.0f);
        instance.position[2] = static_cast<uint16_t>(std::clamp((z + 100.0f) / 1000.0f, 0.0f, 1.0f) * 65535.0f);
        instance.color[0] = 104;
        instance.color[1] = 132;
        instance.color[2] = 75;
        instance.scale = channel(std::clamp((scale - 0.5f) / 1.5f, 0.0f, 1.0f) * 255.0f);
        instance.ao = 210;
        batch.instances.push_back(instance);
    }
    set_grass_batches(map, {batch});
}

void addPropEntities(MapData& map, const Terrain& terrain, const JsonValue& params, const JsonValue& job) {
    const auto treeTypes = strings(params, "treeTypes");
    const auto rockTypes = strings(params, "rockTypes");
    for (size_t i = 0; i + 5 < terrain.props.size(); i += 6) {
        const float x = terrain.props[i];
        const float y = terrain.props[i + 1];
        const float z = terrain.props[i + 2];
        const float scale = terrain.props[i + 3];
        const float heading = terrain.props[i + 4];
        const bool rock = terrain.props[i + 5] > 0.5f;
        const auto& choices = rock ? rockTypes : treeTypes;
        if (choices.empty()) continue;
        const auto& model = choices[(i / 6) % choices.size()];

        Entity entity;
        entity.archetype_name = joaat_lower(model);
        entity.position = {terrain.originX + x, terrain.originY + y, z};
        entity.rotation = {0, 0, std::sin(heading * 0.5f), std::cos(heading * 0.5f)};
        entity.scale_xy = std::clamp(scale, 0.2f, 6.0f);
        entity.scale_z = entity.scale_xy;
        entity.lod_dist = 180;
        entity.priority_level = 2;
        entity.lod_level = 0;
        map.entities.push_back(entity);
        includeBounds(map, entity.position, 8.0f * entity.scale_xy);
    }

    const auto* assets = member(job, "placedAssets");
    if (!assets || assets->type != JsonValue::Type::Array) return;
    for (const auto& asset : assets->items) {
        const std::string name = string(asset, "name");
        if (name.empty()) continue;
        Entity entity;
        entity.archetype_name = joaat_lower(name);
        entity.position = {
            static_cast<float>(number(asset, "x", terrain.originX)),
            static_cast<float>(number(asset, "y", terrain.originY)),
            static_cast<float>(number(asset, "z", 0))
        };
        const float heading = static_cast<float>(number(asset, "heading", 0));
        entity.rotation = {0, 0, std::sin(heading * 0.5f), std::cos(heading * 0.5f)};
        entity.scale_xy = std::clamp(static_cast<float>(number(asset, "scale", 1)), 0.05f, 50.0f);
        entity.scale_z = entity.scale_xy;
        entity.lod_dist = 220;
        entity.priority_level = 1;
        map.entities.push_back(entity);
        includeBounds(map, entity.position, 10.0f * entity.scale_xy);
    }
}

void validateRsc(const fs::path& path) {
    const auto bytes = readBytes(path);
    if (bytes.size() < 4 || std::string(bytes.begin(), bytes.begin() + 4) != "RSC7") {
        throw std::runtime_error("Ressource GTA sans en-tête RSC7 : " + path.filename().string());
    }
}

void generate(const fs::path& jobPath, const fs::path& outputDirectory) {
    const JsonValue job = parse_json([&]() {
        const auto bytes = readBytes(jobPath);
        return std::string(bytes.begin(), bytes.end());
    }());
    const auto* paramsPtr = member(job, "params");
    const auto* terrainJson = member(job, "terrain");
    if (!paramsPtr || !terrainJson) throw std::runtime_error("Le job ne contient pas les paramètres du terrain.");

    const JsonValue& params = *paramsPtr;
    const Terrain terrain = loadTerrain(job, jobPath.parent_path());
    const uint32_t generation = static_cast<uint32_t>(number(job, "generation", 9));
    const Game game = generation == 9 ? Game::Enhanced : Game::Legacy;
    set_default_game(game);

    const std::string resource = string(params, "name", "island_forge");
    const std::string resourceStem = resource.empty() ? "island_forge" : resource;
    fs::create_directories(outputDirectory);
    progress("Préparation du moteur RAGE", 1, 7);

    MapTypes mapTypes;
    mapTypes.name = joaat_lower(resourceStem + "_types");
    MapData map;
    map.name = joaat_lower(resourceStem + "_map");
    map.content_flags = 1 | 8 | 64;
    map.entities_extents_min = {terrain.originX - terrain.half, terrain.originY - terrain.half, -200};
    map.entities_extents_max = {terrain.originX + terrain.half, terrain.originY + terrain.half, 1000};
    map.streaming_extents_min = {terrain.originX - terrain.half - 700, terrain.originY - terrain.half - 700, -900};
    map.streaming_extents_max = {terrain.originX + terrain.half + 700, terrain.originY + terrain.half + 700, 1700};
    map.block.name = resourceStem + "_map";
    map.block.exported_by = "Island Forge Native Engine";
    map.block.owner = "Island Forge";
    map.block.version = 2;

    TextureDictionary textureDictionary;
    const uint32_t tileCells = 96;
    const uint32_t tilesX = (terrain.n - 1 + tileCells - 1) / tileCells;
    const uint32_t tilesY = (terrain.n - 1 + tileCells - 1) / tileCells;
    const uint32_t totalTiles = tilesX * tilesY;
    uint32_t completedTiles = 0;

    for (uint32_t tileY = 0; tileY < tilesY; ++tileY) {
        for (uint32_t tileX = 0; tileX < tilesX; ++tileX) {
            Tile tile;
            tile.x0 = tileX * tileCells;
            tile.y0 = tileY * tileCells;
            tile.x1 = std::min(tile.x0 + tileCells, terrain.n - 1);
            tile.y1 = std::min(tile.y0 + tileCells, terrain.n - 1);
            tile.centreX = (static_cast<float>(tile.x0 + tile.x1) * 0.5f) * terrain.cell - terrain.half;
            tile.centreY = (static_cast<float>(tile.y0 + tile.y1) * 0.5f) * terrain.cell - terrain.half;

            std::ostringstream suffix;
            suffix << "_t" << tileX << "_" << tileY;
            const std::string tileName = resourceStem + suffix.str();
            const std::string collisionName = tileName + "_col";
            const std::string textureName = tileName + "_d";

            Texture texture = makeTileTexture(terrain, tile, textureName);
            textureDictionary.add(texture);
            Drawable drawable = makeDrawable(tileName, texture, terrain, tile);
            if (drawable.all_models().empty()) {
                ++completedTiles;
                continue;
            }

            const fs::path drawablePath = outputDirectory / (tileName + ".ydr");
            rsc::write_file(drawablePath.string(), write_ydr(drawable, game));
            const Drawable checkedDrawable = read_ydr(rsc::read_file(drawablePath.string()));
            if (checkedDrawable.name != tileName) throw std::runtime_error("Lecture de contrôle YDR invalide.");

            const fs::path collisionPath = outputDirectory / (collisionName + ".ybn");
            writeCollision(collisionPath, tile);

            Archetype archetype;
            archetype.kind = Archetype::Kind::Base;
            archetype.name = joaat_lower(tileName);
            archetype.asset_name = joaat_lower(tileName);
            archetype.asset_type = 2;
            archetype.texture_dictionary = joaat_lower(resourceStem);
            archetype.physics_dictionary = joaat_lower(collisionName);
            archetype.lod_dist = 4500;
            archetype.hd_texture_dist = 200;
            archetype.bb_min = {-static_cast<float>(tile.x1 - tile.x0) * terrain.cell * 0.5f,
                                -static_cast<float>(tile.y1 - tile.y0) * terrain.cell * 0.5f, tile.minZ};
            archetype.bb_max = {static_cast<float>(tile.x1 - tile.x0) * terrain.cell * 0.5f,
                                static_cast<float>(tile.y1 - tile.y0) * terrain.cell * 0.5f, tile.maxZ};
            archetype.bs_centre = {0, 0, (tile.minZ + tile.maxZ) * 0.5f};
            archetype.bs_radius = std::sqrt(
                std::pow(archetype.bb_max.x, 2) +
                std::pow(archetype.bb_max.y, 2) +
                std::pow((tile.maxZ - tile.minZ) * 0.5f, 2));
            mapTypes.archetypes.push_back(archetype);

            Entity entity;
            entity.archetype_name = archetype.name;
            entity.position = {terrain.originX + tile.centreX, terrain.originY + tile.centreY, 0};
            entity.rotation = {0, 0, 0, 1};
            entity.lod_dist = 5000;
            entity.child_lod_dist = 500;
            entity.lod_level = 0;
            entity.priority_level = 0;
            map.entities.push_back(entity);
            map.physics_dictionaries.push_back(archetype.physics_dictionary);
            includeBounds(map, entity.position, std::max(archetype.bs_radius, 8.0f));

            ++completedTiles;
            progress("Écriture YDR / YBN / LOD", 1 + static_cast<int>(5.0 * completedTiles / std::max(1u, totalTiles)), 7);
        }
    }

    if (mapTypes.archetypes.empty()) throw std::runtime_error("Aucune tuile de terrain n'a été créée. Vérifie la densité et le masque de terre.");

    progress("Ajout des objets GTA et de l'herbe", 6, 7);
    addPropEntities(map, terrain, params, job);
    writeGrass(map, terrain, strings(params, "grassTypes"));

    progress("Écriture YTD / YTYP / YMAP", 6, 7);
    const fs::path ytdPath = outputDirectory / (resourceStem + ".ytd");
    rsc::write_file(ytdPath.string(), write_ytd(textureDictionary, game));
    (void)read_ytd(rsc::read_file(ytdPath.string()));

    const fs::path ytypPath = outputDirectory / (resourceStem + ".ytyp");
    rsc::write_file(ytypPath.string(), write_ytyp(mapTypes));
    (void)read_ytyp(rsc::read_file(ytypPath.string()));

    const fs::path ymapPath = outputDirectory / (resourceStem + ".ymap");
    rsc::write_file(ymapPath.string(), write_ymap(map));
    validateRsc(ymapPath);
    const MapData checkedMap = read_ymap(rsc::read_file(ymapPath.string()));
    if (checkedMap.entities.empty()) throw std::runtime_error("Le YMAP natif est vide après relecture.");

    const fs::path reportPath = outputDirectory / "native-engine-report.json";
    std::ofstream report(reportPath, std::ios::binary);
    report << "{\n"
           << "  \"engine\": \"ragekit\",\n"
           << "  \"engineVersion\": \"0.3.1\",\n"
           << "  \"generation\": " << generation << ",\n"
           << "  \"nativeReady\": true,\n"
           << "  \"terrainTiles\": " << mapTypes.archetypes.size() << ",\n"
           << "  \"placedEntities\": " << map.entities.size() << ",\n"
           << "  \"grassInstances\": " << terrain.grass.size() / 4 << ",\n"
           << "  \"formats\": [\"YDR\", \"YBN\", \"YTD\", \"YTYP\", \"YMAP\"],\n"
           << "  \"ymapValidated\": true,\n"
           << "  \"blenderRequired\": false\n"
           << "}\n";
    report.close();

    progress("Validation des ressources natives", 7, 7);
    std::cout << "NATIVE_READY:1" << std::endl;
}

} // namespace

int main(int argc, char** argv) {
    try {
        fs::path jobPath;
        fs::path outputDirectory;
        for (int i = 1; i < argc; ++i) {
            const std::string argument = argv[i];
            if (argument == "--job" && i + 1 < argc) jobPath = argv[++i];
            else if (argument == "--output" && i + 1 < argc) outputDirectory = argv[++i];
            else if (argument == "--version") {
                std::cout << "Island Forge Native Engine 0.1.0 (ragekit 0.3.1)" << std::endl;
                return 0;
            } else {
                throw std::runtime_error("Argument inconnu : " + argument);
            }
        }
        if (jobPath.empty() || outputDirectory.empty()) {
            throw std::runtime_error("Usage: island-forge-native-engine --job job.json --output artifacts/");
        }
        generate(jobPath, outputDirectory);
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "ISLAND_ERROR:" << error.what() << std::endl;
        return 1;
    }
}
