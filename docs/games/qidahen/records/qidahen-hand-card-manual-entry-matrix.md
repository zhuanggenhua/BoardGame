# 七大恨普通手牌人工录入矩阵

> 这份矩阵是正式手牌真相源的人工录入工作台，不是规则映射。未人工确认中文牌名、牌类、效果和军备目标前，不得把 OCR 候选写入正式手牌逻辑。

## 使用边界

- 来源：49 张安全单卡标题裁切的 EasyOCR 候选结果。
- OCR 文本只用于排序和提示，不能作为中文牌名真相源。
- 人工确认必须回到单张小标题裁切或更清晰原素材，不能只看本表。
- `2.4` 和 `4.5` 在本表未补齐前必须继续保持未完成。
- 辅助 OCR 索引：
  - 批量牌面 OCR 记录：`docs/games/qidahen/records/qidahen-hand-card-easyocr-batch-review.md`
  - 关键词分流记录：`docs/games/qidahen/records/qidahen-hand-card-ocr-keyword-triage.md`
  - 这些索引只能帮助人工录入定位候选正文；不得把 OCR 文本自动填入“人工中文牌名 / 人工牌类 / 规则效果摘要 / 军备目标”。

## 待录入字段

| 字段 | 录入要求 |
| --- | --- |
| 行列位置 | 用于回到原裁切位点复核 |
| 安全小裁切 | 单张标题小图路径，优先用它核对牌名 |
| 人工中文牌名 | 按牌面录入，不能直接复制 OCR 错字 |
| 人工牌类 | 事件 / 军备 / 战术 / 银两 / 人物 / 剧本 / 纪年 / 牌背 / 其他 / 不可读 |
| 规则效果摘要 | 录入可执行效果；看不清时写“待复核” |
| 军备目标 | 仅军备牌填写对应 `armamentId`；非军备留空 |
| 复核状态 | 待复核 / 已确认 / 排除 / 不可读 |

## 录入矩阵

| id | 阵营 | 行 | 列 | 安全小裁切 | OCR优先级 | OCR候选 | 置信度 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| --- | --- | ---: | ---: | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| jin_r01_c03 | jin | 1 | 3 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c03_title.jpg` | high | 金阿敏 | 0.9852 | 阿敏 | 人物 | 人物牌标题；非普通事件、军备、战术或银两 |  | 已排除 |
| jin_r01_c04 | jin | 1 | 4 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c04_title.jpg` | high | 金莽古蠃泰虫日 | 0.9420 | 莽古尔泰 | 人物 | 人物效果和人物一览 |  | 已排除 |
| jin_r01_c05 | jin | 1 | 5 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c05_title.jpg` | high | 金额亦都 | 0.9743 | 额亦都 | 人物 | 人物牌标题；非普通事件、军备、战术或银两 |  | 已排除 |
| jin_r01_c06 | jin | 1 | 6 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c06_title.jpg` | high | 金代鲁氽 | 0.9227 | 代善 | 人物 | 人物效果 |  | 已排除 |
| jin_r01_c07 | jin | 1 | 7 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c07_title.jpg` | high | 金皇太趣 | 0.9820 | 皇太极 | 人物 | 人物牌标题；非普通事件、军备、战术或银两 |  | 已排除 |
| jin_r01_c08 | jin | 1 | 8 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c08_title.jpg` | high | 金阿敏 | 0.9422 | 阿敏 | 人物 | 朝鲜词来自人物效果 |  | 已排除 |
| ming_r01_c01 | ming | 1 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c01_title.jpg` | high | 熊廷弼 | 0.9240 | 熊廷弼 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| ming_r01_c04 | ming | 1 | 4 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c04_title.jpg` | high | 毛女麓 | 0.9256 | 毛文龙 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| ming_r01_c05 | ming | 1 | 5 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c05_title.jpg` | high | 鲷镐 | 0.8974 | 杨镐 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| ming_r01_c08 | ming | 1 | 8 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c08_title.jpg` | high | 高界 | 0.8635 | 高第 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| ming_r01_c09 | ming | 1 | 9 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c09_title.jpg` | high | 鲷壬尤真鼎 | 0.8071 | 王化贞 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| ming_r01_c10 | ming | 1 | 10 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c10_title.jpg` | high | 鲷王比真 | 0.7910 | 王化贞 | 人物 | 人物牌标题；非普通事件、军备、战术或银两 |  | 已排除 |
| ming_r02_c01 | ming | 2 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r02_c01_title.jpg` | high | 鲷王尤真 | 0.8951 | 王化贞 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| ming_r05_c01 | ming | 5 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r05_c01_title.jpg` | high | 酮高罩 | 0.8944 | 高第 | 人物 | 人物牌标题；非普通事件、军备、战术或银两 |  | 已排除 |
| mongol_r01_c02 | mongol | 1 | 2 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c02_title.jpg` | high | 蕹厮耿 | 0.9930 | 萨囊彻辰 | 人物 | 人物牌标题；非普通事件、军备、战术或银两 |  | 已排除 |
| mongol_r01_c03 | mongol | 1 | 3 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c03_title.jpg` | high | 叫海圃艺靓 | 0.9365 | 山海关之战（1622） | 纪年 / 剧本 | 历史年份事件说明与势力顺序/效果 |  | 已排除 |
| jin_r01_c02 | jin | 1 | 2 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c02_title.jpg` | medium | 金范文程农 | 0.6668 | 范文程 | 人物 | 人物牌标题；非普通事件、军备、战术或银两 |  | 已排除 |
| jin_r01_c10 | jin | 1 | 10 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c10_title.jpg` | medium | 金努丽哈赤孓 | 0.4583 | 努尔哈赤 | 人物 | 人物牌标题；非普通事件、军备、战术或银两 |  | 已排除 |
| ming_r01_c02 | ming | 1 | 2 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c02_title.jpg` | medium | 蹂承宗 | 0.5600 | 孙承宗 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| ming_r03_c01 | ming | 3 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r03_c01_title.jpg` | medium | 鲷王尤真 | 0.6471 | 王化贞 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| ming_r06_c01 | ming | 6 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r06_c01_title.jpg` | medium | 酮高罩 | 0.5992 | 高第 | 人物 | 人物牌标题；非普通事件、军备、战术或银两 |  | 已排除 |
| ming_r07_c01 | ming | 7 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r07_c01_title.jpg` | medium | 鲷高霈 | 0.5743 | 高第 | 人物 | 人物牌标题；非普通事件、军备、战术或银两 |  | 已排除 |
| mongol_r01_c01 | mongol | 1 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c01_title.jpg` | medium | 孓卯胡酃 | 0.5996 | 丁卯胡乱（1627） | 纪年 / 剧本 | 历史年份事件说明与势力顺序/效果 |  | 已排除 |
| jin_r01_c01 | jin | 1 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c01_title.jpg` | low | 企撂古利 | 0.0284 | 努尔哈赤 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| jin_r01_c09 | jin | 1 | 9 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r01_c09_title.jpg` | low | 亚皇太趣 | 0.0557 | 皇太极 | 人物 | 人物效果；科技来自人物正文 |  | 已排除 |
| ming_r01_c03 | ming | 1 | 3 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c03_title.jpg` | low | 鲷蹂元尤 | 0.3224 | 孙元化 | 人物 | 人物效果；科技/打出来自人物正文 |  | 已排除 |
| ming_r01_c06 | ming | 1 | 6 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c06_title.jpg` | low | 鲷魏忠臀 | 0.2076 | 魏忠贤 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| ming_r01_c07 | ming | 1 | 7 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r01_c07_title.jpg` | low | 鲷袁崇焕品日 | 0.2597 | 袁崇焕 | 人物 | 人物效果；打出来自人物正文 |  | 已排除 |
| ming_r04_c01 | ming | 4 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r04_c01_title.jpg` | low | 圆王尤真 | 0.1746 | 王化贞 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| mongol_r01_c04 | mongol | 1 | 4 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c04_title.jpg` | low | 怒牢 | 0.0010 | 纪年卡 | 纪年 / 剧本 | 势力顺序、事件效果和人物/得分条件 |  | 已排除 |
| mongol_r01_c05 | mongol | 1 | 5 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c05_title.jpg` | low | 忽牢 | 0.0124 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出或得分条件 |  | 已排除 |
| mongol_r01_c06 | mongol | 1 | 6 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c06_title.jpg` | low | 忽牢书棠古大叨伎全 | 0.0104 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出或得分条件 |  | 已排除 |
| mongol_r01_c07 | mongol | 1 | 7 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c07_title.jpg` | low | 忽牢节 | 0.0035 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| mongol_r01_c08 | mongol | 1 | 8 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c08_title.jpg` | low | 忽牢卡禳全大叨萦古 | 0.0314 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| mongol_r01_c09 | mongol | 1 | 9 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c09_title.jpg` | low | 怒牢声网日大明禧全蒙古 | 0.0316 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| mongol_r01_c10 | mongol | 1 | 10 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r01_c10_title.jpg` | low | 牢卡筱全崇古大明 | 0.0308 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| mongol_r02_c01 | mongol | 2 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r02_c01_title.jpg` | low | 怒牢书 | 0.0008 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| mongol_r03_c01 | mongol | 3 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r03_c01_title.jpg` | low | 怒牢节金大明古 | 0.0032 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| mongol_r04_c01 | mongol | 4 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r04_c01_title.jpg` | low | 忽牢卡 | 0.0012 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| mongol_r05_c01 | mongol | 5 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r05_c01_title.jpg` | low | 忽牢卡 | 0.0664 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| mongol_r06_c01 | mongol | 6 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r06_c01_title.jpg` | low | 忽牢卡 | 0.0213 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| mongol_r07_c01 | mongol | 7 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r07_c01_title.jpg` | low | 忽牢卡 | 0.0039 | 纪年卡 | 纪年 / 剧本 | 纪年或剧本类牌；非普通事件、军备、战术或银两 |  | 已排除 |
| jin_r02_c01 | jin | 2 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r02_c01_title.jpg` | unreadable |  | 0.0000 |  | 牌背 / 空白 |  |  | 已排除 |
| jin_r03_c01 | jin | 3 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r03_c01_title.jpg` | unreadable |  | 0.0000 |  | 牌背 / 空白 |  |  | 已排除 |
| jin_r04_c01 | jin | 4 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r04_c01_title.jpg` | unreadable |  | 0.0000 |  | 牌背 / 空白 |  |  | 已排除 |
| jin_r05_c01 | jin | 5 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r05_c01_title.jpg` | unreadable |  | 0.0000 |  | 牌背 / 空白 |  |  | 已排除 |
| jin_r06_c01 | jin | 6 | 1 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/jin_r06_c01_title.jpg` | unreadable |  | 0.0000 |  | 牌背 / 空白 |  |  | 已排除 |
| ming_r07_c10 | ming | 7 | 10 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/ming_r07_c10_title.jpg` | unreadable |  | 0.0000 |  | 牌背 / 空白 |  |  | 已排除 |
| mongol_r07_c10 | mongol | 7 | 10 | `tmp/qidahen-card-sheets/safe-title-previews/per-card/mongol_r07_c10_title.jpg` | unreadable |  | 0.0000 |  | 不可读 / 其他 |  |  | 已排除 |

## 当前结论

- 本矩阵已把 49 张候选从临时 OCR 输出转成可提交的人工录入工作台，并完成这一轮低分辨率标题预览核读回填。
- 49 张候选当前全部被排除为人物、纪年/剧本、牌背/空白、不可读或其他非普通手牌来源；没有任何行达到普通事件、军备、战术或银两的“已确认”门槛。
- 当前没有任何一行达到“已确认”状态，因此仍不能修改正式手牌规则映射。
- 下一步若继续推进，应按 high → medium → low → unreadable 的顺序逐张打开安全小裁切或原素材人工确认。
