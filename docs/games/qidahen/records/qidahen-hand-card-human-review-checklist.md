# 七大恨普通手牌人工复核清单

> 这份清单只用于安排人工复核，不是正式规则映射。未人工确认中文牌名、牌类、效果和军备目标前，不得把任何候选写入正式手牌逻辑。

## 输入与边界

- 来源：
  - `docs/games/qidahen/records/qidahen-hand-card-remaining-manual-review-queue.md`
  - `docs/games/qidahen/records/qidahen-hand-card-remaining-review-subtriage.md`
  - `docs/games/qidahen/records/qidahen-hand-card-final-candidate-safe-ocr.md`
- 本清单不直接读取大图，只引用已生成的安全标题小裁切路径和 OCR 文本摘要。
- `tmp/` 路径只是本地人工看图入口；长期结论必须回写到本文件、人工录入矩阵或正式规则映射文档。
- “疑似人物牌文本”“低信息/疑似牌背或空白”都不是最终排除结论；人工复核前仍不得关闭 OpenSpec `2.4`。

## 当前汇总

| 分流 | 数量 | 当前处理口径 |
| --- | ---: | --- |
| 疑似人物牌文本 | 5 | 已通过低分辨率标题预览确认并排除为人物牌 |
| 低信息/疑似牌背或空白 | 6 | 已通过低分辨率标题预览确认并排除为牌背、空白或不可读 |
| 仍需人工看图 | 1 | 已通过低分辨率标题预览确认不具备普通手牌字段，先排除为不可读/非普通候选 |
| 可直接确认为普通事件/军备/战术/银两 | 0 | 当前没有任何候选达到正式规则映射门槛 |

## 人工复核字段

| 字段 | 录入要求 |
| --- | --- |
| 人工结论 | 普通事件 / 军备 / 战术 / 银两 / 人物 / 剧本 / 纪年 / 牌背 / 空白 / 不可读 / 其他 |
| 中文牌名 | 按牌面人工录入；不得直接复制 OCR 错字 |
| 规则效果摘要 | 若是普通事件、军备、战术或银两，必须能写出规则效果；看不清写“待复核” |
| 军备目标 | 仅军备牌填写对应 `armamentId`；非军备留空 |
| 排除原因 | 若非普通手牌，写清为什么排除 |
| 复核状态 | 待人工复核 / 已确认 / 已排除 / 不可读 |

## 复核清单

| id | 阵营 | 行 | 列 | 安全小裁切 | 当前分流 | OCR 线索摘要 | 人工结论 | 中文牌名 | 规则效果摘要 | 军备目标 | 排除原因 | 复核状态 |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| jin_r01_c01 | 后金 | 1 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c01_title.jpg` | 疑似人物牌文本 | 标题 OCR 近似“撂古利”；正文出现“人物牌堆 / 下野”等人物牌机制词 | 人物 | 拐古利 | 人物效果和骰点结果 |  | 牌面为后金人物牌，不是普通事件、军备、战术或银两 | 已排除 |
| ming_r01_c09 | 大明 | 1 | 9 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c09_title.jpg` | 疑似人物牌文本 | 标题 OCR 近似“王尤真”；正文出现“人物 / 下野 / 大明人物牌堆”等人物牌机制词 | 人物 | 王化贞 | 人物效果和骰点结果 |  | 牌面为大明人物牌，不是普通事件、军备、战术或银两 | 已排除 |
| ming_r02_c01 | 大明 | 2 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r02_c01_title.jpg` | 疑似人物牌文本 | 标题 OCR 近似“王尤真”；正文出现“人物 / 下野 / 大明人物牌堆”等人物牌机制词 | 人物 | 王化贞 | 人物效果和骰点结果 |  | 牌面为大明人物牌，不是普通事件、军备、战术或银两 | 已排除 |
| ming_r03_c01 | 大明 | 3 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r03_c01_title.jpg` | 疑似人物牌文本 | 标题 OCR 近似“王尤真”；正文出现“人物 / 下野 / 大明人物牌堆”等人物牌机制词 | 人物 | 王化贞 | 人物效果和骰点结果 |  | 牌面为大明人物牌，不是普通事件、军备、战术或银两 | 已排除 |
| ming_r04_c01 | 大明 | 4 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r04_c01_title.jpg` | 疑似人物牌文本 | 标题 OCR 近似“王尤真”；正文出现“人物 / 下野 / 大明人物牌堆”等人物牌机制词 | 人物 | 王化贞 | 人物效果和骰点结果 |  | 牌面为大明人物牌，不是普通事件、军备、战术或银两 | 已排除 |
| jin_r02_c01 | 后金 | 2 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r02_c01_title.jpg` | 低信息/疑似牌背或空白 | OCR 仅抽出极少符号和“金” | 牌背 / 空白 |  |  |  | 低分辨率标题预览只见牌背花纹或空白裁切，不具备普通手牌字段 | 已排除 |
| jin_r03_c01 | 后金 | 3 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r03_c01_title.jpg` | 低信息/疑似牌背或空白 | OCR 仅抽出“金” | 牌背 / 空白 |  |  |  | 低分辨率标题预览只见牌背花纹或空白裁切，不具备普通手牌字段 | 已排除 |
| jin_r04_c01 | 后金 | 4 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r04_c01_title.jpg` | 低信息/疑似牌背或空白 | OCR 仅抽出符号和“金” | 牌背 / 空白 |  |  |  | 低分辨率标题预览只见牌背花纹或空白裁切，不具备普通手牌字段 | 已排除 |
| jin_r05_c01 | 后金 | 5 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r05_c01_title.jpg` | 低信息/疑似牌背或空白 | OCR 仅抽出“金” | 牌背 / 空白 |  |  |  | 低分辨率标题预览只见牌背花纹或空白裁切，不具备普通手牌字段 | 已排除 |
| jin_r06_c01 | 后金 | 6 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r06_c01_title.jpg` | 低信息/疑似牌背或空白 | OCR 仅抽出“金” | 牌背 / 空白 |  |  |  | 低分辨率标题预览只见牌背花纹或空白裁切，不具备普通手牌字段 | 已排除 |
| ming_r07_c10 | 大明 | 7 | 10 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r07_c10_title.jpg` | 低信息/疑似牌背或空白 | OCR 仅抽出“明”和少量符号 | 牌背 / 空白 |  |  |  | 低分辨率标题预览只见牌背/空白裁切，不具备普通手牌字段 | 已排除 |
| mongol_r07_c10 | 蒙古 | 7 | 10 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r07_c10_title.jpg` | 仍需人工看图 | 安全变体 OCR 没有稳定中文牌名、牌类、效果或军备目标 | 不可读 / 其他 |  |  |  | 低分辨率标题预览只见局部插画或装饰，不能确认普通手牌字段 | 已排除 |

## 关闭门槛

- 若人工确认某候选是普通事件、军备、战术或银两牌，必须同步补齐中文牌名、牌类、规则效果摘要；军备牌还必须补齐军备目标。
- 若人工确认某候选不是普通手牌，必须写清排除原因，并同步回写人工录入矩阵。
- 当前 12 张剩余候选已通过低分辨率标题预览完成排除；但只有 49 张候选全部被确认、排除或标为不可读，并且普通手牌规则映射有可追溯来源后，OpenSpec `2.4` 才能重新评估是否可勾选。
- 在这之前，OpenSpec `2.4` 和 `4.5` 必须继续保持未完成。
