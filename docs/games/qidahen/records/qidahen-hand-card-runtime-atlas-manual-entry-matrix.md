# 七大恨运行时手牌图集候选人工录入矩阵

> 这份矩阵只保留已通过文本交叉核验、可能对应运行时 faction hand preview atlas 的 TTS `DeckIDs` 候选。它不是正式规则映射；未人工确认中文牌名、牌类、效果和军备目标前，不得反写 `cardKind / cardDefId / armamentId`。

## 输入与边界

- 来源：`D:\gongzuo\webgame\gameasset\七大恨 中文mod\Workshop\2228142777.json`。
- 交叉依据：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-tts-crosswalk.md`。
- 本矩阵只读取 TTS JSON、素材接入清单和运行时代码文本，不读取图片。
- 只纳入已命中运行时 faction hand preview atlas 的候选：大明 `deckKey 2`、蒙古 `deckKey 13`、后金 `deckKey 15`。
- 纪年 `deckKey 16`、朝鲜 `deckKey 17` 以及其他非 faction deck 不纳入本矩阵。
- 2026-07-03 已通过低分辨率安全预览完成 28 条候选核读；所有候选均为人物牌、纪年/剧本类牌或人物效果相关非普通牌，不能反写正式手牌规则映射。

## 汇总

- 候选出现记录：28。
- 唯一 CardID：28。
- 大明候选：9。
- 蒙古候选：14。
- 后金候选：5。
- 当前 28 条候选均已排除为非普通手牌。

## 人工录入矩阵

| TTS 路径 | 阵营 | 运行时 atlas | deckKey | 序号 | CardID | atlasIndex | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 1 | 1306 | 6 | 1 | 7 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 2 | 1330 | 30 | 4 | 1 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 3 | 1308 | 8 | 1 | 9 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 4 | 1307 | 7 | 1 | 8 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 5 | 1350 | 50 | 6 | 1 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 6 | 1303 | 3 | 1 | 4 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、事件效果和人物/得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 7 | 1320 | 20 | 3 | 1 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 8 | 1340 | 40 | 5 | 1 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 9 | 1309 | 9 | 1 | 10 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 10 | 1305 | 5 | 1 | 6 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出或得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 11 | 1310 | 10 | 2 | 1 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出和得分条件 |  | 已排除 |
| `$/ObjectStates[6]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 12 | 1304 | 4 | 1 | 5 | 1 | 纪年卡 | 纪年 / 剧本 | 势力顺序、人物打出或得分条件 |  | 已排除 |
| `$/ObjectStates[25]` | 大明 | `qidahen:ming-hand-preview` | 2 | 1 | 200 | 0 | 1 | 1 | 1 | 熊廷弼 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| `$/ObjectStates[25]` | 大明 | `qidahen:ming-hand-preview` | 2 | 2 | 201 | 1 | 1 | 2 | 1 | 孙承宗 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| `$/ObjectStates[25]` | 大明 | `qidahen:ming-hand-preview` | 2 | 3 | 202 | 2 | 1 | 3 | 1 | 孙元化 | 人物 | 人物效果；科技/打出来自人物正文 |  | 已排除 |
| `$/ObjectStates[25]` | 大明 | `qidahen:ming-hand-preview` | 2 | 4 | 203 | 3 | 1 | 4 | 1 | 毛文龙 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| `$/ObjectStates[25]` | 大明 | `qidahen:ming-hand-preview` | 2 | 5 | 206 | 6 | 1 | 7 | 1 | 袁崇焕 | 人物 | 人物效果；打出来自人物正文 |  | 已排除 |
| `$/ObjectStates[25]` | 大明 | `qidahen:ming-hand-preview` | 2 | 6 | 207 | 7 | 1 | 8 | 1 | 高第 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| `$/ObjectStates[25]` | 大明 | `qidahen:ming-hand-preview` | 2 | 7 | 220 | 20 | 3 | 1 | 1 | 王化贞 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| `$/ObjectStates[25]` | 大明 | `qidahen:ming-hand-preview` | 2 | 8 | 205 | 5 | 1 | 6 | 1 | 魏忠贤 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| `$/ObjectStates[25]` | 大明 | `qidahen:ming-hand-preview` | 2 | 9 | 204 | 4 | 1 | 5 | 1 | 杨镐 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| `$/ObjectStates[26]` | 后金 | `qidahen:jin-hand-preview` | 15 | 1 | 1505 | 5 | 1 | 6 | 1 | 代善 | 人物 | 人物效果 |  | 已排除 |
| `$/ObjectStates[26]` | 后金 | `qidahen:jin-hand-preview` | 15 | 2 | 1503 | 3 | 1 | 4 | 1 | 莽古尔泰 | 人物 | 人物效果和人物一览 |  | 已排除 |
| `$/ObjectStates[26]` | 后金 | `qidahen:jin-hand-preview` | 15 | 3 | 1507 | 7 | 1 | 8 | 1 | 阿敏 | 人物 | 朝鲜词来自人物效果 |  | 已排除 |
| `$/ObjectStates[26]` | 后金 | `qidahen:jin-hand-preview` | 15 | 4 | 1508 | 8 | 1 | 9 | 1 | 皇太极 | 人物 | 人物效果；科技来自人物正文 |  | 已排除 |
| `$/ObjectStates[26]` | 后金 | `qidahen:jin-hand-preview` | 15 | 5 | 1500 | 0 | 1 | 1 | 1 | 努尔哈赤 | 人物 | 人物效果和骰点结果 |  | 已排除 |
| `$/ObjectStates[47]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 1 | 1300 | 0 | 1 | 1 | 1 | 丁卯胡乱（1627） | 纪年 / 剧本 | 历史年份事件说明与势力顺序/效果 |  | 已排除 |
| `$/ObjectStates[47]` | 蒙古 | `qidahen:mongol-hand-preview` | 13 | 2 | 1302 | 2 | 1 | 3 | 1 | 山海关之战（1622） | 纪年 / 剧本 | 历史年份事件说明与势力顺序/效果 |  | 已排除 |

## 当前结论

- 本矩阵比旧的完整 CardID 矩阵更接近正式运行时入口，因为它只保留能通过哈希对应到 faction hand preview atlas 的 TTS 牌组。
- 但它仍不能关闭 OpenSpec `2.4`：28 条运行时图集候选已全部被核读为人物牌、纪年/剧本类牌或人物效果相关非普通牌，不能补普通事件、军备、战术或银两映射。
- 本矩阵当前已完成运行时图集候选证伪；后续不能再把这 28 条作为普通手牌正式映射候选。
- 2026-07-03 已生成安全复核入口说明：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-safe-review.md`。本地小图索引只用于人工/OCR 复核，仍不构成正式规则映射。
- 2026-07-03 已记录 EasyOCR 尝试失败证据：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-ocr-attempt.md`。当前 OCR 环境未稳定产出逐牌牌名、牌类、效果或军备目标。
- 2026-07-03 已新增既有 OCR 线索交叉表：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-existing-ocr-crosswalk.md`。28 条候选全部能匹配既有 OCR/核读线索，并已按后续安全预览核读全部排除；没有任何普通事件、军备、战术或银两确认行。
