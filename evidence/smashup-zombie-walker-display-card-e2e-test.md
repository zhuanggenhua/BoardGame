# Smash Up Zombie Walker 牌库顶卡牌展示 E2E 证据

## 范围

- 问题：行尸（`zombie_walker`）“弃掉 / 放回牌库顶”选择只显示按钮，没有显示被查看的牌库顶卡牌。
- 对照：盘旋机器人（`robot_hoverbot`）已有“卡牌 + 放回按钮”的视觉提示。
- 本次同时修复通用 `SimpleChoice.displayCard` 透传，覆盖同类按钮交互的上下文卡牌展示。
- 横向补齐的同类交互：
  - `wizard_neophyte` / 巫师外部行动目标选择：此前已传 `displayCard`，本次通用透传后可显示。
  - `vampire_buffet_pod_play`、`vampire_mad_monster_party_pod_play`：选择是否打出手中对应行动时显示该行动卡。
  - `princesses_woodland_helpers`：选择刚打出的行动留弃牌堆或放牌库底时显示该行动卡。
  - `elder_thing_elder_thing_choice`、`elder_thing_elder_thing_pod_mode`：选择“本随从”处理方式时显示对应随从卡。
  - `special_madness`：疯狂卡二选一时显示当前疯狂卡。

## 验证

- 单测：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx src/games/smashup/__tests__/zombieWizardAbilities.test.ts src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts src/games/smashup/__tests__/elderThingsPod.test.ts --configLoader native`
  - 结果：5 个文件，170 个用例通过。
- 单测：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native -t "princesses_woodland_helpers"`
  - 结果：1 个目标用例通过。
- E2E：`node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-gameplay.e2e.ts "老派系 OR：Zombie Walker 可选弃掉或放回牌库顶，并能走完整弃牌分支"`
  - 结果：1 个用例通过。

## 额外说明

- 曾尝试整跑 `newFactionAbilities.test.ts`，其中 3 个 `base_fairy_ring` 用例因既有 `effect contract` 声明缺失失败：`base_fairy_ring@onMinionPlayed` 读取 `state.players.0` 但 contract 未声明 `controllerState`。该失败不在本轮 displayCard 改动路径上，已用目标用例复跑确认 `princesses_woodland_helpers` 本轮断言通过。

## 截图观察

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Zombie-Walker-可选弃掉或放回牌库顶，并能走完整弃牌分支\legacy-or-zombie-walker-prompt-visible.png`
   - 我实际看到：提示标题下方显示了牌库顶“大副 / First Mate”卡牌本体，下面同时有“弃掉”和“放回牌库顶”两个按钮。
   - 是否达标：达标，已不是单纯按钮提示，玩家能直接看到本次要弃掉或放回的具体卡。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\老派系-OR：Zombie-Walker-可选弃掉或放回牌库顶，并能走完整弃牌分支\legacy-or-zombie-walker-discard-resolved.png`
   - 我实际看到：选择“弃掉”后交互消失，右下弃牌堆展示了“大副 / First Mate”，牌库数量从 2 变为 1。
   - 是否达标：达标，展示提示和后续弃牌结算链路一致。

## 结论

行尸的牌库顶选择现在会显示卡牌本体；已有显式传入 `displayCard` 的按钮类交互也会因通用透传修复而显示上下文卡牌。
