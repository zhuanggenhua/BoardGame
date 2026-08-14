---
name: engine-systems
description: 引擎系统总览：共享原语、事件、FX、AI 和状态边界——改共享引擎能力时查
metadata:
  type: doc
  status: 已交付
---

# 引擎与框架系统完整规范

> 本文档是 `AGENTS.md` 的补充详细规范。**触发条件**：开发/修改引擎系统、框架层代码、游戏 move/command 时阅读。
> AGENTS.md 中已有的规则摘要此处不再重复，本文档只提供详细说明、API 清单和代码模板。
> **测试与审计规范**见 `.spec/knowledge/standards/testing-audit.md`。

---

## 引擎层概述

- **Domain Core**：Command/Event + Reducer，确定性可回放。
- **Systems**：Undo/Interaction/Log 等跨游戏能力以 hook 管线参与执行。
- **Adapter**（`createGameEngine`）：将 Domain Core + Systems 组装成 `GameEngineConfig`，供 `GameTransportServer` 使用。自动合并系统命令到 commandTypes。
- **Transport**：自研传输层（`GameTransportServer` + `GameTransportClient`）。
- **统一状态**：`G.sys`（系统状态） + `G.core`（领域状态）。`G.sys.gameover` 为游戏结束的唯一检测来源。

### 传输层架构入口（强制理解）

> 传输层架构、`GameBoardProps` 契约、在线/本地 Provider、命令执行者与本地视角玩家边界，已拆到 `.spec/knowledge/standards/engine-transport.md`。
>
> 修改 socket、dispatch、Provider、Board props、乐观传输入口或本地教程壳层时，先读该文档；本文档只保留引擎总览和路由。

## 领域层职责边界（强制）

### execute 层职责约束（Critical）

**execute 函数的唯一职责**：命令 → 基础事件。

#### 允许的操作 ✅

- 生成基础事件（`MINION_PLAYED` / `ACTION_PLAYED` / `CARDS_DRAWN` / `DAMAGE_DEALT` 等）
- 读取当前状态（`state.core`）进行条件判断
- 调用纯函数辅助（如 `getCardDef` / `findUnit` / `canPlayCard`）
- 返回事件数组

#### 禁止的操作 ❌

- **禁止调用触发链函数**（如 `fireMinionPlayedTriggers` / `fireUnitPlayedTriggers` / `triggerOnPlay`）
- **禁止调用 `reduce`** 模拟状态推演（应在 `postProcessSystemEvents` 中处理）
- **禁止直接修改 `state.sys`**（系统状态由引擎管理）
- **禁止创建交互**（应在能力执行器中通过 `queueInteraction` 创建）

#### 正确的职责分离

```typescript
// ✅ 正确：execute 只生成基础事件
case COMMANDS.PLAY_MINION: {
    const playedEvt: MinionPlayedEvent = {
        type: EVENTS.MINION_PLAYED,
        payload: { playerId, cardUid, defId, baseIndex, power },
        timestamp: now,
    };
    return { events: [playedEvt] };
    // 触发链由 postProcessSystemEvents 统一处理
}

// ❌ 错误：execute 层调用触发链（会导致重复触发）
case COMMANDS.PLAY_MINION: {
    events.push(playedEvt);
    const triggers = fireMinionPlayedTriggers(...); // ❌ 禁止
    events.push(...triggers.events);
    return { events };
}
```

#### 触发链的正确位置

所有触发链（onPlay / onMinionPlayed / ongoing triggers）必须在 `postProcessSystemEvents` 中统一处理：

```typescript
// domain/index.ts
postProcessSystemEvents(state, events, pid, random, now) {
    // 检测 MINION_PLAYED 事件，自动追加触发链
    for (const event of events) {
        if (event.type === EVENTS.MINION_PLAYED) {
            const triggers = fireMinionPlayedTriggers(...); // ✅ 正确位置
            derivedEvents.push(...triggers.events);
        }
    }
    return [...events, ...derivedEvents];
}
```

#### 历史教训

**SmashUp 睡眠孢子 bug**（2025-02）：`PLAY_MINION` 命令在 `execute` 中调用了 `fireMinionPlayedTriggers`，而 `postProcessSystemEvents` 又调用一次，导致所有随从入场触发效果（包括力量修正）被执行两次。修复方法：删除 `execute` 中的重复调用。

#### 静态检查（推荐）

**ESLint 规则**（已配置但需手动验证）：

```javascript
// eslint.config.js
{
  files: ['**/games/*/domain/execute.ts', '**/games/*/domain/reducer.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: ['*abilityHelpers'],
    }],
  },
}
```

**代码审查检查清单**：

在审查 `execute.ts` / `reducer.ts` 时，必须检查：
- [ ] 没有 `import` 语句引用 `abilityHelpers`
- [ ] 没有调用 `fireMinionPlayedTriggers` / `fireUnitPlayedTriggers` / `triggerOnPlay`
- [ ] 命令处理只生成基础事件，不调用触发链
- [ ] 所有触发链逻辑在 `postProcessSystemEvents` 中处理
```

---

## 引擎层系统与原语清单

### `engine/systems/`
Flow / Interaction / Undo / Log / EventStream / ResponseWindow / Tutorial / Rematch / Cheat / ActionLog

### `engine/primitives/` — 纯函数/注册器

| 模块 | 职责 | 核心 API |
|------|------|---------|
| `ability.ts` | 能力定义+执行器注册表 | `createAbilityRegistry()` / `createAbilityExecutorRegistry()` / `checkAbilityCost` / `filterByTags` / `checkAbilityCondition` / `abilityText(id,field)` / `abilityEffectText(id,field)` |
| `abilityConstraints.ts` | 通用能力约束系统（行动消耗/实体状态/资源/使用次数） | `checkAbilityConstraints` / `createConstraintHandlerRegistry` / `registerConstraintHandler` |
| `tags.ts` | 层级 Tag 系统（层数/持续时间/前缀匹配） | `createTagContainer` / `addTag` / `removeTag` / `hasTag` / `matchTags` / `tickDurations` / `getRemovable` |
| `modifier.ts` | 数值修改器栈（flat/percent/override/compute） | `createModifierStack` / `addModifier` / `applyModifiers` / `computeModifiedValue` / `tickModifiers` |
| `damageCalculation.ts` | 伤害计算管线（基于 modifier.ts，自动收集修正+生成 breakdown） | `createDamageCalculation` / `createBatchDamageCalculation` / `DamageCalculation.resolve()` / `DamageCalculation.toEvents()` |
| `attribute.ts` | base + ModifierStack → current（min/max 钳制） | `createAttributeSet` / `getBase` / `setBase` / `getCurrent` / `addAttributeModifier` / `tickAttributeModifiers` |
| `uiHints.ts` | 可交互实体查询接口 | `UIHint` / `UIHintProvider<TCore>` / `filterUIHints` / `groupUIHintsByType` / `extractPositions` |
| `visual.ts` | 基于 atlasId 的视觉资源解析器 | `VisualResolver` |
| `spriteAtlas.ts` | 精灵图集注册/裁切/查询（网格或精确 frame） | `SpriteAtlasRegistry` / `globalSpriteAtlasRegistry` / `computeSpriteStyle` / `computeSpriteAspectRatio` / `generateUniformAtlasConfig` / `isSpriteAtlasConfig` |
| `actionRegistry.ts` | actionId → handler 注册表 | `ActionHandlerRegistry` |
| `actionLogHelpers.ts` | ActionLog 通用伤害来源格式化（跨游戏复用） | `buildDamageBreakdownSegment` / `buildDamageSourceAnnotation` / `DamageSourceResolver` |
| `condition.ts` / `effects.ts` / `dice.ts` / `resources.ts` / `target.ts` / `zones.ts` / `expression.ts` | 其他引擎原语 | — |

### `engine/fx/` — FxSystem

Cue 注册表 + 事件总线 + 渲染层 + WebGL Shader 子系统 + FeedbackPack。游戏侧通过 `fxSetup.ts` 注册渲染器并声明反馈包（音效+震动）。`useFxBus` 接受 `{ playSound, triggerShake }` 注入反馈能力，push 时自动触发 `timing='immediate'` 反馈，渲染器 `onImpact()` 触发 `timing='on-impact'` 反馈。Shader 管线（`src/engine/fx/shader/`）提供 `ShaderCanvas` + `ShaderMaterial` + `ShaderPrecompile` + GLSL 噪声库。

所有三个游戏（SummonerWars / DiceThrone / SmashUp）均已接入 FX 系统。SmashUp 使用 screen 空间定位（无棋盘格），通过 `event.params` 传入 DOM 位置信息。

#### 序列特效（`pushSequence`）

`FxBus.pushSequence(steps)` 支持有序特效编排——每个步骤等上一个渲染器 `onComplete` 后再播放下一个。适用于多步骤技能效果（如"移除 token → 造成伤害"）。

```ts
fxBus.pushSequence([
  { cue: DT_FX.TOKEN, ctx: {}, params: { /* token 移除动画 */ }, delayAfter: 200 },
  { cue: DT_FX.DAMAGE, ctx: {}, params: { /* 伤害飞行数字 */ } },
]);
```

- `delayAfter`（ms）：该步骤完成后、下一步开始前的等待时间，默认 0（立即衔接）
- 序列中某步 cue 未注册会自动跳过继续下一步
- 安全超时触发也会推进序列，避免卡死
- `cancelSequence(seqId)` 可取消正在进行的序列
- 渲染器完全不感知自己是否在序列中，无需任何适配

---

## 精灵图集系统（`engine/primitives/spriteAtlas.ts`）（强制）

### 架构

引擎层提供统一的精灵图集原语，类似 Unity SpriteAtlas / Phaser TextureAtlas：

- **`SpriteAtlasConfig`** — 图集裁切配置：要么是网格配置（`imageW/imageH/cols/rows/colStarts/colWidths/rowStarts/rowHeights`），要么是精确 frame 配置（`imageW/imageH/frames[]`）
- **`SpriteAtlasRegistry`** — 注册表（`register` / `getSource` / `resolve`）
- **`globalSpriteAtlasRegistry`** — 全局单例，游戏层注册，UI 层查询
- **纯函数** — `computeSpriteStyle(index, config)` / `computeSpriteAspectRatio(index, config)` / `generateUniformAtlasConfig` / `isSpriteAtlasConfig`

### 两个注册表的区别（强制理解）

| 注册表 | 位置 | `image` 字段含义 | 消费方 |
|--------|------|-----------------|--------|
| `globalSpriteAtlasRegistry` | 引擎层 | **运行时 webp URL**（可直接用于 `backgroundImage`） | `CardSprite` 等游戏内组件 |
| `CardPreview.cardAtlasRegistry` | 框架层 | **base path**（不带扩展名，由 `buildLocalizedImageSet` 构建实际 URL） | `CardPreview` 组件（教学/选牌预览） |

**禁止合并这两个注册表**。它们的 `image` 字段语义不同，合并会导致后注册的覆盖前者，造成图片不显示。

### 使用规范

1. **裁切算法禁止在游戏层重复实现**：所有 `backgroundSize/backgroundPosition` 计算必须调用 `computeSpriteStyle`，禁止手写百分比计算。
2. **类型守卫统一使用 `isSpriteAtlasConfig`**：禁止在游戏层重复定义 `isCardAtlasConfig` / `isNumberArray`。
3. **卡牌→精灵图配置的解析必须收敛到单一函数**：每个游戏只允许有一个 `getCardSpriteConfig(card)` 函数（通常在 `spriteHelpers.ts`），所有消费点（手牌、棋盘、预览、弃牌堆、牌组构建器）统一调用，禁止各自写 `if (spriteAtlas === 'portal')` 分支。
4. **新增图集类型时**：只需在 `getCardSpriteConfig` 中添加一个分支，不需要修改任何消费点。

### 反模式

- ❌ 在 UI 组件中直接写 `if (spriteAtlas === 'xxx') return { atlasId: 'yyy', ... }` — 每个消费点都写一遍，漏一个就出 bug
- ❌ 在游戏层定义 `SpriteAtlasConfig` 类型或裁切算法 — 引擎层已提供
- ❌ 把 `registerSpriteAtlas`（webp URL）和 `registerCardAtlasSource`（base path）写入同一个 Map
- ✅ 统一在 `spriteHelpers.ts` 的 `getCardSpriteConfig(card)` 中处理所有图集类型分支
- ✅ 裁切算法调用 `computeSpriteStyle` / `computeSpriteAspectRatio`

---

## 新引擎系统注意事项（强制）

- **数据驱动优先**：规则/配置/清单做成可枚举数据，引擎解析执行，避免分支硬编码。
- **同一领域动作必须只有一个执行真相**：多个命令、卡牌、Token 或 UI 入口可以各自负责时机、权限、目标和费用校验，但一旦确认执行的是同一个领域动作，必须归一到同一个领域执行器/结果构造器。禁止每个入口分别生成随机结果、基础事件、状态回写或同一派生事件。
- **入口分流不等于执行分流**：只有当生命周期、状态账本或结算事件确实不同，才保留不同的外层命令/事件；外层差异必须明确说明它保留了什么专属状态，公共动作仍要复用。新增入口前先搜索已有执行器，不能以“命令名不同”作为复制领域逻辑的理由。
- **领域 ID 常量表**：所有稳定 ID 在 `domain/ids.ts` 用 `as const` 定义，导出派生类型（`StatusId`/`TokenId`）。例外：i18n key、类型定义中的字面量。
- **新机制先检查引擎**：实现前必须先搜索 `engine/primitives/` 和 `engine/systems/`，无则先在引擎层抽象。
- **新游戏能力系统必须使用 `ability.ts`**：禁止自行实现注册表。每游戏独立实例，通过 label 区分。
- **当前决策者统一从 `src/engine/sessionContext.ts` 读取**：禁止在共享层继续扩散 `currentPlayer/currentPlayerId/currentPlayerIndex` 这种每游戏一套的弱约定。
- **对象生命周期要先建模 provenance**：凡涉及跨区、附着/脱离、临时控制、借用、代持、默认终点，不得只靠 `owner/originalOwner/fromPlayerId/toPlayerId` 散字段拼协议。
- **延迟交互要先建模 snapshot**：凡交互会跨阶段、跨清场、跨宿主变化继续结算，必须显式区分创建时 snapshot 与 resolve 时 live lookup。
- **交互展示模式独立描述**：禁止让 UI 仅凭 `defId/baseDefId/targetType` 等 payload 形状反推按钮/卡牌/棋盘展示模式。

---

## 游戏结束检测入口（`sys.gameover`）（强制）

> `sys.gameover` 架构、读取方式、服务端处理、游戏层实现与禁止事项，已拆到 `.spec/knowledge/standards/engine-gameover.md`。
>
> 修改胜负判定、gameover 读写、Board 结束态或服务端结束处理时，先读该文档。

## 通用能力框架入口（强制）

> 完整规范已拆到 `.spec/knowledge/standards/engine-ability-framework.md`。本节只保留入口，避免引擎总览继续承载能力系统百科。

- 新游戏必须使用 `engine/primitives/ability.ts` 的 `AbilityRegistry` / `AbilityExecutorRegistry`，禁止自行实现注册表或全局单例。
- 新游戏必须使用 `constraints` 字段声明通用约束；完整 API、示例、历史债务和 SummonerWars beforeAttack 交互模式见 `engine-ability-framework.md`。

---

## `createSimpleChoice` API 使用规范入口（强制）

> `createSimpleChoice` 函数签名、调用约定、`SimpleChoiceConfig`、`PromptOption.displayMode` 和反模式，已拆到 `.spec/knowledge/standards/engine-simple-choice.md`。
>
> 修改 SimpleChoice、prompt option、选择 UI、displayMode 或交互候选时，先读该文档。

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

## 框架解耦要求（强制）

- 禁止框架层 import 游戏层；游戏特化下沉到 `games/<gameId>/`
- 框架提供通用接口+注册表，游戏层显式注册扩展
- 新系统在 `engine/systems/` 实现并在 `index.ts` 导出；需默认启用则加入 `createBaseSystems()`
- 系统状态写入 `SystemState`，由 `setup()` 初始化，禁止塞进 `core`
- 系统命令由 adapter 自动合并，游戏层只列业务命令
- Move payload 必须包装为对象，禁止裸值；系统命令用 `UNDO_COMMANDS.*` 等常量
- 需要 `reset()` 的系统必须保证重开后回到初始值
- **`_noSnapshot` 跳过快照（通用机制）**：当命令是前一个操作的后续动作（如 afterMove 技能），UI 层 dispatch 时在 payload 加 `_noSnapshot: true`，UndoSystem 跳过该命令的快照创建，撤回时与前一个命令原子回退。适用于任何游戏的"操作 A 触发操作 B"场景。

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
- `useVisualStateBuffer` — 视觉状态缓冲/双缓冲（`freeze`/`freezeBatch`/`release`/`clear`/`get`/`snapshot`/`isBuffering`）
- `useIsInteractionBusy` — 判断当前是否有活跃引擎交互（`sys.interaction.current` 属于当前玩家），用于阻止手牌打出/格子点击等操作。**面向100个游戏的标准用法**：所有"等待玩家输入"的状态必须走 `sys.interaction`，游戏层通过此 Hook 统一判断忙碌状态，禁止自建 UI 状态机。历史债务（如 summonerwars 的 `abilityMode`）在迁移完成前需在 Board 层 `||` 合并。

**系统层设计原则**：接口+通用骨架在系统层，游戏特化下沉；每游戏独立实例禁止全局单例；UGC 通过 AI 生成符合接口的代码动态注册。

---

## 动画、EventStream 与卡牌特写入口（强制）

> 动画表现与逻辑分离、EventStream 首次挂载规则、乐观引擎兼容、卡牌特写队列接入与失败口径，已拆到 `.spec/knowledge/standards/engine-visual-events.md`。
>
> 修改 HP/damage 动画、EventStream、卡牌特写队列、`useVisualStateBuffer`、`FxLayer.onEffectImpact` 或 spotlight 行为时，先读该文档。

## ActionLogSystem 使用规范入口（强制）

> ActionLogSystem 基本约束、伤害来源标注、`DamageSourceResolver`、breakdown 构建工具、音效与动画分流，已拆到 `.spec/knowledge/standards/engine-action-log.md`。
>
> 新增/修改 ActionLog、伤害来源标注、breakdown hover、feedbackResolver 或声音/动画分流时，先读该文档。

## ABILITY_TRIGGERED 事件规范（强制）

必须用 `createAbilityTriggeredEvent()` 创建，payload 类型 `AbilityTriggeredPayload`，`sourcePosition` 必填。禁止手写 `{ type: SW_EVENTS.ABILITY_TRIGGERED, payload: {...} }`。回归守卫：`phase-ability-integration.test.ts`。

---

## afterEventsRound 限制（强制）

`FlowSystem.afterEvents` 在 `afterEventsRound > 0` 时传空 events 给 `onAutoContinueCheck`，基于事件的自动推进链单次 `executePipeline` 最多跨一个阶段。测试中 `createInitializedState` 返回 upkeep（非 main1），仍需手动 `cmd('ADVANCE_PHASE')` 推进。详见 `docs/games/dicethrone/refactor/dicethrone-auto-advance-upkeep-income.md`。

---

## flowHalted 状态追踪（强制）

`FlowSystem` 在 `onPhaseExit` 返回 `halt: true` 时，自动在 `sys.flowHalted` 中设置 `true`；阶段成功推进后设置 `false`。

- **用途**：`onAutoContinueCheck` 中，战斗阶段（如 `offensiveRoll`/`defensiveRoll`）只在 `state.sys.flowHalted === true` 时才尝试自动推进。这样可以精确区分"onPhaseExit halt 后的阻塞清除"和"卡牌效果中的阻塞清除"。
- **禁止**：在业务数据（如 `PendingBonusDiceSettlement`）中打 `phaseExitHalt` 标记来区分来源。流程控制信息应由引擎层追踪，不应污染业务数据。
- **所有游戏受益**：新游戏的 `onAutoContinueCheck` 可直接读取 `state.sys.flowHalted` 判断是否处于 halt 恢复状态。

---

## onPhaseEnter 返回 PhaseEnterResult（强制）

`FlowHooks.onPhaseEnter` 支持三种返回值：`GameEvent[]`（纯事件）、`PhaseEnterResult`（事件 + updatedState）、`void`。

- **何时使用 `PhaseEnterResult`**：当 `onPhaseEnter` 中触发的能力（基地能力、ongoing 效果等）创建了 Interaction 或修改了 `sys` 状态时，必须通过 `{ events, updatedState }` 返回更新后的 `matchState`，由引擎层合并到最终状态。
- **禁止变异 `state.sys`**：`onPhaseEnter` 接收的 `state` 参数是引擎层创建的新对象，直接变异 `state.sys` 虽然在当前实现中碰巧能传播，但属于未定义行为，未来引擎重构可能导致静默丢失。
- **与 `PhaseExitResult` 的区别**：`PhaseEnterResult` 没有 `halt`（阶段已切换）和 `overrideNextPhase`（不适用），只有 `events` 和 `updatedState`。
- **引擎层处理**：`executePhaseAdvance` 检测到 `updatedState` 后，将其 `sys` 合并到 `nextState`（保留 `phase` 和 `flowHalted`），确保 Interaction 等 sys 变更不丢失。

---

## 阶段推进权限的 UI 消费（强制）

- 领域层 `rules.ts` 定义 `canAdvancePhase(core, phase)` 做规则校验
- FlowSystem 通过 `flowHooks.canAdvance` 调用，作为服务端兜底
- UI 层禁止重复实现领域校验，应复用领域层函数
- 正确模式：游戏状态 Hook 中计算 `canAdvancePhase`（领域校验 + `!hasPendingInteraction`），Board 叠加 `isFocusPlayer`
- **参考**：`dicethrone/hooks/useDiceThroneState.ts`

---

## 重赛系统

- **多人**：socket.io 房间层投票（`RematchContext` + `matchSocket.ts`），独立于游戏命令管线
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

## 描述→实现全链路审查规范

> **已迁移至 `.spec/knowledge/standards/description-to-implementation-audit.md`，该文档为唯一权威来源。**
> 当任务是新增或主动审查游戏机制实现时，先阅读 `.spec/knowledge/standards/description-to-implementation-audit.md`，按权威描述、原子断言和交互链矩阵执行；玩家反馈的规则 bug 优先走规则 bug 修复 workflow。


---

## 领域建模前置审查（强制）

> 阶段 2 完成后、阶段 3 开始前执行。禁止跳过领域建模直接写实现。

核心原则：**规则文本 → 领域模型 → 实现**，禁止从规则文本直接跳到实现。

### 1. 领域概念建模

从规则文档提取所有领域概念（术语/状态/角色/阶段），为每个概念建立：
- **定义**：该概念的精确语义边界（如"影响"= 移动 | 消灭 | 改力量 | 附着 | 控制权变更 | 取消能力）
- **映射**：概念→具体事件类型/状态字段的对应关系

产出：术语→事件映射表，录入 `rule/` 或 `domain/types.ts` 注释。

**反模式**：规则说"被影响时触发"，实现时直接绑定 `onDestroyed` + `onMoved` 两个具体事件，遗漏了"影响"概念下的其他 4 种事件。正确做法：先定义"影响"包含哪些事件，再设计一个聚合抽象（如 `onAffected`）覆盖全部。

### 2. 决策点识别

规则中所有需要玩家做选择的点必须在建模阶段标记，不得在实现时跳过或自动化：
- **强制决策**："选择一个目标"/"指定"→ 必须有交互
- **可选决策**："你可以"/"may"→ 必须有确认/跳过 UI
- **无决策**：自动结算，无需交互

对每个决策点评估当前引擎是否支持该交互模式。不支持则提前规划扩展或标注 TODO。

**反模式**：规则说"你可以将它移动到这里"，实现时自动移动跳过玩家选择，因为引擎层拦截器不支持异步交互。正确做法：建模时识别出该决策点，提前评估引擎能力。

### 3. 引擎能力缺口分析

将建模产出（概念/决策点/交互模式）与引擎层能力逐一比对，列出缺口和扩展计划。

### 门禁检查清单

- [ ] 所有领域概念已定义精确语义边界和事件映射
- [ ] 所有玩家决策点已标记（强制/可选/无）
- [ ] 引擎能力缺口已识别并有计划


---

## 伤害计算管线入口（强制）

> 完整规范已拆到 `.spec/knowledge/standards/engine-damage-pipeline.md`；迁移步骤另见 `docs/damage-calculation-pipeline-migration-guide.md`。

- 新游戏必须使用 `engine/primitives/damageCalculation.ts`，禁止手动构建 `DAMAGE_DEALT` 事件。
- 需要配置 `autoCollectTokens`、`autoCollectStatus`、`autoCollectShields`、手动修正或 ActionLog breakdown 时，直接读 `engine-damage-pipeline.md`。

## DiceThrone Token ActiveUse Custom Action 入口

> DiceThrone 专项规则已下沉到 `docs/games/dicethrone/token-active-use-custom-action.md`。

当 `TokenDef.activeUse` 的真实效果依赖 custom action，而不是 `effect.value` 本身时，必须显式声明 `activeUse.customActionId`。

## SmashUp 消灭触发链与 pendingSave 入口

> SmashUp 专项规则已下沉到 `docs/games/smashup/destroy-pending-save.md`。

修改 `processDestroyTriggers`、`postProcessSystemEvents` 或相关 trigger 逻辑时，必须先读 SmashUp 专项文档；不要把 SmashUp 当前 runtime 的白名单合同提升成跨游戏通用规则。

### SmashUp 当前 runtime 例外

SmashUp 当前消灭触发 runtime 仍依赖 `PREVENT_DESTROY_SOURCE_IDS` 白名单识别交互式 replacement，避免把普通死亡效果交互误判成 pendingSave。新增或删除相关入口时，必须同步 `src/games/smashup/domain/reducer.ts`、`src/games/smashup/rule/ENGINE_GUIDE.md`、`docs/games/smashup/destroy-pending-save.md` 与对应契约测试。

当前白名单合同至少包含：

- `base_nine_lives_intercept`
- `giant_ant_drone_prevent_destroy`
- `pirate_buccaneer_move`
