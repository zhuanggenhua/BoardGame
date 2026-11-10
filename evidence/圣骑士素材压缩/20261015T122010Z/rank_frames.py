"""33 帧逐帧结构检查，并输出误差较高的完整单卡对照。"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw
from skimage.metrics import structural_similarity

cv2.setNumThreads(2)
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
sources=json.loads((OUT/'sources.json').read_text(encoding='utf-8'))
atlas=json.loads((ROOT/'src/assets/atlas-configs/dicethrone/ability-cards-paladin.atlas.json').read_text(encoding='utf-8'))
original=Image.open(sources['ability-cards']['source']['path']).convert('RGBA')
selected=Image.open(OUT/'full/ability-cards--text-q75.webp').convert('RGBA')
items=[]
for index,frame in enumerate(atlas['frames']):
    box=(frame['x'],frame['y'],frame['x']+frame['width'],frame['y']+frame['height'])
    a=np.array(original.crop(box));b=np.array(selected.crop(box))
    a_gray=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2GRAY)
    b_gray=cv2.cvtColor(b[:,:,:3],cv2.COLOR_RGB2GRAY)
    _,ssim_map=structural_similarity(a_gray,b_gray,data_range=255,full=True)
    valid=a[:,:,3]==255
    items.append({'index':index,'width':frame['width'],'height':frame['height'],
                  'alphaExact':bool(np.array_equal(a[:,:,3],b[:,:,3])),
                  'lumaSsimOpaque':round(float(ssim_map[valid].mean()),6)})
items.sort(key=lambda r:r['lumaSsimOpaque'])
(OUT/'frame-metrics.json').write_text(json.dumps({'frames':items,'total':len(items)},indent=2),encoding='utf-8')
for row in items[:3]:
    index=row['index'];frame=atlas['frames'][index]
    box=(frame['x'],frame['y'],frame['x']+frame['width'],frame['y']+frame['height'])
    pair=Image.new('RGBA',(frame['width']*2,frame['height']+30),'#eeeeee')
    draw=ImageDraw.Draw(pair)
    draw.text((10,8),f'SOURCE frame {index}',fill='black')
    draw.text((frame['width']+10,8),'SELECTED text-q75',fill='black')
    pair.alpha_composite(original.crop(box),(0,30))
    pair.alpha_composite(selected.crop(box),(frame['width'],30))
    pair.convert('RGB').save(OUT/f'worst-frame-{index}-pair.png')
for name in ['player-board','tip']:
    image=Image.open(OUT/f'full/{name}--text-q75.webp')
    image.thumbnail((1600,1100),Image.Resampling.LANCZOS)
    image.save(OUT/f'selected-{name}-overview.png')
print(json.dumps({'frames':len(items),'allAlphaExact':all(r['alphaExact'] for r in items),'worst':items[:3]},indent=2))
