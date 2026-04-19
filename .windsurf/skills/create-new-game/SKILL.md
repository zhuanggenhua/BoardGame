---
name: create-new-game
description: "为本项目创建新游戏或先做新游戏资源/data intake。当用户要求新增游戏，或只给图片/位置就希望先开工时使用。基于 dicethrone/summonerwars/smashup 的真实模式，分阶段完成，并带启动询问、素材 intake 与验收门禁。"
---

# 创建新游戏（分阶段工作流）

> **核心原则**：每个阶段独立可验证、独立可提交。阶段之间不留 TODO 缺口。AI 必须在完成当前阶段验收后才能进入下一阶段。

## 必读索引（单一权威来源，避免本文档过时）

> 本 skill 只做“分阶段流程 + 验收门禁 + 最小闭环”。
> 任何**规范/红线/最佳实践**若在下列文档中已有定义，必须以它们为准；本 skill 不重复展开。

- 总则：`AGENTS.md`
- 引擎/系统/move/command：`docs/ai-rules/engine-systems.md`
- UI/布局/组件：`docs/ai-rules/ui-ux.md`
- React 白屏/渲染错误/Hook 规则：`docs/ai-rules/golden-rules.md`
- 动画/特效：`docs/ai-rules/animation-effects.md`
- 数据录入/真相源契约：`docs/ai-rules/data-entry.md`
- 图片/音频资源接入：`docs/ai-rules/asset-pipeline.md`
- 音频细则：`docs/audio/audio-usage.md`（新增音频资产流程：`docs/audio/add-audio.md`）
- 工具脚本：`docs/tools.md`
- 图片 intake 复刻案例：`docs/games/smashup/workflows/smashup-faction-intake.md`
- 不确定该读哪份：`docs/ai-rules/doc-index.md`

## 前置 0：环境与来源确认（强制）

开始任何目录创建、规则录入、素材落盘前，先做以下确认。**这是本 skill 的默认提问模板，不等用户自己提醒**：

1. **主分支基线确认**
   - 先检查当前是否基于职责正确的 `main` 基线。
   - 主动询问用户是否要先同步/更新 `main`；默认推荐“是”，尤其是准备新开 `feat/game-<gameId>` 时。
   - 如需新建分支或 worktree，必须遵循 `AGENTS.md`：从 `main` 创建，且先征得用户确认。
2. **R2 本地同步确认**
   - 主动询问是否要先执行 `npm run assets:download -- --check` 或 `npm run assets:download`，把远端资源拉到本地。
   - 推荐场景：换机/新环境、本地缺图、要复用 `common/` 资源、或当前游戏已有远端图片资产。
3. **真相源 / 对照源裁定**
   - 主动询问本轮主真相源是什么：官方规则书、官方站点、用户图片、用户指定网站、数据库等。
   - 主动询问是否要把 Wiki、用户给的网站或其他数据库作为对照源一起比对。
   - 未裁定前，禁止把多个来源的内容直接混写进代码。
4. **素材处理授权**
    - 主动询问是否允许 AI 自动重命名、自动移动到语义目录、自动压缩。
    - 若用户只给图片路径 + 位置表 / 行列数 / 裁片顺序，也允许直接进入资源 intake，不必等到完整玩法阶段。
    - **自动重命名的依据必须先说明**：默认依据是读图得到的对象语义 + 真相源合同，不是原文件名。
    - **默认不改用户已有命名**：只有当文件名明显是随机值、导出默认名或无语义占位名时，才默认自动改名；否则先询问，未获确认就保留原命名。

## 前置 1：信息收集（启动门禁）

收集以下信息后才能开始。**已有信息直接使用，缺失项回问用户，不猜测**：

1. **gameId**（小写，与目录名一致，如 `smashup`）
2. **玩家人数范围**（如 `[2]`、`[2,3,4]`）
3. **核心机制简述**（如"卡牌驱动+区域控制"、"骰子+角色技能"、"战棋+召唤"）
4. **是否需要阶段/流程系统**（多阶段回合制 → FlowSystem）
5. **规则文档位置**（若有，先放 `rule/` 目录下）
6. **i18n 标题与简介**（中英文）
7. **当前素材输入形态**（规则书/PDF/图片路径/位置表/网站/Wiki/用户整理表）
8. **是否允许自动重命名并移动素材到正式目录**
9. **是否需要先拉取 R2 本地资源**
10. **是否需要与 Wiki / 官网 / 用户指定站点做对照录入**

**先查已有字段**：阅读 `src/games/manifest.types.ts` 确认可用字段，避免重复询问。

## 前置 1.5：图片 / 位置驱动的快速 intake（可直接启动）

当用户还没把完整规则讲完，但已经给了**图片路径、裁片位置、行列数、顺序说明或对象定位**时，可以直接启动资源 intake。不要要求“先把所有规则补齐再开始”。

### 允许直接开工的最小输入

1. `gameId`
2. 原图路径或图片文件列表
3. 每张图的素材类别（缩略图 / 卡牌 atlas / 基地 atlas / 角色板 / 棋盘 / 通用插图）
4. 位置口径（行列数、row-major 顺序、裁图坐标、对象列表之一即可）
5. 当前主真相源与是否需要对照源

### AI 默认动作

1. 先写素材录入契约：真相源表、切图表、核对合同表、对照表、冲突待裁定表。
2. 先读图识别对象，再判断现有文件名是否明显随机/无语义：
   - 若是随机名、默认导出名、批量下载残留名，则按**图片内容语义**自动重命名并移动到正式目录。
   - 若现有文件名看起来是用户有意命名的语义名，则默认不改名，只询问是否需要统一为项目规范命名。
3. 原图落盘后立即运行 `npm run compress:images -- public/assets/<gameId>` 或最小必要子目录。
4. 若用户给的是“位置/顺序”，则直接建立索引映射和命名合同，不等待后续手工整理。
5. 若默认运行态依赖远端资源，数据录入或图片 intake 完成后必须跑 `npm run assets:check`；只要本轮新增/变更了运行时资源且远端有缺口，就必须继续执行上传闭环，直到远端对象可访问，不能停留在“本地已落盘”。

### 默认目录与命名约定

| 素材类型 | 默认命名 | 默认目录 |
|---------|---------|---------|
| 缩略图 | `cover.png` | `public/assets/<gameId>/thumbnails/` |
| 卡牌 atlas | `<batch>.png` | `public/assets/i18n/zh-CN/<gameId>/cards/` |
| 基地 atlas | `<batch>_base.png` | `public/assets/i18n/zh-CN/<gameId>/base/` |
| 角色/英雄面板 | `<entityId>-board.png` | `public/assets/i18n/zh-CN/<gameId>/hero/` |
| 棋盘/地图/公共插图 | 按语义命名 | `public/assets/i18n/zh-CN/<gameId>/board/` 或 `common/` |
| 图集配置 | `<name>.atlas.json` | `public/assets/atlas-configs/<gameId>/` |

若用户没有给命名方案，AI 默认采用上述语义命名；若用户已给命名规则，以用户规则为准。

### 命名依据（强制）

1. **正式命名依据 = 图片内容语义 + 真相源合同**
   - 能从图片中直接读到对象名称、类别、批次、角色身份时，必须以这些内容作为正式命名依据。
2. **原文件名只当输入，不当正式命名依据**
   - 像 `IMG_1234.png`、`新建文件夹 (2).png`、`scan0007.png`、`image(1).png` 这类随机名/默认名不能直接沿用为长期正式命名。
   - 若文件名本身已经是明显语义化的用户命名，则默认保留，不自动替换。
3. **按层级决定命名粒度**
   - 整体缩略图按用途命名，如 `cover`
   - atlas 按批次/对象集合命名，如 `<batch>`、`<batch>_base`
   - 单张裁片按对象命名，如卡名、基地名、角色名或稳定 `defId`
4. **图面名与 canonical 名冲突时必须分离**
   - 若图面显示名和正式对象名不一致，必须在合同里显式记录“显示名”和“正式命名/defId”的裁决，不能暗改。
5. **看不清就停**
   - 图片内容不足以支持可靠命名时，不得硬命名；应标记待确认并拉入对照源比对。
6. **只有明显随机名才默认自动改**
   - “明显随机名”指随机字符串、设备默认导出名、截图默认名、扫描仪流水号、下载站无语义序号等。
   - 只要文件名存在明确语义且看起来是用户主动命名，就应先询问，不要默认替换。

---

## 阶段 1：目录骨架与 Manifest 落地

**目标**：建立完整目录结构与最小占位实现，`npm run generate:manifests` 可成功运行。

### 1.1 创建目录结构

> **默认拆分**：中等以上复杂度游戏（命令数 ≥5 或有多阶段回合）从第一天就用拆分结构。

```
src/games/<gameId>/
  manifest.ts          # 清单元数据
  game.ts              # 引擎适配器组装（只做组装，不写逻辑）
  Board.tsx            # UI 布局组装（逻辑拆到 hooks/，子组件拆到 ui/）
  thumbnail.tsx        # 缩略图组件
  tutorial.ts          # 教学配置（占位）
  audio.config.ts      # 音频配置（占位）
  criticalImageResolver.ts  # 关键图片预加载（若有精灵图）
  domain/
    index.ts           # 领域内核入口
    types.ts           # re-export barrel（导出 core-types + commands + events）
    core-types.ts      # 状态接口（PlayerState, GameCore, 基础类型）
    commands.ts        # 命令类型 + XX_COMMANDS 常量
    events.ts          # 事件类型 + XX_EVENTS 常量
    ids.ts             # 领域 ID 常量表
    utils.ts           # 游戏内共享工具（从第一天就建立）
  rule/
    <游戏名>规则.md     # 规则文档占位
  hooks/               # 游戏业务 hooks
  ui/                  # 游戏 UI 子组件
  __tests__/
    smoke.test.ts      # 冒烟测试占位
```

### 1.2 manifest.ts（参考真实游戏）

```ts
import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: '<gameId>',
    type: 'game',
    enabled: true,
    titleKey: 'games.<gameId>.title',
    descriptionKey: 'games.<gameId>.description',
    category: 'strategy',         // strategy | casual | party | abstract
    playersKey: 'games.<gameId>.players',
    icon: '🎮',
    thumbnailPath: '<gameId>/thumbnails/cover',
    allowLocalMode: false,        // 默认仅联机
    playerOptions: [2],           // 可选 [2,3,4]
    tags: [],                     // dice_driven | card_driven | tactical 等
    bestPlayers: [2],
};

export const <GAME_ID>_MANIFEST: GameManifestEntry = entry;
export default entry;
```

### 1.3 domain 类型文件（默认拆分结构）

**core-types.ts** — 状态接口：
```ts
import type { PlayerId } from '../../../engine/types';
export type GamePhase = 'factionSelect' | 'startTurn' | 'playCards' | ...;
export const PHASE_ORDER: GamePhase[] = [...];
export interface PlayerState { id: PlayerId; /* ... */ }
export interface <GameId>Core {
    players: Record<PlayerId, PlayerState>;
    turnNumber: number;
    gameResult?: { winner?: string; draw?: boolean };
}
```

**commands.ts** — 命令类型：
```ts
import type { Command } from '../../../engine/types';
export const XX_COMMANDS = { DO_SOMETHING: 'DO_SOMETHING', ... } as const;
export interface DoSomethingCommand extends Command<'DO_SOMETHING'> { payload: { ... }; }
export type <GameId>Command = DoSomethingCommand | ...;
```

**events.ts** — 事件类型：
```ts
import type { GameEvent } from '../../../engine/types';
export const XX_EVENTS = { SOMETHING_DONE: 'SOMETHING_DONE', ... } as const;
export interface SomethingDoneEvent extends GameEvent<'SOMETHING_DONE'> { payload: { ... }; }
export type <GameId>Event = SomethingDoneEvent | ...;
```

**types.ts** — re-export barrel：
```ts
export * from './core-types';
export * from './commands';
export * from './events';
```

### 1.4 domain/ids.ts（领域 ID 常量表）

所有稳定 ID 必须在此定义，禁止字符串字面量。

### 1.5 domain/index.ts（领域内核占位）

```ts
import type { DomainCore, PlayerId, RandomFn, GameOverResult } from '../../../engine/types';
import type { <GameId>Core } from './types';

export const <GameId>Domain: DomainCore<<GameId>Core> = {
    gameId: '<gameId>',
    setup: (playerIds: PlayerId[], random: RandomFn): <GameId>Core => ({
        // 最小初始状态
        players: Object.fromEntries(playerIds.map(pid => [pid, createPlayerState(pid)])),
        turnNumber: 1,
        // ...其他必要字段
    }),
    validate: (state, command) => ({ valid: true }),  // 占位
    execute: (state, command, random) => [],            // 占位
    reduce: (core, event) => core,                     // 占位
    isGameOver: (core) => core.gameResult,
};
```

### 1.6 game.ts（引擎适配器占位）

```ts
import { createGameEngine, createBaseSystems, createFlowSystem } from '../../engine';
import { <GameId>Domain } from './domain';
import type { <GameId>Core } from './domain/types';

// FlowHooks 占位（阶段 4 实现）
const flowHooks = {
    initialPhase: '<firstPhase>',
    getNextPhase: () => '<firstPhase>',
    getActivePlayerId: ({ state }) => Object.keys(state.core.players)[0],
};

const systems = [
    createFlowSystem<<GameId>Core>({ hooks: flowHooks }),
    ...createBaseSystems<<GameId>Core>(),
];

export const <GameId> = createGameEngine<<GameId>Core>({
    domain: <GameId>Domain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: [],  // 阶段 4 填充
});

export default <GameId>;
```

### 1.7 Board.tsx（最小占位）

```tsx
import React from 'react';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type { <GameId>Core } from './domain/types';

type Props = GameBoardProps<<GameId>Core>;

const <GameId>Board: React.FC<Props> = ({ G, playerID }) => {
    return <div className="p-4 text-white">
        <h1>{'<gameId> - 骨架占位'}</h1>
        <p>当前玩家：{playerID ?? 'observer'}</p>
        <pre>{JSON.stringify(G.core, null, 2)}</pre>
    </div>;
};

export default <GameId>Board;
```

### 1.8 其他占位文件

- **thumbnail.tsx**：使用 `ManifestGameThumbnail` 组件
- **tutorial.ts**：导出空 `TutorialManifest`（`{ id: '<gameId>-basic', steps: [] }`）
- **audio.config.ts**：导出空 `GameAudioConfig`
- **__tests__/smoke.test.ts**：验证 domain.setup 不报错

### 1.9 资源目录

```
public/assets/<gameId>/
  thumbnails/.gitkeep
  images/.gitkeep
```

### 1.10 i18n 文件

创建 `public/locales/zh-CN/game-<gameId>.json` 和 `public/locales/en/game-<gameId>.json`，包含 title/description/players。

### 验收

```bash
npm run generate:manifests    # 成功生成清单
npx vitest run src/games/<gameId>  # 冒烟测试通过
npm run dev                   # 编译无报错（游戏可在大厅列表看到）
```

---

## 阶段 1.5：机制分解与数据结构设计（强制前置）

**目标**：在录入数据前，先将游戏机制分解为引擎原语组合，设计面向百游戏的通用数据结构，避免后期重构。

### 1.5.1 机制分解与引擎原语映射（强制）

> **核心原则：面向百游戏设计，不依赖现有游戏的具体实现。**

将新游戏的核心机制分解为引擎原语的组合：

| 机制类别 | 游戏中的表现 | 引擎原语映射 | 是否需要扩展 |
|---------|------------|------------|------------|
| **随机性** | 骰子/抽牌/洗牌 | `dice.ts` / `zones.ts` | ? |
| **资源管理** | 魔力/行动点/金币 | `resources.ts` | ? |
| **状态效果** | buff/debuff/标记 | `tags.ts` (层数/持续时间/层级匹配) | ? |
| **数值修改** | 攻击力加成/伤害减免 | `modifier.ts` (flat/percent/priority) | ? |
| **动态属性** | 可被 buff 修改的属性 | `attribute.ts` (base + modifiers) | ? |
| **能力系统** | 技能/被动/光环 | `ability.ts` (注册/查找/执行器) | ? |
| **目标选择** | 选择敌人/友军/格子 | `target.ts` | ? |
| **条件判断** | 触发条件/激活条件 | `condition.ts` + `expression.ts` | ? |
| **效果执行** | 伤害/治疗/移动/抽牌 | `effects.ts` | ? |
| **空间关系** | 棋盘/网格/区域 | `zones.ts` (grid/stack/hand) | ? |
| **伤害计算** | 伤害修正/防御/护甲 | `damageCalculation.ts` | ? |

**输出产物**：
1. **引擎原语组合方案**：列出需要使用的 primitives 及其组合方式
2. **缺口清单**：列出现有 primitives 无法覆盖的机制（需新增或扩展）
3. **复用策略**：哪些机制可以直接用现有 primitives，哪些需要游戏层封装

### 1.5.2 数据结构设计（强制）

> **核心原则：数据结构必须支持未来扩展，面向百游戏设计，禁止"先录入再重构"。**

在录入具体数据前，先设计通用数据结构：

#### 实体类型分析

列出游戏中的所有实体类型（如卡牌/单位/骰子/资源/状态），对每种实体类型回答：

1. **领域语义**：该实体在游戏规则中的核心作用（如"单位=可移动可攻击的棋子"）
2. **共性字段**：所有该类实体都有的字段（如 id/name/cost）
3. **变体字段**：部分实体有的字段（如 attack/defense/range）
4. **扩展性需求**：未来可能新增的字段（如 rarity/tags/keywords）
5. **引用关系**：该实体引用哪些其他实体（如卡牌引用技能）
6. **引擎原语映射**：该实体的哪些属性应该用引擎原语表达（如 hp 用 `resources.ts`，buff 用 `tags.ts`）

#### 数据结构设计模板

```ts
// ❌ 错误示例：字段不完整，未来需要重构
interface Card {
    id: string;
    name: string;
    cost: number;
}

// ✅ 正确示例：考虑扩展性，字段完整，面向百游戏
interface Card {
    id: string;
    name: string;
    type: 'action' | 'unit' | 'event';  // 类型区分（必须）
    cost: number;  // 费用（若游戏有资源系统）
    
    // 可选字段（根据游戏机制决定）
    rarity?: 'common' | 'rare' | 'epic';  // 稀有度
    tags?: string[];  // 标签（如 'magic' | 'melee'）
    abilities?: string[];  // 技能 ID 引用（不嵌套对象）
    effects?: Effect[];  // 效果定义（结构化）
    
    // 触发条件（若有）
    trigger?: {
        phase?: GamePhase;  // 触发阶段
        event?: string;  // 触发事件
        condition?: Condition;  // 触发条件
    };
    
    // 使用限制（若有）
    usageLimit?: {
        perTurn?: number;  // 每回合次数
        perGame?: number;  // 每局次数
        cooldown?: number;  // 冷却回合
    };
    
    // 目标选择（若有）
    targeting?: {
        type: 'self' | 'opponent' | 'any_unit' | 'any_cell';
        filter?: Condition;  // 目标过滤条件
        count?: number | 'all';  // 目标数量
    };
}
```

#### 数据驱动反模式清单（强制）

在设计数据结构时，必须避免以下反模式：

| 反模式 | 错误示例 | 正确做法 | 为什么错误 |
|--------|---------|---------|-----------|
| **硬编码技能逻辑** | `validate()` 中 `switch (abilityId)` 每个技能一个 case | 技能定义包含 `validation` 配置，使用通用验证函数 | 第 100 个游戏会有 10000 行 switch |
| **UI 状态混入 core** | `core.lastPlayedCard`（纯展示） | 通过 EventStream 传递给 UI | core 应该只包含规则判定需要的数据 |
| **交互状态混入 core** | `core.pendingAttack`（等待输入） | 使用 `sys.interaction` | 交互状态是系统层职责，不是领域层 |
| **缺少目标字段** | `grantStatus: { statusId, value }` + 执行层猜测目标 | `grantStatus: { statusId, value, target: 'opponent' }` | 数据不完整导致执行层需要"猜测" |
| **缺少触发条件** | 技能只有效果描述，触发条件在代码里硬编码 | 技能定义包含 `trigger: { phase, event }` | 触发逻辑应该数据驱动，不是代码驱动 |
| **缺少使用限制** | 技能只有费用，没有"每回合一次"等限制 | 技能定义包含 `usageLimit: { perTurn: 1 }` | 限制规则应该在数据中声明 |
| **对象嵌套引用** | `card.abilities: Ability[]`（嵌套对象） | `card.abilities: string[]`（ID 引用） | 嵌套导致数据冗余和更新不一致 |
| **散落的状态字段** | `unit.stunned`, `unit.poisoned`, `unit.buffed` | `unit.tags: TagContainer` | 第 100 个游戏会有 100 种状态字段 |
| **ad-hoc 修正字段** | `unit.attackBonus`, `unit.defenseBonus` | `unit.attack: Attribute` (base + modifiers) | 修正逻辑应该用 modifier 系统 |

#### 数据完整性自检清单（强制）

设计完数据结构后，逐项检查：

- [ ] 所有实体类型都有唯一 ID 字段（`id: string`）
- [ ] 所有实体类型都有类型区分字段（`type: 'xxx'`）
- [ ] 所有引用关系都是 ID 引用，不是对象嵌套
- [ ] 所有"可能被 buff 修改"的数值都映射到 `Attribute` 或 `resources.ts`
- [ ] 所有"需要玩家选择"的操作都有目标选择规则（`targeting` 字段）
- [ ] 所有"有使用限制"的能力都有限制字段（`usageLimit`）
- [ ] 所有"有触发条件"的效果都有触发规则（`trigger` 字段）
- [ ] 所有状态效果都映射到 `TagContainer`，不是散落的布尔字段
- [ ] 所有数值修改都映射到 `modifier.ts`，不是 ad-hoc 的 `xxxBonus` 字段

### 1.5.3 引擎能力缺口分析（强制）

对照 `src/engine/primitives/` 和 `src/engine/systems/`，列出：

1. **可直接复用**：已有的 primitives/systems 可以直接使用
2. **需要扩展**：已有的 primitives/systems 需要增加新功能
3. **需要新增**：完全没有的能力，需要新建 primitive/system

**输出产物**：
- 引擎能力缺口清单（Markdown 表格）
- 每个缺口的优先级（P0 阻塞 / P1 重要 / P2 可延后）
- 每个缺口的预计实现阶段（阶段 3 / 阶段 4 / 阶段 6）

### 1.5.4 面向百游戏的设计检查（强制）

> **核心问题：如果未来有 100 个游戏，这个设计会不会导致代码爆炸？**

对每个设计决策，问自己：

1. **如果有 100 个游戏，每个游戏都这样做，会发生什么？**
   - ❌ 每个游戏在 `validate()` 中加 100 行 switch → 10000 行 switch
   - ✅ 每个游戏在数据中声明验证规则 → 数据驱动，代码不增长

2. **这个字段/逻辑是游戏特有的，还是可以抽象为通用能力？**
   - ❌ `core.diceThroneSpecificField` → 只有一个游戏用
   - ✅ `core.resources: ResourceContainer` → 所有游戏都能用

3. **这个实现是否依赖"已有游戏的具体实现"？**
   - ❌ "参考 DiceThrone 的 `CombatAbilityManager`" → 耦合具体游戏
   - ✅ "使用 `engine/primitives/ability.ts`" → 依赖通用抽象

4. **如果规则变化，需要改多少地方？**
   - ❌ 改技能触发条件需要改 validate/execute/UI 三处 → 散落逻辑
   - ✅ 只改技能定义的 `trigger` 字段 → 单一数据源

### 验收

- 机制分解表已完成，引擎原语映射明确
- 数据结构设计已完成，通过完整性自检清单
- 引擎能力缺口清单已输出，优先级明确
- 面向百游戏的设计检查已通过（无"代码爆炸"风险）
- 用户确认数据结构设计合理，可以开始录入

---

## 阶段 2：数据录入（规则文档 + 游戏数据 + 类型定义）

**目标**：完成规则文档录入、静态游戏数据录入、核心类型定义，不写业务逻辑。需要新增引擎原语的部分可标记延后。

### 2.0 数据缺失处理规范（强制）

> **核心原则：不猜测、不编造、不跳过。缺什么问什么，问清楚再录。**

1. **规则文档不完整或有歧义时**：
   - 列出具体缺失/歧义项（如"火球术的伤害是3还是3+骰子数？规则书第X页描述模糊"）
   - 回问用户确认，不自行推断
   - 若用户暂时无法确认，标记 `// TODO: 待确认 — <具体问题>`，不填默认值

2. **数据量大、用户只提供了部分时**：
   - 先录入已有数据，每批录入后输出 Markdown 核对表（实体名/关键属性/数量）
   - 明确告知用户"已录入 X 条，还缺 Y 条"，列出缺失清单
   - 用户补充后继续录入，不等全部数据到齐才开始（已有数据先落地）

3. **素材数据核对（强制，遵循 AGENTS.md）**：
   - 根据图片/规则书提取数据时，必须全口径核对、逻辑序列化
   - 关键限定词显式核对（如"每回合一次"vs"每场一次"、"相邻"vs"同行"）
   - 输出 Markdown 表格作为核对契约，用户确认后才算录入完成

4. **需要新增引擎原语的数据**：
   - 若某些游戏机制在 `src/engine/primitives/` 中没有现成实现
   - 先在数据层标记 `// DEFERRED: 需新增引擎原语 <xxx>，暂用占位`
   - 记录到阶段验收的"延后清单"中，在阶段3或阶段4补充实现
   - 不因缺少原语而阻塞整个数据录入流程
5. **对照源主动确认（强制）**：
   - 如果用户同时给了 Wiki、官网、数据库或自整理网站，必须主动问“要不要把它作为对照源一起比？”。
   - 对照源只用于发现冲突和补足索引，不得默认覆盖主真相源。
   - 对照结果必须写进 Markdown 对照表，不允许只在对话里口头比较。

### 2.1 录入规则文档

将规则书/规则图片内容结构化录入 `src/games/<gameId>/rule/` 下的 Markdown 文件，拆解为：

1. **阶段流程**：回合结构、阶段顺序、阶段间切换条件
2. **核心实体**：卡牌/单位/骰子/资源的类型与属性
3. **操作类型**：玩家可执行的命令（如出牌/移动/攻击/弃牌）
4. **结算规则**：积分/伤害/胜利条件
5. **特殊机制**：如 faction 选择、deck building、技能触发

**规则文档质量要求**：
- 每条规则必须可追溯到规则书原文位置（页码/章节）
- 数值必须精确（"3点伤害"而非"一些伤害"）
- 条件触发必须完整（触发时机 + 触发条件 + 效果 + 持续时间）

### 2.2 录入游戏静态数据

根据规则文档，将所有实体数据录入代码。**不只是名称+描述，必须录入影响游戏机制的全部必要信息**。

#### "必要信息"判断原则（强制）

> 未来的游戏机制不可预知，不预设具体字段清单。用以下原则判断一条信息是否必须录入：

1. **规则判定依赖**：如果 `validate()` / `execute()` / `reduce()` / `isGameOver()` 需要读取该信息来做决策，则必须录入。
   - 例：攻击力、生命值、费用、射程、触发条件、效果数值、冷却回合、使用限制
2. **状态区分依赖**：如果该信息用于区分不同实体的行为差异，则必须录入。
   - 例：近战vs远程、一次性vs持续、主动vs被动、阵营归属
3. **UI 渲染依赖**：如果界面需要该信息来正确展示实体，则必须录入。
   - 例：精灵图索引/图集坐标、素材文件引用、牌背符号、中英文名称
4. **引用关系依赖**：如果该信息建立实体间的引用链（A拥有B、A触发B），则必须录入。
   - 例：技能ID列表、效果引用、目标选择规则
5. **数量/分布依赖**：如果该信息影响游戏的随机性或资源分配，则必须录入。
   - 例：牌组中的数量、骰面分布、初始资源

**反面判断——可以不录入的**：
- 纯风味文本（不影响任何规则判定的背景故事）
- 可从其他已录入数据推导出的冗余信息
- 仅在开发调试时使用、不进入生产的临时标记

#### 录入完整性自检（逐字段，强制）

> **核心问题：素材/规则书上的每一条信息，是否都已在代码中有对应字段？**
> AI 容易漏录"不好结构化"的信息（如图标表示的触发条件、符号表示的骰面组合）。必须逐项核对，不能只录"好录的"。

每录入一个实体类型，执行以下自检：

1. **素材全信息提取**：将素材（卡牌图片/规则书条目）上的所有可见信息逐条列出，包括：
   - 文字信息（名称、描述、数值）
   - 图标/符号信息（骰面图标、元素符号、阵营标记）→ 必须转化为结构化数据
   - 位置/布局隐含信息（卡牌分区暗示的阶段归属、颜色暗示的稀有度）
2. **逐条比对**：将提取的信息列表与已定义的 TypeScript 字段逐条比对，确认每条信息都有对应字段承接
3. **缺字段立即补**：发现素材上有信息但代码中无对应字段 → 补字段，不跳过
4. **引用完整性**：该实体引用的其他实体 ID 是否都已定义？（断链 → 补或标记 TODO）

**典型漏录场景（警示）**：
- ❌ 技能卡只录了名称+效果描述，漏了触发骰面组合 → `validate()` 无法判断触发条件
- ❌ 单位卡只录了攻击力+生命值，漏了移动范围 → 棋盘交互无法校验合法移动
- ❌ 卡牌只录了效果文本，漏了费用/冷却 → 资源消耗逻辑无数据源

#### 目录结构选择

按游戏复杂度选择合适的数据组织方式：

**简单游戏**：直接在 domain 中定义。

**中等游戏**：
```
data/
  cards.ts           # 实体定义与查询函数
  factions/          # 按分组组织数据
```

**复杂游戏**：
```
config/ 或 heroes/   # 按实体大类拆分
  factions/          # 按阵营/角色进一步拆分
```

具体目录名和文件拆分方式由游戏的实体结构决定，不预设。

#### 录入流程

1. 按实体类别分批录入（如先录基础实体，再录依赖它们的复合实体）
2. 每批录入后输出核对表，**核对表的列必须覆盖该实体类型的所有必要字段，不只是名称**
   - 列的选择依据：上述"必要信息判断原则"中命中的字段
   - 数值字段直接列出数值，引用字段列出引用目标，布尔/枚举字段列出取值
   - 最后一列标注录入状态（✅ 已录入 / ❌ 缺数据 / ⚠️ 待确认）
3. 用户确认核对表后，该批数据视为"已验收"
4. 所有稳定 ID 录入 `domain/ids.ts`（`as const`），禁止字符串字面量
5. **全量数据确认（阶段门禁）**：所有批次录入完成后，输出一份汇总清单，包含：
   - 各实体类别的数量统计（如"单位 24 张、技能 18 个、事件 12 种"）
   - 仍有 `TODO: 待确认` 的条目列表
   - 标记 `DEFERRED` 的引擎原语需求列表
   - 用户明确回复"确认"后才可进入阶段 3，否则继续补充

### 2.3 完善类型定义

根据录入的数据，补充 domain/types.ts（或拆分文件）：
- 完整的 `PlayerState`（根据游戏需要的状态字段）
  - **状态效果建议用 `TagContainer` 表达**（`engine/primitives/tags.ts`），避免散落的 `statusEffects: Record<string, number>` / `tempAbilities: string[]`
- 完整的 `<GameId>Core`（玩家状态/回合信息/游戏特有状态等）
- 所有命令类型（`XX_COMMANDS` 常量对象）
- 所有事件类型（`XX_EVENTS` 常量对象）
- 实体定义的 TypeScript 接口

### 2.4 检查系统需求与引擎原语选型

对照规则，在引擎层检索可复用实现：
- 骰子 → `src/engine/primitives/dice.ts`
- 资源（消耗品）→ `src/engine/primitives/resources.ts`
- 状态/buff/debuff（层数/持续时间/净化/层级匹配）→ `src/engine/primitives/tags.ts`
- 数值修改管线（flat/percent/override/compute + priority）→ `src/engine/primitives/modifier.ts`
- 可被 buff 修改的属性（base + modifier → current）→ `src/engine/primitives/attribute.ts`
- 能力系统骨架（注册/查找/执行器分发/可用性检查）→ `src/engine/primitives/ability.ts`
- 卡牌/区域 → `src/engine/primitives/zones.ts`
- 条件/表达式 → `src/engine/primitives/condition.ts` + `expression.ts`
- 目标解析 → `src/engine/primitives/target.ts`
- 效果执行 → `src/engine/primitives/effects.ts`

**强制要求（新游戏）**：
- 禁止自行实现 statusEffects / tempAbilities / DamageModifier / PowerModifierFn / abilityRegistry；必须复用上述 primitives（详见 `AGENTS.md` 与 `docs/ai-rules/engine-systems.md`）。

**若缺口存在**：优先补充 `src/engine/primitives/`（通用工具函数）；领域语义放在游戏层（`src/games/<gameId>/domain/`）。若工作量大，记入延后清单，在后续阶段补充。

### 2.5 领域建模前置审查（强制门禁）

> 完整规范见 `docs/ai-rules/engine-systems.md`「领域建模前置审查」节。
> 核心原则：**规则文本 → 领域模型 → 实现**，禁止跳过建模直接写实现。

1. **领域概念建模**：为每个规则术语定义精确语义边界和事件映射（如"影响"= 哪些具体事件）。
2. **决策点识别**：标记所有需要玩家选择的点（强制/可选/无），评估引擎是否支持该交互模式。
3. **引擎能力缺口分析**：建模产出与引擎能力逐一比对，列出缺口和扩展计划。

产出：术语→事件映射表 + 决策点清单 + 引擎缺口清单。

### 验收

- 规则文档完整录入 `rule/*.md`，覆盖所有阶段/实体/操作/结算/特殊机制
- 静态数据全部录入代码，核对表已获用户确认
- types.ts 中所有类型能覆盖规则文档描述的实体
- ids.ts 常量表覆盖所有稳定 ID
- 数据文件可正常导入，无循环依赖
- 冒烟测试仍通过
- **领域建模审查已完成**（术语映射表/决策点清单/引擎缺口清单）
- **延后清单**（若有）：列出需要新增引擎原语的项目及预计补充阶段

---

## 阶段 3：领域内核实现（Command → Event → Reduce）

## 旧浏览器兼容门禁（新游戏强制）

新游戏默认遵循这条原则：**能继续兼容就继续兼容，真缺关键能力才提示**。

1. 禁止按浏览器版本号硬拦
   - 版本号只能作为经验参考，不得直接作为 `/play/:gameId/*` 的拦截条件。
   - 旧版本只要关键能力仍然齐全，就必须允许进入并继续游玩。
2. 可降级能力优先做 fallback
   - `matchMedia`、监听 API 差异（`addEventListener('change')` vs `addListener`）这类能力，优先在通用工具层或游戏层补 fallback。
   - 只有在确认没有安全 fallback、且缺失后会破坏核心游玩时，才允许升级成兼容门禁。
3. 门禁必须按游戏/页面精确收敛
   - 不要把某个游戏需要的浏览器能力写成所有 `/play/*` 的统一硬门槛。
   - 若某项能力只影响特定游戏或特定 dev 页面，门禁必须按 `gameId` 或页面前缀精确判断。
4. `ResizeObserver` 视为高风险能力，但不是全站默认门槛
   - 只有当该游戏的核心游玩布局确实依赖 `ResizeObserver`，且缺失后会导致棋盘/地图/主操作区明显错位或不可操作时，才允许把它加入该游戏的拦截条件。
   - 教程浮层、关于页特效、UGC 编辑器这类外围能力，不得外扩成所有游戏的游玩门槛。

**目标**：完成确定性核心逻辑，测试通过。

### 3.1 实现 validate（命令校验）

```ts
// domain/commands.ts 或 domain/validate.ts
export function validate(state: MatchState<Core>, command: Command): ValidationResult {
    // 1. 检查是否是当前玩家的回合
    // 2. 检查当前阶段是否允许此命令
    // 3. 检查命令参数合法性
    // 4. 检查资源/条件是否满足
}
```

**三个游戏共同模式**：
- dicethrone: `domain/commands.ts` → `validateCommand()`
- summonerwars: `domain/validate.ts` → `validateCommand()`
- smashup: `domain/commands.ts` → `validate()`

### 3.2 实现 execute（生成事件）

```ts
// domain/execute.ts 或 domain/reducer.ts
export function execute(state: MatchState<Core>, command: Command, random?: RandomFn): GameEvent[] {
    // 根据 command.type 分发处理
    // 返回一系列事件（不直接修改状态）
}
```

### 3.3 实现 reduce（应用事件到状态）

```ts
// domain/reducer.ts
export function reduce(core: Core, event: GameEvent): Core {
    switch (event.type) {
        case 'DAMAGE_DEALT': {
            // ✅ 结构共享：只 spread 变更路径
            const { targetId, amount } = event.payload;
            const target = core.players[targetId];
            if (!target) return core;
            return {
                ...core,
                players: {
                    ...core.players,
                    [targetId]: { ...target, hp: Math.max(0, target.hp - amount) },
                },
            };
        }
        // 每种事件类型一个 case
        default: return core;
    }
}
```

**关键约束**：
- reduce 必须是纯函数，不依赖随机数。
- **禁止 `JSON.parse(JSON.stringify())`**（性能灾难）。只 spread 变更路径，未变路径保持原引用。
- 嵌套超过 3 层时提取 `updatePlayer()` 等 helper 到 `domain/utils.ts`。
- 详见 `docs/ai-rules/engine-systems.md`「Reducer 结构共享范例」。

### 3.4 实现 isGameOver

```ts
isGameOver: (core): GameOverResult | undefined => {
    // 检查胜利条件
    // 返回 { winner: playerId } 或 { draw: true } 或 undefined
}
```

### 3.5 补充单元测试

在 `__tests__/` 创建测试文件，覆盖：
- 正常流程（happy path）
- 非法操作被拒绝
- 边界条件
- 胜利条件判定

**测试辅助模式**（参考 smashup/__tests__/helpers.ts）：
```ts
export function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState { ... }
export function makeState(overrides?: Partial<Core>): Core { ... }
export function makeMatchState(core: Core): MatchState<Core> { ... }
```

### 验收

```bash
npx vitest run src/games/<gameId>  # 所有测试通过
```

核心规则正常 + 异常场景有覆盖。

---

## 阶段 4：FlowSystem 与系统组装

**目标**：接入 FlowSystem 完成阶段流转，`game.ts` 组装完毕。

### 4.1 实现 FlowHooks

创建 `domain/flowHooks.ts`（参考 summonerwars/domain/flowHooks.ts）：

```ts
import type { FlowHooks, PhaseExitResult } from '../../../engine/systems/FlowSystem';

export const flowHooks: FlowHooks<Core> = {
    // 初始阶段（通常为 factionSelect 或第一个游戏阶段）
    initialPhase: 'factionSelect',

    // 是否允许推进
    canAdvance: ({ state }) => ({ ok: true }),

    // 下一阶段计算
    getNextPhase: ({ state, from }) => {
        const idx = PHASE_ORDER.indexOf(from as GamePhase);
        return PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
    },

    // 当前活跃玩家
    getActivePlayerId: ({ state }) => state.core.currentPlayer,

    // 阶段退出副作用（如：抽牌/切换回合/结算伤害）
    onPhaseExit: ({ state, from }): PhaseExitResult => {
        const events: GameEvent[] = [];
        // 按阶段处理副作用
        return { events };
    },

    // 阶段进入副作用（如：回合开始事件/状态重置）
    onPhaseEnter: ({ state, from, to }): GameEvent[] => {
        const events: GameEvent[] = [];
        // 按阶段处理副作用
        return events;
    },

    // 自动推进检查（如：非交互阶段自动跳过）
    onAutoContinueCheck: ({ state, events }) => {
        // 如 startTurn/endTurn 等纯自动阶段
        return undefined;
    },
};
```

**三个游戏的 FlowHooks 复杂度对比**：
- smashup: `domain/index.ts` 内联（~150 行），阶段退出处理记分逻辑
- summonerwars: 独立 `domain/flowHooks.ts`（~250 行），阶段进退处理抽牌/换人/技能触发
- dicethrone: `game.ts` 内联（~500 行），最复杂，攻防阶段有大量分支

### 4.2 完善 game.ts

```ts
// 系统选择模式（三个游戏共同模式）
const systems = [
    createFlowSystem<Core>({ hooks: flowHooks }),
    // 方式 A：逐个选择（dicethrone/summonerwars 风格，精细控制）
    createEventStreamSystem(),
    createLogSystem(),
    createActionLogSystem({ commandAllowlist: ACTION_ALLOWLIST, formatEntry }),
    createUndoSystem({ snapshotCommandAllowlist: UNDO_ALLOWLIST }),
    createInteractionSystem(),
    createRematchSystem(),
    createResponseWindowSystem({  // 需要响应窗口时配置注入
        allowedCommands: ['PLAY_CARD'],  // 响应期间允许的游戏命令
        responseAdvanceEvents: [         // 触发响应者推进的事件
            { eventType: 'CARD_PLAYED' },
        ],
        // interactionLock: { ... },     // 多步交互锁定（可选）
    }),
    createTutorialSystem(),
    createCheatSystem<Core>(cheatModifier),

    // 方式 B：默认集合（smashup 风格，简洁）
    // ...createBaseSystems<Core>(),
    // createCheatSystem<Core>(cheatModifier),
];

// 命令类型（只列业务命令，系统命令由 adapter 自动合并）
const commandTypes = [
    ...Object.values(XX_COMMANDS),
];
```

### 4.3 实现 CheatModifier（开发调试必备）

参考 summonerwars/game.ts 的 `summonerWarsCheatModifier`，至少实现：
- `getResource` / `setResource`
- `setPhase`
- `dealCardByIndex`（如有牌库）

### 4.4 ActionLog + 卡牌预览（避免重复说明，按权威实现做）

**强制先读（权威单一来源）**：
- `docs/ai-rules/engine-systems.md`（ActionLogSystem 使用规范）
- `evidence/dicethrone/action-log-card-preview.md`（卡牌预览注册表模式 + 数据流说明）

**你在新游戏里只需要做这些（最小闭环）**：
1. 在 `game.ts` 配置 `createActionLogSystem({ commandAllowlist, formatEntry })`，`formatEntry` 产出包含 `segments` 的 `ActionLogEntry`。
2. 若游戏有卡牌：实现 `ui/cardPreviewHelper.ts` 提供 `cardId → CardPreviewRef` 查询，并在 `game.ts` **文件末尾**调用 `registerCardPreviewGetter(gameId, getter)` 注册。

> 关键点：Vite SSR 的函数提升陷阱与“注册必须放文件末尾”的原因，详见 `AGENTS.md` / `docs/ai-rules/golden-rules.md`。

### 4.5 补充 FlowHooks 测试

```bash
npx vitest run src/games/<gameId>/__tests__/flow.test.ts
```

### 验收

```bash
npm run generate:manifests   # 清单生成成功
npx vitest run src/games/<gameId>  # 所有测试通过
npm run dev                  # 游戏可从大厅创建对局，基础回合可推进
```

---

## 阶段 5：Board/UI 与交互闭环

**目标**：提供最小可玩 UI，完成交互闭环。

### 5.0 UI 设计规范生成（强制前置）

**强制先读（权威单一来源）**：
- `docs/ai-rules/ui-ux.md`
- 若涉及动画/特效：`docs/ai-rules/animation-effects.md`
- 若出现白屏/渲染错误/函数未定义：`docs/ai-rules/golden-rules.md`

> 每个游戏的视觉风格各不相同，**禁止直接复用已有游戏的样式规范**。必须为新游戏生成独立的设计规范。

1. **执行 ui-ux-pro-max `--design-system`**：根据新游戏的类型、题材、美术风格生成专属设计系统：
   ```bash
   python3 skills/ui-ux-pro-max/scripts/search.py "<游戏类型> <题材> <风格关键词>" --design-system --persist -p "<游戏名>" --page "game-board"
   ```
2. **产出保存到 `design-system/games/<gameId>.md`**：作为该游戏的 UI 权威参考，后续 Board/组件开发以此为准。
3. **与通用规范的关系**：`design-system/game-ui/MASTER.md` 中的交互原则（反馈/状态清晰/动画时长等）仍然适用，但配色/字体/视觉风格以游戏专属规范为准。

### 5.1 Board.tsx 主组件

**三个游戏的 Board 共同模式**：

```tsx
const Board: React.FC<Props> = ({ G, moves, playerID, ctx }) => {
    const core = G.core;
    const phase = G.sys.phase;
    const gameMode = useGameMode();
    const { t } = useTranslation('game-<gameId>');

    // 1. 基础状态
    const isGameOver = ctx.gameover;
    const isMyTurn = playerID === core.currentPlayer;

    // 2. 教学系统集成
    useTutorialBridge(G.sys.tutorial, moves as Record<string, unknown>);
    const { isActive: isTutorialActive, currentStep: tutorialStep } = useTutorial();

    // 3. 音效系统
    useGameAudio({ config: AUDIO_CONFIG, gameId: MANIFEST.id, G: core, ctx: { ... } });

    // 4. 事件消费 → 动画驱动
    const gameEvents = useGameEvents({ G, myPlayerId: playerID || '0' });

    // 5. 阵营/角色选择阶段
    if (isInSelectionPhase) {
        return <FactionSelection ... />;
    }

    // 6. 游戏主 UI
    return (
        <div className="...">
            {/* 棋盘/基地/卡牌区域 */}
            {/* 手牌区 */}
            {/* 阶段指示/操作按钮 */}
            {/* 结算覆盖层 */}
            {isGameOver && <EndgameOverlay ... />}
        </div>
    );
};
```

### 5.2 UI 子模块拆分

当 Board.tsx 超过 300 行时，按职责拆分到 `ui/` 目录：

**参考 summonerwars/ui/**：
- `BoardGrid.tsx` — 棋盘网格渲染
- `HandArea.tsx` — 手牌区
- `PhaseTracker.tsx` — 阶段指示器
- `PlayerInfo.tsx` — 玩家信息面板
- `GameButton.tsx` — 游戏操作按钮
- `useGameEvents.ts` — 事件消费 hook
- `useCellInteraction.ts` — 格子交互 hook
- `BoardEffects.tsx` — 特效层
- `FactionSelection.tsx` — 阵营选择 UI

**参考 smashup/ui/**：
- `HandArea.tsx` — 手牌区
- `FactionSelection.tsx` — 派系选择
- `PromptOverlay.tsx` — 提示覆盖层
- `useGameEvents.ts` — 事件消费
- `BoardEffects.tsx` — 特效层

### 5.3 交互映射

所有用户操作通过 `moves[COMMAND_TYPE](payload)` 触发：
- 点击/拖拽 → Command
- Board 不直接改 core

### 5.4 阵营/角色选择

**三个游戏共同模式**：初始阶段是 `factionSelect`/`setup`，通过 FlowHooks 的 `onAutoContinueCheck` 在所有玩家准备后自动推进到游戏阶段。

UI 侧使用 `TutorialSelectionGate`（框架组件）或自定义选择组件。

### 验收

- 核心操作可在 UI 中完成
- 阶段推进正常
- 结束界面正常显示

---

## 阶段 6：收尾与启用

**目标**：补齐 i18n、测试、教学、音效。

### 6.1 i18n 文案

补齐 `public/locales/{zh-CN,en}/game-<gameId>.json` 中的所有文案：
- 阶段名称
- 命令/事件描述
- UI 文本
- 教学步骤文案

### 6.2 教学配置

参考 smashup/tutorial.ts 的模式：
1. setup 步骤：AI 自动完成选角 + 作弊设置手牌
2. UI 介绍步骤：逐个高亮 UI 元素（`highlightTarget` + `blockedCommands`）
3. 操作教学步骤：`requireAction: true` + `allowedCommands` + `advanceOnEvents`

### 6.3 音频配置（已重构，避免重复造轮子）

**强制先读**（权威单一来源，避免本文档过时）：
- `AGENTS.md`「音频资源架构（强制）」
- `docs/ai-rules/asset-pipeline.md`「🔊 音频资源规范」
- `docs/audio/audio-usage.md`（新增音频资产流程见 `docs/audio/add-audio.md`）

**你在新游戏里只需要做这些（最小闭环）**：
1. 创建 `src/games/<gameId>/audio.config.ts`，导出 `GameAudioConfig`：
   - `feedbackResolver(event): SoundKey | null`：无动画事件返回 SoundKey；有动画事件返回 `null`，音效交给动画层 `onImpact()` 播放
   - `criticalSounds`：进入游戏后立即预加载的高频音效 key（建议 5~15）
   - （可选）`contextualPreloadKeys`：根据上下文增量预热
   - BGM 列表按现有游戏格式配置（具体规则以 `docs/audio/audio-usage.md` 为准）
2. **音效 key 的唯一来源**：`public/assets/common/audio/registry.json`。
   - 禁止在游戏层声明 `basePath/sounds`
   - 禁止手写 `compressed/`
   - 禁止定义短 key（如 `click/dice_roll`），必须使用 registry 的完整 key
3. **避免重复播放**：同一动作只能走一条路径（`feedbackResolver` / FX `FeedbackPack` / 动画 `onImpact` / UI `GameButton` / `playDeniedSound()`）。

> 参考实现：`src/games/smashup/audio.config.ts` / `src/games/summonerwars/audio.config.ts`。

### 6.4 关键图片预加载（若游戏有精灵图/图集）

**强制先读（权威单一来源）**：
- `docs/ai-rules/asset-pipeline.md`（critical/warm 规则、路径格式、门禁与验收清单）

**你在新游戏里只需要做这些（最小闭环）**：
1. 实现 `criticalImageResolver.ts`，返回 `{ critical, warm }`，并按“选择阶段 vs 游戏阶段”动态解析。
2. 在 `game.ts`（或游戏入口约定的位置）注册 resolver。

> 参考实现：`src/games/smashup/criticalImageResolver.ts` / `src/games/summonerwars/criticalImageResolver.ts` / `src/games/dicethrone/criticalImageResolver.ts`。

### 6.5 debug-config（可选）

若需要调试面板，创建 `debug-config.tsx` 提供游戏专属调试选项。

**调试面板规范**：
- 调试入口统一使用 `GameDebugPanel` 组件挂载在 Board 内，不得创建新的全局入口。
- 调试操作必须通过 `SYS_CHEAT_*` 指令（依赖 CheatSystem），禁止直接修改 core。
- 若包含“发牌/出牌”类调试：
  - **必须以精灵图索引为发牌依据**（或等价的稳定索引），保证可复现。
  - **必须提供索引对照表**（索引 → 名称/类型），支持快速查找与一键发牌。
- 面板内状态复制/赋值需校验 JSON，失败给出明确提示。
- 重要调试动作尽量提供快捷按钮（如“清零/满值/切换阶段”）。

### 6.6 资源命名与落盘（缩略图 / 图集 / 插图）

1. 若用户已给素材类型或图片位置，AI 默认负责：
   - 先读图，再判断是否属于明显随机文件名；只有这类文件才按图片内容语义自动命名（如 `cover`、`<batch>`、`<entityId>-board`）
   - 自动移动到正确目录
   - 自动运行最小必要范围的压缩命令
2. 缩略图默认流程：
   - 原图放入 `public/assets/<gameId>/thumbnails/cover.png`
   - 运行 `npm run compress:images -- public/assets/<gameId>/thumbnails`
   - `manifest.ts` 中 `thumbnailPath` 使用 `<gameId>/thumbnails/cover`
3. 图集 / 运行时图片默认流程：
   - 原图按业务语义落到 `public/assets/i18n/zh-CN/<gameId>/<category>/`
   - 图集配置落到 `public/assets/atlas-configs/<gameId>/`
   - 切片顺序、索引和命名先写合同，再接入代码
4. 若当前环境依赖远端默认资源基址：
   - 启动前主动询问是否先 `npm run assets:download -- --check`
   - 交付前必须执行 `npm run assets:check`
   - 若检查到本轮新增/变更的运行时资源远端缺失，必须继续上传并用远端 URL 复核到 `200/206`，再算交付完成

### 6.7 最终验证

```bash
npm run generate:manifests          # 清单生成成功
npx vitest run src/games/<gameId>   # 所有测试通过
npm run typecheck                   # 类型检查通过
npm run assets:check                # 若本轮新增了运行时资源，检查远端缺口
npm run assets:upload               # check 发现本轮运行时资源远端缺失时必须执行
npm run dev                         # 大厅可见、可创建对局、可完整游玩
```

### 验收

- 清单生成成功
- 所有测试通过
- 游戏可从大厅进入并完成完整游玩流程
- i18n 双语齐全
- 若本轮新增/修改了运行时资源：远端对象已上传，并已用实际远端 URL 复核可访问

---

## 系统与红线速查（只保留本 skill 的最小提醒）

**权威来源**：系统清单/红线/反模式以 `AGENTS.md` + `docs/ai-rules/engine-systems.md` 为准，本节不再重复抄写。

### 系统组装最小提醒

- `createBaseSystems()` 默认包含：EventStream + Log + ActionLog + Undo + Interaction + Rematch + ResponseWindow + Tutorial
- `createBaseSystems()` **不包含** FlowSystem / CheatSystem：需要自行追加
- `commandTypes` **只列业务命令**：系统命令由 adapter 自动合并
- ResponseWindowSystem **必须配置注入**：`allowedCommands` / `responseAdvanceEvents`（禁止改引擎文件）

### 新架构强制复用（新游戏）

- 能力系统：必须使用 `engine/primitives/ability.ts`
- 状态/buff/debuff：必须使用 `engine/primitives/tags.ts`
- 数值修改：必须使用 `engine/primitives/modifier.ts`
- 可被 buff 修改的属性：必须使用 `engine/primitives/attribute.ts`（纯资源消耗仍用 `resources.ts`）

---

## 参考资料

- 目录骨架与最小模板：references/game-skeleton.md
- 图片 / 位置驱动 intake：references/asset-intake.md
- 清单生成说明：references/manifest-generation.md
- 项目结构速览：references/project-structure.md

## 架构参考路径（仅用于理解，不照抄）

- **最复杂流程**：`src/games/dicethrone/`（角色系统/骰子/攻防/状态效果/Token响应）
- **中等复杂 + 棋盘战棋**：`src/games/summonerwars/`（网格棋盘/单位管理/阵营牌组/技能系统）
- **中等复杂 + 卡牌区控**：`src/games/smashup/`（多人支持/基地记分/派系混搭/持续效果）
- **框架层组件**：`src/components/game/framework/`
- **引擎系统**：`src/engine/systems/`
- **引擎原语**：`src/engine/primitives/`

## 缩略图配置模板（thumbnail.tsx）

```tsx
import manifest from './manifest';
import { ManifestGameThumbnail } from '../../components/lobby/thumbnails';

export default function Thumbnail() {
    return <ManifestGameThumbnail manifest={manifest} />;
}
```

- `manifest.ts` 中配置 `thumbnailPath: '<gameId>/thumbnails/cover'`（不含扩展名、不含 `compressed/`）。
- 用户提供图片后，运行 `npm run compress:images -- public/assets/<gameId>/thumbnails` 压缩。
