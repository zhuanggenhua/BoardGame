# PR #139 合并冲突证据（2026-09-20）

## 背景

- base：远端 `main`，当前提交 `0e4401d07c5fedf22c1938e1cc4ccbaf8371fafa`
- head：PR #139 源分支 `deathcats4/BoardGame:codex/refactor-smashup-variant-binding-metadata`
- 合并工作树：`D:\gongzuo\webgame\BoardGame-merge-pr139-20260920`
- 共同祖先：`caef41b1e76093e20e01b033ea5e8f105d4cc984`
- 触发命令：`git merge origin/main --no-commit --no-ff`

## 冲突文件

- `src/games/smashup/domain/reactionResources.ts`

## 逐块裁决

- `main` 新增了 `commutativeOperation` 元数据，只对“独立持续行动被拆下并分别进入同一弃牌区”的场景放宽排序。
- PR 分支把所有共享 `playerDiscard` 写入都视为无需排序，范围过宽，可能错误放行其他会改变弃牌区语义的操作。
- 保留 `main` 的窄规则：双方必须都是同类持续行动拆除、都不打开交互、共享写入只能是弃牌区、卡实例必须不同，且不存在交叉读写；否则仍按普通资源冲突排序。

## 风险与验证

- 主要风险是为了解决一个并发弃牌场景而放宽全部弃牌操作的顺序约束，导致真实存在依赖关系的触发器并发执行。
- 已清除 `reactionResources.ts` 的 Git 冲突标记，并确认当前合并状态没有未解决冲突。
- Smash Up 相关验证通过：4 个测试文件共 119 个测试全部通过。
- `npx tsc --noEmit` 通过。
- `npx eslint src/ --ext .ts,.tsx` 通过，0 个错误；现有 warning 共 1461 条，未新增为阻塞错误。
- `npm run spec:lint` 在主工作树通过；合并工作树缺少宿主依赖的本地入口链接，临时补齐后通过，随后已恢复原工作树结构。
- 普通/严格合并审计待创建双亲合并提交后运行。

## 第二次主线同步

- base：远端 `main`，当前提交 `bae9b809d083ee4eee37fc7743982c76de48fe63`
- head：当前合并工作树提交 `af88ffc6ec341ea2b503191cb9564cd3e802825e`
- 共同祖先：`0e4401d07c5fedf22c1938e1cc4ccbaf8371fafa`
- 触发命令：`git merge origin/main --no-commit --no-ff`
- 冲突文件：`src/games/mage-wars/__tests__/standard-starting-gap-batch.test.ts`
- 裁决：保留主线新增的测试 facade 读取方式，同时保留 PR 对 3413 Banish 与 3416 Battle Fury 的覆盖；没有整份接受任一侧。
- 合并后修补：为 Battle Fury 补齐 ChoiceRequest adapter 和中英文交互文案；修正同场地对象移动只移除不回插的问题，使 Banish 到期后目标及附着结界恢复到原区域。
- 验证：`npx vitest run src/games/mage-wars/__tests__/standard-starting-gap-batch.test.ts` 通过 21/21；`npx tsc --noEmit` 通过；`npx eslint src/ --ext .ts,.tsx` 通过，0 个错误、1461 个既有 warning；`npm run i18n:check` 通过。
- 首次 GitHub quality-gate 发现 `src/games/mage-wars/__tests__/ability-catalog.test.ts` 仍断言旧快照：已实现数量从 127 增至 129，待补代码从 26 降至 24；更新为当前目录事实，并补充 3413/3416 不再属于待补代码的断言。
- 修补后复测：`npx vitest run src/games/mage-wars/__tests__/ability-catalog.test.ts` 通过 41/41；标准起始法术测试仍为 21/21。

## 最终结果

- 解决提交：`d7f6105982816611d7ef6ce78c2d96b4d05151bb`，双亲为 `af88ffc6ec341ea2b503191cb9564cd3e802825e` 与 `bae9b809d083ee4eee37fc7743982c76de48fe63`。
- 普通合并审计：通过；冲突文件为混合结果，0 个单边覆盖。
- 严格合并审计：通过；未发现完全等于任一父提交的冲突文件。
- 推送目标：PR #139 原 head 分支 `deathcats4/BoardGame:codex/refactor-smashup-variant-binding-metadata`
- 历史记录：上述源分支推送与 PR 合并已完成；本次主工作树同步见下节。

## 本次主工作树同步（2026-09-22）

- 触发命令：`git pull --no-rebase --no-edit origin main`。
- 本地父提交：`833d79ba83dfb3ce6c0d1a261d45cff4675ad352`；远端父提交：`64f03d3cfcd76f559b14e0917791019ca6a9cdbc`；共同祖先：`3cb93e833d79c385839c81c5402e02d976e2bf3b`。
- 冲突文件：`src/games/mage-wars/__tests__/ability-catalog.test.ts`、`src/games/smashup/__tests__/variantBindingRuntime.test.ts`、`src/games/smashup/abilities/disney_four_factions.ts`、`src/games/smashup/domain/index.ts`。
- 裁决：Mage Wars 保留本地主线统计（待补 3、已实现 150）；Smash Up 变体测试吸收远端 metadata 断言和 imports，并保留本地运行时注册测试；Disney 四派系保留实时弃牌堆、随从类型和排除卡校验；响应窗口保留本地交互帧与 action-played trigger 保护。
- 静态检查：`git diff --cached --check` 通过；四个冲突文件已全部加入暂存区，未跟踪 evidence、artifact、output 和临时 E2E 仍留在工作区。
- 合并提交：已生成，当前主分支 HEAD 即本次合并提交。
