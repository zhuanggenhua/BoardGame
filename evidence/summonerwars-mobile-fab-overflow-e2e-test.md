# 召唤师战争移动端 FAB 拖拽释放与展开框锚点 E2E 证据

## 测试命令

```bash
npm run test:e2e:ci:file -- e2e/summonerwars.e2e.ts "移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮"
```

## 本轮验收目标

- 展开后的主 FAB 在上下拖拽释放后，不得先跳回拖拽前原位再追到目标位。
- 主 FAB 与已展开面板在释放阶段必须共用同一锚点，不得出现球和展开框分离。
- 长面板回收到视口内后，不能压住结束阶段按钮，也不能把短面板锚到错误按钮上。

## 关键截图与人工复核

### 1. 顶部越界恢复后的长面板

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\30-mobile-fab-expanded-top-overflow-recovered.png`

人工复核：

- 我实际看到右侧主 FAB 竖列停在棋盘右边，行动日志面板完整落在视口内，没有从屏幕顶端或底端被裁掉。
- 我实际看到长面板仍贴着 FAB 列展开，没有出现“主球已经走了但展开框还停在原位”的分离现象。
- 该截图达到“顶部拖拽后长面板仍可见且与主 FAB 同锚”的验收标准。

### 2. 底部越界恢复后的长面板

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\31-mobile-fab-expanded-bottom-overflow-recovered.png`

人工复核：

- 我实际看到主 FAB 经过向下拖拽后仍留在屏幕下半区，长面板被回收到可见区，而不是把按钮列直接顶出屏幕外。
- 我实际看到行动日志面板完整显示在主 FAB 左侧，右侧回合与阶段按钮仍保持独立，没有被日志面板盖住。
- 该截图达到“底部拖拽后仍保留向下停靠意图，同时展开框不脱锚、不挡关键按钮”的验收标准。

### 3. 底部场景下短面板仍锚定当前按钮

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\31b-mobile-fab-expanded-bottom-undo-anchor-zoom.png`

人工复核：

- 我实际看到半透明“撤回操作”短面板紧贴蓝色撤回按钮展开，右下角的设置按钮在更下方，没有被误当作锚点。
- 我实际看到短面板和按钮列之间保持固定贴合距离，没有出现释放后短面板悬在旧位置的现象。
- 该截图达到“短面板继续锚定当前按钮，不串到兄弟按钮”的验收标准。

### 4. 展开态下结束阶段按钮仍可点击

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\32-mobile-fab-expanded-end-phase-clickable.png`

人工复核：

- 我实际看到右侧红色结束阶段按钮完整可见，FAB 列停在其左侧，不与按钮重叠。
- 我实际看到对局已经推进到“移动至多3个单位，每个最多2格”的下一阶段，说明结束阶段按钮在展开态下仍可成功点击。
- 该截图达到“FAB 与展开框恢复后仍给关键流程按钮让位”的验收标准。

## 自动断言补充

- 释放后连续采样主 FAB 前几帧位置，断言其不会朝拖拽前原位回跳。
- 释放后连续采样主 FAB 与退出面板的垂直锚点距离，断言面板始终跟随当前按钮。
- 顶部、底部两种场景都校验长面板保持在视口内，且短面板继续锚定各自按钮。

## 本轮实现落点

- `src/components/system/FabMenu.tsx`
  - 拖拽结束后不再通过 `animate left/top` 二次追位，改为把最终停靠位置与拖拽偏移在同一次布局提交里收敛。
  - 使用 `useLayoutEffect` 在位置落盘后的首个布局阶段清零 drag motion values，避免主球先回原位再追到目标位。
- `e2e/summonerwars.e2e.ts`
  - 在现有移动端 FAB 回归用例中补了释放帧采样，直接覆盖“回跳”和“展开框脱锚”这两个回归风险。
