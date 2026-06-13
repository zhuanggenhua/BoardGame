# 幻想国度当前工作区 UI 对齐任务

## 0. Approval Gate
- [x] 0.1 用户明确批准 `update-fantasyrealms-current-ui-parity` 的范围与边界

## 1. 真相源锁定
- [x] 1.1 固定当前执行现场：根工作区 `D:\gongzuo\webgame\BoardGame`、当前分支、当前真实运行路由
- [x] 1.2 记录当前根工作区桌面端与紧凑横屏视口真实截图，并与 `.worktrees/fantasyrealms` 历史截图分开归档
- [x] 1.3 明确哪些 evidence 只能降级为“历史候选实现”，不得再作为“当前 UI 已完成”证据

## 2. 桌面壳层收敛
- [x] 2.1 锁定当前正式桌面壳层，只保留一套 `fantasyrealms` 正式牌桌家族
- [x] 2.2 修复当前根工作区桌面主路径，使中央公共区、手牌区与卡牌渲染回到 foundation 口径
- [x] 2.3 修复紧凑横屏视口，使其与桌面端保持同一套对象层级和视觉语言，而不是另一套重面板游戏
- [x] 2.4 清理或降级不再代表正式完成态的旧布局分支、旧测试口径或旧 evidence 文案

## 3. 验收与文档回写
- [x] 3.1 更新 `design-system/games/fantasyrealms.md` 与 `fantasyrealms-foundation` spec，写明“当前工作区真实页面”与“单一正式牌桌壳层”要求
- [x] 3.2 更新 `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`，让测试只为当前正式壳层背书
- [x] 3.3 产出当前根工作区新的桌面/紧凑横屏真实截图 evidence，替换错误完成口径
- [x] 3.4 运行 `openspec validate update-fantasyrealms-current-ui-parity --strict --no-interactive`
- [x] 3.5 清理当前审计链路里把紧凑横屏误写成 `stacked / 堆叠态` 的旧命名，避免再把横屏牌桌理解成竖屏实现
