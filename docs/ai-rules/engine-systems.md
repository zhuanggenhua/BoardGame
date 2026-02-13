# 引擎与框架系统完整规范

> 本文档是 `AGENTS.md` 的补充详细规范。**触发条件**：开发/修改引擎系统、框架层代码、游戏 move/command 时阅读。
> AGENTS.md 中已有的规则摘要此处不再重复，本文档只提供详细说明、API 清单和代码模板。

---

## 引擎层概述

- **Domain Core**：Command/Event + Reducer，确定性可回放。
- **Systems**：Undo/Interaction/Log 等跨游戏能力以 hook 管线参与执行。
- **Adapter**：Boardgame.io moves 仅做输入翻译，规则主体在引擎层。自动合并系统命令到 commandTypes。
- **统一状态**：`G.sys`（系统状态） + `G.core`（领域状态）。

---

## 引擎层系统与原语清单

### `engine/systems/`
Flow / Interaction / Undo / Log / EventStream / ResponseWindow / Tutorial / Rematch / Cheat / ActionLog

### `engine/primitives/` — 纯函数/注册器

| 模块 | 职责 | 核心 API |
|------|------|---------|
| `ability.ts` | 能力定义+执行器注册表 | `createAbilityRegistry()` / `createAbilityExecutorRegistry()` / `checkAbilityCost` / `filterByTags` / `checkAbilityCondition` / `abilityText(id,field)` / `abilityEffectText(id,field)` |
| `tags.ts` | 层级 Tag 系统（层数/持续时间/前缀匹配） | `createTagContainer` / `addTag` / `removeTag` / `hasTag` / `matchTags` / `tickDurations` / `getRemovable` |
| `modifier.ts` | 数值修改器栈（flat/percent/override/compute） | `createModifierStack` / `addModifier` / `applyModifiers` / `computeModifiedValue` / `tickModifiers` |
| `attribute.ts` | base + ModifierStack → current（min/max 钳制） | `createAttributeSet` / `getBase` / `setBase` / `getCurrent` / `addAttributeModifier` / `tickAttributeModifiers` |
| `uiHints.ts` | 可交互实体查询接口 | `UIHint` / `UIHintProvider<TCore>` / `filterUIHints` / `groupUIHintsByType` / `extractPositions` |
| `visual.ts` | 基于 atlasId 的视觉资源解析器 | `VisualResolver` |
| `actionRegistry.ts` | actionId → handler 注册表 | `ActionHandlerRegistry` |
| `condition.ts` / `effects.ts` / `dice.ts` / `resources.ts` / `target.ts` / `zones.ts` / `expression.ts` | 其他引擎原语 | — |

### `engine/testing/` — 测试工具

| 工具 | 用途 |
|------|------|
| `referenceValidator.ts` | 实体引用链完整性验证（`validateReferences` / `extractRefChains`） |
| `entityIntegritySuite.ts` | 五个测试套件工厂：RegistryIntegrity / RefChain / TriggerPath / EffectContract / I18nContract |
| `interactionChainAudit.ts` | 模式 A：UI 状态机 payload 覆盖审计 |
| `interactionCompletenessAudit.ts` | 模式 B：Interaction handler 注册覆盖审计 |

### `engine/fx/` — FxSystem

Cue 注册表 + 事件总线 + 渲染层 + WebGL Shader 子系统 + FeedbackPack。游戏侧通过 `fxSetup.ts` 注册渲染器并声明反馈包（音效+震动）。`useFxBus` 接受 `{ playSound, triggerShake }` 注入反馈能力，push 时自动触发 `timing='immediate'` 反馈，渲染器 `onImpact()` 触发 `timing='on-impact'` 反馈。Shader 管线（`src/engine/fx/shader/`）提供 `ShaderCanvas` + `ShaderMaterial` + `ShaderPrecompile` + GLSL 噪声库。

---

## 新引擎系统注意事项（强制）

- **数据驱动优先**：规则/配置/清单做成可枚举数据，引擎解析执行，避免分支硬编码。
- **领域 ID 常量表**：所有稳定 ID 在 `domain/ids.ts` 用 `as const` 定义，导出派生类型（`StatusId`/`TokenId`）。例外：i18n key、类型定义中的字面量。
- **新机制先检查引擎**：实现前必须先搜索 `engine/primitives/` 和 `engine/systems/`，无则先在引擎层抽象。
- **新游戏能力系统必须使用 `ability.ts`**：禁止自行实现注册表。每游戏独立实例，通过 label 区分。

---

## 通用能力框架（强制）

### 核心组件（`engine/primitives/ability.ts`）

- **`AbilityDef<TEffect, TTrigger>`** — 泛型能力定义（id/name/trigger/effects/condition/tags/cost/cooldown/variants/meta）
- **`AbilityRegistry<TDef>`** — 定义注册表（`register/get/getAll/getByTag/getByTrigger/getRegisteredIds`）
- **`AbilityExecutorRegistry<TCtx, TEvent>`** — 执行器注册表，支持 `id+tag` 复合键（`register/resolve/has/getRegisteredIds`）
- **工具函数**：`checkAbilityCost` / `filterByTags` / `checkAbilityCondition`（委托 `primitives/condition`）
- **i18n 辅助**：`abilityText('frost_axe','name')` → `'abilities.frost_axe.name'`；`abilityEffectText('slash','damage')` → `'abilities.slash.effects.damage'`

### 强制要求

1. 禁止自行实现注册表或全局单例
2. `getRegisteredIds()` 用于 `entity-chain-integrity.test.ts` 契约测试
3. 条件评估复用 `primitives/condition`（`AbilityDef.condition` 使用 `ConditionNode`）

### 两种执行模式（可混合）

- **声明式**：`AbilityDef` 数据 → `AbilityRegistry` → `executeEffects()` 执行效果列表（效果结构统一时）
- **命令式**：`AbilityExecutor` 函数 → `AbilityExecutorRegistry` → `resolve(id, tag?)` 调用（逻辑差异大时）

### 现有游戏迁移状态

SummonerWars 已完成迁移（引擎层 Registry + ExecutorRegistry）。DiceThrone `CombatAbilityManager`、SmashUp `abilityRegistry.ts` 是历史实现（内部合理但未用引擎层），**新游戏禁止模仿**。

---

## 技能系统反模式清单（强制）

> AGENTS.md 已列出禁止项摘要，此处提供判断标准和正确模式的关键代码。

### ❌ 技能验证硬编码

禁止 `validate.ts` 中 `switch(payload.abilityId) { case 'xxx': ... }`。
✅ 在 `AbilityDef.validation` 声明规则（`requiredPhase`/`requiresTarget`/`targetFilter`/`costCheck`/`usesPerTurn`/`customValidator`），通用 `validateAbility(def, ctx)` 自动验证。

### ❌ 技能按钮硬编码

禁止 UI 组件中 `if (abilities.includes('xxx')) { buttons.push(...) }`。
✅ 在 `AbilityDef.ui` 声明元数据（`requiresButton`/`buttonPhase`/`buttonLabel`/`buttonVariant`），通用组件遍历 `abilities.filter(a => a.ui?.requiresButton)` 自动渲染。

### ❌ 特殊逻辑硬编码

禁止 `execute.ts` 中 `if (abilityId === 'rapid_fire') { ... }`。
✅ 在 `abilityResolver.ts` 或 `customActionHandlers.ts` 注册 handler，execute.ts 只负责触发 `triggerAbilities(trigger, ctx)`。

### ❌ 技能描述多源冗余

禁止卡牌配置硬编码 `abilityText`（与 `AbilityDef.description` + i18n 三重冗余）。
✅ 卡牌配置只保留 `abilities: ['id']`，`AbilityDef` 中 `name`/`description` 存 i18n key（用 `abilityText()` 辅助函数生成），UI 层通过 `t(def.description)` 获取文本。

### 强制要求总结

1. 技能验证 → `AbilityDef.validation` + 通用函数
2. 技能按钮 → `AbilityDef.ui` + 通用组件
3. 技能逻辑 → 注册到 `abilityResolver.ts`，不改 execute.ts
4. 新增技能只需：① `abilities-*.ts` 添加 `AbilityDef` ② 注册执行器 ③ i18n JSON 添加文案
5. 描述文本单一来源：i18n JSON（通过 `AbilityDef.description` 存 i18n key）

---

## 效果数据契约测试（强制）

> 新增游戏/英雄/卡牌/Token 定义时，必须同步编写契约测试。

### `createEffectContractSuite<TSource, TEffect>` 工厂

接受 `getSources()` / `getSourceId()` / `extractEffects()` / `rules: EffectContractRule[]` / `minSourceCount`。

每条 `EffectContractRule` 定义：`name`（测试标题）/ `appliesTo(effect)` / `check(effect)` / `describeViolation(effect)`。

用法示例（精简）：
```typescript
const rules: EffectContractRule<MyEffect>[] = [
  { name: 'random action 需 timing', appliesTo: e => ACTIONS_REQUIRING_RANDOM.has(e.action?.type),
    check: e => e.timing !== undefined, describeViolation: e => `"${e.action.type}" 缺 timing` },
];
createEffectContractSuite({ suiteName: '技能效果契约', getSources, getSourceId, extractEffects, rules, minSourceCount: 20 });
```

### 三类契约（DiceThrone 参考）

| 类别 | 数据源 | 典型规则 |
|------|--------|----------|
| 技能效果 | `AbilityDef.effects` + `variants` | random→timing、rollDie→conditionalEffects、customActionId→已注册 |
| 卡牌效果 | `AbilityCard.effects` | 主阶段卡需 `timing:'immediate'`、replaceAbility 需完整字段 |
| Token 被动 | `TokenDef.passiveTrigger.actions` | customActionId→已注册 |

### `createI18nContractSuite<TSource>` 工厂

验证 i18n key 格式（正则）和存在性（各语言文件）。接受 `keyExtractors`（`fieldName`/`extract`/`keyPattern`/`patternDescription`）+ `locales`（用 `flattenI18nKeys()` 转换）。

### 卡牌效果 timing 边界测试

| 验证内容 | 防止的 bug |
|----------|-----------|
| 非纯描述效果必须有显式 timing | 效果不执行 |
| instant 卡效果必须 `timing:'immediate'` | grantToken/grantStatus 静默跳过 |
| grantToken/grantStatus 必须有显式 timing | Token/状态未授予 |
| onHit 条件效果必须 `timing:'postDamage'` | 命中判定失效 |

### 强制要求

- 新增英雄/卡牌/Token → 确保现有契约规则覆盖，运行测试
- 新增效果类型/action type → 评估是否需新增契约规则
- 新增游戏 → 创建 `entity-chain-integrity.test.ts` 并注册契约规则
- 卡牌 name/description 必须用 i18n key（`cardText()` 辅助函数），同步更新 zh-CN 和 en
- 所有有 action 的效果必须声明 timing
- **参考**：`src/games/dicethrone/__tests__/entity-chain-integrity.test.ts`

---

## 交互链完整性审计 — 模式 A：UI 状态机（强制）

> 多步交互技能（UI ≥2 步输入构建 payload）必须声明 `interactionChain`。

### 核心类型（`engine/primitives/ability.ts`）

```typescript
interface InteractionStep { step: string; inputType: 'unit'|'position'|'card'|'direction'|'choice'|'cards'; producesField: string; optional?: boolean; }
interface PayloadContract { required: string[]; optional?: string[]; }
interface InteractionChain { steps: InteractionStep[]; payloadContract: PayloadContract; }
```

### 使用方式

1. `AbilityDef` 中声明 `interactionChain`（steps + payloadContract）
2. 执行器 `register()` 时声明 `payloadContract`
3. 测试文件用 `createInteractionChainAuditSuite({ suiteName, abilities, requiresMultiStep, declarationWhitelist })`

### 三类检查

| 检查 | 检测的 bug |
|------|-----------|
| 声明完整性：多步技能是否都声明了 `interactionChain` | 新增多步技能忘记声明 |
| 步骤覆盖：steps 产出 ⊇ payloadContract.required | UI 缺少某个交互步骤 |
| 契约对齐：AbilityDef 与执行器的 payloadContract 双向一致 | 两端字段不同步 |

**循环依赖注意**：`executors/index.ts` 副作用导入与 `abilities.ts` 有初始化顺序问题，测试中用手动 `EXECUTOR_CONTRACTS` Map。

**参考**：`src/games/summonerwars/__tests__/interactionChainAudit.test.ts`、`domain/abilities-frost.ts`

---

## 交互完整性审计 — 模式 B：Interaction 链（强制）

> 使用 InteractionSystem（`createSimpleChoice` + `InteractionHandler`）的游戏必须创建此审计。

### 三类检查

| 检查 | 检测的 bug |
|------|-----------|
| Handler 注册覆盖：所有 sourceId 都有对应 handler | 创建了交互但没注册处理函数 |
| 链式完整性：handler 产出的后续 sourceId 也有 handler | 多步链中间断裂 |
| 孤儿 Handler：注册了 handler 但无能力引用 | 死代码/重构遗留 |

用法：`createInteractionCompletenessAuditSuite({ suiteName, sources, registeredHandlerIds, chains })`

**模式 A vs B**：A 检查 UI payload 字段覆盖，B 检查 handler 注册覆盖。一个游戏可同时使用两种。

**参考**：`src/games/smashup/__tests__/interactionCompletenessAudit.test.ts`

---

## 引擎测试工具总览与选型

> **GameTestRunner 行为测试是最优先、最可靠的测试手段**，审计工具是补充。

| 工具 | 适用场景 | 已用游戏 |
|------|---------|---------|
| GameTestRunner | 命令序列+状态断言（首选） | DT/SW/SU |
| entityIntegritySuite | 数据定义契约（注册表/引用链/触发路径/效果/i18n） | SU/DT |
| referenceValidator | 实体引用链提取与验证 | SU |
| interactionChainAudit | UI 状态机 payload 覆盖（模式 A） | SW |
| interactionCompletenessAudit | Interaction handler 注册覆盖（模式 B） | SU |

**新游戏选型**：所有游戏必选 GameTestRunner；≥20 实体 → entityIntegritySuite；有多步 UI 交互 → interactionChainAudit；有 InteractionSystem → interactionCompletenessAudit。

---

## 禁止 if/else 硬编码 actionId 分发（强制）

处理多个 actionId/effectType/customId 时禁止 if/else 或 switch-case，必须使用注册表（`ActionHandlerRegistry` / 游戏层注册表）。原因：注册表支持 entity-chain-integrity 自动检测断裂引用。

---

## 框架解耦要求（强制）

- 禁止框架层 import 游戏层；游戏特化下沉到 `games/<gameId>/`
- 框架提供通用接口+注册表，游戏层显式注册扩展
- 新系统在 `engine/systems/` 实现并在 `index.ts` 导出；需默认启用则加入 `createBaseSystems()`
- 系统状态写入 `SystemState`，由 `setup()` 初始化，禁止塞进 `core`
- 系统命令由 adapter 自动合并，游戏层只列业务命令
- Move payload 必须包装为对象，禁止裸值；系统命令用 `UNDO_COMMANDS.*` 等常量
- 需要 `reset()` 的系统必须保证重开后回到初始值

---

## 框架复用优先（强制）

三层模型：`/core/ui/` 契约层 → `/components/game/framework/` 骨架层 → `/games/<gameId>/` 游戏层。

**新增前强制检查**：搜索 `/core/`、`/components/game/framework/`、`/engine/` 确认无已有实现。

**框架层 Hooks 清单**（`/components/game/framework/hooks/`）：
- `useGameBoard` — 棋盘核心状态
- `useHandArea` — 手牌区状态
- `useResourceTray` — 资源栏状态
- `useDragCard` — 卡牌拖拽交互
- `useAutoSkipPhase` — 无可用操作时自动跳过（注入 `hasAvailableActions` + `hasActiveInteraction`）
- `useVisualSequenceGate` — 视觉序列门控（`beginSequence`/`endSequence`/`scheduleInteraction`/`isVisualBusy`/`reset`）

**系统层设计原则**：接口+通用骨架在系统层，游戏特化下沉；每游戏独立实例禁止全局单例；UGC 通过 AI 生成符合接口的代码动态注册。

---

## EventStreamSystem 使用规范（强制）

特效/动画/音效消费必须用 `getEventStreamEntries(G)`（EventStreamSystem），禁止用 `getEvents(G)`（LogSystem）。原因：LogSystem 持久化全量日志刷新后完整恢复，EventStream 实时消费通道带自增 `id`，撤销时清空。

### 首次挂载跳过历史事件（强制）

> 所有消费 EventStream 的 Hook/Effect 必须遵循，无例外。

**模式 A：过滤式消费（推荐，处理多条新事件）**
```typescript
const lastSeenIdRef = useRef<number>(-1);
const isFirstMountRef = useRef(true);
// 首次挂载：指针推进到末尾
useEffect(() => {
  if (isFirstMountRef.current && entries.length > 0) {
    lastSeenIdRef.current = entries[entries.length - 1].id;
    isFirstMountRef.current = false;
  }
}, [entries]);
// 后续：只处理 id > lastSeenId
useEffect(() => {
  if (isFirstMountRef.current) return;
  const newEntries = entries.filter(e => e.id > lastSeenIdRef.current);
  if (newEntries.length === 0) return;
  // ... 处理 newEntries
  lastSeenIdRef.current = newEntries[newEntries.length - 1].id;
}, [entries]);
```

**模式 B：单条最新事件消费**
```typescript
// 关键：初始值用当前最新 id，非 null/-1
const lastProcessedIdRef = useRef<number | null>(latestEntry?.id ?? null);
useEffect(() => {
  if (!latestEntry || lastProcessedIdRef.current === latestEntry.id) return;
  lastProcessedIdRef.current = latestEntry.id;
  // ... 处理 latestEntry
}, [latestEntry]);
```

**禁止**：初始值为 `null/-1` 且无首次挂载跳过逻辑；仅靠 `mountedRef` 守卫（后续 state 变化仍会重播）。

**检查清单**：① 首次挂载是否推进指针到最新？② 后续是否只处理 `id > lastSeenId`？③ 模式 B 的 `useRef` 初始值是否为 `currentEntry?.id ?? null`？④ 同一 Hook 内所有 effect 是否一致？

**参考**：模式 A → `dicethrone/hooks/useCardSpotlight.ts`、`useActiveModifiers.ts`；模式 B → `useAnimationEffects.ts`；音效去重 → `lib/audio/useGameAudio.ts`

---

## ActionLogSystem 使用规范（强制）

- ActionLogSystem 只负责收集/落库，禁止系统层硬编码游戏文案
- `formatEntry` 必须返回 i18n key 的 `ActionLogSegment`，禁止拼接硬编码字符串
- 覆盖所有玩家可见状态变化（伤害/治疗/摧毁/移动/资源/VP），不记录内部系统事件
- 支持多条日志返回（命令级+同步事件级）
- 卡牌类日志必须用 `card` 片段支持 hover 预览

### 音效与动画分流（强制）

- **无动画事件** → `feedbackResolver` 返回 `SoundKey`，框架层立即播放
- **有动画事件** → `feedbackResolver` 返回 `null`，动画层 `onImpact` 回调 `playSound(key)`
- **FX 特效** → `FeedbackPack` 在 `fxSetup.ts` 声明；运行时依赖数据用 `{ source: 'params' }`，`useFxBus` 从 `event.params.soundKey` 读取
- **原因**：引擎同步生成所有事件，动画有飞行时间，立即播音会视听不同步

---

## ABILITY_TRIGGERED 事件规范（强制）

必须用 `createAbilityTriggeredEvent()` 创建，payload 类型 `AbilityTriggeredPayload`，`sourcePosition` 必填。禁止手写 `{ type: SW_EVENTS.ABILITY_TRIGGERED, payload: {...} }`。回归守卫：`phase-ability-integration.test.ts`。

---

## afterEventsRound 限制（强制）

`FlowSystem.afterEvents` 在 `afterEventsRound > 0` 时传空 events 给 `onAutoContinueCheck`，基于事件的自动推进链单次 `executePipeline` 最多跨一个阶段。测试中 `createInitializedState` 返回 upkeep（非 main1），仍需手动 `cmd('ADVANCE_PHASE')` 推进。详见 `docs/refactor/dicethrone-auto-advance-upkeep-income.md`。

---

## 阶段推进权限的 UI 消费（强制）

- 领域层 `rules.ts` 定义 `canAdvancePhase(core, phase)` 做规则校验
- FlowSystem 通过 `flowHooks.canAdvance` 调用，作为服务端兜底
- UI 层禁止重复实现领域校验，应复用领域层函数
- 正确模式：游戏状态 Hook 中计算 `canAdvancePhase`（领域校验 + `!hasPendingInteraction`），Board 叠加 `isFocusPlayer`
- **参考**：`dicethrone/hooks/useDiceThroneState.ts`

---

## 重赛系统

- **多人**：socket.io 房间层投票（`RematchContext` + `matchSocket.ts`），不走 boardgame.io move（绕过 `ctx.gameover` 限制）
- **单人**：直接 `reset()`
- 服务端 `server.ts` REMATCH_EVENTS → 客户端 `matchSocket.ts` + `RematchContext.tsx` → UI `RematchActions` + `useRematch()`

---

## 领域层编码规范详解（强制）

### Reducer 结构共享

✅ 只 spread 变更路径，值未变时返回原引用：
```typescript
const target = core.players[targetId];
if (!target) return core;
const newHp = Math.max(0, target.hp - amount);
if (newHp === target.hp) return core;
return { ...core, players: { ...core.players, [targetId]: { ...target, hp: newHp } } };
```
❌ 禁止 `JSON.parse(JSON.stringify(core))`。嵌套 ≥3 层提取 `updatePlayer(core, pid, updater)` helper。

### types.ts 默认拆分模板

命令数 ≥5 或多阶段回合时从第一天用：
```
domain/
  types.ts          # re-export barrel: export * from './core-types'; export * from './commands'; export * from './events';
  core-types.ts     # 状态接口
  commands.ts       # 命令类型
  events.ts         # 事件类型
```

### Core 状态决策树

1. 被 `reduce()` 写入？→ 否：不属于 core
2. 被 `validate()`/`execute()`/`isGameOver()` 读取并影响决策？→ 否：不属于 core
3. "等待玩家输入"？→ 放 `sys.interaction`
4. 仅 UI 展示？→ 走 EventStreamSystem
5. 确实影响规则 → 允许放入 core，**必须注释规则依赖**

### 游戏内工具函数

`domain/utils.ts` 从第一天建立，放 `applyEvents`/`getOpponentId`/`updatePlayer` 等。≥2 个 domain 文件使用的函数必须放此处。引擎层已有的能力禁止重新实现。

---

## UIHints 使用规范（推荐）

引擎层 `engine/primitives/uiHints.ts` 提供轻量级"可交互实体"查询接口。游戏层实现 `UIHintProvider<TCore>` 函数返回 `UIHint[]`，UI 层用 `extractPositions(hints)` 渲染视觉提示。不在 core 中存储（派生数据），用 `useMemo` 缓存。

**参考**：`summonerwars/domain/uiHints.ts` → `summonerwars/ui/useCellInteraction.ts`

---

## 动态赋予效果的 UI 提示（强制）

任何动态赋予的效果（基地能力/持续行动卡/buff/debuff/光环/条件触发）必须有 UI 提示：
1. 持续力量修正 → 显示修正后值，与基础值有视觉区分
2. 持续保护/限制 → 图标或文字提示
3. 基地能力效果 → 基地卡上清晰展示
4. 临时 buff/debuff → 视觉标记，效果结束自动消失
5. 条件触发 → 条件满足时视觉反馈

**UI 展示方式不明确时必须询问用户确认**，禁止自行猜测。

---

## 描述→实现全链路审查规范（强制）

> **当用户说"审查"/"审核"/"检查实现"/"核对"等词时，必须按此规范执行，禁止凭印象回答。**

### 适用场景

① 新增技能/Token/事件卡/被动/光环实现 ② 修复"没效果"类 bug ③ 审查已有机制 ④ 重构涉及消费链路

### 审查流程

**第一步：拆分原子效果** — 每个"动词"或"条件→结果"对 = 一个原子效果。

**第二步：逐效果追踪六层链路**

| 层 | 检查内容 |
|----|----------|
| 1. 定义层 | 效果在数据定义中声明（AbilityDef/TokenDef/CardDef） |
| 2. 执行层 | 触发/执行逻辑存在（execute/abilityResolver/handler） |
| 3. 状态层 | 状态变更被 reduce 正确持久化 |
| 4. 验证层 | 是否影响其他命令合法性（validate 放宽/收紧） |
| 5. UI 层 | 视觉反馈/交互变化同步（动态效果必须有 UI 提示） |
| 6. 测试层 | 端到端测试覆盖"触发→生效→状态正确" |

**第三步：grep 发现所有消费点** — ID 只出现在定义+注册文件 = 消费层缺失。

### 测试覆盖要求

每个原子效果：正向（触发→生效→验证状态）+ 负向（不触发→状态未变）+ 边界（0值/空目标/多次叠加）。**禁止只测注册/写入就判定"已实现"。**

### 产出要求

- 输出"原子效果 × 六层"矩阵，每个交叉点 ✅/❌ + 具体证据（文件名+函数名）
- ❌ 时立即修复或标注 TODO
- UI 层不明确时询问用户
- 禁止"看起来没问题"的模糊结论
