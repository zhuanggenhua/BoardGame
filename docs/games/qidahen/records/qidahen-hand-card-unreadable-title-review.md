# 七大恨 unreadable 标题核读索引

> 这份索引只服务人工或外部 OCR 复核；OCR 不可读结果不得直接写入正式手牌规则映射。

## 安全边界

- 来源只包含 7 张 unreadable 安全标题小裁切。
- 每张源图是单卡标题条，不是整张 10x7 图集，也不是完整牌面图。
- 放大核读图册：`tmp\qidahen-card-sheets\safe-title-previews\review-sheets\unreadable-priority-title-review.jpg`。
- 图册位于 `tmp/`，仍是本地辅助输入；长期结论以本 Markdown 和人工录入矩阵为准。
- 本轮只生成索引和本地辅助图册，没有直接读取该图册进入模型上下文。

## 候选清单

| id | 阵营 | 行 | 列 | OCR候选 | 置信度 | 安全小裁切 | 人工确认 |
| --- | --- | ---: | ---: | --- | ---: | --- | --- |
| jin_r02_c01 | jin | 2 | 1 | 不可读 | 0.0 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r02_c01_title.jpg` | 待外部 OCR/人工复核 |
| jin_r03_c01 | jin | 3 | 1 | 不可读 | 0.0 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r03_c01_title.jpg` | 待外部 OCR/人工复核 |
| jin_r04_c01 | jin | 4 | 1 | 不可读 | 0.0 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r04_c01_title.jpg` | 待外部 OCR/人工复核 |
| jin_r05_c01 | jin | 5 | 1 | 不可读 | 0.0 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r05_c01_title.jpg` | 待外部 OCR/人工复核 |
| jin_r06_c01 | jin | 6 | 1 | 不可读 | 0.0 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r06_c01_title.jpg` | 待外部 OCR/人工复核 |
| ming_r07_c10 | ming | 7 | 10 | 不可读 | 0.0 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r07_c10_title.jpg` | 待外部 OCR/人工复核 |
| mongol_r07_c10 | mongol | 7 | 10 | 不可读 | 0.0 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r07_c10_title.jpg` | 待外部 OCR/人工复核 |

## 当前结论

- 已完成 unreadable 候选核读入口整理，但未做模型图片读取。
- 这 7 张候选当前 OCR 置信度为 0，不能提供中文牌名、牌类、效果文本或军备目标。
- 因此 unreadable 候选只能作为后续外部 OCR 或人工复核入口，OpenSpec `2.4` 和 `4.5` 继续保持未完成。
