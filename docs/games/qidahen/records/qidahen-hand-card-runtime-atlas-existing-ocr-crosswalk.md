# 七大恨运行时图集候选与既有 OCR 线索交叉表

> 本文件记录 2026-07-03 对 28 条运行时图集候选复用既有 OCR/人工核读文本的交叉结果，并在后续通过低分辨率安全预览完成逐批核读。本文件不是正式规则映射。

## 输入

- 候选矩阵：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-manual-entry-matrix.md`
- 既有 OCR 文档：
  - `docs/games/qidahen/records/qidahen-hand-card-easyocr-batch-review.md`
  - `docs/games/qidahen/records/qidahen-hand-card-high-priority-title-review.md`
  - `docs/games/qidahen/records/qidahen-hand-card-medium-priority-title-review.md`
  - `docs/games/qidahen/records/qidahen-hand-card-low-priority-title-review.md`
  - `docs/games/qidahen/records/qidahen-hand-card-unreadable-title-review.md`
- 本地辅助交叉输出：
  - `tmp/qidahen-card-sheets/runtime-atlas-safe-review/existing-ocr-crosswalk/runtime-atlas-existing-ocr-crosswalk.json`
  - `tmp/qidahen-card-sheets/runtime-atlas-safe-review/existing-ocr-crosswalk/runtime-atlas-existing-ocr-crosswalk.md`

## 汇总

- 候选数量：28。
- 命中既有 OCR/核读线索：28。
- 未命中既有线索：0。
- 既有 OCR 普通词与非普通线索混合：13。
- 既有 OCR 偏非普通手牌：11。
- 既有 OCR 普通关键词待人工确认：2。
- 既有 OCR 低信息待人工确认：2。

## 分流含义

| 分流 | 含义 | 能否反写 |
| --- | --- | --- |
| 既有 OCR 普通词与非普通线索混合 | OCR 文本里同时出现“打出/科技”等普通牌相关词，以及“人物/年度”等非普通线索 | 否 |
| 既有 OCR 偏非普通手牌 | OCR 文本主要命中人物、下野、叛逃、贝勒、朝鲜、纪年等线索 | 否 |
| 既有 OCR 普通关键词待人工确认 | OCR 文本只命中少量普通关键词，但缺人工确认牌名、牌类、效果和军备目标 | 否 |
| 既有 OCR 低信息待人工确认 | OCR 文本不足以判断牌类 | 否 |

> 上表“待人工确认”是交叉表生成时的分流名称。后续低分辨率安全预览已完成 28 条候选核读，并全部排除为人物牌、纪年/剧本类牌或人物效果相关非普通牌。

## 关键观察

- 蒙古候选多处命中“打出”，但同时命中“人物 / 年度”等线索，不能直接判断为普通事件、军备、战术或银两。
- 大明与后金候选多数命中人物、下野、叛逃、贝勒、朝鲜等非普通手牌线索。
- 仅靠既有 OCR 线索无法确认任何候选的完整字段：中文牌名、牌类、规则效果、军备目标。
- 当前仍没有任何候选达到 `qidahen-hand-card-formal-mapping-contract.md` 定义的反写门槛。

## 当前裁决

- 既有 OCR 线索可覆盖全部 28 条运行时图集候选，但线索含明显错读和非普通手牌信息。
- 后续安全预览核读已沉淀为 `docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-priority-review.md`：28 条候选全部被排除为人物牌、纪年/剧本类牌或人物效果相关非普通牌。
- 本交叉表和后续核读都不能证明任何候选是普通事件、军备、战术或银两牌。
- 不得把本交叉表反写到正式 `cardKind / cardDefId / armamentId`。
- OpenSpec `2.4` 和 `4.5` 继续保持未完成。

## 下一步

可继续推进的路径仍只有：

- 找其他非运行时图集来源做逐牌人工录入。
- 在内存充足或外部 OCR 环境中重跑更完整的非运行时候选 OCR，再由人工确认。
- 找到可追溯逐牌牌表。
