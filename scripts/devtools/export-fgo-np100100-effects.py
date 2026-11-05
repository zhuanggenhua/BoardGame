from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import struct
import zlib
from pathlib import Path
from typing import Any

import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler


WORK_ROOT = Path(r"E:\zhanggenhua\temp\fgo\work")
PROJECT_ROOT = Path(r"E:\zhanggenhua\temp\BoardGame")
EFFECT_BUNDLE = WORK_ROOT / "DecryptedAssetBundles" / "NoblePhantasm@100101.unity3d"
SEQUENCE_BUNDLE = WORK_ROOT / "DecryptedAssetBundles" / "NoblePhantasm@Sequence@100101.unity3d"
BATTLE_COMMON_BUNDLE = WORK_ROOT / "DecryptedNamed" / "Battle@Common.unity3d"
EXPORTED_TEXTURE_DIR = (
    WORK_ROOT
    / "ExportedGameAssets"
    / "06_NoblePhantasmEffect"
    / "NoblePhantasm@100101"
    / "Texture2D_png"
)
PUBLIC_ROOT = PROJECT_ROOT / "public" / "assets" / "dev" / "fgo-cutscene" / "np100100"
OUT_DIR = PUBLIC_ROOT / "np_effect"
OUT_JSON = PUBLIC_ROOT / "np100100_effects.json"


def path_id(value: Any) -> int:
    return int(getattr(value, "path_id", 0) or 0)


def safe_name(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z_.@+-]+", "_", value).strip("_") or "unnamed"


def finite_float(value: Any, fallback: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return fallback
    return result if math.isfinite(result) else fallback


def sanitize_json(value: Any) -> Any:
    if isinstance(value, float):
        return value if math.isfinite(value) else 0.0
    if isinstance(value, list):
        return [sanitize_json(item) for item in value]
    if isinstance(value, dict):
        return {key: sanitize_json(item) for key, item in value.items()}
    return value


def vec2(value: Any) -> list[float]:
    return [finite_float(getattr(value, "x", 0.0)), finite_float(getattr(value, "y", 0.0))]


def vec3(value: Any) -> list[float]:
    return [
        finite_float(getattr(value, "x", 0.0)),
        finite_float(getattr(value, "y", 0.0)),
        finite_float(getattr(value, "z", 0.0)),
    ]


def quat(value: Any) -> list[float]:
    return [
        finite_float(getattr(value, "x", 0.0)),
        finite_float(getattr(value, "y", 0.0)),
        finite_float(getattr(value, "z", 0.0)),
        finite_float(getattr(value, "w", 1.0), 1.0),
    ]


def u32_to_float(value: int) -> float:
    return struct.unpack("<f", int(value).to_bytes(4, "little", signed=False))[0]


def binding_hash(path: str) -> int:
    return zlib.crc32(path.encode("utf-8")) & 0xFFFFFFFF


def color(value: Any) -> dict[str, float]:
    if isinstance(value, dict):
        return {
            "r": finite_float(value.get("r", 1.0), 1.0),
            "g": finite_float(value.get("g", 1.0), 1.0),
            "b": finite_float(value.get("b", 1.0), 1.0),
            "a": finite_float(value.get("a", 1.0), 1.0),
        }
    return {
        "r": finite_float(getattr(value, "r", 1.0), 1.0),
        "g": finite_float(getattr(value, "g", 1.0), 1.0),
        "b": finite_float(getattr(value, "b", 1.0), 1.0),
        "a": finite_float(getattr(value, "a", 1.0), 1.0),
    }


def timeline_fade_curve(value: Any) -> list[dict[str, float]]:
    curve = value if isinstance(value, dict) else {}
    raw_keys = curve.get("m_Curve", []) if curve else []
    return [
        {
            "time": finite_float(item.get("time", 0.0)),
            "value": finite_float(item.get("value", 0.0)),
            "inSlope": finite_float(item.get("inSlope", 0.0)),
            "outSlope": finite_float(item.get("outSlope", 0.0)),
        }
        for item in raw_keys
        if isinstance(item, dict)
    ]


def animation_curve_keys(value: Any) -> list[dict[str, float]]:
    curve = value if isinstance(value, dict) else {}
    raw_keys = curve.get("m_Curve", []) if curve else []
    return [
        {
            "time": finite_float(item.get("time", 0.0)),
            "value": finite_float(item.get("value", 0.0)),
            "inSlope": finite_float(item.get("inSlope", 0.0)),
            "outSlope": finite_float(item.get("outSlope", 0.0)),
        }
        for item in raw_keys
        if isinstance(item, dict)
    ]


def extract_property_timeline(maps: dict[str, Any], target: str) -> dict[str, dict[str, Any]]:
    owner_path = f"Timelines for {target}/Property Timeline"
    for obj_id, obj in maps["objects"].items():
        if obj.type.name != "MonoBehaviour":
            continue
        tree = obj.read_typetree()
        script_id = int(tree.get("m_Script", {}).get("m_PathID", 0) or 0)
        go_id = int(tree.get("m_GameObject", {}).get("m_PathID", 0) or 0)
        transform_id = maps["transformByGo"].get(go_id, 0)
        if mono_script_name(maps, script_id) != "USTimelineProperty":
            continue
        if owner_path not in transform_path(maps, transform_id):
            continue

        properties: dict[str, dict[str, Any]] = {}
        for reference in tree.get("propertyList", []) or []:
            property_id = int(reference.get("m_PathID", 0) or 0)
            property_obj = maps["objects"].get(property_id)
            if property_obj is None:
                continue
            property_tree = property_obj.read_typetree()
            if property_tree.get("componentType") != "Transform":
                continue
            property_name = str(property_tree.get("propertyName", ""))
            base = property_tree.get("baseVector3", {})
            properties[property_name] = {
                "base": [
                    finite_float(base.get("x", 0.0)),
                    finite_float(base.get("y", 0.0)),
                    finite_float(base.get("z", 0.0)),
                ],
                "curves": [
                    animation_curve_keys(
                        maps["objects"][int(curve.get("m_PathID", 0) or 0)].read_typetree().get("animationCurve")
                    )
                    for curve in property_tree.get("curves", []) or []
                    if int(curve.get("m_PathID", 0) or 0) in maps["objects"]
                ],
            }
        return properties
    return {}


def extract_actor_transform(maps: dict[str, Any]) -> dict[str, Any] | None:
    properties = extract_property_timeline(maps, "Actor")
    position = properties.get("position")
    rotation = properties.get("localEulerAngles")
    if not position or not rotation or len(position["curves"]) != 3 or len(rotation["curves"]) != 3:
        return None
    return {
        "position": position["curves"],
        "positionBase": position["base"],
        "localEulerAngles": rotation["curves"],
        "localEulerAnglesBase": rotation["base"],
        "source": "NoblePhantasm@Sequence@100101/Timelines for Actor/Property Timeline",
    }


def extract_battle_camera(sequence_bundle: Path, maps: dict[str, Any] | None = None) -> dict[str, Any] | None:
    maps = maps or load_maps(sequence_bundle)
    properties = extract_property_timeline(maps, "BattleCamera")
    position = properties.get("position")
    rotation = properties.get("eulerAngles")
    if not position or not rotation or len(position["curves"]) != 3 or len(rotation["curves"]) != 3:
        return None
    duration = max(
        (key["time"] for curve in position["curves"] + rotation["curves"] for key in curve),
        default=0.0,
    )
    return {
        "duration": duration,
        "position": position["curves"],
        "eulerAnglesOffset": rotation["curves"],
        "positionBase": position["base"],
        "eulerAnglesBase": rotation["base"],
        "parentEulerAngles": [0.0, 180.0, 0.0],
        "source": "NoblePhantasm@Sequence@100101/Timelines for BattleCamera",
    }


def extract_battle_camera_projection(bundle_path: Path) -> dict[str, Any]:
    projection = {
        "fieldOfView": 40.0,
        "orthographic": False,
        "nearClip": 0.3,
        "farClip": 2000.0,
        "aspect": 16.0 / 9.0,
        "activeCamera": "MiddleCamera",
    }
    if not bundle_path.exists():
        return projection

    try:
        env = UnityPy.load(str(bundle_path))
        game_object_names: dict[int, str] = {}
        for obj in env.objects:
            if obj.type.name != "GameObject":
                continue
            try:
                tree = obj.read_typetree()
            except Exception:
                continue
            game_object_names[int(obj.path_id)] = str(tree.get("m_Name", ""))

        for obj in env.objects:
            if obj.type.name != "Camera":
                continue
            try:
                tree = obj.read_typetree()
            except Exception:
                continue
            game_object_id = int(tree.get("m_GameObject", {}).get("m_PathID", 0) or 0)
            name = game_object_names.get(game_object_id, "")
            if name not in {"FrontCamera", "MiddleCamera", "BackCamera"}:
                continue
            projection["fieldOfView"] = finite_float(tree.get("field of view"), 40.0)
            projection["orthographic"] = bool(tree.get("orthographic", False))
            projection["nearClip"] = finite_float(tree.get("near clip plane"), 0.3)
            projection["farClip"] = finite_float(tree.get("far clip plane"), 2000.0)
            if name == "BackCamera":
                projection["farClip"] = max(projection["farClip"], 2000.0)
            break
    except Exception:
        pass
    return projection


def quat_multiply(a: list[float], b: list[float]) -> list[float]:
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ]


def quat_rotate(q: list[float], v: list[float]) -> list[float]:
    x, y, z = v
    qv = [x, y, z, 0.0]
    qi = [-q[0], -q[1], -q[2], q[3]]
    rotated = quat_multiply(quat_multiply(q, qv), qi)
    return rotated[:3]


def curve_keys(curve: Any) -> list[dict[str, float]]:
    return [
        {
            "time": finite_float(getattr(key, "time", 0.0)),
            "value": finite_float(getattr(key, "value", 0.0)),
            "inSlope": finite_float(getattr(key, "inSlope", 0.0)),
            "outSlope": finite_float(getattr(key, "outSlope", 0.0)),
        }
        for key in getattr(curve, "m_Curve", []) or []
    ]


def minmax_curve(curve: Any) -> dict[str, Any]:
    if curve is None:
        return {"state": 0, "scalar": 0.0, "minScalar": 0.0, "keys": [], "minKeys": []}
    return {
        "state": int(getattr(curve, "minMaxState", 0) or 0),
        "scalar": finite_float(getattr(curve, "scalar", 0.0)),
        "minScalar": finite_float(getattr(curve, "minScalar", getattr(curve, "scalar", 0.0))),
        "keys": curve_keys(getattr(curve, "maxCurve", None)),
        "minKeys": curve_keys(getattr(curve, "minCurve", None)),
    }


def gradient_keys(source: Any) -> dict[str, Any]:
    keys = [{"time": finite_float(getattr(source, f"ctime{i}", 0)) / 65535.0,
             "color": color(getattr(source, f"key{i}", None))}
            for i in range(min(int(getattr(source, "m_NumColorKeys", 0) or 0), 8))]
    alpha_keys = [{"time": finite_float(getattr(source, f"atime{i}", 0)) / 65535.0,
                   "alpha": color(getattr(source, f"key{i}", None))["a"]}
                  for i in range(min(int(getattr(source, "m_NumAlphaKeys", 0) or 0), 8))]
    return {"keys": keys, "alphaKeys": alpha_keys, "mode": int(getattr(source, "m_Mode", 0) or 0)}


def gradient(value: Any) -> dict[str, Any]:
    if value is None:
        return {
            "state": 0,
            "maxColor": color(None),
            "minColor": color(None),
            "keys": [],
            "alphaKeys": [],
        }
    maximum = gradient_keys(getattr(value, "maxGradient", None))
    minimum = gradient_keys(getattr(value, "minGradient", None))
    return {
        "state": int(getattr(value, "minMaxState", 0) or 0),
        "maxColor": color(getattr(value, "maxColor", None)),
        "minColor": color(getattr(value, "minColor", None)),
        **maximum,
        "minKeys": minimum["keys"],
        "minAlphaKeys": minimum["alphaKeys"],
        "minMode": minimum["mode"],
    }


def scalar_of(curve: Any, fallback: float = 0.0) -> float:
    if curve is None:
        return fallback
    state = int(getattr(curve, "minMaxState", 0) or 0)
    if state in (2, 3):
        return (
            finite_float(getattr(curve, "scalar", fallback), fallback)
            + finite_float(getattr(curve, "minScalar", fallback), fallback)
        ) / 2.0
    return finite_float(getattr(curve, "scalar", fallback), fallback)


def main_texture_id(material_tree: dict[str, Any]) -> int:
    for name, env in material_tree.get("m_SavedProperties", {}).get("m_TexEnvs", []):
        if name == "_MainTex":
            return int(env.get("m_Texture", {}).get("m_PathID", 0) or 0)
    return 0


def saved_floats(material_tree: dict[str, Any]) -> dict[str, float]:
    return {
        name: finite_float(value)
        for name, value in material_tree.get("m_SavedProperties", {}).get("m_Floats", [])
    }


def saved_colors(material_tree: dict[str, Any]) -> dict[str, dict[str, float]]:
    return {
        name: color(value)
        for name, value in material_tree.get("m_SavedProperties", {}).get("m_Colors", [])
    }


def main_texture_transform(material_tree: dict[str, Any]) -> dict[str, list[float]]:
    for name, env in material_tree.get("m_SavedProperties", {}).get("m_TexEnvs", []):
        if name != "_MainTex":
            continue
        scale = env.get("m_Scale", {})
        offset = env.get("m_Offset", {})
        return {
            "scale": [
                finite_float(scale.get("x", 1.0), 1.0),
                finite_float(scale.get("y", 1.0), 1.0),
            ],
            "offset": [
                finite_float(offset.get("x", 0.0)),
                finite_float(offset.get("y", 0.0)),
            ],
        }
    return {"scale": [1.0, 1.0], "offset": [0.0, 0.0]}


def material_blend(name: str, floats: dict[str, float] | None = None) -> str:
    floats = floats or {}
    blend_src = int(floats.get("_BlendSrc", -1))
    blend_dst = int(floats.get("_BlendDst", -1))
    if blend_src == 5 and blend_dst == 1:
        return "add"
    if blend_src == 2 and blend_dst == 0:
        return "multiply"
    lower = name.lower()
    if "add" in lower:
        return "add"
    if "mul" in lower:
        return "multiply"
    return "normal"


def load_maps(bundle_path: Path, environment=None) -> dict[str, Any]:
    env = environment if environment is not None else UnityPy.load(str(bundle_path))
    objects = {obj.path_id: obj for obj in env.objects
               if environment is None or obj.assets_file.name == bundle_path.name}
    game_objects: dict[int, Any] = {}
    transforms: dict[int, Any] = {}
    components_by_go: dict[int, list[tuple[int, str]]] = {}

    for obj in objects.values():
        if obj.type.name == "GameObject":
            game_objects[obj.path_id] = obj.read()
        elif obj.type.name == "Transform":
            transforms[obj.path_id] = obj.read()

    for go_id, go in game_objects.items():
        components_by_go[go_id] = []
        for item in getattr(go, "m_Component", []) or []:
            pptr = getattr(item, "component", item)
            component_id = path_id(pptr)
            component_obj = objects.get(component_id)
            if component_obj is not None:
                components_by_go[go_id].append((component_id, component_obj.type.name))

    transform_by_go = {path_id(transform.m_GameObject): transform_id for transform_id, transform in transforms.items()}
    children_by_transform = {
        transform_id: [path_id(child) for child in getattr(transform, "m_Children", []) or []]
        for transform_id, transform in transforms.items()
    }
    parent_by_transform = {
        transform_id: path_id(getattr(transform, "m_Father", None))
        for transform_id, transform in transforms.items()
    }

    return {
        "env": env,
        "objects": objects,
        "gameObjects": game_objects,
        "transforms": transforms,
        "componentsByGo": components_by_go,
        "transformByGo": transform_by_go,
        "childrenByTransform": children_by_transform,
        "parentByTransform": parent_by_transform,
    }


def go_name(maps: dict[str, Any], go_id: int) -> str:
    go = maps["gameObjects"].get(go_id)
    return getattr(go, "m_Name", "") if go is not None else ""


def transform_name(maps: dict[str, Any], transform_id: int) -> str:
    transform = maps["transforms"].get(transform_id)
    return go_name(maps, path_id(transform.m_GameObject)) if transform is not None else ""


def transform_path(maps: dict[str, Any], transform_id: int, stop_parent: int = 0) -> str:
    names = []
    current = transform_id
    while current and current != stop_parent:
        names.append(transform_name(maps, current))
        current = maps["parentByTransform"].get(current, 0)
    return "/".join(reversed(names))


def local_transform(transform: Any) -> dict[str, list[float]]:
    return {
        "position": vec3(transform.m_LocalPosition),
        "rotation": quat(transform.m_LocalRotation),
        "scale": vec3(transform.m_LocalScale),
    }


def compose_transform(parent: dict[str, list[float]], local: dict[str, list[float]]) -> dict[str, list[float]]:
    scaled = [
        local["position"][0] * parent["scale"][0],
        local["position"][1] * parent["scale"][1],
        local["position"][2] * parent["scale"][2],
    ]
    rotated = quat_rotate(parent["rotation"], scaled)
    return {
        "position": [
            parent["position"][0] + rotated[0],
            parent["position"][1] + rotated[1],
            parent["position"][2] + rotated[2],
        ],
        "rotation": quat_multiply(parent["rotation"], local["rotation"]),
        "scale": [
            parent["scale"][0] * local["scale"][0],
            parent["scale"][1] * local["scale"][1],
            parent["scale"][2] * local["scale"][2],
        ],
    }


def build_world_transforms(maps: dict[str, Any]) -> dict[int, dict[str, list[float]]]:
    cache: dict[int, dict[str, list[float]]] = {}

    def resolve(transform_id: int) -> dict[str, list[float]]:
        if transform_id in cache:
            return cache[transform_id]
        transform = maps["transforms"][transform_id]
        local = local_transform(transform)
        parent_id = maps["parentByTransform"].get(transform_id, 0)
        if parent_id:
            result = compose_transform(resolve(parent_id), local)
        else:
            result = local
        cache[transform_id] = result
        return result

    for transform_id in maps["transforms"]:
        resolve(transform_id)
    return cache


def copy_texture_files(textures: dict[int, Any]) -> dict[int, dict[str, Any]]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    exported: dict[int, dict[str, Any]] = {}
    for texture_id, texture in textures.items():
        name = getattr(texture, "m_Name", getattr(texture, "name", str(texture_id)))
        pattern = f"{safe_name(name)}_{texture_id}.png"
        source = EXPORTED_TEXTURE_DIR / pattern
        if not source.exists():
            matches = list(EXPORTED_TEXTURE_DIR.glob(f"{safe_name(name)}_*.png"))
            source = matches[0] if matches else source
        file_name = source.name if source.exists() else f"{safe_name(name)}_{texture_id}.png"
        if source.exists():
            shutil.copy2(source, OUT_DIR / file_name)
        exported[texture_id] = {
            "pathId": texture_id,
            "name": name,
            "file": f"np_effect/{file_name}",
            "width": int(getattr(texture, "m_Width", 0) or 0),
            "height": int(getattr(texture, "m_Height", 0) or 0),
        }
    return exported


def material_render_queue(material: Any) -> int:
    if material.m_CustomRenderQueue >= 0:
        return int(material.m_CustomRenderQueue)
    shader = material.m_Shader.read().m_ParsedForm
    tags = dict(shader.m_SubShaders[0].m_Tags.tags)
    queue = next((value for key, value in tags.items() if key.upper() == "QUEUE"), "Geometry")
    match = re.fullmatch(r"(Background|Geometry|AlphaTest|Transparent|Overlay)([+-]\d+)?", queue)
    if not match:
        raise ValueError(f"Unsupported source shader queue: {queue}")
    return {"Background": 1000, "Geometry": 2000, "AlphaTest": 2450,
            "Transparent": 3000, "Overlay": 4000}[match[1]] + int(match[2] or 0)


def extract_materials(maps: dict[str, Any], texture_meta: dict[int, dict[str, Any]],
                      resolve_render_queue: bool = True) -> dict[int, dict[str, Any]]:
    materials: dict[int, dict[str, Any]] = {}
    for obj_id, obj in maps["objects"].items():
        if obj.type.name != "Material":
            continue
        tree = obj.read_typetree()
        name = tree.get("m_Name", str(obj_id))
        texture_id = main_texture_id(tree)
        floats = saved_floats(tree)
        colors = saved_colors(tree)
        shader = tree.get("m_Shader", {})
        shader_path_id = int(shader.get("m_PathID", 0) or 0) if isinstance(shader, dict) else 0
        materials[obj_id] = {
            "pathId": obj_id,
            "name": name,
            **({"renderQueue": material_render_queue(obj.read())} if resolve_render_queue else {}),
            "shaderPathId": shader_path_id,
            "keywords": [
                str(keyword)
                for keyword in tree.get("m_ValidKeywords", []) or []
                if keyword
            ],
            "texturePathId": texture_id,
            "texture": texture_meta.get(texture_id),
            "blend": material_blend(name, floats),
            "blendSrc": floats.get("_BlendSrc"),
            "blendDst": floats.get("_BlendDst"),
            "mode": floats.get("_Mode"),
            "cullMode": floats.get("_CullMode"),
            "zWrite": floats.get("_ZWrite"),
            "zTestMode": floats.get("_ZTestMode"),
            "useMultiplyVertexColor": bool(floats.get("_Use_multiplyVertexColor", 0.0)),
            "tintColor": colors.get("_TintColor"),
            "color": colors.get("_Color"),
            "mainTextureTransform": main_texture_transform(tree),
            "floats": floats,
            "colors": colors,
        }
    return materials


def parse_obj_mesh(obj_text: str) -> dict[str, Any]:
    source_vertices: list[list[float]] = []
    source_uvs: list[list[float]] = []
    vertices: list[list[float]] = []
    uvs: list[list[float]] = []
    indices: list[int] = []
    vertex_map: dict[tuple[int, int], int] = {}

    def corner_index(token: str) -> int:
        parts = token.split("/")
        vertex_index = int(parts[0]) - 1
        uv_index = int(parts[1]) - 1 if len(parts) > 1 and parts[1] else -1
        key = (vertex_index, uv_index)
        existing = vertex_map.get(key)
        if existing is not None:
            return existing
        index = len(vertices)
        vertex_map[key] = index
        vertices.append(source_vertices[vertex_index])
        if uv_index >= 0 and uv_index < len(source_uvs):
            uvs.append(source_uvs[uv_index])
        else:
            uvs.append([0.0, 0.0])
        return index

    for line in obj_text.splitlines():
        if line.startswith("v "):
            _, x, y, z, *_ = line.split()
            source_vertices.append([float(x), float(y), float(z)])
        elif line.startswith("vt "):
            parts = line.split()
            source_uvs.append([float(parts[1]), float(parts[2]) if len(parts) > 2 else 0.0])
        elif line.startswith("f "):
            face = [corner_index(token) for token in line.split()[1:]]
            for offset in range(1, len(face) - 1):
                indices.extend([face[0], face[offset], face[offset + 1]])

    if vertices:
        bounds_min = [min(vertex[axis] for vertex in vertices) for axis in range(3)]
        bounds_max = [max(vertex[axis] for vertex in vertices) for axis in range(3)]
    else:
        bounds_min = [0.0, 0.0, 0.0]
        bounds_max = [0.0, 0.0, 0.0]

    return {
        "vertexCount": len(vertices),
        "vertices": vertices,
        "uvs": uvs,
        "indices": indices,
        "bounds": {"min": bounds_min, "max": bounds_max},
    }


def normalize_vertex_color(value: Any) -> list[float]:
    channels = [finite_float(channel) for channel in value]
    if max(channels, default=0.0) > 1.0:
        channels = [channel / 255.0 for channel in channels]
    channels = (channels + [1.0, 1.0, 1.0, 1.0])[:4]
    return [max(0.0, min(1.0, channel)) for channel in channels]


def mesh_to_json(mesh: Any) -> dict[str, Any]:
    handler = MeshHandler(mesh)
    handler.process()

    vertices = [[-finite_float(pos[0]), finite_float(pos[1]), finite_float(pos[2])] for pos in handler.m_Vertices or []]
    uvs = [[finite_float(uv[0]), finite_float(uv[1])] for uv in handler.m_UV0 or []]
    while len(uvs) < len(vertices):
        uvs.append([0.0, 0.0])

    indices: list[int] = []
    for triangles in handler.get_triangles():
        for a, b, c in triangles:
            indices.extend([int(c), int(b), int(a)])

    colors = [normalize_vertex_color(color_value) for color_value in handler.m_Colors or []]
    while colors and len(colors) < len(vertices):
        colors.append([1.0, 1.0, 1.0, 1.0])

    if vertices:
        bounds_min = [min(vertex[axis] for vertex in vertices) for axis in range(3)]
        bounds_max = [max(vertex[axis] for vertex in vertices) for axis in range(3)]
    else:
        bounds_min = [0.0, 0.0, 0.0]
        bounds_max = [0.0, 0.0, 0.0]

    return {
        "vertexCount": len(vertices),
        "vertices": vertices,
        "uvs": uvs,
        "colors": colors,
        "indices": indices,
        "bounds": {"min": bounds_min, "max": bounds_max},
    }


def extract_meshes(maps: dict[str, Any], roots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mesh_ids = sorted(
        {
            mesh_id
            for root in roots
            for system in root["particleSystems"]
            for mesh_id in system["renderer"]["meshPathIds"]
            if mesh_id and mesh_id in maps["objects"]
        }
    )
    meshes: list[dict[str, Any]] = []
    for mesh_id in mesh_ids:
        mesh_obj = maps["objects"][mesh_id]
        if mesh_obj.type.name != "Mesh":
            continue
        mesh = mesh_obj.read()
        parsed = mesh_to_json(mesh)
        if not parsed["vertices"] or not parsed["indices"]:
            continue
        parsed.update(
            {
                "pathId": mesh_id,
                "name": getattr(mesh, "m_Name", getattr(mesh, "name", str(mesh_id))),
            }
        )
        meshes.append(parsed)
    return meshes


def burst_to_json(value: Any) -> dict[str, Any]:
    return {
        "time": finite_float(getattr(value, "time", 0.0)),
        "cycleCount": int(getattr(value, "cycleCount", 1) or 1),
        "repeatInterval": finite_float(getattr(value, "repeatInterval", 0.0)),
        "probability": finite_float(getattr(value, "probability", 1.0), 1.0),
        "count": minmax_curve(getattr(value, "countCurve", None)),
    }


def particle_to_json(
    maps: dict[str, Any],
    world_transforms: dict[int, dict[str, list[float]]],
    materials: dict[int, dict[str, Any]],
    root_transform_id: int,
    particle_id: int,
    renderer_id: int,
) -> dict[str, Any]:
    particle = maps["objects"][particle_id].read()
    renderer = maps["objects"][renderer_id].read()
    go_id = path_id(particle.m_GameObject)
    transform_id = maps["transformByGo"][go_id]
    initial = particle.InitialModule
    emission = particle.EmissionModule
    shape = particle.ShapeModule
    color_module = particle.ColorModule
    size_module = particle.SizeModule
    rotation_module = particle.RotationModule
    velocity_module = particle.VelocityModule
    uv_module = particle.UVModule
    material_id = next((path_id(pptr) for pptr in getattr(renderer, "m_Materials", []) or [] if path_id(pptr)), 0)
    material = materials.get(material_id, {"name": "", "blend": "normal", "texture": None})
    pivot = getattr(renderer, "m_Pivot", None)
    return {
        "name": transform_name(maps, transform_id),
        "pathId": particle_id,
        "sourceId": str(particle_id),
        "transformId": str(transform_id),
        "rendererPathId": renderer_id,
        "path": transform_path(maps, transform_id, maps["parentByTransform"].get(root_transform_id, 0)),
        "localTransform": local_transform(maps["transforms"][transform_id]),
        "worldTransform": world_transforms[transform_id],
        "renderer": {
            "renderMode": int(getattr(renderer, "m_RenderMode", 0) or 0),
            "renderAlignment": int(getattr(renderer, "m_RenderAlignment", 0) or 0),
            "sortMode": int(getattr(renderer, "m_SortMode", 0) or 0),
            "sortingOrder": int(getattr(renderer, "m_SortingOrder", 0) or 0),
            "sortingFudge": finite_float(getattr(renderer, "m_SortingFudge", 0.0)),
            "lengthScale": finite_float(getattr(renderer, "m_LengthScale", 1.0), 1.0),
            "velocityScale": finite_float(getattr(renderer, "m_VelocityScale", 0.0)),
            "cameraVelocityScale": finite_float(getattr(renderer, "m_CameraVelocityScale", 0.0)),
            "freeformStretching": bool(renderer.m_FreeformStretching),
            "rotateWithStretchDirection": bool(renderer.m_RotateWithStretchDirection),
            "minParticleSize": finite_float(getattr(renderer, "m_MinParticleSize", 0.0)),
            "maxParticleSize": finite_float(getattr(renderer, "m_MaxParticleSize", 0.0)),
            "normalDirection": finite_float(getattr(renderer, "m_NormalDirection", 1.0), 1.0),
            "pivot": vec3(pivot),
            "meshDistribution": int(getattr(renderer, "m_MeshDistribution", 0) or 0),
            "meshWeighting": [
                finite_float(getattr(renderer, "m_MeshWeighting", 1.0), 1.0),
                finite_float(getattr(renderer, "m_MeshWeighting1", 1.0), 1.0),
                finite_float(getattr(renderer, "m_MeshWeighting2", 1.0), 1.0),
                finite_float(getattr(renderer, "m_MeshWeighting3", 1.0), 1.0),
            ],
            "meshPathIds": [
                path_id(getattr(renderer, "m_Mesh", None)),
                path_id(getattr(renderer, "m_Mesh1", None)),
                path_id(getattr(renderer, "m_Mesh2", None)),
                path_id(getattr(renderer, "m_Mesh3", None)),
            ],
            "materialPathId": material_id,
            "materialName": material.get("name", ""),
            "blend": material.get("blend", "normal"),
            "blendSrc": material.get("blendSrc"),
            "blendDst": material.get("blendDst"),
            "material": material,
            "texture": material.get("texture"),
        },
        "particle": {
            "duration": finite_float(getattr(particle, "lengthInSec", 0.0)),
            "looping": bool(getattr(particle, "looping", False)),
            "playOnAwake": bool(getattr(particle, "playOnAwake", False)),
            "prewarm": bool(getattr(particle, "prewarm", False)),
            "simulationSpeed": finite_float(getattr(particle, "simulationSpeed", 1.0), 1.0),
            "scalingMode": int(getattr(particle, "scalingMode", 1) or 0),
            "randomSeed": int(getattr(particle, "randomSeed", 0) or 0),
            "autoRandomSeed": bool(getattr(particle, "autoRandomSeed", False)),
            "moveWithTransform": int(getattr(particle, "moveWithTransform", 0) or 0),
            "moveWithCustomTransformPathId": path_id(getattr(particle, "moveWithCustomTransform", None)),
            "startDelay": minmax_curve(getattr(particle, "startDelay", None)),
            "maxParticles": int(getattr(initial, "maxNumParticles", 1000) or 1000),
            "size3D": bool(getattr(initial, "size3D", False)),
            "rotation3D": bool(getattr(initial, "rotation3D", False)),
            "randomizeRotationDirection": finite_float(getattr(initial, "randomizeRotationDirection", 0.0)),
            "startLifetime": minmax_curve(getattr(initial, "startLifetime", None)),
            "startSpeed": minmax_curve(getattr(initial, "startSpeed", None)),
            "startSize": minmax_curve(getattr(initial, "startSize", None)),
            "startSizeY": minmax_curve(getattr(initial, "startSizeY", None)),
            "startSizeZ": minmax_curve(getattr(initial, "startSizeZ", None)),
            "startRotation": minmax_curve(getattr(initial, "startRotation", None)),
            "startRotationX": minmax_curve(getattr(initial, "startRotationX", None)),
            "startRotationY": minmax_curve(getattr(initial, "startRotationY", None)),
            "startColor": gradient(getattr(initial, "startColor", None)),
            "gravityModifier": minmax_curve(getattr(initial, "gravityModifier", None)),
            "emission": {
                "enabled": bool(getattr(emission, "enabled", False)),
                "rateOverTime": minmax_curve(getattr(emission, "rateOverTime", None)),
                "rateOverDistance": minmax_curve(getattr(emission, "rateOverDistance", None)),
                "bursts": [burst_to_json(burst) for burst in getattr(emission, "m_Bursts", []) or []],
            },
            "shape": {
                "enabled": bool(getattr(shape, "enabled", False)),
                "type": int(getattr(shape, "type", 0) or 0),
                "angle": finite_float(getattr(shape, "angle", 0.0)),
                "radius": finite_float(getattr(getattr(shape, "radius", None), "value", 0.0)),
                "radiusThickness": finite_float(shape.radiusThickness),
                "randomDirectionAmount": finite_float(shape.randomDirectionAmount),
                "arc": finite_float(getattr(getattr(shape, "arc", None), "value", 360.0), 360.0),
                "arcMode": int(shape.arc.mode),
                "arcSpread": finite_float(shape.arc.spread),
                "arcSpeed": minmax_curve(shape.arc.speed),
                "length": finite_float(getattr(shape, "length", 0.0)),
                "position": vec3(getattr(shape, "m_Position", None)),
                "rotation": vec3(getattr(shape, "m_Rotation", None)),
                "scale": vec3(getattr(shape, "m_Scale", None)),
            },
            "velocity": {
                "enabled": bool(getattr(velocity_module, "enabled", False)),
                "inWorldSpace": bool(getattr(velocity_module, "inWorldSpace", False)),
                "x": minmax_curve(getattr(velocity_module, "x", None)),
                "y": minmax_curve(getattr(velocity_module, "y", None)),
                "z": minmax_curve(getattr(velocity_module, "z", None)),
                "radial": minmax_curve(getattr(velocity_module, "radial", None)),
                "speedModifier": minmax_curve(getattr(velocity_module, "speedModifier", None)),
            },
            "sizeOverLifetime": {
                "enabled": bool(getattr(size_module, "enabled", False)),
                "separateAxes": bool(getattr(size_module, "separateAxes", False)),
                "curve": minmax_curve(getattr(size_module, "curve", None)),
                "y": minmax_curve(getattr(size_module, "y", None)),
                "z": minmax_curve(getattr(size_module, "z", None)),
            },
            "rotationOverLifetime": {
                "enabled": bool(getattr(rotation_module, "enabled", False)),
                "separateAxes": bool(getattr(rotation_module, "separateAxes", False)),
                "curve": minmax_curve(getattr(rotation_module, "curve", None)),
                "x": minmax_curve(getattr(rotation_module, "x", None)),
                "y": minmax_curve(getattr(rotation_module, "y", None)),
            },
            "colorOverLifetime": {
                "enabled": bool(getattr(color_module, "enabled", False)),
                "gradient": gradient(getattr(color_module, "gradient", None)),
            },
            "uv": {
                "enabled": bool(getattr(uv_module, "enabled", False)),
                "tilesX": int(getattr(uv_module, "tilesX", 1) or 1),
                "tilesY": int(getattr(uv_module, "tilesY", 1) or 1),
                "fps": finite_float(getattr(uv_module, "fps", 0.0)),
                "cycles": finite_float(getattr(uv_module, "cycles", 1.0), 1.0),
                "mode": int(getattr(uv_module, "mode", 0) or 0),
                "animationType": int(getattr(uv_module, "animationType", 0) or 0),
                "rowMode": int(getattr(uv_module, "rowMode", 0) or 0),
                "rowIndex": int(getattr(uv_module, "rowIndex", 0) or 0),
                "startFrame": minmax_curve(getattr(uv_module, "startFrame", None)),
                "frameOverTime": minmax_curve(getattr(uv_module, "frameOverTime", None)),
            },
        },
    }


def parse_streamed_frames(streamed_clip: Any) -> list[dict[str, Any]]:
    data = list(getattr(streamed_clip, "data", []) or [])
    frames: list[dict[str, Any]] = []
    offset = 0
    while offset + 2 <= len(data):
        time = u32_to_float(data[offset])
        key_count = int(data[offset + 1])
        offset += 2
        keys = []
        for _index in range(key_count):
            if offset + 5 > len(data):
                raise RuntimeError("Malformed streamed clip data")
            scalar_index = int(data[offset])
            coeffs = [
                u32_to_float(data[offset + 1]),
                u32_to_float(data[offset + 2]),
                u32_to_float(data[offset + 3]),
                u32_to_float(data[offset + 4]),
            ]
            keys.append([scalar_index, coeffs])
            offset += 5
        if math.isfinite(time):
            frames.append({"time": time, "keys": keys})
    if offset != len(data):
        raise RuntimeError("Malformed streamed clip tail")
    return frames


def clip_binding_attribute(binding: Any) -> tuple[str | None, int]:
    attribute = int(getattr(binding, "attribute", 0) or 0)
    type_id = int(getattr(binding, "typeID", 0) or 0)
    script_id = path_id(getattr(binding, "script", None))
    if type_id == 4:
        names = {1: "position", 2: "quaternion", 3: "scale", 4: "euler"}
        return names.get(attribute), 4 if attribute == 2 else 3
    if type_id == 114 and script_id and attribute == binding_hash("m_Offset.x"):
        return "uvOffsetX", 1
    if type_id == 114 and script_id and attribute == binding_hash("m_Offset.y"):
        return "uvOffsetY", 1
    return None, 1


def transform_binding_paths(maps: dict[str, Any]) -> dict[int, str]:
    candidates: dict[int, set[str]] = {}
    for transform_id in maps["transforms"]:
        full_path = transform_path(maps, transform_id)
        if not full_path:
            continue
        parts = full_path.split("/")
        for index in range(len(parts)):
            candidate = "/".join(parts[index:])
            candidates.setdefault(binding_hash(candidate), set()).add(candidate)

    # The hash space is not injective. Keep the shortest candidate so the
    # runtime can resolve it relative to the owning SimpleAnimation object.
    return {
        path_hash: sorted(paths, key=lambda value: (value.count("/"), len(value), value))[0]
        for path_hash, paths in candidates.items()
    }


def clip_to_effect_animation(
    clip_id: int,
    clip: Any,
    binding_paths: dict[int, str],
) -> dict[str, Any]:
    generic_bindings = list(clip.m_ClipBindingConstant.genericBindings)
    streamed = clip.m_MuscleClip.m_Clip.data.m_StreamedClip
    constant = clip.m_MuscleClip.m_Clip.data.m_ConstantClip
    streamed_curve_count = int(getattr(streamed, "curveCount", 0) or 0)
    bindings = []
    scalar_offset = 0

    for binding_index, binding in enumerate(generic_bindings):
        attribute, component_count = clip_binding_attribute(binding)
        if attribute is not None:
            path_hash = int(getattr(binding, "path", 0) or 0)
            bindings.append(
                {
                    "bindingIndex": binding_index,
                    "scalarOffset": scalar_offset,
                    "componentCount": component_count,
                    "pathHash": path_hash,
                    "path": binding_paths.get(path_hash, ""),
                    "attribute": attribute,
                    "typeId": int(getattr(binding, "typeID", 0) or 0),
                    "scriptPathId": path_id(getattr(binding, "script", None)),
                }
            )
        scalar_offset += component_count

    return {
        "pathId": clip_id,
        "name": clip.m_Name,
        "duration": finite_float(clip.m_MuscleClip.m_StopTime),
        "sampleRate": finite_float(clip.m_SampleRate),
        "scalarCount": scalar_offset,
        "streamedCurveCount": streamed_curve_count,
        "bindings": bindings,
        "constants": [
            [streamed_curve_count + index, finite_float(value)]
            for index, value in enumerate(getattr(constant, "data", []) or [])
        ],
        "frames": parse_streamed_frames(streamed),
    }


def mono_script_name(maps: dict[str, Any], script_id: int) -> str:
    script_obj = maps["objects"].get(script_id)
    if script_obj is None or script_obj.type.name != "MonoScript":
        return ""
    tree = script_obj.read_typetree()
    return str(tree.get("m_ClassName") or tree.get("m_Name") or "")


def effect_clip_name(maps: dict[str, Any], clip_id: int) -> str:
    clip_obj = maps["objects"].get(clip_id)
    if clip_obj is None or clip_obj.type.name != "AnimationClip":
        return ""
    return str(getattr(clip_obj.read(), "m_Name", ""))


def extract_simple_animations(maps: dict[str, Any]) -> list[dict[str, Any]]:
    animations: list[dict[str, Any]] = []
    binding_paths = transform_binding_paths(maps)
    for obj_id, obj in maps["objects"].items():
        if obj.type.name != "MonoBehaviour":
            continue
        tree = obj.read_typetree()
        script_id = int(tree.get("m_Script", {}).get("m_PathID", 0) or 0)
        if mono_script_name(maps, script_id) != "SimpleAnimation":
            continue
        go_id = int(tree.get("m_GameObject", {}).get("m_PathID", 0) or 0)
        transform_id = maps["transformByGo"].get(go_id, 0)
        clip_id = int(tree.get("m_Clip", {}).get("m_PathID", 0) or 0)
        state_items = []
        clip_ids = {clip_id} if clip_id else set()
        for state in tree.get("m_States", []) or []:
            state_clip_id = int(state.get("clip", {}).get("m_PathID", 0) or 0)
            if state_clip_id:
                clip_ids.add(state_clip_id)
            state_items.append(
                {
                    "name": str(state.get("name", "")),
                    "clipPathId": state_clip_id,
                    "clipName": effect_clip_name(maps, state_clip_id),
                }
            )
        animations.append(
            {
                "pathId": obj_id,
                "path": transform_path(maps, transform_id),
                "transformPathId": transform_id,
                "transformId": str(transform_id),
                "gameObjectPathId": go_id,
                "playAutomatically": bool(tree.get("m_PlayAutomatically", 0)),
                "wrapMode": int(tree.get("m_WrapMode", 0) or 0),
                "clipPathId": clip_id,
                "clipName": effect_clip_name(maps, clip_id),
                "states": state_items,
                "clips": [
                    clip_to_effect_animation(
                        current_id,
                        maps["objects"][current_id].read(),
                        binding_paths,
                    )
                    for current_id in sorted(clip_ids)
                    if current_id in maps["objects"] and maps["objects"][current_id].type.name == "AnimationClip"
                ],
            }
        )
    return sorted(animations, key=lambda item: item["path"])


def extract_uv_scrolls(maps: dict[str, Any]) -> list[dict[str, Any]]:
    scrolls: list[dict[str, Any]] = []
    for obj_id, obj in maps["objects"].items():
        if obj.type.name != "MonoBehaviour":
            continue
        tree = obj.read_typetree()
        script_id = int(tree.get("m_Script", {}).get("m_PathID", 0) or 0)
        if mono_script_name(maps, script_id) != "UVScroll":
            continue
        go_id = int(tree.get("m_GameObject", {}).get("m_PathID", 0) or 0)
        transform_id = maps["transformByGo"].get(go_id, 0)
        offset = tree.get("m_Offset", {})
        scrolls.append(
            {
                "pathId": obj_id,
                "path": transform_path(maps, transform_id),
                "transformPathId": transform_id,
                "gameObjectPathId": go_id,
                "offset": [finite_float(offset.get("x", 0.0)), finite_float(offset.get("y", 0.0))],
                "transformId": str(transform_id),
            }
        )
    return sorted(scrolls, key=lambda item: item["path"])


def extract_roots(maps: dict[str, Any], materials: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    world_transforms = build_world_transforms(maps)
    roots = []
    particle_pairs_by_go: dict[int, dict[str, int]] = {}

    for go_id, components in maps["componentsByGo"].items():
        pair: dict[str, int] = {}
        for component_id, component_type in components:
            if component_type == "ParticleSystem":
                pair["particle"] = component_id
            elif component_type == "ParticleSystemRenderer":
                pair["renderer"] = component_id
        if "particle" in pair and "renderer" in pair:
            particle_pairs_by_go[go_id] = pair

    def walk(transform_id: int) -> list[int]:
        ids = [transform_id]
        for child_id in maps["childrenByTransform"].get(transform_id, []):
            ids.extend(walk(child_id))
        return ids

    for transform_id, transform in maps["transforms"].items():
        if maps["parentByTransform"].get(transform_id, 0):
            continue
        name = transform_name(maps, transform_id)
        particles = []
        for descendant_id in walk(transform_id):
            go_id = path_id(maps["transforms"][descendant_id].m_GameObject)
            pair = particle_pairs_by_go.get(go_id)
            if pair is None:
                continue
            particle_json = particle_to_json(
                maps,
                world_transforms,
                materials,
                transform_id,
                pair["particle"],
                pair["renderer"],
            )
            particles.append(particle_json)
        if not particles:
            continue
        roots.append(
            {
                "name": name,
                "transformPathId": transform_id,
                "gameObjectPathId": path_id(transform.m_GameObject),
                "localTransform": local_transform(transform),
                "worldTransform": world_transforms[transform_id],
                "particleSystems": sorted(
                    particles,
                    key=lambda item: (
                        item["renderer"]["sortingOrder"],
                        item["renderer"]["sortingFudge"],
                        item["path"],
                    ),
                ),
            }
        )
    return sorted(roots, key=lambda item: item["name"])


def extract_timeline(sequence_bundle: Path) -> tuple[list[dict[str, Any]], float]:
    maps = load_maps(sequence_bundle)
    events: list[dict[str, Any]] = []
    duration = 0.0
    for obj_id, obj in maps["objects"].items():
        if obj.type.name != "MonoBehaviour":
            continue
        tree = obj.read_typetree()
        go_id = int(tree.get("m_GameObject", {}).get("m_PathID", 0) or 0)
        transform_id = maps["transformByGo"].get(go_id, 0)
        path = transform_path(maps, transform_id)
        parts = path.split("/")
        target = ""
        for part in parts:
            if part.startswith("Timelines for "):
                target = part.removeprefix("Timelines for ")
                break
        script_name = go_name(maps, go_id)
        firetime = tree.get("firetime")
        if firetime is None:
            continue
        event_duration = finite_float(tree.get("duration", 0.0))
        event_time = finite_float(firetime)
        duration = max(duration, event_time + max(0.0, event_duration))
        base = {
            "time": event_time,
            "duration": event_duration,
            "scriptName": script_name,
            "target": target,
            "sequencePath": path,
        }
        if script_name == "USFGOPlayEffectEvent":
            base["type"] = "playEffect"
        elif script_name == "USEnableObjectEvent":
            base["type"] = "setEnabled"
            base["enabled"] = bool(tree.get("enable", 0))
        elif script_name in ("USFGOPlayAnimationEvent", "USFGOChrPlayAnimEvent"):
            base["type"] = "animation"
            base["animationName"] = tree.get("AnimationName", tree.get("animationName", ""))
            base["playbackSpeed"] = finite_float(tree.get("playbackSpeed", 1.0), 1.0)
            base["startTime"] = finite_float(tree.get("startTime", 0.0))
            base["stopTime"] = finite_float(tree.get("stopTime", 0.0))
        elif script_name == "USFGOPlayTargetAnimationEvent":
            base["type"] = "targetAnimation"
            base["animationName"] = tree.get("AnimationName", tree.get("animationName", ""))
            base["playbackSpeed"] = finite_float(tree.get("playbackSpeed", 1.0), 1.0)
            base["startTime"] = finite_float(tree.get("startTime", 0.0))
            base["stopTime"] = finite_float(tree.get("stopTime", 0.0))
            base["animationTarget"] = int(tree.get("target", 0) or 0)
        elif script_name == "USFGOPlayStandardCutInEvent":
            base["type"] = "standardCutIn"
            base["svtId"] = int(tree.get("svtId", 0) or 0)
            base["faceType"] = int(tree.get("faceType", 0) or 0)
            base["cutInType"] = int(tree.get("cutInType", 0) or 0)
        elif script_name == "USFGOShakeCameraEvent":
            base["type"] = "shake"
            base["horizontalShakeSize"] = finite_float(tree.get("horizontalShakeSize", 0.0))
            base["verticalShakeSize"] = finite_float(tree.get("verticalShakeSize", 0.0))
            base["isRelative"] = bool(tree["isRelative"])
            base["fixedUpdate"] = bool(tree["isFiexedUpdate"])
        elif script_name == "USFGOFadeEvent":
            base["type"] = "fade"
            base["fadeColour"] = tree.get("fadeColour")
            base["fadeCurve"] = tree.get("fadeCurve")
        elif script_name == "USFGOChrColorChangeEvent":
            base["type"] = "colorChange"
            base["colorTarget"] = int(tree.get("target", 0))
            base["fadeColour"] = color(tree.get("fadeColour"))
            base["fadeCurve"] = timeline_fade_curve(tree.get("fadeCurve"))
            base["otherHierarchyPath"] = tree.get("otherHierarchyPath", "")
        elif script_name == "USFGOChrDispChangeEvent":
            base["type"] = "displayChange"
            base["displayTarget"] = int(tree.get("target", 0) or 0)
            base["displayEnabled"] = bool(tree.get("IsDisp", 0))
        elif script_name == "USFGOChangeBgEvent":
            base["type"] = "changeBg"
            base["bgName"] = tree.get("bgName", "")
        elif script_name == "USFGOTimeScaleEditEvent":
            base["type"] = "timeScale"
            base["targetTimeScale"] = finite_float(tree.get("targetTimeScale", 1.0), 1.0)
        elif script_name == "USFGOSetModelEvolutionEvent":
            base["type"] = "modelEvolution"
            base["evolutionLevel"] = int(tree.get("setEvolutionLevel", -1) or -1)
        elif script_name == "USFGOAttachToParentEvent":
            base["type"] = "attach"
            base["parentObjectName"] = tree.get("parentObjectName", "")
            base["nodeName"] = tree.get("nodeName", "")
            base["tposition"] = tree.get("tposition")
            base["trotation"] = tree.get("trotation")
            base["tscale"] = tree.get("tscale")
        else:
            base["type"] = "sequenceEvent"
        if base["type"] in {
            "playEffect",
            "setEnabled",
            "animation",
            "targetAnimation",
            "modelEvolution",
            "standardCutIn",
            "shake",
            "fade",
            "colorChange",
            "displayChange",
            "changeBg",
            "timeScale",
            "attach",
        }:
            events.append(base)
    events.sort(key=lambda item: (item["time"], item["scriptName"], item["target"]))
    return events, math.ceil(duration * 10.0) / 10.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--sequence-only",
        action="store_true",
        help="Refresh only Actor and BattleCamera transform tracks in the existing JSON export.",
    )
    args = parser.parse_args()
    if args.sequence_only:
        payload = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        sequence_maps = load_maps(SEQUENCE_BUNDLE)
        payload["actorTransform"] = extract_actor_transform(sequence_maps)
        payload["battleCamera"] = extract_battle_camera(SEQUENCE_BUNDLE, sequence_maps)
        if payload["battleCamera"]:
            payload["battleCamera"]["projection"] = extract_battle_camera_projection(BATTLE_COMMON_BUNDLE)
        OUT_JSON.write_text(
            json.dumps(sanitize_json(payload), ensure_ascii=False, indent=2, allow_nan=False),
            encoding="utf-8",
        )
        print(json.dumps({"outJson": str(OUT_JSON), "actorTransform": bool(payload["actorTransform"]), "battleCamera": bool(payload["battleCamera"])}, indent=2))
        return

    effect_maps = load_maps(EFFECT_BUNDLE)
    textures = {
        obj_id: obj.read()
        for obj_id, obj in effect_maps["objects"].items()
        if obj.type.name == "Texture2D"
    }
    texture_meta = copy_texture_files(textures)
    materials = extract_materials(effect_maps, texture_meta)
    roots = extract_roots(effect_maps, materials)
    meshes = extract_meshes(effect_maps, roots)
    simple_animations = extract_simple_animations(effect_maps)
    uv_scrolls = extract_uv_scrolls(effect_maps)
    timeline, duration = extract_timeline(SEQUENCE_BUNDLE)
    sequence_maps = load_maps(SEQUENCE_BUNDLE)
    actor_transform = extract_actor_transform(sequence_maps)
    battle_camera = extract_battle_camera(SEQUENCE_BUNDLE, sequence_maps)
    if battle_camera:
        battle_camera["projection"] = extract_battle_camera_projection(BATTLE_COMMON_BUNDLE)
    used_roots = sorted({event["target"] for event in timeline if event["type"] == "playEffect" and event["target"]})

    payload = {
        "sourceBundle": str(EFFECT_BUNDLE),
        "sequenceBundle": str(SEQUENCE_BUNDLE),
        "duration": duration,
        "textures": list(texture_meta.values()),
        "materials": list(materials.values()),
        "meshes": meshes,
        "simpleAnimations": simple_animations,
        "uvScrolls": uv_scrolls,
        "battleCamera": battle_camera,
        "actorTransform": actor_transform,
        "roots": roots,
        "timeline": timeline,
        "usedEffectRoots": used_roots,
        "exportNotes": [
            "All particles are exported from NoblePhantasm@100101 ParticleSystem / ParticleSystemRenderer records.",
            "Timeline targets are resolved from NoblePhantasm@Sequence@100101 hierarchy names: Timelines for <effect root>.",
        ],
    }
    OUT_JSON.write_text(json.dumps(sanitize_json(payload), ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    print(
        json.dumps(
            {
                "outJson": str(OUT_JSON),
                "textures": len(texture_meta),
                "meshes": len(meshes),
                "roots": len(roots),
                "particleSystems": sum(len(root["particleSystems"]) for root in roots),
                "simpleAnimations": len(simple_animations),
                "uvScrolls": len(uv_scrolls),
                "timelineEvents": len(timeline),
                "duration": duration,
                "usedEffectRoots": used_roots,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
