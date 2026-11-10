from pathlib import Path
import importlib.util,json,shutil,hashlib
from PIL import Image
import numpy as np
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
spec=importlib.util.spec_from_file_location('paladin_prepare',ROOT/'scripts/assets/prepare_dicethrone_paladin_preview.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
locked=json.loads((OUT/'locked-mapping.json').read_text(encoding='utf-8'))
assert module.SOURCE_BY_FRAME==locked['sourceByFrame']
generated=OUT/'candidate';generated.mkdir(exist_ok=True)
before=OUT/'before';before.mkdir(exist_ok=True)
paths=[module.RUNTIME/'compressed/ability-cards.webp',module.MANIFEST,module.ROOT_MANIFEST]
receipt=[]
for path in paths:
    saved=before/path.relative_to(ROOT);saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,saved)
    receipt.append({'path':str(path),'backup':str(saved),'sha256':module.sha256(path),'bytes':path.stat().st_size})
(OUT/'before-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
png=generated/'ability-cards.png';config=module.build_atlas(module.DEFAULT_SOURCE,png)
current=json.loads(module.ATLAS_CONFIG.read_text(encoding='utf-8'))
assert config==current,'图序修复不得改变裁图坐标/尺寸'
atlas=np.array(Image.open(png).convert('RGBA'))
checks=[]
for card,frame in zip(locked['cards'],config['frames']):
    x,y,w,h=(frame[key] for key in ['x','y','width','height'])
    crop=atlas[y:y+h,x:x+w];src=np.array(Image.open(module.source_card_path(module.DEFAULT_SOURCE,card['sourceNumber'])).convert('RGBA'))
    visible=src[:,:,3]>0
    alpha_equal=bool(np.array_equal(src[:,:,3],crop[:,:,3]))
    rgb_equal=bool(np.array_equal(src[:,:,:3][visible],crop[:,:,:3][visible]))
    assert alpha_equal and rgb_equal,f"原始图集帧{card['index']}与已核对源图不一致"
    checks.append({'index':card['index'],'cardId':card['cardId'],'sourceNumber':card['sourceNumber'],'sourceSha256':module.sha256(module.source_card_path(module.DEFAULT_SOURCE,card['sourceNumber'])),
                   'rawVisibleRgbExact':rgb_equal,'rawAlphaExact':alpha_equal})
webp=generated/'ability-cards.webp';module.write_webp(png,webp)
with Image.open(webp) as compressed: assert list(compressed.size)==[config['imageW'],config['imageH']]
result={'sourceByFrame':module.SOURCE_BY_FRAME,'configUnchanged':True,'checks':checks,'pngSha256':module.sha256(png),
        'webp':str(webp),'webpSha256':module.sha256(webp),'bytes':webp.stat().st_size,'dimensions':[config['imageW'],config['imageH']]}
(OUT/'candidate-receipt.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({key:value for key,value in result.items() if key not in ['checks','sourceByFrame']},ensure_ascii=False,indent=2))
