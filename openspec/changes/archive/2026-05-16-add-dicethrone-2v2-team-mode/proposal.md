# Change: DiceThrone 2v2 团战模式（官方规则）

## Why
当前 DiceThrone 仅支持 1v1（2 人）流程，无法承载官方 2v2 团战规则：4 人分队、共享体力、目标掷骰与队伍胜负判定。需要在不破坏 1v1 的前提下补齐 2v2 的端到端能力（领域规则、服务端房间、前端创建与可见性）。

## What Changes
- 本次范围限定为 2v2，不并入 3 人君临天下模式（3 人模式单独提案）。
- 增加 DiceThrone 4 人开局能力：房间人数支持 2/4，4 人即进入 2v2 团战规则集。
- 新增团队建模：默认分队为 1&3 vs 2&4（官方座位规则）；队伍共享体力 50，治疗上限按“起始+10”处理。
- 新增 2v2 目标选择交互：覆盖目标掷骰四类分支（1/2、3/4、5、6），并补齐所有新交互流程（自动指向、被攻击方选择、进攻方选择、锁定与回显）。
- 新增站位调整交互（影响左/右对手判定）：交互保持最简，仅支持“点击空位移动位置”，不支持交换位。
- 新增顶部对手视图交互：顶部并排展示 3 个他人悬浮窗，边缘高亮区分敌我。
- 新增目标选择面板交互：攻击阶段结束后展示 3 个可选目标，样式复用悬浮窗并纵向排列，点击即确认目标。
- 新增响应窗口阵营隔离：队友不响应队友（同队玩家不进入同队响应队列）。
- 改造回合顺序：按“队伍交替”推进（如 1→3→2→4），并支持不同起始玩家的等价轮转。
- 新增目标掷骰阶段（Targeting Roll Phase）：在 2v2 中按 d6 结果决定防御方（1/2、3/4、5、6 规则）。
- 改造攻击目标与响应逻辑：从“唯一对手推断”升级为“显式目标 + 多对手队列”。
- 改造胜负判定：由“个人 HP”改为“队伍共享 HP”判定胜负与平局。
- 调整信息可见性：队友可查看队友手牌；对手手牌/牌库仍隐藏。
- 服务端与大厅联动：创建对局人数校验、4 座位入座与状态流转保持一致。

## Impact
- Affected specs:
  - `dicethrone-team-mode`（新增）
- Affected code:
  - `src/games/dicethrone/manifest.ts`
  - `src/games/dicethrone/game.ts`
  - `src/games/dicethrone/domain/core-types.ts`
  - `src/games/dicethrone/domain/index.ts`
  - `src/games/dicethrone/domain/rules.ts`
  - `src/games/dicethrone/domain/execute.ts`
  - `src/games/dicethrone/domain/executeCards.ts`
  - `src/games/dicethrone/domain/attack.ts`
  - `src/games/dicethrone/domain/effects.ts`
  - `src/games/dicethrone/domain/reduceCombat.ts`
  - `src/games/dicethrone/domain/view.ts`
  - `src/games/dicethrone/Board.tsx`
  - `server.ts`
  - `src/server/claimSeat.ts`
  - `src/server/matchOccupancy.ts`
