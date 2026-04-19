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

## 截图证据

### 1. 枪手手牌预览显示整张复合物理牌

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\preview-gunslinger-hand.png`

我实际看到：
- 手牌中的 `左轮速射 II`、`掩护射击 II`、`对决 II` 都显示完整卡面。
- `左轮速射 II` 这张牌的下半区内容仍在卡面里可见，不是只剩上半张。
- 没有 shimmer 占位，也没有把下半区误切成另一张手牌。

是否达到验收标准：
- 达到。枪手复合升级牌的手牌预览已经回到整卡语义。

### 2. 武士手牌预览显示整张复合物理牌

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\preview-samurai-hand.png`

我实际看到：
- 手牌中的 `肃穆之仪 II`、`武道 II`、`正宗 II` 都显示完整卡面。
- `正宗 II` 的下半区内容仍可见，不是只显示上半截。
- 视觉上没有出现半张裁切或错图。

是否达到验收标准：
- 达到。武士复合升级牌的手牌预览也已经回到整卡语义。

### 3. 枪手打出 `死亡之眼 II` 后进入玩家面板，不进弃牌堆

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\gunslinger-upgrade-deadeye-after-play.png`

我实际看到：
- 玩家面板右上技能槽叠加的是整张 `死亡之眼 II` 物理牌，且下半区 `执法者` 仍可见。
- 右下弃牌位没有把这张升级牌当成普通弃牌放进去。
- 左侧 CP 为 `8`，和打出 `2 CP` 升级卡后的资源变化一致。

是否达到验收标准：
- 达到。核心 bug“升级牌进入弃牌堆 / 只显示成下半子区牌”在这张图上未复现。

### 4. 枪手 ActionLog 正确记录“打出升级卡：死亡之眼 II”

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\gunslinger-upgrade-deadeye-action-log.png`

我实际看到：
- 日志里有 `打出升级卡死亡之眼 II`。
- 同组日志里有 `消耗 2 CP`。
- 这条升级日志没有串成 `执法者`、`掩护射击 II` 或别的卡名。

是否达到验收标准：
- 达到。升级卡日志语义正确。

### 5. 枪手 `死亡之眼 II` 主效果结算为 8 点不可防御伤害

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\gunslinger-deadeye-attack-resolved.png`

我实际看到：
- 对手 HP 从 `50` 变成 `42`。
- 对手头像下有 `击倒` 状态图标。
- 玩家面板上的 `死亡之眼 II` 仍保留为整张升级牌，不会在结算后掉进弃牌流程。

是否达到验收标准：
- 达到。升级后的主技能实际走的是 `deadeye-2-main`，不是误触下半区 `执法者`。

### 6. 枪手 `执法者` 作为技能变体发动，而不是独立手牌打出

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\gunslinger-the-law-action-log.png`

我实际看到：
- 日志里明确写的是 `发动技能：执法者`，不是 `打出卡牌执法者`。
- 同组效果日志包括 `获得闪避 x1`、`获得赏金 x1`、`施加击倒 +1`。
- 底部仍保留上一条 `打出升级卡死亡之眼 II`，两层语义被正确区分开。

是否达到验收标准：
- 达到。`执法者` 已经回到技能变体语义。

### 7. 枪手 `枪托击打` 作为技能变体发动，而不是独立手牌打出

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\gunslinger-pistol-whip-action-log.png`

我实际看到：
- 日志里明确写的是 `发动技能：枪托击打`，不是 `打出卡牌枪托击打`。
- 上方效果日志包括 `获得闪避 x1`、`施加击倒`、`造成 1 点伤害`。
- 最底部上一条仍是 `打出升级卡左轮速射 II`。

是否达到验收标准：
- 达到。`枪托击打` 已回到升级后技能变体语义。

### 8. 枪手复合升级主链结束后，玩家面板保留整张升级牌

截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\gunslinger-main-cards-end-to-end.png`

我实际看到：
- `死亡之眼 II` 仍以整张复合物理牌形式留在技能槽。
- 当前阶段已经推进到 `主要阶段(2)`，说明本次技能链已正常走完。
- 画面中没有出现把下半区单独当成手牌贴到弃牌位的现象。

是否达到验收标准：
- 达到。复合升级牌在完整链路结束后仍保持正确展示语义。

## 自动化验证

已实际运行并通过：
- `npm run test:e2e:ci -- e2e/temp-dicethrone-ability-atlas-regression.e2e.ts`
- `npx vitest run --config vitest.config.audit.ts --configLoader native src/games/dicethrone/__tests__/card-cross-audit.test.ts`
- `npx vitest run src/games/dicethrone/__tests__/cross-hero.test.ts -t "执法者|枪托击打|标记目标|左轮速射应造成 8 点伤害|masamune ii power up"`
- `npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`

本轮 E2E 门禁覆盖点：
- 升级牌打出后是否登记到 `upgradeCardByAbilityId`
- 升级牌是否从手牌移除且不进入弃牌堆
- 枪手 `死亡之眼 II` 主效果是否真正造成 `8` 点伤害
- 枪手 `枪托击打 / 标记目标 / 执法者` 是否通过技能槽变体触发
- 打牌后手牌是否异常回补

## 残余风险

- 本文档覆盖的是枪手/武士复合升级的主链与代表性主阶段牌，不等于两位新角色所有交互都已穷尽审计。
- 历史 `crops` / `hand-preview` 脚本仍可继续清理，但当前正式运行时合同已经通过端到端验证，不再依赖这些中间产物解释语义。
