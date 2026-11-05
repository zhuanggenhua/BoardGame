from __future__ import annotations

import argparse
import gc
import importlib
import json
import re
from pathlib import Path

from UnityPy.helpers.MeshHelper import MeshHandler

actors = importlib.import_module('export-fgo-np100100-cutscene-actors')
effects = importlib.import_module('export-fgo-np100100-effects')
metadata = importlib.import_module('export-fgo-scene-metadata')
WORK = effects.WORK_ROOT
OUT = effects.PROJECT_ROOT / 'public/assets/dev/fgo-characters'
IDENTITY = {'position': [0, 0, 0], 'rotation': [0, 0, 0, 1], 'scale': [1, 1, 1]}
IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def export_clip(clip, node_by_hash, mesh_paths):
    data = clip.m_MuscleClip.m_Clip.data
    bindings, visibility, offset = [], [], 0
    for index, binding in enumerate(clip.m_ClipBindingConstant.genericBindings):
        typ, attribute, path = int(binding.typeID), int(binding.attribute), int(binding.path)
        count = (4 if attribute == 2 else 3) if typ == 4 and attribute in (1, 2, 3, 4) else 1
        node = node_by_hash.get(path)
        if typ == 4 and node and attribute in (1, 2, 3, 4):
            bindings.append({'bindingIndex': index, 'scalarOffset': offset, 'nodeIndex': node['index'],
                             'pathHash': path, 'path': node['path'],
                             'attribute': {1: 'position', 2: 'quaternion', 3: 'scale', 4: 'euler'}[attribute]})
        if typ in (1, 23, 137) and attribute in (actors.binding_hash('m_Enabled'), actors.binding_hash('m_IsActive')):
            for mesh_name in mesh_paths.get(path, []):
                visibility.append({'mesh': mesh_name, 'scalarOffset': offset})
        offset += count
    frames = actors.parse_streamed_frames(data.m_StreamedClip)
    dense = data.m_DenseClip
    dense_count = int(dense.m_CurveCount)
    for frame in range(int(dense.m_FrameCount)):
        at = float(dense.m_BeginTime) + frame / float(dense.m_SampleRate)
        keys = [[int(data.m_StreamedClip.curveCount) + i, [0, 0, 0, float(dense.m_SampleArray[frame * dense_count + i])]]
                for i in range(dense_count)]
        frames.append({'time': at, 'keys': keys})
    frames.sort(key=lambda frame: frame['time'])
    return {'name': clip.m_Name, 'duration': float(clip.m_MuscleClip.m_StopTime),
            'sampleRate': float(clip.m_SampleRate), 'scalarCount': offset,
            'streamedCurveCount': int(data.m_StreamedClip.curveCount), 'bindings': bindings,
            'constants': [[int(data.m_StreamedClip.curveCount) + dense_count + i, float(v)]
                          for i, v in enumerate(data.m_ConstantClip.data)], 'frames': frames}, visibility


def export_character(bundle):
    cid = re.fullmatch(r'Servants@(\d+)\.unity3d', bundle.name)[1]
    maps = effects.load_maps(bundle)
    root = actors.find_transform_by_path(maps, 'chr')
    transforms = actors.walk_transforms(maps, root)[1:]
    nodes, by_id = [], {}
    for tid in transforms:
        local = actors.local_transform(maps['transforms'][tid])
        path = actors.relative_actor_path(actors.transform_path(maps, tid), 'chr')
        node = {'index': len(nodes), 'pathId': str(tid), 'name': actors.transform_name(maps, tid),
                'path': path, 'pathHash': actors.binding_hash(path),
                'parent': by_id.get(maps['parentByTransform'][tid], {}).get('index', -1),
                'isSkinBone': False, 'skinBoneIndex': -1,
                'localPosition': local['position'], 'localRotation': local['rotation'], 'localScale': local['scale']}
        nodes.append(node)
        by_id[tid] = node
    by_hash = {node['pathHash']: node for node in nodes}
    renderers = []
    for obj in maps['objects'].values():
        if obj.type.name not in ('SkinnedMeshRenderer', 'MeshRenderer'):
            continue
        renderer = obj.read()
        tid = maps['transformByGo'].get(actors.path_id(renderer.m_GameObject))
        if tid in by_id:
            renderers.append((obj, renderer, tid))
    if not renderers:
        raise ValueError('No renderable meshes below chr')
    target = OUT / cid
    target.mkdir(parents=True, exist_ok=True)
    texture_files = {}
    for obj in maps['objects'].values():
        if obj.type.name == 'Texture2D':
            texture = obj.read()
            filename = f'{cid}/texture_{obj.path_id}.png'
            texture.image.save(OUT / filename)
            texture_files[obj.path_id] = filename
    material_data = effects.extract_materials(maps, {})
    skin_bones, meshes, material_records, mesh_paths = [], [], {}, {}
    evolution_levels = set()
    for obj, renderer, tid in renderers:
        if obj.type.name == 'SkinnedMeshRenderer':
            mesh_ref = renderer.m_Mesh
        else:
            go_id = actors.path_id(renderer.m_GameObject)
            mesh_filter = next(maps['objects'][component].read() for component, typ in maps['componentsByGo'][go_id]
                               if typ == 'MeshFilter')
            mesh_ref = mesh_filter.m_Mesh
        mesh = maps['objects'][actors.path_id(mesh_ref)].read()
        weight_map = {}
        bone_refs = list(getattr(renderer, 'm_Bones', []) or [])
        if bone_refs:
            for i, ref in enumerate(bone_refs):
                node = by_id.get(actors.path_id(ref))
                if node is None:
                    continue
                weight_map[i] = len(skin_bones)
                skin_bones.append({'skinIndex': len(skin_bones), 'nodeIndex': node['index'],
                                   'pathId': node['pathId'], 'path': node['path'], 'name': node['name'],
                                   'bindPose': actors.matrix4(mesh.m_BindPose[i])})
        else:
            node = by_id[tid]
            weight_map[0] = len(skin_bones)
            skin_bones.append({'skinIndex': len(skin_bones), 'nodeIndex': node['index'],
                               'pathId': node['pathId'], 'path': node['path'], 'name': node['name'],
                               'bindPose': IDENTITY_MATRIX})
        payload = actors.mesh_to_json(mesh, weight_map)
        handler = MeshHandler(mesh)
        handler.process()
        submeshes = handler.get_triangles()
        path = by_id[tid]['path']
        level_match = re.search(r'(?:body|weapon)_level_((?:\d+_?)+)', path)
        levels = [int(n) for n in level_match[1].strip('_').split('_')] if level_match else []
        if 'body_level_' in path:
            evolution_levels.update(levels)
        for sub_index, triangles in enumerate(submeshes):
            if not triangles:
                continue
            name = path if len(submeshes) == 1 else f'{path}#{sub_index}'
            material_ref = renderer.m_Materials[min(sub_index, len(renderer.m_Materials) - 1)]
            mid = actors.path_id(material_ref)
            material = dict(material_data[mid])
            material['shaderName'] = maps['objects'][material['shaderPathId']].read().m_ParsedForm.m_Name
            material_tree = maps['objects'][mid].read()
            tex_id = next((actors.path_id(tex.m_Texture) for key, tex in material_tree.m_SavedProperties.m_TexEnvs
                           if key == '_MainTex'), 0)
            if tex_id not in texture_files:
                raise ValueError(f'External/unavailable texture in {name}: {tex_id}')
            piece = {**payload, 'name': name, 'indices': [index for tri in triangles for index in tri]}
            meshes.append({'kind': 'skinnedMesh', 'source': f'{bundle.name}/chr/{path}',
                           'smrPathId': str(obj.path_id), 'meshPathId': str(actors.path_id(mesh_ref)),
                           'texture': texture_files[tex_id], 'mesh': piece})
            material_records[name] = {'material': material, 'texture': texture_files[tex_id],
                                      'levels': levels, 'active': bool(renderer.m_Enabled), 'layer': 0,
                                      'transform': IDENTITY,
                                      'bounds': {'center': [0, 0, 0], 'extents': [1, 1, 1],
                                                 'rootBone': None, 'updateWhenOffscreen': True}}
            mesh_paths.setdefault(actors.binding_hash(path), []).append(name)
    animations, visibility, clip_counts = [], {}, {}
    for obj in maps['objects'].values():
        if obj.type.name != 'AnimationClip':
            continue
        clip, tracks = export_clip(obj.read(), by_hash, mesh_paths)
        if clip['bindings'] and clip['duration'] > 0:
            source_name = clip['name']
            clip_counts[source_name] = clip_counts.get(source_name, 0) + 1
            clip['sourceName'] = source_name
            clip['sourcePathId'] = str(obj.path_id)
            if clip_counts[source_name] > 1:
                clip['name'] = f"{source_name} ({clip_counts[source_name]})"
            animations.append(clip)
            if tracks:
                visibility[clip['name']] = tracks
    if not animations:
        raise ValueError('No supported animation bindings')
    first, *attachments = meshes
    skin = {'source': bundle.name, 'texture': first['texture'], 'mesh': first['mesh'], 'attachments': attachments,
            'skeleton': {'rootPathId': str(root), 'nodes': nodes, 'skinBones': skin_bones},
            'animations': sorted(animations, key=lambda clip: clip['name'])}
    used_shaders = {record['material']['shaderName'] for record in material_records.values()}
    payload = {'skin': skin, 'materials': material_records, 'shaders': metadata.shader_sources(maps, used_shaders),
               'textureSamplers': metadata.texture_samplers(maps, texture_files), 'visibility': visibility}
    if not payload['shaders']:
        raise ValueError('No original GLES shader programs')
    (target / 'model.json').write_text(json.dumps(effects.sanitize_json(payload), ensure_ascii=True,
                                                separators=(',', ':'), allow_nan=False), encoding='utf-8')
    thumbnail = f'{cid}/preview.png'
    return {'id': cid, 'asset': f'{cid}/model.json', 'thumbnail': thumbnail if (OUT / thumbnail).exists() else None,
            'animations': [{'name': clip['name'], 'duration': clip['duration']} for clip in skin['animations']],
            'evolutions': sorted(evolution_levels) or [1], 'noblePhantasm': cid == '100100'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ids', nargs='*')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    master = json.loads((WORK / 'Android/gamedata/unpack_master/mstSvt').read_text('utf-8'))
    names = {str(row['id']): row for row in master}
    catalog = {'characters': [], 'failures': []}
    for bundle in sorted((WORK / 'DecryptedAssetBundles').glob('Servants@*.unity3d')):
        match = re.fullmatch(r'Servants@(\d+)\.unity3d', bundle.name)
        if not match or (args.ids and match[1] not in args.ids):
            continue
        cid = match[1]
        try:
            entry = export_character(bundle)
            row = names.get(cid, {})
            entry.update({'name': row.get('name', cid), 'sourceName': row.get('name', cid),
                          'category': '从者' if row.get('type') in (1, 2) else '剧情与敌方'})
            catalog['characters'].append(entry)
            print(json.dumps({'id': cid, 'animations': len(entry['animations']), 'evolutions': entry['evolutions']}, ensure_ascii=False), flush=True)
        except Exception as error:
            catalog['failures'].append({'id': cid, 'error': str(error)})
            print(json.dumps({'id': cid, 'error': str(error)}), flush=True)
        gc.collect()
    (OUT / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'characters': len(catalog['characters']), 'failures': catalog['failures']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
