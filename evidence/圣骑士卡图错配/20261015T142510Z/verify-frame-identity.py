"""用已逐张读过的33张原图作图像身份比对；保留修复前5处红证据。"""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,sys
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
locked=json.loads((OUT/'locked-mapping.json').read_text(encoding='utf-8'))
inventory=json.loads((OUT/'inventory.json').read_text(encoding='utf-8'))
config=json.loads((ROOT/'src/assets/atlas-configs/dicethrone/ability-cards-paladin.atlas.json').read_text(encoding='utf-8'))
sources={row['sourceNumber']:row for row in inventory['frames']}
def fingerprint(image):
    image=image.convert('RGBA');bg=Image.new('RGBA',image.size,'#777777');bg.alpha_composite(image)
    return np.array(bg.convert('RGB').resize((96,154),Image.Resampling.LANCZOS)).astype('float32')
numbers=sorted(sources)
refs=np.stack([fingerprint(Image.open(sources[n]['sourceCrop'])) for n in numbers])
mode=sys.argv[1]
before=json.loads((OUT/'before-receipt.json').read_text(encoding='utf-8'))[0]['backup']
path=before if mode=='before' else inventory['runtime']
image=Image.open(path).convert('RGBA');rows=[]
for expected,frame in zip(locked['cards'],config['frames']):
    x,y,w,h=(frame[key] for key in ['x','y','width','height']);crop=image.crop((x,y,x+w,y+h))
    distances=np.mean((refs-fingerprint(crop))**2,axis=(1,2,3))
    order=np.argsort(distances);closest=numbers[int(order[0])]
    rows.append({'frame':expected['index'],'cardId':expected['cardId'],'expectedSourceNumber':expected['sourceNumber'],
       'closestSourceNumber':closest,'closestMse':float(distances[order[0]]),'runnerUpMse':float(distances[order[1]]),
       'matches':closest==expected['sourceNumber']})
result={'mode':mode,'method':'原生整卡RGB缩至96x154后与33个已人工核对源图比对；不替代原图读字','rows':rows,'mismatchFrames':[r['frame'] for r in rows if not r['matches']]}
(OUT/f'frame-identity-{mode}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'mode':mode,'mismatchFrames':result['mismatchFrames'],'matched':sum(r['matches'] for r in rows)},ensure_ascii=False))
if mode=='before':
    assert result['mismatchFrames']==[8,10,20,21,22]
    raise SystemExit(1)
assert not result['mismatchFrames']
