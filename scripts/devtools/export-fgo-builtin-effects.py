from __future__ import annotations

import importlib
import json
from pathlib import Path

import UnityPy
from UnityPy.classes import PPtr

effects = importlib.import_module('export-fgo-np100100-effects')
scene = importlib.import_module('export-fgo-scene-metadata')
SOURCE = effects.WORK_ROOT / 'ClientApk' / '2.129.0-UnityData' / '9742afeaad7f75c469e16847f54968c9'
OUT = effects.PUBLIC_ROOT / 'np100100_builtin.json'


def reference(reader):
    return f'apk:{reader.assets_file.name}:{reader.path_id}'


def main():
    maps = effects.load_maps(SOURCE, environment=UnityPy.load(str(SOURCE.parent)))
    source_maps = effects.load_maps(effects.EFFECT_BUNDLE)
    renderer = next(obj.read() for obj in maps['objects'].values() if obj.type.name == 'ParticleSystemRenderer')
    material_reader = renderer.m_Materials[0].deref()
    material_object = material_reader.read()
    texture = material_object.m_SavedProperties.m_TexEnvs[0][1].m_Texture.read()
    texture_file = f'apk/{texture.m_Name}.png'
    target = effects.PUBLIC_ROOT / texture_file
    target.parent.mkdir(exist_ok=True)
    texture.image.save(target)
    texture_meta = {'pathId': texture.object_reader.path_id, 'name': texture.m_Name,
                    'file': texture_file, 'width': texture.m_Width, 'height': texture.m_Height}
    material = effects.extract_materials({'objects': {material_reader.path_id: material_reader}},
                                        {texture.object_reader.path_id: texture_meta})[material_reader.path_id]
    shader_reader = material_object.m_Shader.deref()
    material['shaderName'] = shader_reader.read().m_ParsedForm.m_Name
    roots = effects.extract_roots(maps, {material_reader.path_id: material})
    if [root['name'] for root in roots] != ['Start_nf']:
        raise ValueError('Unexpected built-in effect roots')
    meshes = {}
    for root in roots:
        for particle in root['particleSystems']:
            particle['sourceId'] = reference(maps['objects'][int(particle['sourceId'])])
            particle['transformId'] = reference(maps['objects'][int(particle['transformId'])])
            particle_renderer = maps['objects'][particle['rendererPathId']].read()
            mesh_reader = particle_renderer.m_Mesh.deref()
            mesh_key = reference(mesh_reader)
            particle['renderer']['meshPathIds'] = [mesh_key]
            meshes[mesh_key] = {'pathId': mesh_key, 'name': mesh_reader.read().m_Name,
                                **effects.mesh_to_json(mesh_reader.read())}

    nodes = scene.nodes(maps)
    for node in nodes:
        node['id'] = reference(maps['objects'][int(node['id'])])
        if node['parentId']:
            node['parentId'] = reference(maps['objects'][int(node['parentId'])])
    modules = scene.particle_modules(maps)
    modules = {reference(maps['objects'][int(key)]): value for key, value in modules.items()}
    animations = []
    scrolls = []
    for reader in maps['objects'].values():
        if reader.type.name != 'MonoBehaviour':
            continue
        script_name = reader.read(check_read=False).m_Script.read().m_ClassName
        schema = next(obj for obj in source_maps['objects'].values() if obj.type.name == 'MonoBehaviour'
                      and effects.mono_script_name(source_maps, effects.path_id(obj.read().m_Script)) == script_name)
        tree = reader.read_typetree(nodes=schema.serialized_type.node)
        transform_id = maps['transformByGo'][int(tree['m_GameObject']['m_PathID'])]
        owner = {'path': effects.transform_path(maps, transform_id),
                 'transformId': reference(maps['objects'][transform_id])}
        if script_name == 'UVScroll':
            scrolls.append({**owner, 'offset': [tree['m_Offset']['x'], tree['m_Offset']['y']]})
        elif script_name == 'SimpleAnimation':
            clip_reference = tree['m_Clip']
            clip_reader = PPtr(m_FileID=clip_reference['m_FileID'], m_PathID=clip_reference['m_PathID'],
                               assetsfile=reader.assets_file).deref()
            clip = clip_reader.read()
            animations.append({**owner, 'playAutomatically': bool(tree['m_PlayAutomatically']),
                               'wrapMode': tree['m_WrapMode'], 'clipName': clip.m_Name,
                               'clips': [effects.clip_to_effect_animation(clip_reader.path_id, clip,
                                          effects.transform_binding_paths(maps))]})
        else:
            raise ValueError(f'Unsupported built-in effect component: {script_name}')

    sampler = scene.texture_samplers({'objects': {texture.object_reader.path_id: texture.object_reader}},
                                     {texture.object_reader.path_id: texture_file})
    payload = {
        'source': {'package': 'com.bilibili.fgo.vivo', 'version': '2.129.0', 'file': SOURCE.name},
        'effects': {'roots': roots, 'meshes': list(meshes.values()), 'textures': [texture_meta],
                    'simpleAnimations': animations, 'uvScrolls': scrolls},
        'scene': {'nodes': nodes, 'particleModules': modules,
                  'materials': {reference(material_reader): material},
                  'shaders': scene.shader_sources({'objects': {shader_reader.path_id: shader_reader}}),
                  'textureSamplers': sampler},
    }
    OUT.write_text(json.dumps(effects.sanitize_json(payload), separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'out': str(OUT), 'particles': sum(len(root['particleSystems']) for root in roots),
                      'meshes': len(meshes), 'animations': len(animations), 'uvScrolls': len(scrolls)}, indent=2))


if __name__ == '__main__':
    main()
