# 山屋惊魂第一剧本完成度审计

> 对象：第一剧本 `Crimson Jack Returns`
> 目的：把“已经真实跑通到哪”和“还没被真实证据证明到哪”分开，避免把局部通过误说成整剧本已完整完成。
> 当前真相源：`src/games/betrayal/game.ts`、`src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`、`e2e/betrayal/first-scenario.e2e.ts`、`e2e/betrayal/first-scenario-traitor-victory.e2e.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-first-scenario/`、`evidence/betrayal-first-scenario-traitor/`、`evidence/betrayal-tutorial/`。

## 当前结论

- 第一剧本的英雄主线已经具备“真实页面可进入、真实 haunt 可推进、真实终局可到达”的闭环证据。
- 第一剧本的叛徒主线现在也已经具备“真实 `Haunt` 页面可进入、真实叛徒收尾可触发、真实终局可到达”的独立页面证据。
- `Jack's Spirit` 复活叛徒后，已经具备“真实页面继续攻击同房间英雄并推进回合”的独立页面证据。
- `Board.tsx` 这轮修正房间焦点优先级与正式可见入口后，第一剧本与教程相关的最小真实回归矩阵已经在当前专项 worktree 重新串行通过。
- 因此，当前可以说“第一剧本英雄线与叛徒线的最小可玩闭环都已成立”；但仍不能扩大成“第一剧本所有边界交互都已完整验收”。

## 当前 worktree 的最新回归结果

> 回归时间：`2026-06-29`
> 回归现场：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal`
> 目的：确认这轮 `Board.tsx` 修正没有把既有真实链路打回去。

- 已串行通过的真实 E2E：
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/basic-flow.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-traitor-victory.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-corpse-loot.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-jack-spirit-revive.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-jack-spirit-post-revive-attack.e2e.ts`
- 当前结论：
  - 房间焦点现在会优先给 `Haunt` 战斗动作，而不是被“单一移动目标”抢走。
  - 复活后的继续攻击入口现在是正式可见、可点的页面入口，不再只靠隐藏承接位存在。
  - 这轮改动没有把恶兆前主流程、第一剧本英雄线、叛徒线、教程线和三条边界链路打回去。
- 执行备注：
  - `run-e2e-command` 这轮若并发启动，会先撞 `heavy-task-guard`，随后还可能撞 `.tmp/e2e-preflight-cache.json` 文件锁；
  - 因此上面这组真实 E2E 证据都应按串行方式复跑与复核，不能把并发失败误判成业务链路失败。

## 已有真实页面证据

### 1. 恶兆前到第一剧本运行时

- 证据：
  - `e2e/betrayal/basic-flow.e2e.ts`
  - `evidence/betrayal-basic-flow/betrayal-basic-flow-e2e-test.md`
- 已证明：
  - 真实角色选择可进入正式运行时；
  - 恶兆前动作区、持有区、房间主视区和帮助入口可用；
  - 使用物品、移动、探索这条正式入口链可操作。

### 2. 第一剧本英雄线到真实终局

- 证据：
  - `e2e/betrayal/first-scenario.e2e.ts`
  - `evidence/betrayal-first-scenario/betrayal-first-scenario-e2e-test.md`
- 已证明：
  - 真实页面可进入 `Haunt`；
  - 第一剧本帮助入口能打开真实参考卡；
  - 正式运行时里可以推进到英雄胜利终局；
  - 终局页来自真实游戏页，不是单独伪造页面。

### 3. 教程复用真实第一剧本英雄线

- 证据：
  - `e2e/betrayal/betrayal-tutorial.e2e.ts`
  - `evidence/betrayal-tutorial/betrayal-tutorial-e2e-test.md`
- 已证明：
  - 教程没有另起教学壳层，而是复用真实角色选择、真实运行时和真实终局；
  - 教程最小链路可从第一剧本英雄线收尾进入真实终局。

### 4. 第一剧本叛徒线到真实终局

- 证据：
  - `e2e/betrayal/first-scenario-traitor-victory.e2e.ts`
  - `evidence/betrayal-first-scenario-traitor/betrayal-first-scenario-traitor-victory-e2e-test.md`
- 已证明：
  - 真实页面可进入“只差最后一击”的叛徒 `Haunt` 收尾局面；
  - 叛徒最后一次攻击可把页面推进到真实叛徒终局；
  - 终局页来自正式游戏页，不是单独伪造页面。

### 5. 第一剧本尸体搜刮边界

- 证据：
  - `e2e/betrayal/first-scenario-corpse-loot.e2e.ts`
  - `evidence/betrayal-first-scenario-corpse-loot/betrayal-first-scenario-corpse-loot-e2e-test.md`
- 已证明：
  - 同房间尸体可通过正式底部 `搜尸` 动作进入搜刮链；
  - 搜刮后当前玩家持有区会真实增加 1 张牌；
  - 同一动作位会从 `搜尸` 收回到普通 `交易`，说明本回合搜刮态已被消耗。

### 6. Jack's Spirit 回尸体房间后的复活边界

- 证据：
  - `e2e/betrayal/first-scenario-jack-spirit-revive.e2e.ts`
  - `evidence/betrayal-first-scenario-jack-spirit-revive/betrayal-first-scenario-jack-spirit-revive-e2e-test.md`
- 已证明：
  - 页面可停在“杰克之灵已经回到尸体房间，但叛徒尚未复活”的真实 `Haunt` 运行时；
  - 当前玩家点击正式 `结束回合` 后，页面会真实切回叛徒本人而不是直接离开运行时；
  - 复活后的角色板、队友区和牌桌结构都在同一张正式运行时页面里更新完成。

### 7. 叛徒复活后继续攻击英雄

- 证据：
  - `e2e/betrayal/first-scenario-jack-spirit-post-revive-attack.e2e.ts`
  - `evidence/betrayal-first-scenario-jack-spirit-post-revive-attack/betrayal-first-scenario-jack-spirit-post-revive-attack-e2e-test.md`
- 已证明：
  - 叛徒复活后，正式页面会给出真实可见的 `攻击英雄` 焦点入口，而不是只在隐藏承接位里存在；
  - 叛徒可以通过这个正式页面入口继续攻击同房间英雄；
  - 攻击结算后，正式页面会真实切给下一名英雄并更新反馈与属性结果。

## 已有规则级自动化证据

### 1. Haunt 触发与第一剧本起跑

- 证据：`src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`
- 已证明：
  - 第三次恶兆且 `haunt roll` 达标后进入真实 `haunt`；
  - 最后一张恶兆会自动触发 `haunt`；
  - 第一剧本起跑位已经回到正式运行时，而不是旧手工结算口。

### 2. 英雄线关键规则

- 已证明：
  - `Learn About Jack`
  - `Study the Exorcism`
  - `Exorcise Jack`
  - 英雄攻击叛徒的对攻伤害
  - `Knowledge of Jack` 的攻防加成

### 3. 叛徒线与杰克之灵规则

- 已证明：
  - 叛徒可通过击倒全部英雄进入终局；
  - 叛徒死亡后会释放 `Jack's Spirit`；
  - `Jack's Spirit` 会按自身房间与移动规则接管回合；
  - `Jack's Spirit` 回尸体房间后会让叛徒复活；
  - `Stalk the Prey` 的每回合使用限制和“不消耗普通移动”已补上；
  - 尸体搜刮规则已补上最小正式限制。

## 当前还没被真实页面证明的部分

1. 第一剧本更多边界交互的真实 UI 证明
   - 例如更多搜尸边界，目前仍主要是规则层自动化验证。

2. 多视角教程
   - 当前教程只承诺英雄线；叛徒视角还没有独立教程章节和真实截图证据。

## 当前建议

1. 如果后续目标是“可合并到主分支”，当前完成度已经足够支撑“第一剧本最小可玩闭环已成立”的表述。
2. 如果后续目标是“第一剧本正式完结验收”，下一优先项应是补边界交互的真实 UI 证据，而不是继续回头补主胜负链。
3. 当前可以明确说“第一剧本双主线都已有真实页面闭环证据”，但仍不要扩大成“全部边界完整验收通过”。
