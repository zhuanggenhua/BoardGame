# Change: 恢复幻想国度当前工作区 UI 与 foundation 口径一致

## Why

- 当前根工作区 `D:\gongzuo\webgame\BoardGame` 的 `fantasyrealms` 真实运行时，与此前引用的 `.worktrees/fantasyrealms` 历史完成截图并不是同一套 UI。
- 现在已经出现三层错位：当前根工作区真实页面、历史 worktree 证据、foundation 已完成口径。继续直接改按钮或局部样式，只会在错误对象上打补丁。
- 用户明确指出问题不是单个控件，而是“整个 UI 不对”，因此需要先把当前正式桌面壳层、证据来源和验收边界重新锁死，再进入实现修复。

## What Changes

- 为 `fantasyrealms-foundation` 增补“当前工作区真实页面才是完成验收真相源”的要求。
- 明确桌面端与紧凑横屏视口必须属于同一套正式牌桌壳层，不能出现两个像不同游戏的 UI 家族。
- 明确 `compact-landscape` 是横屏承载语义，不得再用 `stacked / 堆叠态` 这类旧命名把当前实现与证据引向竖屏信息流。
- 以当前根工作区 `fantasyrealms` 真实运行时为目标，恢复桌面主路径与紧凑横屏视口到同一 foundation 方向。
- 审计并收敛 `src/games/fantasyrealms/**`、`design-system/games/fantasyrealms.md`、`evidence/fantasyrealms/**`，清除把历史 worktree 产物混成当前完成证据的口径。

## Impact

- Affected specs:
  - `fantasyrealms-foundation`
- Affected code:
  - `src/games/fantasyrealms/Board.tsx`
  - `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
  - `design-system/games/fantasyrealms.md`
  - `evidence/fantasyrealms/**`
