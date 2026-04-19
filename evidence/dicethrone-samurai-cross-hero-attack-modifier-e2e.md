# Dice Throne 武士跨角色攻击修正 E2E 证据

## 本次目标

验证武士两张攻击修正牌在真实 UI 链路中的跨角色表现与状态落地：

1. `card-righteousness` 对僧侣时，固定命中 `Katana` 分支并展示 `+2 damage`
2. `card-zanshin` 对圣骑士时，固定产出 5 颗额外骰并同步伤害 / 耻辱 / 反击结果
3. `Masamune II` 不在本次 E2E 目标内；其升级差异以规则文档、locale 与定向回归为准

## 执行命令

- `npm run test:e2e:ci:file -- e2e/dicethrone-watch-out-spotlight.e2e.ts "samurai righteousness should resolve a valid branch against monk"`
- `npm run test:e2e:ci:file -- e2e/dicethrone-watch-out-spotlight.e2e.ts "samurai zanshin should settle 5 bonus dice and synchronize effects against paladin"`

## 关键发现

- 之前武士 E2E 不稳定的首因不是武士业务逻辑，而是测试基础设施缺口。
- `LocalGameProvider` 原先直接使用 `createSeededRandom(seed)`，没有把 `TestHarness.random` / `TestHarness.dice` 接到 `executePipeline()` 使用的随机源上。
- 结果是 `window.__BG_TEST_HARNESS__.dice.setValues([...])` 在本地 E2E 中无法稳定控制 `random.d(6)`，会让武士奖励骰分支看起来“像随机失控”。
- 本次已在 `src/engine/transport/react.tsx` 中补齐测试环境随机桥接，让本地 provider 在测试模式下通过 `TestHarness.random.wrap(...)` 驱动 `random()` / `d()` / `range()` / `shuffle()`。
- 在此基础上，`e2e/dicethrone-watch-out-spotlight.e2e.ts` 新增了两条武士跨角色用例，并使用固定骰值注入验证真实 UI。
- `Masamune II` 不属于本次新增 E2E 的验证目标。
- 当前仓库内与 `Masamune II` 相关的代码、locale、规则文档和定向回归已经形成闭环；因此这里不再把它保留为 blocker，而是把它视为“由非 E2E 证据承担”的已闭环项。

## 截图审查

### 1. Righteousness 对 Monk

![Righteousness 对 Monk](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-vs-monk.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-vs-monk.png`

审查结论：

- 画面中央能看到 `Dice Results` 和单颗奖励骰结果文本 `Katana: +2 damage`。
- 右侧攻击修正栏顶部存在 `+2` badge，说明 UI 把这次攻击修正确认为当前攻击的活动修正。
- 左下资源区显示 `CP 0`，说明这张牌已实际消费费用，不是只做前端展示。
- 该截图与 E2E 断言一致：`pendingAttack.bonusDamage = 2`，`attackModifierBonusDamage = 2`，对手未获得 `Shame`，自己未获得 `Back Strike`。

### 2. Zanshin 对 Paladin

![Zanshin 对 Paladin](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin/10-samurai-zanshin-vs-paladin.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-vs-paladin.png`

审查结论：

- 画面中央出现 5 颗额外骰横向排布，符合 `displayOnly` 的 5 骰展示契约。
- 右侧攻击修正栏顶部仍显示 `+2`，与 `Zanshin` 中两颗 `Katana` 贡献的额外伤害一致。
- 左下资源区显示 `CP 0`，说明卡牌费用已经结算。
- 该截图与状态断言一致：5 颗额外骰最终面值为 `['katana', 'helm', 'rising_sun', 'rising_sun', 'katana']`，落地结果为 `+2 damage`、对手 `1 Shame`、自己 `2 Back Strike`。

## 与单元测试的对照

- `src/games/dicethrone/__tests__/cross-hero.test.ts` 已有武士跨角色逻辑测试，覆盖：
  - `Righteousness` 的 `Katana` / `Helm` 分支
  - `Zanshin` 的 5 骰结算
  - `upgrade-masamune-2` 的 6 骰变体
- 本次新增 E2E 不是替代这些逻辑测试，而是补上 UI 真实展示、测试模式随机可控、活动攻击修正 badge 与 display-only overlay 的整链验证。

## 本轮结论

- 武士跨角色攻击修正的 UI 链路已经有可重复、可审查的 E2E 证据。
- 本轮修复的真实收益点是测试基础设施：以后本地 Dice Throne E2E 使用 `TestHarness.dice.setValues()` 时，`random.d(6)` 终于会被同一套注入控制。
- `Masamune II` 当前不再是这条证据链上的 blocker；本文件只记录 `Righteousness / Zanshin` 真实 UI 链路的补证结果。
