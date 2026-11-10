from benchmark import OUT, SOURCE
from PIL import Image
import numpy as np,json
src=np.array(Image.open(SOURCE).convert('RGBA'))
near=np.array(Image.open(OUT/'near-60-noexact.webp').convert('RGBA'));near[:,:,3]=src[:,:,3]
partial=src[:,:,3]!=255
near[partial,:3]=src[partial,:3]
rows=[]
for slot,frame in enumerate([0,12,32]):
    box=(slot*736,0,(slot+1)*736,1178)
    original=OUT/f'card-{frame}-source.png';candidate=OUT/f'card-{frame}-near60-alpha-fixed.png'
    Image.fromarray(src).crop(box).save(original);Image.fromarray(near).crop(box).save(candidate)
    rows.append({'frame':frame,'source':str(original),'near':str(candidate)})
(OUT/'single-inputs.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
