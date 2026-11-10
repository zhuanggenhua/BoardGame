"""完整三图：无损、近无损（恢复原 alpha）；只写 evidence。"""
from benchmark import OUT, OLD, encode
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image
import json, numpy as np, hashlib

sources=json.loads((OLD/'sources.json').read_text(encoding='utf-8'))
def asset_job(name, kind):
    src=sources[name]['source']['path']
    args=['-q','100','-m','6']
    args+=['-lossless'] if kind=='lossless' else ['-near_lossless','60']
    row=encode((f'full-{name}-{kind}',src,args))
    original=np.array(Image.open(src).convert('RGBA'))
    dst=np.array(Image.open(row['file']).convert('RGBA'))
    row['alphaExactBeforeRepair']=bool(np.array_equal(original[:,:,3],dst[:,:,3]))
    row['alphaMaxErrorBeforeRepair']=int(np.abs(original[:,:,3].astype('int16')-dst[:,:,3].astype('int16')).max())
    if kind=='near60':
        # 保留全部半透明边缘原始 RGB，并恢复原 alpha；否则低 alpha 变0后的颜色可能已丢失。
        partial=original[:,:,3]!=255
        dst[partial,:3]=original[partial,:3]
        dst[:,:,3]=original[:,:,3]
        temp=OUT/f'full-{name}-near60-edge-fixed.png'
        Image.fromarray(dst).save(temp)
        row['firstEncode']=dict(row)
        row.update(encode((f'full-{name}-near60-edge-fixed',temp,['-lossless','-q','100','-m','6'])))
        dst=np.array(Image.open(row['file']).convert('RGBA'))
    visible=original[:,:,3]>0
    err=np.abs(original[:,:,:3].astype('int16')-dst[:,:,:3].astype('int16'))
    hist=np.bincount(err[visible].max(axis=1),minlength=256)
    row.update(asset=name,kind=kind,alphaExact=bool(np.array_equal(original[:,:,3],dst[:,:,3])),
       visibleRgbMaxError=int(err[visible].max()),visibleRgbMae=round(float(err[visible].mean()),5),
       visibleRgbP99MaxChannelError=int(np.searchsorted(hist.cumsum(),hist.sum()*.99)),
       dimensions=list(Image.open(row['file']).size),sha256=hashlib.sha256(Path(row['file']).read_bytes()).hexdigest())
    print('FINAL',name,kind,row['bytes'],row['alphaExact'],row['visibleRgbMaxError'],flush=True)
    return row

rows=[]
with ThreadPoolExecutor(max_workers=2) as pool:
    jobs=[pool.submit(asset_job,name,kind) for kind in ['lossless','near60'] for name in sources]
    for future in as_completed(jobs):
        rows.append(future.result())
        (OUT/'full-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
