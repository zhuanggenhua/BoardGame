from pathlib import Path
from collections import defaultdict
import json,hashlib
from PIL import Image
import numpy as np
from benchmark import OUT,OLD

full=json.loads((OUT/'full-results.json').read_text(encoding='utf-8'))
assert len(full)==6,'完整编码仍在进行，不能写最终结论'
assert all(row['alphaExact'] for row in full)
assert all(row['visibleRgbMaxError']<=2 for row in full if row['kind']=='near60'),'透明边缘修复尚未完成'
sample=json.loads((OUT/'metrics.json').read_text(encoding='utf-8'))
byid={r['id']:r for r in sample}
singles=json.loads((OUT/'single-results.json').read_text(encoding='utf-8'))
sources=json.loads((OLD/'sources.json').read_text(encoding='utf-8'))
totals=defaultdict(int)
for row in full: totals[row['kind']]+=row['bytes']
for row in singles:
    source=np.array(Image.open(OUT/f"card-{row['frame']}-source.png").convert('RGBA'))
    dst=np.array(Image.open(row['file']).convert('RGBA'))
    valid=source[:,:,3]>0
    row['alphaExact']=bool(np.array_equal(source[:,:,3],dst[:,:,3]))
    row['visibleRgbMaxError']=int(np.abs(source[:,:,:3].astype('int16')-dst[:,:,:3].astype('int16'))[valid].max())
    row['sha256']=hashlib.sha256(Path(row['file']).read_bytes()).hexdigest()
(OUT/'single-results.json').write_text(json.dumps(singles,ensure_ascii=False,indent=2),encoding='utf-8')
runtime=[]
for name,source in sources.items():
    path=Path(source['baseline']['path'])
    runtime.append({'asset':name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
assert sum(r['bytes'] for r in runtime)==3085846,'当前本地正式素材与分析基线不同'
source_checks=[]
for name,info in sources.items():
    digest=hashlib.sha256(Path(info['source']['path']).read_bytes()).hexdigest()
    assert digest==info['source']['sha256']
    source_checks.append({'asset':name,'sha256':digest})
(OUT/'source-and-runtime-receipt.json').write_text(json.dumps({'sources':source_checks,'runtime':runtime},ensure_ascii=False,indent=2),encoding='utf-8')
lines=['# 圣骑士高保真压缩分析（2026-10-15）','',
'## 对象与边界','',
'- 真相源：上一轮 sources.json 登记的三张原始 PNG，原尺寸、原 alpha；合计 54,731,598 字节。',
'- 目标：更少损失原始像素、小字、彩色图标和扫描细纹，同时兼顾加载体积与 WebP 兼容性。',
'- 本轮只生成离线实验和报告，没有替换正式素材或上传服务器。正式本地三图仍合计 3,085,846 字节。',
'- 指标基于解码像素；完整图逐像素核查可见 RGB 和全部 alpha。SSIM/边缘误差不能代表文字识别率或全设备视觉验收。','',
'## 完整三图实测','',
'| 方案 | 三图字节 | MB（十进制） | 相对当前 | 保真程度 |',
'| --- | ---: | ---: | ---: | --- |',
'| 当前降噪＋有损 WebP | 3,085,846 | 3.09 | 1.00x | 保留原尺寸和 alpha，细纹被明显平滑，不是近无损 |',
'| 之前已测：不降噪 WebP q85/default | 6,215,876 | 6.22 | 2.01x | 有损，更多扫描纹理保留，无逐像素低误差承诺 |']
for kind,label in [('near60','近无损60＋恢复原 alpha/半透明边缘RGB＋无损封装'),('lossless','无损 WebP（可见 RGB 和 alpha）')]:
    group=[r for r in full if r['kind']==kind]
    maxerr=max(r['visibleRgbMaxError'] for r in group)
    lines.append(f"| {label} | {totals[kind]:,} | {totals[kind]/1e6:.2f} | {totals[kind]/3085846:.2f}x | 可见 RGB 最大通道误差 {maxerr}/255；三图 alpha 逐像素一致 |")
lines+=['','近无损60未经处理会改变少量 alpha 值。只恢复 alpha 时，原始低 alpha 像素可能已经变成完全透明、导致隐藏 RGB 丢失，棋盘候选可见 RGB 最大误差曾达255。该中间结果没有采用。本实验解码近无损 RGB，恢复全部原 PNG alpha 和全部半透明边缘原始 RGB，再无损编码；最终完整三图结果才是上表数字。隐藏在原始 alpha=0 下的不可见 RGB 不要求一致。原图尺寸均未改变。','',
'| 图片 | 无损字节 | 近无损修复 alpha 后字节 | 近无损可见 RGB 最大误差 |',
'| --- | ---: | ---: | ---: |']
for name in sources:
    loss=next(r for r in full if r['asset']==name and r['kind']=='lossless')
    near=next(r for r in full if r['asset']==name and r['kind']=='near60')
    lines.append(f"| {name} | {loss['bytes']:,} | {near['bytes']:,} | {near['visibleRgbMaxError']}/255 |")
lines+=['','## 同一原生尺寸样本的其他路线','',
'样本由三张完整 736×1178 卡牌及棋盘/提示板原生尺寸区域组成，共 3680×1178；不根据样本外推完整文件字节。边缘口径是灰度 Canny100/180 膨胀3像素，不等同仅文字。','',
'| 方案 | 样本字节 | 亮度 SSIM↑ | 高反差边界 RMSE↓ | alpha 一致 |',
'| --- | ---: | ---: | ---: | --- |']
for name in ['current-online-sample','budget-default','budget-text','budget-sns20-filter20','text-q85','edge-0.4-q85','chroma-q85','near-80-noexact','near-60-noexact','near-40-noexact','jpeg-444-q80','jpeg-444-q90','png256-dither0']:
    r=byid[name];m=r['metrics']
    lines.append(f"| {name} | {r['bytes']:,} | {m['opaqueLumaSsim']:.6f} | {m['edgeLumaRmse']:.4f} | {m['alphaExact']} |")
layer=json.loads((OUT/'layer-results.json').read_text(encoding='utf-8'))
lines+=['',
f"- 文字/高反差边界无损覆盖层＋当前背景：样本 {layer['combinedBytes']:,} 字节，当前样本 423,968 字节；保护了约 {layer['protectedFraction']*100:.1f}% 像素，仍会保留很多扫描细纹，体积不占优。不是人工分离的纯文字层。",
'- JPEG 4:4:4 的彩色边界理论上避免 4:2:0 降采样，但本次 MozJPEG 样本的亮度边界误差/体积未胜出；JPEG 没有 alpha。比较表还没加单独 alpha PNG 的字节，不能直接用于现有透明素材替换。',
'- 256色 PNG 使用调色板量化，虽然格式名是 PNG，颜色已经有损；样本比当前版大且 alpha 也发生变化。',
'- 只平滑色度、减弱平滑强度，在 q85 下没有得到明显的体积/保真双重收益。',
'- cwebp -exact 会影响近无损预测残差优化；本机1.6.0启用该选项后 near80/90 与完整无损样本相同。没有把这种参数组合的结果误认为近无损编码的最小体积。','',
'## 实用方向：普通显示小图，放大时加载原尺寸高保真单卡','',
'现有卡牌 previewRef 指向同一个英雄 atlas，CardPreview 通过 CSS/图集坐标裁切，criticalImageResolver 把 ability-cards 整图列入 gameplay 素材。当前放大不会自动得到另一份高保真单卡。','',
'本轮离线裁出近无损样本中的三张卡，恢复原 alpha，再无损封装为独立 WebP；没有缩小像素尺寸：','',
'| 单卡原 atlas 帧 | 原尺寸近无损 WebP字节 | 原图直出 q85 字节 |',
'| --- | ---: | ---: |']
for frame in [0,12,32]:
    near=next(r for r in singles if r['frame']==frame and r['kind']=='near60')
    q=next(r for r in singles if r['frame']==frame and r['kind']=='q85')
    assert near['alphaExact'] and near['visibleRgbMaxError']<=2
    lines.append(f"| {frame} | {near['bytes']:,} | {q['bytes']:,} |")
lines+=['',
'建议保留当前约3.09MB常态素材；若要兼顾放大后的精度，单独接入原尺寸近无损单卡，用户查看时按需加载并缓存。三张样本每张约0.41–0.49MB，不需要启动时下载完整高保真图集。此项需要改放大入口/资源索引，尚未实现，也没有首屏速度实测。',
'若要求所有常态画面也接近原 PNG，只能接受更大传输体积，或拿到更干净的电子原稿/矢量版；现有扫描细纹和噪点本身需要字节保存。PS去纹理属于改变原图信息，不能称为无损。',
'','## 核图与复现','',
'- card0-source-near60.png：原生尺寸完整卡0并排；未发现小字、图标和细纹的明显可见改变，不能推及全部33张。',
'- text-tip.png：原始/近无损/原图q85/当前降噪版的提示板原生区域；当前版细纹明显减少，近无损更接近原图。',
'- full-results.json：完整三图字节、hash、最大像素误差、alpha修复前后记录。',
'- metrics.json：样本指标和逐文字区域指标。single-results.json：单卡文件与像素核查。',
'- source-and-runtime-receipt.json：原 PNG hash 未变、当前正式本地 WebP字节/hash。',
'- benchmark.py / followup.py / alternatives.cjs：样本编码；full.py：完整编码和alpha恢复；single-cards.py/cjs：按需单卡候选。',
'','## 官方资料','',
'- [Google cwebp：无损/近无损/透明通道与压缩参数](https://developers.google.com/speed/webp/docs/cwebp)',
'- [Google WebP FAQ：有损使用YUV420、无损RGBA、浏览器支持](https://developers.google.com/speed/webp/faq)',
'- [Sharp输出选项](https://sharp.pixelplumbing.com/api-output/)',
'- 工具：Google官方libwebp1.6.0 Windows x64；Sharp0.34.5/libwebp1.6.0；离线像素核查Pillow/NumPy/OpenCV。',
'- 保持WebP输出，没有引入AVIF/JPEG XL；兼容性依据格式支持文档，本轮没有逐设备浏览器验收。','']
(OUT/'README.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'totals':dict(totals),'runtime':runtime,'report':str(OUT/'README.md')},ensure_ascii=False,indent=2))
