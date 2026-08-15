---
name: create-new-game
description: "BoardGame 新游戏创建或资源/data intake 流程。用于新增游戏、只给图片/位置先开工；按现有游戏模式分阶段推进并验收。"
---

# 创建新游戏（分阶段工作流）

## 规范来源与职责边界

- 本 skill 是 `workflow`：只承载 BoardGame 新游戏从规则/素材 intake 到骨架、实现、UI、验证的阶段流程。
- AI 规范重构不由本 skill 承担；AI 规范入口是 `.spec/knowledge/README.md`。
- 新游戏涉及产品/架构能力变更时，OpenSpec 只承担产品能力规格，不承担 AI 行为规范。
- 数据录入、资源链、UI gate、审计和 E2E 的标准正文分别回到 `.spec/knowledge/standards/data-entry.md`、`.spec/knowledge/standards/asset-pipeline.md`、`.spec/knowledge/standards/ui-change-gates.md`、`.spec/knowledge/standards/testing-audit.md`、`.spec/knowledge/standards/e2e-verification.md`。

## 新游戏第一门禁索引

> 详细红线见 `references/intake-redlines.md`；执行新游戏前必须先读该 reference。

最小执行口径：
- 阶段之间独立验收，不留 TODO 缺口。
- 阶段 0 / S0 先闭合规则对象、素材、数量对账和可执行矩阵；未闭合只拦阶段升级，不表示停工。
- Board/UI、E2E、截图、设计稿和完成宣称都不得越过 S0 门禁。
- UI 风格、Design I/O、桌面满元素截图和教程完整性按 `references/intake-redlines.md` 与对应规范执行。

## 流程边界、现场锁定与 OpenSpec

> 详细规则见 `references/workflow-boundaries.md`。进入 proposal/spec/design/tasks、申请新游戏 worktree、处理主工作区与游戏 worktree 分线、或判断是否上升总框架/百游戏模式时，先读该 reference。

最小执行口径：
- 新游戏默认建议独立 worktree；创建、切换或派生分支前必须取得用户当轮明确授权。
- 一旦选定 worktree，后续读写、验证、截图和 OpenSpec 更新都必须落在同一执行现场。
- 共享基线改动和单游戏实现必须分线收口，不能混成一次无边界提交。
- create-new-game 只管通用流程；进入具体游戏方案、布局、runtime 边界或任务拆分时，切到 OpenSpec。
- 用户要求百游戏模式时，先做抽象层级和候选消费者分析；未明确要求时默认不改总框架。
## 必读索引（单一权威来源，避免本文档过时）

> 本 skill 只做“分阶段流程 + 验收门禁 + 单阶段闭环”。
> 任何**规范/红线/最佳实践**若在下列文档中已有定义，必须以它们为准；本 skill 不重复展开。
> 若本文与下列权威文档出现路径、组件、命令或门禁冲突，先按权威文档执行，并立即修正本文，不得用本文内的旧示例覆盖实施规范。

- 总则：`AGENTS.md`
- 引擎/系统/move/command：`.spec/knowledge/standards/engine-systems.md`
- UI 设计生成链路：`.spec/skills/ui-design-pipeline/SKILL.md`
- UI/布局/组件：`.spec/knowledge/standards/ui-ux.md`
- React 白屏/渲染错误/Hook 规则：`.spec/knowledge/standards/golden-rules.md`
- 动画/特效：`.spec/knowledge/standards/animation-effects.md`
- 数据录入/真相源契约：`.spec/knowledge/standards/data-entry.md`
- 图片/音频资源接入：`.spec/knowledge/standards/asset-pipeline.md`
- 新游戏阶段 0 / S0 红线：`references/intake-redlines.md`
- 音频细则：项目 `.spec/skills/audio-integration/SKILL.md`（workflow） + `.spec/knowledge/standards/audio-assets.md`（运行时主合同）；`docs/audio/audio-usage.md` 与 `docs/audio/add-audio.md` 只作命令、目录和产物示例参考
- 工具脚本索引：`docs/tools.md`
- 图片 intake 复刻案例：`.spec/skills/smashup-faction-intake/SKILL.md`
- 不确定该读哪份：`.spec/knowledge/README.md`

## 实施规范接入门禁（强制）

进入任何目录创建、素材落盘、压缩、资源引用、`thumbnail.tsx`、`criticalImageResolver` 或 manifest 资源字段之前，先执行对应实施规范；本 skill 不允许自带第二套路由。

- 图片/缩略图/图集/音频落盘与引用：以 `.spec/knowledge/standards/asset-pipeline.md` 为单一实施合同。
- UI 组件与布局：以 `.spec/knowledge/standards/ui-ux.md` 为实施合同。
- 引擎、系统、move/command：以 `.spec/knowledge/standards/engine-systems.md` 为实施合同。
- React 白屏、Hook、函数提升、注册时机：以 `.spec/knowledge/standards/golden-rules.md` 为实施合同。

资源实施最低门禁：

1. 新游戏图片默认进入 `public/assets/i18n/zh-CN/<gameId>/...`；`public/assets/<gameId>/...` 只作为历史兼容或 `asset-pipeline` 明确允许的例外，不得作为新资源默认落点。
2. 缩略图也属于图片资源，默认落到 `public/assets/i18n/zh-CN/<gameId>/thumbnails/`，运行时由 `ManifestGameThumbnail` / `OptimizedImage` 解析。
3. 代码里传资源路径只传相对逻辑路径，例如 `<gameId>/thumbnails/cover`；禁止硬编码 `/assets/`、`compressed/`、`.webp` 或版本参数。
4. 如果必须偏离上述公共链路，必须在当前任务证据中写明原因、影响范围和验收方式。

## 新游戏设计稿目录（强制）

- **适用范围**：只要本轮为某个新游戏产出设计稿、参考图、布局稿、实现骨架稿、风格对照图或生图 brief。
- **单一正式目录**：游戏级设计稿默认统一放在 `docs/games/<gameId>/design/`，禁止继续散落到 `evidence/<gameId>/`、`temp/`、仓库根目录或其它平行入口。
- **设计稿与规范文档不是一回事（强制）**：
  - `design-system/games/<gameId>.md` 是**可实现 UI 规范 / 实现约束文档**；
  - `docs/games/<gameId>/design/generated/*.png|jpg|webp` 才是**位图设计稿 / 视觉稿 / 生图稿**；
  - 不能再把 `design-system` 文档本身当成“设计稿已交付”。
- **推荐子目录**：
  - `docs/games/<gameId>/design/reference/`：外部参考、量测底稿、参考 HTML/SVG、brief。
  - `docs/games/<gameId>/design/implementable/`：可前端复刻的实现骨架稿、布局红稿、实现说明。
  - `docs/games/<gameId>/design/generated/`：保留的位图生图或最终概念稿。
- **目录职责**：
  - `reference` 负责“看什么”；
  - `implementable` 负责“按什么落代码”；
  - `generated` 负责“最终保留哪张图”。
- **最低索引文件**：目录下必须有 `README.md` 或等价索引，至少写清：
  1. 当前唯一有效的参考稿；
  2. 当前唯一有效的实现稿；
  3. 哪些文件只是历史试稿，是否已清理；
  4. 若存在 repo 外生成图，哪个文件是当前保留的 canonical copy。
- **禁止行为**：
  - 禁止把运行截图、E2E 证据图、审计截图冒充设计稿放进该目录；
  - 禁止把已经放弃的中间试稿长期和当前有效稿并列堆放，又不写索引；
  - 禁止实现已经改向后，目录里还保留多张互相冲突的“当前稿”不做裁定。
- **与 evidence 的边界**：
  - `evidence/` 只放验证、审计、截图结论和收口证据；
  - `docs/games/<gameId>/design/` 只放设计输入、实现骨架和保留稿。

## 前置门禁与 Intake 裁定

> 详细规则已拆到 `references/preflight-gates.md`。开始目录创建、规则录入、素材落盘、PDF 转 Markdown、图片/位置驱动 intake、对象粒度或资源准入裁定前，先读该 reference。

最小执行口径：
- 先确认主分支基线、服务器素材主源本地同步、真相源/对照源、素材处理授权和目标 gameId。
- 用户问“添加新游戏怎么做”时，必须主动给输入清单、默认流程和验收边界。
- 素材驱动 UI、规则驱动对象粒度、空间载体 setup、数据驱动边界，必须先裁定职责再实施。
- 资源准入必须先建规则配件表白名单；正式资源、候选资源、参考图和排除项不能混放。
- PDF 规则源要先转 Markdown 并做可行性评估；图片/位置驱动 intake 可在最小输入足够时直接启动。

## 阶段 0：规则数据与素材 Intake 第一门禁（强制）

> 详细规则见 `references/preflight-gates.md`、`references/asset-intake.md` 与 `references/mechanics-data-design.md`。新增游戏不能先做低保真 Board 再事后补素材；必须先把规则对象和运行时素材需求锁住。

本阶段入口索引指向 `references/intake-redlines.md`；来源确认、素材矩阵、PDF / 图片 intake 细则见 `references/preflight-gates.md` 与 `references/asset-intake.md`。

最小执行口径：
- 阶段 0 是新增游戏第一批实际工作，不是验收时补写说明。
- 未锁定规则源、对象全集、规则-素材数量对账、素材用途裁定和布局真相源前，不得进入目录骨架、Board/UI、机制实现、E2E、截图、设计稿或完成汇报。
- 若阶段 0 曾被跳过，后续发现规则、素材、数据、UI 承载或运行时资源缺口时，必须把状态降回 `in_progress` 并先补规则对象素材矩阵。
- 阶段 0 的最低产物、缺口状态和一票否决一律以 `references/intake-redlines.md` 为准。

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
public/assets/i18n/zh-CN/<gameId>/
  thumbnails/.gitkeep
  board/.gitkeep
  cards/.gitkeep
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

## 阶段 1.5-2：机制分解与数据设计

> 详细规则已拆到 `references/mechanics-data-design.md`。进入机制分解、数据结构设计、静态数据录入、类型定义、领域建模或引擎能力缺口分析时，先读该 reference。

最小执行口径：
- 先建立“基础规则语义覆盖矩阵”，把规则动作、玩家决策点、随机/进度关系、属性/资源轨、空间放置/朝向、模式/剧本选择逐条映射到状态、事件、命令、UI 承接和验证证据；矩阵未闭合前不得进入基础版完成判断。
- 权限矩阵要求由 `references/mechanics-data-design.md` 承接；主 workflow 不重复展开交互标准。
- 多剧本 / 多模式 / 多场景游戏必须额外建立“子规则账本索引”：每个剧本、关卡、作祟、boss、任务或模式都要有源段、公开信息、私密信息、setup、目标、特殊规则、特殊行动、token/对象、空间要求、终局和验证状态；代表链只证明代表链本身。
- 先把规则动作拆成机制、状态、事件、命令和 UI 承接，再映射到现有引擎原语。
- 数据结构设计要区分正式真相、系统状态、派生读模型和纯 UI 状态。
- 数据缺失必须显式标记，不得用占位值伪装完成。
- 正式素材缺失或未接入必须显式标记；一旦权威来源里已经锁定素材，就必须接入真实素材或可追溯派生产物，不得继续用文字壳、CSS 图形、示意图、旧占位或相似素材代替。派生产物必须记录源文件、派生方式、运行时路径和验证证据。
- 录入规则文档、静态数据、类型定义和系统需求检查必须一起闭环。
- 新游戏静态事实默认使用严格 JSON `GameConfigPackage`，并按 `.spec/knowledge/standards/game-config-package.md` 说明 JSON 文件位置、schema、表格审查范围和玩家修正提案流程；若暂不使用，必须在 OpenSpec proposal 或 design 写明跳过原因、影响范围和后续补齐项。
- 基础版一票否决默认包括：玩家必须选择但实现自动代选、规则要求多候选但实现只有单例、轨道/档位/非线性属性被压成裸数值、随机/进度关系只做结果日志没有可见状态承接、空间放置/朝向/连接合法性缺少玩家决策或结构化数据。
- 面向百游戏的设计检查只判断抽象边界，不把当前游戏答案硬塞进通用层。
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
- 详见 `.spec/knowledge/standards/engine-systems.md`「Reducer 结构共享范例」。

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
- `.spec/knowledge/standards/engine-action-log.md`（ActionLogSystem 使用规范）
- `evidence/dicethrone/action-log-card-preview.md`（卡牌预览注册表模式 + 数据流说明）

**你在新游戏里只需要做这些（最小闭环）**：
1. 在 `game.ts` 配置 `createActionLogSystem({ commandAllowlist, formatEntry })`，`formatEntry` 产出包含 `segments` 的 `ActionLogEntry`。
2. 若游戏有卡牌：实现 `ui/cardPreviewHelper.ts` 提供 `cardId → CardPreviewRef` 查询，并在 `game.ts` **文件末尾**调用 `registerCardPreviewGetter(gameId, getter)` 注册。
3. Board 不重复实现日志/撤回 UI：行为日志、操作日志和撤回入口由通用 `GameHUD` / FAB 悬浮球承载。新游戏只负责产出正确 ActionLog 数据和接入 Undo 上下文，不在牌桌主界面、侧栏或底部再加日志面板、最近操作列表或第二套撤回按钮。

> 关键点：Vite SSR 的函数提升陷阱与“注册必须放文件末尾”的原因，详见 `AGENTS.md` / `.spec/knowledge/standards/golden-rules.md`。

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

> 详细规则已拆到 `references/ui-implementation-gates.md`。进入新游戏 Board/UI、设计稿批准、实现骨架、交互映射、选择 UI 或基础玩法截图链时，先读该 reference。

最小执行口径：
- 设计稿、架构审查、需求对齐、Board 实现顺序和截图链门禁均以 `references/ui-implementation-gates.md` 为准。
- 新游戏主 UI、设计稿或布局收敛前必须先走上方登记的 UI 设计生成链路；若用户要位图设计稿，再继续走 `boardgame-ui-imagegen`。
- Board 组件只做接入和组装，状态、教学、音频、事件、选择阶段按已有游戏模式复用。
- 对外声称基础流程已具备时，必须提供真实页面截图链；中局过程态和满元素截图要求回 `references/ui-implementation-gates.md`。
## 阶段 6：收尾与启用

> 详细规则已拆到 `references/finalization-checklist.md`。补 i18n、教学、音频、关键图片预加载、debug 配置、资源命名落盘和最终验证时，先读该 reference。

最小执行口径：
- 补齐游戏 i18n 文案、教学配置、音频配置和关键图片预加载。
- 音频细则读上方登记的音频运行时主合同和音频 workflow。
- 关键图片预加载读 `.spec/knowledge/standards/critical-image-preload.md`。
- 资源落盘、压缩、manifest、服务器素材主源回查按 `.spec/knowledge/standards/asset-pipeline.md`。
- 最终验证至少覆盖清单生成、游戏测试、类型检查、资源检查/上传和真实入口可玩性。

---
## 系统与红线速查（只保留本 skill 的最小提醒）

**权威来源**：系统清单/红线/反模式以 `AGENTS.md` + `.spec/knowledge/standards/engine-systems.md` 为准，本节不再重复抄写。

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
- 当前决策者读取：必须优先复用 `src/engine/sessionContext.ts` 这一层语义，不再在共享层手写 `currentPlayer/currentPlayerId/currentPlayerIndex` 分支
- 跨区对象/临时控制/附着脱离：必须先设计稳定 `object ref + provenance`，禁止直接复制历史 `owner/originalOwner/fromPlayerId/toPlayerId` 弱协议
- 跨阶段交互：必须显式设计 `deferred snapshot`，禁止把创建时事实偷偷挂在 ad hoc `runtimeContext/context` 上
- 交互展示：必须给出独立 descriptor，禁止靠 payload 形状推断 UI 模式

---

## 参考资料

- 流程边界、执行现场、OpenSpec 与百游戏模式：references/workflow-boundaries.md
- 前置门禁、来源裁定、素材/规则 intake：references/preflight-gates.md
- 目录骨架与最小模板：references/game-skeleton.md
- 机制分解、数据结构设计、数据录入：references/mechanics-data-design.md
- Board/UI 实现门禁与基础玩法截图链：references/ui-implementation-gates.md
- 收尾启用、音频、关键图片、资源验证：references/finalization-checklist.md
- 架构审查模板：references/architecture-review-template.md
- 图片 / 位置驱动 intake：references/asset-intake.md
- 清单生成说明：references/manifest-generation.md
- 项目结构速览：references/project-structure.md
- 基础玩法截图链示例：references/basic-flow-screenshot-template.md

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
- 用户提供图片后，运行 `npm run compress:images -- public/assets/i18n/zh-CN/<gameId>/thumbnails` 压缩。
- 禁止在 `thumbnail.tsx` 中硬编码 `/assets/<gameId>/.../compressed/*.webp`；如需定制视觉，在 `ManifestGameThumbnail` 或公共缩略图组件层扩展。
