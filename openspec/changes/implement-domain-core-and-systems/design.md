# Design: 领域内核 + 系统层（激进引擎化）

## 与现有 Specs 的关系

| 现有 Spec | 关系 | 说明 |
|-----------|------|------|
| `game-registry` | 保持不变 | 继续使用 `generate_game_manifests.js` 作为权威清单 |
| `match-archive` | 扩展对齐 | 统一 log 格式需与归档模型对接 |
| `tutorial-engine` | 演进为系统 | 教程作为 Systems 层的可选系统 |
| `undo-system` | 本次补充 | 当前目录为空，由本次变更填充规格 |
| `manage-modals` | 无直接关系 | UI 层能力，与引擎层正交 |

## 目录结构约定

```
src/
├── engine/                      # 引擎层（本次新增）
│   ├── types.ts                 # 核心类型定义（MatchState、Command、Event）
│   ├── adapter.ts               # Boardgame.io 适配器工厂
│   ├── pipeline.ts              # Command/Event 执行管线
│   └── systems/                 # 系统层
│       ├── types.ts             # 系统接口定义
│       ├── UndoSystem.ts        # 撤销系统（取代旧 UndoManager）
│       ├── PromptSystem.ts      # Prompt/Choice 系统
│       ├── LogSystem.ts         # 事件日志系统
│       └── index.ts             # 系统注册与导出
├── core/                        # 保留，逐步迁移到 engine/
├── systems/                     # 保留，逐步演进
│   ├── AbilitySystem.ts         # 演进为可选引擎系统
│   └── StatusEffectSystem.ts    # 状态效果系统
└── games/
    └── <gameId>/
        ├── manifest.ts          # 游戏清单（现有）
        ├── domain/              # 领域内核（本次新增）
        │   ├── types.ts         # 游戏状态、Command、Event 类型
        │   ├── commands.ts      # Command 定义与验证
        │   ├── reducer.ts       # 确定性状态变更
        │   └── view.ts          # playerView（隐藏信息）
        ├── game.ts              # Boardgame.io Game（适配层调用）
        └── Board.tsx            # UI（保持自由度）
```

## 为什么要这样设计
我们要持续增加不同类型桌游，同时还要统一平台能力（撤销、教程、回放/审计、prompt/choice、隐藏信息等）。

现有代码已经出现了“跨游戏能力正在外溢但缺乏统一落点”的信号：

- 撤销：旧 `UndoManager` 需要每个游戏手动调用 `saveSnapshot(G)`，现已由 `UndoSystem` 自动快照替代。
- 选择/提示：Dicethrone 的 `pendingChoice` 是游戏特有结构，未来会在更多游戏里重复出现。
- 归档：服务端为归档需要往状态里注入 `__matchID`，属于“系统字段混入领域状态”。

如果不尽快把这些能力收敛到引擎层，游戏数量一多就会出现：同一能力 N 套实现、语义不一致、回放/调试困难、隐藏信息容易泄露。

## 总体架构

### 第 1 层：游戏插件装配
继续使用当前 manifest/registry 的方式做装配：

- `scripts/generate_game_manifests.js` 作为“游戏权威清单”来源。
- 每个游戏目录仍然拥有资源、i18n、UI，以及新增的“领域内核模块”。

### 第 2 层：会话/网络驱动器
保留 Boardgame.io 作为会话驱动器：

- 网络同步、match 存储、turn/stage 脚手架、随机数工具等。

但将其“降级为适配层”：

- Boardgame.io 的 moves 不再承载规则本体，只负责输入翻译与调用引擎管线。

### 第 3 层：领域内核（Domain Core）
每个游戏提供运行时无关的规则模块（纯 TS）。

核心概念：

- Command：玩家意图（纯数据）
- Event：权威后果（纯数据）
- Reducer：确定性地应用 event(s) 生成新状态
- Validator：校验命令合法性

选择这种模型而不是 DSL 的原因：

- 桌游类型差异非常大，DSL 早期会卡在表达力与调试体验。
- UI/交互差异也很大，强行统一表达会导致长期“抽象债”。

### 第 4 层：系统层（Systems）
系统层以插件方式承载跨游戏能力，并通过 hook 参与 command/event 管线。

系统必须满足：

- 确定性（无隐藏副作用）
- 面向纯数据（可序列化、可回放）
- 可按游戏启用/关闭

与现有代码最贴近的系统候选：

- UndoSystem（已替代旧 UndoManager）
- PromptSystem（替换各游戏自造 `pendingChoice`）
- LogSystem（统一事件日志，支撑回放/审计/调试）
- Ability/Effect System（演进 `src/systems/AbilitySystem`，为骰子/卡牌类复用）

## 统一状态形状：`G.sys` + `G.core`
标准化所有游戏的 Boardgame.io `G`：

- `G.sys`：系统/平台状态
- `G.core`：游戏领域状态

`G.sys` 最小字段建议包含：

- `schemaVersion`
- `matchId`
- `log`（events 或 commands+events）
- `undo`（历史 + 撤销请求状态）
- `prompt`（当前 prompt / 队列）

目的：

- 让撤销、prompt、日志、隐藏信息等系统可以不依赖游戏私有字段。
- 消除像 `__matchID` 这种“系统字段混入领域状态”的现象。

## 适配层（Boardgame.io Adapter）
提供一个工具，将 Domain Core + Systems 组装成 Boardgame.io `Game`。

适配层职责：

- 将 move payload 翻译成 Command
- 执行管线：
  - Systems.beforeCommand
  - Core.validate
  - Core.produceEvents
  - Reduce events -> 更新 `G.core`
  - Systems.afterEvents -> 更新 `G.sys`
- 强制执行隐藏信息视图（player view/redaction）

适配层是“纪律执行点”：

- 规则不得写在 moves
- 隐藏信息必须由统一机制过滤

## 确定性与回放
确定性是一级需求：

- Commands / Events 必须可序列化。
- RNG 必须可控：
  - 可继续使用 Boardgame.io random，但要把随机结果记录为显式 Events；
  - 或者在 `G.sys` 保存 seed 并使用确定性 RNG。

回放通过重放 Events（或 Commands + 导出的 Events）实现。

## 迁移计划（设计视角）

1) 引入 `G.sys` + 适配层骨架（建议新建 `src/engine/` 包）。
2) 先迁移 TicTacToe：规模小、已有撤销基础，能快速验证“撤销自动化”。
3) 引入 PromptSystem，迁移 Dicethrone 的 `pendingChoice` 结构。
4) 将 Dicethrone 的效果结算抽成 EffectSystem（可选），为未来卡牌/骰子游戏复用铺路。
5) 归档/回放：将统一 log 接入归档模型，提供重放与审计能力。

## DiceThrone 迁移策略（阶段 3 详细设计）

### 领域内核目录结构

```typescript
src/games/dicethrone/domain/
├── types.ts          # DiceThroneCore, Command variants, Event variants
├── commands.ts       # validate 逻辑（从 isMoveAllowed + 各 move 校验抽取）
├── reducer.ts        # reduce(state, event) 确定性状态变更
├── effects.ts        # 技能效果执行（复用 AbilitySystem 但走 event 驱动）
├── rules.ts          # 共享规则（canPlayCard, getAvailableAbilities 等）
├── view.ts           # playerView（隐藏对手手牌）
└── index.ts          # DomainCore 导出
```

### Command 类型定义

| Command | 说明 | Payload |
|---------|------|--------|
| `ROLL_DICE` | 掷骰 | `{}` |
| `TOGGLE_DIE_LOCK` | 锁定/解锁骰子 | `{ dieIndex: number }` |
| `CONFIRM_ROLL` | 确认骰子结果 | `{}` |
| `SELECT_ABILITY` | 选择技能 | `{ abilityId: string }` |
| `PLAY_CARD` | 打出卡牌 | `{ cardId: string, targetId?: string }` |
| `SELL_CARD` | 售卖卡牌 | `{ cardId: string }` |
| `UNDO_SELL_CARD` | 撤回售卖 | `{}` |
| `ADVANCE_PHASE` | 推进阶段 | `{}` |
| `RESOLVE_PROMPT` | 解决选择 | `{ optionId: string }` |
| `UPGRADE_ABILITY` | 升级技能 | `{ cardId: string, abilitySlot: number }` |

### Event 类型定义

| Event | 说明 | Payload |
|-------|------|--------|
| `DICE_ROLLED` | 骰子结果 | `{ results: number[] }` |
| `DIE_LOCKED` / `DIE_UNLOCKED` | 骰子锁定状态 | `{ dieIndex: number }` |
| `PHASE_CHANGED` | 阶段切换 | `{ from: Phase, to: Phase }` |
| `ABILITY_ACTIVATED` | 技能激活 | `{ abilityId: string, effects: Effect[] }` |
| `DAMAGE_DEALT` | 伤害 | `{ targetId: string, amount: number, source?: string }` |
| `HEAL_APPLIED` | 治疗 | `{ targetId: string, amount: number }` |
| `STATUS_APPLIED` | 状态施加 | `{ targetId: string, statusId: string, stacks: number }` |
| `STATUS_REMOVED` | 状态移除 | `{ targetId: string, statusId: string }` |
| `CARD_DRAWN` | 抽牌 | `{ playerId: string, cardId: string }` |
| `CARD_DISCARDED` | 弃牌 | `{ playerId: string, cardId: string }` |
| `CARD_SOLD` | 售卖 | `{ playerId: string, cardId: string, cpGained: number }` |
| `CP_CHANGED` | CP 变化 | `{ playerId: string, delta: number }` |
| `ABILITY_UPGRADED` | 技能升级 | `{ playerId: string, slot: number, newAbilityId: string }` |

### 回合阶段模型

DiceThrone 的多阶段回合需要在 `G.sys.phase` 或 `G.core.turnPhase` 中维护：

```typescript
upkeep → income → main1 → offensiveRoll → defensiveRoll → main2 → discard
```

**关键差异处理**：
- `offensiveRoll` / `defensiveRoll` 涉及当前玩家与对手的交替操作
- `pendingAttack` 需要迁移到 `G.sys.prompt` 或保留在 `G.core` 作为领域状态

### PromptSystem 对接

将现有 `pendingChoice` 结构迁移到 `G.sys.prompt`：

```typescript
// 现有结构
G.pendingChoice = {
    type: 'selectStatus',
    playerId: '0',
    options: [...],
};

// 迁移后
G.sys.prompt.current = {
    id: 'select-status-xxx',
    playerId: '0',
    title: 'selectStatus',
    options: [...],
    sourceId: 'ability-xxx',
};
```

## AbilitySystem 演进路径

### 现状
`src/systems/AbilitySystem.ts` 通过 `GameContext` 直接修改状态：

```typescript
applyDamage(targetId, amount); // 直接 mutate G.players[targetId].health
grantStatus(targetId, statusId, stacks); // 直接 mutate G.players[targetId].statusEffects
```

### 演进方案

1. **保留现有 API** 作为兼容层（DiceThrone 迁移前可用）
2. **新增 AbilityEffectResolver**：返回 Event 而非直接 mutate

```typescript
// 新接口
function resolveEffectsToEvents(
    effects: AbilityEffect[],
    ctx: EffectContext
): GameEvent[] {
    const events: GameEvent[] = [];
    for (const effect of effects) {
        switch (effect.type) {
            case 'damage':
                events.push({ type: 'DAMAGE_DEALT', payload: { ... } });
                break;
            case 'heal':
                events.push({ type: 'HEAL_APPLIED', payload: { ... } });
                break;
            // ...
        }
    }
    return events;
}
```

3. **Reducer 统一处理**：所有状态变更由 `reduce(state, event)` 执行

## UI 层适配策略

### 状态访问模式变更

```typescript
// Before（扁平 G）
const player = G.players[rootPid];
const currentPhase = G.turnPhase;
const pendingChoice = G.pendingChoice;

// After（G.sys + G.core）
const player = G.core.players[rootPid];
const currentPhase = G.core.turnPhase; // 或 G.sys.phase
const prompt = G.sys.prompt.current;
```

### Board.tsx 组件拆分建议

现有 `Board.tsx` 约 2000+ 行，建议拆分为：

| 组件 | 职责 | 预估行数 |
|------|------|--------|
| `HandArea.tsx` | 手牌区域、拖拽逻辑 | ~300 行 |
| `DiceTray.tsx` | 骰子展示、3D 渲染 | ~200 行 |
| `DiceActions.tsx` | 骰子操作按钮 | ~100 行 |
| `AbilityOverlays.tsx` | 技能覆盖层 | ~150 行 |
| `PlayerStats.tsx` | 玩家状态面板 | ~100 行 |
| `DiscardPile.tsx` | 弃牌堆 | ~100 行 |
| `DrawDeck.tsx` | 抽牌堆 | ~50 行 |
| `PhaseIndicator.tsx` | 阶段指示器 | ~80 行 |
| `hooks/useDiceThrone.ts` | 状态 hooks | ~150 行 |
| `constants.ts` | 常量与配置 | ~100 行 |
| `DiceThroneBoard.tsx` | 主容器 | ~400 行 |

### 共享规则抽取

创建 `domain/rules.ts` 供 UI 与 domain 共享：

```typescript
// UI 调用
import { canPlayCard, getAvailableAbilities } from './domain/rules';

// domain/commands.ts 调用
import { canPlayCard } from './rules';
```

## 取舍
- 优点：
  - 平台能力集中复用；新增游戏更快
  - undo/prompt/log/hidden-info 行为一致
  - 回放/调试/审计能力跨游戏统一

- 代价：
  - 需要严格约束（moves 只做适配）
  - 增加内部引擎 API 维护成本
  - 现有游戏迁移需要阶段性投入

考虑到计划支持多类型桌游且平台能力不断增长，这个取舍是值得的。
