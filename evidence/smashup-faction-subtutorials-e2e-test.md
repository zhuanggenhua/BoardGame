# Smash Up 派系机制子教程 E2E 证据（2026-04-08）

## 范围
- 派系详情标题右侧新增机制教程入口
- 无子教程的派系不显示入口，也不留额外占位
- 教程系统支持 Smash Up 子教程路由
- `cowboys-duel` 子教程可从派系详情进入并完成牛仔决斗主流程

## 本轮实际执行
### 单元验证
- `npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "cowboys_deputy"`

结果：通过。补充断言确认：
- Deputy 弃牌后进入 discard
- Deputy 不再留在 hand
- 被加成随从仅获得 `+2`，没有重复叠加成 `+4`

### E2E 验证
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup-tutorial.e2e.ts --grep '派系(没有机制教程时不显示详情入口占位|详情标题右侧机制教程入口可进入牛仔决斗子教程并完成主流程)'`

结果：`2 passed`

- `npx playwright test e2e/smashup-tutorial.e2e.ts --project=chromium --grep '牛仔决斗子教程在手机横屏下提示不应遮挡基地且副警长可正常弃置'`
  - 环境：`PW_USE_DEV_SERVERS=true`、`PW_PORT=4273`、`PW_GAME_SERVER_PORT=18000`、`PW_API_SERVER_PORT=18001`
  - 结果：`1 passed`

- `npx playwright test e2e/smashup-tutorial.e2e.ts --project=chromium --grep '派系详情标题右侧机制教程入口可进入牛仔决斗子教程并完成主流程'`
  - 环境：`PW_USE_DEV_SERVERS=true`、`PW_PORT=4273`、`PW_GAME_SERVER_PORT=18000`、`PW_API_SERVER_PORT=18001`
  - 结果：`1 passed`

### ESLint
- `npx eslint e2e/smashup-tutorial.e2e.ts src/games/smashup/domain/duel.ts src/games/smashup/__tests__/newFactionAbilities.test.ts`

结果：0 errors（仅仓库已有 warning，未阻断）

## 关键截图与肉眼结论

### 1. 无教程派系不显示入口
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup-tutorial.e2e/派系没有机制教程时不显示详情入口占位/robots-detail-no-entry.png`

我实际看到：
- 机器人派系详情头部只有标题区本体，没有额外的教程按钮/芯片出现在标题右侧。
- 头部布局是正常单行详情头，不是“空出一块区域等按钮填进去”的形态。
- 详情卡片主体仍完整显示，没有因为教程入口条件渲染失败出现错位或空白块。

是否达到验收标准：达到。说明“没有教程时不留占位”这一点在真实页面里成立。

### 2. 牛仔派系教程入口位于标题右侧
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup-tutorial.e2e/派系详情标题右侧机制教程入口可进入牛仔决斗子教程并完成主流程/cowboys-detail-entry.png`

我实际看到：
- 牛仔派系详情头部出现了单独的机制教程入口，位置贴在标题右侧，同一行内，没有被挪到标题下方。
- 入口是紧凑控件，不是额外插一整行说明区域。
- 头部与详情正文仍然紧凑，没有出现为了教程入口而额外撑开的占位条。

是否达到验收标准：达到。入口位置符合“直接放标题右侧”的要求。

### 3. 牛仔决斗子教程进入后能到达完成态，页面稳定
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup-tutorial.e2e/派系详情标题右侧机制教程入口可进入牛仔决斗子教程并完成主流程/cowboys-duel-resolved.png`

我实际看到：
- 子教程完成态浮层已经出现在棋盘上，说明从派系详情进入的 `cowboys-duel` 教程链路确实走到了 finish 步骤。
- 棋盘主体仍然可见，画面没有塌黑、错层或大面积遮挡。
- 浮层与棋盘叠放关系稳定，说明子教程路由切换后 UI 没有发生异常重排。

是否达到验收标准：达到。子教程入口、子教程路由和最终完成态都已在真实页面链路里走通。

### 4. 完成态截图复核
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup-tutorial.e2e/派系详情标题右侧机制教程入口可进入牛仔决斗子教程并完成主流程/cowboys-duel-finish.png`

我实际看到：
- 完成态视图与上一张一致，仍是稳定的教程结束画面。
- 页面主内容和结束浮层都还在可视区内，没有新增遮挡或裁切问题。

是否达到验收标准：达到。作为 finish 前的第二张复核图，没有发现新的视觉异常。

### 5. 手机横屏下教程提示不遮挡基地
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup-tutorial.e2e/牛仔决斗子教程在手机横屏下提示不应遮挡基地且副警长可正常弃置/cowboys-duel-mobile-no-base-occlusion.png`

我实际看到：
- 教程卡片已经贴到棋盘左侧，不再像之前那样压在基地中央区域上。
- 中央基地卡和其下方两张随从卡完整可见，基地上方的断点徽章和下方战力标记也没有被教程卡遮住。
- 左侧教程卡与中央基地之间留出了清晰空隙，下一步按钮也在卡片内部，没有漂到基地附近。

是否达到验收标准：达到。移动端横屏下这一步已经证明“教程提示不挡基地”，并且位置策略确实落到了左侧贴边。

## 非截图但同轮已验证的关键业务断言
在“牛仔决斗子教程并完成主流程”这条 E2E 里，实际断言通过了以下关键状态：
- 路由进入：`/play/smashup/tutorial/cowboys-duel`
- 教程 manifest：`smashup-cowboys-duel`
- 决斗结算后：
  - `enemy-1` 已离场
  - `deputy-1` 已进入 `discard`
  - `activeDuel === null`

在“牛仔决斗子教程在手机横屏下提示不应遮挡基地且副警长可正常弃置”这条 E2E 里，额外实际断言通过：
- `data-tutorial-placement` 为 `left` / `right`
- 教程卡与 `[data-base-index="0"]` 的重叠面积为 `0`
- **未使用 `force: true` 点击 `deputy-1`**，真实点击后成功进入 `discard`

这部分用于证明不仅 UI 入口和教程壳层正确，决斗教程本身也真的走完了规则链。

## 结论
本轮验收通过：
- 已验证无教程派系不显示入口占位
- 已验证牛仔派系教程入口在标题右侧
- 已验证 Smash Up 子教程路由可进入 `cowboys-duel`
- 已验证牛仔决斗教程主流程可完整完成
- 已验证移动端横屏下教程提示不再遮挡基地
- 已验证副警长在子教程里可真实点击弃置，不再需要 `force: true`
- 已验证 Deputy 决斗加成链不再出现“效果结算了但手牌/弃牌不同步”的问题
