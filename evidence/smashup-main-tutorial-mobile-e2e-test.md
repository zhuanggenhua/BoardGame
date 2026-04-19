# Smash Up 主教程移动端遮挡 E2E 证据（2026-04-08）

## 范围
- 主教程在手机横屏下的提示卡不再遮挡关键操作区
- 主教程的 `playMinion` / `playAction` / `useTalent` / `endPlayCards` 四个关键步骤都要能真实继续点击
- 子教程 `cowboys-duel` 在本轮主教程优化后继续保持“提示不挡基地 + 副警长可真实弃置”
- 教程规范文档补充移动端遮挡验收要求

## 本轮实际执行
### E2E
1. `npm run test:e2e:ci:file -- e2e/smashup-tutorial.e2e.ts "手机横屏下主教程关键交互不应被提示挡住"`
   - 结果：`1 passed`
2. `npm run test:e2e:ci:file -- e2e/smashup-tutorial.e2e.ts "牛仔决斗子教程在手机横屏下提示不应遮挡基地且副警长可正常弃置"`
   - 结果：`1 passed`

### ESLint
- `npx eslint src/components/tutorial/TutorialOverlay.tsx src/games/smashup/tutorial.ts src/games/smashup/ui/BaseZone.tsx e2e/smashup-tutorial.e2e.ts`
- 结果：0 errors

## 关键截图与肉眼结论

### 1. playMinion：教程卡贴边，让出棋盘中央与基地点击区
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup-tutorial.e2e/手机横屏下主教程关键交互不应被提示挡住/main-tutorial-mobile-play-minion-clear.png`

我实际看到：
- 教程卡固定在画面左侧，不再横跨棋盘中央。
- 中央两个基地完整露出，基地本体和断点徽章都没被教程卡盖住。
- 底部手牌区仍在可见范围，说明这一步没有因为教程卡改位而把下一次操作挤出屏幕。

是否达到验收标准：达到。`playMinion` 这一步已经证明主教程不再用居中提示卡压住中央基地操作区。

### 2. playAction：行动牌步骤改成右侧贴边，中央操作链路保持通畅
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup-tutorial.e2e/手机横屏下主教程关键交互不应被提示挡住/main-tutorial-mobile-play-action-clear.png`

我实际看到：
- 教程卡在右侧贴边，不再像之前那样居中悬在基地上方。
- 左侧基地、中央基地和底部剩余手牌都完整可见，行动牌的真实点击链路有空位可走。
- 结束回合按钮虽然靠右，但教程卡仍与按钮保留出分离区域，没有把整个右半屏都封死。

是否达到验收标准：达到。用户之前反馈的“主教程挡住操作界面”在 `playAction` 这一关键步已被直接修复。

### 3. useTalent：高亮改到具体图书管理员，教程卡不再压住要点的随从
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup-tutorial.e2e/手机横屏下主教程关键交互不应被提示挡住/main-tutorial-mobile-use-talent-clear.png`

我实际看到：
- 蓝色高亮圈直接落在左侧基地的图书管理员本体，而不是笼统框整片基地区域。
- 教程卡位于右侧贴边，与被点击的图书管理员之间有明显空隙，没有再压住随从卡面。
- 玩家手牌区和右下弃牌堆也都还可见，说明提示卡没有把后续状态观察区一起挡住。

是否达到验收标准：达到。`useTalent` 这一步已经证明提示卡与实际点击目标脱开，不再造成“看得到教程、点不到随从”的遮挡。

### 4. endPlayCards：结束回合按钮完整可见且未被提示卡覆盖
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup-tutorial.e2e/手机横屏下主教程关键交互不应被提示挡住/main-tutorial-mobile-end-turn-clear.png`

我实际看到：
- 教程卡位于左上区域，结束回合按钮位于右侧，二者完全分离。
- 按钮外圈高亮完整，没有被教程卡切掉边缘，也没有只剩一角的情况。
- 棋盘中部和底部仍保持可见，没有出现为了让开按钮而把整体界面挤歪的副作用。

是否达到验收标准：达到。结束回合步骤的操作控件没有再被主教程遮挡。

### 5. 子教程回归：牛仔决斗仍然左侧贴边，不挡基地
截图：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup-tutorial.e2e/牛仔决斗子教程在手机横屏下提示不应遮挡基地且副警长可正常弃置/cowboys-duel-mobile-no-base-occlusion.png`

我实际看到：
- 子教程提示卡仍贴在左侧，中央基地与下方两张随从完整可见。
- 中央基地周围没有新增遮挡，说明主教程的布局规则扩展没有把子教程重新改坏。
- 这一步的教程卡和下一步按钮都留在左侧卡片内部，没有溢出到基地上方。

是否达到验收标准：达到。子教程本轮回归通过，没有出现“修主教程又把子教程带坏”的回归。

## 非截图但同轮已验证的关键断言
- 主教程移动端横屏测试中，`playMinion` 与 `playAction` 步骤都断言 `data-tutorial-placement` 为 `left/right`，并检查教程卡让开中央车道。
- `useTalent` 与 `endPlayCards` 步骤都断言教程卡和真实点击目标的重叠面积为 `0`。
- 主教程交互链全部通过真实点击推进：没有用 `force: true` 掩盖基地、随从、结束回合按钮被挡住的问题。
- 子教程回归中再次断言：教程卡与 `[data-base-index="0"]` 重叠面积为 `0`，且 `deputy-1` 真实点击后进入 discard。

## 文档更新
- `src/components/tutorial/TUTORIAL.md` 已补充：
  - 移动端横屏下底部/顶部条带式目标应优先左右贴边
  - 新增/修改教程后必须做 UI 遮挡验收
  - 需要继续点击的教程步骤，E2E 禁止用 `force: true` 掩盖失败

## 结论
本轮验收通过：
- 主教程在手机横屏下已不再遮挡 `playMinion` / `playAction` / `useTalent` / `endPlayCards` 的关键操作位
- `useTalent` 的高亮目标已收窄到具体图书管理员，避免教程卡继续盖住要点击的随从
- 子教程 `cowboys-duel` 回归通过，移动端遮挡与副警长弃置都保持正常
- 教程文档已加入“制作后必须检查 UI 遮挡关系”的明确规范
