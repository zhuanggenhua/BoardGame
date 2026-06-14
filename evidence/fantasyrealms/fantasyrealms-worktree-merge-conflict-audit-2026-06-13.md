# Fantasy Realms 工作树合并冲突审计（2026-06-13）

> 2026-06-13 晚些时候补记：本文件前半段保留了“当时的双边裁决思路”，但**不能再直接拿来执行**。原因是根目录工作区随后已经被一次 Fantasy Realms 文件同步污染，当前真正 blocker 已经升级为：**UI 基线未锁定前，不得继续合并。**

## 当前 blocker（最新）

### 1. 根目录当前工作区已不等于 `main HEAD`

当前根目录工作区已经包含一批从 `.worktrees/fantasyrealms` 同步过来的 Fantasy Realms 文件，因此：

- `D:\gongzuo\webgame\BoardGame\src\games\fantasyrealms\Board.tsx`
- `D:\gongzuo\webgame\BoardGame\src\games\fantasyrealms\__tests__\Board.foundation.test.tsx`

这两份**已经不是“原始 main UI”**，而是被同步后的本地脏改版本。

直接证据：

- 根目录当前工作区相对 `HEAD`：
  - `src/games/fantasyrealms/Board.tsx`：`1002 insertions / 1350 deletions`
  - `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`：仍有未提交改动

### 2. 当前真正可选的 UI 基线只剩两份

在这次同步之后，仍然独立存在、可以作为“正式 UI 基线候选”的只剩：

1. **`main` 分支的 `HEAD` 版本**
   - 含义：原始主分支 UI
   - 位置：git 对象里的 `HEAD:src/games/fantasyrealms/Board.tsx`
2. **`.worktrees/fantasyrealms` 当前工作区版本**
   - 含义：Fantasy Realms 专项线当前 UI
   - 位置：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\src\games\fantasyrealms\Board.tsx`

### 3. 当前不能再沿用“worktree 实现一定为真相”的旧裁决

用户已经明确指出：

- 主分支 UI 可能反而更好；
- worktree 当前 UI 可能还带着过重边框；
- 在**没有确认到底用哪边**之前，任何继续把某一边当真相推进合并的做法都不成立。

所以从这一刻起：

- **不得再默认采用 worktree UI**
- **也不得把根目录当前脏改版误当成 main UI**
- 唯一允许的下一步，是让用户在 `main HEAD` 与 `fantasyrealms worktree 当前版` 之间拍板

### 4. 当前已经被同步进根目录、因此需要纳入后续收口范围的 Fantasy Realms 文件

至少包括：

- `src/games/fantasyrealms/**`
- `src/games/__tests__/fantasyrealmsManifestIntegration.test.ts`
- `e2e/fantasyrealms/**`
- `docs/games/fantasyrealms/design/README.md`
- `design-system/games/fantasyrealms.md`
- `public/locales/en/game-fantasyrealms.json`
- `public/locales/zh-CN/game-fantasyrealms.json`
- `scripts/infra/run-e2e-command.mjs`
- `src/engine/transport/server.ts`
- `src/engine/transport/__tests__/server.test.ts`
- `src/pages/TestMatchRoom.tsx`
- `src/pages/TestMatchRoomWithAudio.tsx`
- `src/pages/__tests__/MatchRoom.onlineIdentity.test.tsx`
- `src/pages/__tests__/MatchRoom.routeIdentity.test.ts`
- `src/pages/__tests__/MatchRoom.routeIdentity.test.tsx`

以及一批 `evidence/fantasyrealms/*.md` 结果性证据文件与旧参考稿删除项。

### 5. 当前允许动作

在用户明确指定 UI 基线前，只允许：

1. 记录当前污染范围与候选基线；
2. 停止继续合并判断；
3. 等用户明确选择：
   - `main HEAD`
   - 或 `.worktrees/fantasyrealms` 当前工作区

在用户明确选择前，**不得**：

- 继续把 worktree 版 UI 往根目录推进；
- 继续把根目录当前脏改版当作 main UI 做对比；
- 执行任何以“哪边才是真相”为前提的撤回、吸收或回主线动作。

## 目标

本文件只回答一件事：

- 当 `main / 根目录工作树` 与 `.worktrees/fantasyrealms / feat/game-fantasyrealms` 同时存在 Fantasy Realms 相关修改时，
- 哪些文件会冲突，
- 两边各代表什么，
- 应该采用哪边，
- 为什么。

## 前提锁定

- 根目录工作树：`D:\gongzuo\webgame\BoardGame`
- 根目录分支：`main`
- Fantasy Realms 专项工作树：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 专项分支：`feat/game-fantasyrealms`

## 关键事实

### 1. 当前根目录本地脏改会先拦住 merge

当前根目录未提交修改与 Fantasy Realms 工作树线直接重叠的文件：

- `AGENTS.md`
- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`

这意味着：即使还没进入真正的分支三方合并，当前根目录本地脏改也会先阻止“直接 merge worktree 分支”。

### 2. 真正的 changed-in-both 冲突面

`main` 与 `feat/game-fantasyrealms` 自 merge-base 以来，当前确认的高风险双边修改文件：

- `AGENTS.md`
- `design-system/games/fantasyrealms.md`
- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
- `task_plan.md`
- `progress.md`

## 冲突裁决表

### 1. `AGENTS.md`

- 根目录这边代表什么：
  - 当前项目主线正在使用的全局/项目级执行规则
  - 本轮新增的“多 worktree 时不能把 `cwd/main` 当默认实施落点，无法确认就立刻停下询问”
- Fantasy Realms 工作树那边代表什么：
  - 该专项线当时演进出来的一批旧规则与文档路由口径
  - 其中有一部分已经被主线后续规则收口、替代或重新组织
- 采用哪边：
  - **采用根目录 / main 这边为主**
  - **保留本轮新增的 worktree 实施落点硬规则**
- 为什么：
  - `AGENTS.md` 是项目级规则，不是 Fantasy Realms 私有实现文件
  - 主线的项目规则应由根目录当前版本继续做权威入口
  - Fantasy Realms 工作树中的这部分更像阶段性专项规则，不该反向覆盖主线项目规范
- 是否两边都应用：
  - **不是整份两边都抄**
  - 只吸收其中仍成立、且没有被主线规则替代的通用门禁

### 2. `design-system/games/fantasyrealms.md`

- 根目录这边代表什么：
  - 当前主线新增的几条正式门禁：
    - `compact-landscape` 只能表示紧凑横屏
    - 不得再用 `stacked / 堆叠态`
    - 当前截图/证据必须来自当前工作区真实页面
- Fantasy Realms 工作树那边代表什么：
  - 当前 Fantasy Realms 专项线最新的视觉/交互边界
  - 尤其是：
    - 正式视觉稿不等于正式交互稿
    - 交互来源待裁定
    - 中央公共河、顶部 HUD、牌库比例、边距等更细的专项约束
- 采用哪边：
  - **两边都要**
  - **以 Fantasy Realms 工作树版本为主体**
  - **补回根目录这边新增的横屏命名与“当前工作区真实页”门禁**
- 为什么：
  - 这是 Fantasy Realms 专项设计规范，专项线的最新上下文更完整
  - 但根目录这边新增的“横屏命名”和“证据不得串工作树”也是当前必须保留的强规则

### 3. `src/games/fantasyrealms/Board.tsx`

- 根目录这边代表什么：
  - 我误落在错误工作树上的 Fantasy Realms UI 修改
  - 包含：
    - 右侧焦点摘要去重
    - 横屏牌桌一些样式收口
    - 但这些改动发生在错误实施位置
- Fantasy Realms 工作树那边代表什么：
  - 当前正确专项工作树里的 Fantasy Realms 真实实现主线
  - 这边不仅改动量更大，而且承载了该游戏完整专项链路
- 采用哪边：
  - **采用 Fantasy Realms 工作树这边**
- 为什么：
  - 这是本次事故的核心：实现本来就应该落在 `feat/game-fantasyrealms` 工作树，而不是根目录 `main`
  - 根目录这边的 `Board.tsx` 改动本质上是“改错地方的副本”
  - 即使局部思路有可取之处，也应该回到正确工作树重新吸收，而不是让错误落点反向成为主线真相
- 是否两边都应用：
  - **不直接两边都并**
  - 正确做法是：以 Fantasy Realms 工作树版本为准，再人工挑选根目录这边确有价值、且不违背专项线当前方向的局部思路，回到正确工作树重新判断

### 4. `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`

- 根目录这边代表什么：
  - 为错误落点上的 `Board.tsx` 做的配套测试调整
  - 例如焦点摘要态下不再强制查找 `focus-preview`
- Fantasy Realms 工作树那边代表什么：
  - 当前正确专项工作树里的 Foundation 合同测试
  - 与该专项线自己的 `Board.tsx` 配套演进
- 采用哪边：
  - **采用 Fantasy Realms 工作树这边**
- 为什么：
  - 测试必须跟着正确实现线走
  - 根目录测试改动没有独立意义，它只是错误实施落点的伴生修改
- 是否两边都应用：
  - **不直接两边都并**
  - 若根目录里某条断言思想成立，应在正确工作树版本上重新吸收，而不是把错误落点测试整段搬回去

### 5. `task_plan.md`

- 根目录这边代表什么：
  - 当前根目录主线保留的历史长期任务入口，顶部明确写了“默认不代表当前 active goal”
  - 当前内容主体仍是 DiceThrone 历史计划
- Fantasy Realms 工作树那边代表什么：
  - 当前 Fantasy Realms 专项任务的正式计划入口
  - 内容已经切到 Fantasy Realms live UI / full-flow / 交互来源 / 视觉稿约束
- 采用哪边：
  - **采用 Fantasy Realms 工作树这边**
- 为什么：
  - 当前专项任务真实 active goal 在 Fantasy Realms 工作树，不在根目录历史 DiceThrone 计划
  - 如果目标是把 Fantasy Realms 当前线收进主线，计划文件也应跟着当前真实专项任务走
- 是否两边都应用：
  - **不并排保留两份正式计划**
  - 根目录旧内容只能降为历史记录，不能继续与 Fantasy Realms 当前计划并列争夺入口

### 6. `progress.md`

- 根目录这边代表什么：
  - 多条历史任务进度，当前顶部也明确了“默认不代表当前对话任务”
  - 主体是 DiceThrone 与其它历史线
- Fantasy Realms 工作树那边代表什么：
  - Fantasy Realms 当前专项进度流水
  - 记录了 live 交互、UI 规范、来源表、full-flow、自解释性等最新推进
- 采用哪边：
  - **采用 Fantasy Realms 工作树这边**
- 为什么：
  - 当前要收进来的是真实 Fantasy Realms 专项进度，不是根目录旧历史流水
- 是否两边都应用：
  - **不直接混写**
  - 根目录历史流水保留历史属性；Fantasy Realms 当前流水进入主线后，才应该成为新的当前进度

## 当前建议的最小风险收口顺序

1. **先停止在根目录继续改 Fantasy Realms 实现文件**
   - 尤其是 `Board.tsx` / `Board.foundation.test.tsx`

2. **保留根目录项目级规范修复**
   - `AGENTS.md`
   - `.codex/skill/git-operations/SKILL.md`

3. **Fantasy Realms 专项文件以工作树为主**
   - `src/games/fantasyrealms/Board.tsx`
   - `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
   - `design-system/games/fantasyrealms.md`
   - `task_plan.md`
   - `progress.md`

4. **对 `design-system/games/fantasyrealms.md` 做人工双边吸收**
   - 以 worktree 版为主体
   - 补回根目录新增的横屏命名与“证据不得串工作树”门禁

## 本轮结论

本轮最关键的裁决只有两条：

1. **Fantasy Realms 实现与测试冲突，采用 worktree 边。**
2. **项目级规范冲突，采用根目录主线边；但要保留这次新增的“先判断正确工作树，否则立刻停下询问”硬规则。**
