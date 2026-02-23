# 引擎与框架系统完整规范

> 本文档是 `AGENTS.md` 的补充详细规范。**触发条件**：开发/修改引擎系统、框架层代码、游戏 move/command 时阅读。
> AGENTS.md 中已有的规则摘要此处不再重复，本文档只提供详细说明、API 清单和代码模板。
> **测试与审计规范**见 `docs/ai-rules/testing-audit.md`。

---

## 引擎层概述

- **Domain Core**：Command/Event + Reducer，确定性可回放。
- **Systems**：Undo/Interaction/Log 等跨游戏能力以 hook 管线参与执行。
- **Adapter**（`createGameEngine`）：将 Domain Core + Systems 组装成 `GameEngineConfig`，供 `GameTransportServer` 使用。自动合并系统命令到 commandTypes。
- **Transport**：自研传输层（`GameTransportServer` + `GameTransportClient`）。
- **统一状态**：`G.sys`（系统状态） + `G.core`（领域状态）。`G.sys.gameover` 为游戏结束的唯一检测来源。

### 传输层架构（强制理解）

项目使用自研传输层：

| 组件 | 路径 | 职责 |
|------|------|------|
| `GameTransportServer` | `src/engine/transport/server.ts` | 服务端：管理对局生命周期、执行管线、playerView 过滤 + 传输裁剪（`stripStateForTransport`）、广播状态、持久化 |
| `GameTransportClient` | `src/engine/transport/client.ts` | 客户端：socket.io 连接（MsgPack 序列化）、命令发送、状态同步 |
| `GameProvider` / `LocalGameProvider` | `src/engine/transport/react.tsx` | React 集成：在线 Provider + 教程用 LocalProvider + BoardBridge |
| `GameBoardProps` | `src/engine/transport/protocol.ts` | Board 组件 Props 契约 |
| `createGameEngine` | `src/engine/adapter.ts` | 适配器工厂：Domain + Systems → GameEngineConfig |
| `OptimisticEngine` | `src/engine/transport/latency/optimisticEngine.ts` | 客户端乐观更新引擎：本地预测 + 服务端调和 |
| `CommandBatcher` | `src/engine/transport/latency/commandBatcher.ts` | 命令批处理（合并高频命令减少网络往返） |
| `LatencyOptimizationConfig` | `src/engine/transport/latency/types.ts` | 延迟优化配置类型（每个游戏的 `latencyConfig.ts`） |

#### 乐观更新引擎（Optimistic Engine）

客户端延迟优化子系统，通过本地预测 + 服务端调和实现低延迟交互体验。

核心流程：
1. 玩家操作 → `processCommand()` 本地执行 `executePipeline` 预测状态 → 立即更新 UI
2. 命令同时发送到服务端 → 服务端执行并广播确认状态
3. `reconcile()` 对比确认状态与预测状态 → 一致则保持，不一致则回滚

关键机制：
- **Random Probe 自动检测**：包装 `RandomFn` 追踪 pipeline 执行期间是否调用了随机数。调用了 → 丢弃乐观结果（等服务端确认）；未调用 → 保留乐观结果。游戏层无需手动声明 `commandDeterminism`（可选覆盖）。
- **`commandDeterminism` 显式声明陷阱（强制理解）**：显式声明 `'deterministic'` 会**跳过 Random Probe**，比不声明更危险。若命令实际调用了 `random`（如掷骰子），乐观预测结果与服务端不一致，导致 `sys.gameover` 等关键状态不同步。**开发环境会自动检测此错误**（`console.error` 报警）。规则：
  - ✅ 不声明 → Random Probe 自动检测（推荐，最安全）
  - ✅ 声明 `'non-deterministic'` → 跳过预测，等服务端确认（随机命令的正确做法）
  - ⚠️ 声明 `'deterministic'` → 跳过 probe，**必须确保命令真的不调用 `random`**，否则产生静默 bug
  - **教训**：SummonerWars `DECLARE_ATTACK` 被错误声明为 `'deterministic'`（注释写"不含掷骰"），实际 execute 里就是掷骰子的地方，导致打死召唤师后胜利画面延迟到下一回合才出现。
- **AnimationMode**：按命令粒度控制 `'optimistic'`（保留 EventStream 立即触发动画）或 `'wait-confirm'`（剥离 EventStream 等确认后触发）。默认 `'wait-confirm'`。
- **骰子动画最短播放时间**：乐观预测会瞬间产生新状态（如 `rollCount` 变化），但骰子翻滚动画需要时间。**不在框架层延迟 `setState`**（会阻塞 EventStream 事件传递，破坏伤害/治疗等动画），而是在 UI 层（如 `DiceActions`）用 `MIN_ROLL_ANIMATION_MS` + `rollStartTimeRef` 保护最短播放时间。这是纯 UI 层关注点，不属于框架层职责。
- **EventStream 水位线**（`optimisticEventWatermark`）：记录已通过乐观动画播放的最大事件 ID，回滚时过滤已播放事件防止动画重复。
- **Pending 命令队列 + Replay**：服务端确认后基于新状态重放剩余 pending 命令，而非直接覆盖。`snapshotPhase` 校验防止已执行命令被重复 replay。

游戏层接入：在 `src/games/<gameId>/latencyConfig.ts` 导出 `LatencyOptimizationConfig`。大多数情况下只需空配置（Random Probe 自动处理），仅在需要强制声明确定性或自定义动画模式时才配置。

#### 传输优化

**序列化**：所有 socket.io 连接（游戏/大厅/社交）统一使用 `socket.io-msgpack-parser`（MsgPack 二进制序列化），比 JSON 减少 ~28% 体积。

**传输裁剪**（`stripStateForTransport`）：服务端在 `playerView` 过滤之后、`socket.emit` 之前，统一裁剪客户端不需要的大体积 sys 数据：

| 裁剪项 | 裁剪方式 | 客户端保留 | 原因 |
|--------|---------|-----------|------|
| `sys.undo.snapshots` | 清空数组 | `snapshotCount`（快照数量） | 快照含完整 MatchState 深拷贝，泄漏隐私（对手手牌/牌库） |
| `sys.eventStream.entries` | 清空数组 | `nextId`（cursor 水位线） | 客户端通过 cursor 实时消费，重连/广播时不需要历史 |
| `sys.tutorial.steps` | 清空数组 | `totalSteps`（步骤总数） | 客户端只用 `step`（当前步骤）和 `stepIndex` |

> ⚠️ 裁剪只动 `sys` 层，不碰 `core`（游戏领域状态）。卡牌预览（`previewRef`）、弃牌堆等展示数据不受影响。对手手牌隐藏是 `playerView` 的职责，不是传输裁剪。

#### GameBoardProps 契约（强制）

```typescript
interface GameBoardProps<TCore, TCommandMap> {
    G: MatchState<TCore>;           // 完整状态（core + sys）
    dispatch: (type, payload) => void; // 类型安全命令分发
    moves: Record<string, Function>;   // 兼容层（过渡期保留）
    playerID: string | null;
    matchData?: MatchPlayerInfo[];
    isMultiplayer?: boolean;
    isConnected?: boolean;
    locale?: string;
    reset?: () => void;
}
```

- **不再有 `ctx` prop**：`ctx`（含 `ctx.currentPlayer`、`ctx.gameover`、`ctx.phase` 等）已不存在。
- **当前玩家**：从 `G.core` 中读取（各游戏自定义字段，如 `G.core.currentPlayer`），`playerID` prop 为当前客户端的玩家 ID。
- **游戏结束**：使用 `G.sys.gameover`（见下方「游戏结束检测」节）。
- **阶段**：使用 `G.sys.phase`。
- **新代码应使用 `dispatch`**，`moves` 为过渡期兼容层。

---

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
| `spriteAtlas.ts` | 精灵图集注册/裁切/查询（网格式） | `SpriteAtlasRegistry` / `globalSpriteAtlasRegistry` / `computeSpriteStyle` / `computeSpriteAspectRatio` / `generateUniformAtlasConfig` / `isSpriteAtlasConfig` |
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

- **`SpriteAtlasConfig`** — 网格裁切配置（imageW/imageH/cols/rows/colStarts/colWidths/rowStarts/rowHeights）
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
- **领域 ID 常量表**：所有稳定 ID 在 `domain/ids.ts` 用 `as const` 定义，导出派生类型（`StatusId`/`TokenId`）。例外：i18n key、类型定义中的字面量。
- **新机制先检查引擎**：实现前必须先搜索 `engine/primitives/` 和 `engine/systems/`，无则先在引擎层抽象。
- **新游戏能力系统必须使用 `ability.ts`**：禁止自行实现注册表。每游戏独立实例，通过 label 区分。

---

## 游戏结束检测（`sys.gameover`）（强制）

### 架构

管线（`executePipeline`）在每次命令执行成功后自动调用 `domain.isGameOver(core)` 检测游戏是否结束，结果写入 `sys.gameover`：

```typescript
// pipeline.ts 内部辅助函数（两个成功返回点都会调用）
const applyGameoverCheck = (s: MatchState<TCore>): MatchState<TCore> => {
    if (!domain.isGameOver) return s;
    const result = domain.isGameOver(s.core);
    if (result === s.sys.gameover) return s;
    return { ...s, sys: { ...s.sys, gameover: result } };
};
```

### GameOverResult 类型

```typescript
interface GameOverResult {
    winner?: PlayerId;
    winners?: PlayerId[];
    draw?: boolean;
    scores?: Record<PlayerId, number>;
}
```

### 各层读取方式（强制）

| 层级 | 正确读取方式 | 禁止 |
|------|-------------|------|
| Board 组件 | `G.sys.gameover` | ❌ `G.core.gameover`、❌ `ctx.gameover` |
| 服务端 | `result.state.sys.gameover` | ❌ 再次调用 `isGameOver()` |
| 测试 | `state.sys.gameover` | ❌ `state.core.gameover` |
| 交互裁决 | `state.sys.gameover` | ❌ `core.gameover` |

### 服务端处理

`GameTransportServer.executeCommandInternal` 在管线执行成功后读取 `result.state.sys.gameover`，若检测到游戏结束且 metadata 尚未标记，则：
1. 更新 `match.metadata.gameover`
2. 持久化 metadata
3. 触发 `onGameOver` 回调（用于归档战绩等）

### 游戏层实现

每个游戏在 `DomainCore.isGameOver` 中实现检测逻辑，返回 `GameOverResult | undefined`：

```typescript
// 示例：DiceThrone — HP 归零判定
isGameOver: (core) => {
    const loser = Object.values(core.players).find(p => p.hp <= 0);
    if (!loser) return undefined;
    const winner = Object.values(core.players).find(p => p.hp > 0);
    return { winner: winner?.id };
},
```

### 禁止事项

- ❌ 禁止在 Board 组件中读取 `G.core.gameover` 或 `ctx.gameover`（前者不存在于 core，后者已移除）
- ❌ 禁止在服务端重复调用 `isGameOver()` 检测——管线已自动完成
- ❌ 禁止在 core 状态中存储名为 `gameover` 的字段——游戏结束结果由管线自动写入 `sys.gameover`。core 中可以有 `gameResult` 等中间字段供 `isGameOver()` 读取，但 UI/服务端必须统一从 `sys.gameover` 获取最终结果。

---

## 通用能力框架（强制）

### 核心组件（`engine/primitives/ability.ts`）

- **`AbilityDef<TEffect, TTrigger>`** — 泛型能力定义（id/name/trigger/effects/condition/constraints/tags/cost/cooldown/variants/meta）
- **`AbilityRegistry<TDef>`** — 定义注册表（`register/get/getAll/getByTag/getByTrigger/getRegisteredIds`）
- **`AbilityExecutorRegistry<TCtx, TEvent>`** — 执行器注册表，支持 `id+tag` 复合键（`register/resolve/has/getRegisteredIds`）
- **工具函数**：`checkAbilityCost` / `filterByTags` / `checkAbilityCondition`（委托 `primitives/condition`）
- **i18n 辅助**：`abilityText('frost_axe','name')` → `'abilities.frost_axe.name'`；`abilityEffectText('slash','damage')` → `'abilities.slash.effects.damage'`

### 强制要求

1. 禁止自行实现注册表或全局单例
2. `getRegisteredIds()` 用于 `entity-chain-integrity.test.ts` 契约测试
3. 条件评估复用 `primitives/condition`（`AbilityDef.condition` 使用 `ConditionNode`）
4. **新游戏必须使用 `constraints` 字段声明约束**（见下方「通用能力约束系统」节）

### 两种执行模式（可混合）

- **声明式**：`AbilityDef` 数据 → `AbilityRegistry` → `executeEffects()` 执行效果列表（效果结构统一时）
- **命令式**：`AbilityExecutor` 函数 → `AbilityExecutorRegistry` → `resolve(id, tag?)` 调用（逻辑差异大时）

### 现有游戏迁移状态

**能力系统**：SummonerWars 已完成迁移（引擎层 Registry + ExecutorRegistry）。DiceThrone `CombatAbilityManager`、SmashUp `abilityRegistry.ts` 是历史实现（内部合理但未用引擎层），**新游戏禁止模仿**。

**状态/buff 原语（TagContainer / ModifierStack）**：
- **SummonerWars 历史债务**：`BoardUnit` 上 `tempAbilities`/`boosts`/`extraAttacks`/`healingMode`/`wasAttackedThisTurn`/`originalOwner` 为 ad-hoc 字段，未用 TagContainer，回合清理靠手动解构。**新游戏禁止模仿**，必须用 `createTagContainer()` + `tickDurations`。
- DiceThrone 已用引擎层 TagContainer；SmashUp 无 buff 系统。

---

## 被动触发能力（beforeAttack）交互模式（SummonerWars）

> 攻击前自动触发的被动能力（如圣光箭 `holy_arrow`、治疗 `healing`、生命汲取 `life_drain`），使用 `abilityMode` 状态驱动 UI，**不使用弹窗式 `CardSelectorOverlay`**。

### 交互流程

1. 玩家点击攻击目标 → `useCellInteraction` 检测攻击者是否有 `passiveTrigger: 'beforeAttack'` 能力
2. 有被动能力 → 设置 `abilityMode = { step: 'selectCards', context: 'beforeAttack', pendingAttackTarget, ... }`
3. **StatusBanners** 渲染 amber 横幅，显示能力提示文本 + "确认弃牌"按钮 + "跳过"按钮
4. **HandArea** 收到 `abilitySelectingCards=true`，手牌区直接高亮可选，点击手牌切换选中状态（`data-selected="true/false"`）
5. 点击"确认弃牌"（`onConfirmBeforeAttackCards`）→ 发送 `DECLARE_ATTACK` 命令（带 `beforeAttack` payload）
6. 点击"跳过"（`onCancelBeforeAttack`）→ 发送 `DECLARE_ATTACK` 命令（不带 `beforeAttack`）

### UI 选择器（E2E 测试强制）

| 元素 | 正确选择器 | ❌ 错误选择器 |
|------|-----------|-------------|
| 确认弃牌按钮 | `button:has-text("Confirm Discard")` 或 `button:has-text("确认弃牌")` | ❌ `[data-testid="sw-card-selector-overlay"] button` |
| 跳过按钮 | `button:has-text("Skip")` 或 `button:has-text("跳过")` | ❌ overlay 内的跳过按钮 |
| 手牌选择 | `[data-testid="sw-hand-area"] [data-card-type="unit"]` 直接点击 | ❌ `[data-testid="sw-card-selector-overlay"] [data-card-type]` |
| 选中状态验证 | `[data-selected="true"]` | — |

### 关键文件

- `useCellInteraction.ts` — `handleCellClick` 中检测被动能力并设置 `abilityMode`
- `StatusBanners.tsx` — 渲染 `abilityMode.step === 'selectCards'` 时的横幅和按钮
- `HandArea.tsx` — `abilitySelectingCards` prop 控制手牌选择模式（绕过魔力检查）
- `abilities-paladin.ts` — `holy_arrow`/`healing` 的 `passiveTrigger: 'beforeAttack'` 定义

### 教训

此模式从"青色波纹按钮手动触发"重构为"攻击时自动弹出确认横幅"。重构后 E2E 测试未同步更新选择器（仍查找 `sw-card-selector-overlay`），导致测试从未真正执行过弃牌选择流程。**重构 UI 交互模式后，必须同步更新所有 E2E 测试的选择器**。

---

## 通用能力约束系统（强制）

> **新游戏必须使用**。现有游戏（SummonerWars）标记为过时但保持兼容。

### 设计原则

- **数据驱动**：约束声明在 `AbilityDef.constraints` 中，验证逻辑在引擎层统一处理
- **可组合**：多个约束可同时生效（行动消耗 + 实体状态 + 资源 + 使用次数）
- **可扩展**：游戏层可注册自定义约束检查器
- **类型安全**：通过泛型保持上下文类型

### 核心 API（`engine/primitives/abilityConstraints.ts`）

```typescript
// 主检查函数
checkAbilityConstraints(
  constraints: AbilityConstraints | undefined,
  ctx: ConstraintContext,
  registry?: ConstraintHandlerRegistry,
): ConstraintCheckResult

// 自定义约束注册
createConstraintHandlerRegistry(): ConstraintHandlerRegistry
registerConstraintHandler(registry, name, handler): void
```

### 约束类型

| 约束类型 | 用途 | 配置示例 |
|---------|------|---------|
| `actionCost` | 消耗行动次数（移动/攻击） | `{ type: 'move', count: 1 }` |
| `entityState` | 实体状态检查（未移动/未攻击） | `{ notMoved: true, notAttacked: true }` |
| `resource` | 资源数量要求（充能/魔力/生命值） | `{ charge: { min: 1 }, magic: { exact: 3 } }` |
| `usageLimit` | 使用次数限制 | `{ perTurn: 1, perBattle: 3 }` |
| `custom` | 自定义约束处理器 | `[{ handler: 'adjacentAlly', params: {} }]` |

### 使用示例

#### 1. 在 AbilityDef 中声明约束

```typescript
const prepareAbility: AbilityDef = {
  id: 'prepare',
  name: abilityText('prepare', 'name'),
  description: abilityText('prepare', 'description'),
  constraints: {
    actionCost: { type: 'move', count: 1 },  // 消耗一次移动
    entityState: { notMoved: true },          // 要求未移动
    resource: { charge: { min: 0 } },         // 可选：需要充能槽
  },
  effects: [{ type: 'grantCharge', value: 1 }],
};
```

#### 2. 在验证层调用

```typescript
import { checkAbilityConstraints, type ConstraintContext } from '../../../engine/primitives/abilityConstraints';

function validateAbilityActivation(core, playerId, payload) {
  const ability = abilityRegistry.get(payload.abilityId);
  if (!ability) return { valid: false, error: '未知技能' };

  // 构建约束检查上下文
  const ctx: ConstraintContext = {
    actionCounts: { move: core.players[playerId].moveCount, attack: core.players[playerId].attackCount },
    actionLimits: { move: 3, attack: 3 },
    entityState: { hasMoved: sourceUnit.hasMoved, hasAttacked: sourceUnit.hasAttacked },
    resources: { charge: sourceUnit.boosts ?? 0, magic: core.players[playerId].magic },
  };

  // 检查约束
  const result = checkAbilityConstraints(ability.constraints, ctx);
  if (!result.valid) return { valid: false, error: result.error };

  // ... 其他验证逻辑
  return { valid: true };
}
```

#### 3. 自定义约束处理器（可选）

```typescript
import { createConstraintHandlerRegistry, registerConstraintHandler } from '../../../engine/primitives/abilityConstraints';

const constraintRegistry = createConstraintHandlerRegistry();

// 注册自定义约束：要求相邻有友方单位
registerConstraintHandler(constraintRegistry, 'adjacentAlly', (params, ctx) => {
  const adjacentAllies = getAdjacentAllies(ctx.sourcePosition, ctx.core);
  if (adjacentAllies.length === 0) {
    return { valid: false, error: '附近没有友方单位', failedConstraint: 'custom.adjacentAlly' };
  }
  return { valid: true };
});

// 在 AbilityDef 中使用
const ability: AbilityDef = {
  id: 'rally',
  constraints: {
    custom: [{ handler: 'adjacentAlly' }],
  },
  // ...
};

// 验证时传入注册表
checkAbilityConstraints(ability.constraints, ctx, constraintRegistry);
```

### 迁移指南（现有游戏）

**旧代码（SummonerWars 当前模式）**：
```typescript
// abilities-barbaric.ts
export const prepareAbility: AbilityDef = {
  id: 'prepare',
  costsMoveAction: true,  // ad-hoc 字段
  validation: {
    customValidator: (ctx) => {
      if (ctx.sourceUnit.hasMoved) return { valid: false, error: '该单位本回合已移动' };
      if (ctx.core.players[ctx.playerId].moveCount >= 3) return { valid: false, error: '移动次数已用完' };
      return { valid: true };
    },
  },
};

// abilityValidation.ts
if (ability.costsMoveAction && player.moveCount >= MAX_MOVES_PER_TURN) {
  return { valid: false, error: '本回合移动次数已用完' };
}
```

**新代码（推荐模式）**：
```typescript
// abilities-barbaric.ts
export const prepareAbility: AbilityDef = {
  id: 'prepare',
  constraints: {
    actionCost: { type: 'move', count: 1 },
    entityState: { notMoved: true },
  },
};

// abilityValidation.ts
const ctx: ConstraintContext = {
  actionCounts: { move: player.moveCount, attack: player.attackCount },
  actionLimits: { move: MAX_MOVES_PER_TURN, attack: MAX_ATTACKS_PER_TURN },
  entityState: { hasMoved: sourceUnit.hasMoved, hasAttacked: sourceUnit.hasAttacked },
};
const result = checkAbilityConstraints(ability.constraints, ctx);
if (!result.valid) return { valid: false, error: result.error };
```

### 优势

1. **数据驱动**：约束声明在数据中，无需手写验证逻辑
2. **可组合**：多种约束类型可同时生效，自动合并检查
3. **可扩展**：通过 `custom` 约束支持游戏特定规则
4. **类型安全**：`ConstraintContext` 通过泛型保持类型
5. **可测试**：约束检查逻辑独立，易于单元测试
6. **可复用**：所有游戏共享同一套约束系统，避免重复实现

### 禁止事项

- ❌ 禁止在游戏层重新实现约束检查逻辑（如 `costsMoveAction` + 手写验证）
- ❌ 禁止在 `customValidator` 中检查通用约束（行动次数/资源/状态）
- ❌ 禁止用可选参数掩盖约束依赖（如 `state?: TCore`）— 应拆分为两个函数
- ✅ 新游戏必须使用 `constraints` 字段
- ✅ 现有游戏可保持当前模式（已标记为过时），但新增技能推荐迁移

---

## `createSimpleChoice` API 使用规范（强制）

> 所有使用 `createSimpleChoice` 创建交互的代码必须遵守。

### 函数签名

```typescript
function createSimpleChoice<T>(
    id: string,                              // 交互 ID（通常为能力 ID）
    playerId: PlayerId,                      // 做选择的玩家
    title: string,                           // 弹窗标题（i18n key）
    options: PromptOption<T>[],              // 选项列表
    sourceIdOrConfig?: string | SimpleChoiceConfig, // 第 5 参数：sourceId 字符串 或 配置对象
    timeout?: number,                        // 第 6 参数：超时（仅位置参数形式有效）
    multi?: PromptMultiConfig,               // 第 7 参数：多选配置（仅位置参数形式有效）
): InteractionDescriptor<SimpleChoiceData<T>>
```

### 两种调用约定

**约定 A：位置参数形式**（第 5 参数为 `string`）
```typescript
createSimpleChoice(id, playerId, title, options, sourceId, undefined, { min: 0, max: N })
//                                                ^^^^^^^^  ^^^^^^^^^  ^^^^^^^^^^^^^^^^^^
//                                                第5:string 第6:timeout 第7:multi
```

**约定 B：配置对象形式**（第 5 参数为 `SimpleChoiceConfig`）
```typescript
createSimpleChoice(id, playerId, title, options, {
    sourceId: 'ability_id',
    multi: { min: 0, max: N },    // ← multi 必须嵌套在 config 对象内
    autoResolveIfSingle: false,
})
```

### SimpleChoiceConfig 结构

```typescript
interface SimpleChoiceConfig {
    sourceId?: string;
    timeout?: number;
    multi?: PromptMultiConfig;        // { min?: number; max?: number }
    targetType?: 'base' | 'minion' | 'hand' | 'discard_minion' | 'generic';
    autoResolveIfSingle?: boolean;    // 默认 true
    autoCancelOption?: boolean;       // 自动添加取消选项
}
```

### 强制规则

1. **"任意数量"/"any number" → 必须传 `multi: { min: 0, max: N }`**，N 为候选项总数。不传 `multi` 会导致单选模式。
2. **"恰好 N 个" → `multi: { min: N, max: N }`**。
3. **"最多 N 个" → `multi: { min: 0, max: N }` 或 `multi: { min: 1, max: N }`**（视是否可跳过）。
4. **基地/随从/手牌选择必须声明 `targetType`（强制）**：
   - `targetType: 'base'` — 选择基地（如地形改造、麦田怪圈）
   - `targetType: 'minion'` — 选择随从（如至高霸主、收集者）
   - `targetType: 'hand'` — 选择手牌（如幽灵弃牌）
   - `targetType: 'discard_minion'` — 选择弃牌堆随从（如僵尸领主）
   - `targetType: 'generic'` — 通用选择（如选择玩家、选择基地牌库中的卡）
   - **历史债务**：现有 57 个交互依赖自动检测（兼容模式），可以保持现状，修改时顺带添加 `targetType`。
5. **卡牌选项必须声明 `displayMode: 'card'`（强制）**。`PromptOption` 新增 `displayMode?: 'card' | 'button'` 字段，用于显式声明 UI 渲染模式。使用 `buildMinionTargetOptions()` 构建的选项已自动设置。手动构建卡牌选项时必须显式添加 `displayMode: 'card'`。UI 层对未设置 `displayMode` 的选项 fallback 到 `extractDefId` 猜测（向后兼容，但新代码禁止依赖此 fallback）。
6. **选项代表卡牌时，`option.value` 必须包含 `defId` 字段**。UI 层从 `defId` 查找卡牌预览图。缺少 `defId` → 即使 `displayMode: 'card'` 也无法展示预览图。
7. **配置对象形式中 `multi` 必须嵌套**：`{ sourceId, multi: { min, max } }` ✅，`{ sourceId, min, max }` ❌（`min`/`max` 作为顶层字段会被忽略）。

### PromptOption.displayMode（渲染模式声明）

```typescript
interface PromptOption<T = unknown> {
    id: string;
    label: string;
    value: T;
    disabled?: boolean;
    /** 'card' = 卡牌预览模式，'button' | undefined = 按钮模式 */
    displayMode?: 'card' | 'button';
}
```

- **设计原则**：渲染模式由选项创建者显式声明，而非 UI 层从 `value` 字段名猜测。`defId` 是业务数据，不是 UI 渲染声明。
- **`buildMinionTargetOptions()`** 已自动设置 `displayMode: 'card'`。
- **手动构建卡牌选项**时必须显式添加：`{ id, label, value: { cardUid, defId }, displayMode: 'card' }`。
- **非卡牌选项**（跳过/完成/基地选择等）不需要设置 `displayMode`，默认为按钮。
- **向后兼容**：UI 层 `isCardOption()` 优先读 `displayMode`，未设置时 fallback 到 `extractDefId()` + `previewRef` 检查。新代码禁止依赖此 fallback。

### 反模式

```typescript
// ❌ multi 传到 timeout 位置（第 6 参数）
createSimpleChoice(id, pid, title, opts, sourceId, { min: 0, max: 3 })

// ❌ config 对象中 min/max 平铺（不在 multi 子对象内）
createSimpleChoice(id, pid, title, opts, { sourceId: 'xxx', min: 0, max: 3 })

// ❌ 描述说"任意数量"但不传 multi
createSimpleChoice(id, pid, title, opts, sourceId)  // → 单选模式

// ❌ 基地/随从选择未声明 targetType（依赖自动检测，新代码禁止）
createSimpleChoice(id, pid, '选择一个基地', baseOptions, 'ability_id')

// ❌ 选项代表卡牌但 value 缺少 defId（无法展示预览图）
options.map(c => ({ id: c.instanceId, label: c.name, value: { instanceId: c.instanceId } }))

// ❌ 卡牌选项未声明 displayMode（依赖 UI 层猜测，新代码禁止）
options.map(c => ({ id: c.uid, label: c.name, value: { cardUid: c.uid, defId: c.defId } }))

// ✅ 位置参数形式 + multi
createSimpleChoice(id, pid, title, opts, sourceId, undefined, { min: 0, max: opts.length })

// ✅ 配置对象形式 + multi 嵌套
createSimpleChoice(id, pid, title, opts, { sourceId: 'xxx', multi: { min: 0, max: opts.length } })

// ✅ 基地选择：显式声明 targetType
createSimpleChoice(id, pid, '选择一个基地', baseOptions, { sourceId: 'ability_id', targetType: 'base' })

// ✅ 随从选择：显式声明 targetType
createSimpleChoice(id, pid, '选择一个随从', minionOptions, { sourceId: 'ability_id', targetType: 'minion' })

// ✅ 卡牌选项：displayMode + defId
options.map(c => ({ id: c.uid, label: c.name, value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const }))
```

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

## 动画表现与逻辑分离规范（强制）

> 引擎架构核心原则：**逻辑层同步完成状态计算，表现层按动画节奏异步展示**。两层通过框架 Hook 解耦，游戏层无需关心时序管理。
> 视觉特效的技术选型、粒子引擎、FX 系统等详见 `docs/ai-rules/animation-effects.md`。本节只覆盖引擎层的表现-逻辑分离基础设施。

### 架构约束

引擎管线（`executePipeline`）在一个 tick 内同步完成所有 reduce，core 状态立即反映最终值。但表现层需要按动画节奏逐步展示（骰子 → 攻击动画 → impact 瞬间数值变化 → 摧毁特效）。**引擎层不为表现延迟状态计算**，表现层自行管理视觉时序。

### 框架基础设施

引擎提供两个互补的框架 Hook，所有游戏统一使用：

| Hook | 职责 | 核心 API |
|------|------|---------|
| `useVisualStateBuffer` | 数值属性的视觉冻结/双缓冲 | `freeze`/`freezeBatch`/`release`/`clear`/`get`/`snapshot`/`isBuffering` |
| `useVisualSequenceGate` | 交互事件的延迟调度（动画期间不弹交互框） | `beginSequence`/`endSequence`/`scheduleInteraction`/`isVisualBusy`/`reset` |

#### useVisualStateBuffer（视觉状态缓冲）

在动画期间冻结受影响属性的视觉值，UI 读快照而非 core 真实值：

1. **冻结**（`freeze`）：事件到来时，对受影响的 key 快照当前值（回退到变化前）
2. **读取**（`get`）：UI 组件优先读快照值，无快照时回退到 core 真实值
3. **释放**（`release`）：动画 impact 瞬间删除指定 key，UI 回退到 core 真实值
4. **清空**（`clear`）：动画序列结束时清空所有快照

#### 释放时机：FxLayer onEffectImpact

FxLayer 提供 `onEffectImpact?: (id: string, cue: string) => void` 回调，在飞行动画到达目标（冲击帧）时触发。游戏层通过维护 `fxId → bufferKey` 映射，在 impact 回调中释放对应 key：

```typescript
// push 时记录映射
const fxId = fxBus.push(DT_FX.DAMAGE, {}, { damage, startPos, endPos });
if (fxId) fxImpactMap.set(fxId, `hp-${targetId}`);

// FxLayer onEffectImpact 时释放
<FxLayer
  bus={fxBus}
  onEffectImpact={(id) => {
    const key = fxImpactMap.get(id);
    if (key) { damageBuffer.release([key]); fxImpactMap.delete(id); }
  }}
/>
```

#### 两个 Hook 的协作

- `gate.beginSequence()` + `buffer.freeze()` — 动画开始（冻结数值 + 挂起交互）
- `buffer.release()` — impact 瞬间（数值变化可见）
- `buffer.clear()` + `gate.endSequence()` — 动画结束（交互队列排空）

### 已接入的游戏

| 游戏 | 冻结属性 | 冻结时机 | 释放时机 |
|------|---------|---------|---------|
| SummonerWars | 棋盘单位 damage（key=`"row-col"`） | `UNIT_ATTACKED` + `UNIT_DAMAGED` 事件 | 近战 `onAttackHit` / 远程 `onEffectImpact(COMBAT_SHOCKWAVE)` |
| DiceThrone | 玩家 HP（key=`"hp-{playerId}"`） | `DAMAGE_DEALT` / `HEAL_APPLIED` 事件 | `onEffectImpact(DAMAGE/HEAL)` |

### 适用场景

- 棋盘单位 damage / HP / 护甲等数值属性
- 玩家 HP、资源值（金币/魔法值等）
- 任何 UI 展示的数值属性，且该数值有对应的飞行动画/特效

### 新游戏接入（强制）

新游戏有数值变化动画时，必须使用 `useVisualStateBuffer` 管理视觉时序，禁止直接读 core 值渲染。典型接入流程：
1. 在事件消费 Hook 中创建 `useVisualStateBuffer`，事件到来时 `freeze` 对应 key
2. 在 `fxBus.push` 时记录 `fxId → bufferKey` 映射
3. 在 `FxLayer.onEffectImpact` 回调中 `release` 对应 key
4. UI 组件通过 `buffer.get(key, coreValue)` 读取视觉值

### 禁止事项

- ❌ 禁止在 UI 组件中用 `useState<Map>` 自行实现快照逻辑，必须使用 `useVisualStateBuffer`
- ❌ 禁止在 reducer/execute 层延迟事件处理来解决动画时序问题（引擎层必须同步完成）
- ❌ 禁止用 `setTimeout` 延迟读取 core 值来"等动画播完"
- ❌ 新游戏禁止直接读 core 数值属性渲染 HP/血条，必须经过 `useVisualStateBuffer.get()` 中转

---

## EventStreamSystem 使用规范（强制）

特效/动画/音效消费必须用 `getEventStreamEntries(G)`（EventStreamSystem），禁止用 `getEvents(G)`（LogSystem）。原因：LogSystem 持久化全量日志刷新后完整恢复，EventStream 实时消费通道带自增 `id`，撤销时清空。

### 乐观引擎兼容（强制理解）

乐观引擎的 `processCommand` / `reconcile` 过程中，`setState` 会被多次调用。`wait-confirm` 模式会剥离 EventStream（entries 暂时为空），这不是 Undo 回退。`useEventStreamCursor` 已内置处理：entries 为空时保持游标不变，只有当 entries 的最大 ID 真正回退（小于游标值）时才判定为 Undo 回退。消费者无需额外处理。

### 首次挂载跳过历史事件（强制）

> 所有消费 EventStream 的 Hook/Effect 必须遵循，无例外。

**模式 A：过滤式消费（推荐，处理多条新事件）**

使用引擎层通用 hook `useEventStreamCursor`（`src/engine/hooks/useEventStreamCursor.ts`），
自动处理首次挂载跳过历史 + Undo 恢复重置游标。
所有判断在 `consumeNew()` 内同步完成，不依赖 useEffect 时序，
消费者用 `useEffect` 或 `useLayoutEffect` 均可。

简单场景（不需要 reset 清理）：
```typescript
import { useEventStreamCursor } from '../../../engine/hooks';

const { consumeNew } = useEventStreamCursor({ entries: eventStreamEntries });

useEffect(() => {
  const { entries: newEntries } = consumeNew();
  if (newEntries.length === 0) return;
  // ... 处理 newEntries（游标已自动推进）
}, [eventStreamEntries, consumeNew]);
```

需要 Undo 回退清理（攻击队列/技能模式等）：
```typescript
const { consumeNew } = useEventStreamCursor({ entries });

useLayoutEffect(() => {
  const { entries: newEntries, didReset } = consumeNew();
  if (didReset) {
    // 清理 UI 状态：待播放队列、技能模式、视觉缓冲等
    clearPendingAttack(); setAbilityMode(null); damageBuffer.clear();
  }
  if (newEntries.length === 0) return;
  // ... 处理 newEntries
}, [entries, consumeNew]);
```

> `consumeNew()` 返回 `{ entries, didReset }`。`didReset=true` 表示检测到 Undo 回退
> （entries 清空或 ID 回退），消费者据此清理 UI 状态。
> 内部封装了：首次挂载跳过历史、Undo 检测与游标重置、`e.id > lastSeenId` 过滤 + 自动推进。
> 消费者无需手动管理 `lastSeenIdRef` / `isFirstMountRef` / `prevEntriesLenRef`。

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

**检查清单**：① 是否使用 `useEventStreamCursor` 通用 hook？② `consumeNew` 返回的 `didReset` 是否被正确处理（需要清理 UI 状态的场景）？③ 模式 B 的 `useRef` 初始值是否为 `currentEntry?.id ?? null`？④ `consumeNew` 是否在依赖数组中？

**参考**：模式 A → `dicethrone/hooks/useCardSpotlight.ts`（简单）、`summonerwars/ui/useGameEvents.ts`（含 didReset 清理）；模式 B → `lib/audio/useGameAudio.ts`

---

## 卡牌特写队列（CardSpotlightQueue）使用规范

> 路径：`src/components/game/framework/CardSpotlightQueue.tsx` + `hooks/useCardSpotlightQueue.ts`

通用框架组件，用于展示其他玩家打出的卡牌特写。基于 EventStream 驱动，支持队列堆叠（有上限），点击任意位置关闭当前特写。

### 核心特性

- **只显示其他玩家**：自动过滤 `currentPlayerId` 产生的事件
- **队列有上限**：`maxQueue`（默认 5），超出时丢弃最旧的
- **点击关闭**：点击空白/卡牌即可关闭当前项，不阻塞其他操作
- **Undo 安全**：检测到 Undo 回退时自动清空队列
- **游戏层注入渲染**：框架层管理队列逻辑，游戏层通过 `renderCard` 提供卡牌 UI

### 接入方式（游戏层）

```typescript
import { useCardSpotlightQueue, CardSpotlightQueue } from '../../components/game/framework';
import { getEventStreamEntries } from '../../engine/systems/EventStreamSystem';

// 1. 定义数据提取函数
const extractCard = useCallback((event) => {
    const p = event.payload as { playerId: string; defId: string };
    return p ? { playerId: p.playerId, cardData: { defId: p.defId } } : null;
}, []);

// 2. 使用 Hook
const { queue, dismiss } = useCardSpotlightQueue({
    entries: getEventStreamEntries(G),
    currentPlayerId: myPid,
    triggerEventTypes: ['su:action_played'],  // 触发特写的事件类型
    extractCard,
    maxQueue: 5,
});

// 3. 定义渲染函数
const renderCard = useCallback((item) => (
    <div className="..."><CardPreview ... /></div>
), []);

// 4. 渲染组件
<CardSpotlightQueue queue={queue} onDismiss={dismiss} renderCard={renderCard} />
```

### 与 FX 系统的区别

| 维度 | FX 系统 | CardSpotlightQueue |
|------|---------|-------------------|
| 交互性 | `pointer-events-none`，纯展示 | 可点击关闭 |
| 生命周期 | 定时自动消失（`timeoutMs`） | 用户主动关闭 |
| 适用场景 | 力量浮字、VP 飞行等瞬态特效 | 卡牌特写、需要玩家确认的展示 |

### 已接入游戏

- **SmashUp**：行动卡打出时展示特写（替代原 FX `ACTION_SHOW` 的 800ms 自动消失）
- **DiceThrone**：待迁移（当前使用游戏层自建的 `CardSpotlightOverlay` + `useCardSpotlight`）

---

## ActionLogSystem 使用规范（强制）

- ActionLogSystem 只负责收集/落库，禁止系统层硬编码游戏文案
- `formatEntry` 必须返回 i18n key 的 `ActionLogSegment`，禁止拼接硬编码字符串
- 覆盖所有玩家可见状态变化（伤害/治疗/摧毁/移动/资源/VP），不记录内部系统事件
- 支持多条日志返回（命令级+同步事件级）
- 卡牌类日志必须用 `card` 片段支持 hover 预览

### 伤害来源标注（强制，面向百游戏）

**禁止在游戏层手写 breakdown 构建逻辑**，必须使用 `engine/primitives/actionLogHelpers.ts` 提供的通用工具。

每个游戏只需实现一次 `DamageSourceResolver`（约 15 行），框架层自动处理 breakdown 构建：

```typescript
// 游戏层：实现一次 resolver（约 15 行）
const myGameDamageSourceResolver: DamageSourceResolver = {
    resolve(sourceId: string): SourceLabel | null {
        // 1. 技能注册表查找
        const ability = abilityRegistry.get(sourceId);
        if (ability?.name) return { label: ability.name, isI18n: ability.name.includes('.'), ns: MY_NS };
        // 2. reason → i18n key 映射
        const knownReasons: Record<string, string> = { curse: 'actionLog.damageReason.curse' };
        if (knownReasons[sourceId]) return { label: knownReasons[sourceId], isI18n: true, ns: MY_NS };
        return null;
    },
};

// 游戏层：formatEntry 里调用（2 行）
// 场景 A：带 breakdown tooltip（适合有修改器的伤害，如 DiceThrone）
const breakdownSeg = buildDamageBreakdownSegment(dealt, { sourceAbilityId, breakdown, modifiers }, resolver, NS);

// 场景 B：轻量来源标注（适合单位伤害，如 SummonerWars）
const sourceSegs = buildDamageSourceAnnotation({ sourceEntityId, sourceAbilityId, reason }, resolver, NS, 'actionLog.damageFrom', buildCardSegment);
```

**两个工具函数的适用场景**：
- `buildDamageBreakdownSegment` — 有修改器明细（Token/状态/护盾加减），生成带 hover tooltip 的数值片段
- `buildDamageSourceAnnotation` — 无修改器，只需标注"来自 XX"，生成 0-2 个普通 segment

**现有游戏参考**：
- DiceThrone `game.ts` → `buildDamageBreakdownSegment`（DAMAGE_DEALT / HEAL_APPLIED）
- SummonerWars `actionLog.ts` → `buildDamageSourceAnnotation`（UNIT_DAMAGED）

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

> **已迁移至 `docs/ai-rules/testing-audit.md`「描述→实现全链路审查规范」节，该文档为唯一权威来源。**
> 当用户说"审查"/"审核"/"检查实现"/"核对"等词时，必须先阅读 `docs/ai-rules/testing-audit.md`，按规范流程执行审查并输出矩阵，禁止凭印象回答。


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

## 伤害计算管线（`engine/primitives/damageCalculation.ts`）（强制）

> **迁移状态**: ✅ DiceThrone 完成（26/27，96%）  
> **历史遗留**: SummonerWars/SmashUp 保持现有实现  
> **新游戏规范**: 必须使用伤害计算管线，禁止手动构建 DAMAGE_DEALT 事件

### 概述

伤害计算管线是基于 `modifier.ts` 的专用包装器，提供：
- **自动收集修正**：从 Token/状态/护盾自动收集伤害修正
- **完整 breakdown**：生成包含基础伤害 + 每步修正的计算链路
- **ActionLog 集成**：breakdown 结构直接用于 ActionLog 显示
- **向后兼容**：旧的手动 modifiers 格式仍可正常工作

**DiceThrone 迁移完成度**: 26/27 个伤害计算点（96%），1 个遗留（PyroBlast 奖励骰结算，涉及奖励骰系统，优先级低）。

### 核心 API

```typescript
// 创建伤害计算实例
function createDamageCalculation(config: DamageCalculationConfig): DamageCalculation

// 批量计算（AOE 技能优化）
function createBatchDamageCalculation(
  config: Omit<DamageCalculationConfig, 'target'> & { targets: DamageTarget[] }
): DamageCalculation[]

// DamageCalculation 类方法
class DamageCalculation {
  resolve(): DamageResult        // 计算最终伤害
  toEvents(): GameEvent[]        // 生成 DAMAGE_DEALT 事件
}
```

### 配置选项

```typescript
interface DamageCalculationConfig {
  source: DamageSource;           // 伤害来源（playerId + abilityId）
  target: DamageTarget;           // 伤害目标（playerId）
  baseDamage: number;             // 基础伤害值
  state: any;                     // 游戏状态（用于自动收集）
  timestamp?: number;             // 时间戳
  
  // 自动收集开关（默认 true）
  autoCollectTokens?: boolean;    // 自动收集 Token 修正
  autoCollectStatus?: boolean;    // 自动收集状态修正
  autoCollectShields?: boolean;   // 自动收集护盾减免
  
  // 手动添加的修正
  additionalModifiers?: ModifierDef<DamageContext>[];
}
```

### 使用场景

#### 场景 1：基础伤害（无修正）

```typescript
const damageCalc = createDamageCalculation({
  source: { playerId: attackerId, abilityId: 'fireball' },
  target: { playerId: defenderId },
  baseDamage: 5,
  state: ctx.state,
  timestamp: ctx.timestamp,
  autoCollectTokens: false,
  autoCollectStatus: false,
  autoCollectShields: false,
});
events.push(...damageCalc.toEvents());
```

#### 场景 2：自动收集 Token 修正

```typescript
// 假设攻击方有 3 个火焰精通 Token（damageBonus: 1）
const damageCalc = createDamageCalculation({
  source: { playerId: attackerId, abilityId: 'flame-strike' },
  target: { playerId: defenderId },
  baseDamage: 5,
  state: ctx.state,
  timestamp: ctx.timestamp,
  autoCollectTokens: true,  // 自动加上 3 点伤害
  autoCollectStatus: false,
  autoCollectShields: false,
});
// 最终伤害：5 + 3 = 8
```

#### 场景 3：手动添加修正（先授予 Token 再造成伤害）

```typescript
// 1. 先授予 2 个火焰精通
const currentFM = getFireMasteryCount(ctx);
const updatedFM = Math.min(currentFM + 2, limit);
events.push({
  type: 'TOKEN_GRANTED',
  payload: { targetId: attackerId, tokenId: 'fire_mastery', amount: 2, newTotal: updatedFM },
  // ...
});

// 2. 造成伤害（基于授予后的 FM）
// 注意：必须手动添加修正，因为 state 还未更新
const damageCalc = createDamageCalculation({
  source: { playerId: attackerId, abilityId: 'fiery-combo' },
  target: { playerId: defenderId },
  baseDamage: 5,
  state: ctx.state,
  timestamp: ctx.timestamp + 0.1,
  additionalModifiers: updatedFM > 0 ? [{
    id: 'fiery-combo-fm',
    type: 'flat',
    value: updatedFM,  // 使用授予后的值
    priority: 10,
    source: 'fire_mastery',
    description: 'tokens.fire_mastery.name',
  }] : [],
  autoCollectTokens: false,  // 禁用自动收集（会读取旧状态）
});
events.push(...damageCalc.toEvents());
```

#### 场景 4：乘法修正

```typescript
const fm = getFireMasteryCount(ctx);
const damageCalc = createDamageCalculation({
  source: { playerId: attackerId, abilityId: 'ignite' },
  target: { playerId: defenderId },
  baseDamage: 4,
  state: ctx.state,
  timestamp: ctx.timestamp,
  additionalModifiers: fm > 0 ? [{
    id: 'ignite-fm-multiplier',
    type: 'flat',
    value: fm * 2,  // 2x FM 乘法修正
    priority: 10,
    source: 'fire_mastery',
    description: 'tokens.fire_mastery.name',
  }] : [],
  autoCollectTokens: false,
});
// 最终伤害：4 + (fm * 2)
```

#### 场景 5：条件修正

```typescript
const damageCalc = createDamageCalculation({
  source: { playerId: attackerId, abilityId: 'burn-strike' },
  target: { playerId: defenderId },
  baseDamage: 5,
  state: ctx.state,
  timestamp: ctx.timestamp,
  additionalModifiers: [{
    id: 'burn-bonus',
    type: 'flat',
    value: 2,
    priority: 10,
    source: 'burn-bonus',
    condition: (ctx) => {
      // 只有目标有燃烧状态时才加成
      const target = ctx.state.core.players[ctx.target.playerId];
      return (target.statusEffects.burn || 0) > 0;
    },
  }],
});
```

### 自动收集机制

#### Token 修正
从 `state.core.players[attackerId].tokens` 读取，查找 `tokenDefinitions` 中有 `damageBonus` 的 Token：

```typescript
// tokenDefinitions 示例
[
  { id: 'fire_mastery', name: 'tokens.fire_mastery.name', damageBonus: 1 },
  { id: 'taiji', name: 'tokens.taiji.name', damageBonus: 1 },
]

// 如果攻击方有 3 个 fire_mastery，自动添加 +3 伤害修正
```

#### 状态修正
从 `state.core.players[defenderId].statusEffects` 读取，查找 `tokenDefinitions` 中有 `damageReduction` 的状态：

```typescript
// tokenDefinitions 示例
[
  { id: 'armor', name: 'status.armor.name', damageReduction: 1 },
]

// 如果目标有 2 层护甲，自动添加 -2 伤害修正
```

#### 护盾修正
从 `state.core.players[defenderId].damageShields` 读取，累加所有护盾值：

```typescript
// 如果目标有 [{ value: 2 }, { value: 3 }]，自动添加 -5 伤害修正
```

### Breakdown 结构

```typescript
interface DamageBreakdown {
  base: {
    value: number;              // 基础伤害
    sourceId: string;           // 来源 ID（abilityId）
    sourceName?: string;        // 来源名称（i18n key 或文本）
    sourceNameIsI18n?: boolean; // 是否为 i18n key
  };
  steps: DamageBreakdownStep[]; // 修正步骤列表
}

interface DamageBreakdownStep {
  type: string;                 // 修正类型（flat/percent）
  value: number;                // 修正值
  sourceId: string;             // 来源 ID
  sourceName?: string;          // 来源名称
  sourceNameIsI18n?: boolean;   // 是否为 i18n key
  runningTotal: number;         // 应用后的累计值
}
```

### ActionLog 集成

新的 `DAMAGE_DEALT` 事件包含 `breakdown` 字段：

```typescript
interface DamageDealtEvent {
  type: 'DAMAGE_DEALT';
  payload: {
    targetId: PlayerId;
    amount: number;
    actualDamage: number;
    sourceAbilityId?: string;
    modifiers?: DamageModifier[];  // 旧格式（向后兼容）
    breakdown?: DamageBreakdown;   // 新格式（优先使用）
  };
}
```

ActionLog 格式化逻辑优先使用 `breakdown`，降级到 `modifiers`：

```typescript
// 优先使用新格式
if (breakdown) {
  breakdownLines.push({
    label: breakdown.base.sourceName || breakdown.base.sourceId,
    value: breakdown.base.value,
    color: 'neutral',
  });
  breakdown.steps.forEach(step => {
    breakdownLines.push({
      label: step.sourceName || step.sourceId,
      value: step.value,
      color: step.value > 0 ? 'positive' : 'negative',
    });
  });
}
// 降级到旧格式
else if (modifiers && modifiers.length > 0) {
  // ...
}
```

### 注意事项

1. **自动收集依赖 tokenDefinitions**：如果 `state.core.tokenDefinitions` 为空或未正确设置，自动收集不会工作，需要手动添加修正。

2. **先授予 Token 再造成伤害**：必须手动添加修正，因为 state 还未更新。禁用 `autoCollectTokens` 避免读取旧状态。

3. **修正优先级**：
   - 基础伤害：priority = 0
   - Token/状态修正：priority = 10-20
   - 护盾减免：priority = 100（最后应用）

4. **伤害不会为负数**：`resolve()` 会自动将负数伤害钳制为 0。

5. **向后兼容**：旧的手动 `modifiers` 格式仍可正常工作，ActionLog 会降级渲染。

### 迁移指南

详见 `docs/damage-calculation-pipeline-migration-guide.md`。

### 测试

- 单元测试：`src/engine/primitives/__tests__/damageCalculation.test.ts`
- 集成测试：`src/games/dicethrone/domain/__tests__/damage-pipeline-migration.test.ts`
- 迁移示例：`src/games/dicethrone/domain/customActions/pyromancer.ts`

---

## SmashUp 消灭触发链与 pendingSave 机制（强制）

> **修改 `processDestroyTriggers`、`postProcessSystemEvents` 或相关 trigger 逻辑时必读。**

### 架构概述

消灭触发处理分为两层，**必须理解它们的关系**：

| 层 | 位置 | 职责 | 运行时机 |
|---|---|---|---|
| `execute()` 内部 | `reducer.ts` | 处理命令产生的 `MINION_DESTROYED` 事件的 trigger 链（onDestroy → baseTrigger → ongoing） | 事件被 reduce 到 core 之前 |
| `postProcessSystemEvents` | `index.ts` | 处理系统事件（afterEvents 产生的）的 trigger 链 | 事件被 reduce 到 core 之后 |

**关键**：`execute()` 中的处理发生在 `reduceEventsToCore` **之前**，此时被消灭的随从仍在 `core.bases[].minions` 中，trigger 能正确找到它。如果移到 `postProcessSystemEvents`（reduce 之后），随从已被移除，trigger 会找不到目标。

### pendingSave 机制设计约束

`pendingSave` 用于暂缓 `MINION_DESTROYED` 事件——当 baseTrigger/ongoing 创建了"拯救交互"（如雄蜂防消灭、九命之屋），等待玩家决定。

**核心不变量**：
1. **`interactionCountBefore` 必须在 `onDestroy` 之后取值** — onDestroy 产生的交互是死亡效果（如 Igor 选目标放指示物），不是拯救交互，不应触发 pendingSave
2. **不得按 sourceId 过滤"拯救交互"** — 任何 baseTrigger/ongoing 创建的新交互都可能是拯救交互（雄蜂、九命之屋等），硬编码白名单会遗漏新增的拯救能力
3. **pendingSave 检测公式**：`interactionCountAfter > interactionCountBefore` 即为拯救交互，无需额外过滤

**历史教训**：
- ❌ 在 onDestroy 之前取 `interactionCountBefore` → Igor 的效果交互被误判为拯救交互 → Igor 的 `MINION_DESTROYED` 被错误抑制
- ❌ 添加 `isSaveInteraction = sourceId === 'base_nine_lives_intercept'` 过滤 → 雄蜂的 `giant_ant_drone_prevent_destroy` 被跳过 → 雄蜂防消灭失效
- ✅ 正确：`interactionCountBefore` 在 onDestroy 之后取值 + 不按 sourceId 过滤

### matchState 链式传递（强制）

`postProcessSystemEvents` 中 `processDestroyTriggers` → `processMoveTriggers` → `processAffectTriggers` 必须链式传递 `matchState`：

```typescript
// ✅ 正确：每步产生的 matchState 传给下一步
const afterDestroy = processDestroyTriggers(events, ms, pid, random, now);
if (afterDestroy.matchState) ms = afterDestroy.matchState;
const afterMove = processMoveTriggers(afterDestroy.events, ms, pid, random, now);
if (afterMove.matchState) ms = afterMove.matchState;

// ❌ 错误：每步都传原始 ms → trigger 创建的交互被后续步骤覆盖/丢弃
const afterDestroy = processDestroyTriggers(events, ms, pid, random, now);
const afterMove = processMoveTriggers(afterDestroy.events, ms, pid, random, now);
```

---
