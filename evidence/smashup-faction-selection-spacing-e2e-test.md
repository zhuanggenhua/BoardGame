# Smash Up 选派界面移动端等比缩放 E2E 证据

## 范围

- 游戏：`smashup`
- 场景：派系选择界面
- 目标：验证手机横屏是否按 `PC 端 1920x1080` 同构缩放，而不是改成另一套移动端布局

## 运行命令

```bash
npm run test:e2e:ci:file -- smashup-faction-selection-spacing.e2e.ts
```

## 截图证据

- 移动端：`test-results/evidence-screenshots/smashup-faction-selection-spacing/mobile-landscape-800x450.png`
- PC 对照：`test-results/evidence-screenshots/smashup-faction-selection-spacing/desktop-reference-1920x1080.png`

## 人工看图结论

### `mobile-landscape-800x450.png`

- 首屏第一行保持 `5` 张派系卡，没有再被压成 `3` 列或 `4` 列手机稿。
- 标题、提示纸条、派系卡、底部玩家选派条仍保持同一套上下构图关系，整体只是缩小，没有改主次层级。
- 缩放舞台没有横向出屏；左右边距仍存在，卡牌之间保持可辨识间隔。

### `desktop-reference-1920x1080.png`

- PC 端基线首屏同样是第一行 `5` 张派系卡，第二行继续铺开，确认这轮对照口径应为 `5` 列。
- 标题和提示纸条位于画面上方中部，底部玩家选派条处于下方中央，构图与移动端截图一致。
- 底部玩家选派条在 PC 图里本来就只露出上半部分，因此移动端同样只露出上半部分属于同构结果，不是本轮新回归。

## 自动断言结果

- 移动端无横向溢出。
- 移动端启用了主选派缩放舞台，舞台左右边界均在视口内。
- 移动端与 PC 首屏都满足“前五张同一行，第六张换行”。
- 移动端首张派系卡的宽度占视口比例与 PC 的差值小于 `0.035`。

## 结论

- 本轮已把大杀四方派系选择页从“移动端单独压缩布局”修正为“按 PC 首屏构图整体等比缩放”。
- 当前截图下未见新的移动端横向溢出或首屏列数漂移。
