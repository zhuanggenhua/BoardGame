# Dice Throne 枪手 The Law 多目标交互 E2E 证据

## 范围

- 目标：验证 `card-the-law` 对应的 `selectPlayer + selectCount = 2` 新交互链路已经从 UI 到领域结算闭环。
- 重点：
  - 只选 1 名目标时允许确认；
  - 选择 2 名目标时单次确认即可原子结算两名玩家的 `bounty + knockdown`；
  - 交互完成后 `sys.interaction.current` 被清空。

## 执行命令

```bash
npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "枪手 The Law 多目标交互"
```

## 结果

- 结果：2 passed
- 文件：`e2e/dicethrone-watch-out-spotlight.e2e.ts`
- 用例：
  - `should allow confirming after selecting only one target`
  - `should resolve two selected targets in one confirmation`

## 截图证据

1. 单目标已选择，确认按钮可用：
   [14-the-law-single-target-selected.png](D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\should-allow-confirming-after-selecting-only-one-target\14-the-law-single-target-selected.png)
   - 说明：交互标题已出现，两个目标卡可见；仅选择 `僧侣-A` 后，确认按钮由禁用变为可点击。

2. 双目标已选择：
   [15-the-law-two-targets-selected.png](D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\should-resolve-two-selected-targets-in-one-confirmation\15-the-law-two-targets-selected.png)
   - 说明：`僧侣-A` 与 `圣骑士-B` 同时被选中，满足“至多 2 名目标玩家”的 UI 语义。

3. 双目标结算后：
   [16-the-law-two-targets-resolved.png](D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\should-resolve-two-selected-targets-in-one-confirmation\16-the-law-two-targets-resolved.png)
   - 说明：确认后交互关闭；测试断言同时验证两名目标玩家各获得 `1 bounty` 与 `1 knockdown`。

## 结论

- 这次新增的 `selectPlayer` 多目标交互不再停留在“领域层可跑”。
- 至少对 `The Law` 这条链路，已经完成：
  - OpenSpec 契约补充；
  - UI 单测；
  - 真实 E2E 验证；
  - 截图证据留档。

## Addendum（2026-03-28）：从手牌真实打出链路已补齐

- 先前这份证据只覆盖了“交互已经弹出后如何点击确认”，还没有覆盖“玩家从手牌点击 `The Law` 这张牌”。
- 本轮新增两条 E2E 后，这个缺口也已关闭：
  - `should resolve immediately in 1v1 after clicking the hand card`
  - `should open multi-target interaction after playing from hand in 3-player scene`
- 新增截图：
  1. `1v1` 从手牌点击前：
     [22-the-law-from-hand-1v1-before-play.png](D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\should-resolve-immediately-in-1v1-after-clicking-the-hand-card\22-the-law-from-hand-1v1-before-play.png)
  2. `1v1` 点击后直结算：
     [23-the-law-from-hand-1v1-after-play.png](D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\should-resolve-immediately-in-1v1-after-clicking-the-hand-card\23-the-law-from-hand-1v1-after-play.png)
  3. `3` 人局从手牌点击后，多目标已选择：
     [24-the-law-from-hand-3p-selected-targets.png](D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\should-open-multi-target-interaction-after-playing-from-hand-in-3-player-scene\24-the-law-from-hand-3p-selected-targets.png)
  4. `3` 人局从手牌点击后，多目标结算完成：
     [25-the-law-from-hand-3p-resolved.png](D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\should-open-multi-target-interaction-after-playing-from-hand-in-3-player-scene\25-the-law-from-hand-3p-resolved.png)
- 这意味着 `The Law` 当前已经同时完成了：
  - 从手牌点击打出；
  - `1v1` 直结算；
  - `3+` 人局进入多目标交互；
  - 交互确认后原子化结算多名玩家的 `bounty + knockdown`。

## Addendum（2026-03-28）：四人 2v2 敌我过滤已补齐

- 这轮新发现的真实缺口不在“多目标本身”，而在 `2v2` 团队模式：
  - `handleTheLaw` 之前按“所有非自己玩家”构造候选目标，会把队友也放进 `targetPlayerIds`。
- 已落实修正：
  - `src/games/dicethrone/domain/customActions/gunslinger.ts` 改为复用 `getOpponents(state, attackerId)`，只保留敌方目标。
  - `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 `the law should only target enemies in 4-player team mode`，断言交互只暴露 `['1', '3']`，并验证结算只命中两名敌方。
  - `e2e/dicethrone-simple-start.e2e.ts` 新增四人联机真实点击用例：
    - `Online 4-player The Law: real hand play only offers enemies in 2v2 and resolves on both`
- 执行命令：
  ```bash
  node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts -t "the law can select up to two target players in multiplayer|the law should only target enemies in 4-player team mode" --configLoader native
  npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player The Law: real hand play only offers enemies in 2v2 and resolves on both"
  npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "枪手 The Law (多目标交互|从手牌真实打出)"
  ```
- 结果：
  - `Vitest`: `2 passed`
  - `4 人 E2E`: `1 passed`
  - `既有 The Law E2E 回归`: `4 passed`
- 新增截图：
  1. 四人 2v2 下，真实从手牌点击后只出现两名敌方目标：
     [10-four-player-the-law-enemy-only-selection.png](D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-The-Law-real-hand-play-only-offers-enemies-in-2v2-and-resolves-on-both\10-four-player-the-law-enemy-only-selection.png)
  2. 四人 2v2 下，确认后仅两名敌方拿到 `bounty + knockdown`：
     [11-four-player-the-law-resolved-on-enemies.png](D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-The-Law-real-hand-play-only-offers-enemies-in-2v2-and-resolves-on-both\11-four-player-the-law-resolved-on-enemies.png)
- 裁决：
  - `The Law` 现在已经同时覆盖：
    - `1v1` 直结算；
    - `3` 人局多目标；
    - `4` 人 `2v2` 敌我过滤 + 真实点击结算。
