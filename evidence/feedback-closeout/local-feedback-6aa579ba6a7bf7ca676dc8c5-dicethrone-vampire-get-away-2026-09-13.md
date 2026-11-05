# 本地反馈收口：DiceThrone 吸血鬼“起开！”卡图与催眠移除日志

- 反馈 ID：`6aa579ba6a7bf7ca676dc8c5`
- 本轮口径：本地数据库反馈
- 统计时间：2026-09-13T02:57:42+08:00
- 游戏：DiceThrone
- 反馈原文：`吸血鬼的起开卡牌无法显示，并且打出后眩晕直接消失了`
- 原始入口：`/play/dicethrone/match/r2dGcQ6GA7r?playerID=0`

## 效果描述原文

- `起开！`：`从 1 名玩家身上移除 1 个状态效果。`
  - 来源：`public/locales/zh-CN/game-dicethrone.json` 的 `cards.card-get-away.description`
- `催眠`：`正面状态效果，堆叠上限：1。强迫一名对手重掷 1 颗骰子：拥有该指示物的玩家可以花费 1 个催眠并投掷 1 颗骰子。如果投出 5-6，你可以强迫对手重掷任意 1 颗骰子。`
  - 来源：`public/locales/zh-CN/game-dicethrone.json` 的 `tokens.mesmerize.description`

## 现场对照

- 反馈状态快照里，吸血鬼玩家已有 `催眠 ×1`，也有 `眩光 ×1`。
- 对手天使打出 `起开！` 后，吸血鬼玩家的 `催眠` 变为 0，`眩光` 仍为 1。
- 对照结论：规则结算不是“眩光被直接移除”；被移除的是吸血鬼的 `催眠`。按 `起开！` 牌面，它可以从 1 名玩家身上移除 1 个状态效果；按当前合同，`催眠` 是可被移除的正面状态效果。

## 修复与当前实现

- 卡图显示：当前 `src/games/dicethrone/ui/cardPreviewHelper.ts` 会按角色牌库解析通用牌预览，不再只用全局默认顺序；`card-get-away` 在吸血鬼与天使牌库都能解析到对应图集。
- 玩家日志：当前 `src/games/dicethrone/game.ts` 已让状态移除类卡牌的 `REMOVE_STATUS` 结果进入行动日志，并在 `TOKEN_CONSUMED` / `STATUS_REMOVED` 日志里带上来源卡；玩家能看到“以起开！从玩家身上移除催眠 ×1（剩余 0）”。
- 规则结算未改：保留 `起开！` 可以移除 `催眠` 的行为；本轮修的是卡图显示与日志解释，不把合法移除改成无效。

## 验证

- `npx tsc --noEmit --pretty false --project tsconfig.json`
  - 结果：通过
- `npx vitest run --config vitest.config.ts --configLoader native src/games/dicethrone/__tests__/cardPreviewHelper.test.ts src/games/dicethrone/__tests__/actionLogFormat.test.ts --reporter=dot`
  - 结果：`Test Files 2 passed (2)`，`Tests 21 passed (21)`
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/vampire-lord-real-entry.e2e.ts "起开"`
  - 结果：`1 passed (24.8s)`

## 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\起开！应显示吸血鬼卡图，并在对手打出后清楚记录移除的是催眠\01-吸血鬼领主-起开手牌卡图可见.jpg`
  - 吸血鬼视角手牌里的 `起开！` 卡图可见。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\起开！应显示吸血鬼卡图，并在对手打出后清楚记录移除的是催眠\02-天使视角-起开手牌卡图可见.jpg`
  - 天使视角手牌里的 `起开！` 卡图可见。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\起开！应显示吸血鬼卡图，并在对手打出后清楚记录移除的是催眠\03-吸血鬼视角-对手起开打出特写卡图可见.jpg`
  - 对手打出 `起开！` 后，吸血鬼视角能看到卡牌特写图。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\起开！应显示吸血鬼卡图，并在对手打出后清楚记录移除的是催眠\04-天使视角-起开可选择催眠且眩光仍可见.jpg`
  - 选择状态弹窗里，吸血鬼身上同时可见 `催眠` 和 `眩光`。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\起开！应显示吸血鬼卡图，并在对手打出后清楚记录移除的是催眠\05-吸血鬼视角-起开后催眠移除眩光仍在.jpg`
  - 结算后 `催眠` 已消失，`眩光` 仍留在吸血鬼身上。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\起开！应显示吸血鬼卡图，并在对手打出后清楚记录移除的是催眠\06-吸血鬼视角-行动日志写清起开移除催眠.jpg`
  - 行动日志写清来源卡为 `起开！`，被移除对象为 `催眠`。

## 漏审复盘 / 规范回代判断

- 漏审类型：测试层级错配 + 日志断言过窄。旧覆盖能证明卡牌或事件格式，但没有覆盖 `ActionLogSystem` 白名单、系统顺序和真实玩家日志可见结果。
- 已补保护：卡图 helper 测试覆盖吸血鬼等新规格角色的通用牌图集；行动日志测试覆盖 `起开！` 经正式管线移除 `催眠` 并写入玩家日志；真实入口 E2E 覆盖手牌卡图、打出特写、选择催眠、结算后眩光保留和日志来源。
- 是否更新通用规范：不更新。现有 `feedback-closeout`、`rule-bug-fix-workflow`、`engine-action-log`、`e2e-verification` 已要求玩家可见日志和真实入口 E2E；本次是执行与回归测试缺口，不是通用规范缺口。
