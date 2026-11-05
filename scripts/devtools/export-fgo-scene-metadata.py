from __future__ import annotations

import importlib
import json
import math

import lz4.block
from UnityPy.export.ShaderConverter import ShaderProgram
from UnityPy.streams import EndianBinaryReader


effects = importlib.import_module('export-fgo-np100100-effects')
skin = importlib.import_module('export-fgo-saber100100-skin')
OUT = effects.PUBLIC_ROOT / 'np100100_scene.json'


def nodes(maps):
    return [
        {
            'id': str(tid),
            'parentId': str(maps['parentByTransform'][tid]) if maps['parentByTransform'].get(tid) else None,
            'path': effects.transform_path(maps, tid),
            'parent': effects.transform_path(maps, maps['parentByTransform'][tid])
            if maps['parentByTransform'].get(tid) else None,
            'transform': effects.local_transform(transform),
            'active': bool(maps['gameObjects'][effects.path_id(transform.m_GameObject)].m_IsActive),
            'layer': int(maps['gameObjects'][effects.path_id(transform.m_GameObject)].m_Layer),
        }
        for tid, transform in maps['transforms'].items()
    ]


def cameras(maps):
    result = []
    for obj in maps['objects'].values():
        if obj.type.name != 'Camera':
            continue
        tree = obj.read_typetree()
        go_id = int(tree['m_GameObject']['m_PathID'])
        result.append({
            'path': effects.transform_path(maps, maps['transformByGo'][go_id]),
            'depth': tree['m_Depth'], 'clearFlags': tree['m_ClearFlags'],
            'cullingMask': tree['m_CullingMask']['m_Bits'], 'fieldOfView': tree['field of view'],
            'near': tree['near clip plane'], 'far': tree['far clip plane'],
        })
    return sorted(result, key=lambda item: item['depth'])


def texture_samplers(maps, files):
    result = {}
    for source_id, file in files.items():
        tree = maps['objects'][source_id].read_typetree()
        settings = tree['m_TextureSettings']
        result[file] = {
            'sourceId': str(source_id), 'name': tree['m_Name'],
            'filterMode': settings['m_FilterMode'],
            'wrapU': settings['m_WrapU'], 'wrapV': settings['m_WrapV'],
            'anisotropy': settings['m_Aniso'], 'mipBias': settings['m_MipBias'],
            'mipCount': tree['m_MipCount'],
        }
    return result


def particle_modules(maps):
    result = {}
    for obj in maps['objects'].values():
        if obj.type.name != 'ParticleSystem':
            continue
        particle = obj.read()
        tree = obj.read_typetree()
        path = effects.transform_path(maps, maps['transformByGo'][effects.path_id(particle.m_GameObject)])
        force = particle.ForceModule
        limit = particle.ClampVelocityModule
        sub_emitters = []
        if tree['SubModule']['enabled']:
            for sub in tree['SubModule']['subEmitters']:
                target_id = int(sub['emitter']['m_PathID'])
                target = maps['objects'].get(target_id)
                target_path = None
                if target:
                    target_path = effects.transform_path(maps, maps['transformByGo'][effects.path_id(target.read().m_GameObject)])
                sub_emitters.append({'sourceId': str(target_id) if target else None,
                                     'path': target_path, 'type': sub['type'],
                                     'properties': sub['properties'], 'probability': sub['emitProbability']})
        result[str(obj.path_id)] = {
            'path': path,
            'enabledModules': [key for key, value in tree.items() if isinstance(value, dict) and value.get('enabled')],
            'force': {'enabled': force.enabled, 'inWorldSpace': force.inWorldSpace,
                      'randomizePerFrame': force.randomizePerFrame,
                      **{axis: effects.minmax_curve(getattr(force, axis)) for axis in ('x', 'y', 'z')}},
            'limitVelocity': {'enabled': limit.enabled, 'dampen': limit.dampen,
                              'separateAxes': limit.separateAxis, 'inWorldSpace': limit.inWorldSpace,
                              'multiplyDragByParticleSize': limit.multiplyDragByParticleSize,
                              'multiplyDragByParticleVelocity': limit.multiplyDragByParticleVelocity,
                              **{axis: effects.minmax_curve(getattr(limit, axis)) for axis in ('x', 'y', 'z', 'magnitude', 'drag')}},
            'subEmitters': sub_emitters,
        }
    return result


def shader_sources(maps, names=None):
    result = []
    for obj in maps['objects'].values():
        if obj.type.name != 'Shader':
            continue
        shader = obj.read()
        name = shader.m_ParsedForm.m_Name
        if names is not None and name not in names:
            continue
        if names is None and not (name.startswith('FGO') or name.startswith('Legacy Shaders/Particles') or name == 'Particles/Additive+1'):
            continue
        offset = shader.offsets[0][0]
        size = shader.compressedLengths[0][0]
        blob = lz4.block.decompress(
            bytes(shader.compressedBlob)[offset:offset + size],
            uncompressed_size=shader.decompressedLengths[0][0],
        )
        program = ShaderProgram(EndianBinaryReader(blob, endian='<'), shader.object_reader.version)
        variants = []
        for index, item in enumerate(program.m_SubPrograms):
            if not item.m_ProgramCode.startswith(b'#ifdef VERTEX'):
                continue
            variants.append({
                'blobIndex': index,
                'keywords': item.m_Keywords + (item.m_LocalKeywords or []),
                'code': item.m_ProgramCode.decode('utf-8').rstrip('\x00'),
            })
        parsed = obj.read_typetree()['m_ParsedForm']
        passes = []
        for source_pass in parsed['m_SubShaders'][0]['m_Passes']:
            state = source_pass['m_State']
            vertex = source_pass['progVertex']
            programs = vertex.get('m_PlayerSubPrograms') or [vertex['m_SubPrograms']]
            passes.append({
                'programs': sorted({item['m_BlobIndex'] for group in programs for item in group}),
                'state': {key: state[key] for key in ('zTest', 'zWrite', 'culling', 'rtBlend0')},
            })
        defaults = {p['m_Name']: p['m_DefValue[0]'] for p in parsed['m_PropInfo']['m_Props']
                    if p['m_Type'] in (2, 3)}
        result.append({'name': name, 'variants': variants, 'passes': passes, 'defaults': defaults})
    return result


def property_tracks(maps):
    tracks = []
    for obj in maps['objects'].values():
        if obj.type.name != 'MonoBehaviour':
            continue
        tree = obj.read_typetree()
        script_id = int(tree.get('m_Script', {}).get('m_PathID', 0))
        if effects.mono_script_name(maps, script_id) != 'USTimelineProperty':
            continue
        go_id = int(tree.get('m_GameObject', {}).get('m_PathID', 0))
        path = effects.transform_path(maps, maps['transformByGo'][go_id])
        target = next((p.removeprefix('Timelines for ') for p in path.split('/') if p.startswith('Timelines for ')), '')
        for reference in tree.get('propertyList', []):
            item = maps['objects'][int(reference['m_PathID'])].read_typetree()
            curves = []
            for ref in item.get('curves', []):
                raw = maps['objects'][int(ref['m_PathID'])].read_typetree().get('animationCurve', {})
                curves.append([{
                    'time': float(key['time']), 'value': float(key['value']),
                    'inSlope': float(key['inSlope']) if math.isfinite(key['inSlope']) else 0.0,
                    'outSlope': float(key['outSlope']) if math.isfinite(key['outSlope']) else 0.0,
                    'stepIn': math.isinf(key['inSlope']),
                    'stepOut': math.isinf(key['outSlope']),
                } for key in raw.get('m_Curve', [])])
            base = item.get('baseVector3', {})
            tracks.append({
                'target': target, 'component': item['componentType'], 'property': item['propertyName'],
                'base': [base.get('x', 0), base.get('y', 0), base.get('z', 0)]
                if len(curves) == 3 else item.get('baseFloat', 0),
                'curves': curves,
            })
    return tracks


def targets(maps):
    result = {}
    for obj in maps['objects'].values():
        if obj.type.name != 'MonoBehaviour':
            continue
        tree = obj.read_typetree()
        if 'affectedObjectPath' not in tree:
            continue
        go_id = int(tree.get('m_GameObject', {}).get('m_PathID', 0))
        name = effects.go_name(maps, go_id).removeprefix('Timelines for ')
        result[name] = tree['affectedObjectPath']
    return result


def mesh_materials(maps, root):
    materials = effects.extract_materials(maps, {})
    result = {}
    for go_id, components in maps['componentsByGo'].items():
        path = effects.transform_path(maps, maps['transformByGo'][go_id])
        if not path.startswith(f'{root}/'):
            continue
        for component_id, typ in components:
            if typ != 'SkinnedMeshRenderer':
                continue
            renderer_object = maps['objects'][component_id]
            renderer = renderer_object.read()
            renderer_tree = renderer_object.read_typetree()
            bounds = renderer_tree['m_AABB']
            root_bone = int(renderer_tree['m_RootBone']['m_PathID'])
            mid = effects.path_id(renderer.m_Materials[0])
            material = materials[mid]
            material['shaderName'] = maps['objects'][material['shaderPathId']].read().m_ParsedForm.m_Name
            result[path.split('/')[-1]] = {
                'material': material,
                'active': bool(maps['gameObjects'][go_id].m_IsActive),
                'layer': int(maps['gameObjects'][go_id].m_Layer),
                'transform': effects.local_transform(maps['transforms'][maps['transformByGo'][go_id]]),
                'bounds': {
                    'center': [bounds['m_Center'][axis] for axis in ('x', 'y', 'z')],
                    'extents': [bounds['m_Extent'][axis] for axis in ('x', 'y', 'z')],
                    'rootBone': effects.transform_path(maps, root_bone).removeprefix(f'{root}/') if root_bone else None,
                    'updateWhenOffscreen': renderer_tree['m_UpdateWhenOffscreen'],
                },
            }
    return result


def cutin_clips(maps):
    clips = []
    for obj in maps['objects'].values():
        if obj.type.name != 'AnimationClip':
            continue
        clip = obj.read()
        offset = 0
        bindings = []
        for binding in clip.m_ClipBindingConstant.genericBindings:
            count = 3 if binding.typeID == 4 else 1
            bindings.append({'attribute': int(binding.attribute), 'typeId': int(binding.typeID), 'scalarOffset': offset})
            offset += count
        data = clip.m_MuscleClip.m_Clip.data
        clips.append({
            'name': clip.m_Name, 'duration': clip.m_MuscleClip.m_StopTime, 'sampleRate': clip.m_SampleRate,
            'scalarCount': offset, 'bindings': bindings,
            'frames': effects.parse_streamed_frames(data.m_StreamedClip),
            'constants': [[data.m_StreamedClip.curveCount + i, value] for i, value in enumerate(data.m_ConstantClip.data)],
        })
    return clips


def background_90001(maps):
    # The reference capture uses the dark navy variant from this multi-prefab bundle.
    root = 'bg18'
    texture_files = {
        3324417657199981400: 'bg_90001_back.png',
        2514970003048502816: 'bg_90001_front.png',
    }
    # This bundle references unity_builtin_extra, absent from the standalone export.
    materials = effects.extract_materials(maps, {}, resolve_render_queue=False)
    mesh_records = {}
    renderers = []
    for go_id, components in maps['componentsByGo'].items():
        path = effects.transform_path(maps, maps['transformByGo'][go_id])
        if not path.startswith(f'{root}/scroll_bg_back/'):
            continue
        mesh_ref = next((item for item, typ in components if typ == 'MeshFilter'), None)
        renderer_ref = next((item for item, typ in components if typ == 'MeshRenderer'), None)
        if mesh_ref is None or renderer_ref is None:
            continue
        mesh_id = effects.path_id(maps['objects'][mesh_ref].read().m_Mesh)
        material_id = effects.path_id(maps['objects'][renderer_ref].read().m_Materials[0])
        material = materials[material_id]
        components_by_script = {}
        for component_id, typ in components:
            if typ != 'MonoBehaviour':
                continue
            tree = maps['objects'][component_id].read_typetree()
            components_by_script[effects.mono_script_name(maps, int(tree['m_Script']['m_PathID']))] = tree
        animation = components_by_script.get('SimpleAnimation', {})
        clip_id = int(animation.get('m_Clip', {}).get('m_PathID', 0))
        scroll_speed = 0.0
        if clip_id:
            clip = maps['objects'][clip_id].read()
            frames = effects.parse_streamed_frames(clip.m_MuscleClip.m_Clip.data.m_StreamedClip)
            scroll_speed = next((key[1][2] for frame in frames if frame['time'] == 0
                                 for key in frame['keys'] if key[0] == 0), 0.0)
        if mesh_id not in mesh_records:
            mesh = effects.mesh_to_json(maps['objects'][mesh_id].read())
            mesh['vertices'] = [[-v[0], v[1], v[2]] for v in mesh['vertices']]
            mesh['indices'] = [mesh['indices'][i + j] for i in range(0, len(mesh['indices']), 3) for j in (2, 1, 0)]
            mesh_records[mesh_id] = mesh
        renderers.append({
            'path': path, 'meshId': str(mesh_id),
            'texture': texture_files[material['texturePathId']],
            'material': material['name'],
            'color': components_by_script.get('changeVColor', {}).get('color',
                        {'r': 1, 'g': 1, 'b': 1, 'a': 1}),
            'tintColor': material.get('tintColor'),
            'textureOffset': material['mainTextureTransform']['offset'],
            'scrollSpeed': scroll_speed,
        })
    return {
        'nodes': [node for node in nodes(maps) if node['path'] == root or node['path'].startswith(f'{root}/')],
        'meshes': {str(key): value for key, value in mesh_records.items()},
        'renderers': renderers,
    }


def main():
    np_maps = effects.load_maps(effects.EFFECT_BUNDLE)
    servant_maps = effects.load_maps(skin.SERVANT_BUNDLE)
    sequence_maps = effects.load_maps(effects.SEQUENCE_BUNDLE)
    common_maps = effects.load_maps(effects.BATTLE_COMMON_BUNDLE)
    cutin_maps = effects.load_maps(effects.WORK_ROOT / 'DecryptedNamed' / 'NoblePhantasm@CutIns.unity3d')
    background_maps = effects.load_maps(effects.WORK_ROOT / 'DecryptedAssetBundles' / 'Bg@90001.unity3d')
    shaders = {item['name']: item for maps in [np_maps, servant_maps] for item in shader_sources(maps)}
    texture_meta = {item['pathId']: item for item in json.loads(effects.OUT_JSON.read_text('utf-8'))['textures']}
    servant_texture = next(obj.path_id for obj in servant_maps['objects'].values()
                           if obj.type.name == 'Texture2D' and obj.read().m_Name == '100100')
    samplers = texture_samplers(np_maps, {key: value['file'] for key, value in texture_meta.items()})
    samplers.update(texture_samplers(servant_maps, {servant_texture: 'servant_100100_atlas.png'}))
    materials = effects.extract_materials(np_maps, texture_meta)
    for material in materials.values():
        material['shaderName'] = np_maps['objects'][material['shaderPathId']].read().m_ParsedForm.m_Name
    payload = {
        'sourceBundle': effects.EFFECT_BUNDLE.name,
        'textureSamplers': samplers,
        'nodes': nodes(np_maps), 'cameraNodes': nodes(common_maps), 'cameras': cameras(common_maps),
        'particleModules': particle_modules(np_maps),
        'propertyTracks': property_tracks(sequence_maps),
        'targets': targets(sequence_maps),
        'materials': {str(key): value for key, value in materials.items()},
        'shaders': list(shaders.values()),
        'actorMaterials': {root: mesh_materials(np_maps, root) for root in ['chr_100100', 'chr_100101']},
        'servantMaterials': mesh_materials(servant_maps, 'chr'),
        'cutIn': {'nodes': nodes(cutin_maps), 'clips': cutin_clips(cutin_maps)},
        'background90001': background_90001(background_maps),
    }
    OUT.write_text(json.dumps(effects.sanitize_json(payload), separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'out': str(OUT), 'nodes': len(payload['nodes']), 'tracks': len(payload['propertyTracks']),
                      'shaders': [(s['name'], len(s['variants'])) for s in payload['shaders']]}, indent=2))


if __name__ == '__main__':
    main()
