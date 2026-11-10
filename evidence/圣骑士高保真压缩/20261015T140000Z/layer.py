"""两层合成试验：高反差边界像素无损，背景使用当前 WebP。"""
from benchmark import OUT, OLD, SOURCE, encode
from PIL import Image
import numpy as np, cv2, json
src=np.array(Image.open(SOURCE).convert('RGBA'))
mask=cv2.dilate(cv2.Canny(cv2.cvtColor(src[:,:,:3],cv2.COLOR_RGB2GRAY),90,180),np.ones((3,3),np.uint8))!=0
mask &= src[:,:,3]==255
layer=np.zeros_like(src);layer[mask]=src[mask]
png=OUT/'edge-overlay.png';Image.fromarray(layer).save(png)
row=encode(('edge-overlay',png,['-lossless','-q','100','-m','6']))
background=OLD/'preprocess-pilot/edge-protected-09.webp'
base=np.array(Image.open(background).convert('RGBA'));base[mask]=src[mask]
Image.fromarray(base).save(OUT/'layer-composited.png')
row.update(background=str(background),combinedBytes=row['bytes']+background.stat().st_size,
           protectedFraction=float(mask.mean()),protectedPixelsExact=bool(np.array_equal(base[mask],src[mask])),
           alphaExact=bool(np.array_equal(base[:,:,3],src[:,:,3])))
(OUT/'layer-results.json').write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf-8')
print('LAYER',row['combinedBytes'],flush=True)
