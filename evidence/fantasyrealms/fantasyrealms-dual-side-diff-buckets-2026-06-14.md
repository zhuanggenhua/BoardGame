# Fantasy Realms 双边差异分桶（2026-06-14）

## 目标

这份文档只回答一件事：`根目录 main` 与 `fantasyrealms worktree` 现在的差异，哪些属于**正式 UI 冲突**，哪些只是**过程材料**，哪些应当进入**后续单独吸收审查**。  
本文**不是 merge 执行单**，也不授权直接并回任何一边。

## 当前结论

### A. 正式 UI 冲突桶：现在只能先认 worktree

这些内容一旦混并，就会直接改变玩家看到的正式桌面：

- `src/games/fantasyrealms/Board.tsx`
  - 双边 `no-index diff --stat`：`2420` 行级别大差异
  - 现实含义：正式牌桌壳层、对象摆放、中央承接、底部提示体系、紧凑横屏承载方式都在这里
- `src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
  - 双边 `no-index diff --stat`：`188` 行差异
  - 现实含义：它跟着牌桌基础结构走，不能脱离 `Board.tsx` 单独吸
- `e2e/fantasyrealms/*`
  - 双边 `no-index diff --stat`：`7` 个文件、`799` 行新增 / `231` 行删除
  - 现实含义：当前 worktree 已经把“不要底部 cue / 不要旧提示体系”写进在线验收合同

**处理口径：**

- 这桶现在只能继续认 `fantasyrealms worktree`
- 不允许把根目录 `main` 当前这批 UI 相关内容直接并回正式 FantasyRealms 入口

## B. 过程材料双保留桶：现在都可以留

这桶差异非常大，但它们不是正式运行入口：

- `evidence/fantasyrealms/*`
  - 双边 `no-index diff --stat`：`135` 个文件、`1918` 行新增 / `1290` 行删除，外加大量截图和裁图
  - 现实含义：历史候选、过程审计、旧截图、比较记录、回主线说明、决策包、历史命名降级
- `docs/games/fantasyrealms/design/*`
  - 双边 `no-index diff --stat`：`4` 个文件、`46` 行新增 / `2` 行删除，附带当前设计图和分数参考图
  - 现实含义：这是当前设计真相源与历史候选索引，不是运行时代码

**处理口径：**

- 这桶可以双保留，不需要现在删边
- 但正式方向说明、当前批准口径，应继续认 worktree 里的当前版本

## C. 后续单独吸收桶：不能借这次 UI 收口一起吞

双边 `src/games/fantasyrealms/` 的文件清单本身是一致的，但除 `Board.tsx` 和基础 UI 测试外，仍有不少内容存在双边差异：

- `ai.ts`
- `data/cards.ts`
- `domain/commands.ts`
- `domain/index.ts`
- `domain/scoring.ts`
- `domain/types.ts`
- `domain/view.ts`
- `foundation.ts`
- `game.ts`
- `index.ts`
- `manifest.ts`
- `rule/*.md`
- `thumbnail.tsx`
- `ui/cardAtlas.ts`
- `__tests__/ai.test.ts`
- `__tests__/officialCardData.test.ts`
- `__tests__/runtimeSkeleton.test.ts`
- `__tests__/scoring.test.ts`

**现实含义：**

- 这批内容里混着领域逻辑、数据录入、AI、规则说明、资源接入、测试合同
- 它们不等于“正式 UI 应该认哪边”
- 如果现在借着 UI 收口一起吞，等于把“正式桌面选择”偷换成“大包并吞”

**处理口径：**

- 这桶必须后续单独开吸收审查
- 每个小项都要重新回答：它是不是直接影响正式 UI，还是独立旁支

## 当前最低风险路径

1. 继续冻结 `fantasyrealms worktree` 为唯一正式 UI 真相源
2. 过程材料先双保留，不删边
3. 后续若要真正吸收根目录 `main` 里的 FantasyRealms 有价值内容，按 `独立小项` 一项项审，而不是一次性并进来

## 不应再做的事

- 不要把 `Board.tsx + E2E` 的正式 UI 冲突，混同为“只是文档不同”
- 不要把大量 evidence / 截图差异，误解成“只能删一边”
- 不要把领域逻辑、AI、规则、数据文件，借这次 UI 收口一起吞并
