"""复用首次近无损结果，修正早期只恢复alpha的候选；不再次有损编码。"""
from benchmark import OUT,OLD,encode
from concurrent.futures import ThreadPoolExecutor,as_completed
from PIL import Image
from pathlib import Path
import numpy as np,json,hashlib

sources=json.loads((OLD/'sources.json').read_text(encoding='utf-8'))
records=json.loads((OUT/'full-results.json').read_text(encoding='utf-8'))
assert len(records)==6
(OUT/'full-alpha-only-intermediate.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
def repair(row):
    if row['kind']!='near60': return row
    source=np.array(Image.open(sources[row['asset']]['source']['path']).convert('RGBA'))
    pixels=np.array(Image.open(row['firstEncode']['file']).convert('RGBA'))
    partial=source[:,:,3]!=255
    pixels[partial,:3]=source[partial,:3];pixels[:,:,3]=source[:,:,3]
    png=OUT/f"full-{row['asset']}-near60-edge-fixed.png";Image.fromarray(pixels).save(png)
    row.update(encode((f"full-{row['asset']}-near60-edge-fixed",png,['-lossless','-q','100','-m','6'])))
    dst=np.array(Image.open(row['file']).convert('RGBA'));visible=source[:,:,3]>0
    diff=np.abs(source[:,:,:3].astype('int16')-dst[:,:,:3].astype('int16'))
    errors=diff[visible].max(axis=1)
    row.update(alphaExact=bool(np.array_equal(source[:,:,3],dst[:,:,3])),
       visibleRgbMaxError=int(errors.max()),visibleRgbMae=round(float(diff[visible].mean()),5),
       visibleRgbP99MaxChannelError=float(np.percentile(errors,99)),
       originalPartialAlphaRgbExact=bool(np.array_equal(source[partial & visible,:3],dst[partial & visible,:3])),
       sha256=hashlib.sha256(Path(row['file']).read_bytes()).hexdigest(),dimensions=list(Image.open(row['file']).size))
    print('FINAL',row['asset'],row['bytes'],row['visibleRgbMaxError'],flush=True)
    return row
rows=[]
with ThreadPoolExecutor(max_workers=2) as pool:
    for future in as_completed([pool.submit(repair,row) for row in records]):
        rows.append(future.result())
        (OUT/'full-edge-fixed-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'full-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
