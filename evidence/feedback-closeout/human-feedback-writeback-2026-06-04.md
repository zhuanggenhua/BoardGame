# 人工反馈状态回写与复核（2026-06-04）

## 范围

- 时间：`2026-06-04 08:29 +08:00`
- 目标反馈：
  - `6a2018f678c1ecf399a679d2`：`极客的平衡是打敌人的牌，但只能选自己的牌且无法打出`
  - `6a2013fe78c1ecf399a67942`：`极客粉丝弃不了`
  - `6a2012ab78c1ecf399a67918`：`哥斯拉的加战力战术未加战力`
  - `6a200e4e78c1ecf399a6782b`：`宝可梦的叶鼠的弃牌堆洗牌，但效果是选手牌，且选不了，只能跳过`
  - `6a1ffc2178c1ecf399a67562`：`忍者防御投掷的可重新选择两枚骰子投掷无法选择骰子，点击技能后有重投音效但不显示重投结果，但是结算了重投效果`
  - `6a1fb61e78c1ecf399a6735d`：`在哪里出售卡牌`
  - `6a1e95f3952559643efd37d7`：`修格斯的力量的代价特殊计分貌似没有触发`
  - `6a1e8095952559643efd3738`：`大杀四方貌似一个基地随从过多不能选取最下面的随从`
- 来源口径：生产 `boardgame.feedbacks`

## 正式写入口

- 本轮继续使用生产 Mongo 直连，不走 HTTP：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh --quiet boardgame`

## 回写前核对

- 我实际核对到：
  - 上述 8 条在生产 `feedbacks` 中全部存在
  - 回写前全部是 `status: open`
  - 全部是 `reporterType=user`、`source=feedback-modal`
  - 分布为：
    - `smashup`: 6 条
    - `dicethrone`: 2 条

## 判定口径

### 1. 当前 worktree 已有真实修复/对位回归，回写 `resolved`

- `6a2018f678c1ecf399a679d2`《平衡》
  - 证据：`evidence/feedback-closeout/open-feedback-recheck-2026-06-04.md`
  - 验证：
    - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-geeks-hand-special-and-minmaxing.e2e.ts "平衡从真实手牌打出时，应展示对手手牌并可借打附着行动到己方随从"`
- `6a2013fe78c1ecf399a67942`《粉丝》
  - 证据：`evidence/feedback-closeout/open-feedback-recheck-2026-06-04.md`
  - 验证：
    - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-geeks-hand-special-and-minmaxing.e2e.ts`
- `6a2012ab78c1ecf399a67918`《放射性吐息》
  - 证据：`evidence/feedback-closeout/open-feedback-recheck-2026-06-04.md`
  - 验证：
    - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts "Kaiju: Tokyo 在手牌行动打到本基地后给本基地临时总力量"`
- `6a200e4e78c1ecf399a6782b`《Leafaroo》
  - 证据：`evidence/feedback-closeout/open-feedback-recheck-2026-06-04.md`
  - 验证：
    - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts "Itty Critters: Leafaroo 从真实打出入口选择弃牌堆卡洗回牌库"`
- `6a1ffc2178c1ecf399a67562` 忍者防御重投
  - 证据：`evidence/feedback-closeout/open-feedback-recheck-2026-06-04.md`
  - 验证：
    - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-defense-selection.e2e.ts`
- `6a1e95f3952559643efd37d7`《力量的代价》
  - 证据：`evidence/feedback-closeout/open-feedback-recheck-2026-06-04.md`
  - 验证：
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/meFirst.test.ts --configLoader native --config vitest.config.core.ts -t "Me First! 窗口中打出《力量的代价》会真实结算亮手牌并给己方随从加力量"`
- `6a1e8095952559643efd3738` 基地底部随从点不到
  - 证据：`evidence/feedback-closeout/open-feedback-recheck-2026-06-04.md`
  - 验证：
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseZone-mobile-ongoing-actions.test.tsx --configLoader native --config vitest.config.ts`

结论：

- 这 7 条都不是“当前 worktree 仍未修到”的活 bug。
- 对用户原始链路，当前代码已具备真实入口 E2E 或定向 Vitest 证据，可正式回写 `resolved`。

### 2. 规则/UI/教程入口已存在，回写 `closed`

- `6a1fb61e78c1ecf399a6735d`：`在哪里出售卡牌`
- 判定：`non_bug`
- 依据：
  - 规则文本明确写有卖牌入口：
    - `src/games/dicethrone/rule/王权骰铸规则.md`
    - `主要阶段 1`：`出售卡牌：将任意手牌弃掉，每张获得 1 CP`
    - `弃牌阶段`：`每张卖出的手牌，可获得 1 CP`
  - 实际 UI 已有卖牌入口：
    - `src/games/dicethrone/Board.tsx`
    - `HandArea.onSellCard -> engineMoves.sellCard(cardId)`
  - 教程已有显式引导：
    - `src/games/dicethrone/tutorial.ts`
    - `sell-card-intro`
  - 回归测试已覆盖：
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/card-system.test.ts src/games/dicethrone/__tests__/tutorial-e2e.test.ts --configLoader native --config vitest.config.core.ts -t "卖牌获得 1 CP|meditation-2 步骤白名单约束下 CP 不足时必须能通过卖牌自救"`

结论：

- 这条反馈更像“询问入口/引导问题”，不是当前功能缺失。
- 按 `closed` 收口。

## 本轮回写目标

- `resolved`
  - `6a2018f678c1ecf399a679d2`
  - `6a2013fe78c1ecf399a67942`
  - `6a2012ab78c1ecf399a67918`
  - `6a200e4e78c1ecf399a6782b`
  - `6a1ffc2178c1ecf399a67562`
  - `6a1e95f3952559643efd37d7`
  - `6a1e8095952559643efd3738`
- `closed`
  - `6a1fb61e78c1ecf399a6735d`

## 回写执行

- 正式回写时间：`2026-06-04T00:29:34.730Z`
- 实际结果：
  - `6a2018f678c1ecf399a679d2 -> resolved`
  - `6a2013fe78c1ecf399a67942 -> resolved`
  - `6a2012ab78c1ecf399a67918 -> resolved`
  - `6a200e4e78c1ecf399a6782b -> resolved`
  - `6a1ffc2178c1ecf399a67562 -> resolved`
  - `6a1fb61e78c1ecf399a6735d -> closed`
  - `6a1e95f3952559643efd37d7 -> resolved`
  - `6a1e8095952559643efd3738 -> resolved`
- 实际回写结果：
  - 8 条全部 `matchedCount=1`
  - 8 条全部 `modifiedCount=1`

## 回写后复核

### 1. 人工反馈入口已清零

- 复核口径：
  - `source = feedback-modal`
  - `status in ['open', 'in_progress']`
- 我实际看到：
  - `count = 0`
  - `docs = []`

### 2. 当前剩余未收口主类

- 当前生产剩余 open/in_progress 已不再是人工 `feedback-modal`
- 主要剩余为：
  - `smashup / client-runtime-guard = 547`
  - `smashup / board-render-error = 31`
  - `smashup / client-window-error = 8`
  - `dicethrone / client-window-error = 7`
  - `dicethrone / player-command-failure = 6`
  - `dicethrone / online-ai-watchdog = 4`

## 结论

- 本轮 8 条人工反馈已完成“生产真相复核 -> 当前 worktree 证据核对 -> 正式回写口径确认”。
- 其中 7 条按“已修未回写”推进 `resolved`，1 条按“非 bug / 已有入口与教程”推进 `closed`。
- 回写后生产 `feedback-modal` 当前剩余 `open/in_progress = 0`。
