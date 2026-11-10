"""完整保边去噪候选的 alpha、边缘误差及完整单卡对照。"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image,ImageDraw

cv2.setNumThreads(2)
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
sources=json.loads((OUT/'sources.json').read_text(encoding='utf-8'))
rows=json.loads((OUT/'preprocess-full-results.json').read_text())
atlas=json.loads((ROOT/'src/assets/atlas-configs/dicethrone/ability-cards-paladin.atlas.json').read_text(encoding='utf-8'))
records=[]
for row in rows:
    name=row['asset']
    source=Image.open(sources[name]['source']['path']).convert('RGBA')
    selected=Image.open(row['file']).convert('RGBA')
    a=np.array(source);b=np.array(selected)
    if a.shape!=b.shape:
        raise ValueError('尺寸不一致')
    alpha_exact=bool(np.array_equal(a[:,:,3],b[:,:,3]))
    if not alpha_exact:
        raise ValueError('alpha 不一致')
    gray_a=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2GRAY)
    gray_b=cv2.cvtColor(b[:,:,:3],cv2.COLOR_RGB2GRAY)
    mask=cv2.dilate(cv2.Canny(gray_a,100,180),np.ones((3,3),np.uint8))!=0
    mask &= a[:,:,3]==255
    diff=gray_a[mask].astype(np.float32)-gray_b[mask].astype(np.float32)
    records.append({'asset':name,'bytes':row['bytes'],'size':source.size,'alphaExact':alpha_exact,
                    'edgeLumaRmse':round(float(np.sqrt(np.mean(diff**2))),4),
                    'protectedEdgesExactBeforeEncoding':row['edgePixelsExactBeforeEncoding']})
    del a,b,gray_a,gray_b,mask,diff
    if name=='ability-cards':
        for index in [0,17,24,32]:
            f=atlas['frames'][index]
            box=(f['x'],f['y'],f['x']+f['width'],f['y']+f['height'])
            pair=Image.new('RGBA',(f['width']*2,f['height']+30),'#eeeeee')
            draw=ImageDraw.Draw(pair)
            draw.text((8,7),f'SOURCE frame {index}',fill='black')
            draw.text((f['width']+8,7),'EDGE-PROTECTED + WEBP text-q75',fill='black')
            pair.alpha_composite(source.crop(box),(0,30))
            pair.alpha_composite(selected.crop(box),(f['width'],30))
            pair.convert('RGB').save(OUT/f'preprocessed-frame-{index}-pair.png')
    else:
        preview=selected.copy();preview.thumbnail((1600,1100),Image.Resampling.LANCZOS)
        preview.save(OUT/f'preprocessed-{name}-overview.png')
        box=(30,660,590,1060) if name=='player-board' else (15,120,575,520)
        prior=Image.open(OUT/f'full/{name}--text-q75.webp').convert('RGBA')
        comparison=Image.new('RGBA',(560*3,430),'#eeeeee');draw=ImageDraw.Draw(comparison)
        for i,(label,image) in enumerate([('SOURCE',source),('PREVIOUS',prior),('PREPROCESSED',selected)]):
            draw.text((i*560+8,7),label,fill='black')
            comparison.alpha_composite(image.crop(box),(i*560,30))
        comparison.convert('RGB').save(OUT/f'preprocessed-{name}-text-comparison.png')
    print(records[-1],flush=True)
(OUT/'preprocess-full-metrics.json').write_text(json.dumps(records,indent=2),encoding='utf-8')

raw_comparison=[]
for name,record in sources.items():
    old=Path(record['old']['path']).parent.parent/f'{name}.png'
    if old.is_file():
        with Image.open(old) as image:
            raw_comparison.append({'asset':name,'oldRawBytes':old.stat().st_size,'oldRawSize':image.size,
                                   'newRawBytes':record['source']['bytes'],
                                   'newRawSize':[record['source']['width'],record['source']['height']]})
    else:
        raw_comparison.append({'asset':name,'oldRawUnavailable':True})
(OUT/'raw-source-comparison.json').write_text(json.dumps(raw_comparison,indent=2),encoding='utf-8')
