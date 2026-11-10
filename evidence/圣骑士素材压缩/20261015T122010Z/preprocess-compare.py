"""预处理样本核图，保持原生像素；只提供诊断证据。"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw

cv2.setNumThreads(2)
OUT=Path(__file__).resolve().parent
result_file=OUT/'preprocess-pilot-results.json'
if not result_file.exists():
    result_file=OUT/'preprocess-results.json'
rows=json.loads(result_file.read_text())
source=Image.open(OUT/'sample-source.png').convert('RGBA')
source_array=np.array(source)
source_luma=cv2.cvtColor(source_array[:,:,:3],cv2.COLOR_RGB2GRAY)
edge=cv2.dilate(cv2.Canny(source_luma,100,180),np.ones((3,3),np.uint8))!=0
edge &= source_array[:,:,3]==255
for row in rows:
    a=np.array(Image.open(row['file']).convert('RGBA'))
    luma=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2GRAY)
    diff=source_luma.astype(np.float32)-luma.astype(np.float32)
    row['edgeLumaRmse']=round(float(np.sqrt(np.mean(diff[edge]**2))),4)
    row['encodedAlphaExact']=bool(np.array_equal(a[:,:,3],source_array[:,:,3]))
    row['savedVsPreviousPercent']=round(100*(1-row['bytes']/573596),2)

(OUT/'preprocess-metrics.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
images=[('source',source),('previous-text-q75',Image.open(OUT/'pilot/sample--text-q75.webp').convert('RGBA'))]
images += [(r['id'],Image.open(r['file']).convert('RGBA')) for r in rows]
for name,box in [('tip',(736*4+15,120,736*4+575,520)),('card',(90,270,650,730))]:
    w,h=box[2]-box[0],box[3]-box[1]
    sheet=Image.new('RGB',(w*2,(h+28)*4),'#eeeeee')
    draw=ImageDraw.Draw(sheet)
    for index,(label,image) in enumerate(images):
        x=(index%2)*w;y=(index//2)*(h+28)
        draw.text((x+8,y+6),label,fill='black')
        crop=image.crop(box)
        sheet.paste(crop,(x,y+28),crop)
    sheet.save(OUT/f'preprocess-compare-{name}.png')
print(json.dumps(rows,indent=2))
