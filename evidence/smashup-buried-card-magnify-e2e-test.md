# 大杀四方埋葬牌选择态放大交互 E2E 证据

## 范围

- 目标：大杀四方在“埋葬牌选择”阶段保留查看大图能力，不再因为进入选择模式就失去放大入口。
- 本轮验收点：
  - 桌面端：埋葬牌翻正并保持可选，点击放大入口只打开大图，不会直接消耗选择。
  - 手机端：埋葬牌长按只打开大图，不会误触发选择；关闭大图后仍可继续点击完成选择。

## 执行命令

1. `npm run test:e2e:ci:file -- "e2e/smashup-robot-hoverbot-new.e2e.ts" "狮身人面像埋葬牌交互应直接在场景内翻正面并高亮可选牌"`
   - 结果：通过
2. `BG_HEAVY_MEMORY_MIN_FREE_GB=1 npm run test:e2e:ci:file -- "e2e/smashup-robot-hoverbot-new.e2e.ts" "狮身人面像埋葬牌交互在手机长按时应只放大不误触选择"`
   - 结果：通过

## 截图证据

### 1. 桌面端进入埋葬牌选择态后，埋葬牌已翻正并保持可选

- 路径：`D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\sphinx-bury-board-select.png`

![sphinx-bury-board-select](../e2e/evidence/screenshots/sphinx-bury-board-select.png)

人工观察：

- 左侧金字塔基地旁的埋葬牌已经翻成正面卡图，不再是背面占位，说明选择态会直接暴露可查看内容。
- 顶部中央仍是“选择一张你的埋葬牌”的提示条，中间还有单独的“跳过”按钮，说明当前仍处于交互选择窗口。
- 这张埋葬牌仍留在基地旁，没有被提前回手或移除，说明单纯进入选择态不会自动消耗交互。

### 2. 桌面端点击放大入口后，只打开大图，不消耗选择

- 路径：`D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\sphinx-bury-board-magnify-open.png`

![sphinx-bury-board-magnify-open](../e2e/evidence/screenshots/sphinx-bury-board-magnify-open.png)

人工观察：

- 画面中央打开了 `Warbot` 的大图层，证明桌面端埋葬牌在选择态仍然能走查看大图路径。
- 左侧金字塔基地旁那张埋葬牌还留在原位，没有因为刚才的查看动作被拿走，说明“查看”和“选择”语义仍然分离。
- 顶部选择提示条仍在，大图层打开时没有把当前交互链打断，符合“先看牌，再决定是否点选”的目标。

### 3. 手机端长按埋葬牌后，只打开大图，不误触选择

- 路径：`D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\sphinx-bury-mobile-long-press-magnify.png`

![sphinx-bury-mobile-long-press-magnify](../e2e/evidence/screenshots/sphinx-bury-mobile-long-press-magnify.png)

人工观察：

- 中央已经打开 `Lost Knowledge` 的大图层，说明 coarse pointer 路径上的长按预览生效。
- 左侧基地旁的埋葬牌条带仍然存在，卡没有被直接移走，说明长按没有误触发“选择并结算”。
- 顶部选择提示条仍保持在页面上，说明手机端长按只是查看，不会让当前埋葬牌交互提前结束。

## 结论

- 大杀四方埋葬牌在选择态下已恢复查看大图能力。
- 桌面端现在可以在场上埋葬牌选择时打开放大层，查看动作不会直接消费选择。
- 手机端长按埋葬牌只会打开大图，不会误触发选择；关闭后仍可继续点击完成原交互。
- 为了让 Playwright / Node ESM 路径稳定加载中文内联文案，本轮同时补了 `src/lib/i18n/zh-CN-bundled.ts` 的 JSON import attribute，这属于测试运行时装载修复，不改变这条埋葬牌交互的业务语义。
