# 召唤师战争永恒议会重录合同（2026-07-30）

## 结论

- 旧录入不是没有文档，而是通用录入规范和旧永恒议会 evidence 存在，但召唤师战争专项 workflow 没写清卡面数值版式，旧 evidence 又把错读结果标成 `locked`。
- 本次已把版式规则补回 `docs/games/summonerwars/workflows/summonerwars-faction-intake.md`，并把通用录入路由补到 `.codex/skill/data-entry-workflow/SKILL.md` 与 `docs/ai-rules/data-entry.md`。
- 永恒议会单位牌按主图重录：左上第一数字是费用，左上红心是生命，右下圆牌是战力和攻击类型。

## 真相源表

| 对象 | 主真相源 | 用途 | 状态 |
| --- | --- | --- | --- |
| 永恒议会卡牌图集 | `public/assets/i18n/zh-CN/summonerwars/hero/yongheng/cards.jpg` | 卡牌槽位、费用、生命、战力、攻击类型、牌组符号、事件阶段 | locked |
| 永恒议会单卡裁图 | `temp/summonerwars-yongheng-intake/card-slot-00.jpg` - `card-slot-10.jpg` | 逐卡复核 | locked |
| 永恒议会召唤师图 | `temp/summonerwars-yongheng-intake/hero.png` | 召唤师生命、战力、攻击类型、符号 | locked |
| 永恒议会提示板 | `temp/summonerwars-yongheng-intake/tip.jpg` | 起始单位、起始城门、传奇事件数量 | locked |

## 卡面版式锁定

| 卡类 | 图面位置 | 结构化字段 |
| --- | --- | --- |
| 单位牌 | 左上第一数字 | 费用 `cost` |
| 单位牌 | 左上红心数字 | 生命 `life` |
| 单位牌 | 右下圆牌数字与图标 | 战力 `strength` 与攻击类型 `attackType` |
| 事件牌 | 左上数字 | 费用 `cost` |
| 事件牌 | 标题下方阶段文字 | 施放阶段 `playPhase` |
| 召唤师 | 右下圆牌数字与图标，左上红心 | 战力、攻击类型、生命；运行时费用固定 `cost: 0` |

## 永恒议会重录合同表

| slot | 对象 | 图面结论 | 旧录入问题 | 修正后结构化字段 | 状态 |
| --- | --- | --- | --- | --- | --- |
| hero | 大议长艾迪雅 | 远程，3 战力，13 生命 | 无 | `strength: 3`, `life: 13`, `cost: 0`, `attackType: ranged` | locked |
| 0 | 学习 | 传奇事件，魔力阶段，0 费用 | 无 | `cost: 0`, `playPhase: magic`, `deckSymbols: []` | locked |
| 1 | 城塞参谋 | 费用 1，生命 3，远程 2 战力，议会符号 | 费用/战力读反 | `cost: 1`, `life: 3`, `strength: 2`, `attackType: ranged`, `deckSymbols: [COUNCIL]` | locked |
| 2 | 心灵骑士 | 费用 2，生命 4，近战 2 战力，眼睛符号 | 数值未暴露互反 | `cost: 2`, `life: 4`, `strength: 2`, `attackType: melee`, `deckSymbols: [EYE]` | locked |
| 3 | 主管玛鲁娜 | 费用 5，生命 8，近战 3 战力，眼睛符号 | 费用/战力读反，符号错录为议会 | `cost: 5`, `life: 8`, `strength: 3`, `attackType: melee`, `deckSymbols: [EYE]` | locked |
| 4 | 远古学者 | 费用 1，生命 2，近战 3 战力，议会符号 | 费用/战力读反 | `cost: 1`, `life: 2`, `strength: 3`, `attackType: melee`, `deckSymbols: [COUNCIL]` | locked |
| 5 | 洞察 | 普通事件，召唤阶段，0 费用，议会符号 | 无 | `cost: 0`, `playPhase: summon`, `deckSymbols: [COUNCIL]` | locked |
| 6 | 主管奥维 | 费用 4，生命 6，远程 2 战力，眼睛 + 议会符号 | 费用/战力读反，漏议会符号 | `cost: 4`, `life: 6`, `strength: 2`, `attackType: ranged`, `deckSymbols: [EYE, COUNCIL]` | locked |
| 7 | 探寻 | 普通事件，召唤阶段，0 费用，眼睛 + 议会符号 | 漏眼睛符号 | `cost: 0`, `playPhase: summon`, `deckSymbols: [EYE, COUNCIL]` | locked |
| 8 | 主管卡图 | 费用 6，生命 10，远程 2 战力，议会符号 | 费用/战力读反，多录眼睛符号 | `cost: 6`, `life: 10`, `strength: 2`, `attackType: ranged`, `deckSymbols: [COUNCIL]` | locked |
| 9 | 心念侵袭 | 普通事件，召唤阶段，0 费用，眼睛符号 | 无 | `cost: 0`, `playPhase: summon`, `deckSymbols: [EYE]` | locked |
| 10 | 玄谜贤者 | 费用 2，生命 4，远程 3 战力，眼睛符号 | 费用/战力读反 | `cost: 2`, `life: 4`, `strength: 3`, `attackType: ranged`, `deckSymbols: [EYE]` | locked |

## 其它新派系抽样

| 派系 | 抽样图源 | 抽样对象 | 图面 vs 当前代码 | 结论 |
| --- | --- | --- | --- | --- |
| 灰烬 | `temp/summonerwars-huijin-intake/cards-contact-sheet.png` | 赫丽丝、火焰龙兽、灰烬野兽 | 赫丽丝图面费用 5 / 生命 7 / 远程 3 战力，代码一致；火焰龙兽费用 8 / 生命 10 / 远程 4 战力，代码一致；灰烬野兽费用 2 / 生命 3 / 近战 3 战力，代码一致 | 抽样未复现永恒议会互反 |
| 冰苔兽人 | `temp/summonerwars-shouren-intake/cards-overview.webp` | 拉格诺、塔甘、冰苔斗士 | 拉格诺费用 5 / 生命 8 / 近战 3 战力，代码一致；塔甘费用 5 / 生命 6 / 远程 4 战力，代码一致；冰苔斗士费用 1 / 生命 3 / 近战 2 战力，代码一致 | 抽样未复现永恒议会互反 |
| 莫古 | `temp/summonerwars-mogu-atlas-8x2/mogu-8x2-contact.jpg` | 托恩、畸形巨怪、菌袍疫病体 | 托恩费用 6 / 生命 7 / 近战 2 战力，代码一致；畸形巨怪费用 3 / 生命 13 / 近战 5 战力，代码一致；菌袍疫病体费用 0 / 生命 2 / 近战 2 战力，代码一致 | 抽样未复现永恒议会互反 |

## 对照与冲突

| 项 | 结论 |
| --- | --- |
| 旧永恒议会 evidence | 与本次图面重录冲突，旧数值版式结论作废；旧机制/E2E证据只可继续证明能力链路，不可证明 L0 数值正确 |
| 当前代码 | 永恒议会多张单位的 `cost` 与 `strength` 互反，部分 `deckSymbols` 错漏 |
| 当前测试 | 静态测试锁了旧错值，必须同步改为新版式合同 |

## 本次实现同步

| 文件 | 动作 |
| --- | --- |
| `.codex/skill/data-entry-workflow/SKILL.md` | 补召唤师战争录入路由 |
| `docs/ai-rules/data-entry.md` | 补专用 workflow 索引 |
| `docs/games/summonerwars/workflows/summonerwars-faction-intake.md` | 补卡面版式锁定和新派系抽样回读门禁 |
| `src/games/summonerwars/config/factions/yongheng.ts` | 修正永恒议会费用、生命、战力、攻击类型和牌组符号结构化数据 |
| `src/games/summonerwars/__tests__/abilities-yongheng.test.ts` | 静态测试同步新版式合同，并补测牌组符号和事件费用 |
