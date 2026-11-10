"""原 PNG 原尺寸离线实验，不写运行时素材。"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess, json, time
import numpy as np
import cv2
from PIL import Image

OUT = Path(__file__).resolve().parent
OLD = OUT.parents[1] / '圣骑士素材压缩/20261015T122010Z'
EXE = OUT / 'tools/libwebp-1.6.0-windows-x64/bin/cwebp.exe'
SOURCE = OLD / 'sample-source.png'
cv2.setNumThreads(2)

def encode(job):
    name, source, args = job
    dest = OUT / (name + '.webp')
    start = time.time()
    result = subprocess.run([str(EXE), *args, str(source), '-o', str(dest), '-quiet'], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(name + ': ' + result.stderr)
    row = {'id': name, 'file': str(dest), 'source': str(source), 'args': args,
           'bytes': dest.stat().st_size, 'seconds': round(time.time()-start, 2)}
    print(name, row['bytes'], flush=True)
    return row

def pilot():
    common = ['-m', '6', '-exact', '-alpha_q', '100']
    jobs = []
    for level in (100, 90, 80, 60):
        jobs.append((f'near-{level}', SOURCE, ['-near_lossless', str(level), '-q', '100', *common]))
    for name, args in [
        ('budget-default', []),
        ('budget-text', ['-preset', 'text']),
        ('budget-sns0-filter0', ['-sns', '0', '-f', '0']),
        ('budget-sns20-filter20', ['-sns', '20', '-f', '20']),
    ]:
        jobs.append((name, SOURCE, [*args, '-size', '424000', '-pass', '6', '-sharp_yuv', *common]))
    pixels = np.array(Image.open(SOURCE).convert('RGBA'))
    rgb = pixels[:,:,:3]
    protect = cv2.dilate(cv2.Canny(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), 90, 180), np.ones((3,3), np.uint8)) != 0
    protect |= cv2.dilate((pixels[:,:,3] != 255).astype('uint8'), np.ones((5,5), np.uint8)) != 0
    for sigma in (0.4, 0.6):
        result = pixels.copy()
        smooth = cv2.GaussianBlur(rgb, (0,0), sigma)
        smooth[protect] = rgb[protect]
        result[:,:,:3] = smooth
        file = OUT / f'edge-{sigma}.png'
        Image.fromarray(result).save(file)
        jobs.append((f'edge-{sigma}-q85', file, ['-preset', 'text', '-q', '85', '-sharp_yuv', *common]))
    # 只平滑色度，原始亮度和高反差边界回填；仍属于有损预处理。
    ycc = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
    ycc[:,:,1:] = cv2.GaussianBlur(ycc[:,:,1:], (0,0), 0.8)
    smooth = cv2.cvtColor(ycc, cv2.COLOR_YCrCb2RGB)
    smooth[protect] = rgb[protect]
    result = pixels.copy(); result[:,:,:3] = smooth
    file = OUT / 'chroma.png'; Image.fromarray(result).save(file)
    jobs.append(('chroma-q85', file, ['-preset','text','-q','85','-sharp_yuv',*common]))
    rows=[]
    with ThreadPoolExecutor(max_workers=2) as pool:
        for future in as_completed([pool.submit(encode, job) for job in jobs]):
            rows.append(future.result())
            (OUT / 'native-results.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')

if __name__ == '__main__':
    pilot()
