# 召唤师战争移动端悬浮球越界停靠 E2E 证据

## 测试命令

```bash
npm run typecheck
npm run test:e2e:ci:file -- e2e/summonerwars.e2e.ts "移动横屏：悬浮球可拖出边界并让出结束阶段按钮"
```

## 验收目标

- 悬浮球可以被拖到屏幕边缘外侧停靠，不再强制整颗球弹回原来的视口内区域
- 越界后仍保留一小段可见区域，避免用户彻底找不回入口
- 用户把悬浮球藏到边缘后，移动端 `END PHASE` 等关键按钮仍可点击

## 证据截图

### 1. 贴边半隐藏成功

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：悬浮球可拖出边界并让出结束阶段按钮\30-mobile-fab-overflow-position.png`

![贴边半隐藏成功](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：悬浮球可拖出边界并让出结束阶段按钮/30-mobile-fab-overflow-position.png)

人工复核：

- 悬浮球已经贴到左侧边界，只保留一小段可见抓手，不再弹回原来的屏幕内停靠位。
- 当前视觉结果符合“藏边但不丢入口”的目标。

### 2. 藏边后仍可点击结束阶段

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：悬浮球可拖出边界并让出结束阶段按钮\31-mobile-fab-overflow-and-end-phase-clickable.png`

![藏边后仍可点击结束阶段](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：悬浮球可拖出边界并让出结束阶段按钮/31-mobile-fab-overflow-and-end-phase-clickable.png)

人工复核：

- 悬浮球仍停在左边界贴边隐藏状态，不再占据右侧关键操作区。
- 右侧阶段按钮已完成阶段推进，说明 `END PHASE` 点击没有再被悬浮球阻挡。

## 本次实现

- `src/components/system/FabMenu.tsx`
  - 拖拽后的边界夹取从“完全留在视口内”改为“允许部分越界，但保留少量可见抓手”
  - 初始默认位置仍在视口内；仅用户主动拖拽或恢复已保存位置时允许越界停靠
- `e2e/summonerwars.e2e.ts`
  - 回归用例改为验证“可拖出边界 + 不挡结束阶段按钮”
