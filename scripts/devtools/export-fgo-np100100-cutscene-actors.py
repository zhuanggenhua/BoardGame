from __future__ import annotations

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
NP_BUNDLE = WORK_ROOT / "DecryptedAssetBundles" / "NoblePhantasm@100101.unity3d"
SERVANT_BUNDLE = WORK_ROOT / "DecryptedAssetBundles" / "Servants@100100.unity3d"
EXPORTED_TEXTURE_DIR = (
    WORK_ROOT
    / "ExportedGameAssets"
    / "06_NoblePhantasmEffect"
    / "NoblePhantasm@100101"
    / "Texture2D_png"
)
PUBLIC_ROOT = PROJECT_ROOT / "public" / "assets" / "dev" / "fgo-cutscene" / "np100100"
OUT_DIR = PUBLIC_ROOT / "np_effect"
OUT_JSON = PUBLIC_ROOT / "np100100_cutscene_actors.json"

ACTOR_ROOTS = ("chr_100100", "chr_100101")
ACTOR_MESH_NAMES = ("body_level_2", "body_level_3")
ACTOR_ANIMATIONS = ("treasureArms4_a", "treasureArms5_a", "wait02", "treasureArms1_a")
TARGET_ANIMATIONS = ("damage_01",)
ACTOR_TEXTURE = "np_100100"


def path_id(value: Any) -> int:
    return int(getattr(value, "path_id", 0) or 0)


def safe_name(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z_.@+-]+", "_", value).strip("_") or "unnamed"


def vec3(value: Any) -> list[float]:
    return [
        float(getattr(value, "x", 0.0) or 0.0),
        float(getattr(value, "y", 0.0) or 0.0),
        float(getattr(value, "z", 0.0) or 0.0),
    ]


def quat(value: Any) -> list[float]:
    return [
        float(getattr(value, "x", 0.0) or 0.0),
        float(getattr(value, "y", 0.0) or 0.0),
        float(getattr(value, "z", 0.0) or 0.0),
        float(getattr(value, "w", 1.0) or 1.0),
    ]


def matrix4(value: Any) -> list[float]:
    return [
        float(getattr(value, "e00")),
        float(getattr(value, "e01")),
        float(getattr(value, "e02")),
        float(getattr(value, "e03")),
        float(getattr(value, "e10")),
        float(getattr(value, "e11")),
        float(getattr(value, "e12")),
        float(getattr(value, "e13")),
        float(getattr(value, "e20")),
        float(getattr(value, "e21")),
        float(getattr(value, "e22")),
        float(getattr(value, "e23")),
        float(getattr(value, "e30")),
        float(getattr(value, "e31")),
        float(getattr(value, "e32")),
        float(getattr(value, "e33")),
    ]


def u32_to_float(value: int) -> float:
    return struct.unpack("<f", struct.pack("<I", int(value) & 0xFFFFFFFF))[0]


def binding_hash(path: str) -> int:
    return zlib.crc32(path.encode("utf-8")) & 0xFFFFFFFF


def load_maps(bundle_path: Path) -> dict[str, Any]:
    env = UnityPy.load(str(bundle_path))
    objects = {obj.path_id: obj for obj in env.objects}
    game_objects: dict[int, Any] = {}
    transforms: dict[int, Any] = {}
    components_by_go: dict[int, list[tuple[int, str]]] = {}

    for obj in env.objects:
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


def transform_path(maps: dict[str, Any], transform_id: int) -> str:
    names: list[str] = []
    current = transform_id
    while current:
        names.append(transform_name(maps, current))
        current = maps["parentByTransform"].get(current, 0)
    return "/".join(reversed(names))


def find_transform_by_path(maps: dict[str, Any], target_path: str) -> int:
    for transform_id in maps["transforms"]:
        if transform_path(maps, transform_id) == target_path:
            return transform_id
    raise RuntimeError(f"Transform not found: {target_path}")


def find_smr_by_path(maps: dict[str, Any], target_path: str) -> tuple[int, int]:
    transform_id = find_transform_by_path(maps, target_path)
    go_id = path_id(maps["transforms"][transform_id].m_GameObject)
    for component_id, component_type in maps["componentsByGo"].get(go_id, []):
        if component_type == "SkinnedMeshRenderer":
            return component_id, transform_id
    raise RuntimeError(f"SkinnedMeshRenderer not found: {target_path}")


def relative_actor_path(full_path: str, actor_root: str) -> str:
    return full_path.removeprefix(f"{actor_root}/")


def local_transform(transform: Any) -> dict[str, list[float]]:
    return {
        "position": vec3(transform.m_LocalPosition),
        "rotation": quat(transform.m_LocalRotation),
        "scale": vec3(transform.m_LocalScale),
    }


def walk_transforms(maps: dict[str, Any], root_transform_id: int) -> list[int]:
    result = [root_transform_id]
    for child_id in maps["childrenByTransform"].get(root_transform_id, []):
        result.extend(walk_transforms(maps, child_id))
    return result


def mesh_to_json(mesh: Any, weight_map: dict[int, int]) -> dict[str, Any]:
    handler = MeshHandler(mesh)
    handler.process()
    if not handler.m_Vertices or not handler.m_UV0:
        raise RuntimeError(f"Mesh has no vertices/uvs: {mesh.m_Name}")

    triangles = handler.get_triangles()
    indices = [index for submesh in triangles for tri in submesh for index in tri]
    local_indices = handler.m_BoneIndices or [(0,)] * len(handler.m_Vertices)
    local_weights = handler.m_BoneWeights
    weights: list[dict[str, list[float] | list[int]]] = []

    for vertex_index, raw_indices in enumerate(local_indices):
        raw_weights = local_weights[vertex_index] if local_weights else None
        mapped_indices: list[int] = []
        mapped_weights: list[float] = []
        for influence_index, local_index in enumerate(raw_indices):
            mapped_indices.append(weight_map.get(int(local_index), 0))
            if raw_weights is None:
                mapped_weights.append(1.0 if influence_index == 0 else 0.0)
            else:
                mapped_weights.append(float(raw_weights[influence_index]))
        while len(mapped_indices) < 4:
            mapped_indices.append(0)
            mapped_weights.append(0.0)
        weights.append({"indices": mapped_indices[:4], "weights": mapped_weights[:4]})

    return {
        "name": mesh.m_Name,
        "vertexCount": int(handler.m_VertexCount),
        "vertices": [[float(x), float(y), float(z)] for x, y, z in handler.m_Vertices],
        "uvs": [[float(u), float(v)] for u, v in handler.m_UV0],
        "indices": indices,
        "weights": weights,
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


def clip_to_animation(clip: Any, node_by_hash: dict[int, dict[str, Any]]) -> dict[str, Any]:
    attribute_names = {1: "position", 3: "scale", 4: "euler"}
    generic_bindings = list(clip.m_ClipBindingConstant.genericBindings)
    streamed = clip.m_MuscleClip.m_Clip.data.m_StreamedClip
    constant = clip.m_MuscleClip.m_Clip.data.m_ConstantClip
    streamed_curve_count = int(getattr(streamed, "curveCount", 0) or 0)
    scalar_count = len(generic_bindings) * 3
    bindings = []

    for binding_index, binding in enumerate(generic_bindings):
        path_hash = int(binding.path)
        attribute = attribute_names.get(int(binding.attribute))
        node = node_by_hash.get(path_hash)
        if attribute is None or node is None:
            continue
        bindings.append(
            {
                "bindingIndex": binding_index,
                "scalarOffset": binding_index * 3,
                "nodeIndex": int(node["index"]),
                "pathHash": path_hash,
                "path": node["path"],
                "attribute": attribute,
            }
        )

    return {
        "name": clip.m_Name,
        "duration": float(clip.m_MuscleClip.m_StopTime),
        "sampleRate": float(clip.m_SampleRate),
        "scalarCount": scalar_count,
        "streamedCurveCount": streamed_curve_count,
        "bindings": bindings,
        "constants": [
            [streamed_curve_count + index, float(value)]
            for index, value in enumerate(getattr(constant, "data", []) or [])
        ],
        "frames": parse_streamed_frames(streamed),
    }


def copy_actor_texture(maps: dict[str, Any]) -> str:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for obj_id, obj in maps["objects"].items():
        if obj.type.name != "Texture2D":
            continue
        texture = obj.read()
        if getattr(texture, "m_Name", "") != ACTOR_TEXTURE:
            continue
        source_name = f"{safe_name(ACTOR_TEXTURE)}_{obj_id}.png"
        source = EXPORTED_TEXTURE_DIR / source_name
        if not source.exists():
            matches = list(EXPORTED_TEXTURE_DIR.glob(f"{safe_name(ACTOR_TEXTURE)}_*.png"))
            source = matches[0] if matches else source
        if not source.exists():
            raise RuntimeError(f"Exported texture not found: {ACTOR_TEXTURE}")
        shutil.copy2(source, OUT_DIR / source.name)
        return f"np_effect/{source.name}"
    raise RuntimeError(f"Texture not found in bundle: {ACTOR_TEXTURE}")


def build_actor(maps: dict[str, Any], actor_root: str, texture_file: str) -> dict[str, Any]:
    actor_root_id = find_transform_by_path(maps, actor_root)
    joint_root_id = find_transform_by_path(maps, f"{actor_root}/joint_all_Base")
    nodes = []
    node_by_path_id: dict[int, dict[str, Any]] = {}

    for transform_id in walk_transforms(maps, joint_root_id):
        full_path = transform_path(maps, transform_id)
        path = relative_actor_path(full_path, actor_root)
        parent_id = maps["parentByTransform"].get(transform_id, 0)
        parent_index = -1
        if parent_id in node_by_path_id:
            parent_index = int(node_by_path_id[parent_id]["index"])

        transform = maps["transforms"][transform_id]
        local = local_transform(transform)
        node = {
            "index": len(nodes),
            "pathId": transform_id,
            "path": path,
            "pathHash": binding_hash(path),
            "name": transform_name(maps, transform_id),
            "parent": parent_index,
            "isSkinBone": False,
            "skinBoneIndex": -1,
            "localPosition": local["position"],
            "localRotation": local["rotation"],
            "localScale": local["scale"],
        }
        nodes.append(node)
        node_by_path_id[transform_id] = node

    skin_bones = []
    mesh_payloads = []
    objects = maps["objects"]

    for mesh_name in ACTOR_MESH_NAMES:
        smr_id, _transform_id = find_smr_by_path(maps, f"{actor_root}/{mesh_name}")
        smr = objects[smr_id].read()
        mesh_id = path_id(smr.m_Mesh)
        mesh = objects[mesh_id].read()
        weight_map: dict[int, int] = {}

        for local_bone_index, bone_ref in enumerate(getattr(smr, "m_Bones", []) or []):
            bone_transform_id = path_id(bone_ref)
            node = node_by_path_id.get(bone_transform_id)
            if node is None:
                continue
            skin_index = len(skin_bones)
            skin_bones.append(
                {
                    "skinIndex": skin_index,
                    "nodeIndex": int(node["index"]),
                    "pathId": bone_transform_id,
                    "path": node["path"],
                    "name": node["name"],
                    "bindPose": matrix4(mesh.m_BindPose[local_bone_index]),
                }
            )
            weight_map[local_bone_index] = skin_index
            if not node["isSkinBone"]:
                node["isSkinBone"] = True
                node["skinBoneIndex"] = skin_index

        mesh_payloads.append(
            {
                "kind": "skinnedMesh",
                "source": f"NoblePhantasm@100101.unity3d/{actor_root}/{mesh_name}",
                "smrPathId": smr_id,
                "meshPathId": mesh_id,
                "texture": texture_file,
                "mesh": mesh_to_json(mesh, weight_map),
            }
        )

    node_by_hash = {int(node["pathHash"]): node for node in nodes}
    clips_by_name = {
        obj.read().m_Name: obj.read()
        for obj in maps["env"].objects
        if obj.type.name == "AnimationClip"
    }
    animations = [
        clip_to_animation(clips_by_name[name], node_by_hash)
        for name in ACTOR_ANIMATIONS
        if name in clips_by_name
    ]

    servant_maps = load_maps(SERVANT_BUNDLE)
    servant_clips_by_name = {
        obj.read().m_Name: obj.read()
        for obj in servant_maps["env"].objects
        if obj.type.name == "AnimationClip"
    }
    animations.extend(
        clip_to_animation(servant_clips_by_name[name], node_by_hash)
        for name in TARGET_ANIMATIONS
        if name in servant_clips_by_name
    )

    first_mesh, *additional_meshes = mesh_payloads
    return {
        "name": actor_root,
        "source": f"NoblePhantasm@100101.unity3d/{actor_root}",
        "rootTransform": local_transform(maps["transforms"][actor_root_id]),
        "texture": texture_file,
        "mesh": first_mesh["mesh"],
        "attachments": additional_meshes,
        "skeleton": {
            "rootPathId": joint_root_id,
            "nodes": nodes,
            "skinBones": skin_bones,
        },
        "animations": animations,
    }


def main() -> None:
    maps = load_maps(NP_BUNDLE)
    texture_file = copy_actor_texture(maps)
    actors = [build_actor(maps, actor_root, texture_file) for actor_root in ACTOR_ROOTS]
    payload = {
        "sourceBundle": str(NP_BUNDLE),
        "texture": texture_file,
        "actors": actors,
    }
    OUT_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "outJson": str(OUT_JSON),
                "texture": texture_file,
                "actors": [
                    {
                        "name": actor["name"],
                        "nodes": len(actor["skeleton"]["nodes"]),
                        "skinBones": len(actor["skeleton"]["skinBones"]),
                        "meshes": 1 + len(actor.get("attachments", [])),
                        "animations": [
                            {
                                "name": animation["name"],
                                "bindings": len(animation["bindings"]),
                                "frames": len(animation["frames"]),
                                "duration": animation["duration"],
                            }
                            for animation in actor["animations"]
                        ],
                    }
                    for actor in actors
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
