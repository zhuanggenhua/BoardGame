# 七大恨运行时手牌图集与 TTS 牌组交叉核验

> 这份记录只用文本和 JSON 交叉核验运行时 faction hand preview atlas 与 TTS `CustomDeck / DeckIDs` 的对应关系。本文件不得直接作为普通事件、军备、战术、银两的正式规则映射；也不得把 `deckKey 16 / atlas05` 直接当作全阵营可见手牌牌面图源。

## 输入与边界

- 运行时入口：
  - `src/games/qidahen/ui/cardAtlas.ts`
  - `src/games/qidahen/manifest.ts`
  - `src/games/qidahen/criticalImageResolver.ts`
- 素材清单：
  - `src/games/qidahen/rule/七大恨素材接入清单.md`
- TTS JSON：
  - `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Workshop\2228142777.json`
- 本轮只读取文本、JSON、路径、Steam 资源哈希和图集网格元数据；不读取整张图集或牌面图片。
- 2026-07-05 运行态补充边界：`deckKey 16 / atlas05` 可作为普通手牌规则身份与文字来源，但它的原牌面左上角会带原图阵营角标，不能直接渲染到当前行动方手牌区；可见手牌牌面应与规则身份来源解耦。

## 核验方法

- 从 TTS `ObjectStates[*].CustomDeck[*].FaceURL` 抽取末尾 40 位资源哈希。
- 从素材接入清单的源 URL 中抽取 `.jpg` 前的 40 位资源哈希。
- 按哈希匹配 TTS 牌组对象与本地素材路径。
- 再对照运行时 `cardAtlas.ts` 中使用的 faction hand preview atlas 名称。

## 运行时正式手牌预览图集

| 阵营 | 运行时 atlas id | 运行时素材名 | 本地整版来源 |
| --- | --- | --- | --- |
| 大明 | `qidahen:ming-hand-preview` | `qidahen/cards/atlases/ming-faction-deck-atlas` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/ming-deck-atlas.jpg` |
| 蒙古 | `qidahen:mongol-hand-preview` | `qidahen/cards/atlases/mongol-faction-deck-atlas` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/mongol-deck-atlas.jpg` |
| 后金 | `qidahen:jin-hand-preview` | `qidahen/cards/atlases/jin-faction-deck-atlas` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/jin-deck-atlas.jpg` |

## TTS 牌组哈希交叉表

| TTS 路径 | deckKey | DeckIDs 数 | 唯一 CardID | 网格 | 素材接入清单命中 | 本地素材路径 | 判定 |
| --- | ---: | ---: | ---: | --- | --- | --- | --- |
| `$/ObjectStates[25]` | 2 | 9 | 9 | 10x7 | `大明牌库图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/ming-deck-atlas.jpg` | 可能对应大明正式手牌图集，但 DeckIDs 只有 9 张，不是完整逐牌表 |
| `$/ObjectStates[6]` | 13 | 12 | 12 | 10x7 | `蒙古牌库图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/mongol-deck-atlas.jpg` | 可能对应蒙古正式手牌图集，但 DeckIDs 只有 12 张，不是完整逐牌表 |
| `$/ObjectStates[47]` | 13 | 2 | 2 | 10x7 | `蒙古牌库图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/mongol-deck-atlas.jpg` | 蒙古同源小型牌组对象，只能作为补充位置线索 |
| `$/ObjectStates[26]` | 15 | 5 | 5 | 10x7 | `后金牌库图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/jin-deck-atlas.jpg` | 可能对应后金正式手牌图集，但 DeckIDs 只有 5 张，不是完整逐牌表 |
| `$/ObjectStates[31]` | 15 | 0 | 0 | 10x7 | `后金牌库图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/jin-deck-atlas.jpg` | 单张 Card 对象，不提供牌组顺序 |
| `$/ObjectStates[32]` | 15 | 0 | 0 | 10x7 | `后金牌库图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/jin-deck-atlas.jpg` | 单张 Card 对象，不提供牌组顺序 |
| `$/ObjectStates[48]` | 15 | 0 | 0 | 10x7 | `后金牌库图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/jin-deck-atlas.jpg` | 单张 Card 对象，不提供牌组顺序 |
| `$/ObjectStates[8]` | 16 | 42 | 19 | 10x7 | `纪年卡图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/chronology-cards-atlas.jpg` | 不是正式 faction hand preview atlas |
| `$/ObjectStates[9]` | 16 | 20 | 16 | 10x7 | `纪年卡图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/chronology-cards-atlas.jpg` | 不是正式 faction hand preview atlas |
| `$/ObjectStates[17]` | 16 | 22 | 14 | 10x7 | `纪年卡图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/chronology-cards-atlas.jpg` | 不是正式 faction hand preview atlas |
| `$/ObjectStates[22]` | 16 | 3 | 3 | 10x7 | `纪年卡图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/chronology-cards-atlas.jpg` | 不是正式 faction hand preview atlas |
| `$/ObjectStates[7]` | 17 | 24 | 15 | 10x7 | `朝鲜牌库图集/整版` | `public/assets/i18n/zh-CN/qidahen/cards/atlases/korea-deck-atlas.jpg` | 不是正式 faction hand preview atlas |

## 当前结论

- 运行态手牌可分为两层：规则身份/文字来源与玩家可见牌面来源。atlas05 可以作为当前已核读的规则身份/文字来源；正式运行时必须同时按 TTS 真实牌堆顺序、目标 `atlasIndex` 和 `previewRef` 绑定同一张真实牌面。历史上“大明手牌露出后金‘金’”这类问题不能通过结构化 UI、文字卡或其它自造牌面遮掉，只能通过正确普通手牌图源、图集槽位、牌组映射或运行时引用修复；未找到正确素材前只能保持未完成/blocked。

- 之前泛化记录的 `deckId 13 / 16 / 17` 不能整体当作大明、蒙古、后金正式手牌逐牌来源：
  - `deckId 13` 命中蒙古牌库图集。
  - `deckId 16` 命中纪年卡图集。
  - `deckId 17` 命中朝鲜牌库图集。
- 真正可能与运行时 faction hand preview atlas 对应的 TTS 牌组是：
  - 大明：`deckKey 2`，`$/ObjectStates[25]`，9 张 DeckIDs。
  - 蒙古：`deckKey 13`，`$/ObjectStates[6]` 与 `$/ObjectStates[47]`，合计 14 张 DeckIDs。
  - 后金：`deckKey 15`，`$/ObjectStates[26]`，5 张 DeckIDs。
- 这些候选仍不能关闭 OpenSpec `2.4`：
  - 数量远少于 10x7 图集的完整逐牌范围。
  - TTS `ContainedObjects` 仍没有逐牌 `Nickname / Description`。
  - 仍没有普通事件、军备、战术、银两的中文牌名、牌类、效果或军备目标。

## 下一步门槛

- 若继续推进正式手牌入口，应优先基于本文件改造人工录入矩阵：只把大明 `deckKey 2`、蒙古 `deckKey 13`、后金 `deckKey 15` 作为 faction atlas 相关候选。
- 纪年 `deckKey 16`、朝鲜 `deckKey 17` 应从“普通手牌真相源候选”中排除，只保留为非 faction deck 证据。
- 在人工确认前，不得把任何 CardID 行反写到正式 `cardKind / cardDefId / armamentId`。
