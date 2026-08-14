# 山屋惊魂第一剧本完成度审计

> 对象：第一剧本 `赤红杰克归来（Crimson Jack Returns）`
> 目的：把“已经真实跑通到哪”和“还没被真实证据证明到哪”分开，避免把局部通过误说成整剧本已完整完成。
> 当前真相源：`src/games/betrayal/game.ts`、`src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`、`src/games/betrayal/__tests__/Board.foundation.test.tsx`、`src/games/betrayal/__tests__/tutorial.test.ts`、`e2e/betrayal/first-scenario.e2e.ts`、`e2e/betrayal/first-scenario-traitor-victory.e2e.ts`、`e2e/betrayal/first-scenario-core-interactions.e2e.ts`、`e2e/betrayal/first-scenario-jack-spirit-movement-roll.e2e.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`e2e/betrayal/first-scenario-corpse-loot.e2e.ts`、`evidence/betrayal-first-scenario/`、`evidence/betrayal-first-scenario-traitor/`、`evidence/山屋惊魂-首剧本核心交互/`、`evidence/betrayal-first-scenario-jack-spirit-movement-roll/`、`evidence/betrayal-tutorial/`、`evidence/betrayal-first-scenario-corpse-loot/`。

## 当前结论

- 第一剧本的英雄主线已经具备“真实页面可进入、真实 haunt 可推进、真实终局可到达”的闭环证据。
- 第一剧本的叛徒主线现在也已经具备“真实 `Haunt` 页面可进入、真实叛徒收尾可触发、真实终局可到达”的独立页面证据。
- 杰克之灵（Jack's Spirit）复活叛徒后，已经具备“真实页面继续攻击同房间英雄并推进回合”的独立页面证据。
- 教程已补入第一剧本叛徒视角独立章节，能从真实教程进入叛徒攻击并到达真实终局。
- 尸体搜刮已经补到二次限制：第一次搜尸后，同一正式动作位会回到普通交易且显示没有可搜尸 / 可交易对象。
- 第一剧本与教程相关的最小真实回归矩阵已经在当前 `main` 现场重新串行通过；本轮另补了事件牌图集裁切、教程阻塞揭示主视线、骰面可见和参考页不复读素材内容的当前截图证据。
- 杰克之灵（Jack's Spirit）的死叛徒怪物回合已补齐桌游化 Speed 3 移动骰结算：回合开始投 3 颗骰，点数决定本回合移动上限，移动后扣减，移动点耗尽会阻止继续移动。
- 因此，当前可以说“第一剧本英雄线与叛徒线的最小可玩闭环都已成立”；但仍不能扩大成“第一剧本所有边界交互都已完整验收”。

## 当前现场的最新回归结果

> 回归时间：`2026-07-05`
> 回归现场：`D:\gongzuo\webgame\BoardGame`
> 目的：确认教程 + 第一剧本必要部分，而不是扩大成整游戏完成审计。

- 本轮已通过的定向验证：
  - `npx vitest run src/games/betrayal/__tests__/tutorial.test.ts`：`1 file / 7 tests passed`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts "移动探索教程会使用持有物、整张房间牌移动并探索出发现牌"`：`1 test passed`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts "教程路由会从真实运行时主入口开始，并复用真实终局"`：`1 test passed`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/first-scenario.e2e.ts "从真实 haunt 运行时进入幸存者终局"`：`1 test passed`
  - `npx eslint src/components/tutorial/TutorialOverlay.tsx src/games/betrayal/discoveryAtlas.ts src/games/betrayal/__tests__/tutorial.test.ts e2e/betrayal/betrayal-tutorial.e2e.ts e2e/betrayal/first-scenario.e2e.ts`：0 error
  - `git diff --check -- src/components/tutorial/TutorialOverlay.tsx src/games/betrayal/discoveryAtlas.ts src/games/betrayal/__tests__/tutorial.test.ts e2e/betrayal/betrayal-tutorial.e2e.ts e2e/betrayal/first-scenario.e2e.ts src/games/betrayal/Board.tsx src/games/betrayal/tutorial.ts public/locales/zh-CN/game-betrayal.json public/locales/en/game-betrayal.json .spec/knowledge/standards/ui-ux.md .spec/knowledge/standards/tutorial-design.md .spec/skills/tutorial-workflow/SKILL.md`：通过，仅 LF/CRLF 提示
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/tutorial.test.ts src/games/betrayal/__tests__/tutorialIds.test.ts src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx src/pages/__tests__/matchRoomTutorialStageRuntime.test.tsx --configLoader native`：`4 files / 34 tests passed`
  - `node scripts/infra/run-e2e-command.mjs isolated e2e/betrayal/betrayal-tutorial.e2e.ts`：`2 tests passed`
  - `node scripts/infra/run-e2e-command.mjs isolated e2e/betrayal/first-scenario-corpse-loot.e2e.ts`：`1 test passed`
  - `npm run typecheck -- --pretty false`：通过
  - `npx eslint src/games/betrayal/tutorial.ts src/games/betrayal/__tests__/tutorial.test.ts src/games/betrayal/__tests__/tutorialIds.test.ts src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx src/pages/__tests__/matchRoomTutorialStageRuntime.test.tsx e2e/betrayal/betrayal-tutorial.e2e.ts e2e/betrayal/first-scenario-corpse-loot.e2e.ts`：0 error
  - `git diff --check -- src/games/betrayal/tutorial.ts public/locales/zh-CN/game-betrayal.json public/locales/en/game-betrayal.json src/games/betrayal/__tests__/tutorial.test.ts e2e/betrayal/betrayal-tutorial.e2e.ts e2e/betrayal/first-scenario-corpse-loot.e2e.ts src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx src/pages/__tests__/matchRoomTutorialStageRuntime.test.tsx`：通过，仅 LF/CRLF 提示
- 当前结论：
  - 教程已压成 3 个可见章节：基础回合、作祟后看目标再驱魔、如果叛徒得手；旧移动探索与赤红杰克目标章节仅保留隐藏兼容入口。
  - 叛徒视角教程不是只写配置，已经通过真实页面攻击和终局截图证据。
  - 搜尸边界不是只验证第一次成功，已经补到二次限制的真实页面证据。
  - 发现牌揭示现在使用正式事件牌图集，图集合同锁定为 `6076x6376 / 9x5`，并通过 `外星几何` 第 `24` 格页面截图验证。
  - 阻塞式发现牌和第一剧本参考页以正式素材为主结果；发现牌底部确认条只保留“下一步”按钮，教程 / 帮助 UI 不再在旁边复读素材正文。
  - 杰克之灵（Jack's Spirit）死叛徒回合的 Speed 3 怪物移动骰已补成规则级结算，当前新增规则测试覆盖投骰、移动点、扣点、耗尽拦截与回尸体房复活优先级；真实页面 E2E 已生成截图证据。
  - 本轮已检查 TTS Mods 参考源 `Mods/Workshop/3420850553.json`：存在骰子计算器、骰子归位、桌柜开合等 Lua 辅助脚本；未发现第一剧本、杰克之灵、驱魔、怪物移动或自动结算脚本。因此 Mods 可参考桌面道具/骰子 UI，不是首剧本规则自动结算真相源。
- 执行备注：
  - 这次只声明“教程 + 第一剧本必要部分”已收口，不声明全事件牌、全房间资源、更多剧本或山屋整游戏完成。

## 2026-07-12 补充回归

- 本轮新增并通过的定向验证：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/first-scenario-jack-spirit-movement-roll.e2e.ts "死叛徒回合会显示杰克之灵 Speed 3 移动骰，并按点数扣减移动"`：`1 test passed`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/first-scenario-core-interactions.e2e.ts "真实页面允许已掌握线索的英雄继续调查并把线索交给队友"`：`1 test passed`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/first-scenario-core-interactions.e2e.ts "真实页面允许没有法阵时尝试驱魔并结算失败反扑"`：`1 test passed`
- 已生成的真实页面证据：
  - `evidence/betrayal-first-scenario-jack-spirit-movement-roll/01-山屋惊魂-第一剧本-杰克之灵移动骰后.jpg`
  - `evidence/betrayal-first-scenario-jack-spirit-movement-roll/02-山屋惊魂-第一剧本-杰克之灵移动扣点后.jpg`
  - `evidence/山屋惊魂-首剧本核心交互/11-山屋惊魂-调查杰克-帮队友前.jpg`
  - `evidence/山屋惊魂-首剧本核心交互/12-山屋惊魂-调查杰克-帮队友后.jpg`
  - `evidence/山屋惊魂-首剧本核心交互/13-山屋惊魂-无 法阵驱魔-执行前.jpg`
  - `evidence/山屋惊魂-首剧本核心交互/14-山屋惊魂-无 法阵驱魔-反扑后.jpg`
- 这次补齐的规则口径：
  - 已掌握 `Knowledge of Jack` 的英雄仍可继续在图书馆调查，并把线索交给尚未掌握线索的队友；
  - 英雄与杰克之灵同房时，即使当前没有法阵，也可以按官方规则尝试驱魔；失败时会结算杰克之灵反扑。
- Mods 参考结论：
  - `Mods/Workshop/3420850553.json` 有全局空脚本、骰子计算器脚本、骰子归位脚本、桌柜/桌面切换脚本；
  - 关键字扫描未命中 `Jack`、`Crimson`、`Spirit`、`Haunt`、`Speed`、`杰克`、`剧本`、`驱魔`、`法阵`、`图书馆` 等首剧本规则自动结算内容；
  - 因此当前首剧本规则仍以官方手册和本项目运行时/测试为真相源，Mods 只作为素材与桌面 UI 参考。

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

### 3. 教程复用真实第一剧本英雄线与叛徒最小收尾

- 证据：
  - `e2e/betrayal/betrayal-tutorial.e2e.ts`
  - `evidence/betrayal-tutorial/betrayal-tutorial-e2e-test.md`
- 已证明：
  - 教程没有另起教学壳层，而是复用真实角色选择、真实运行时和真实终局；
  - 教程最小链路可从第一剧本英雄线收尾进入真实终局；
  - `traitor-path` 章节可从叛徒视角进入真实攻击并到达真实叛徒终局；
  - 教程探索章节会真实翻开房间并展示正式发现牌正面；当前关键截图：`evidence/betrayal-tutorial/14-山屋惊魂-教程-探索后发现牌.jpg`、`evidence/betrayal-tutorial/15-山屋惊魂-教程-探索后牌桌结果.jpg`；
  - 教程英雄线终局页能显示驱魔投骰骰面；当前关键截图：`evidence/betrayal-tutorial/06-山屋惊魂-教程-终局页.jpg`；
  - 关键截图：`evidence/betrayal-tutorial/07-山屋惊魂-教程-叛徒视角攻击前.jpg`、`evidence/betrayal-tutorial/08-山屋惊魂-教程-叛徒终局页.jpg`。

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
  - 同一动作位会从 `搜尸` 收回到普通 `交易`，说明本回合搜刮态已被消耗；
  - 二次尝试时交易按钮保持不可用，并显示没有可搜尸 / 可交易对象；
  - 关键截图：`evidence/betrayal-first-scenario-corpse-loot/03-山屋惊魂-第一剧本-搜尸二次限制.jpg`。

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

### 8. 杰克之灵（Jack's Spirit）死叛徒回合 Speed 3 移动骰

- 证据：
  - `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`
  - `e2e/betrayal/first-scenario-jack-spirit-movement-roll.e2e.ts`
  - `evidence/betrayal-first-scenario-jack-spirit-movement-roll/`
- 已证明：
  - 死叛徒回合开始时由杰克之灵（Jack's Spirit）接管，而不是按普通探索者固定移动点起跑；
  - 页面会显示杰克之灵（Jack's Spirit）按 `Speed 3` 投骰后的移动上限；
  - 正式移动入口可移动杰克之灵，移动后剩余移动点会扣减；
  - 规则级测试覆盖移动点耗尽后的继续移动拦截。

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
  - 杰克之灵（Jack's Spirit）会按自身房间与移动规则接管回合；
  - 杰克之灵（Jack's Spirit）死叛徒回合会按 `Speed 3` 投骰决定本回合最多移动间数，移动后扣点，耗尽后不能继续移动；
  - 杰克之灵（Jack's Spirit）回尸体房间后会让叛徒复活；
  - `Stalk the Prey` 的每回合使用限制和“不消耗普通移动”已补上；
  - 尸体搜刮规则已补上最小正式限制。

## 当前还没被真实页面证明的部分

1. 第一剧本更多复杂边界交互的真实 UI 证明
   - 当前必要的搜尸一次成功与二次限制已经有真实页面证据；更多非必要复杂分支仍不在本轮范围内。

2. 更复杂教程分支
   - 当前教程覆盖英雄线和叛徒视角最小收尾；更多剧本、更多 haunt 分支和完整规则书式教学仍未覆盖。
   - 当前已额外覆盖“发现牌揭示必须展示正式牌面且底部只留确认按钮”“驱魔投骰必须展示骰面”“参考页必须展示正式素材且不复读正文”这三个教程 / 第一剧本必要展示口径。

## 当前建议

1. 如果后续目标只要求“教程 + 第一剧本必要部分”，当前完成度已经足够支撑“必要部分已收口”的表述。
2. 如果后续目标升级为“第一剧本正式完结验收”，下一优先项才是继续补更多复杂边界交互的真实 UI 证据。
3. 当前可以明确说“教程覆盖英雄线和叛徒最小收尾，第一剧本双主线都有真实页面闭环证据”，但仍不要扩大成“山屋整游戏完成”。
