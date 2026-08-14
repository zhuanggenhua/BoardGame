# DiceThrone 一掷千金右侧骰盘完整流程 E2E 证据（2026-07-20）

## 范围

- 游戏：DiceThrone
- 卡牌：一掷千金（`card-one-throw-fortune`）
- 响应牌：弹一手（`card-flick`）
- 本轮目标：
  - 保留《一掷千金》卡牌特写。
  - 取消奖励骰的中央骰子特写；卡牌特写里也不附带奖励骰。
  - 奖励骰统一显示在右侧骰子盘，由右侧骰子盘提供改骰与确认入口。
  - 奖励骰结算前仍保留响应窗口，让《弹一手》可以真实介入并修改右侧奖励骰。

## 改动摘要

- `.spec/knowledge/standards/e2e-verification.md`
  - 明确端到端截图必须是一组覆盖完整流程步骤的截图，不能只给单张中间产物。
  - 用户要求打开端到端图时，必须一次性打开整组原图。
- `src/games/dicethrone/ui/CardSpotlightOverlay.tsx`
  - 卡牌特写项保留卡牌 ID，并在特写层输出可验证的卡牌锚点。
- `src/games/dicethrone/hooks/useCardSpotlight.ts`
  - 卡牌特写继续展示卡牌本体。
  - 奖励骰已由右侧骰盘承接时，卡牌特写不再附带奖励骰骰子。
- `e2e/dicethrone/dicethrone-one-throw-fortune-spotlight.e2e.ts`
  - 首图改为等待并断言《一掷千金》卡牌特写本体已渲染。
  - 明确断言首图没有 `card-spotlight-die` / `bonus-die-overlay`。
  - 后续截图覆盖右侧骰盘展示、确认、响应窗口、弹一手选骰、改骰和最终结算。

## 已执行验证

- `npx eslint src/games/dicethrone/ui/CardSpotlightOverlay.tsx src/games/dicethrone/hooks/useCardSpotlight.ts e2e/dicethrone/dicethrone-one-throw-fortune-spotlight.e2e.ts`
  - 结果：0 errors，21 warnings。
  - warnings 为 E2E `any` 与 `useCardSpotlight.ts` 既有 hook warning，不阻断本轮。
- `git diff --check -- src/games/dicethrone/ui/CardSpotlightOverlay.tsx src/games/dicethrone/hooks/useCardSpotlight.ts e2e/dicethrone/dicethrone-one-throw-fortune-spotlight.e2e.ts`
  - 结果：无 whitespace error，仅 LF/CRLF 提示。
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-one-throw-fortune-spotlight.e2e.ts`
  - 结果：2 passed。
  - 覆盖用例：
    - 一掷千金奖励骰显示在右侧骰盘并可确认。
    - 一掷千金奖励骰结算前会给弹一手真实介入窗口。

## 截图与图面判断

截图目录：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e`

预览相册：

`http://8.148.71.102:18080/#/boardgame/dicethrone-one-throw-fortune-right-tray`

### 1. 卡牌特写保留但无骰子特写

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\一掷千金奖励骰显示在右侧骰盘并可确认\01-一掷千金卡牌特写保留但无骰子特写.jpg`
- 我实际看到：
  - 中央展示的是《一掷千金》卡牌特写本体。
  - 卡牌特写保留，没有被取消。
  - 特写里没有奖励骰骰子，也没有中央奖励骰特写弹层。
- 判定：
  - 合格。本轮只取消骰子特写，没有取消卡牌特写。

### 2. 奖励骰在右侧骰盘独立显示

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\一掷千金奖励骰显示在右侧骰盘并可确认\02-一掷千金奖励骰-右侧骰盘独立显示并可确认.jpg`
- 我实际看到：
  - 卡牌特写退场后，奖励骰显示在右侧骰子盘。
  - 右侧有“确认奖励骰”按钮。
  - 中央没有奖励骰特写弹层。
- 判定：
  - 合格。奖励骰由右侧骰盘承接。

### 3. 右侧确认后获得 CP

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\一掷千金奖励骰显示在右侧骰盘并可确认\03-一掷千金奖励骰-右侧确认后获得CP.jpg`
- 我实际看到：
  - 右侧奖励骰流程已收口。
  - 一掷千金进入弃牌区。
  - CP 已按奖励骰结果增加。
- 判定：
  - 合格。右侧确认入口能推进真实结算。

### 4. 响应窗口期间攻击方确认禁用

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\一掷千金奖励骰结算前会给弹一手真实介入窗口\04a-一掷千金奖励骰-响应窗口期间攻击方右侧确认禁用.jpg`
- 我实际看到：
  - 攻击方视角仍能看到右侧奖励骰。
  - 攻击方“确认奖励骰”按钮处于禁用态。
  - 中央没有奖励骰弹层抢占交互。
- 判定：
  - 合格。奖励骰结算没有绕过响应窗口。

### 5. 弹一手响应窗口可见

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\一掷千金奖励骰结算前会给弹一手真实介入窗口\04-一掷千金奖励骰-弹一手响应窗口可见.jpg`
- 我实际看到：
  - 防守方可见《弹一手》。
  - 响应窗口提供真实响应入口。
  - 奖励骰仍在右侧骰子盘。
- 判定：
  - 合格。《弹一手》没有被右侧骰盘重构吃掉。

### 6. 弹一手选择右侧奖励骰

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\一掷千金奖励骰结算前会给弹一手真实介入窗口\05-一掷千金奖励骰-弹一手选择奖励骰.jpg`
- 我实际看到：
  - 《弹一手》已打出。
  - 右侧奖励骰本体被高亮。
  - 改骰按钮挂在右侧骰盘奖励骰旁边。
- 判定：
  - 合格。《弹一手》介入目标落在真实奖励骰本体上。

### 7. 弹一手已修改奖励骰

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\一掷千金奖励骰结算前会给弹一手真实介入窗口\06-一掷千金奖励骰-弹一手已改骰.jpg`
- 我实际看到：
  - 右侧奖励骰点数已经改变。
  - 改骰确认入口仍在右侧骰盘交互区。
- 判定：
  - 合格。右侧骰盘不仅展示奖励骰，也承接《弹一手》的改骰流程。

### 8. 响应结束后攻击方确认可用

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\一掷千金奖励骰结算前会给弹一手真实介入窗口\07-一掷千金奖励骰-攻击方右侧确认可用.jpg`
- 我实际看到：
  - 响应窗口与《弹一手》改骰交互已经退场。
  - 攻击方视角右侧奖励骰保留修改后的结果。
  - “确认奖励骰”按钮恢复可用。
- 判定：
  - 合格。响应结束后才允许攻击方确认奖励骰。

### 9. 按修改后奖励骰获得 CP

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-one-throw-fortune-spotlight.e2e\一掷千金奖励骰结算前会给弹一手真实介入窗口\08-一掷千金奖励骰-按修改后获得CP.jpg`
- 我实际看到：
  - 一掷千金进入弃牌区。
  - CP 按《弹一手》修改后的奖励骰结果结算。
  - 右侧奖励骰待结算状态已收口。
- 判定：
  - 合格。修改后的奖励骰结果真实参与最终 CP 结算。

## 预览站发布验证

- 本地相册目录：
  - `D:\gongzuo\webgame\image-preview\data\projects\boardgame\tasks\dicethrone-one-throw-fortune-right-tray\latest`
- 服务器目录：
  - `/home/admin/image-preview/data/projects/boardgame/tasks/dicethrone-one-throw-fortune-right-tray/latest`
- 服务器验证：
  - `curl -fsS http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`。
  - 服务器 `latest` 目录只保留 9 张新版图片和 `manifest.json`。
  - 公开详情页 `http://8.148.71.102:18080/#/boardgame/dicethrone-one-throw-fortune-right-tray` 返回 200。
  - `/api/tasks/boardgame/dicethrone-one-throw-fortune-right-tray` 返回 9 张图片。
  - 9 张公开图片 URL 均返回 200。

## 结论

- 本轮重构达成：
  - 《一掷千金》卡牌特写保留。
  - 奖励骰骰子特写取消，卡牌特写中不再附带骰子。
  - 奖励骰统一由右侧骰子盘承接。
  - 《弹一手》仍能在奖励骰结算前通过响应窗口介入，并在右侧骰子盘改骰。
  - 改骰后的奖励骰结果会用于最终 CP 结算。
- 这组 9 张 E2E 截图可以作为本轮收口证据。
