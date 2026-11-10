"""压缩前的确定性扫描噪声处理实验；只处理独立样本，不写正式素材。"""
from pathlib import Path
import json
import sys
import cv2
import numpy as np
from PIL import Image

cv2.setNumThreads(2)
OUT=Path(__file__).resolve().parent
phase=sys.argv[1] if len(sys.argv)>1 else 'pilot'
if phase not in ['pilot','full']:
    raise ValueError('阶段只能为 pilot/full')
DEST=OUT/f'preprocess-{phase}'
DEST.mkdir(exist_ok=True)
inputs=[('sample',OUT/'sample-source.png')] if phase=='pilot' else [(k,Path(v['source']['path'])) for k,v in json.loads((OUT/'sources.json').read_text(encoding='utf-8')).items()]
records=[]
profiles=[('gaussian-04','gaussian',0.4),('gaussian-06','gaussian',0.6),
                           ('edge-protected-06','edge',0.6),('edge-protected-09','edge',0.9),
                           ('bilateral-10','bilateral',10),('bilateral-18','bilateral',18)]
if phase=='full':
    profiles=[p for p in profiles if p[0]=='edge-protected-09']
for asset,input_path in inputs:
    source=np.array(Image.open(input_path).convert('RGBA'))
    rgb=source[:,:,:3]
    gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    edge=cv2.Canny(gray,90,180)
    edge=cv2.dilate(edge,np.ones((3,3),np.uint8))!=0
    alpha_border=cv2.dilate((source[:,:,3]!=255).astype('uint8'),np.ones((5,5),np.uint8))!=0
    protect=edge|alpha_border
    for name,method,amount in profiles:
        if method=='bilateral':
            filtered=cv2.bilateralFilter(rgb,5,amount,1.2)
        else:
            filtered=cv2.GaussianBlur(rgb,(0,0),amount)
        if method=='edge':
            filtered[protect]=rgb[protect]
        else:
            filtered[alpha_border]=rgb[alpha_border]
        candidate=source.copy()
        candidate[:,:,:3]=filtered
        target=DEST/f'{name if phase=="pilot" else asset}.png'
        Image.fromarray(candidate).save(target)
        records.append({'id':name,'asset':asset,'file':str(target),'alphaExact':bool(np.array_equal(candidate[:,:,3],source[:,:,3])),
                        'edgePixelsExactBeforeEncoding':bool(np.array_equal(candidate[:,:,:3][edge],rgb[edge])),
                        'changedOpaqueRgbPixels':int(np.any(filtered!=rgb,axis=2).sum())})
        print(asset,name,flush=True)
(OUT/f'preprocess-{phase}-inputs.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
