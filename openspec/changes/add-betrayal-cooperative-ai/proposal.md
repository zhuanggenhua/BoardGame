# Change: 为小黑屋接入支持双阵营的本地 AI

## Why
- 小黑屋当前 manifest 明确关闭 AI，且没有游戏侧 `GameAiRuntime`，本地 AI 座位无法完成选角、探索、作祟后目标或回合推进。
- 用户要求 AI 在共同探索阶段作为合作伙伴；但小黑屋的作祟规则可能把任意探索者变成叛徒，因此 AI 也必须能在被规则指定时切换到叛徒侧继续对局。

## What Changes
- 为小黑屋新增本地 AI runtime，并在游戏入口注册。
- 开启小黑屋 `localAi` 与训练样本采集能力，默认把除本地真人外的座位配置为本地 AI；远程 AI 本轮不启用。
- AI 在选角和恶兆前阶段按合作探索策略行动。
- 作祟后 AI 根据领域状态中的真实阵营行动：
  - 英雄 AI 优先推进调查杰克、研究法阵、驱魔和攻击叛徒。
  - 叛徒 AI 优先追击并攻击仍存活的英雄，并正确处理杰克之灵阶段。
- 第一版合法动作覆盖：
  - 选角、确认选角、开始剧本。
  - 待处理事件选择。
  - 恶兆前移动、探索、结束回合。
  - 作祟后英雄移动、攻击叛徒、调查杰克、研究法阵、驱魔、结束回合。
  - 作祟后叛徒移动、攻击英雄、控制杰克之灵移动与攻击、结束回合。
- 第一版策略以阵营目标和保证回合可推进为优先，不主动执行交易、搜尸、复杂持有物使用和兔脚改骰；这些可选动作不应阻塞 AI 收口。

## Impact
- Affected specs:
  - `game-ai-system`
- Affected code:
  - `src/games/betrayal/ai.ts`
  - `src/games/betrayal/game.ts`
  - `src/games/betrayal/manifest.ts`
  - `src/games/betrayal/__tests__/ai.test.ts`
- Compatibility:
  - 不改变原有“触发作祟者成为叛徒”的剧本规则。
  - 远程 AI 本轮保持关闭。
