"""原尺寸 RGB/alpha 误差及高反差边界；SSIM 不等同文字识别率。"""
from pathlib import Path
import json, cv2
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity

OUT=Path(__file__).resolve().parent
OLD=OUT.parents[1]/'圣骑士素材压缩/20261015T122010Z'
cv2.setNumThreads(2)
source=np.array(Image.open(OLD/'sample-source.png').convert('RGBA'))
valid=source[:,:,3]==255
gray=cv2.cvtColor(source[:,:,:3],cv2.COLOR_RGB2GRAY)
edge=(cv2.dilate(cv2.Canny(gray,100,180),np.ones((3,3),np.uint8))!=0)&valid
regions={'card0':(90,270,650,730),'card12':(826,320,1386,500),
         'card32':(1562,810,2122,1000),'board':(2218,60,2778,490),'tip':(2959,120,3519,520)}
cached={r['id']:r for r in json.loads((OUT/'metrics.json').read_text(encoding='utf-8'))} if (OUT/'metrics.json').exists() else {}
rows=json.loads((OUT/'native-results.json').read_text(encoding='utf-8'))
rows+=json.loads((OUT/'alternative-results.json').read_text(encoding='utf-8'))
for name in ['default-q95','default-q90','default-q85','default-q80','default-q75','text-q85','text-q80','text-q75']:
    file=OLD/f'pilot/sample--{name}.webp'; rows.append({'id':name,'file':str(file),'bytes':file.stat().st_size})
file=OLD/'preprocess-pilot/edge-protected-09.webp'
rows.append({'id':'current-online-sample','file':str(file),'bytes':file.stat().st_size})
for row in rows:
    if row['id'] in cached and cached[row['id']]['bytes']==row['bytes']:
        row['metrics']=cached[row['id']]['metrics']
        continue
    dst=np.array(Image.open(row['file']).convert('RGBA'))
    delta=np.abs(source[:,:,:3].astype('int16')-dst[:,:,:3].astype('int16'))
    err=delta.max(axis=2)[valid]
    lum=cv2.cvtColor(dst[:,:,:3],cv2.COLOR_RGB2GRAY)
    ldiff=gray.astype('float32')-lum.astype('float32')
    ssim, smap=structural_similarity(gray,lum,data_range=255,full=True)
    metric={'alphaExact':bool(np.array_equal(source[:,:,3],dst[:,:,3])),
       'alphaMaxError':int(np.abs(source[:,:,3].astype('int16')-dst[:,:,3].astype('int16')).max()),
       'opaqueRgbMaxError':int(err.max()),'opaqueRgbP99MaxChannelError':float(np.percentile(err,99)),
       'opaqueRgbMae':round(float(delta[valid].mean()),4),
       'opaqueLumaSsim':round(float(smap[valid].mean()),6),
       'edgeLumaRmse':round(float(np.mean(ldiff[edge]**2)**.5),4),
       'opaqueFractionMaxChannelOver8':round(float((err>8).mean()),6),
       'textRegions':{}}
    for name,(x1,y1,x2,y2) in regions.items():
        mask=edge[y1:y2,x1:x2]
        ld=ldiff[y1:y2,x1:x2]
        metric['textRegions'][name]={'edgeLumaRmse':round(float(np.mean(ld[mask]**2)**.5),4),
            'lumaSsim':round(float(smap[y1:y2,x1:x2].mean()),6)}
    if row['id'].startswith('jpeg'):
        metric['note']='JPEG alpha 不存在；如外置原始 alpha PNG 可恢复 alpha，体积需加 alphaBytes，且需要改加载方案。'
    row['metrics']=metric
    print(row['id'],row['bytes'],metric['alphaExact'],metric['opaqueLumaSsim'],metric['edgeLumaRmse'],metric['opaqueRgbMaxError'],flush=True)
    (OUT/'metrics.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'metrics.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
