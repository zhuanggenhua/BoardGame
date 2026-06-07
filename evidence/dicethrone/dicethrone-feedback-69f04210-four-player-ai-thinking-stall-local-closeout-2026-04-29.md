# Dice Throne 反馈 69f04210 本地验收收口说明（2026-04-29）

> 2026-06-06 当前有效口径：本文只对应反馈 `69f042109b68d90ee98368fa` 这一条 4 人 AI thinking stall 的本地 closeout 记录，不是当前 DiceThrone 所有 4 人模式卡思考、所有 targetingRoll 卡死问题都已彻底收口的证明，也不是新英雄补审出口。阅读时必须把它理解成单条反馈的历史验收记录。

## 反馈原文

- `四人ai模式几乎每次都会卡思考界面`

线上反馈对应：

- feedbackId：`69f042109b68d90ee98368fa`
- gameId：`dicethrone`
- matchId：`M_SFrGJI89o`

## 为什么本轮不能做线上复核

- 生产库里已查到原始反馈和同局系统反馈，但该对局当前不再保留可继续接管的完整进行中 match 状态，只剩反馈记录。
- 线上能拿到的最强现场证据是：
  - 用户反馈本身；
  - 同一 `matchId` 的系统反馈 `[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed`；
  - 该系统反馈的 `stateSnapshot`，显示卡点位于 `targetingRoll`，`legalActions.total=0`，且 `shared/seatUnsatisfiableReason=empty-options`。
- 这足以做根因定位，但不足以再对原线上对局做可重复“修后复核”。

## 本地替代复现场景

- 以 4 人 `targetingRoll` 为真实语义场景，构造“选目标交互意外丢失，但阶段仍停在 `targetingRoll`、`pendingAttack` 仍未完成”的状态。
- 预期行为：
  - 再次推进时应重建选目标交互；
  - 不能静默停在 `targetingRoll`；
  - 不能让 watchdog 只剩 `ADVANCE_PHASE` 失败而无合法恢复路径。

## 命中的根因

- `DiceThrone` 领域层在 `targetingRoll` 的 5/6 分支里，把“刚处理完交互、等待 `CHOICE_RESOLVED` reduce 落地”的短暂窗口，和“交互已经丢失但选择尚未完成”的坏状态混为一谈。
- 旧逻辑一旦看到：
  - `flowHalted === true`
  - `interaction.current === undefined`
  - `targetingSelectionPending !== true`
  - `targetingSelectionResolved !== true`
- 就直接跳过重建选目标交互。
- 随后由于 `pendingAttack.defenderId` 仍为空，流程又会 `halt` 在 `targetingRoll`，形成“没弹窗、没合法动作、watchdog 只能失败”的卡死链。

## 修复

- 仅在“本拍命令就是交互响应/取消，正在等待 `CHOICE_RESOLVED` reduce 落地”时，才允许跳过重建选目标交互。
- 如果交互已经丢失，且当前并不是这类同拍收口状态，则必须重建 targeting 选择交互。

相关代码：

- [flowHooks.ts](/D:/gongzuo/webgame/BoardGame/src/games/dicethrone/domain/flowHooks.ts:765)
- [flow.test.ts](/D:/gongzuo/webgame/BoardGame/src/games/dicethrone/__tests__/flow.test.ts:1634)
- [MainActivity.java](/D:/gongzuo/webgame/BoardGame/android/app/src/main/java/top/easyboardgame/app/MainActivity.java:83)

## 实际验证

- `.\gradlew.bat :app:compileDebugJavaWithJavac`
- `npx vitest run src/games/dicethrone/__tests__/flow.test.ts -t "4 人模式 targetingRoll 选目标交互意外丢失后，再次推进应重建交互而不是静默卡住|4 人模式 targetingRoll 掷出 5 时由防守队选择目标|4 人模式 targetingRoll 掷出 6 时由进攻方选择目标|targetingRoll 无可选目标时 emergency skip 会清理 pendingAttack 并推进到 main2"`
- `npm run typecheck`

## 收口结论

- 按“线上复核不可执行时允许按本地验收收口”的规则，本条可以 `resolved`。
- 本轮收口依据是：线上已有现场反馈 + 系统反馈快照能锁定卡点，本地已命中对应根因并通过定向回归。

## 剩余风险

- 目前没有原线上对局的完整权威态快照，因此无法证明这就是 `M_SFrGJI89o` 的唯一根因。
- 但至少当前已补住一条和生产快照高度一致的 `targetingRoll` 卡死链，并修掉了并存的 Android `AppUpdatePlugin` 原生注册缺失噪音。

---

**当前阅读说明**：本文只能证明这条 4 人 `targetingRoll` 卡思考反馈曾按本地验收收口，不能外推为当前所有 4 人 AI 停滞、所有 targetingRoll 异常或 DiceThrone 当前整体审计都已收口。
