# 七大恨教程实施映射

> 当前判定：**专项维护文档，不是运行态真相源**。
> 若本文件与 `src/games/qidahen/tutorial.ts`、`docs/games/qidahen/records/qidahen-primary-interaction-audit.md`、当前 E2E 截图链冲突，一律以后者为准。
> 尤其是“正式局当前有没有规则书级一级入口”“七大恨能不能报收工”，不得引用本文件作结论。

> 状态：已按当前实现修订；旧实施前条目只保留为历史脉络。
> 用途：记录 `tutorial.ts`、语言包、`tutorialSetup.ts` 和 E2E 之间的章节映射，避免后续继续引用旧草案。
> 约束：运行态结论必须回到源码、测试和当前截图链。

## 目标态

玩家可见教程收成 6 个主章节：

1. `basic-opening`
2. `attack-and-battle`
3. `siege-and-occupation`
4. `wheel-shared-cost`
5. `year-and-characters`
6. `korea-and-special-map-rules`

## 当前实现态

当前 `src/games/qidahen/tutorial.ts` 实际承载的是：

- 可见主章节：
  - `basic-opening`
  - `attack-and-battle`
  - `siege-and-occupation`
  - `wheel-shared-cost`
  - `year-and-characters`
  - `korea-and-special-map-rules`
- 隐藏续章：
  - `retreat-and-rout`
  - `cavalry-evasion`
  - `cavalry-plunder`
  - `neutral-invasion`
  - `water-dispatch`
  - `wheel-reclaim`
  - `wheel-military-farm`
  - `wheel-recruit-train`
  - `armament-upgrade`
  - `event-action`
  - `diplomacy-and-hire`

当前 `nextTutorialId` 链为：

- `attack-and-battle -> retreat-and-rout -> cavalry-evasion -> cavalry-plunder -> neutral-invasion -> water-dispatch`
- `wheel-shared-cost -> wheel-reclaim -> wheel-military-farm -> wheel-recruit-train -> armament-upgrade -> event-action -> diplomacy-and-hire`

## 当前真相边界

- 当前教程实现可以示范：
  - 势力行动支付链
  - 轮盘推进链
  - 手札直点版 `升级军备`（当前主页首回合链已用《火炮技术》验证）
  - `事件行动` 的教程示范链
- 但这不等于正式局已经具备规则书口径的完整手牌一级入口。
- 正式局当前仍缺：
  - `执行事件` 的真实手牌对象一级入口
  - 事件效果全集与完整时机审计
  - 能稳定覆盖 `event / armament / tactic / silver` 全量普通手牌的正式局规则级卡牌真相表
- 因此本映射文档只能指导“教程怎么示范当前已存在链路”，不能把 `event-action` 写成“正式局事件牌主入口与效果全集已经完成”。

## 当前承载策略

### 总原则

- 玩家目录保留 6 个主章节。
- 隐藏续章继续存在，但只作为主章节完成后的连续教学链，不作为目录里的平级章节。
- 运行态事实以 `src/games/qidahen/tutorial.ts` 的目录显隐和 `nextTutorialId` 为准；本文只记录映射，不再作为实施前待办。

## 章节级映射表

| 当前主章节 | 当前续章链 | 目录状态 | 说明 |
| :--- | :--- | :--- | :--- |
| `basic-opening` | 无 | 可见 | 开局、手牌上限、轮盘推进、一次手牌行动和一次轮盘行动。 |
| `attack-and-battle` | `retreat-and-rout -> cavalry-evasion -> cavalry-plunder -> neutral-invasion -> water-dispatch` | 可见，续章隐藏 | 主章从「突袭作战」和支付进入野战；续章承接撤退、骑兵避战、骑兵劫掠、中立入侵和水路调度分支。 |
| `siege-and-occupation` | 无 | 可见 | 独立承接守城、城战、围城和占领。 |
| `wheel-shared-cost` | `wheel-reclaim -> wheel-military-farm -> wheel-recruit-train -> armament-upgrade -> event-action -> diplomacy-and-hire` | 可见，续章隐藏 | 主章承接轮盘代价；续章承接开垦、军屯、征兵训练、军备、事件和外交雇佣。 |
| `year-and-characters` | 无 | 可见 | 年中、新年、纪年和顺位刷新独立收口。 |
| `korea-and-special-map-rules` | 无 | 可见 | 朝鲜、水路与山海关特例独立成章。 |

## `tutorial.ts` 当前映射

### 可见章节

- `basic-opening`
- `attack-and-battle`
- `siege-and-occupation`
- `wheel-shared-cost`
- `year-and-characters`
- `korea-and-special-map-rules`

### 隐藏续章

- `retreat-and-rout`
- `cavalry-evasion`
- `cavalry-plunder`
- `neutral-invasion`
- `water-dispatch`
- `wheel-reclaim`
- `wheel-military-farm`
- `wheel-recruit-train`
- `armament-upgrade`
- `event-action`
- `diplomacy-and-hire`

### 当前续章链

- `attack-and-battle -> retreat-and-rout -> cavalry-evasion -> cavalry-plunder -> neutral-invasion -> water-dispatch`
- `wheel-shared-cost -> wheel-reclaim -> wheel-military-farm -> wheel-recruit-train -> armament-upgrade -> event-action -> diplomacy-and-hire`

## step 级映射

### `basic-opening`

- 保留 step：
  - `welcome`
  - `hand-limit`
  - `wheel-first`
  - `after-wheel`
  - `hand-resource`
  - `choose-grant-pardon-target`
  - `pick-action`
  - `pay-cards`
  - `action-result`
  - `morale-level`
  - `wheel-action`
  - `finish`
- 当前说明：
  - 这些 step 现在按手牌上限、轮盘、手牌行动、支付、目标和结果顺序承接。

### `attack-and-battle`

- 主章保留：
  - `overview`
  - `choose-action`
  - `pay-raid`
  - `border-width`
  - `battle-open`
  - `tactic-window`
  - `battle-damage`
  - `battle-result`
  - `retreat-and-defeat`
  - `battle-finish`
- 当前链路：
  - 从行动窗口高亮「突袭作战」开始，支付 1 张手牌后进入察哈尔待结算野战，再走「骑兵冲锋」选中确认、右侧「断后」按钮结算、战后处理和占领摘要。
  - `neutral-invasion`、`water-dispatch` 已作为隐藏续章承接进攻分支，不再塞回第二章开场。

### `retreat-and-rout`

- 继续保留为隐藏续章：
  - `overview`
  - `choose-rout`
  - `rout-result`
  - `finish`
- 作用：
  - 只负责把野战章里“撤退代价”的后半段真实做出来

### `siege-and-occupation`

- 当前 step：
  - `overview`
  - `defend-city`
  - `city-battle`
  - `city-result`
  - `besiege-choice`
  - `occupy-choice`
  - `finish`
- 当前说明：
  - 这组 step id 现在对应守城、城战、围城和占领差异。
  - `city-battle` 的真实承接物是右侧战斗面板里的「断后」按钮，不得回退成概念性的“城战结算按钮”或只用命令旁路完成。

### `wheel-shared-cost`

- 当前 step：
  - `overview`
  - `choose-move`
  - `draw-result`
  - `dispatch-ready`
  - `finish`
- 当前说明：
  - 主章负责“轮盘代价 + 推进到不同系统”的骨架。
  - 具体的开垦、军屯、征兵训练、军备、事件和外交雇佣收益由隐藏续章承接。

### `armament-upgrade`

- 当前 step：
  - `overview`
  - `choose-action`
  - `pay-cards`
  - `result`
  - `finish`
- 角色：
  - 作为 `wheel-shared-cost` 的隐藏发展续章保留

### `event-action`

- 当前 step：
  - `overview`
  - `choose-action`
  - `pay-cards`
  - `choose-effect`
  - `result`
  - `finish`
- 角色：
  - 作为 `wheel-shared-cost` 的隐藏发展续章保留

### `diplomacy-and-hire`

- 当前 step：
  - `overview`
  - `wheel-entry`
  - `choose-target`
  - `friendly-mark`
  - `tribute-mark`
  - `remove-mark`
  - `hire-only`
  - `finish`
- 角色：
  - 作为 `wheel-shared-cost` 的隐藏发展续章保留

### `year-and-characters`

- 当前 step：
  - `overview`
  - `advance-midyear`
  - `midyear-tax`
  - `midyear-characters`
  - `advance-new-year`
  - `new-year-maintenance`
  - `new-year-attrition`
  - `chronology-score`
  - `turn-order-refresh`
  - `finish`
- 当前说明：
  - 这组 step id 独立承接年度链，不再自动续到地图特例章。

### `korea-and-special-map-rules`

- 当前 step：
  - `overview`
  - `korea-region`
  - `hanseong-vp`
  - `water-limit`
  - `shanhaiguan`
  - `finish`
- 当前说明：
  - 这组 step id 独立承接朝鲜、水路和山海关特例。

## 语言 key 映射

### 当前顶层 key 前缀

- `tutorial.basic.*`
- `tutorial.attackAndBattle.*`
- `tutorial.siege.*`
- `tutorial.retreatAndRout.*`
- `tutorial.wheelSharedCost.*`
- `tutorial.armamentUpgrade.*`
- `tutorial.eventAction.*`
- `tutorial.diplomacy.*`
- `tutorial.yearAndCharacters.*`
- `tutorial.koreaSpecial.*`

### 当前说明

- 继续保留现有顶层 key 前缀，不做无必要 rename。
- 原因：现有 key 名已经和当前章节语义基本一致，纯重命名只会制造迁移噪音。

### 当前顶层 key 覆盖

- `tutorial.basic.steps.*`
- `tutorial.attackAndBattle.steps.*`
- `tutorial.siege.steps.*`
- `tutorial.wheelSharedCost.steps.*`
- `tutorial.wheelReclaim.steps.*`
- `tutorial.wheelMilitaryFarm.steps.*`
- `tutorial.wheelRecruitTrain.steps.*`
- `tutorial.armamentUpgrade.steps.*`
- `tutorial.eventAction.steps.*`
- `tutorial.diplomacy.steps.*`
- `tutorial.retreatAndRout.steps.*`
- `tutorial.cavalryEvasion.steps.*`
- `tutorial.cavalryPlunder.steps.*`
- `tutorial.neutralInvasion.steps.*`
- `tutorial.waterDispatch.steps.*`
- `tutorial.yearAndCharacters.steps.*`
- `tutorial.koreaSpecial.steps.*`

### 标题与描述的当前约束

#### `public/locales/zh-CN/game-qidahen.json`

当前标题和描述已经按 6 个玩家章节拆开；后续维护只需守住这些边界：

1. `tutorial.attackAndBattle.title`
   - 当前：`进攻与野战`
   - 目标：保持为只对应野战主章。
2. `tutorial.attackAndBattle.description`
   - 当前：从真实手牌行动「突袭作战」进入野战。
   - 目标：保持“突袭作战 -> 支付 -> 野战 -> 战后处理”，不得回退成“进攻调度开场”或并入攻城。
3. `tutorial.yearAndCharacters.title`
   - 当前：`年中、新年与纪年`
   - 目标：保持只对应年度链。
4. `tutorial.yearAndCharacters.description`
   - 当前：只保留年中 / 新年 / 纪年 / 顺位刷新语义。
   - 目标：不得再把朝鲜、水路、山海关并回年度章。

#### `public/locales/en/game-qidahen.json`

同步守住同样 4 组边界：

1. `tutorial.attackAndBattle.title`
2. `tutorial.attackAndBattle.description`
3. `tutorial.yearAndCharacters.title`
4. `tutorial.yearAndCharacters.description`

### key 维护边界

- 当前 key 前缀本身已经和章节语义一致。
- 后续若改章节文案，优先改对应 value，不做无意义 key rename。

## `tutorialSetup.ts` 预设映射

### 当前保留的 preset id

- `basic-opening`
- `attack-and-battle`
- `retreat-and-rout`
- `cavalry-evasion`
- `cavalry-plunder`
- `neutral-invasion`
- `water-dispatch`
- `siege-and-occupation`
- `wheel-shared-cost`
- `wheel-reclaim`
- `wheel-military-farm`
- `wheel-recruit-train`
- `armament-upgrade`
- `event-action`
- `diplomacy-and-hire`
- `year-and-characters`
- `korea-and-special-map-rules`

### 兼容别名

- `qidahen-basic`
- `field-battle`
- `season-flow`

### 当前说明

- 兼容别名先保留，避免现有测试或历史路由引用断掉。
- 新 E2E、文档、截图命名默认使用当前正式 id，不继续强化旧别名。

## 测试、路由与截图链映射

### 当前验证入口

- `src/games/qidahen/__tests__/tutorialFlow.test.ts`：固定目录显隐、章节链和关键步骤顺序。
- `e2e/qidahen/qidahen-closeout.e2e.ts`：固定教程玩家链和截图证据。
- `e2e/qidahen/homepage-first-turn.e2e.ts`：固定从主页建房到局内剧本投票、前置项后首回合的黄金链。
- `e2e/qidahen/online-inmatch-setup.e2e.ts`：固定联机席位里的剧本投票、人物前置和军备前置。

### 当前截图组如何归到 6 个玩家章节

| 目标章节 | 当前截图组 |
| :--- | :--- |
| `basic-opening` | `01-12` |
| `attack-and-battle` | `23-27a`（含 `25b`；2026-07-14 第二章重构批次：突袭作战、支付、野战、战术牌选中确认、右侧「断后」结算、战后处理、占领摘要） |
| `siege-and-occupation` | `30-31a`（含 `30a`；守城避战、右侧「断后」结算城战、围城/占领对照） |
| `wheel-shared-cost` | `13-15` + `16-18` + `19-22` + `30-33` |
| `year-and-characters` | `36-41` |
| `korea-and-special-map-rules` | `42-46` |

### 保留边界

- 隐藏教程仍保留直达路由能力，不从路由层删除。
- 当前文档只维护七大恨专项章节映射，不扩到通用 tutorial 目录系统、生命周期机制或其它游戏教程树。
- 若后续继续重构第三章及其它章节，必须另起当前章节的玩家链路审查，不得直接复用第二章「突袭作战」答案；第三章当前已锁定的玩家动作是「守城避战」后点右侧「断后」结算城战，再进入围城/占领选择。
