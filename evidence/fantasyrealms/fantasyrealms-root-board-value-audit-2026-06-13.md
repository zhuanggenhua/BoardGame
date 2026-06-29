# Fantasy Realms 根目录误落 `Board` 价值审计（2026-06-13）

> （历史阶段，2026-06-13）
>
> 本文记录的是 **2026-06-13 当时** 对“根目录误改还有没有吸收价值”的一次过程审计。
> 它不是当前正式 UI 真相源，正文中提到的 `fantasyrealms-live-deck-cue`、`fantasyrealms-live-guidance-note` 等当时状态，也**不得**再被当成当前桌面正式方向。
> 当前正式方向以 `evidence/fantasyrealms/fantasyrealms-current-route-approval-2026-06-13.md` 和 `fr-merge-pass2-*` 真实运行图为准。

## 目标

只回答一个问题：

根目录当前误落的 `src/games/fantasyrealms/Board.tsx` 与 `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`，相对正确 worktree 版本，是否还存在**必须吸回** `feat/game-fantasyrealms` 的真实价值。

## 现场

- 根目录错误落点：
  - `D:\gongzuo\webgame\BoardGame\src\games\fantasyrealms\Board.tsx`
  - `D:\gongzuo\webgame\BoardGame\src\games\fantasyrealms\__tests__\Board.foundation.test.tsx`
- 正确实现真相源：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\src\games\fantasyrealms\Board.tsx`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\src\games\fantasyrealms\__tests__\Board.foundation.test.tsx`

本轮检查方法：

1. 看根目录当前 `git diff`，只识别误落这两笔到底改了什么；
2. 再用 `rg` 检查这些内容在正确 worktree 里是否已经存在；
3. 最后判断剩下的是否只是旧试探、尺寸微调或反向删合同。

## 一、根目录这两笔里，已被正确 worktree 覆盖的内容

根目录这次误落中，表面上看像“有价值”的这批 live UI 收口，其实在正确 worktree 里已经都存在：

- 牌库短提示 `fantasyrealms-live-deck-cue`
- 运行时短提示 `fantasyrealms-live-guidance-note`
- 双人开局空手 7 槽占位
- 手牌空位 `fantasyrealms-card-slot-empty`
- `data-slot-count`
- 紧凑横屏 `fantasyrealms-compact-focus-strip`
- 焦点预览 `fantasyrealms-focus-preview`

也就是说，根目录误落并没有带来“worktree 缺失的功能性 UI 收口”；这些正式能力，正确 worktree 本身已经有。

## 二、根目录当前真正还独有的，只剩三类

### 1. 若干未验证的尺寸与间距微调

例如：

- live river 卡宽 / 间距 / rowOffset 调小
- live focus dock 的 top/right/width 改位
- compact focus strip 宽度、padding、字号微调

这些差异的性质是：

- 只是在错误落点上做的视觉微调；
- 没有独立的当前截图证据；
- 也没有在正确 worktree 的真实页面上验证过。

因此它们不能算“必须迁回的价值”，最多只能算错树里的旧试探。

### 2. 把 collapsed focus 改成只剩摘要，不再显示焦点预览

根目录误落里有一条明确方向：

- `shouldCollapseFocusPreview` 时，不再保留 `fantasyrealms-focus-preview`
- 改成只显示名字 + 分值摘要

这条在正确 worktree 里**不是缺失**，而是**相反方向的正式合同已存在**：

- 正确 worktree 仍保留 `fantasyrealms-focus-preview`
- 并且 foundation 测试多处还在明确验证：
  - atlas 焦点预览存在
  - 牌背焦点预览存在
  - review / hidden-info 下焦点预览存在

因此这不是“有价值但还没带回”的变更，而是另一套旧 UI 试探。

### 3. 配套测试把焦点预览合同删掉

根目录误落测试里对应地删掉了：

- `focus-preview` atlas 断言
- `focus-preview` back renderer 断言

这同样不是独立价值，而只是“错误落点 UI 试探”的伴生测试。

## 三、为什么当前裁决是“不再吸收”

### 1. 没有新的功能性真相

根目录误落没有补出 worktree 缺失的正式能力；worktree 已经有：

- 牌库 cue
- guidance note
- 开局空手 7 槽
- 真实焦点预览
- compact focus strip

### 2. 剩余差异没有当前产品证据

根目录当前剩下的独有差异主要是尺寸、间距和删掉焦点预览。

这些都没有：

- 当前正确 worktree 的真实截图支撑
- 当前专项证据文档支撑
- 当前专项测试链支撑

因此不能作为“值得吸回 worktree 的价值”。

### 3. 删掉焦点预览会直接撞到正确 worktree 当前合同

正确 worktree 当前已经把焦点预览写进：

- `Board.tsx` 正式实现
- `Board.foundation.test.tsx` 多条断言

如果反向吸收根目录误落，就不是“补价值”，而是把正确 worktree 的当前合同又改回另一条旧试探线。

## 四、当前结论

当前根目录误落这两笔的裁决应继续锁定为：

1. `src/games/fantasyrealms/Board.tsx`
   - **不再吸回 worktree**
2. `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
   - **不再吸回 worktree**

原因不是“根目录完全没改东西”，而是：

- 真正有价值的 live UI 收口，正确 worktree 已经具备；
- 根目录剩余独有差异只是错误落点上的尺寸微调与焦点预览删减试探；
- 这些差异既没有当前产品证据，也与正确 worktree 当前合同方向不一致。
