# 大杀四方移动端适配 E2E 证据

## 2026-03-16 当前复核

- 本轮直接复核了以下现存截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\07-mobile-minion-long-press-magnify.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\11-mobile-hand-long-press-magnify.png`
- 复核结论：
  - `04-mobile-landscape-layout.png` 仍可作为有效主状态图。
  - `04a-mobile-exit-fab-panel.png` 仍可作为有效局部图。
  - `07-mobile-minion-long-press-magnify.png` 与 `11-mobile-hand-long-press-magnify.png` 仍然是无效旧图，放大层只有半透明容器，没有真实卡面内容。
- 当前截图目录实际库存为：`04`、`04a`、`06`、`07`、`08`、`09`、`10`、`11`。`05`、`06a`、`06b`、`12` 当前并不存在，后文若引用这些路径，应视为“待重跑后补图”，不是现成证据。
- 本轮再次执行 `npm run check:child-process:e2e`，结果仍为 `fork -> spawn EPERM`，所以当前沙箱依旧无法补跑 Playwright。
- 本轮静态验证结果：
  - `npm run typecheck` 通过。
  - `npx eslint e2e/smashup-4p-layout-test.e2e.ts src/games/smashup/Board.tsx src/games/summonerwars/Board.tsx src/games/mobileSupport.ts src/games/__tests__/mobileSupport.test.ts src/games/smashup/manifest.ts src/games/summonerwars/manifest.ts --max-warnings 999` 无 error，仅有仓库既有 warnings。

## 本轮变更

- `src/index.css`
  - `smashup` 的 `board-shell` 设计宽度从 `920px` 调整到 `1160px`，让横屏手机下的主棋盘、计分板和结束回合按钮回到同一缩放体系。
- `src/components/system/FabMenu.tsx`
  - 移动端 FAB 视觉圆球缩小，但保留 `44px` 命中区。
  - 面板宽高按当前位置和安全区动态限宽限高，避免退出面板溢出视口。
- `e2e/smashup-4p-layout-test.e2e.ts`
  - `04a` 截图后立即关闭退出面板，避免污染后续截图。
  - 为 `exit` FAB tooltip 增加稳定 `data-testid`，并在 `04a -> 05` 之间显式断言 tooltip 不存在，避免旧版 hover 残影再次污染 `05`。
  - 长按放大相关截图现在会先等待 overlay 内部不再存在 `.atlas-shimmer`，确认卡牌预览已真正渲染，再截图。
  - 同一条移动端用例现在额外补了 `1024x768` 平板横屏断言与 `12-tablet-landscape-layout` 截图位，后续可直接补齐 `smashup` 的手机/平板双档证据。

## 静态验证

执行命令：

```bash
npm run typecheck
npx eslint e2e/smashup-4p-layout-test.e2e.ts src/components/system/FabMenu.tsx src/games/smashup/Board.tsx --max-warnings 999
```

结果：

- `typecheck` 通过。
- `eslint` 无 error，仅有仓库既有 warning。

## 当前环境阻塞

执行命令：

```bash
npm run check:child-process:e2e
```

结果：

- 失败阶段：`fork`
- 错误：`spawn EPERM`

影响：

- 当前沙箱无法重跑 Playwright。
- 本轮无法生成新的 `07-11` 截图，只能基于仓库现有截图做人审，并把无效旧图明确标出来。

## 已人工查看的截图

### 1. 主状态图

截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`

嵌入：

![04-mobile-landscape-layout](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/04-mobile-landscape-layout.png)

我从图里确认到：

- 四个基地、底部手牌、左下牌库、右下弃牌、右侧 `FINISH TURN` 都还在 `812x375` 视口内。
- 计分板没有再压住主棋盘。
- 结束回合按钮和棋盘的缩放比例比旧版本更接近，没有明显“按钮过大、棋盘过小”的错位。

有效性裁定：

- `04-mobile-landscape-layout.png` 目前是有效主证据图。

### 2. 退出 FAB 面板

截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`

嵌入：

![04a-mobile-exit-fab-panel](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/04a-mobile-exit-fab-panel.png)

我从图里确认到：

- 退出面板完整落在视口内，没有右侧或底部溢出。
- FAB 视觉圆球已经缩小，没有像旧版那样压住主棋盘。

有效性裁定：

- `04a-mobile-exit-fab-panel.png` 目前是有效局部证据图。

### 3. 单击随从展开附着行动

截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`

嵌入：

![05-mobile-single-tap-expands-attached-actions](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/05-mobile-single-tap-expands-attached-actions.png)

我从图里确认到：

- 图中仍残留旧版 `Exit` hover tooltip。

有效性裁定：

- `05-mobile-single-tap-expands-attached-actions.png` 不是当前代码的有效收口图。

### 4. 长按放大相关旧图

已查看截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\07-mobile-minion-long-press-magnify.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\08-mobile-base-long-press-magnify.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\09-mobile-base-ongoing-long-press-magnify.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\10-mobile-attached-action-long-press-magnify.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\11-mobile-hand-long-press-magnify.png`

共同问题：

- 图里放大层虽然出现了，但主体内容仍是 `atlas-shimmer` 占位态。
- 这些图只能证明 overlay 已经打开，不能证明大图已经正确渲染完成。

有效性裁定：

- `07-11` 这一组历史截图都不应继续作为有效收口证据。

## 当前结论

- 代码层面，`smashup` 横屏主布局和 FAB 退出面板这一轮已经收敛，`04` 和 `04a` 可以继续作为有效截图。
- 放大预览的旧截图链路不成立，不是功能必然错误，而是截图时机过早，截到了 `atlas-shimmer`。
- 本轮已把等待条件补进 [e2e/smashup-4p-layout-test.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/smashup-4p-layout-test.e2e.ts)：后续重跑必须先等 `.atlas-shimmer` 消失，再生成 `07-11` 新图。
- 当前沙箱仍被 `spawn EPERM` 阻塞，无法在这里补跑新图。

## 下一步

在允许 `child_process` 的环境中执行：

```bash
npm run test:e2e:ci:file -- e2e/smashup-4p-layout-test.e2e.ts "移动端横屏应保持四人局布局可用，并支持手牌长按看牌"
```

重跑后优先人工核对：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\07-mobile-minion-long-press-magnify.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\08-mobile-base-long-press-magnify.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\09-mobile-base-ongoing-long-press-magnify.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\10-mobile-attached-action-long-press-magnify.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\11-mobile-hand-long-press-magnify.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\12-tablet-landscape-layout.png`

## 2026-03-18 结束回合右侧提示复核

本节覆盖当前代码的最新收口，以上早期“`spawn EPERM` 阻塞”的记录不再代表当前状态。

### 本轮实际运行

```bash
npm run typecheck
npm run test:e2e:ci:file -- e2e/smashup-4p-layout-test.e2e.ts "移动端横屏应保持四人局布局可用，并支持手牌长按看牌"
```

结果：

- `typecheck` 通过
- 单用例 E2E 通过：`1 passed`

### 本轮实际查看的截图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\12-tablet-landscape-layout.png`

### 读图结论

`04-mobile-landscape-layout.png`

- `FINISH TURN` 按钮仍在原来的右侧主操作区，没有被移动端修复改成另一套布局。
- 右侧的 `Minion 0 / Action 0` 提示块完整位于视口内，没有再被右边界截断。
- 提示块视觉尺寸比旧版更紧凑，但仍清晰可读，没有因为缩小而变成新的可用性问题。

`12-tablet-landscape-layout.png`

- 平板横屏下主棋盘、分数板、结束回合按钮、右侧提示块和底部手牌仍保持四人局布局可用。
- 当前这组结束回合提示没有把平板端的主操作区挤出屏幕，也没有和底部区域发生明显遮挡。

### 对应代码

- `D:\gongzuo\webgame\BoardGame\src\games\smashup\Board.tsx`
  - 只在移动端增加结束回合主操作区的右侧安全留白。
  - 同时把右侧额度提示块做成更紧凑的移动端尺寸，避免提示本身再次撑出屏幕。
- `D:\gongzuo\webgame\BoardGame\e2e\smashup-4p-layout-test.e2e.ts`
  - 为 `su-end-turn-hints`、`su-end-turn-minion-quota`、`su-end-turn-action-quota` 增加显式可见性和视口内断言。

### 当前裁定

- `04-mobile-landscape-layout.png` 是有效手机主态图。
- `12-tablet-landscape-layout.png` 是有效平板主态图。
- 当前这版 `smashup` 移动端修复已经收口，重点问题已从“右侧提示被截断”收敛到“右侧提示完整可见且不改主交互位置”。

## 2026-03-19 结束回合隐藏开关复核

### 本轮代码

- `D:\gongzuo\webgame\BoardGame\src\games\smashup\Board.tsx`
  - 为结束回合区补了固定的 `h-24 w-24` 相对锚点容器，确保隐藏主按钮和额度提示后，右下角“隐/显”功能键仍固定在原按钮右下角，不会因为内容被条件渲染移除而漂移。

### 本轮实际查看的截图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04b-mobile-end-turn-hidden.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04c-mobile-end-turn-restored.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\13-desktop-end-turn-restored.png`

### 读图结论

`04b-mobile-end-turn-hidden.png`

- 手机横屏下，结束回合大按钮与右侧 `Minion / Action` 额度提示均已隐藏。
- 右下角仅保留一个小型圆形功能键，不再遮挡右侧随从区域。
- 小按钮仍贴在原结束回合区右下角，没有漂到中间或塌回左上角。

`04c-mobile-end-turn-restored.png`

- 再次点击后，结束回合主按钮与右侧额度提示恢复显示。
- 主按钮和提示块的相对位置保持不变，仍然是“按钮在左，提示在右”。
- 小按钮继续挂在主按钮右下角，没有挤占主布局空间。

`13-desktop-end-turn-restored.png`

- PC 端同样存在这个隐藏/恢复功能键。
- 恢复显示后，桌面端的结束回合按钮、右侧额度提示和小按钮都在同一组结束回合区内，布局稳定。
- 说明这次实现同时覆盖移动端和 PC，且没有把主按钮位置改掉。

### 本轮判定

- “点击一次隐藏结束回合按钮和额度，再次点击恢复”已经成立。
- 移动端隐藏态能减少右侧遮挡。
- PC 端同样可用。

## 2026-03-19 HUD 比例与分辨率基线复核

### 本轮代码

- `D:\gongzuo\webgame\BoardGame\src\games\smashup\ui\layoutConfig.ts`
  - 新增 `topHudScale` 与 `endTurnHudScale`，把顶部 HUD 和结束回合区纳入显式比例 token。
- `D:\gongzuo\webgame\BoardGame\src\games\smashup\Board.tsx`
  - 顶部回合便签、计分版和结束回合区都改为读取同一组 HUD 比例参数。
  - 移动端结束回合区右侧预留空间也改为随 `endTurnHudScale` 同步缩放，不再用固定 `92px`。
- `D:\gongzuo\webgame\BoardGame\e2e\smashup-4p-layout-test.e2e.ts`
  - 手机横屏基线改为固定 `800x450`（16:9）。
  - 桌面对照基线改为固定 `1920x1080`。
  - 本轮按用户要求移除平板段，不再单独把 `1024x768` 作为强制验收档。

### 本轮实际运行

```bash
npm run typecheck
npm run test:e2e:ci:file -- e2e/smashup-4p-layout-test.e2e.ts "移动端横屏应保持四人局布局可用，并支持手牌长按看牌"
```

结果：

- `typecheck` 通过
- 单用例 E2E 通过：`1 passed`

### 本轮实际查看的截图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04b-mobile-end-turn-hidden.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\13-desktop-end-turn-restored.png`

### 读图结论

`04-mobile-landscape-layout.png`

- 当前手机横屏主态已经改成 `800x450` 的标准 `16:9`。
- 计分版和结束回合区的视觉体量都比上一版更接近 `PC`，不再显得单独膨胀。
- 主棋盘、顶部 HUD、右侧结束回合区的相对关系明显更统一。

`04b-mobile-end-turn-hidden.png`

- 隐藏后只保留小按钮，右侧随从区不再被结束回合区挡住。
- 小按钮仍固定在原结束回合区右下角，没有因为缩放而漂移。

`13-desktop-end-turn-restored.png`

- 当前桌面对照图已经是 `1920x1080`。
- 这张图可以直接作为本轮手机图的 `PC` 参考基线，不再混用 `1366x768`。
- 结束回合区、计分版与主棋盘的相对 framing 保持稳定。

### 本轮判定

- `smashup` 当前这版已经把“棋盘一套比例、HUD 另一套比例”的问题收了一步。
- 本轮手机横屏主态更接近 `PC` 参考图。
- 本轮验收基线已统一为：`PC 1920x1080`，手机横屏 `800x450`。
