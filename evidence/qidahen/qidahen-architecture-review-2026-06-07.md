# 七大恨正式架构审查（2026-06-07）

> 依据新流程 `create-new-game` 的“前置 1.2.2：规则驱动对象粒度与架构职责裁定（强制）”与 `architecture-review-template.md` 补齐正式产物。
> 这份文档的目标不是继续推进实现，而是先裁定：当前《七大恨》对象模型是否还允许继续深化正式规则实现。

## 0. 基本信息

- `gameId`：`qidahen`
- 主真相源：当前工程实现
  - [domain/types.ts](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/types.ts)
  - [domain/index.ts](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/index.ts)
  - [Board.tsx](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/Board.tsx)
  - [game.ts](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/game.ts)
- 对照源：[`create-new-game` 架构审查模板](D:/gongzuo/webgame/BoardGame/.codex/skill/create-new-game/references/architecture-review-template.md)
- 当前 OpenSpec / change：无。本轮为正式架构审查，不启动新的 proposal/change
- 审查日期：2026-06-07
- 审查人：Codex

## 证据位点

- 当前特种部队仍是聚合栈：[`QidahenSpecialTroopStack`](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/types.ts:116)
- 区域/城市/围城状态都直接吃 `specialTroops[]` 栈结构：
  - [QidahenSiegeState.attackerSpecialTroops](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/types.ts:93)
  - [QidahenCityState.specialTroops](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/types.ts:101)
  - [QidahenRegionSummary.specialTroops](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/types.ts:104)
- 当前地图 token 只是显示对象，只有 `rotationDeg`，没有正式 `level` / `pieceId` / `owner`：[`QidahenMapToken`](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/types.ts:519)
- 当前 `mapTokens` 由 `regions` 派生，不是独立真相层：
  - [`buildMapArmyTokensForRegion()`](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/index.ts:6361)
  - [`syncMapTokensFromRegions()`](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/index.ts:6431)
  - [`createInitialCore()` 中 `mapTokens: syncMapTokensFromRegions([], regions)`](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/index.ts:9821)
- 当前 Board 直接渲染 `core.mapTokens`：[`core.mapTokens.map(...)`](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/Board.tsx:1253)
- 引擎已接 `createInteractionSystem()`，但领域交互等待态仍大面积挂在 `core`：
  - [game.ts](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/game.ts:1)
  - [`QidahenCore.recruitSelection / diplomacySelection / handLimitDiscardSelection / wheelDispatchSelection / pendingTargetAction / postBattleSelection`](D:/gongzuo/webgame/BoardGame/.worktrees/qidahen/src/games/qidahen/domain/types.ts:589)

## 1. 规则对象 -> 工程对象映射

| 规则对象 | 规则作用 | 当前工程对象类型 | 单对象 / 可聚合资源 | 稳定 id | 正式真相落点 | 备注 |
|---|---|---|---|---|---|---|
| 区域状态 | 控制权、人口、驻军、围城、邻接 | `core.regions[]` 区域记录 | 区域级对象 | 区域 id | `core.regions[]` | 这层当前基本成立 |
| 普通兵力 | 在区域中驻扎、移动、承伤、被移除 | `region.troops: number` | 当前按聚合资源处理 | 无单兵 id | `core.regions[].troops` | 只能表达数量，不能表达单兵差异 |
| 特种部队 / 棋子 / 木块 | 等级、士气、朝向、单体移动、单体承伤 | `QidahenSpecialTroopStack` | 当前按聚合栈处理 | 只有栈 id，没有单棋子 id | `core.regions[].specialTroops[]` 等 | 与规则对象不一一对应，是当前主 blocker |
| 地图棋子显示 | 地图上的棋子摆放、旋转、并排显示 | `QidahenMapToken[]` | 显示层派生对象 | 派生 token id | `core.mapTokens[]` | 只有显示职责，不应承载领域真相 |
| 控制标记 / 人口标记 | 区域展示 | `QidahenMapToken[]` | 派生读模型 | 派生 token id | `core.mapTokens[]` | 作为区域状态派生可接受 |
| 交互等待态 | 待选目标、待弃牌、待战后处理 | 多个 `*Selection` / `pendingTargetAction` 字段 | 不属于领域对象 | 各自临时 id/无统一 id | 当前错误落在 `core` | 应迁到 `sys.interaction` |

## 2. 对象粒度裁定

| 对象类型 | 位置 | 朝向/翻面 | 等级/士气/耐久 | 控制/拥有/宿主 | 是否允许聚合 | 结论 | 理由 |
|---|---|---|---|---|---|---|---|
| 部队木块 / 棋子 | 对象级 | 对象级 | 对象级 | 对象级 | 否 | 必须是单对象 | 只要存在单体降级、单体移动、旋转表示士气、局部承伤，`count + level` 就会失真 |
| 普通匿名人口数值 | 区域级 | 无 | 汇总级 | 区域级 | 是 | 可聚合资源 | 当前规则下更像区域库存，不需要单人口对象 |
| 区域控制权 | 区域级 | 无 | 无 | 区域级 | 是 | 区域字段 | 由区域状态直接表达即可 |
| 交互等待态 | 系统级 | 无 | 无 | 当前玩家 / 响应链 | 不适用 | 不进 `core` | 它决定的是“谁该选什么”，不是正式世界状态 |

## 3. 真相层 / 系统层 / 派生层分层

### 3.1 正式真相层

| 字段/结构 | 负责什么 | 谁写入 | 谁读取 |
|---|---|---|---|
| `core.regions[]` | 区域控制权、人口、普通兵力、围城等正式状态 | reducer / setup | validate / execute / Board / 派生 helper |
| `core.factions` | 势力级资源、威望、牌堆等 | reducer / setup | validate / execute / Board |
| `core.regions[].specialTroops[]` | 当前以“栈”形式保存特种部队 | reducer / setup | validate / execute / `mapTokens` 派生 |
| 缺失：正式单棋子集合 | 应负责单木块 `id / regionId / level / morale / facing / faction` | 当前不存在 | 因缺失而被显示层反向补洞 |

### 3.2 系统层

| 字段/结构 | 负责什么 | 说明 |
|---|---|---|
| `sys.interaction` | 正式交互等待系统 | 引擎层已接入，但《七大恨》尚未真正迁入主要等待态 |
| `core.recruitSelection` 等等待字段 | 当前仍在承载待选交互 | 这是历史债，不应继续扩张 |

### 3.3 派生读模型

| 字段/结构 | 来源 | 用途 | 是否可回写 |
|---|---|---|---|
| `mapTokens` | `core.regions[]` + `specialTroops[]` | 地图展示 | 否 |
| 区域提示卡 / 当前选区显示 | `core.regions[]` | UI 展示 | 否 |
| 控制标记 / 人口标记图层 | `core.regions[]` | UI 展示 | 否 |

### 3.4 纯 UI 状态

| 字段/结构 | 用途 | 为什么不进 core |
|---|---|---|
| `hoveredRegionId` 等 Board 层 hover 状态 | 地图高亮与提示 | 不影响规则判定 |
| overlay canvas / hitmap canvas | 区域命中与遮罩渲染 | 纯渲染基础设施 |

## 4. 单一真相与写入路径

| 对象类型 | 创建入口 | 更新入口 | 删除/离场入口 | setup 初始入口 | 显示派生入口 |
|---|---|---|---|---|---|
| 区域状态 | `createInitialCore()` / 场景 helper | reducer 各事件分支 | reducer 各事件分支 | `createInitialCore()` | Board 直接读区域 + 派生标记 |
| 普通兵力 | 当前随区域数值创建 | 当前通过区域字段加减 | 当前通过区域字段清除 | `createInitialCore()` | `syncMapTokensFromRegions()` |
| 特种部队栈 | 当前随区域/城市/围城栈创建 | 当前按栈 `count + level` 改写 | 当前按栈数量归零或移除 | `createInitialCore()` | `buildMapArmyTokensForRegion()` |
| 地图 token | 无独立创建真相 | 每次由区域状态重建 | 每次由区域状态重建 | `createInitialCore()` 中首次派生 | `core.mapTokens.map(...)` |
| 交互等待态 | 当前 reducer 直接塞入 `core` | 当前 reducer 直接改写 `core` | 当前 reducer 直接清空 `core` 字段 | `createInitialCore()` 置空 | UI 直接读 `core` |

结论补充：

- 当前 `setup` 的主真相确实已经在 `regions`，不是“地图上还在吃手写 `mapTokens` 样板”。
- 真问题在于：`regions` 内的部队状态粒度过粗，随后又由 `mapTokens` 派生成“看起来像独立棋子”的显示对象，导致对象模型先天失真。

## 5. 数据驱动边界

### 5.1 属于架构/建模裁定的内容

- 是否必须引入正式单棋子对象集合
- 单棋子是否拥有稳定 `id`
- 单棋子需要承载哪些正式字段：`regionId / faction / level / morale / rotation / owner`
- `sys.interaction` 与 `core` 的职责边界
- `mapTokens` 是否只能做派生显示，禁止反向承担真相

### 5.2 属于数据驱动录入的内容

- 各剧本初始区域兵力、人口、控制权
- 人物牌、军备、年份、区域名称、区域邻接
- 地图 token 的贴图、基准坐标、显示尺寸

### 5.3 明确不允许交给数据驱动“顺带决定”的内容

- 棋子是单对象还是聚合栈
- 交互等待态是否继续留在 `core`
- 显示层 token 是否可以拥有正式领域字段
- 真相层 / 派生层 / 系统层的职责划分

## 6. 压力测试

| 场景 | 当前结构是否成立 | 若不成立，缺口是什么 |
|---|---|---|
| 单对象单独降级/受伤 | 否 | 只有 `count + level` 栈，没有单棋子对象 |
| 只移动同区域中的一部分对象 | 否 | 可减数量，但无法保留“被移动的是哪一枚”及其旋转/士气 |
| 换控制者但不换拥有者 | 否 | 当前没有正式对象级 owner/controller 分离 |
| 做单对象 hover/动画/截图核对 | 否 | `mapTokens` id 为派生结果，不是稳定领域对象 id |
| 新增“只影响其中一枚”的效果 | 否 | 现结构只能作用到整个栈或整个区域汇总 |

## 7. 已知风险与暂不实现边界

- 风险 1：若继续沿 `specialTroops` 聚合栈深化战斗、承伤、训练、士气或旋转规则，会持续制造“领域真相粗粒度 + UI 假对象补洞”的双真相债务。
- 风险 2：若继续把新等待态塞进 `core`，会与已存在的 `sys.interaction` 形成两套并存协议，后续更难统一。
- 风险 3：若继续让 Board 直接依赖 `core.mapTokens` 承担更多语义，后续一旦做动画、回放、撤销、E2E 精细断言，会因为 token id 不稳定而持续漂移。
- 暂不实现边界：
  - 本审查不直接重构《七大恨》现有对象模型
  - 本审查不直接重做 printed/runtime/logical region 三层区域合同
  - 本审查不直接给出现成重构方案代码，只做正式放行裁定

## 8. 结论

- 当前对象模型是否允许进入正式数据录入：`否`
- 当前对象模型是否允许进入 Board 派生实现：`否`
- 当前对象模型是否允许继续深化“部队/棋子/士气/训练/承伤/旋转”正式规则：`否`

必须先补哪些结构：

1. 新增正式单棋子/单木块集合，例如 `core.pieces[]` 或等价结构，最少具备稳定 `id`、当前位置、所属势力、等级/士气、朝向。
2. 把当前 `QidahenSpecialTroopStack` 降级为摘要/兼容层，或明确收回为纯派生汇总，不再作为唯一正式对象。
3. 把 `recruitSelection / diplomacySelection / handLimitDiscardSelection / wheelDispatchSelection / pendingTargetAction / postBattleSelection` 等等待态迁出 `core`，统一收口到 `sys.interaction`。
4. 让 `mapTokens` 严格退回显示层派生对象；Board 以后若要做对象级棋子表现，只能从正式单棋子真相派生。

审查裁定：

- 《七大恨》当前可以继续做“区域级”“势力级”“牌表级”“剧本参数级”的数据录入与规则补完。
- 《七大恨》当前**不允许**继续把“棋子/木块/士气/单体承伤/单体旋转/单体移动”这类依赖对象粒度的规则，当成普通增量需求直接往现结构里塞。
- 后续若要推进这条线，应先开正式重构任务，再进入实现。
