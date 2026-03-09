# SmashUp 僵尸领主直点交互 E2E 证据

## 目标

验证 `zombie_lord_pick` 已经落到显式语义 + 场上直点架构：

1. 弃牌堆出现可选低力量随从时，不弹通用选项弹窗，而是打开弃牌横排。
2. 选中弃牌堆随从后，直接点击高亮基地完成部署。
3. 没有合格随从时，不打开弃牌横排，并给出明确反馈。

## 执行命令

```bash
npm run test:e2e:cleanup
npm run test:e2e:ci -- e2e/smashup-zombie-lord.e2e.ts
```

## 结果

- `e2e/smashup-zombie-lord.e2e.ts`：2/2 通过
- `npx tsc --noEmit`：通过
- `npx vitest run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --pool threads --maxWorkers 1`：通过

## 截图与分析

### 1. 弃牌横排已打开，进入直点模式

![僵尸领主弃牌横排](../e2e/test-results/evidence-screenshots/smashup-zombie-lord/01-discard-panel.png)

分析：

- 画面底部出现 `DISCARD PILE (2)` 横排，而不是居中的通用 `PromptOverlay` 选项卡面板。
- 横排里同时展示 `Grave Digger` 与 `Tenacious Z`，说明这一步已经切到“弃牌堆选随从”的专用语义。
- 左侧基地上已经落下 `Zombie Lord`，证明第一步“打出僵尸领主到基地”已完成。

### 2. 选中弃牌随从后，基地直接高亮等待点击

![选中弃牌随从后高亮基地](../e2e/test-results/evidence-screenshots/smashup-zombie-lord/02-card-selected.png)

分析：

- `Tenacious Z` 卡面出现高亮描边，表示弃牌堆中的目标已选中。
- 中间与右侧基地出现黄色高亮边框，UI 明确进入“点击基地部署”状态。
- 底部出现 `Click a base to deploy` 提示，说明下一步是场上直点基地，而不是再弹一个基地选择弹窗。

### 3. 点击基地后部署完成

![点击基地后完成部署](../e2e/test-results/evidence-screenshots/smashup-zombie-lord/03-after-deploy.png)

分析：

- 左侧基地保留 `Zombie Lord`，中间基地新增力量 2 的 `Tenacious Z`。
- 右下角弃牌堆计数从 2 降到 1，说明选中的随从已经真正从弃牌堆移出并落场。
- 底部弃牌横排已关闭，没有残留 `zombie_lord_pick` 交互 UI。

### 4. 没有合格随从时不打开横排

![无合格随从时不给横排](../e2e/test-results/evidence-screenshots/smashup-zombie-lord/04-no-eligible-discard.png)

分析：

- 顶部出现 `No matching cards in discard pile` 反馈，明确告诉玩家这次没有可处理目标。
- 画面底部没有出现弃牌横排，说明不会错误进入 `discard_minion` 直点流程。
- 场上只有左侧基地上的 `Zombie Lord`，弃牌堆仍保留原来的 1 张不合格随从，符合预期。

## 结论

`zombie_lord_pick` 现在已经满足这轮架构目标：

- 语义显式：引擎/游戏层通过 `targetType: 'discard_minion'` 明确声明直点模式。
- 直点优先：可选随从来自弃牌横排，落点通过基地高亮直接点击完成。
- 失败可见：没有合格目标时，不再误弹交互面板，而是给出明确反馈。
