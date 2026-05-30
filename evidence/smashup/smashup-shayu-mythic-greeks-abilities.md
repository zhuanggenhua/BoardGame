# Smash Up shayu / Mythic Greeks 派系能力证据

## 审计范围

- 数据：`src/games/smashup/data/factions/mythic_greeks.ts`
- 实现：`src/games/smashup/abilities/mythic_greeks.ts`、`src/games/smashup/abilities/shayu_common.ts`
- 覆盖卡牌：`mythic_greeks_odysseus`、`mythic_greeks_argonaut`、`mythic_greeks_jason`、`mythic_greeks_heracles`、`mythic_greeks_spartan`、10 张 `Favor of ...`
- 覆盖基地：`base_oracle_at_delphi`、`base_wooden_horse`

## 真相源与旧实现参考

- 真相源：本轮本地 `shayu` 卡图/基地图、`public/locales/*/game-smashup.json` 文案、派系数据文件。
- 旧实现参考：
  - extra action / extra minion：`wizards.ts`
  - discard/deck 操作：`zombies.ts`、`wizards.ts`
  - onActionPlayed trigger：`ongoingEffects.ts`

## 逐项结论

- `Favor of Apollo`：抽 1 张并授予额外行动额度，E2E 证明 `actionLimit` 变为 2。
- `Favor of Hera`：改为玩家多选至多两个随从放 +1 指示物。
- `Favor of Poseidon`：改为玩家多选至多三张弃牌洗回牌库。
- `Favor of Dionysus`：补为“可选择放回牌库顶”，不再强制放顶。
- `Argonaut`：已触发 Mythic Greeks 派系内“当你打出行动”代表能力（Odysseus/Heracles/Spartan），比初版硬编码第一目标更接近真实触发链。
- `Wooden Horse`：改为可选一个随从 +2，而不是自动全体 +2。

## 验证证据

- `src/games/smashup/__tests__/shayuFactionAbilities.test.ts`
  - `神话希腊：阿波罗的恩惠抽牌并授予额外行动额度`
  - `神话希腊：赫拉的恩惠按玩家选择至多两个随从放置指示物`
  - `神话希腊：波塞冬的恩惠按玩家选择弃牌洗回牌库`
  - `神话希腊：狄俄尼索斯的恩惠可选择是否放回牌库顶`
  - `神话希腊：阿尔戈英雄触发行动态持续能力`
- E2E：`e2e/smashup-shayu-factions.e2e.ts`
  - 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-代表行动可从手牌真实打出并改变权威状态\shayu-mythic-greeks-apollo-after-action.png`
  - 肉眼观察：截图中 `Favor of Apollo / 阿波罗的恩惠` 已打出并显示已打出状态，`Spartan / 斯巴达人` 出现在手牌区；测试同时断言 `actionLimit=2`。

## 未覆盖风险

- `Argonaut` 当前已用 E2E 覆盖 Mythic Greeks 内 Odysseus/Heracles/Spartan action-trigger 代表链；跨派系所有 `onActionPlayed` 能力的组合爆炸仍建议后续参数化审计工厂，不作为本轮新机制 E2E 缺口。
- `Jason` 已补真实入口 E2E（见 Argonaut 代表链截图）；简单 Favor 行动仍按 L1/L2 覆盖，不逐卡单独 E2E。

## 2026-05-10 E2E 补充观察

- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup-shayu-factions.e2e.ts`：12 tests passed。
- 新增 Mythic Greeks 玩法截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-赫拉与波塞冬覆盖随从多选和弃牌多选交互\shayu-mythic-greeks-hera-after-two-counters.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-赫拉与波塞冬覆盖随从多选和弃牌多选交互\shayu-mythic-greeks-poseidon-after-discard-shuffle.png`
- 实际看到：Hera 截图中两个目标随从上都有 +1 指示物；Poseidon 流程结束后无待处理交互，测试断言弃牌选择洗回牌库。
- 是否达标：达标，覆盖 Mythic Greeks 新增“随从多选指示物”和“弃牌多选洗回牌库”两类交互。

## 2026-05-10 Argonaut 新机制 E2E 追加观察

- 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-阿尔戈英雄真实入场会触发奥德修斯-赫拉克勒斯-斯巴达人的行动后能力\shayu-mythic-greeks-argonaut-odysseus-prompt.png`
  - 实际看到：真实打出 `Argonaut / 阿尔戈英雄` 后进入 `Odysseus` 选择提示，证明 action-trigger 队列不是直接注入 prompt。
- 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-阿尔戈英雄真实入场会触发奥德修斯-赫拉克勒斯-斯巴达人的行动后能力\shayu-mythic-greeks-argonaut-after-action-triggers.png`
  - 实际看到：流程回到可继续推进状态；测试断言 `Odysseus` 与 `Spartan` 获得 +1 指示物，`Heracles` 获得临时 +1，且 `Spartan` once/turn metadata 写入。达标。

