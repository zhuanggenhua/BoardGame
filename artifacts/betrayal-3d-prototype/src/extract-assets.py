import json
import re
import sys
from pathlib import Path

import UnityPy
from PIL import Image

source = Path(sys.argv[1])
output = Path(__file__).resolve().parents[1] / 'public' / 'betrayal-3d'
output.mkdir(parents=True, exist_ok=True)
tts = json.loads((source / 'Workshop' / '3420850553.json').read_text(encoding='utf-8-sig'))

def cached(folder, url):
    stem = re.sub(r'[^a-zA-Z0-9]', '', url)
    return next((source / folder).glob(stem + '.*'))

characters = []
texture_suffixes = {
    '_diffuse': ('texture', '{index}.webp', 90),
    '_normal': ('normal', '{index}-normal.webp', 92),
    '_metal': ('metalness', '{index}-metal.webp', 92),
    '_occlusion': ('occlusion', '{index}-occlusion.webp', 92),
    '_emissive': ('emissive', '{index}-emissive.webp', 92),
}
for item in tts['ObjectStates']:
    bundle = item.get('CustomAssetbundle', {})
    if '1849302001' not in bundle.get('AssetbundleURL', ''):
        continue
    index = len(characters)
    character = {
        'name': item['Nickname'],
        'mesh': f'character-{index}.obj',
        'texture': f'character-{index}.webp',
    }
    env = UnityPy.load(str(cached('Assetbundles', bundle['AssetbundleURL'])))
    mesh = next(obj.read() for obj in env.objects if obj.type.name == 'Mesh')
    (output / f'character-{index}.obj').write_text(mesh.export(), encoding='utf-8')
    for obj in env.objects:
        if obj.type.name != 'Texture2D':
            continue
        texture = obj.read()
        for suffix, (field, pattern, quality) in texture_suffixes.items():
            if texture.m_Name.endswith(suffix):
                filename = f'character-{pattern.format(index=index)}'
                texture.image.convert('RGB').resize((1024, 1024)).save(output / filename, quality=quality)
                character[field] = filename
    transform = item.get('Transform', {})
    character.update({
        'rotationY': float(transform.get('rotY', 0)),
        'scale': float(transform.get('scaleY', 1)),
    })
    characters.append(character)

deck = next(o for o in tts['ObjectStates'] if o['Name'] == 'Deck' and len(o.get('ContainedObjects', [])) == 42)
atlas = Image.open(cached('Images', next(iter(deck['CustomDeck'].values()))['FaceURL']))
for index in range(42):
    col, row = index % 7, index // 7
    box = (col * atlas.width // 7, row * atlas.height // 6, (col + 1) * atlas.width // 7, (row + 1) * atlas.height // 6)
    atlas.crop(box).resize((768, 768)).convert('RGB').save(output / f'room-{index}.webp', quality=92)
(output / 'characters.json').write_text(json.dumps(characters, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Exported {len(characters)} original character meshes/textures and 42 room tiles to {output}')
