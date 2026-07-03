# 七大恨 low 优先级标题核读索引

> 这份索引只服务人工核读；OCR 候选仍不得直接写入正式手牌规则映射。

## 安全边界

- 来源只包含 19 张 low 优先级安全标题小裁切。
- 每张源图是单卡标题条，不是整张 10x7 图集，也不是完整牌面图。
- 放大核读图册：`tmp\qidahen-card-sheets\safe-title-previews\review-sheets\low-priority-title-review.jpg`。
- 图册位于 `tmp/`，仍是本地辅助输入；长期结论以本 Markdown 和人工录入矩阵为准。
- 本轮只生成索引和本地辅助图册，没有直接读取该图册进入模型上下文。

## 候选清单

| id | 阵营 | 行 | 列 | OCR候选 | 置信度 | 安全小裁切 | 人工确认 |
| --- | --- | ---: | ---: | --- | ---: | --- | --- |
| jin_r01_c01 | jin | 1 | 1 | 企撂古利 | 0.0284 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c01_title.jpg` | 待复核 |
| jin_r01_c09 | jin | 1 | 9 | 亚皇太趣 | 0.0557 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c09_title.jpg` | 待复核 |
| ming_r01_c03 | ming | 1 | 3 | 鲷蹂元尤 | 0.3224 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c03_title.jpg` | 待复核 |
| ming_r01_c06 | ming | 1 | 6 | 鲷魏忠臀 | 0.2076 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c06_title.jpg` | 待复核 |
| ming_r01_c07 | ming | 1 | 7 | 鲷袁崇焕品日 | 0.2597 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c07_title.jpg` | 待复核 |
| ming_r04_c01 | ming | 4 | 1 | 圆王尤真 | 0.1746 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r04_c01_title.jpg` | 待复核 |
| mongol_r01_c04 | mongol | 1 | 4 | 怒牢 | 0.001 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c04_title.jpg` | 待复核 |
| mongol_r01_c05 | mongol | 1 | 5 | 忽牢 | 0.0124 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c05_title.jpg` | 待复核 |
| mongol_r01_c06 | mongol | 1 | 6 | 忽牢书棠古大叨伎全 | 0.0104 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c06_title.jpg` | 待复核 |
| mongol_r01_c07 | mongol | 1 | 7 | 忽牢节 | 0.0035 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c07_title.jpg` | 待复核 |
| mongol_r01_c08 | mongol | 1 | 8 | 忽牢卡禳全大叨萦古 | 0.0314 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c08_title.jpg` | 待复核 |
| mongol_r01_c09 | mongol | 1 | 9 | 怒牢声网日大明禧全蒙古 | 0.0316 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c09_title.jpg` | 待复核 |
| mongol_r01_c10 | mongol | 1 | 10 | 牢卡筱全崇古大明 | 0.0308 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c10_title.jpg` | 待复核 |
| mongol_r02_c01 | mongol | 2 | 1 | 怒牢书 | 0.0008 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r02_c01_title.jpg` | 待复核 |
| mongol_r03_c01 | mongol | 3 | 1 | 怒牢节金大明古 | 0.0032 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r03_c01_title.jpg` | 待复核 |
| mongol_r04_c01 | mongol | 4 | 1 | 忽牢卡 | 0.0012 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r04_c01_title.jpg` | 待复核 |
| mongol_r05_c01 | mongol | 5 | 1 | 忽牢卡 | 0.0664 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r05_c01_title.jpg` | 待复核 |
| mongol_r06_c01 | mongol | 6 | 1 | 忽牢卡 | 0.0213 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r06_c01_title.jpg` | 待复核 |
| mongol_r07_c01 | mongol | 7 | 1 | 忽牢卡 | 0.0039 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r07_c01_title.jpg` | 待复核 |

## 当前结论

- 已完成 low 优先级核读入口整理，但未做模型图片读取。
- low 候选置信度整体较低，OCR 文本错读风险更高；当前没有人工确认的中文牌名、牌类、效果文本或军备目标。
- 因此 low 候选不能推进正式手牌一级入口完成，OpenSpec `2.4` 和 `4.5` 继续保持未完成。
