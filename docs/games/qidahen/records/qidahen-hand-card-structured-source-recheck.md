# 七大恨结构化素材来源复查

> 这份记录只复核本地结构化素材是否能提供普通事件、军备、战术、银两的逐牌规则真相源；不得把文件路径、牌组顺序或状态对象名称直接当作正式规则映射。

## 输入与边界

- 本轮只读取文本和 JSON，不读取图片。
- 复查对象：
  - `public/assets/i18n/zh-CN/qidahen/assets-manifest.json`
  - `android/app/src/main/assets/public/assets/i18n/zh-CN/qidahen/assets-manifest.json`
  - `dist/assets/i18n/zh-CN/qidahen/assets-manifest.json`
  - `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Workshop\2228142777.json`
- 目标字段：普通事件、军备、战术、银两的逐牌中文牌名、牌类、效果和军备目标。

## 资源清单复查

三个运行时资源清单都只命中文件路径层级：

- `card`
- `deck`
- `atlas`
- `characters`

没有命中：

- `event / 事件`
- `armament / 军备`
- `tactic / 战术`
- `silver / 银两`

因此资源清单只能证明现有资源路径和图集/人物资源类别，不能证明普通事件、军备、战术、银两的逐牌规则身份。

## TTS 结构化字段复查

TTS Workshop JSON 中可见：

- `card_or_deck_like_objects`: 164
- `named_card_text_objects`: 37
- `deckId 13 / 16 / 17` 对应正式牌库对象，能提供 `CardID` 顺序和 `CustomDeck` 图集键。
- 这些牌库内 `ContainedObjects` 的 `Nickname` 和 `Description` 仍为空。
- 命名对象主要是：
  - 后金辅助卡 / 蒙古辅助卡 / 大明辅助卡
  - 后金军备 / 大明军备 / 蒙古军备
  - 一批 `Checker_*` 军备状态对象

## 当前结论

- 资源清单不包含普通事件、军备、战术、银两的逐牌规则字段。
- TTS JSON 仍只能提供牌组结构、CardID 顺序、图集键和部分非手牌或状态对象名称。
- `后金军备 / 大明军备 / 蒙古军备` 这类命名对象仍是辅助卡或状态对象，不是可打出的普通军备手牌逐牌表。
- 这次复查没有发现可直接映射到 `cardKind / cardDefId / armamentId` 的逐牌真相源。
- OpenSpec `2.4` 和 `4.5` 继续保持未完成。
