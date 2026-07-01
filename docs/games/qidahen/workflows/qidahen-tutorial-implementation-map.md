# 七大恨教程实施映射

> 当前判定：**计划态文档，不是运行态真相源**。  
> 若本文件与 `src/games/qidahen/tutorial.ts`、`docs/games/qidahen/workflows/qidahen-primary-interaction-audit.md`、当前 E2E 截图链冲突，一律以后者为准。  
> 尤其是“正式局当前有没有规则书级一级入口”“七大恨能不能报收工”，不得引用本文件作结论。

> 状态：实施前映射  
> 用途：在文案通过后，直接指导 `tutorial.ts`、语言包、`tutorialSetup.ts` 和 `qidahen-closeout.e2e.ts` 的结构性改造。  
> 约束：当前仅做映射，不先实施到运行态。

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
  - `wheel-shared-cost`
  - `year-and-characters`
- 隐藏续章：
  - `retreat-and-rout`
  - `siege-and-occupation`
  - `armament-upgrade`
  - `event-action`
  - `diplomacy-and-hire`
  - `korea-and-special-map-rules`

当前 `nextTutorialId` 链为：

- `attack-and-battle -> retreat-and-rout -> siege-and-occupation`
- `wheel-shared-cost -> armament-upgrade -> event-action -> diplomacy-and-hire`
- `year-and-characters -> korea-and-special-map-rules`

## 当前真相边界

- 当前教程实现可以示范：
  - 势力行动支付链
  - 轮盘推进链
  - 抽象按钮版 `升级军备`
  - 抽象按钮版 `事件行动`
- 但这不等于正式局已经具备规则书口径的完整手牌一级入口。
- 正式局当前仍缺：
  - `执行事件` 的真实手牌对象一级入口
  - `升级军备` 对应的高保真军备牌入口
  - 能稳定区分 `event / armament / tactic / silver` 的正式局规则级卡牌真相表
- 因此本映射文档只能指导“教程怎么示范当前已存在链路”，不能把 `armament-upgrade / event-action` 写成“正式局真实手牌主入口已经完成”。

## 实施策略

### 总原则

- 不追求把所有内容硬塞进 6 个单一 manifest。
- 继续允许“一个玩家主章节 + 若干隐藏技术续章”的承载方式。
- 玩家目录只看到 6 个主章节。
- 技术续章只承担：
  - 当前引擎一个 manifest 不足以覆盖的第二战局
  - 当前主章节必须串起来的后半段规则
  - 当前正式局尚未具备规则书级一级入口、只能由教程注入态或抽象替代链示范的规则片段

### 推荐承载

#### 1. `basic-opening`

- 角色：
  - 直接保留为可见主章节
- 是否需要隐藏续章：
  - 默认不需要
- 实施重点：
  - 只在同一个真实开局预设里讲完整首回合
  - 若当前真实主循环仍不能证明“先转轮盘”，则要先改预设或交互承接，不要继续靠文案硬说

#### 2. `attack-and-battle`

- 角色：
  - 保留为可见主章节
- 隐藏续章：
  - `retreat-and-rout` 继续保留为隐藏续章
- 是否继续串 `siege-and-occupation`：
  - 不建议
- 原因：
  - 目标态里攻城已经是独立主章节
  - 如果还沿用 `retreat-and-rout -> siege-and-occupation`，玩家在“进攻与野战”收口后会被自动带进下一章，重新混淆野战和攻城边界
- 推荐链：
  - `attack-and-battle -> retreat-and-rout`
  - `retreat-and-rout` 到此收口，不再自动跳 `siege-and-occupation`

#### 3. `siege-and-occupation`

- 角色：
  - 从隐藏续章提升为可见主章节
- 是否需要隐藏续章：
  - 当前先不需要
- 实施重点：
  - 这章自己就该从真实攻城入口开始
  - 不再假设玩家一定是从野战章自动续过来

#### 4. `wheel-shared-cost`

- 角色：
  - 保留为可见主章节
- 隐藏续章：
  - `armament-upgrade`
  - `event-action`
  - `diplomacy-and-hire`
- 推荐链：
  - `wheel-shared-cost -> armament-upgrade -> event-action -> diplomacy-and-hire`
- 原因：
  - 这 3 段都属于“轮盘推进后进入不同发展型系统”的同一教学主题
  - 继续作为隐藏技术续章，符合当前引擎承载方式，也符合玩家心智任务

#### 5. `year-and-characters`

- 角色：
  - 保留为可见主章节
- 是否继续串 `korea-and-special-map-rules`：
  - 不建议
- 原因：
  - 目标态里地图特例是独立主章节
  - 年序章应该在年度链收口，不该自动跳进地图规则特例

#### 6. `korea-and-special-map-rules`

- 角色：
  - 从隐藏续章提升为可见主章节
- 是否需要隐藏续章：
  - 当前先不需要

## 章节级映射表

| 目标主章节 | 当前来源 | 目录状态目标 | `nextTutorialId` 目标 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `basic-opening` | `basic-opening` | 可见 | 无 | 保留 id，重排步骤 |
| `attack-and-battle` | `attack-and-battle` + `retreat-and-rout` | 可见 | 指向 `retreat-and-rout` | 野战主章 + 隐藏撤退续章 |
| `siege-and-occupation` | `siege-and-occupation` | 可见 | 无 | 从隐藏提升为可见主章节 |
| `wheel-shared-cost` | `wheel-shared-cost` + `armament-upgrade` + `event-action` + `diplomacy-and-hire` | 可见 | 指向 `armament-upgrade` | 轮盘主章 + 发展分支隐藏续章 |
| `year-and-characters` | `year-and-characters` | 可见 | 无 | 年度链独立收口 |
| `korea-and-special-map-rules` | `korea-and-special-map-rules` | 可见 | 无 | 从隐藏提升为可见主章节 |

## `tutorial.ts` 精确改动清单

### 目录显隐

当前文件中的 4 个配置点需要直接改：

1. `siege-and-occupation`
   - 当前：`hiddenFromCatalog: true`
   - 目标：移除隐藏，提升为目录可见主章节
2. `korea-and-special-map-rules`
   - 当前：`hiddenFromCatalog: true`
   - 目标：移除隐藏，提升为目录可见主章节
3. `retreat-and-rout`
   - 当前：隐藏，并 `nextTutorialId: 'siege-and-occupation'`
   - 目标：继续隐藏，但取消指向攻城章的自动续链
4. `year-and-characters`
   - 当前：`nextTutorialId: 'korea-and-special-map-rules'`
   - 目标：取消自动续到地图特例章

### 自动续章链

实施后目标应明确为：

- 保留：
  - `attack-and-battle -> retreat-and-rout`
  - `wheel-shared-cost -> armament-upgrade -> event-action -> diplomacy-and-hire`
- 取消：
  - `retreat-and-rout -> siege-and-occupation`
  - `year-and-characters -> korea-and-special-map-rules`

## `tutorial.ts` 改造映射

### 需要保留的 id

- `basic-opening`
- `attack-and-battle`
- `retreat-and-rout`
- `siege-and-occupation`
- `wheel-shared-cost`
- `armament-upgrade`
- `event-action`
- `diplomacy-and-hire`
- `year-and-characters`
- `korea-and-special-map-rules`

### 需要改的目录可见性

- 保持可见：
  - `basic-opening`
  - `attack-and-battle`
  - `wheel-shared-cost`
  - `year-and-characters`
- 由隐藏改为可见：
  - `siege-and-occupation`
  - `korea-and-special-map-rules`
- 继续隐藏：
  - `retreat-and-rout`
  - `armament-upgrade`
  - `event-action`
  - `diplomacy-and-hire`

### 需要改的续章链

- 改前：
  - `attack-and-battle -> retreat-and-rout -> siege-and-occupation`
  - `year-and-characters -> korea-and-special-map-rules`
- 改后建议：
  - `attack-and-battle -> retreat-and-rout`
  - `retreat-and-rout -> 无`
  - `year-and-characters -> 无`

## step 级映射

### `basic-opening`

- 保留 step：
  - `welcome`
  - `hand-limit`
  - `wheel-first`
  - `after-wheel`
  - `hand-resource`
  - `select-region`
  - `pick-action`
  - `pay-cards`
  - `action-result`
  - `morale-level`
  - `wheel-action`
  - `finish`
- 实施要求：
  - 重点不是再增 step，而是保证这些 step 真正按规则顺序承接

### `attack-and-battle`

- 主章保留：
  - `overview`
  - `move-entry`
  - `battle-open`
  - `battle-damage`
  - `battle-result`
  - `retreat-and-defeat`
  - `battle-finish`
- 建议新增或重构的 step 槽位：
  - `border-width`
  - `neutral-entry`
  - `tactic-window`
- 原因：
  - 这些是当前文案已要求、但当前 step 结构还没有真实承接位的规则点

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
- 建议：
  - 保留这组 step id
  - 重写文案与预设，让它们真的对应守城、城战、围城、占领差异

### `wheel-shared-cost`

- 当前 step：
  - `overview`
  - `choose-move`
  - `draw-result`
  - `dispatch-ready`
  - `finish`
- 建议：
  - 主章只负责“轮盘代价 + 推进到不同系统”的骨架
  - 具体的军备 / 事件 / 外交收益，继续交给隐藏续章承接

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
- 建议：
  - 保留这组 step id
  - 但不要再自动续到地图特例章

### `korea-and-special-map-rules`

- 当前 step：
  - `overview`
  - `korea-region`
  - `hanseong-vp`
  - `water-limit`
  - `shanhaiguan`
  - `finish`
- 建议：
  - 保留 step id
  - 只把目录可见性改正，并补更强的真实入口证据

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

### 建议

- 继续保留现有顶层 key 前缀，不做无必要 rename。
- 原因：
  - 这次重构的主成本在章节语义和真实入口，不在 i18n 前缀重命名。
  - 现有 key 名已经和目标章节语义基本一致，没必要制造一轮纯迁移噪音。

### 只需要重写的内容

- `tutorial.basic.steps.*`
- `tutorial.attackAndBattle.steps.*`
- `tutorial.siege.steps.*`
- `tutorial.wheelSharedCost.steps.*`
- `tutorial.armamentUpgrade.steps.*`
- `tutorial.eventAction.steps.*`
- `tutorial.diplomacy.steps.*`
- `tutorial.yearAndCharacters.steps.*`
- `tutorial.koreaSpecial.steps.*`

### 标题与描述的精确改动点

#### `public/locales/zh-CN/game-qidahen.json`

当前这 4 组标题/描述与目标章节语义不一致，需要直接改：

1. `tutorial.attackAndBattle.title`
   - 当前：`战斗与攻城`
   - 目标：改成只对应野战主章，例如 `进攻与野战`
2. `tutorial.attackAndBattle.description`
   - 当前：`从真实进攻调度一路看到野战、撤退代价，以及攻城后的围城/占领选择。`
   - 目标：去掉“攻城后的围城/占领选择”
3. `tutorial.yearAndCharacters.title`
   - 当前：`年序与地图特例`
   - 目标：改成只对应年度链，例如 `年中、新年与纪年`
4. `tutorial.yearAndCharacters.description`
   - 当前：把朝鲜 / 水路 / 山海关并进年度章
   - 目标：只保留年中 / 新年 / 纪年 / 顺位刷新语义

#### `public/locales/en/game-qidahen.json`

同步改同样 4 组：

1. `tutorial.attackAndBattle.title`
2. `tutorial.attackAndBattle.description`
3. `tutorial.yearAndCharacters.title`
4. `tutorial.yearAndCharacters.description`

### 不必改名、只改文案的章节

- `tutorial.siege.*`
- `tutorial.koreaSpecial.*`

原因：

- 它们的 key 前缀本身已经和目标章节语义一致。
- 真正需要改的是是否可见、文案内容和截图链，而不是 i18n 前缀。

## `tutorialSetup.ts` 预设映射

### 应继续保留的 preset id

- `basic-opening`
- `attack-and-battle`
- `retreat-and-rout`
- `siege-and-occupation`
- `wheel-shared-cost`
- `armament-upgrade`
- `event-action`
- `diplomacy-and-hire`
- `year-and-characters`
- `korea-and-special-map-rules`

### 兼容别名

- `qidahen-basic`
- `field-battle`
- `season-flow`

### 建议

- 兼容别名先保留，避免现有测试或历史路由引用断掉。
- 但新 E2E、文档、截图命名全部只用目标 id，不再继续强化旧别名。

## 测试与路由影响

### 已确认不需要改的通用约束

当前通用测试已经支持下面这些行为，不是这次重构的阻塞点：

- 隐藏教程不出现在目录里，但仍保留直达路由
- 多章节教程在 `/tutorial` 下先显示目录，而不是强行进入默认章节
- 主章节完成后可按 `nextTutorialId` 自动续到隐藏教程

对应现有测试文件：

- `src/pages/__tests__/matchRoomStages.test.tsx`
- `src/pages/__tests__/useMatchRoomRuntimeSetup.test.ts`
- `src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx`

结论：

- 这次不需要改 tutorial 目录系统本身的机制。
- 需要改的是七大恨自己的目录显隐配置和自动续章链。

### 进入实现时一定要改的七大恨测试

#### 1. `src/games/qidahen/__tests__/tutorialFlow.test.ts`

当前断言绑定了这些章节关系：

- `attack-and-battle`
- `retreat-and-rout`
- `siege-and-occupation`
- `wheel-shared-cost`
- `armament-upgrade`
- `event-action`
- `diplomacy-and-hire`
- `year-and-characters`
- `korea-and-special-map-rules`

这份测试本身可继续保留，但要同步以下变更：

- 若 `attack-and-battle` 不再自动续到 `siege-and-occupation`，则测试语义也不能再把攻城看成野战的自然后半截。
- `siege-and-occupation` 既然提升为目录可见主章节，就要把它当独立章节去验证入口和收口。
- `year-and-characters` 若不再自动续到 `korea-and-special-map-rules`，测试也要改成两章独立验证，而不是默认年度章结束后接地图特例章。

#### 2. `e2e/qidahen/qidahen-closeout.e2e.ts`

当前 E2E 的结构虽然已经拍出了主章节与隐藏续章的证据，但文件组织仍偏“按当前 tutorial id 平铺”。

进入实现后要同步改两层：

- 目录断言：
  - 现在只断言 4 个主章节可见、若干续章隐藏
  - 若 `siege-and-occupation`、`korea-and-special-map-rules` 提升为可见主章节，这里的可见/隐藏断言必须同步改
- 自动续章断言：
  - `attack-and-battle` 之后应只续到 `retreat-and-rout`
  - 不再默认继续接 `siege-and-occupation`
  - `year-and-characters` 不再默认接 `korea-and-special-map-rules`

### 目录显隐断言的目标态

文案通过后，E2E 目录页应验证以下 6 个主章节可见：

- `basic-opening`
- `attack-and-battle`
- `siege-and-occupation`
- `wheel-shared-cost`
- `year-and-characters`
- `korea-and-special-map-rules`

以下隐藏续章继续不可见：

- `retreat-and-rout`
- `armament-upgrade`
- `event-action`
- `diplomacy-and-hire`

### 自动续章断言的目标态

建议只保留两条自动续章链：

1. `attack-and-battle -> retreat-and-rout`
2. `wheel-shared-cost -> armament-upgrade -> event-action -> diplomacy-and-hire`

建议取消两条自动续章链：

1. `retreat-and-rout -> siege-and-occupation`
2. `year-and-characters -> korea-and-special-map-rules`

## E2E 与截图链映射

### 当前截图组如何归到目标 6 章

| 目标章节 | 当前截图组 |
| :--- | :--- |
| `basic-opening` | `01-12` |
| `attack-and-battle` | `23-25` + `26-27` |
| `siege-and-occupation` | `28-29` |
| `wheel-shared-cost` | `13-15` + `16-18` + `19-22` + `30-33` |
| `year-and-characters` | `34-38` |
| `korea-and-special-map-rules` | `39-42` |

### 当前 `qidahen-closeout.e2e.ts` 的结构问题

- 现在截图证据已经能覆盖很多真实链，但测试组织仍更像“按隐藏教程 id 顺序拍图”。
- 文案通过后，E2E 应按 6 个主章节分段整理，而不是继续让隐藏续章在文件结构里看起来像平级主章节。

### 建议的 E2E 重组

- 保留当前真实路由和截图能力。
- 但按 6 个主章节重排测试段落：
  - 基础回合
  - 进攻与野战（包含隐藏撤退续章证据）
  - 攻城与围城
  - 轮盘分支与发展行动（包含军备 / 事件 / 外交续章证据）
  - 年中、新年与纪年
  - 朝鲜与地图特例

### `qidahen-closeout.e2e.ts` 精确改动清单

#### 1. 目录页断言

当前目录断言位于文件开头的这一组：

- 可见：
  - `basic-opening`
  - `attack-and-battle`
  - `wheel-shared-cost`
  - `year-and-characters`
- 隐藏：
  - `retreat-and-rout`
  - `siege-and-occupation`
  - `armament-upgrade`
  - `event-action`
  - `diplomacy-and-hire`
  - `korea-and-special-map-rules`

目标态应改为：

- 可见：
  - `basic-opening`
  - `attack-and-battle`
  - `siege-and-occupation`
  - `wheel-shared-cost`
  - `year-and-characters`
  - `korea-and-special-map-rules`
- 隐藏：
  - `retreat-and-rout`
  - `armament-upgrade`
  - `event-action`
  - `diplomacy-and-hire`

#### 2. 主章节标题与截图分段命名

当前截图分组里，已经客观对应目标 6 章，但命名和测试段落组织仍未完全按 6 章展开。

实施时至少要同步重组这几段：

- `23-27`
  - 统一归到 `attack-and-battle`
- `28-29`
  - 单独归到 `siege-and-occupation`
- `34-38`
  - 单独归到 `year-and-characters`
- `39-42`
  - 单独归到 `korea-and-special-map-rules`

#### 3. 隐藏续章直达路由

当前 E2E 仍直接访问这些隐藏续章路由：

- `/play/qidahen/tutorial/armament-upgrade`
- `/play/qidahen/tutorial/event-action`
- `/play/qidahen/tutorial/retreat-and-rout`
- `/play/qidahen/tutorial/diplomacy-and-hire`

这不是问题，可以继续保留。

原因：

- 隐藏教程仍需保留路由能力，现有通用测试已经明确允许这一点。
- 真正要改的是目录显隐和主章节语义，不是取消这些技术路由。

## 进入实现前的最终改动边界

文案一旦通过，后续实现边界只到这里，不应再扩：

1. 七大恨教程章节树
   - `tutorial.ts`
2. 七大恨教程文案
   - 中英文语言包
3. 七大恨教程预设
   - `tutorialSetup.ts`
4. 七大恨教程测试与截图链
   - `tutorialFlow.test.ts`
   - `qidahen-closeout.e2e.ts`

不应顺手扩到：

- 通用 tutorial 目录系统重构
- 通用 lifecycle 机制重写
- 其他游戏教程树调整
- 与七大恨教程无关的 UI/规则逻辑改造

## 文案通过后，实施前只剩一个结构决策点

只剩这一个需要明确拍板的结构问题：

- `siege-and-occupation` 和 `korea-and-special-map-rules`
  - 是按当前建议提升为目录可见主章节；
  - 还是继续作为隐藏续章，只在其他主章节后自动进入。

默认推荐：

- 提升为目录可见主章节。

原因：

1. 它们已经分别对应独立玩家心智任务。
2. 如果继续隐藏，玩家会更难把“攻城”与“野战”、“地图特例”与“年度结算”区分开。
3. 这次重构的目标本来就是把教程讲成玩法章节，而不是讲成技术续页。
