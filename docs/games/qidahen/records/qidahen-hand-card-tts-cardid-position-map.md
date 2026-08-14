# 七大恨 TTS CardID 到图集位置清单

> 这份清单只把 TTS `DeckIDs` 转成可审计的图集位置和重复次数；它不能提供中文牌名、牌类、效果或军备目标，因此不能作为正式手牌规则映射。

## 输入与边界

- 来源：`D:\gongzuo\webgame\gameasset\七大恨 中文mod\Workshop\2228142777.json`
- 本步骤只读取 JSON 文本，不读取图片。
- 位置换算：
  - `deckId = floor(CardID / 100)`
  - `index = CardID % 100`
  - `row = floor(index / 10) + 1`
  - `col = (index % 10) + 1`
- 当前只用于把人工复核从“猜图集行列”推进为“可追踪 CardID / 行 / 列 / 出现次数”。

## 牌库对象汇总

| TTS 路径 | deckId | DeckIDs 数 | 唯一 CardID 数 | 可用结论 |
| --- | ---: | ---: | ---: | --- |
| `$/ObjectStates[6]` | 13 | 12 | 12 | 可证明 deck 13 中 12 张具体 CardID 的出现顺序；FaceURL 哈希命中蒙古牌库图集/整版 |
| `$/ObjectStates[7]` | 17 | 24 | 15 | 可证明 deck 17 中 15 个唯一 CardID，部分重复出现；FaceURL 哈希命中朝鲜牌库图集/整版 |
| `$/ObjectStates[8]` | 16 | 42 | 19 | 可证明 deck 16 中 19 个唯一 CardID，部分重复出现；FaceURL 哈希命中纪年卡图集/整版 |
| `$/ObjectStates[9]` | 16 | 20 | 16 | 同属 deck 16 的另一组牌库对象，不能单独解释为完整普通手牌牌表 |
| `$/ObjectStates[17]` | 16 | 22 | 14 | 同属 deck 16 的另一组牌库对象，不能单独解释为完整普通手牌牌表 |
| `$/ObjectStates[22]` | 16 | 3 | 3 | 同属 deck 16 的小型牌组对象 |
| `$/ObjectStates[23]` | 5 / 6 / 7 / 14 | 4 | 4 | 非主要 13 / 16 / 17 牌库，需另行判定用途 |
| `$/ObjectStates[25]` | 2 | 9 | 9 | 非主要 13 / 16 / 17 牌库，需另行判定用途 |
| `$/ObjectStates[26]` | 15 | 5 | 5 | 非主要 13 / 16 / 17 牌库，需另行判定用途 |
| `$/ObjectStates[47]` | 13 | 2 | 2 | deck 13 的小型牌组对象 |

## 主要牌库位置样例

| TTS 路径 | CardID | deckId | index | 行 | 列 | 出现次数 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `$/ObjectStates[6]` | 1306 | 13 | 6 | 1 | 7 | 1 |
| `$/ObjectStates[6]` | 1330 | 13 | 30 | 4 | 1 | 1 |
| `$/ObjectStates[6]` | 1308 | 13 | 8 | 1 | 9 | 1 |
| `$/ObjectStates[6]` | 1307 | 13 | 7 | 1 | 8 | 1 |
| `$/ObjectStates[6]` | 1350 | 13 | 50 | 6 | 1 | 1 |
| `$/ObjectStates[6]` | 1303 | 13 | 3 | 1 | 4 | 1 |
| `$/ObjectStates[6]` | 1320 | 13 | 20 | 3 | 1 | 1 |
| `$/ObjectStates[6]` | 1340 | 13 | 40 | 5 | 1 | 1 |
| `$/ObjectStates[6]` | 1309 | 13 | 9 | 1 | 10 | 1 |
| `$/ObjectStates[6]` | 1305 | 13 | 5 | 1 | 6 | 1 |
| `$/ObjectStates[6]` | 1310 | 13 | 10 | 2 | 1 | 1 |
| `$/ObjectStates[6]` | 1304 | 13 | 4 | 1 | 5 | 1 |
| `$/ObjectStates[7]` | 1708 | 17 | 8 | 1 | 9 | 1 |
| `$/ObjectStates[7]` | 1703 | 17 | 3 | 1 | 4 | 3 |
| `$/ObjectStates[7]` | 1760 | 17 | 60 | 7 | 1 | 1 |
| `$/ObjectStates[7]` | 1701 | 17 | 1 | 1 | 2 | 3 |
| `$/ObjectStates[7]` | 1709 | 17 | 9 | 1 | 10 | 3 |
| `$/ObjectStates[7]` | 1704 | 17 | 4 | 1 | 5 | 1 |
| `$/ObjectStates[7]` | 1700 | 17 | 0 | 1 | 1 | 3 |
| `$/ObjectStates[7]` | 1750 | 17 | 50 | 6 | 1 | 1 |
| `$/ObjectStates[7]` | 1702 | 17 | 2 | 1 | 3 | 2 |
| `$/ObjectStates[8]` | 1631 | 16 | 31 | 4 | 2 | 1 |
| `$/ObjectStates[8]` | 1644 | 16 | 44 | 5 | 5 | 2 |
| `$/ObjectStates[8]` | 1643 | 16 | 43 | 5 | 4 | 10 |
| `$/ObjectStates[8]` | 1626 | 16 | 26 | 3 | 7 | 8 |
| `$/ObjectStates[8]` | 1637 | 16 | 37 | 4 | 8 | 1 |
| `$/ObjectStates[8]` | 1627 | 16 | 27 | 3 | 8 | 2 |
| `$/ObjectStates[8]` | 1641 | 16 | 41 | 5 | 2 | 2 |
| `$/ObjectStates[8]` | 1646 | 16 | 46 | 5 | 7 | 1 |

## 当前结论

- TTS `DeckIDs` 能把候选卡定位到图集行列，并能显示部分 CardID 的重复次数。
- 2026-07-03 文本交叉核验显示：TTS `deckId 13 / 16 / 17` 的 FaceURL 哈希分别命中素材接入清单里的蒙古、纪年、朝鲜整版图集，不等价于运行时 `ming-faction-deck-atlas / mongol-faction-deck-atlas / jin-faction-deck-atlas`。
- 因此这份清单只能帮助复核 TTS 牌组对象，不能直接把 `CardID / deckId / row / col` 映射到当前正式手牌预览帧。
- 但 TTS `DeckIDs` 仍没有逐牌 `Nickname / Description`，也没有牌类、效果或军备目标。
- 因此这份清单只能降低人工复核成本，不能关闭 OpenSpec `2.4`。
- OpenSpec `2.4` 和 `4.5` 继续保持未完成。
