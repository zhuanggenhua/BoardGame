# Tasks: 引入领域内核与系统层（激进引擎化）

## 与现有 Specs 的关系

| 现有 Spec | 关系 | 本次变更动作 |
|-----------|------|-------------|
| `game-registry` | 保持不变 | 无需修改 |
| `match-archive` | 扩展对齐 | 统一 log 格式需与归档模型对接 |
| `tutorial-engine` | 演进为系统 | 教程作为 Systems 层的可选系统 |
| `undo-system` | 本次补充 | 填充空目录，定义撤销系统规格 |
| `manage-modals` | 无直接关系 | 无需修改 |

---

## 核心任务

### 1) 现状盘点（对齐真实基线）✅
- [x] 服务端注册依赖 `GAME_SERVER_MANIFEST`（来自 `manifest.server.generated.ts`）
- [x] 现有跨游戏能力：
  - `src/engine/systems/UndoSystem` - 自动快照与撤销握手
  - `src/systems/AbilitySystem` - 成熟的技能系统
  - `src/systems/StatusEffectSystem` - 状态效果系统
  - `server.ts` 的 `archiveMatchResult` - 归档能力

### 2) 目录结构约定 ✅
- [x] 引擎层根目录：`src/engine/`
- [x] 游戏领域内核：`src/games/<gameId>/domain/`
- [x] 系统层：`src/engine/systems/`

### 3) Spec：领域内核（Domain Core）
- [x] 每个游戏的 Domain Core 位置：`src/games/<gameId>/domain/`
- [x] 必需导出：`types.ts`、`commands.ts`、`reducer.ts`、`view.ts`（可选）
- [x] 确定性与序列化要求
- [x] 回放语义：Events 回放

### 4) Spec：系统层（Systems）
- [x] 系统生命周期 hooks：`beforeCommand` / `afterEvents` / `playerView`
- [x] `UndoSystem`：自动快照 + 多人握手
- [x] `PromptSystem`：统一 prompt/choice 协议
- [x] `LogSystem`：统一事件日志格式
- [x] 隐藏信息的 redaction 机制

### 5) Spec：Boardgame.io 适配层
- [x] 适配层职责：moves 只做输入翻译，不写规则
- [x] move → Command 映射
- [x] `G.sys` / `G.core` 存储与迁移

### 6) 迁移路线（分阶段）
- **阶段 1**：落地 `src/engine/` 骨架 + `MatchState<TCore>` 类型 ✅
- **阶段 2**：迁移 TicTacToe（验证撤销自动化） ✅
- **阶段 3**：迁移 DiceThrone（详见下方）
- **阶段 4**：归档/回放接入统一 log

---

## 阶段 3：DiceThrone 迁移（详细任务）

### 3.1 领域内核骨架
- [x] 创建 `src/games/dicethrone/domain/types.ts`
  - DiceThroneCore 状态类型
  - Command variants（ROLL_DICE, PLAY_CARD, SELL_CARD 等）
  - Event variants（DICE_ROLLED, DAMAGE_DEALT, STATUS_APPLIED 等）
- [x] 创建 `src/games/dicethrone/domain/commands.ts`
  - validate 逻辑（从现有 `isMoveAllowed` + 各 move 校验抽取）
- [x] 创建 `src/games/dicethrone/domain/reducer.ts`
  - 确定性 `reduce(state, event)` 函数
- [x] 创建 `src/games/dicethrone/domain/rules.ts`
  - 共享规则：`canPlayCard`, `getAvailableAbilities`, `canAdvancePhase` 等
- [x] 创建 `src/games/dicethrone/domain/index.ts`
  - 导出 `DiceThroneDomain: DomainCore<DiceThroneCore, ...>`
- [x] 创建 `src/games/dicethrone/domain/execute.ts`
  - Command -> Event[] 转换逻辑
- [x] 创建 `src/games/dicethrone/game-v2.ts`
  - 使用 `createGameAdapter` 的新版本（过渡）

### 3.2 PromptSystem 对接
- [x] 创建 `src/games/dicethrone/domain/systems.ts`
  - DiceThrone 事件处理系统，将 CHOICE_REQUESTED 转换为 sys.prompt
- [x] 保留旧版 `pendingChoice` 兼容层
- [ ] 更新 `Board.tsx` 使用新版 prompt（待集成测试）

### 3.3 AbilitySystem 演进
- [x] 创建 `src/games/dicethrone/domain/effects.ts`（返回 Event 而非直接 mutate）
- [x] 保留现有 `AbilitySystem` API 作为兼容层
- [x] Reducer 处理 `DAMAGE_DEALT` / `HEAL_APPLIED` / `STATUS_APPLIED` 等事件

### 3.4 game.ts 适配
- [x] 使用 `createGameAdapter` 创建 `game-v2.ts`
- [x] 旧版 `game.ts` 备份为 `game.legacy.ts`
- [x] 导出新版 `DiceThroneGameV2` 供切换使用
- [x] 注册 commandTypes 以支持可枚举 moves

### 3.5 UI 适配（Board.tsx 重构）
- [x] 创建 `hooks/useDiceThroneState.ts` 兼容层
  - 统一状态访问接口，支持新旧两种状态结构
  - `useCurrentChoice` 兼容 prompt 和 pendingChoice
- [ ] 拆分组件（可选，按需逐步进行）：
  - [ ] `HandArea.tsx` (~300 行)
  - [ ] `DiceTray.tsx` (~200 行)
  - [ ] `DiceActions.tsx` (~100 行)
  - [ ] `AbilityOverlays.tsx` (~150 行)
  - [ ] `PlayerStats.tsx` (~100 行)
  - [ ] `DiscardPile.tsx` (~100 行)
  - [ ] `constants.ts` (~100 行)
- [x] 共享规则已抽取到 `domain/rules.ts`

### 3.6 隐藏信息（playerView）
- [x] 创建 `src/games/dicethrone/domain/view.ts`
- [x] 实现对手手牌隐藏逻辑
- [ ] 验证：双人对局时对手手牌不可见（待集成测试）

---

### 7) 验证计划
- [x] 确定性验证：同一初始状态 + 同一 event 流 → 一致最终状态（TicTacToe 已验证）
- [x] 撤销验证：无需游戏手动 `saveSnapshot`（TicTacToe 已验证）
- [ ] 隐藏信息验证：playerView 过滤正确（等待多玩家隐藏信息用例）

---

## UGC 可选能力（Phase 2）

> UGC 作为可选扩展，不阻塞核心引擎化。第一阶段先完成核心引擎，UGC 能力后续接入。

### 8) Spec：UGC 沙箱执行（可选）
- [ ] UGC 规则代码**只在服务端执行**
- [ ] 沙箱隔离：`isolated-vm` 或 `vm2`，禁用 `require/fs/net/child_process`
- [ ] 资源限制：内存上限、执行超时、CPU 配额
- [ ] UGC 模块只暴露 Domain Core 契约（纯数据输入输出）

### 9) Spec：UGC 通用 UI（可选）
- [ ] 第一阶段**不开放自定义 React 组件**
- [ ] 提供平台通用 UI 组件：
  - 卡牌区（手牌/牌堆/弃牌堆）
  - 骰子区
  - 计分轨
  - Prompt/Choice 面板
  - 目标选择器
- [ ] UGC 游戏通过数据驱动通用 UI

### 10) Spec：UGC 资产绘制（可选）
- [ ] 用户可**直接绘制**卡牌/Token 等素材（无需上传图片）
- [ ] 提供 Canvas 绘制编辑器（卡牌框模板 + 文字/图形工具）
- [ ] 绘制结果导出为 SVG/PNG，存储为资产 hash
- [ ] 裁切参数数据化：`{ crop: { x, y, scale }, assetId }`

### 11) Spec：Effect DSL（可选）
- [ ] 卡牌/技能效果走**数据驱动**而非代码
- [ ] 提供 Effect Schema + 校验
- [ ] AI 生成配置数据（JSON）而非代码
- [ ] 效果执行由 `EffectSystem` 解释

---

## OpenSpec 校验

### 12) 严格校验
- [x] 补充 `openspec/specs/undo-system/spec.md`（当前为空目录）
- [ ] 运行 `openspec validate implement-domain-core-and-systems --strict --no-interactive`（当前 CLI 不可用）
- [ ] 修复所有问题（待 CLI 可用后执行）
