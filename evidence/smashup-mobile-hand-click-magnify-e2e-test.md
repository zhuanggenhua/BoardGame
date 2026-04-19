# 大杀四方移动端手牌放大按钮恢复 E2E 证据

## 范围

- 目标：恢复大杀四方移动端手牌常驻放大按钮，同时保留点击手牌本体的原交互语义。
- 本轮收口关注两件事：
  - 手机横屏下放大按钮常驻可见，点击按钮只打开大图，不会误触发出牌。
  - 点击手牌本体仍走原流程：随从进入部署选择，行动卡维持二次点击确认。
  - 无有效目标的无目标行动卡不会再先选中再失败，而是在第一次点击时直接给出 toast 提示。

## 执行命令

1. `BG_HEAVY_MEMORY_MIN_FREE_GB=1 npm run test:e2e:ci:file -- "e2e/smashup-local-gameplay.e2e.ts" "本地模式：手机横屏保留常驻放大按钮，点击按钮只放大不触发出牌"`
   - 结果：通过
2. `BG_HEAVY_MEMORY_MIN_FREE_GB=1 npm run test:e2e:ci:file -- "e2e/smashup-local-gameplay.e2e.ts" "本地模式：默认模式下点击随从会进入部署选择，点击基地后才真正打出"`
   - 结果：通过
3. `BG_HEAVY_MEMORY_MIN_FREE_GB=1 npm run test:e2e:ci:file -- "e2e/smashup-local-gameplay.e2e.ts" "本地模式：默认模式下无目标行动卡需要二次点击确认"`
   - 结果：通过
4. `BG_HEAVY_MEMORY_MIN_FREE_GB=1 npm run test:e2e:ci:file -- "e2e/smashup-local-gameplay.e2e.ts" "本地模式：无有效目标的无目标行动卡第一次点击就提示并且不会选中使用"`
   - 结果：通过

## 截图证据

### 1. 手机横屏保留常驻放大按钮，点按钮只放大

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：手机横屏保留常驻放大按钮，点击按钮只放大不触发出牌\smashup-mobile-inspect-button-preview.png`

![smashup-mobile-inspect-button-preview](../test-results/evidence-screenshots/smashup-local-gameplay.e2e/本地模式：手机横屏保留常驻放大按钮，点击按钮只放大不触发出牌/smashup-mobile-inspect-button-preview.png)

人工观察：

- 底部中间的手牌仍保留右上角黑色圆形放大按钮，不是“整张卡点击即放大”的旧回退方案。
- 画面中央已经打开 `First Mate` 放大层，说明按钮点击路径可以正常拉起大图。
- 三个基地上没有新增随从，说明这次按钮点击只是查看，不会把牌误打到场上。

### 2. 点击随从本体仍是部署选择，不会被改成直接放大

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：默认模式下点击随从会进入部署选择，点击基地后才真正打出\smashup-click-minion-select-then-deploy.png`

![smashup-click-minion-select-then-deploy](../test-results/evidence-screenshots/smashup-local-gameplay.e2e/本地模式：默认模式下点击随从会进入部署选择，点击基地后才真正打出/smashup-click-minion-select-then-deploy.png)

人工观察：

- 底部手牌带有青色选中描边，说明点击后先进入“已选中待部署”状态。
- 三个基地同时出现绿色高亮边框，说明当前界面是在等玩家选部署目标，不是打开看牌弹层。
- 手里这张 `First Mate` 还留在手牌区，证明第一次点击并未直接打出。

### 3. 行动卡仍保持二次点击确认

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：默认模式下无目标行动卡需要二次点击确认\smashup-click-action-double-confirm.png`

![smashup-click-action-double-confirm](../test-results/evidence-screenshots/smashup-local-gameplay.e2e/本地模式：默认模式下无目标行动卡需要二次点击确认/smashup-click-action-double-confirm.png)

人工观察：

- 画面中央显示 `Howl` 的结算态卡面，底部右侧弃牌堆计数已变为 `1`，说明行动卡已经在确认后成功打出。
- 左侧基地随从旁出现绿色 `+1` 标记，对应 `Howl` 的加成已经生效，说明不是只选中没结算。
- 这张图对应的是第二次点击后的结果，结合通过的用例断言，可证明行动卡仍走“第一次选中、第二次确认”的旧语义。

### 4. 无有效目标的无目标行动卡第一次点击直接 toast，不再先选中

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：无有效目标的无目标行动卡第一次点击就提示并且不会选中使用\smashup-click-action-no-target-toast.png`

![smashup-click-action-no-target-toast](../test-results/evidence-screenshots/smashup-local-gameplay.e2e/本地模式：无有效目标的无目标行动卡第一次点击就提示并且不会选中使用/smashup-click-action-no-target-toast.png)

人工观察：

- 画面顶部已经出现 `场上没有符合条件的目标` 的 toast，说明第一次点击就给了失败反馈，没有等到第二次点击。
- 底部这张 `Howl` 没有出现 cyan 选中描边，也没有抬起到“待确认”状态，说明这次点击没有再把无效行动卡 arm 起来。
- 右下角弃牌堆仍是 `0`，手牌中的 `Howl` 还留在底部中央，说明没有误消耗行动额度，也没有把卡错误结算进弃牌堆。

## 结论

- 移动端手牌常驻放大按钮已恢复，手机横屏下按钮常驻可见，点击按钮会正常打开放大层。
- 点击手牌本体的主交互没有再被“点击即放大”劫持：
  - 随从：第一次点击进入部署选择，点基地后才真正打出。
  - 无目标行动卡：仍然需要二次点击确认。
- 但如果这张无目标行动卡当前根本没有可结算对象，则不会再先选中再失败，而是第一次点击就直接 toast 拒绝。
- 这轮收口依赖 `smashup-local-gameplay.e2e.ts` 的四条定向用例，不依赖此前被无关 `fab-sheet-exit` 断言阻塞的四人局大用例。
