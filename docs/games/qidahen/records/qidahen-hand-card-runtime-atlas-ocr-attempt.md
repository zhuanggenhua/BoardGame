# 七大恨运行时图集候选小图 OCR 尝试记录

> 本文件记录 2026-07-03 对 28 条运行时图集候选小图的 OCR 尝试。结论是：OCR 环境当时不能稳定完成识别；这只是一次失败证据，不是逐牌真相源，也不能作为 OpenSpec `2.4` 或 `4.5` 的完成依据。后续已通过低分辨率安全预览完成人工核读，最终结论以 `qidahen-hand-card-runtime-atlas-priority-review.md` 和候选矩阵为准。

## 输入

- 候选索引：`tmp/qidahen-card-sheets/runtime-atlas-safe-review/runtime-atlas-safe-review-index.json`
- 小图说明：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-safe-review.md`
- 候选范围：大明 9、蒙古 14、后金 5，共 28 条。
- 文件完整性：索引内 28 条候选对应 56 个小图文件；清理一次失败脚本残留后，目标文件无缺失、无额外未引用小图。

## OCR 尝试

### 路径编码问题

首次直接把中文文件名路径传给 EasyOCR 时，OpenCV 将路径误编码为 mojibake，导致图片读取失败：

- 症状：`AttributeError: 'NoneType' object has no attribute 'shape'`
- 证据：OpenCV 警告中出现乱码路径，例如 `鍚庨噾_deck15_card1500...`
- 处理：改为用 `PIL.Image.open()` 读取图片，再把 `numpy` 数组传给 EasyOCR，路径编码问题解除。

### 资源不足问题

改为数组输入后，EasyOCR 仍未稳定跑完整 28 条候选：

- 一次失败为 CUDA 显存不足：`RuntimeError: CUDA error: out of memory`
- 强制设置 `CUDA_VISIBLE_DEVICES=''` 后，EasyOCR 初始化仍失败：`DefaultCPUAllocator: not enough memory`
- 当时本机可用物理内存约 1428 MB，`torch 2.5.1+cu124` 且 `cuda_available=True`，EasyOCR 版本为 `1.7.2`。

## 当前裁决

- 本轮 OCR 尝试没有获得可用于逐牌确认的稳定结果。
- 后续低分辨率安全预览核读已经完成 28 条候选：全部为人物牌、纪年/剧本类牌或人物效果相关非普通牌，不能补普通事件、军备、战术或银两映射。
- 不得把本轮 OCR 尝试、失败日志、路径、小图存在性、局部 OCR 输出或已排除候选反写为正式 `cardKind / cardDefId / armamentId`。
- OpenSpec `2.4` 和 `4.5` 必须继续保持未完成。

## 下一步

运行时图集这条候选链已经证伪。可继续推进的安全路径只有：

- 找到可追溯逐牌牌表。
- 对非运行时图集来源做可靠 OCR 后人工确认。
- 找到其他可审计普通手牌录入来源，再按反写契约进入正式映射候选。
