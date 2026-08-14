# 七大恨运行时图集候选安全复核入口

> 本文件记录 2026-07-03 已完成的安全复核入口。它说明如何把三张大图收敛为小图候选，并记录后续低分辨率人工核读结果；当前没有任何候选达到正式规则映射门槛，OpenSpec `2.4` 和 `4.5` 必须保持未完成。

## 输入

- 候选矩阵：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-manual-entry-matrix.md`
- 交叉核验证据：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-tts-crosswalk.md`
- 本地脚本读取的真实运行时图集：
  - `public/assets/i18n/zh-CN/qidahen/cards/atlases/ming-faction-deck-atlas.jpg`
  - `public/assets/i18n/zh-CN/qidahen/cards/atlases/mongol-faction-deck-atlas.jpg`
  - `public/assets/i18n/zh-CN/qidahen/cards/atlases/jin-faction-deck-atlas.jpg`

## 安全处理

- 本轮不直接让模型读取或展示大图。
- 只由本地脚本读取 atlas 原图，并按候选矩阵的 `行 / 列` 裁出小尺寸缩略图与标题裁切。
- 生成的小图只用于人工读牌或外部 OCR；不得直接把文件路径、OCR 文本或缩略图存在本身当作规则真相源。

## 本地输出

- 索引 JSON：`tmp/qidahen-card-sheets/runtime-atlas-safe-review/runtime-atlas-safe-review-index.json`
- 索引 Markdown：`tmp/qidahen-card-sheets/runtime-atlas-safe-review/runtime-atlas-safe-review-index.md`
- 缩略图目录：`tmp/qidahen-card-sheets/runtime-atlas-safe-review/thumbnails/`
- 标题裁切目录：`tmp/qidahen-card-sheets/runtime-atlas-safe-review/title-crops/`
- OCR 尝试记录：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-ocr-attempt.md`

这些 `tmp/` 产物是本地辅助证据，不作为长期交付物；长期可追溯结论以本文件、候选矩阵和交叉核验文档为准。

## 输出汇总

- 候选数量：28。
- 大明候选：9。
- 蒙古候选：14。
- 后金候选：5。
- 最大缩略图：约 19.8 KB。
- 最大标题裁切：约 6.8 KB。
- EasyOCR 尝试曾受路径编码和内存/显存不足影响，未形成稳定逐牌识别结果。
- 后续已通过低分辨率安全预览完成 28 条候选核读：全部为人物牌、纪年/剧本类牌或人物效果相关非普通牌。
- 当前全部候选均已排除为非普通手牌，不能补普通事件、军备、战术或银两映射。

## 当前裁决

- 这一步把人工读牌/OCR 对象从三张大图收敛为 28 条小图候选，并完成后续低分辨率人工核读。
- 28 条候选全部已排除；仍没有普通事件、军备、战术或银两的中文牌名、牌类、规则效果或军备目标确认记录。
- 不得反写 `cardKind / cardDefId / armamentId`。
- 不得勾选 OpenSpec `2.4` 或 `4.5`。

## 下一步

运行时图集候选链已被证伪。后续只能寻找可追溯逐牌牌表、对非运行时图集来源做可靠 OCR 后人工确认，或找到其他可审计普通手牌录入来源，再按 `qidahen-hand-card-formal-mapping-contract.md` 的反写契约进入正式映射候选。
