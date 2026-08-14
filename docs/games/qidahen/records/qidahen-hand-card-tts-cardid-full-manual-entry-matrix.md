# 七大恨 TTS CardID 完整人工录入矩阵

> 这份矩阵只把 TTS `DeckIDs` 展开为 CardID、图集行列和出现次数，作为后续人工录入的定位工作台。它不包含中文牌名、牌类、效果或军备目标，不能作为正式手牌规则映射。

## 输入与边界

- 来源：`D:\gongzuo\webgame\gameasset\七大恨 中文mod\Workshop\2228142777.json`
- 本步骤只读取 JSON 文本，不读取图片。
- 位置换算：`deckId = floor(CardID / 100)`，`index = CardID % 100`，`row = floor(index / 10) + 1`，`col = (index % 10) + 1`。
- 本矩阵保留重复 CardID 的出现顺序和出现次数，用于说明 TTS 牌组对象实际包含哪些图集位置。
- 2026-07-03 已按已有哈希交叉证据和低分辨率安全预览核读结果回填 143 行：没有任何行达到普通事件、军备、战术或银两的“已确认”门槛，仍不得反写正式 `cardKind / cardDefId / armamentId`。
- 2026-07-03 文本交叉核验补充：`deckId 13 / 16 / 17` 的图集哈希命中蒙古、纪年、朝鲜整版图集，不等价于当前运行时正式手牌预览使用的 `ming-faction-deck-atlas / mongol-faction-deck-atlas / jin-faction-deck-atlas`。因此本矩阵只保留为 TTS 牌组复核工作台，不得直接反写正式手牌规则映射。

## 完整矩阵

deck_count 10

## $/ObjectStates[6] deckKeys=13 count=12 unique=12
| 序号 | CardID | deckId | index | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 1306 | 13 | 6 | 1 | 7 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 2 | 1330 | 13 | 30 | 4 | 1 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 3 | 1308 | 13 | 8 | 1 | 9 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 4 | 1307 | 13 | 7 | 1 | 8 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 5 | 1350 | 13 | 50 | 6 | 1 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 6 | 1303 | 13 | 3 | 1 | 4 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 7 | 1320 | 13 | 20 | 3 | 1 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 8 | 1340 | 13 | 40 | 5 | 1 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 9 | 1309 | 13 | 9 | 1 | 10 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 10 | 1305 | 13 | 5 | 1 | 6 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 11 | 1310 | 13 | 10 | 2 | 1 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 12 | 1304 | 13 | 4 | 1 | 5 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |

## $/ObjectStates[7] deckKeys=17 count=24 unique=15
| 序号 | CardID | deckId | index | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 1708 | 17 | 8 | 1 | 9 | 1 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 2 | 1703 | 17 | 3 | 1 | 4 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 3 | 1760 | 17 | 60 | 7 | 1 | 1 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 4 | 1701 | 17 | 1 | 1 | 2 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 5 | 1709 | 17 | 9 | 1 | 10 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 6 | 1703 | 17 | 3 | 1 | 4 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 7 | 1701 | 17 | 1 | 1 | 2 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 8 | 1704 | 17 | 4 | 1 | 5 | 1 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 9 | 1700 | 17 | 0 | 1 | 1 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 10 | 1750 | 17 | 50 | 6 | 1 | 1 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 11 | 1709 | 17 | 9 | 1 | 10 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 12 | 1702 | 17 | 2 | 1 | 3 | 2 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 13 | 1707 | 17 | 7 | 1 | 8 | 1 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 14 | 1705 | 17 | 5 | 1 | 6 | 1 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 15 | 1740 | 17 | 40 | 5 | 1 | 1 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 16 | 1702 | 17 | 2 | 1 | 3 | 2 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 17 | 1709 | 17 | 9 | 1 | 10 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 18 | 1700 | 17 | 0 | 1 | 1 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 19 | 1720 | 17 | 20 | 3 | 1 | 1 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 20 | 1700 | 17 | 0 | 1 | 1 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 21 | 1730 | 17 | 30 | 4 | 1 | 1 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 22 | 1706 | 17 | 6 | 1 | 7 | 1 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 23 | 1703 | 17 | 3 | 1 | 4 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |
| 24 | 1701 | 17 | 1 | 1 | 2 | 3 |  | 其他 | TTS FaceURL 哈希命中朝鲜牌库图集；不是正式 faction hand preview atlas |  | 已排除 |

## $/ObjectStates[8] deckKeys=16 count=42 unique=19
| 序号 | CardID | deckId | index | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 1631 | 16 | 31 | 4 | 2 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 2 | 1644 | 16 | 44 | 5 | 5 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 3 | 1643 | 16 | 43 | 5 | 4 | 10 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 4 | 1626 | 16 | 26 | 3 | 7 | 8 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 5 | 1637 | 16 | 37 | 4 | 8 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 6 | 1626 | 16 | 26 | 3 | 7 | 8 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 7 | 1627 | 16 | 27 | 3 | 8 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 8 | 1641 | 16 | 41 | 5 | 2 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 9 | 1646 | 16 | 46 | 5 | 7 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 10 | 1643 | 16 | 43 | 5 | 4 | 10 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 11 | 1627 | 16 | 27 | 3 | 8 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 12 | 1643 | 16 | 43 | 5 | 4 | 10 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 13 | 1643 | 16 | 43 | 5 | 4 | 10 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 14 | 1626 | 16 | 26 | 3 | 7 | 8 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 15 | 1644 | 16 | 44 | 5 | 5 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 16 | 1626 | 16 | 26 | 3 | 7 | 8 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 17 | 1643 | 16 | 43 | 5 | 4 | 10 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 18 | 1636 | 16 | 36 | 4 | 7 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 19 | 1642 | 16 | 42 | 5 | 3 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 20 | 1639 | 16 | 39 | 4 | 10 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 21 | 1645 | 16 | 45 | 5 | 6 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 22 | 1643 | 16 | 43 | 5 | 4 | 10 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 23 | 1632 | 16 | 32 | 4 | 3 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 24 | 1643 | 16 | 43 | 5 | 4 | 10 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 25 | 1638 | 16 | 38 | 4 | 9 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 26 | 1645 | 16 | 45 | 5 | 6 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 27 | 1643 | 16 | 43 | 5 | 4 | 10 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 28 | 1633 | 16 | 33 | 4 | 4 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 29 | 1628 | 16 | 28 | 3 | 9 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 30 | 1626 | 16 | 26 | 3 | 7 | 8 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 31 | 1643 | 16 | 43 | 5 | 4 | 10 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 32 | 1638 | 16 | 38 | 4 | 9 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 33 | 1626 | 16 | 26 | 3 | 7 | 8 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 34 | 1641 | 16 | 41 | 5 | 2 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 35 | 1626 | 16 | 26 | 3 | 7 | 8 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 36 | 1634 | 16 | 34 | 4 | 5 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 37 | 1626 | 16 | 26 | 3 | 7 | 8 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 38 | 1643 | 16 | 43 | 5 | 4 | 10 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 39 | 1629 | 16 | 29 | 3 | 10 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 40 | 1636 | 16 | 36 | 4 | 7 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 41 | 1628 | 16 | 28 | 3 | 9 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 42 | 1635 | 16 | 35 | 4 | 6 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |

## $/ObjectStates[9] deckKeys=16 count=20 unique=16
| 序号 | CardID | deckId | index | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 1620 | 16 | 20 | 3 | 1 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 2 | 1602 | 16 | 2 | 1 | 3 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 3 | 1640 | 16 | 40 | 5 | 1 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 4 | 1620 | 16 | 20 | 3 | 1 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 5 | 1607 | 16 | 7 | 1 | 8 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 6 | 1650 | 16 | 50 | 6 | 1 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 7 | 1601 | 16 | 1 | 1 | 2 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 8 | 1608 | 16 | 8 | 1 | 9 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 9 | 1603 | 16 | 3 | 1 | 4 | 3 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 10 | 1606 | 16 | 6 | 1 | 7 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 11 | 1640 | 16 | 40 | 5 | 1 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 12 | 1600 | 16 | 0 | 1 | 1 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 13 | 1605 | 16 | 5 | 1 | 6 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 14 | 1630 | 16 | 30 | 4 | 1 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 15 | 1604 | 16 | 4 | 1 | 5 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 16 | 1603 | 16 | 3 | 1 | 4 | 3 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 17 | 1610 | 16 | 10 | 2 | 1 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 18 | 1609 | 16 | 9 | 1 | 10 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 19 | 1603 | 16 | 3 | 1 | 4 | 3 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 20 | 1660 | 16 | 60 | 7 | 1 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |

## $/ObjectStates[17] deckKeys=16 count=22 unique=14
| 序号 | CardID | deckId | index | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 1619 | 16 | 19 | 2 | 10 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 2 | 1622 | 16 | 22 | 3 | 3 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 3 | 1612 | 16 | 12 | 2 | 3 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 4 | 1624 | 16 | 24 | 3 | 5 | 5 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 5 | 1618 | 16 | 18 | 2 | 9 | 3 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 6 | 1613 | 16 | 13 | 2 | 4 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 7 | 1619 | 16 | 19 | 2 | 10 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 8 | 1625 | 16 | 25 | 3 | 6 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 9 | 1618 | 16 | 18 | 2 | 9 | 3 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 10 | 1624 | 16 | 24 | 3 | 5 | 5 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 11 | 1616 | 16 | 16 | 2 | 7 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 12 | 1615 | 16 | 15 | 2 | 6 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 13 | 1611 | 16 | 11 | 2 | 2 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 14 | 1615 | 16 | 15 | 2 | 6 | 2 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 15 | 1623 | 16 | 23 | 3 | 4 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 16 | 1618 | 16 | 18 | 2 | 9 | 3 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 17 | 1614 | 16 | 14 | 2 | 5 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 18 | 1624 | 16 | 24 | 3 | 5 | 5 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 19 | 1621 | 16 | 21 | 3 | 2 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 20 | 1617 | 16 | 17 | 2 | 8 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 21 | 1624 | 16 | 24 | 3 | 5 | 5 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 22 | 1624 | 16 | 24 | 3 | 5 | 5 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |

## $/ObjectStates[22] deckKeys=16 count=3 unique=3
| 序号 | CardID | deckId | index | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 1603 | 16 | 3 | 1 | 4 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 2 | 1626 | 16 | 26 | 3 | 7 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |
| 3 | 1619 | 16 | 19 | 2 | 10 | 1 |  | 纪年 / 剧本 | TTS FaceURL 哈希命中纪年卡图集；不是正式 faction hand preview atlas |  | 已排除 |

## $/ObjectStates[23] deckKeys=14/5/6/7 count=4 unique=4
| 序号 | CardID | deckId | index | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 1400 | 14 | 0 | 1 | 1 | 1 |  | 其他 | 1x1 CardCustom 小牌组对象；无牌名、说明、牌类或效果字段，不能作为普通手牌规则真相源 |  | 已排除 |
| 2 | 600 | 6 | 0 | 1 | 1 | 1 |  | 其他 | 1x1 CardCustom 小牌组对象；无牌名、说明、牌类或效果字段，不能作为普通手牌规则真相源 |  | 已排除 |
| 3 | 500 | 5 | 0 | 1 | 1 | 1 |  | 其他 | 1x1 CardCustom 小牌组对象；无牌名、说明、牌类或效果字段，不能作为普通手牌规则真相源 |  | 已排除 |
| 4 | 700 | 7 | 0 | 1 | 1 | 1 |  | 其他 | 1x1 CardCustom 小牌组对象；无牌名、说明、牌类或效果字段，不能作为普通手牌规则真相源 |  | 已排除 |

## $/ObjectStates[25] deckKeys=2 count=9 unique=9
| 序号 | CardID | deckId | index | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 200 | 2 | 0 | 1 | 1 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 2 | 201 | 2 | 1 | 1 | 2 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 3 | 202 | 2 | 2 | 1 | 3 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 4 | 203 | 2 | 3 | 1 | 4 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 5 | 206 | 2 | 6 | 1 | 7 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 6 | 207 | 2 | 7 | 1 | 8 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 7 | 220 | 2 | 20 | 3 | 1 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 8 | 205 | 2 | 5 | 1 | 6 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 9 | 204 | 2 | 4 | 1 | 5 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |

## $/ObjectStates[26] deckKeys=15 count=5 unique=5
| 序号 | CardID | deckId | index | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 1505 | 15 | 5 | 1 | 6 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 2 | 1503 | 15 | 3 | 1 | 4 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 3 | 1507 | 15 | 7 | 1 | 8 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 4 | 1508 | 15 | 8 | 1 | 9 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 5 | 1500 | 15 | 0 | 1 | 1 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |

## $/ObjectStates[47] deckKeys=13 count=2 unique=2
| 序号 | CardID | deckId | index | 行 | 列 | 出现次数 | 人工中文牌名 | 人工牌类 | 规则效果摘要 | 军备目标 | 复核状态 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 1300 | 13 | 0 | 1 | 1 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |
| 2 | 1302 | 13 | 2 | 1 | 3 | 1 |  | 人物 / 纪年 / 剧本 / 其他非普通手牌 | 运行时图集候选链已低分辨率安全核读排除；不能作为普通事件、军备、战术或银两 |  | 已排除 |


## 当前结论

- TTS `DeckIDs` 已可追踪到每个牌组对象、每个 CardID、图集行列和重复次数。
- 143 行已全部按证据回填为“已排除”：运行时图集候选链已安全核读排除，纪年/朝鲜图集由 FaceURL 哈希排除，4 张 1x1 `CardCustom` 小牌组对象没有牌名、说明、牌类或效果字段。
- 本矩阵仍没有任何普通事件、军备、战术或银两确认行。
- 因此它只能作为排除证据和结构化审计记录，不能关闭 OpenSpec `2.4`。
- OpenSpec `2.4` 和 `4.5` 继续保持未完成。
