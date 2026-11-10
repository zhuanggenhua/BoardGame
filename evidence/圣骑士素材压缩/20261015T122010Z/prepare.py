"""只为当前压缩比较生成轻量预览，不修改正式素材。"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
RUNTIME = ROOT / 'public/assets/i18n/zh-CN/dicethrone/images/paladin'
BACKUP = ROOT.parent / 'gameasset/王权骰铸（全26中文角色）/圣骑士预览备份/20261013T133935Z'
SOURCES = {
    'ability-cards': BACKUP / 'generated/ability-cards.png',
    'player-board': RUNTIME / 'player-board.png',
    'tip': RUNTIME / 'tip.png',
}
OLD = BACKUP / 'original/public/assets/i18n/zh-CN/dicethrone/images/paladin/compressed'

def metadata(path):
    with Image.open(path) as image:
        return {'path': str(path), 'bytes': path.stat().st_size,
                'width': image.width, 'height': image.height, 'mode': image.mode,
                'alphaExtrema': image.getchannel('A').getextrema() if 'A' in image.getbands() else None,
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}

records = {name: {'source': metadata(path), 'baseline': metadata(RUNTIME / f'compressed/{name}.webp'),
                  'old': metadata(OLD / f'{name}.webp')}
           for name, path in SOURCES.items()}
(OUT / 'sources.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')

for name, path in SOURCES.items():
    with Image.open(path) as image:
        if name == 'ability-cards':
            config = json.loads((ROOT / 'src/assets/atlas-configs/dicethrone/ability-cards-paladin.atlas.json').read_text(encoding='utf-8'))
            for index in (0, 12, 32):
                frame = config['frames'][index]
                image.crop((frame['x'], frame['y'], frame['x'] + frame['width'], frame['y'] + frame['height'])).save(OUT / f'source-card-{index}.png')
        else:
            preview = image.copy()
            preview.thumbnail((1600, 1100), Image.Resampling.LANCZOS)
            preview.save(OUT / f'source-{name}-overview.png')

print(json.dumps(records, ensure_ascii=False, indent=2))
