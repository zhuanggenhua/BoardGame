# Fantasy Realms 回主线执行状态（2026-06-13）

> 历史过程说明：
> 本文记录的是当时“如果未来要回主线，已经准备到了哪一步”的过程状态。
> 它不是当前实施指令，也不等于今天应继续执行回主线、执行 merge，或按文中 staging 边界直接操作文件。
> 今天若要判断当前正式方向，仍应回到 `fr-merge-pass2-*` 真相图、活实现与活测试合同。

## 目标

在不直接 merge 的前提下，记录当时已经完成到哪一步，以及如果当时继续把 `feat/game-fantasyrealms` 回 `main`，真正还会撞到哪些根目录脏改。

## 当前已完成

### 1. 正确实施落点已锁定

- 正确 worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 正确分支：`feat/game-fantasyrealms`

### 2. 回主线最终文件清单已完成

见：

- `fantasyrealms-main-return-final-manifest-2026-06-13.md`

当前已经把内容分成：

1. 直接应回主线
2. 不应回主线
3. 不能直接从 worktree 覆盖主线的项目级规则

### 3. 项目级规则吸收策略已完成

见：

- `fantasyrealms-rule-conflict-absorption-strategy-2026-06-13.md`

当前裁决已经锁定：

- `AGENTS.md`、`doc-index`、`document-consolidation`、`e2e-testing-guide`、`MASTER` 不由 worktree 反向覆盖 `main`
- `e2e-verification`、`testing-best-practices`、`ui-ux`、`generated-design-implementation`、`animation-effects` 只人工吸收 worktree 独有有效条目

### 4. 根目录规则吸收已经执行一部分

当前已实际补入根目录主线规则文档的条目包括：

- `docs/testing-best-practices.md`
  - 完整流程默认拆成组合矩阵
  - 旧 UI 文案退场后，不得靠反向断言制造遗留
- `.spec/knowledge/standards/ui-ux.md`
  - 同一游戏跨断点不得分裂成两套独立 UI 家族
  - 正式视觉稿不自动包含交互合同
  - 交互模式必须有来源表
  - 主推进交互不得隐式到不可见
  - 正规流程优先于临时收口
  - 固定牌桌类游戏的 PC live 默认禁止页面级滚动
  - 固定牌桌类游戏不得用禁用主按钮充当步骤提示
- `.spec/knowledge/standards/generated-design-implementation.md`
  - 正式视觉稿不自动包含交互合同
  - 交互模式必须先锁来源
  - 规则语义优先于美术发挥
  - 复刻失败必须降级，不得堆装饰硬凑
- `.spec/knowledge/standards/animation-effects.md`
  - 对象转移动效只绑定变化对象
- `.spec/knowledge/standards/e2e-verification.md`
  - 桥接式组合验证

### 5. 根目录误落 `Board` 价值审计已完成

见：

- `fantasyrealms-root-board-value-audit-2026-06-13.md`

当前裁决已经进一步锁定：

- 根目录误落的 `Board.tsx / Board.foundation.test.tsx` 不再吸回 worktree
- 原因不是“完全没改东西”，而是：
  - 真正有价值的 live UI 收口，正确 worktree 已经具备
- 根目录剩余独有差异只剩尺寸微调与焦点预览删减试探
- 这些差异没有当前产品证据，且与 worktree 当前正式合同方向不一致

### 6. Fantasy Realms 专项设计系统已补回主线新增硬规则

当前已把主线新增、且对本专项仍然成立的硬规则，补回正确 worktree 的：

- `design-system/games/fantasyrealms.md`

已补内容包括：

- `compact-landscape` 只表示紧凑横屏，不得再用 `stacked / 堆叠态`
- `compact-landscape` 只能命中 `width > height`
- 响应式变体必须仍然一眼看出是同一个游戏
- 当前验收截图 / evidence / 运行路由必须来自当前工作区真实页面

### 7. 当前未提交集合的 staging 边界已完成

见：

- `fantasyrealms-staging-boundary-2026-06-13.md`

当前已经明确：

- 哪些未提交文件可以直接进入“未来回主线代码包”
- 哪些未提交文件只属于过程记录，不应进入回主线代码包
- 哪些项目级规则文件当前不应再继续作为专项正文携带

### 8. 正式提交边界已完成

见：

- `fantasyrealms-formal-commit-boundary-2026-06-13.md`
- `fantasyrealms-formal-commit-paths-2026-06-13.txt`
- `fantasyrealms-local-only-paths-2026-06-13.txt`

当前已经明确：

- 如果要把当前专项成果收成正式提交，哪些文件应进入提交
- 哪些文件继续只留本地
- 项目级规则冲突已从专项正式提交边界中隔离出去

### 9. worktree 侧项目级规则已对齐根目录当前版本

当前已经把 worktree 里的以下项目级规则文件，对齐到根目录 `main` 当前版本：

- `design-system/game-ui/MASTER.md`
- `.spec/knowledge/standards/animation-effects.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `docs/testing-best-practices.md`

含义不是“这些文件要跟专项一起提交”，而是：

- worktree 本地现场不再保留另一套旧裁决文本；
- 真正要继续作为专项正文提交的，仍只有 Fantasy Realms 本体、专项设计真相、E2E 与产品证据；
- 这 6 个文件继续只作为本地过程侧对齐结果，不进入当前专项正式提交边界。

### 10. 正式提交边界 dry-run 已通过

已按以下真相源对当前 worktree 做机器核对：

- 跟踪文件：`git -c core.quotePath=false diff --name-only`
- 未跟踪文件：`git ls-files --others --exclude-standard`

结论是：

- 正式提交清单里的路径都命中当前真实脏改或新增；
- 本地保留清单已补齐 `formal-commit-boundary / formal-commit-paths / local-only-paths` 3 个过程产物；
- 除 7 个既有换行噪音文件外，没有新的边界外脏改。

## 当前真正仍会撞到的根目录重叠面

### A. 根目录当前脏改与 worktree 当前脏改的直接重叠

当前两边都在 `git diff --name-only` 里出现的路径是：

- `.spec/knowledge/standards/animation-effects.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `docs/testing-best-practices.md`
- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`

### B. 这 7 个重叠路径的裁决

#### 1. 项目级规则文档 5 个

- `.spec/knowledge/standards/animation-effects.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `docs/testing-best-practices.md`

裁决：

- **以根目录当前版本为基底**
- **保留本轮已经吸收进去的新增条目**
- **不再让 worktree 版本整份覆盖回来**

#### 2. Fantasy Realms 实现文件 2 个

- `src/games/fantasyrealms/Board.tsx`
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`

裁决：

- **以 fantasyrealms worktree 版本为准**
- 根目录这两处继续视为错误实施落点残留，不反向迁入

## 当前剩余工作

如果继续朝最终回主线推进，剩余动作应是：

1. 在规则层保持“根目录为基底 + 已吸收条目”的状态，不再让 worktree 规则整份反覆盖。
2. 在实现层继续只认 `fantasyrealms` worktree 为唯一真相源。
3. 真正执行回主线前，按最终文件清单做 staging / 人工挑选，而不是直接整树 merge。

## 当前结论

到这一步为止：

1. “哪些文件该回主线、哪些不该回”已经锁定。
2. “项目级规则怎么吸收”已经不是口头判断，而是已开始实际落到根目录文档。
3. 当前剩下最核心的双边冲突，只剩：
   - 主线规则文档的最终保留版本
   - 根目录错误落点上的 `Board.tsx / Board.foundation.test.tsx`
