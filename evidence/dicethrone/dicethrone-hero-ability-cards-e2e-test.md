# DiceThrone 新角色复合升级 E2E 验收

时间：`2026-04-07`

范围：
- 枪手与武士手牌 atlas 预览
- 枪手与武士复合升级牌的整卡预览、升级落位、技能变体结算
- 枪手关键日志文案是否区分“打出升级卡”和“发动技能变体”
- 主阶段牌/攻击修正牌打出后是否出现“自动补抽”回归

## 结论

- 枪手 `slot-22 / 23 / 24` 已按真实模型收回到“升级卡 -> 基础技能 -> variants”。
- `死亡之眼 II` 打出后进入玩家面板技能槽，不进弃牌堆；其下半区 `执法者` 以技能变体结算，并在日志中显示为“发动技能：执法者”。
- `枪托击打`、`标记目标`、`执法者` 都不再以独立手牌语义进入日志或弃牌流程。
- 武士复合升级牌在手牌与升级后界面中都显示整张物理牌，未见“只剩上半张”的运行时语义。
- 本轮 E2E 强制校验了打牌后的精确手牌剩余数，未复现“每打出牌都会立刻抓牌”。
- **补充（2026-04-12）**：武士 `昂首无畏 II（Stand Tall II）` 的防御掷骰语义（4 可掷 + 1 locked）与“无盾不自加耻辱”已通过 E2E 场景闭环；武士 `正宗 II（Masamune II）` 的 **6 骰奖励骰特写** UI 已通过 E2E 闭环（特写出现 → 关闭 → 最终可继续）。

## 截图证据

### 1. 枪手手牌预览显示整张复合物理牌

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\preview-gunslinger-hand.png`

我实际看到：
- 手牌中的 `左轮速射 II`、`掩护射击 II`、`对决 II` 都显示完整卡面。
- `左轮速射 II` 这张牌的下半区内容仍在卡面里可见，不是只剩上半张。
- 没有 shimmer 占位，也没有把下半区误切成另一张手牌。

是否达到验收标准：
- 达到。枪手复合升级牌的手牌预览已经回到整卡语义。

### 2. 武士手牌预览显示整张复合物理牌

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\preview-samurai-hand.png`

我实际看到：
- 手牌中的 `肃穆之仪 II`、`武道 II`、`正宗 II` 都显示完整卡面。
- `正宗 II` 的下半区内容仍可见，不是只显示上半截。
- 视觉上没有出现半张裁切或错图。

是否达到验收标准：
- 达到。武士复合升级牌的手牌预览也已经回到整卡语义。

### 3. 枪手打出 `死亡之眼 II` 后进入玩家面板，不进弃牌堆

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\gunslinger-upgrade-deadeye-after-play.png`

我实际看到：
- 玩家面板右上技能槽叠加的是整张 `死亡之眼 II` 物理牌，且下半区 `执法者` 仍可见。
- 右下弃牌位没有把这张升级牌当成普通弃牌放进去。
- 左侧 CP 为 `8`，和打出 `2 CP` 升级卡后的资源变化一致。

是否达到验收标准：
- 达到。核心 bug“升级牌进入弃牌堆 / 只显示成下半子区牌”在这张图上未复现。

### 4. 枪手 ActionLog 正确记录“打出升级卡：死亡之眼 II”

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\gunslinger-upgrade-deadeye-action-log.png`

我实际看到：
- 日志里有 `打出升级卡死亡之眼 II`。
- 同组日志里有 `消耗 2 CP`。
- 这条升级日志没有串成 `执法者`、`掩护射击 II` 或别的卡名。

是否达到验收标准：
- 达到。升级卡日志语义正确。

### 5. 枪手 `死亡之眼 II` 主效果结算为 8 点不可防御伤害

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\gunslinger-deadeye-attack-resolved.png`

我实际看到：
- 对手 HP 从 `50` 变成 `42`。
- 对手头像下有 `击倒` 状态图标。
- 玩家面板上的 `死亡之眼 II` 仍保留为整张升级牌，不会在结算后掉进弃牌流程。

是否达到验收标准：
- 达到。升级后的主技能实际走的是 `deadeye-2-main`，不是误触下半区 `执法者`。

### 6. 枪手 `执法者` 作为技能变体发动，而不是独立手牌打出

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\gunslinger-the-law-action-log.png`

我实际看到：
- 日志里明确写的是 `发动技能：执法者`，不是 `打出卡牌执法者`。
- 同组效果日志包括 `获得闪避 x1`、`获得赏金 x1`、`施加击倒 +1`。
- 底部仍保留上一条 `打出升级卡死亡之眼 II`，两层语义被正确区分开。

是否达到验收标准：
- 达到。`执法者` 已经回到技能变体语义。

### 7. 枪手 `枪托击打` 作为技能变体发动，而不是独立手牌打出

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\gunslinger-pistol-whip-action-log.png`

我实际看到：
- 日志里明确写的是 `发动技能：枪托击打`，不是 `打出卡牌枪托击打`。
- 上方效果日志包括 `获得闪避 x1`、`施加击倒`、`造成 1 点伤害`。
- 最底部上一条仍是 `打出升级卡左轮速射 II`。

是否达到验收标准：
- 达到。`枪托击打` 已回到升级后技能变体语义。

### 8. 枪手复合升级主链结束后，玩家面板保留整张升级牌

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-hero-ability-cards-e2e\gunslinger-main-cards-end-to-end.png`

我实际看到：
- `死亡之眼 II` 仍以整张复合物理牌形式留在技能槽。
- 当前阶段已经推进到 `主要阶段(2)`，说明本次技能链已正常走完。
- 画面中没有出现把下半区单独当成手牌贴到弃牌位的现象。

是否达到验收标准：
- 达到。复合升级牌在完整链路结束后仍保持正确展示语义。

---

## 2026-04-12 补充：武士防御/奖励骰特写链路（成功证据链）

> 说明：本节是对 “DiceThrone 新角色（武士/枪手）D1–D49 全量补审” 的补测闭环，
> 重点验证 **需要分步确认/阶段推进/特写关闭** 的 UI 交互链路；证据必须是“成功路径连续截图”，不能用失败 toast 充当收口。

### 9. 武士 `昂首无畏 II（Stand Tall II）`：4 骰防御语义 + 结算后无耻辱（成功链路）

截图（连续链路）：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-stand-tall-2-before-response.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-stand-tall-2-after-start-defense.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-stand-tall-2-defense-roll-4dice.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-stand-tall-2-settled-no-shame.png`

我实际看到：
- 在进入防御响应后，会出现“开始防御 / Start Defense”提示层；点击后进入真实防御掷骰面板。
- DiceTray UI 仍渲染 5 颗骰子，但可掷语义为 **4 颗可掷 + 1 颗 locked（isKept）**（与引擎 `rollDiceCount=4` 一致），不是误显示成 4 颗实体骰。
- 结算收口后流程回到主阶段，且在“没有头盔/旭日抵抗”的场景下，武士自身 **未被错误施加耻辱**（满足“无盾不自加耻辱”的验收点）。

是否达到验收标准：
- 达到。本轮要求的“防御掷骰语义 + 成功链路收口 + 最终状态正确”均已在连续截图中可复查。

### 10. 武士 `正宗 II（Masamune II）`：6 骰奖励骰特写出现 → 关闭 → 最终可继续（成功链路）

截图（连续链路）：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-masamune-2-before-trigger.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-masamune-2-bonus-die-overlay.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-masamune-2-bonus-die-closed.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-masamune-2-final.png`

我实际看到：
- 触发后出现奖励骰特写 overlay，并且骰子数量为 **6 颗**（Masamune II 的关键验收点）。
- overlay 文案区能看到汇总结果（本轮用例是 `2 武士刀 / 2 耻辱 / 2 反击` 的代表性组合），不是只出现“掷骰结果”但没有结论。
- 关闭 overlay 后，特写完全消失，且流程仍处于可继续的稳定阶段（没有卡死在 pending settlement）。

是否达到验收标准：
- 达到。满足“奖励骰特写必须给成功路径证据链”的强制要求（出现 → 关闭 → 最终态可继续）。

## 自动化验证

已实际运行并通过：
- `npm run test:e2e:ci -- e2e/dicethrone/temp-dicethrone-ability-atlas-regression.e2e.ts`
- `npx vitest run --config vitest.config.audit.ts --configLoader native src/games/dicethrone/__tests__/card-cross-audit.test.ts`
- `npx vitest run src/games/dicethrone/__tests__/cross-hero.test.ts -t "执法者|枪托击打|标记目标|左轮速射应造成 8 点伤害|masamune ii power up"`
- `npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`

补充（2026-04-12 本轮实际复跑的单用例 E2E）：
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/temp-dicethrone-ability-atlas-regression.e2e.ts "samurai Stand Tall II 应显示 4 骰防御并在无盾时不自加 Shame" --reporter=line`
- `BG_NODE_MAX_OLD_SPACE_SIZE=4096 node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/temp-dicethrone-ability-atlas-regression.e2e.ts "samurai Masamune II 应展示 6 骰奖励骰并能完成真实 UI 收口" --reporter=line`

补充（2026-04-12 16:25-16:26 再次复跑确认）：
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/temp-dicethrone-ability-atlas-regression.e2e.ts "samurai Stand Tall II 应显示 4 骰防御并在无盾时不自加 Shame" --reporter=line`
- `BG_NODE_MAX_OLD_SPACE_SIZE=4096 node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/temp-dicethrone-ability-atlas-regression.e2e.ts "samurai Masamune II 应展示 6 骰奖励骰并能完成真实 UI 收口" --reporter=line`

本轮 E2E 门禁覆盖点：
- 升级牌打出后是否登记到 `upgradeCardByAbilityId`
- 升级牌是否从手牌移除且不进入弃牌堆
- 枪手 `死亡之眼 II` 主效果是否真正造成 `8` 点伤害
- 枪手 `枪托击打 / 标记目标 / 执法者` 是否通过技能槽变体触发
- 打牌后手牌是否异常回补

## 残余风险

- 本文档覆盖的是枪手/武士复合升级的主链与代表性主阶段牌，不等于两位新角色所有交互都已穷尽审计。
- 历史 `crops` / `hand-preview` 脚本仍可继续清理，但当前正式运行时合同已经通过端到端验证，不再依赖这些中间产物解释语义。
