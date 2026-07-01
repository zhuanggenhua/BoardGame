# 山屋惊魂教程覆盖矩阵

> 目的：把“规则条目 -> 教程章节 -> 真实页面锚点 -> 证据”锁清，确保教程从真实运行时主入口开始，并继续复用真实 runtime、真实终局。
> 当前真相源：`src/games/betrayal/tutorial.ts`、`src/games/betrayal/Board.tsx`、`docs/games/betrayal/README.md`、`evidence/betrayal-basic-flow/`、`evidence/betrayal-first-scenario/`、`evidence/betrayal-tutorial/`、`docs/games/betrayal/sources/official/*.md`。

## 当前章节

1. `basic-setup-and-turn`
   - 目标：直接从真实恶兆前运行时进入，讲清首轮最先要理解的目标、动作、速度与房间牌桌。
2. `move-explore-use`
   - 目标：直接在真实恶兆前运行时里走一次使用物品、移动、探索。
3. `crimson-jack-objective`
   - 目标：切到真实 haunt 局面，讲清第一剧本英雄与叛徒各自的目标。
4. `haunt-actions-and-finish`
   - 目标：从真实第一剧本收官局面进入，看到帮助入口、haunt 动作与真实终局。

## 当前实现状态

- 已有教程本体：`src/games/betrayal/tutorial.ts`
- 已接入标准教程解析链：`src/games/manifest.client.generated.tsx`
- 已挂真实教程锚点：
  - 角色选择：`betrayal-character-select-screen`、`betrayal-character-selection-grid`、`betrayal-character-confirm`
  - 运行时：`betrayal-current-traits`、`betrayal-inventory-zone`、`betrayal-room-board`、`betrayal-latest-discovery`、`betrayal-actions-zone`、`betrayal-action-*`
  - 帮助与终局：`betrayal-reference-entry`、`betrayal-endgame-screen`
- 已有静态验证：
  - `src/games/betrayal/__tests__/tutorial.test.ts`
  - `src/games/betrayal/__tests__/tutorialIds.test.ts`
  - `src/games/__tests__/betrayalManifestIntegration.test.ts`
  - `src/components/game/framework/__tests__/ActionBarSkeleton.test.tsx`
  - `src/pages/__tests__/matchRoomStageRuntimeModelBuilders.test.ts`
  - `src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx`
  - `src/engine/systems/__tests__/CheatSystem.test.ts`
- 已有真实 E2E：
  - `e2e/betrayal/basic-flow.e2e.ts`
  - `e2e/betrayal/first-scenario.e2e.ts`
  - `e2e/betrayal/betrayal-tutorial.e2e.ts`
  - `e2e/betrayal/first-scenario-traitor-victory.e2e.ts`
  - `e2e/betrayal/first-scenario-corpse-loot.e2e.ts`
  - `e2e/betrayal/first-scenario-jack-spirit-revive.e2e.ts`
  - `e2e/betrayal/first-scenario-jack-spirit-post-revive-attack.e2e.ts`

## 当前验证状态

- 这轮已重新通过教程/共享接线相关单测：
  - `node scripts/infra/vitest-cli-safe.mjs run src/components/game/framework/__tests__/ActionBarSkeleton.test.tsx src/engine/systems/__tests__/CheatSystem.test.ts src/games/__tests__/betrayalManifestIntegration.test.ts src/games/betrayal/__tests__/tutorial.test.ts src/games/betrayal/__tests__/tutorialIds.test.ts src/pages/__tests__/matchRoomStageRuntimeModelBuilders.test.ts src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx --configLoader native`
  - 结果：`7 passed / 31 passed`
- 这轮已串行通过的真实 E2E 共 7 条：
  - `basic-flow`
  - `first-scenario`
  - `first-scenario-traitor-victory`
  - `betrayal-tutorial`
  - `first-scenario-corpse-loot`
  - `first-scenario-jack-spirit-revive`
  - `first-scenario-jack-spirit-post-revive-attack`

## 规则覆盖矩阵

| 规则条目 | 状态 | 对应章节 | 真实锚点 / 真实动作 | 当前证据 |
| :--- | :--- | :--- | :--- | :--- |
| 角色选择 / 剧本开始属于真实进入链路，但不再作为基础教程主教学落点 | 已调整 | 真实入口保留，基础教程正文不单列 | 角色选择 UI 与 `CONFIRM_EXPLORER` / `START_SCENARIO` 仍存在，但首章改为 `setup-runtime` 注入到真实恶兆前运行时 | `tutorial.ts`、`tutorial.test.ts` |
| 恶兆前主动作入口：移动 / 探索 / 交易 / 使用 / 结束回合 | 已覆盖 | `basic-setup-and-turn` | `betrayal-actions-zone` | `tutorial.test.ts`、`evidence/betrayal-tutorial/02` |
| 速度决定理论移动范围，移动前先看属性区里的速度值 | 已覆盖 | `basic-setup-and-turn` | `betrayal-current-traits` | `tutorial.test.ts` |
| 当前这回合还剩几步，要看右上角剩余移动提示 | 已覆盖 | `basic-setup-and-turn` | `betrayal-moves-remaining` | `tutorial.test.ts`、`evidence/betrayal-tutorial/02` |
| 持有区与帮助入口都在真实牌桌里，不另造说明页 | 已覆盖 | `basic-setup-and-turn` | `betrayal-inventory-zone`、`betrayal-reference-entry` | `tutorial.test.ts`、`evidence/betrayal-tutorial/03` |
| 房间牌桌是主视区 | 已覆盖 | `basic-setup-and-turn` | `betrayal-room-board` | `evidence/betrayal-tutorial/03` |
| 真实移动会消耗移动点，使用绳索会先补移动 | 已覆盖 | `move-explore-use` | `USE_POSSESSION` -> `MOVE_TO_ROOM` | `tutorial.test.ts`、`evidence/betrayal-basic-flow/04-06` |
| 探索会真实翻房间并触发事件 / 物品 / 预兆 | 已覆盖 | `move-explore-use` | `EXPLORE_ROOM` | `tutorial.test.ts` |
| 第一剧本 haunt 后英雄目标：调查杰克、研究法阵、驱魔 | 已覆盖 | `crimson-jack-objective` | `betrayal-actions-zone` | `tutorial.test.ts`、教程文案断言 |
| 第一剧本叛徒目标：杀光英雄或借杰克之灵恢复肉身 | 已覆盖 | `crimson-jack-objective` | `betrayal-room-board` | `tutorial.test.ts`、教程文案断言 |
| haunt 后真实关键动作仍在正式底部动作区 | 已覆盖 | `haunt-actions-and-finish` | `betrayal-action-use` | `tutorial.test.ts`、`evidence/betrayal-tutorial/05` |
| 英雄驱魔成功后进入真实终局页 | 已覆盖 | `haunt-actions-and-finish` | `EXORCISE_JACK` -> `betrayal-endgame-screen` | `e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/06` |

## 当前仍未承诺的范围

1. 叛徒视角教程
   - 当前首轮只覆盖英雄线目标与英雄线收尾，没有把叛徒侧完整走成一条真实教学链。

2. 更多剧本 / 更多 haunt 分支
   - 当前只承诺第一剧本 `Crimson Jack Returns` 的基础目标与英雄收尾。

3. 完整规则书级教学
   - 当前是“多短章真实教程”，不是把所有边界规则都塞进一次长教程。

## 当前建议

1. 继续保持“真实页面 + 真实命令 + 短章节”的教程策略，不回退到教程专用壳层。
2. 下一轮若扩教程，优先补叛徒线真实证据，再考虑更多剧本。
3. 任何教程新增章节都先补真实锚点与最小 E2E，再扩文案。
