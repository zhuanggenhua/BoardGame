"""只生成核对裁图与登记，不修改正式图集。"""
from pathlib import Path
from PIL import Image
import json,hashlib,ast
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
def digest(file): return hashlib.sha256(Path(file).read_bytes()).hexdigest()
original=json.loads((ROOT/'evidence/圣骑士素材压缩/20261015T122010Z/sources.json').read_text(encoding='utf-8'))['ability-cards']['source']['path']
runtime=ROOT/'public/assets/i18n/zh-CN/dicethrone/images/paladin/compressed/ability-cards.webp'
config_path=ROOT/'src/assets/atlas-configs/dicethrone/ability-cards-paladin.atlas.json'
config=json.loads(config_path.read_text(encoding='utf-8'))
tree=ast.parse((ROOT/'scripts/assets/prepare_dicethrone_paladin_preview.py').read_text(encoding='utf-8'))
order=next(ast.literal_eval(node.value) for node in tree.body if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SOURCE_BY_FRAME' for t in node.targets))
cards=json.loads((OUT/'runtime-cards.json').read_text(encoding='utf-8'))
by_index={c['index']:c for c in cards}
(OUT/'crops').mkdir(exist_ok=True)
rows=[]
source_image=Image.open(original).convert('RGBA');runtime_image=Image.open(runtime).convert('RGBA')
for index,frame in enumerate(config['frames']):
    x,y,w,h=(frame[key] for key in ['x','y','width','height']);box=(x,y,x+w,y+h)
    source_crop=OUT/f'crops/frame-{index:02d}-source.png'
    runtime_crop=OUT/f'crops/frame-{index:02d}-runtime.png'
    source_image.crop(box).save(source_crop);runtime_image.crop(box).save(runtime_crop)
    rows.append({'frame':index,'sourceNumber':order[index],'sourceCrop':str(source_crop),'sourceCropSha256':digest(source_crop),
       'runtimeCrop':str(runtime_crop),'runtimeCropSha256':digest(runtime_crop),'expected':by_index[index],
       'status':'pending','disposition':'reference','usage':'卡图语义与当前previewRef/效果逐卡比对'})
receipt={'original':original,'originalSha256':digest(original),'runtime':str(runtime),'runtimeSha256':digest(runtime),
         'atlasConfig':str(config_path),'atlasConfigSha256':digest(config_path),'sourceByFrame':order,'frames':rows}
(OUT/'inventory.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print('登记完整单卡33张，原图与当前正式WebP各一套。')
