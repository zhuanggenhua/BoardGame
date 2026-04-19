# 大杀四方联机 AI 回合切回玩家时的 UI 过渡证据

## 范围

- 场景：联机房间中，AI 座位结束自己的回合，控制权切回玩家 `0`
- 目的：确认用户感知到的“整个 UI 刷新一下”是否来自整板重挂载 / loading 闪屏

## 运行方式

```bash
npm run test:e2e:ci:file -- e2e/smashup-phase-transition-simple.e2e.ts "在线 AI 结束回合切回我方时不应出现整板重挂载或 loading 闪屏"
```

## 截图证据

### 切回前

![切回前](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/%E5%9C%A8%E7%BA%BF-AI-%E7%BB%93%E6%9D%9F%E5%9B%9E%E5%90%88%E5%88%87%E5%9B%9E%E6%88%91%E6%96%B9%E6%97%B6%E4%B8%8D%E5%BA%94%E5%87%BA%E7%8E%B0%E6%95%B4%E6%9D%BF%E9%87%8D%E6%8C%82%E8%BD%BD%E6%88%96-loading-%E9%97%AA%E5%B1%8F/%E5%9C%A8%E7%BA%BF-AI-%E7%BB%93%E6%9D%9F%E5%9B%9E%E5%90%88%E5%88%87%E5%9B%9E%E6%88%91%E6%96%B9%E6%97%B6%E4%B8%8D%E5%BA%94%E5%87%BA%E7%8E%B0%E6%95%B4%E6%9D%BF%E9%87%8D%E6%8C%82%E8%BD%BD%E6%88%96-loading-%E9%97%AA%E5%B1%8F-online-ai-pass-turn-before-host-turn.png)

人工观察：

- 左上回合条显示 `回合4 / 对手 / 出牌阶段`
- 底部 3 个基地、左下牌堆、右上记分板都已正常渲染，没有 loading 覆盖层
- 右下我方结束回合按钮未出现

### 切回后

![切回后](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/%E5%9C%A8%E7%BA%BF-AI-%E7%BB%93%E6%9D%9F%E5%9B%9E%E5%90%88%E5%88%87%E5%9B%9E%E6%88%91%E6%96%B9%E6%97%B6%E4%B8%8D%E5%BA%94%E5%87%BA%E7%8E%B0%E6%95%B4%E6%9D%BF%E9%87%8D%E6%8C%82%E8%BD%BD%E6%88%96-loading-%E9%97%AA%E5%B1%8F/%E5%9C%A8%E7%BA%BF-AI-%E7%BB%93%E6%9D%9F%E5%9B%9E%E5%90%88%E5%88%87%E5%9B%9E%E6%88%91%E6%96%B9%E6%97%B6%E4%B8%8D%E5%BA%94%E5%87%BA%E7%8E%B0%E6%95%B4%E6%9D%BF%E9%87%8D%E6%8C%82%E8%BD%BD%E6%88%96-loading-%E9%97%AA%E5%B1%8F-online-ai-pass-turn-after-host-turn.png)

人工观察：

- 左上回合条变为 `回合5 / 你自己 / 出牌阶段`
- 棋盘主体位置、基地位置、牌堆位置、记分板位置保持不变，没有整页白屏或重新载入痕迹
- 页面中央新增“轮到你了！”便签提示，右下新增结束回合圆形按钮和操作入口

## 自动监控结果

测试在回合切换期间持续轮询以下信号，并全部断言为 0：

- `[data-testid="loading-screen"]` 可见采样次数：0
- `su-turn-tracker` DOM 替换次数：0
- `su-scoreboard` DOM 替换次数：0
- `su-hand-area` DOM 替换次数：0
- 上述 3 个节点的断连次数：0

## 结论

- 本次复现中，没有证据表明 `MatchRoom` / `CriticalImageGate` / `BoardBridge` 在 AI 回合切回我方时发生整板重挂载
- 用户感知到的“刷新一下”更像是棋盘内建的回合切换表现：
  - 轮到我方时弹出中央“轮到你了！”提示
  - 我方操作区在该时点以 `AnimatePresence` 方式进入
- 从源码触发条件看，这套表现并不依赖 AI，本质上是 `currentPid -> playerID` 切回我方时的通用逻辑

## 对应代码

- 回合切换时显示“轮到你了！”：`src/games/smashup/Board.tsx:1409-1426`
- 回合/玩家切换时重置本地 UI 状态：`src/games/smashup/Board.tsx:1429-1443`
- 我方操作按钮在 `isMyTurn` 时重新进场：`src/games/smashup/Board.tsx:2439-2465`
- 中央“轮到你了！”提示的渲染：`src/games/smashup/Board.tsx:3133-3155`
