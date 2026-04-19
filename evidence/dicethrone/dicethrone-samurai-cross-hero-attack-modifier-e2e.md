# Dice Throne 武士跨角色攻击修正 E2E 证据

## 本次目标

验证武士两张攻击修正牌在真实 UI 链路中的跨角色表现与状态落地：

1. `card-righteousness` 对僧侣时，固定命中 `Katana` 分支并展示 `+2 damage`
2. `card-zanshin` 对圣骑士时，固定产出 5 颗额外骰并同步伤害 / 耻辱 / 反击结果
3. `Masamune II` 不在本次 E2E 目标内；其升级差异以规则文档、locale 与定向回归为准

## 执行命令

- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai righteousness should resolve a valid branch against monk"`
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai zanshin should settle 5 bonus dice and synchronize effects against paladin"`

## 关键发现

- 之前武士 E2E 不稳定的首因不是武士业务逻辑，而是测试基础设施缺口。
- `LocalGameProvider` 原先直接使用 `createSeededRandom(seed)`，没有把 `TestHarness.random` / `TestHarness.dice` 接到 `executePipeline()` 使用的随机源上。
- 结果是 `window.__BG_TEST_HARNESS__.dice.setValues([...])` 在本地 E2E 中无法稳定控制 `random.d(6)`，会让武士奖励骰分支看起来“像随机失控”。
- 本次已在 `src/engine/transport/react.tsx` 中补齐测试环境随机桥接，让本地 provider 在测试模式下通过 `TestHarness.random.wrap(...)` 驱动 `random()` / `d()` / `range()` / `shuffle()`。
- 在此基础上，`e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts` 新增了两条武士跨角色用例，并使用固定骰值注入验证真实 UI。
- `Masamune II` 不属于本次新增 E2E 的验证目标。
- 当前仓库内与 `Masamune II` 相关的代码、locale、规则文档和定向回归已经形成闭环；因此这里不再把它保留为 blocker，而是把它视为“由非 E2E 证据承担”的已闭环项。

## 截图审查

### 1. Righteousness 对 Monk

本条按“成功路径证据链”分段截图，避免只靠最终态截图宣告通过。

#### 1.1 打出后徽章出现（效果提示）

![Righteousness badge after play](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-badge-after-play.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-badge-after-play.png`

肉眼审查结论：
- 右侧攻击修正栏顶部的活动徽章已可见，属于“效果提示”（不是“结果证明”）。

#### 1.2 奖励骰 / 特写 overlay 出现（成功路径）

![Righteousness bonus die overlay](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-bonus-die-overlay.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-bonus-die-overlay.png`

肉眼审查结论：
- 中央区域出现 `Dice Results / 投掷结果` 特写，并显示分支文本（`Katana: +2 damage / 武士刀：+2 伤害`），属于该牌“打出即掷骰即生效”的即时结算展示（与 `Wild West` 的 Loaded token 延迟触发不同）。

#### 1.3 关闭 overlay（证明可继续推进）

![Righteousness bonus die closed](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-bonus-die-closed.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-bonus-die-closed.png`

肉眼审查结论：
- 点击遮罩后 overlay 消失，交互可继续推进（避免“卡死在特写层”）。

#### 1.4 settled（结算完成，临时态清空）

![Righteousness settled](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-settled.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-settled.png`

肉眼审查结论：
- 特写结算临时态已清空（E2E 断言：`pendingBonusDiceSettlement` 为 `null`），避免残留导致二次误触发。

#### 1.5 最终画面（对照断言）

![Righteousness vs Monk](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-vs-monk.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-vs-monk.png`

肉眼审查结论：
- 右侧攻击修正栏顶部仍显示 `+2`，与本次分支 `Katana +2` 一致。
- 左下资源区 `CP 0`，说明费用已实际结算。
- 与 E2E 断言一致：`pendingAttack.bonusDamage = 2`、`attackModifierBonusDamage = 2`；对手未获得 `Shame`，自己未获得 `Back Strike`。

### 2. Zanshin 对 Paladin

同样按“成功路径证据链”分段截图。

#### 2.1 打出后徽章出现（效果提示）

![Zanshin badge after play](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin/10-samurai-zanshin-badge-after-play.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-badge-after-play.png`

肉眼审查结论：
- 攻击修正栏顶部的活动徽章已出现，用于提示本次攻击存在 `Zanshin` 的攻击修正效果。

#### 2.2 5 骰奖励骰 / 特写 overlay 出现（成功路径）

![Zanshin bonus die overlay](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin/10-samurai-zanshin-bonus-die-overlay.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-overlay.png`

肉眼审查结论：
- 中央区域出现 5 颗额外骰横向排布，符合 `displayOnly` 的 5 骰展示契约。

#### 2.3 关闭 overlay（证明可继续推进）

![Zanshin bonus die closed](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin/10-samurai-zanshin-bonus-die-closed.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-closed.png`

肉眼审查结论：
- 点击遮罩后 overlay 消失，可继续推进到后续阶段。

#### 2.4 settled（结算完成，临时态清空）

![Zanshin settled](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin/10-samurai-zanshin-settled.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-settled.png`

肉眼审查结论：
- 特写展示的临时 settlement 状态已清空（E2E 断言：`pendingBonusDiceSettlement` 被消费并归零）。

#### 2.5 最终画面（对照断言）

![Zanshin vs Paladin](../../test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin/10-samurai-zanshin-vs-paladin.png)

截图路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-vs-paladin.png`

肉眼审查结论：
- 右侧攻击修正栏顶部显示 `+2`，与两颗 `Katana` 的额外伤害一致。
- 左下资源区 `CP 0`，说明卡牌费用已经结算。
- 与状态断言一致：5 颗额外骰面值为 `['katana', 'helm', 'rising_sun', 'rising_sun', 'katana']`，落地结果为：`+2 damage`、对手 `1 Shame`、自己 `2 Back Strike`。

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
