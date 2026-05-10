# Smash Up shayu / Tornados 派系能力证据

## 审计范围

- 数据：`src/games/smashup/data/factions/tornados.ts`
- 实现：`src/games/smashup/abilities/tornados.ts`、`src/games/smashup/abilities/shayu_common.ts`
- 覆盖卡牌：`tornados_monster_tornado`、`tornados_cyclone`、`tornados_twister`、`tornados_dust_devil`、`tornados_trade_winds`、`tornados_carried_away`、`tornados_whirlwinds`、`tornados_gone_with_the_wind`、`tornados_ripped_off`、`tornados_picked_up`、`tornados_not_in_kansas`、`tornados_over_the_rainbow`
- 覆盖基地：`base_trailer_park`、`base_tornado_alley`

## 真相源与旧实现参考

- 真相源：本轮本地 `shayu` 卡图/基地图、`public/locales/*/game-smashup.json` 文案、派系数据文件。
- 旧实现参考：
  - move / afterScoring：`pirates.ts`
  - base move hook：`domain/baseAbilities.ts`
  - ongoing 转移与 detach/attach：`bear_cavalry.ts`、`domain/reduce.ts`

## 逐项结论

- `Monster Tornado` / `Twister`：push-pull 方向修正为“本基地移出或外部移入当前基地”。
- `Carried Away`：真实手牌入口可选择随从，再选择目标基地。
- `Whirlwinds`：已从“多选后统一移到第一个基地”补强为“每个被选随从分别选择目标基地”。
- `Dust Devil`：beforeScoring 改为 may prompt，不再强制移动。
- `Ripped Off`：使用 `ONGOING_DETACHED` + `ONGOING_ATTACHED`，由 reducer 完成弃牌区去重和重新附着。
- `Tornado Alley`：may prompt，并通过 `BASE_ABILITY_USED` 记录每回合一次。

## 验证证据

- `src/games/smashup/__tests__/shayuFactionAbilities.test.ts`
  - `龙卷风：卷走可通过真实行动入口移动目标随从到另一个基地`
  - `龙卷风：龙卷风怪物可把其他基地低力量随从移入自身基地`
  - `龙卷风：旋风群为每个被选随从分别选择目标基地`
- E2E：`e2e/smashup-shayu-factions.e2e.ts`
  - 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-与-Tornados-代表行动可从手牌真实打出并完成交互\shayu-tornados-carried-away-after-move.png`
  - 肉眼观察：截图中 `Mako / 灰鲭鲨` 已从 `The Deep / 海渊` 移到 `Tornado Alley / 龙卷风走廊`，`Carried Away / 卷走` 已进入弃牌堆，流程回到无交互状态。

## 未覆盖风险

- 本轮 Tornados 新机制高风险链路已补真实入口 E2E：attach/detach、基地替换、beforeScoring special、afterScoring special、Dust Devil may prompt、Tornado Alley once/turn。
- 低风险同类能力仍按结构/行为层覆盖，不逐卡单独 E2E：`Cyclone` self move、`Trade Winds` 双目标互换等。

## 2026-05-10 E2E 补充观察

- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup-shayu-factions.e2e.ts`：12 tests passed。
- 新增 Tornados 玩法截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-疯狂进食与-Tornados-旋风群覆盖多选和逐目标移动交互\shayu-tornados-whirlwinds-after-per-minion-destinations.png`
  - 实际看到：两个 `Twister / 旋风` 分别位于不同基地，`Whirlwinds / 旋风群` 在弃牌区，证明多选后每个随从分别选择目标基地。
  - 是否达标：达标，覆盖 Tornados 新增“多选 + 逐目标目的地”高风险交互。

## 2026-05-10 新机制 E2E 追加观察

- `Ripped Off`：
  - 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-扯走覆盖基地持续行动与随从附着行动的-detach-+-attach-转移\shayu-tornados-ripped-off-base-action-transferred.png`
  - 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-扯走覆盖基地持续行动与随从附着行动的-detach-+-attach-转移\shayu-tornados-ripped-off-minion-action-transferred.png`
  - 实际看到：持续行动已从源基地/源随从转到新目标；测试断言源宿主移除、目标宿主附着，达到 attach/detach 转移验收。
- `Not in Kansas`：
  - 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-不在堪萨斯替换基地时保留随从并清理基地-随从行动卡\shayu-tornados-not-in-kansas-after-base-replace.png`
  - 实际看到：基地替换后随从保留；测试断言基地 ongoing 与随从 attached action 清空，baseDeck 顺序更新。
- `Tornado Alley`：
  - 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-trigger-open.png`
  - 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-second-move-no-repeat-trigger.png`
  - 实际看到：首次移入打开基地能力提示，第二次移入后没有重复 prompt；测试断言第二个候选未被再次拉入。
- 计分前/后 special：
  - `Over the Rainbow` / `Picked Up` 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-计分前特殊牌从-Me-First-窗口打出并完成移入-移出计分基地\shayu-tornados-over-the-rainbow-after-move-in.png`；`...\shayu-tornados-picked-up-after-move-out.png`
  - `Dust Devil` 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-尘卷风计分前触发可选移动到计分基地\shayu-tornados-dust-devil-before-scoring-prompt.png`；`...\shayu-tornados-dust-devil-after-move-to-scoring.png`
  - `Gone with the Wind` 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`；`...\shayu-tornados-gone-with-the-wind-after-scoring-cleanup.png`
  - 实际看到：Me First/afterScoring 真实响应入口可见；Dust Devil prompt 可选移动；Gone with the Wind 清场后 `Twister` 保留在安全基地且不进弃牌。均达标。

