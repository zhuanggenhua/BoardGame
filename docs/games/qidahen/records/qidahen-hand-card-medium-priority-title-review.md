# 七大恨 medium 优先级标题核读索引

> 这份索引只服务人工核读；OCR 候选仍不得直接写入正式手牌规则映射。

## 安全边界

- 来源只包含 7 张 medium 优先级安全标题小裁切。
- 每张源图是单卡标题条，不是整张 10x7 图集，也不是完整牌面图。
- 放大核读图册：`tmp\qidahen-card-sheets\safe-title-previews\review-sheets\medium-priority-title-review.jpg`。
- 图册位于 `tmp/`，仍是本地辅助输入；长期结论以本 Markdown 和人工录入矩阵为准。
- 本轮只生成索引和本地辅助图册，没有直接读取该图册进入模型上下文。

## 候选清单

| id | 阵营 | 行 | 列 | OCR候选 | 置信度 | 安全小裁切 | 人工确认 |
| --- | --- | ---: | ---: | --- | ---: | --- | --- |
| jin_r01_c02 | jin | 1 | 2 | 金范文程农 | 0.6668 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c02_title.jpg` | 待复核 |
| jin_r01_c10 | jin | 1 | 10 | 金努丽哈赤孓 | 0.4583 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c10_title.jpg` | 待复核 |
| ming_r01_c02 | ming | 1 | 2 | 蹂承宗 | 0.56 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c02_title.jpg` | 待复核 |
| ming_r03_c01 | ming | 3 | 1 | 鲷王尤真 | 0.6471 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r03_c01_title.jpg` | 待复核 |
| ming_r06_c01 | ming | 6 | 1 | 酮高罩 | 0.5992 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r06_c01_title.jpg` | 待复核 |
| ming_r07_c01 | ming | 7 | 1 | 鲷高霈 | 0.5743 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r07_c01_title.jpg` | 待复核 |
| mongol_r01_c01 | mongol | 1 | 1 | 孓卯胡酃 | 0.5996 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c01_title.jpg` | 待复核 |

## 当前结论

- 已完成 medium 优先级核读入口整理，但未做模型图片读取。
- medium 候选仍只是 OCR 排序入口；当前没有人工确认的中文牌名、牌类、效果文本或军备目标。
- 因此 medium 候选不能推进正式手牌一级入口完成，OpenSpec `2.4` 和 `4.5` 继续保持未完成。
