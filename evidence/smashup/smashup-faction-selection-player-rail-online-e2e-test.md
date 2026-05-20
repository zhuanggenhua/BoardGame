# SmashUp 两人在线选派系玩家 rail E2E 证据

## 范围

- `src/games/smashup/ui/FactionSelection.tsx`
- `e2e/smashup/smashup-faction-selection-player-rail-online.e2e.ts`

## 根因结论

- `2026-05-20 08:43:56` 的提交 `a1eba9f4` 新增了 `useMinimalPlayerRail` 分支。
- 该分支把两人局桌面草稿态玩家卡压到了 `w-[82px] / w-[76px]`，派系槽位压到 `w-6 h-6`，名字字号压到 `text-[7.5px]`，当前玩家提示压到 `text-[6px]`。
- 这不是“房主代 AI 选派系修复”带出来的副作用，而是同一次 `FactionSelection.tsx` UI 重做里直接引入的压缩样式。

## 旧基线

- 旧版 E2E 视觉基线截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-faction-selection-spacing\desktop-reference-1920x1080.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-faction-selection-spacing\mobile-landscape-800x450.png`
- 对应旧代码基线：
  - `a1eba9f4^`（也就是 `c169bac9` 版本）里还没有“正常桌面两人局默认走 minimal rail”这条路线。
- 我实际对比到的差异：
  - 旧基线里的底部玩家卡明显更接近“摘要卡”，不是被压成便签块。
  - 旧基线初始页没有搜索/筛选工具条，顶部标题下方直接进入候选卡网格。
  - 旧基线候选卡是更大的桌面密度，不是 `focused desktop draft` 那种高密小卡排法。
  - 因此这次正确修法不是继续微调 `82px/76px` 那套极小分支，而是先把“正常桌面两人局默认走 minimal rail”这个前提撤掉。

## 本轮修正

- 两人局 `useMinimalPlayerRail` 分支恢复到可读尺寸：
  - 当前玩家卡：`112px`
  - 非当前玩家卡：`106px`
  - 已选派系槽位：`28px`
  - 玩家名字号：`9px`
  - 当前玩家提示字号：`7px`
- 同时把 `useMinimalPlayerRail` 的触发条件收窄到**小桌面且矮视口**才启用，正常桌面两人局回到旧基线那条非 minimal 路线。
- 保留这次 UI 重构里的筛选条、布局分支和在线手动代 AI 桥接，不回退整份文件。

## 自动化验证

### 1. 真实在线两人房玩家 rail 回归

命令入口：

```powershell
node .\node_modules\playwright\cli.js test e2e/smashup/smashup-faction-selection-player-rail-online.e2e.ts
```

结果：

- `1 passed`

截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-faction-selection-player-rail-online.e2e\两人在线房的玩家卡与已选派系摘要不应被压成过小尺寸\两人在线房的玩家卡与已选派系摘要不应被压成过小尺寸-two-player-online-selection.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-faction-selection-player-rail-online.e2e\两人在线房的玩家卡与已选派系摘要不应被压成过小尺寸\两人在线房的玩家卡与已选派系摘要不应被压成过小尺寸-two-player-online-player-rail.png`

我实际看到：

- 底部玩家 rail 仍在真实在线房间的选派系页里，未被隐藏或替换成其他占位页。
- `P1 Host-Rail` 与 `P2 AI-Rail` 两张卡都能直接读出名字和两个派系槽，不再是挤成很难辨认的便签块。
- 当前玩家卡高亮仍成立，但没有再靠极端压缩去给上方候选区腾位置。

几何阈值与实测值：

- 最小玩家卡宽度：`106.77px`
- 当前玩家卡宽度：`112.88px`
- 最小派系槽位宽度：`28.24px`
- 最小玩家名字号：`9px`

验收结论：

- 达标。证明两人在线房的玩家 rail 已脱离 `80px` 级别的过度压缩状态。

### 1.1 宽屏当前图 vs 旧基线对比

当前宽屏在线截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-two-player-player-rail-1920\two-player-online-selection-1920.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-two-player-player-rail-1920\two-player-online-player-rail-1920.png`

我实际看到：

- 当前宽屏图已经和旧基线一样，标题下方直接进入候选卡区，没有再露出整条搜索/筛选工具条。
- 当前宽屏图首屏候选卡尺寸已经回到旧桌面密度，不再是先前那种更小、更密的 `focused desktop` 排法。
- 当前宽屏图底部两张玩家卡视觉上已恢复为“摘要卡”尺度，和旧基线属于同一路线，不再是 `80px` 级别的小便签。

仍然存在的非关键差异：

- 当前截图因为测试环境跳过了图片门禁，部分卡图是白底占位，不影响本轮布局对比。
- 当前在线截图里的玩家名是 `Host-Rail-1920 / AI-Rail-1920`，旧基线是 `P0 / P1`，这是测试身份差异，不是布局回归。

对比结论：

- 这轮修正已经把“宽屏两人桌面局误切进新布局路线”的主要回归收回来了。

### 2. 房主代 AI 选派系真实在线链路复核

命令：

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/manual-ai-setup-selection.e2e.ts
```

结果：

- `3 passed`

关键截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\manual-ai-setup-selection.e2e\SmashUp-四人房房主可依次为-3-个-AI-完成派系选择并进入对局\smashup-manual-ai-mid-draft.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\manual-ai-setup-selection.e2e\SmashUp-四人房房主可依次为-3-个-AI-完成派系选择并进入对局\smashup-manual-ai-board-started.png`

验收结论：

- 达标。说明本轮玩家 rail 尺寸修正没有把已修住的“房主代 AI 前置选择”真实在线链路带回归。
