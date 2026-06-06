# FantasyRealms Mahjong PC Pass Check

日期：2026-06-06

## 范围

本次只验证 `PC` 端真实页面，不进入移动端适配。目标是确认新的麻将桌式构图已经通过桌面端主路径：

- opening
- live discard
- gameover

## 结果

### Opening

- 截图：`[fantasyrealms-mahjong-opening-desktop-2026-06-06.png](./fantasyrealms-mahjong-opening-desktop-2026-06-06.png)`
- 关键度量：
  - `handTop = 878`
  - `viewportHeight = 1024`
- 结论：
  - 底部 7 张手牌已经进入首屏
  - 中央公开弃牌区保持公共河位置
  - 右侧焦点与结束进度退为贴边信息

### Live Discard

- 截图：`[fantasyrealms-mahjong-live-discard-desktop-2026-06-06.png](./fantasyrealms-mahjong-live-discard-desktop-2026-06-06.png)`
- 关键度量：
  - `handTop = 820`
  - `dockTop = 223`
  - `viewportHeight = 1024`
- 结论：
  - 抓牌/弃牌进行中时，手牌带仍留在首屏
  - 公开弃牌已回到中央公共区，不再挤到说明栏

### Game Over

- 截图：`[fantasyrealms-mahjong-gameover-desktop-2026-06-06.png](./fantasyrealms-mahjong-gameover-desktop-2026-06-06.png)`
- 关键度量：
  - `handTop = 801`
  - `dockTop = 77`
  - `viewportHeight = 1024`
- 额外核对：
  - `hasCurrentBadge = false`
- 结论：
  - 终局复盘态仍保持牌桌主次关系
  - 不再错误显示 `当前行动`

## 验证链

- `npx vitest run src/games/fantasyrealms` → `4 files / 39 tests passed`
- `npx eslint src/games/fantasyrealms/Board.tsx src/games/fantasyrealms/__tests__/Board.foundation.test.tsx` → 通过
- `npm run i18n:check` → 通过，仍只有仓库既有 3 条 warning

## 结论

新的麻将桌式布局已经通过桌面端真实页面主路径，可以把 `refactor-fantasyrealms-mahjong-table-layout` 视为 **PC 阶段达标**。下一阶段若继续推进，应按既定门禁再进入移动端适配，而不是回头继续维护旧三栏布局。
