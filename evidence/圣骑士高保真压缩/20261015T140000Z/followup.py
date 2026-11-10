"""近无损模式不保留透明像素隐藏 RGB 的对照；不假定 alpha 无损。"""
import json
from benchmark import OUT, SOURCE, encode
from concurrent.futures import ThreadPoolExecutor, as_completed

jobs=[]
for level in [80,60,40]:
    jobs.append((f'near-{level}-noexact',SOURCE,['-near_lossless',str(level),'-q','100','-m','6']))
jobs.append(('near-60-q60-exact',SOURCE,['-near_lossless','60','-q','60','-m','6','-exact']))
rows=json.loads((OUT/'native-results.json').read_text(encoding='utf-8'))
with ThreadPoolExecutor(max_workers=2) as pool:
    for future in as_completed([pool.submit(encode,job) for job in jobs]):
        rows.append(future.result())
        (OUT/'native-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
