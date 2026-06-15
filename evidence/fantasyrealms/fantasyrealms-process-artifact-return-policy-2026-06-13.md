# Fantasy Realms 过程文件回主线裁决（2026-06-13）

> 历史过程说明：
> 本文记录的是当时为了判断“哪些过程文件该不该跟专项一起回主线”所做的过程裁定。
> 它不是今天的实施指令，也不等于今天应继续执行回主线、执行 merge，或按本文直接挑文件操作。
> 今天若要判断当前正式方向，仍应回到 `fr-merge-pass2-*` 真相图、活实现与活测试合同。

## 目标

回答一个具体问题：

当前 `fantasyrealms` worktree 里的 `task_plan / progress / evidence` 这类过程文件，当时哪些应跟实现一起回主线，哪些只该留在 worktree 作为本次修复与审计历史。

## 现场

- 根目录 `main`：`D:\gongzuo\webgame\BoardGame`
- Fantasy Realms worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`

## 一、`task_plan.md / progress.md` 不应直接回主线

### 原因

#### 1. 根目录当前已有自己的长期计划与历史进度

根目录当前文件头已经明确写了：

- `task_plan.md`
  - “不自动代表当前对话 active goal”
  - 当前主体仍是 DiceThrone 历史长期计划快照
- `progress.md`
  - 当前主体也是多条历史专项推进记录

这说明它们在主线里承担的是：

- 仓库层历史计划入口
- 长期任务快照
- 跨专项流水记录

而不是 “Fantasy Realms 单专项当前 worktree 的正式真相源”。

#### 2. Fantasy Realms worktree 里的这两份文件包含大量专项阶段流水

当前 worktree 的：

- `task_plan.md`
- `progress.md`

已经混入了大量仅对本次 worktree 推进成立的阶段记录，例如：

- 旧 `stacked` 命名收口（这里的 `stacked` 只是历史断点命名）
- 根目录误改吸收审计
- 回主线内容审计
- worktree 脏改集合审计
- 当前 `Board.tsx` warning 清理

这些内容对“实现是什么”有帮助，但对主线仓库来说更像：

- 专项 worktree 推进日志
- 本轮修复过程记录
- merge 前准备笔记

不是应长期常驻在主线根目录的稳定入口。

### 当前裁决

`task_plan.md / progress.md`：

- **不直接跟 Fantasy Realms 实现一起回主线**
- 保留在当前 worktree，作为本次专项线与回主线准备的历史记录

若后续主线需要保留结论，只应：

1. 抽取最终稳定结论；
2. 写进对应 `evidence/` 或正式专项文档；
3. 不把整份阶段流水原样带回主线根目录。

## 二、5 份新增 evidence 需继续拆成“产品证据”与“过程审计”

### A. 应回主线的产品证据

这 3 份文档直接证明 Fantasy Realms 当前产品链路、当前 UI 和当前用户体验，不是在讲“这次怎么修 worktree”：

#### 1. `fantasyrealms-duel-opening-online-flow-2026-06-13.md`

证明内容：

- 双人 online 开局关键决策流
- 开局 `0` 手牌不再像卡死
- 摸牌 / 弃牌 / 等待 AI 的每个关键前图都能看出下一步

这是**产品行为证据**。

#### 2. `fantasyrealms-ui-room-entry-first-loop-2026-06-13.md`

证明内容：

- 首页真实建房入口
- `加入 AI`
- 自动进房
- 首轮摸弃
- AI 自动推进
- 回到 host

这是**产品入口链路证据**。

#### 3. `fantasyrealms-full-flow-guidance-2026-06-13.md`

证明内容：

- 当前 worktree 真实前端现场
- 首页真实入口一路到终局
- 关键前图是否能直接看出下一步

这是**当前产品全流程证据**。

### B. 不应回主线的过程审计

以下 3 份文档本质上不是 Fantasy Realms 产品证据，而是在回答“这次 worktree 修复与回主线准备怎么做”：

#### 1. `fantasyrealms-main-return-audit-2026-06-13.md`

内容性质：

- 回主线内容分桶
- 本体 / 共享支撑 / 项目规则冲突
- merge 前裁决

这是**回主线准备文档**，不是产品真相。

#### 2. `fantasyrealms-root-mischange-absorption-audit-2026-06-13.md`

内容性质：

- 根目录误改吸收审计
- 哪些误改不再迁入 worktree

这是**错误落点修复过程文档**，不是产品真相。

#### 3. `fantasyrealms-worktree-dirty-set-audit-2026-06-13.md`

内容性质：

- 当前 worktree 未提交集合审计
- 换行噪音与真实 diff 区分

这是**工作树状态审计文档**，不是产品真相。

### 当前裁决

#### 应回主线

- `evidence/fantasyrealms/fantasyrealms-duel-opening-online-flow-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-ui-room-entry-first-loop-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-full-flow-guidance-2026-06-13.md`

#### 不应回主线

- `evidence/fantasyrealms/fantasyrealms-main-return-audit-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-root-mischange-absorption-audit-2026-06-13.md`
- `evidence/fantasyrealms/fantasyrealms-worktree-dirty-set-audit-2026-06-13.md`

## 三、当前结论

当前过程文件的回主线口径已经可以固定为：

1. `task_plan.md / progress.md` 不直接回主线；
2. 新增 evidence 里，只有**证明当前产品行为**的 3 份应跟实现一起回主线；
3. 新增 evidence 里，凡是描述“这次 worktree 怎么修 / 怎么审 / 怎么准备 merge”的 3 份，都只留在当前 worktree 历史里。

## 四、当前依据

- 根目录 `task_plan.md` 顶部当前内容
- 根目录 `progress.md` 顶部当前内容
- 当前 6 份相关 evidence 文档正文
- 当前 worktree 真实未提交集合审计：
  - `evidence/fantasyrealms/fantasyrealms-worktree-dirty-set-audit-2026-06-13.md`
