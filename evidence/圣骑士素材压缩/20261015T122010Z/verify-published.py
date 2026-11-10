"""回查公网图片与 Android 两渠道文件索引，不能由上传日志推断生效。"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from urllib.request import Request,urlopen
from urllib.parse import urlparse
import hashlib
import json
import time
from PIL import Image

OUT=Path(__file__).resolve().parent
DEST=OUT/'replacement-20261015T125417Z'
selection=json.loads((OUT/'selection-preprocessed.json').read_text())
sources=json.loads((OUT/'sources.json').read_text(encoding='utf-8'))
BASE='https://assets.easyboardgame.top/official'

def get(url):
    if urlparse(url).hostname not in ['assets.easyboardgame.top','8.148.71.102']:
        raise ValueError('非预期的公共资源主机')
    start=time.perf_counter()
    with urlopen(Request(url,headers={'User-Agent':'BoardGame-asset-verification'}),timeout=45) as response:
        ttfb=time.perf_counter()-start
        body=response.read()
        return {'url':url,'status':response.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),
                'ttfbMs':round(ttfb*1000),'totalMs':round((time.perf_counter()-start)*1000),
                'contentType':response.headers.get('Content-Type'),'cacheControl':response.headers.get('Cache-Control'),
                'originRoute':response.headers.get('X-Asset-Origin-Route')},body

def check_image(task):
    row,label,url=task
    metadata,body=get(url)
    with Image.open(BytesIO(body)) as image:
        metadata['size']=[image.width,image.height]
    metadata.update({'asset':row['name'],'requestVersion':label,'matchesSelected':metadata['sha256']==row['sha256'] and metadata['bytes']==row['bytes']})
    if metadata['size']!=[row['width'],row['height']]:
        metadata['matchesSelected']=False
    print(row['name'],label,metadata['status'],metadata['bytes'],metadata['matchesSelected'],flush=True)
    return metadata

tasks=[]
for row in selection['selection']:
    relative=f"i18n/zh-CN/dicethrone/images/paladin/compressed/{row['name']}.webp"
    old=sources[row['name']]['baseline']['sha256'][:8]
    tasks.extend([(row,'current-client-old-version',f'{BASE}/{relative}?v={old}'),
                  (row,'new-version',f"{BASE}/{relative}?v={row['sha256'][:8]}"),
                  (row,'android-direct-origin',f'http://8.148.71.102/official/{relative}')])
with ThreadPoolExecutor(max_workers=3) as executor:
    images=list(executor.map(check_image,tasks))
(DEST/'public-image-verification.json').write_text(json.dumps(images,indent=2),encoding='utf-8')

def check_channel(channel):
    meta,body=get(f'{BASE}/mobile-packages/android/{channel}/games/dicethrone.json')
    manifest=json.loads(body)
    index_meta,index_bytes=get(manifest['assetPack']['fileIndexUrl'])
    index=json.loads(index_bytes)
    expected_checksum=manifest['assetPack']['fileIndexChecksum']
    checksum_matches=index_meta['sha256']==expected_checksum
    rows=[]
    for row in selection['selection']:
        target=f"i18n/zh-CN/dicethrone/images/paladin/compressed/{row['name']}.webp"
        record=next((r for r in index['files'] if r['path']==target),None)
        rows.append({'asset':row['name'],'entry':record,
                     'matchesSelected':record is not None and record['hash']==row['sha256'] and record['size']==row['bytes']})
    result={'channel':channel,'manifestUrl':meta['url'],'publishedAt':manifest.get('publishedAt'),
            'version':manifest['assetPack']['version'],'fileIndexUrl':index_meta['url'],
            'fileIndexChecksumMatches':checksum_matches,'entries':rows}
    print(channel,result['version'],'checksum',checksum_matches,'assets',[r['matchesSelected'] for r in rows],flush=True)
    return result

with ThreadPoolExecutor(max_workers=2) as executor:
    channels=list(executor.map(check_channel,['edge','stable']))
(DEST/'android-index-verification.json').write_text(json.dumps(channels,indent=2),encoding='utf-8')
assert all(r['matchesSelected'] for r in images),'公网图片仍有不匹配'
assert all(r['fileIndexChecksumMatches'] and all(e['matchesSelected'] for e in r['entries']) for r in channels),'素材包索引仍有不匹配'
print('VERIFIED: 9 public image GETs and edge/stable Android indexes match selected files')
