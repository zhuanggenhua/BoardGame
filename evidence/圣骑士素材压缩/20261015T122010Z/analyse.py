"""候选编码的尺寸、alpha、SSIM、边缘误差和轻量核图。指标不替代读字。"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from skimage.metrics import structural_similarity

OUT = Path(__file__).resolve().parent
SOURCES = json.loads((OUT / 'sources.json').read_text(encoding='utf-8'))

def rgba(path):
    with Image.open(path) as image:
        return np.array(image.convert('RGBA'))

def metric(source, candidate):
    src = rgba(source)
    dst = rgba(candidate)
    if src.shape != dst.shape:
        raise ValueError(f'尺寸不一致: {candidate}')
    ssim_sum = squared_error = 0.0
    valid_count = edge_count = 0
    # 分块计算，避免 3480 万像素图的 SSIM 中间数组占用数 GB 内存。
    for y in range(0, src.shape[0], 768):
        for x in range(0, src.shape[1], 768):
            a = src[y:y+768, x:x+768]
            b = dst[y:y+768, x:x+768]
            if min(a.shape[:2]) < 7:
                continue
            src_l = cv2.cvtColor(a[:, :, :3], cv2.COLOR_RGB2GRAY)
            dst_l = cv2.cvtColor(b[:, :, :3], cv2.COLOR_RGB2GRAY)
            valid = a[:, :, 3] == 255
            valid[:3, :] = valid[-3:, :] = False
            valid[:, :3] = valid[:, -3:] = False
            _, ssim_map = structural_similarity(src_l, dst_l, data_range=255, full=True)
            ssim_sum += float(ssim_map[valid].sum())
            valid_count += int(valid.sum())
            edge = cv2.Canny(src_l, 100, 180)
            mask = (cv2.dilate(edge, np.ones((3,3),np.uint8)) != 0) & valid
            diff = src_l.astype(np.float32) - dst_l.astype(np.float32)
            squared_error += float(np.sum(diff[mask] ** 2))
            edge_count += int(mask.sum())
    ssim = ssim_sum / valid_count
    edge_rmse = (squared_error / edge_count) ** 0.5
    alpha_equal = bool(np.array_equal(src[:, :, 3], dst[:, :, 3]))
    return {'lumaSsimOpaque': round(ssim, 6), 'edgeLumaRmse': round(edge_rmse, 4),
            'alphaExact': alpha_equal, 'sameDimensions': True}

phase = sys.argv[1] if len(sys.argv) > 1 else 'pilot'
results = json.loads((OUT / f'{phase}-results.json').read_text(encoding='utf-8'))
chosen = set(sys.argv[2:])
if chosen:
    results['records'] = [r for r in results['records'] if r['config']['id'] in chosen]
for record in results['records']:
    source = OUT / 'sample-source.png' if phase == 'pilot' else SOURCES[record['asset']]['source']['path']
    record['metrics'] = metric(source, record['file'])
    print(record['asset'], record['config']['id'], record['bytes'], record['metrics'], flush=True)
(OUT / f'{phase}-metrics.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')

if phase == 'pilot':
    configs = ['source', 'default-q65', 'default-q75', 'default-q80', 'default-q85', 'text-q75', 'sharp-yuv-q75']
    # 三张完整单卡已单独读取。这里用文字区原生像素并排核对，不做缩放。
    regions = {'card0-text': (90, 270, 650, 730),
               'card12-text': (736+90, 320, 736+650, 500),
               'board-text': (736*3+10, 60, 736*3+570, 490),
               'tip-text': (736*4+15, 120, 736*4+575, 520)}
    for name, box in regions.items():
        width, height = box[2]-box[0], box[3]-box[1]
        sheet = Image.new('RGB', (width*2, (height+30)*len(configs[:4])), '#dddddd')
        draw = ImageDraw.Draw(sheet)
        for index, config in enumerate(configs):
            file = OUT/'sample-source.png' if config == 'source' else OUT/f'pilot/sample--{config}.webp'
            image = Image.open(file).convert('RGBA')
            crop = image.crop(box)
            x = (index % 2)*width
            y = (index // 2)*(height+30)
            draw.text((x+8,y+5),config,fill='black')
            sheet.paste(crop,(x,y+30),crop)
        sheet.save(OUT/f'compare-{name}.png')
    for config in ['default-q65','default-q75','sharp-yuv-q75']:
        with Image.open(OUT/f'pilot/sample--{config}.webp') as image:
            image.crop((0,0,736,1178)).save(OUT/f'card0--{config}.png')

    # 从原始备份复现历史脚本 q82+最长边2048，并比较完整字节哈希。
    old_checks=[]
    for name in ['player-board','tip']:
        old_path=Path(SOURCES[name]['old']['path'])
        raw=old_path.parent.parent/f'{name}.png'
        with Image.open(raw) as image:
            image=ImageOps.exif_transpose(image)
            image.thumbnail((2048,2048),Image.Resampling.LANCZOS)
            buffer=BytesIO()
            image.save(buffer,'WEBP',quality=82,method=6)
            data=buffer.getvalue()
            digest=hashlib.sha256(data).hexdigest()
            old_checks.append({'asset':name,'quality':82,'maxEdge':2048,'bytes':len(data),'sha256':digest,
                               'matchesOldBinary':digest==SOURCES[name]['old']['sha256']})
    (OUT/'old-encoder-reproduction.json').write_text(json.dumps(old_checks,indent=2),encoding='utf-8')
    print('Old encoding reproduction:',old_checks,flush=True)
