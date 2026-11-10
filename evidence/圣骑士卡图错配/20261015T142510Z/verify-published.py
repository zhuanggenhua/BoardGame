"""回查本次卡图正文及两个Android渠道，独立于上传成功日志。"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from urllib.request import Request,urlopen
import hashlib,json,time
from PIL import Image
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
candidate=json.loads((OUT/'candidate-receipt.json').read_text(encoding='utf-8'))
BASE='https://assets.easyboardgame.top/official'
KEY='i18n/zh-CN/dicethrone/images/paladin/compressed/ability-cards.webp'
def get(url):
    start=time.perf_counter()
    with urlopen(Request(url,headers={'User-Agent':'BoardGame-card-map-verification'}),timeout=45) as response:
        body=response.read();meta={'url':url,'status':response.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),
         'contentType':response.headers.get('Content-Type'),'cacheControl':response.headers.get('Cache-Control'),
         'totalMs':round((time.perf_counter()-start)*1000)}
    return meta,body
def check_image(url):
    meta,body=get(url)
    with Image.open(BytesIO(body)) as image:meta['dimensions']=list(image.size)
    meta['matches']=meta['sha256']==candidate['webpSha256'] and meta['bytes']==candidate['bytes'] and meta['dimensions']==candidate['dimensions']
    print('IMAGE',meta['status'],meta['bytes'],meta['matches'],flush=True);return meta
urls=[f'{BASE}/{KEY}?v={version}' for version in ['68d0df8a','df14a9fd',candidate['webpSha256'][:8]]]
urls.append(f'http://8.148.71.102/official/{KEY}')
with ThreadPoolExecutor(max_workers=3) as pool:images=list(pool.map(check_image,urls))
(OUT/'public-verification.json').write_text(json.dumps(images,ensure_ascii=False,indent=2),encoding='utf-8')
def channel(name):
    _,body=get(f'{BASE}/mobile-packages/android/{name}/games/dicethrone.json');manifest=json.loads(body)
    meta,data=get(manifest['assetPack']['fileIndexUrl']);index=json.loads(data)
    checks=[]
    for asset in ['ability-cards','player-board','tip']:
        local=ROOT/f'public/assets/i18n/zh-CN/dicethrone/images/paladin/compressed/{asset}.webp'
        key=f'i18n/zh-CN/dicethrone/images/paladin/compressed/{asset}.webp'
        entry=next((r for r in index['files'] if r['path']==key),None)
        checks.append({'asset':asset,'entry':entry,'matches':bool(entry and entry['hash']==hashlib.sha256(local.read_bytes()).hexdigest() and entry['size']==local.stat().st_size)})
    result={'channel':name,'version':manifest['assetPack']['version'],'checksumMatches':meta['sha256']==manifest['assetPack']['fileIndexChecksum'],'checks':checks}
    print('ANDROID',name,result['version'],result['checksumMatches'],[c['matches'] for c in checks],flush=True);return result
with ThreadPoolExecutor(max_workers=2) as pool:channels=list(pool.map(channel,['edge','stable']))
(OUT/'android-index-verification.json').write_text(json.dumps(channels,ensure_ascii=False,indent=2),encoding='utf-8')
assert all(row['matches'] for row in images)
assert all(row['checksumMatches'] and all(c['matches'] for c in row['checks']) for row in channels)
