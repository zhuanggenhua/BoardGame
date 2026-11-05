from __future__ import annotations

import json
import math
import struct
import zlib
from pathlib import Path
from typing import Any

import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler


WORK_ROOT = Path(r"E:\zhanggenhua\temp\fgo\work")
PROJECT_ROOT = Path(r"E:\zhanggenhua\temp\BoardGame")
SERVANT_BUNDLE = WORK_ROOT / "DecryptedAssetBundles" / "Servants@100100.unity3d"
PUBLIC_ROOT = PROJECT_ROOT / "public" / "assets" / "dev" / "fgo-cutscene" / "np100100"
OUT_JSON = PUBLIC_ROOT / "saber_body_level_1_skin.json"

BODY_PATH = "chr/body_level_1"
WEAPON_PATHS = (
    "chr/weapon_level_1",
    "chr/weapon_level_2_3",
)
WEAPON_ANIMATION_PATHS = (
    "joint_all_Base/joint_all/joint_weapon_all",
    "joint_all_Base/joint_all/joint_weapon_all/joint_sword",
    "joint_all_Base/joint_all/joint_weapon_all/joint_sword/en_noble01",
    "joint_all_Base/joint_all/joint_weapon_all/joint_sword_EX",
)
ATTACH_NODE_PATHS = (
    "chr/joint_all_Base/joint_all/joint_weapon_all/joint_sword",
    "chr/joint_all_Base/joint_all/joint_weapon_all/joint_sword/en_noble01",
)
WEAPON_BINDING_HASHES = {
    zlib.crc32(path.encode("utf-8")) & 0xFFFFFFFF
    for path in WEAPON_ANIMATION_PATHS
}


def path_id(value: Any) -> int:
    return int(getattr(value, "path_id", 0) or 0)


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


def binding_hash(path: str) -> int:
    return zlib.crc32(path.encode("utf-8")) & 0xFFFFFFFF


def u32_to_float(value: int) -> float:
    return struct.unpack("<f", struct.pack("<I", int(value) & 0xFFFFFFFF))[0]


def clip_to_animation(clip: Any, node_by_hash: dict[int, dict[str, Any]]) -> dict[str, Any]:
    attribute_names = {1: "position", 3: "scale", 4: "euler"}
    bindings = []
    for binding_index, binding in enumerate(clip.m_ClipBindingConstant.genericBindings):
        path_hash = int(binding.path)
        node = node_by_hash.get(path_hash)
        attribute = attribute_names.get(int(binding.attribute))
        if node is None or attribute is None:
            continue
        bindings.append({
            "bindingIndex": binding_index,
            "scalarOffset": binding_index * 3,
            "nodeIndex": int(node["index"]),
            "pathHash": path_hash,
            "path": node["path"],
            "attribute": attribute,
        })

    streamed = clip.m_MuscleClip.m_Clip.data.m_StreamedClip
    constant = clip.m_MuscleClip.m_Clip.data.m_ConstantClip
    data = list(getattr(streamed, "data", []) or [])
    frames = []
    offset = 0
    while offset + 2 <= len(data):
        time = u32_to_float(data[offset])
        key_count = int(data[offset + 1])
        offset += 2
        keys = []
        for _index in range(key_count):
            if offset + 5 > len(data):
                raise RuntimeError(f"Malformed streamed clip: {clip.m_Name}")
            keys.append([
                int(data[offset]),
                [u32_to_float(data[offset + index]) for index in range(1, 5)],
            ])
            offset += 5
        if math.isfinite(time):
            frames.append({"time": time, "keys": keys})
    if offset != len(data):
        raise RuntimeError(f"Malformed streamed clip tail: {clip.m_Name}")

    streamed_curve_count = int(getattr(streamed, "curveCount", 0) or 0)
    return {
        "name": clip.m_Name,
        "duration": float(clip.m_MuscleClip.m_StopTime),
        "sampleRate": float(clip.m_SampleRate),
        "scalarCount": len(clip.m_ClipBindingConstant.genericBindings) * 3,
        "streamedCurveCount": streamed_curve_count,
        "bindings": bindings,
        "constants": [
            [streamed_curve_count + index, float(value)]
            for index, value in enumerate(getattr(constant, "data", []) or [])
        ],
        "frames": frames,
    }


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

    return {
        "env": env,
        "objects": objects,
        "gameObjects": game_objects,
        "transforms": transforms,
        "componentsByGo": components_by_go,
        "transformByGo": {path_id(transform.m_GameObject): transform_id for transform_id, transform in transforms.items()},
        "parentByTransform": {
            transform_id: path_id(getattr(transform, "m_Father", None))
            for transform_id, transform in transforms.items()
        },
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


def skin_path(full_path: str) -> str:
    return "chr" if full_path == "chr" else full_path.removeprefix("chr/")


def local_transform(transform: Any) -> dict[str, list[float]]:
    return {
        "position": vec3(transform.m_LocalPosition),
        "rotation": quat(transform.m_LocalRotation),
        "scale": vec3(transform.m_LocalScale),
    }


def find_smr_by_path(maps: dict[str, Any], target_path: str) -> tuple[int, int]:
    for go_id, components in maps["componentsByGo"].items():
        transform_id = maps["transformByGo"].get(go_id, 0)
        if transform_id == 0 or transform_path(maps, transform_id) != target_path:
            continue
        for component_id, component_type in components:
            if component_type == "SkinnedMeshRenderer":
                return component_id, transform_id
    raise RuntimeError(f"SkinnedMeshRenderer not found: {target_path}")


def reset_generated_weapon_payload(data: dict[str, Any], maps: dict[str, Any]) -> None:
    nodes: list[dict[str, Any]] = data["skeleton"]["nodes"]
    skin_bones: list[dict[str, Any]] = data["skeleton"]["skinBones"]
    body_smr_id, _body_transform_id = find_smr_by_path(maps, BODY_PATH)
    body_smr = maps["objects"][body_smr_id].read()
    body_mesh = maps["objects"][path_id(body_smr.m_Mesh)].read()

    data.pop("attachments", None)
    nodes[:] = [
        node
        for node in nodes
        if not (
            "weapon" in node.get("path", "")
            or "sword" in node.get("path", "")
            or "noble" in node.get("path", "")
        )
    ]
    for index, node in enumerate(nodes):
        node["index"] = index
        node["isSkinBone"] = False
        node["skinBoneIndex"] = -1

    node_by_path_id = {int(node["pathId"]): node for node in nodes}
    skin_bones.clear()
    for skin_index, bone_ref in enumerate(getattr(body_smr, "m_Bones", []) or []):
        bone_transform_id = path_id(bone_ref)
        node = node_by_path_id.get(bone_transform_id)
        if node is None:
            raise RuntimeError(f"Body bone not found in exported skeleton: {bone_transform_id}")
        node["isSkinBone"] = True
        node["skinBoneIndex"] = skin_index
        skin_bones.append(
            {
                "skinIndex": skin_index,
                "nodeIndex": int(node["index"]),
                "pathId": bone_transform_id,
                "path": node["path"],
                "name": node["name"],
                "bindPose": matrix4(body_mesh.m_BindPose[skin_index]),
            }
        )

    for animation in data.get("animations", []):
        animation["bindings"] = [
            binding
            for binding in animation["bindings"]
            if int(binding["pathHash"]) not in WEAPON_BINDING_HASHES
        ]


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
        weights.append(
            {
                "indices": mapped_indices[:4],
                "weights": mapped_weights[:4],
            }
        )

    return {
        "name": mesh.m_Name,
        "vertexCount": int(handler.m_VertexCount),
        "vertices": [[float(x), float(y), float(z)] for x, y, z in handler.m_Vertices],
        "uvs": [[float(u), float(v)] for u, v in handler.m_UV0],
        "indices": indices,
        "weights": weights,
    }


def mesh_used_bone_indices(mesh: Any) -> set[int]:
    handler = MeshHandler(mesh)
    handler.process()
    if not handler.m_BoneIndices:
        return {0}
    return {int(index) for indices in handler.m_BoneIndices for index in indices}


def main() -> None:
    data = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    maps = load_maps(SERVANT_BUNDLE)
    reset_generated_weapon_payload(data, maps)
    objects = maps["objects"]

    nodes: list[dict[str, Any]] = data["skeleton"]["nodes"]
    skin_bones: list[dict[str, Any]] = data["skeleton"]["skinBones"]
    actor_root_id = find_transform_by_path(maps, "chr")
    data["rootTransform"] = local_transform(maps["transforms"][actor_root_id])
    node_by_path_id = {int(node["pathId"]): node for node in nodes}
    node_by_hash = {int(node.get("pathHash", binding_hash(node["path"]))): node for node in nodes}

    def ensure_node(transform_id: int) -> dict[str, Any]:
        existing = node_by_path_id.get(transform_id)
        if existing is not None:
            return existing

        full_path = transform_path(maps, transform_id)
        path = skin_path(full_path)
        parent_id = maps["parentByTransform"].get(transform_id, 0)
        parent_index = -1
        if parent_id:
            parent_path = transform_path(maps, parent_id)
            if parent_path.startswith("chr"):
                parent_index = int(ensure_node(parent_id)["index"])

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
        node_by_hash[int(node["pathHash"])] = node
        return node

    skin_index_by_path_id = {
        int(skin_bone["pathId"]): int(skin_bone["skinIndex"])
        for skin_bone in skin_bones
    }
    attachments: list[dict[str, Any]] = []
    for weapon_path in WEAPON_PATHS:
        weapon_smr_id, _weapon_transform_id = find_smr_by_path(maps, weapon_path)
        weapon_smr = objects[weapon_smr_id].read()
        weapon_mesh_id = path_id(weapon_smr.m_Mesh)
        weapon_mesh = objects[weapon_mesh_id].read()
        used_weapon_bone_indices = mesh_used_bone_indices(weapon_mesh)
        weapon_weight_map: dict[int, int] = {}
        for local_bone_index, bone_ref in enumerate(getattr(weapon_smr, "m_Bones", []) or []):
            if local_bone_index not in used_weapon_bone_indices:
                continue
            bone_transform_id = path_id(bone_ref)
            if bone_transform_id == 0:
                continue
            node = ensure_node(bone_transform_id)
            skin_index = skin_index_by_path_id.get(bone_transform_id)
            if skin_index is None:
                skin_index = len(skin_bones)
                skin_bones.append(
                    {
                        "skinIndex": skin_index,
                        "nodeIndex": int(node["index"]),
                        "pathId": bone_transform_id,
                        "path": node["path"],
                        "name": node["name"],
                        "bindPose": matrix4(weapon_mesh.m_BindPose[local_bone_index]),
                    }
                )
                skin_index_by_path_id[bone_transform_id] = skin_index
            weapon_weight_map[local_bone_index] = skin_index
            if not node["isSkinBone"]:
                node["isSkinBone"] = True
                node["skinBoneIndex"] = skin_index

        attachments.append(
            {
                "kind": "skinnedMesh",
                "source": f"Servants@100100.unity3d/{weapon_path}",
                "smrPathId": weapon_smr_id,
                "meshPathId": weapon_mesh_id,
                "texture": data["texture"],
                "mesh": mesh_to_json(weapon_mesh, weapon_weight_map),
            }
        )

    for attach_node_path in ATTACH_NODE_PATHS:
        ensure_node(find_transform_by_path(maps, attach_node_path))

    data["attachments"] = attachments

    new_hashes = {int(node["pathHash"]) for node in nodes if "weapon" in node["path"] or "sword" in node["path"]}
    attribute_names = {
        1: "position",
        3: "scale",
        4: "euler",
    }
    clips_by_name = {
        obj.read().m_Name: obj.read()
        for obj in maps["env"].objects
        if obj.type.name == "AnimationClip"
    }

    added_bindings = 0
    for clip_name in ("wait02", "treasureArms1_a"):
        if any(animation["name"] == clip_name for animation in data.get("animations", [])):
            continue
        clip = clips_by_name.get(clip_name)
        if clip is None:
            raise RuntimeError(f"Required opening animation missing from Servants bundle: {clip_name}")
        data.setdefault("animations", []).append(clip_to_animation(clip, node_by_hash))

    for animation in data.get("animations", []):
        clip = clips_by_name.get(animation["name"])
        if clip is None:
            continue
        existing_keys = {
            (int(binding["bindingIndex"]), int(binding["pathHash"]), binding["attribute"])
            for binding in animation["bindings"]
        }
        for binding_index, binding in enumerate(clip.m_ClipBindingConstant.genericBindings):
            path_hash = int(binding.path)
            attribute = attribute_names.get(int(binding.attribute))
            if attribute is None or path_hash not in new_hashes:
                continue
            node = node_by_hash.get(path_hash)
            if node is None:
                continue
            key = (binding_index, path_hash, attribute)
            if key in existing_keys:
                continue
            animation["bindings"].append(
                {
                    "bindingIndex": binding_index,
                    "scalarOffset": binding_index * 3,
                    "nodeIndex": int(node["index"]),
                    "pathHash": path_hash,
                    "path": node["path"],
                    "attribute": attribute,
                }
            )
            existing_keys.add(key)
            added_bindings += 1
        animation["bindings"].sort(key=lambda item: (int(item["scalarOffset"]), item["attribute"], item["path"]))

    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        json.dumps(
            {
                "outJson": str(OUT_JSON),
                "nodes": len(nodes),
                "skinBones": len(skin_bones),
                "attachments": len(data["attachments"]),
                "weaponMeshes": [
                    {
                        "name": attachment["mesh"]["name"],
                        "vertices": len(attachment["mesh"]["vertices"]),
                        "indices": len(attachment["mesh"]["indices"]),
                    }
                    for attachment in data["attachments"]
                ],
                "addedAnimationBindings": added_bindings,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
