# 七大恨桌面端 UI 实施核对（2026-05-16）

## 本轮范围

- 只核对桌面端 `1920x1080`。
- 冻结设计稿入口：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-ui-imagegen-review\final-design.png`
- 当前唯一运行截图：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\qidahen-desktop-current.png`

## 实际看到什么

### `final-design.png`

- 顶部是三枚薄玩家状态 chip，中心贴顶，不是厚导航条。
- 左上轮盘是单独交互主体，轮盘下方只有一组纪年卡。
- 右侧顺序是 `朝鲜牌库 / 朝鲜弃牌 / 具体动作 rail`。
- 底部是完整居中的 `牌库 + 手牌 + 弃牌` 簇，支付条贴在手牌簇上沿。

### `qidahen-desktop-current.png`

- 顶部三枚玩家状态条保持单行薄签，没有再出现 `当前` 被压成两行的问题。
- 右侧顺序已经收敛为 `朝鲜牌库 / 朝鲜弃牌 / 具体动作 rail`，没有父级词回流。
- 底部 `牌库 + 手牌 + 弃牌` 仍保持完整一簇，贴底且围绕主舞台中线，不再被右侧列推偏。
- 左上轮盘当前是前端独立交互对象，不再直接使用主棋盘硬裁的旧轮盘区域。
- 但左上仍能看出一层人为清理过的纸面补丁，说明“旧轮盘/旧规则框残影”还没有彻底自然地退掉。

## 当前结论

- 结构层面已不是最初那种旧布局和假轮盘路线。
- 交付层面仍未达到“自然贴稿收口”，当前最大剩余差距集中在左上轮盘与底图过渡痕迹。
- 本文档现在只保留一个当前截图；本轮中间版本图已按清理规则移除，不再把失败迭代留在 `test-results/` 里充当长期证据。

## 残余风险

- 左上轮盘与底图过渡仍可见补丁痕迹，需要继续做更自然的底图处理或更彻底的轮盘区域所有权收敛。
- 当前地图区域坐标仍是粗略示意点，不能作为最终规则命中区依据。

## 验证命令

```powershell
npx eslint src/games/qidahen/Board.tsx
npx vitest run src/games/qidahen/__tests__/Board.test.ts
npm run typecheck
```

三项均通过。当前截图由 Playwright 在 `http://127.0.0.1:4275/play/qidahen?numPlayers=3` 真实页面生成。
