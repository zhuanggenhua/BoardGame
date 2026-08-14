# 山屋惊魂回主分支合并口径

> 目的：当 `feat/game-betrayal` 准备回 `main` 时，先锁定“哪些内容以当前专项 worktree 为真相源，哪些内容必须做双边内容归并”，避免把冲突处理退化成纯文本选边。
> 当前实施现场：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal`
> 当前分支：`feat/game-betrayal`

## 当前结论

- 当前 `feat/game-betrayal` worktree 已干净，且 `main` 已经被吸收到这棵专项树；`git merge-base --is-ancestor main HEAD` 当前为真。
- `betrayal` 相关实现、证据、规则、资源合同、E2E 和 OpenSpec 变更，默认以这棵专项 worktree 为真相源。
- 共享框架、共享文档、共享脚本、共享语言包和生成产物，不允许直接“选 ours/theirs”；必须逐项看现实语义后再归并。
- 当前从分支历史看，`feat/game-betrayal -> main` 已不再需要再做一轮内容级冲突归并；若 `main` 在此之后没有新增提交，回主线将是快进合并。
- 之前阻塞回主线的那组 `qidahen` 教程脏改，已在根目录 `main` 收口为提交 `8a2e972a 收口七大恨教程扩章与 closeout 验证`，并已实际 merge 进当前专项树。
- 因此当前 blocker 已不再是“根目录 `main` 现场不干净”，而是只剩最后一个动作判断：是否现在就执行 `feat/game-betrayal -> main` 的正式回主线。

## 当前专项收口就绪度

> 结论时间：`2026-06-29`
> 结论范围：只针对当前 `betrayal` 专项 worktree 是否已经具备回主线前提，以及当前还剩哪一步未执行。

### 已通过的门禁

- 真实 E2E 最小矩阵已通过：
  - `basic-flow`
  - `first-scenario`
  - `first-scenario-traitor-victory`
  - `betrayal-tutorial`
  - `first-scenario-corpse-loot`
  - `first-scenario-jack-spirit-revive`
  - `first-scenario-jack-spirit-post-revive-attack`
- 专项规则 / 板级单测已通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts src/games/betrayal/__tests__/Board.foundation.test.tsx --configLoader native`
- 教程 / 共享接线相关单测已通过：
  - `ActionBarSkeleton`
  - `CheatSystem`
  - `betrayalManifestIntegration`
  - `betrayal tutorial`
  - `tutorial ids`
  - `matchRoom tutorial lifecycle`
  - `matchRoomStageRuntimeModelBuilders`
  - 对应命令：
    - `node scripts/infra/vitest-cli-safe.mjs run src/components/game/framework/__tests__/ActionBarSkeleton.test.tsx src/engine/systems/__tests__/CheatSystem.test.ts src/games/__tests__/betrayalManifestIntegration.test.ts src/games/betrayal/__tests__/tutorial.test.ts src/games/betrayal/__tests__/tutorialIds.test.ts src/pages/__tests__/matchRoomStageRuntimeModelBuilders.test.ts src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx --configLoader native`
    - 结果：`7 passed / 31 passed`
- `OpenSpec` 已通过：
  - `npx openspec validate add-betrayal-basic-tutorial --strict --no-interactive`
- 这轮补跑确认过的关键链路：
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/basic-flow.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-traitor-victory.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-corpse-loot.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-jack-spirit-revive.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-jack-spirit-post-revive-attack.e2e.ts`
- `eslint` 已通过最低门槛：
  - 本轮涉及的 `ts/tsx` 文件已跑过 `npx eslint ...`
  - 当前结果是 `0 errors`

### 当前剩余的非 blocker 噪音

- `eslint` 还有 warning，但当前没有 error：
  - `TutorialContext.tsx` 还剩 `react-refresh/only-export-components` 提示；这是文件导出形态提示，不影响当前教程链路。
  - `Board.tsx` 还剩一组 `react-hooks/preserve-manual-memoization` / React Compiler 提示；当前更像编译器保守降级提示，不是业务错误。
- `run-e2e-command` 这轮出现过两次失败，但都不是业务回归：
  - 一次是我把这条既定 E2E 链路并行启动，撞上 `heavy-task-guard` 的 `e2e-run` 并发门禁；
  - 一次是并发预检写 `.tmp/e2e-preflight-cache.json` 时命中文件锁；
  - 结论是：这条 E2E 入口必须串行跑，不能把这两次失败当成 `betrayal` 功能回归。
- `git diff --check` 当前没有空白错误或冲突错误，只有一批 `LF will be replaced by CRLF` 提示；这属于工作树换行告警，不是本轮业务 blocker。
- 当前没有未解决的 merge 冲突文件；在专项树里看到的还是普通未提交改动，不是冲突态。

### 这轮额外收口结果

- 已清掉的高价值 warning / 残留：
  - `TutorialContext` 不再在 render 阶段直接写 ref；
  - `betrayalTestHelpers.ts` 中未使用的命令/随机/旧 helper 已删掉；
  - `Board.tsx` 中一批明显未使用的预览残留与死代码已删掉；
  - 清理过程中误引入的 `firstScenarioRuntime.test.ts` 常量赋值错误已修回，并重新通过规则单测。
- 这轮回归结果：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx src/engine/systems/__tests__/CheatSystem.test.ts --configLoader native`
  - 结果：`4 passed / 34 passed`

### 之前阻塞回主线的现场问题已被消除

- `feat/game-betrayal` 这棵专项树本身已经完成：
  - 专项收口提交；
  - `main -> feat/game-betrayal` 的内容级归并；
  - 归并后的最小真实回归。
- 已实际发生的新事实有两件：
  - 根目录 `main` 上那组 `qidahen` / 教程 / Sentry 最小修复，已收口为提交 `8a2e972a 收口七大恨教程扩章与 closeout 验证`；
  - 当前专项树已实际执行 `git merge main`，生成提交 `62b0e14e Merge branch 'main' into feat/game-betrayal`，且没有文本冲突。
- 因此当前已不再存在“根目录 `main` 现场不干净导致不能继续”的 blocker。
- 当前剩余工作只剩：在用户仍要继续回主线的前提下，选择何时正式执行 `feat/game-betrayal -> main` 的最终合并动作。

### 当前专项收口提交建议

- 当前未提交集合已经足够支持“一笔专项收口提交”，但提交说明里必须把主要改动面写清，不要再用泛化标题吞掉语义。
- 如果仍想在提交前先做人脑分组，当前最稳的分法是：
  - `A. 第一剧本运行时与规则闭环`
    - `src/games/betrayal/**`
    - `e2e/betrayal/first-scenario*.e2e.ts`
    - `e2e/betrayal/betrayalTestHelpers.ts`
    - `evidence/betrayal-basic-flow/**`
    - `evidence/betrayal-first-scenario*/**`
    - `public/locales/*/game-betrayal.json`
  - `B. 教程与共享接线`
    - `src/games/betrayal/tutorial.ts`
    - `src/games/manifest.client.generated.tsx`
    - `src/components/game/framework/**`
    - `src/contexts/TutorialContext.tsx`
    - `src/engine/types.ts`
    - `src/engine/systems/CheatSystem.ts`
    - `src/pages/useMatchRoomTutorialLifecycle.tsx`
    - `src/pages/useMatchRoomPageRuntimeModel.ts`
    - `src/pages/matchRoomStageRuntimeModelBuilders.ts`
    - `src/games/fantasyrealms/tutorial.ts`
    - 对应单测：`src/components/game/framework/__tests__/ActionBarSkeleton.test.tsx`、`src/engine/systems/__tests__/CheatSystem.test.ts`、`src/pages/__tests__/*tutorial*`、`src/games/__tests__/betrayalManifestIntegration.test.ts`
  - `C. 规格、说明与证据`
    - `docs/games/betrayal/README.md`
    - `docs/games/betrayal/records/**`
    - `openspec/changes/add-betrayal-basic-tutorial/**`
    - `evidence/betrayal-tutorial/**`
    - `e2e/betrayal/betrayal-tutorial.e2e.ts`
- 现实上这三组是互相咬合的：
  - `A` 证明第一剧本运行时与边界链路成立；
  - `B` 证明教程复用真实 runtime，而不是假页面；
  - `C` 负责把这轮承诺、证据和后续 merge 口径固定下来。
- 因此，当前更推荐的做法不是硬拆三笔小提交，而是保留为**一笔高信息密度的专项收口提交**，在提交消息正文里按 `A / B / C` 三块展开说明。

### 建议提交消息骨架

- 标题建议直接点名业务范围，不要再写“收口反馈 / 更新代码 / 修复问题”：
  - `完成山屋惊魂第一剧本运行时与基础教程收口`
- 正文建议至少覆盖 3 块：
  - `第一剧本运行时与边界`
    - 补齐英雄线 / 叛徒线 / 尸体搜刮 / 杰克之灵复活与复活后继续攻击
    - `HAUNT_ATTACK` 改成正式对攻，补 `Stalk the Prey` 限制
    - `Board.tsx` 补正式焦点入口并清理死代码
  - `教程与共享接线`
    - 新增 `betrayal/tutorial.ts` 与 manifest 教程入口
    - 接入 `numPlayers`、教程生命周期稳定化、动作条容器属性
    - 补齐教程 / manifest / 生命周期 / 共享动作条单测
  - `证据与规格`
    - 新增教程、叛徒线、搜尸、复活边界 E2E 与证据
    - 更新 `README`、教程覆盖矩阵、第一剧本完成度审计、merge 口径
    - `OpenSpec add-betrayal-basic-tutorial` 严格校验通过

### 当前收口判定

- 以当前证据看，`feat/game-betrayal` 的专项收口提交已经形成：
  - 提交：`ddfd7e03 完成山屋惊魂第一剧本运行时与基础教程收口`
  - 这笔提交之前已经确认：
    - `OpenSpec` 通过；
    - 第一剧本规则 / 板级单测通过；
    - 教程 / manifest / 生命周期 / 动作条相关单测通过；
    - 7 条真实 E2E 串行通过；
    - 说明文档与证据目录已同步更新。
- 在这之后已经实际发生的事情还有一件：
  - `53d362ab 归并 main 到山屋惊魂专项分支并保留教程生命周期双语义`
- 以及本轮新增的两件事：
  - `8a2e972a 收口七大恨教程扩章与 closeout 验证`
  - `62b0e14e Merge branch 'main' into feat/game-betrayal`
- 因此当前最准确的口径应更新为：
  - **专项收口已提交；**
  - **最新 `main` 已再次吸收到专项树；**
  - **从分支历史看，当前 `feat/game-betrayal` 相对 `main` 为领先 `14`、落后 `0`；**
  - **共享层冲突已经在专项树内实际处理完；**
  - **下一步不再是等待现场清理，而是决定是否立即执行回主线。**

### 当前共享层特别说明

- `src/engine/transport/onlineAiRecovery.ts` 这次 diff 看起来像删了 `buildPendingDamageSemanticSignature` / `buildPendingBonusDiceSettlementSemanticSignature`，但当前文件里这两个函数仍然存在于更前位置，`src/engine/transport/server.ts` 也仍在引用。
- 结论：这里是“删重复定义 / 去重”，不是把在线恢复能力删没了；提交前不应把这类 diff 误判成跑偏改动。

### 当前可以直接下的结论

- 如果只问“这棵专项树现在是不是已经证明了第一剧本 + 首轮教程能跑”，答案是：**是，证据已经足够。**
- 如果只问“现在离提交还差的是不是业务 bug”，答案是：**不是。专项收口提交已经完成。**
- 如果问“现在能不能直接在 `main` 上开始手工消冲突”，答案是：**可以开始做分支级内容归并预备，但仍不应直接在根目录 `main` 脏工作区上动手 merge。**

## 当前这次分支级实际冲突面

> 结论时间：`2026-06-29`
> 比对方式：`merge-base(main, feat/game-betrayal)` 之后分别看两边分支历史，不把当前根目录未提交脏改混进“分支冲突”。

- 这一节记录的是**已经发生并已处理完**的历史冲突面，不再代表当前还存在未解冲突。
- 当前 `main` 相对当时的 merge-base 新增了两笔主线提交：
  - `d95d6066`：以 `qidahen / fantasyrealms / HomeV2 / 移动发布脚本` 为主
  - `a88352c2`：以 `qidahen / fantasyrealms` 的推送门禁修复为主
- 当时需要重点归并的共享主题是：
  - `.spec/knowledge/standards/ui-ux.md`
  - `vite.config.ts`
  - `src/pages/useMatchRoomTutorialLifecycle.tsx`
- 当前这些主题都已经在 `53d362ab` 之前后完成吸收：
  - `src/pages/useMatchRoomTutorialLifecycle.tsx` 与对应测试已在专项树内完成双保留吸收；
  - `.spec/knowledge/standards/ui-ux.md` 已补回通用分层门禁，并把误落到全局层的单游戏专名收回通用表述；
  - `vite.config.ts` 已保住 Android/iOS 裁剪插件与 `three-stdlib` alias。
- 当前分支关系的直接事实是：
  - `main` 已经是 `feat/game-betrayal` 的祖先提交；
  - `feat/game-betrayal` 相对 `main` 领先 `14`、落后 `0`；
  - 因此若 `main` 不再新增提交，后续不会再出现这一轮同级别的内容冲突。
- 当前需要注意的已不是历史冲突或现场脏改，而是：若正式回主线前 `main` 又新增共享提交，就必须重新做一轮内容级比对。

## 当前这次两处共享重叠的现实含义

### 1. `.spec/knowledge/standards/ui-ux.md`

- `main` 这边新增的是：
  - 删除入口后要同步释放布局占位；
  - 七大恨教程/席位截图口径里的具体例子；
  - 一些主页/教程/移动端专项措辞修正。
- `feat/game-betrayal` 这边新增的是：
  - 参考卡/帮助卡的大图查看必须沿用统一放大壳；
  - 运行时持有区不能发明伪焦点卡；
  - 同一持有区卡牌尺寸必须稳定；
  - 分排表达类型后不得再重复写类型说明；
  - “成熟游戏”默认指商业成品；
  - 真实持有物优先吃空间。
- 现实判断：
  - 两边不是同一条规则互相覆盖，而是都在往通用 UI 规范里加不同门禁；
  - 真 merge 时默认动作应是**双保留并重排顺序**，不是选一边覆盖另一边；
  - 这里最需要注意的是：`main` 里带了 `大明 / 蒙古 / 后金` 这类单游戏例子，若要继续维持通用层抽象度，应在归并时再检查一次是否要抽象回通用表述。

### 2. `vite.config.ts`

- `main` 这边新增的是：
  - Android 构建后裁剪部分资源；
  - iOS embedded 构建后裁剪多语言和图片资源；
  - `three-stdlib` 指向 `index.cjs` 的开发时 alias 兜底。
- `feat/game-betrayal` 这边主要是：
  - `betrayal` 接入期间原有的 Vite 配置与 devtools/runtime 适配；
  - 没有对上述 Android/iOS prune 和 `three-stdlib` alias 做反向删除。
- 现实判断：
  - 这里也不是语义互斥，而是 `main` 新增了发布/预构建兜底能力；
  - 本轮正文比对结果显示，当前专项树里的 `vite.config.ts` 已经包含这批能力；
  - 因此它当前不再是“还要手工吸收”的 blocker，真正 merge 时只需要保住现状并做最小回归：
    - `betrayal` 的最小 E2E 还能正常起服务；
    - Android/iOS build 相关路径没有被后续共享改动打掉。

### 3. `src/pages/useMatchRoomTutorialLifecycle.tsx`

- `main` 这边已有的语义是：
  - 用 `lastTutorialProgressRef` 记录 `manifestId + stepId`；
  - 防止子教程切换后错误复用“上一条教程已完成”的状态；
  - 对应测试已经覆盖“子教程切换后应重新启动”“完成后返回上一页”等行为。
- `feat/game-betrayal` 这边新增的语义是：
  - 引入 `latestTutorialLifecycleMountId` 与 `lifecycleMountIdRef`；
  - 防止 StrictMode / 路由切换时，旧实例的延迟清理把新教程误关掉；
  - 对应新增测试覆盖“旧实例延迟清理不能误关新教程”。
- `merge-tree` 已显示这里存在真实文本冲突苗头，而不是单纯的自动无痛归并。
- 现实判断：
  - 两边修的不是同一件小事，而是教程生命周期的两种不同错误面；
  - 本轮已在专项树里完成双保留：既保住 `manifestId + stepId` 的跨教程判断，也保住 `mountId` 的延迟清理隔离；
  - 验收位点必须回到 `useMatchRoomTutorialLifecycle.test.tsx` 与 `betrayal-tutorial.e2e.ts`，不能只看代码编译通过。

## 本轮已完成的共享语义吸收

- 教程生命周期：
  - `src/pages/useMatchRoomTutorialLifecycle.tsx` 已同时保留 `manifestId + stepId` 的完成态判断，以及 `mountId` 的延迟清理隔离。
  - `src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx` 已覆盖：
    - 子教程切换后重新启动；
    - 非 `finish` 命名的最后一步结束后仍返回上一页；
    - 同一教程走到最后一步后不重复自动启动；
    - 旧实例延迟清理不会误关新教程。
- 通用 UI 规范：
  - `.spec/knowledge/standards/ui-ux.md` 已补回 `0.0a 通用规范与单游戏专名分层`；
  - 共享层里的席位截图规则已从单游戏专名恢复成 `玩家 A/B/C` 这类跨游戏表述；
  - `betrayal` 这轮沉淀出的持有区 / 放大查看 / 商业成品参考等门禁仍保留在通用层。
- `vite.config.ts`：
  - 已确认当前专项树正文中存在 Android/iOS prune plugin 与 `three-stdlib` alias；
  - 因此本轮不再对该文件做重复编辑。
- 本轮真实回归补充：
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/basic-flow.e2e.ts`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario.e2e.ts`
  - 结论：教程链路、恶兆前基础运行时、第一剧本英雄线终局在当前专项树里都仍然通过。

## 当前剩余风险分级

- **高优先级时效风险**：
  - 当前结论建立在 `62b0e14e` 之后、且 `main` 尚未继续前进的前提上。
- 结论依据：
  - 现在根目录 `main` 已干净，旧的现场 blocker 已消失；
  - 但只要 `main` 在正式回主线前再次新增共享提交，就要重新核对共享层差异。
- **中优先级未来漂移风险**：
  - `main` 若在回主线前又新增共享提交，可能重新打开 `.spec/knowledge/`、`src/pages/`、`src/engine/`、`scripts/infra/` 一带的内容级归并。
- 结论依据：
  - 当前 `main` 只是祖先提交；这个结论对“此刻的主线历史”成立，不自动担保未来不再变化。
- **低优先级回归风险**：
  - 即使未来只是快进回主线，仍要保留最小真实回归，避免共享层后续变化让 `betrayal` 退化。
- 当前建议保留的最小真实回归顺序：
  - `betrayal-tutorial`
  - `basic-flow`
  - `first-scenario`
  - 若这 3 条都通过，再决定是否补跑其余 4 条边界 E2E。

## 两处真冲突的手工解法

### 1. `src/pages/useMatchRoomTutorialLifecycle.tsx`

- 不要选 `main` 单边，也不要回退成当前专项树早期版本。
- 目标落点就是当前 `feat/game-betrayal` 里的现状：
  - 保留 `TutorialProgressSnapshot` 与 `lastTutorialProgressRef`；
  - 保留 `currentManifestId + currentManifestLastStepId` 的完成态判断；
  - 同时保留 `latestTutorialLifecycleMountId` 与 `lifecycleMountIdRef`；
  - 在卸载延迟清理里继续用 `capturedMountId !== latestTutorialLifecycleMountId` 隔离旧实例误清理。
- 手工解完后，这个文件至少要满足 4 个现实语义：
  - 子教程切换后不会误复用“上一条教程已完成”；
  - 旧实例的延迟清理不会误关新教程；
  - 当前教程最后一步即使不叫 `finish`，结束后仍能返回上一页；
  - 同一教程已经走到最后一步时，不会重复自动启动。

### 2. `src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx`

- 这里不能只留 `main` 的 3 条测试，也不能只留专项树后补的第 4 条测试。
- 目标落点是当前 `feat/game-betrayal` 的 4 条测试全集：
  - `子教程切换后...重新启动`
  - `当前教程最后一步不是 finish 时...返回上一页`
  - `同一条教程已经走到最后一步...不会重复自动启动`
  - `旧实例的延迟清理不能把新教程误关掉`
- 其中前三条里使用的 manifest id 当前已经故意改成 `field-battle / season-flow` 这类彼此不同、但 step id 仍相同的组合；不要再回退成会弱化断言强度的写法。

### 3. 手工解完后的最低验证

- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx src/pages/__tests__/matchRoomStageRuntimeModelBuilders.test.ts src/games/__tests__/betrayalManifestIntegration.test.ts src/games/betrayal/__tests__/tutorial.test.ts src/games/betrayal/__tests__/tutorialIds.test.ts src/components/game/framework/__tests__/ActionBarSkeleton.test.tsx src/engine/systems/__tests__/CheatSystem.test.ts --configLoader native`
- `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts`
- `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/basic-flow.e2e.ts`
- `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario.e2e.ts`

## 当前这次最小风险 merge 顺序

1. 先在 `feat/game-betrayal` 里把专项未提交改动收口并提交。
2. 现在根目录 `main` 与当前专项树都已干净；若要执行正式回主线，仍应先确认执行 merge 的那棵树在动作发生当下没有新增无关未提交改动。
3. 合并时把注意力至少放在三类对象：
   - `betrayal` 专项正文：默认以 `feat/game-betrayal` 为真相源；
   - `ui-ux.md` 与 `vite.config.ts`：按上面的现实语义做双保留归并；
   - `useMatchRoomTutorialLifecycle.tsx`：双保留“教程切换判定”与“旧实例延迟清理隔离”。
4. 归并后先跑 `betrayal` 最小真实回归，不要上来就全仓大回归：
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/basic-flow.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-traitor-victory.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-corpse-loot.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-jack-spirit-revive.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-jack-spirit-post-revive-attack.e2e.ts`

## 当前对“合并冲突怎么处理”的直接结论

- `docs/games/betrayal/**`、`src/games/betrayal/**`、`e2e/betrayal/**`、`evidence/betrayal**/**` 这类 `betrayal` 专项正文，如果和 `main` 冲突，默认先保专项 worktree 的业务真相，再看 `main` 是否有额外独有信息要补带。
- `.spec/knowledge/standards/ui-ux.md`、`vite.config.ts`、`src/pages/useMatchRoomTutorialLifecycle.tsx` 都不能二选一，默认动作都是双边内容归并：
  - `ui-ux.md`：两边新增的是不同门禁，默认双保留并重排，不选单边覆盖；
  - `vite.config.ts`：保留 `main` 的 Android/iOS 裁剪与 `three-stdlib` alias，同时保留 `betrayal` 所需接线，不回退任何一边的现实能力。
  - `useMatchRoomTutorialLifecycle.tsx`：保留 `main` 的教程切换完成态判断，同时保留 `betrayal` 这边的旧实例延迟清理隔离。
- 共享层一旦出现同文件冲突，不能只看冲突标记选 `ours/theirs`；必须先回答“这边修的是哪个现实语义、另一边修的是哪个现实语义、最终保留后回哪个真实入口验证”。
- 当前不再需要为这轮已知共享主题做手工消冲突；它们已经在 `62b0e14e` 之前后完成吸收。后续若再有冲突，只可能来自 `main` 的新增提交。

## 回主分支前的最小检查

1. 先在 `feat/game-betrayal` 内确认：
   - `basic-flow`、`first-scenario`、`betrayal-tutorial` 三条真实 E2E 都还是通过态；
   - `docs/games/betrayal/README.md`、教程覆盖矩阵和截图证据一致；
   - `openspec validate add-betrayal-basic-tutorial --strict --no-interactive` 仍通过。
2. 再看你准备落回主线动作的那个 `main` 现场是否仍保持干净：
   - 本轮此刻根目录 `main` 已干净；
   - 真正需要重复确认的是“正式执行回主线动作的那一刻”有没有新脏改或新提交插入。
3. 最后再看 `main` 在你准备回主线的那一刻，是否又新增了共享提交：
   - `src/components/game/framework/`
   - `src/engine/`
   - `src/pages/`
   - `public/locales/`
   - `scripts/infra/`
   - `.spec/knowledge/`
4. 如果 `main` 在这些共享区域又有新提交，必须重新做内容级比对，不能直接沿用这份文档里的旧结论。

## 可以直接以专项 worktree 为准的内容

这些文件即使和 `main` 冲突，也默认优先保留 `feat/game-betrayal` 的业务正文；真正要看的不是“谁更新”，而是“是不是山屋惊魂当前实现真相”。

- `docs/games/betrayal/**`
- `design-system/games/betrayal.md`
- `e2e/betrayal/**`
- `evidence/betrayal**/**`
- `openspec/changes/*betrayal*`
- `src/games/betrayal/**`
- `src/games/__tests__/betrayalManifestIntegration.test.ts`

原因：

- 这些文件承载的是 `betrayal` 当前真实规则、真实素材接线、真实 E2E 和当前批准中的实现线。
- 如果这里和 `main` 打架，默认应先把 `feat/game-betrayal` 当真相源，再看 `main` 是否有额外独有信息需要补带。

## 必须做双边内容归并的共享区域

以下路径一旦冲突，禁止直接选一边覆盖另一边：

- `src/components/game/framework/**`
- `src/contexts/**`
- `src/engine/**`
- `src/pages/**`
- `public/locales/en/*.json`
- `public/locales/zh-CN/*.json`
- `public/assets/i18n/assets-manifest.json`
- `scripts/infra/**`
- `.spec/knowledge/standards/**`
- `AGENTS.md`

归并时至少要先回答 4 件事：

1. `main` 那边改的是共享能力、别的游戏修复，还是纯格式/注释变化。
2. `feat/game-betrayal` 这边改的是山屋惊魂专用接线，还是已经抽成别的游戏也会受影响的共享能力。
3. 两边是否都改了同一个现实语义，例如教程生命周期、共享动作条、语言包 key、E2E helper。
4. 最终保留后的行为，要回到哪个真实入口验证。

## 当前最可能出现冲突的共享主题

### 1. 教程生命周期与运行时适配

涉及路径：

- `src/contexts/TutorialContext.tsx`
- `src/pages/useMatchRoomTutorialLifecycle.tsx`
- `src/pages/useMatchRoomPageRuntimeModel.ts`
- `src/pages/matchRoomStageRuntimeModelBuilders.ts`
- `src/engine/types.ts`

归并原则：

- 不能只保住 `betrayal` 的 `numPlayers` 接线，还要确认 `main` 是否同时改了别的教程游戏或教程框架。
- 真正的验收位点不是“能编过”，而是 `betrayal-tutorial.e2e.ts` 仍能从真实角色选择跑到真实终局。

### 2. 共享动作区与调试/作弊系统

涉及路径：

- `src/components/game/framework/ActionBarSkeleton.tsx`
- `src/components/game/framework/types.ts`
- `src/engine/systems/CheatSystem.ts`

归并原则：

- 先看 `main` 是否也在修别的游戏的动作区或调试系统。
- 不能把山屋惊魂教程接线需要的共享能力，在 merge 时又退回旧默认。

### 3. 公共语言包与 manifest 生成物

涉及路径：

- `public/locales/en/common.json`
- `public/locales/en/lobby.json`
- `public/locales/zh-CN/common.json`
- `public/locales/zh-CN/lobby.json`
- `public/locales/en/game-betrayal.json`
- `public/locales/zh-CN/game-betrayal.json`
- `src/games/manifest.client.generated.tsx`
- `src/games/manifest.generated.ts`
- `src/games/manifest.server.generated.ts`

归并原则：

- `game-betrayal.json` 默认以专项分支为主，但 `common/lobby` 必须看 `main` 是否有并行新增 key。
- manifest 生成物不要手写拼补；如果合并后上游注册表已变，应该重新走生成链，再做一次最小回归。

### 4. 通用文档与脚本

涉及路径：

- `.spec/knowledge/standards/asset-pipeline.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `.spec/knowledge/standards/generated-design-implementation.md`
- `.spec/knowledge/standards/ui-ux.md`
- `scripts/infra/run-e2e-command.mjs`
- `scripts/infra/eslint-safe-staged.mjs`
- `scripts/infra/vite-cli-safe.mjs`

归并原则：

- 这些文件常常同时服务多个任务线，不能因为 `betrayal` 用到了，就覆盖掉 `main` 的其他专项修订。
- 先看两边各自修的是哪条规则或哪类环境问题，再决定是双保留、重排，还是重新整理。

## 建议的实际合并顺序

1. 维持 `feat/game-betrayal` 当前已提交、已回归通过的状态，不要再在回主线前顺手混入新需求。
2. 先把准备执行回主线动作的 `main` 现场再次锁定为干净状态；本轮当前时刻已经满足这一点。
3. 如果 `main` 自上次吸收后没有新增提交，则直接走快进回主线；如果有新增共享提交，再补做一轮内容级比对。
4. 回主线动作完成后先跑最小回归：
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/basic-flow.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts`
5. 再补一次和共享改动直接相关的最小单测。
6. 验证通过后，再把“已回主线”的结论写回专项文档，而不是继续沿用这份预备文档里的旧时态。

## 禁止动作

- 不允许因为冲突文件很多，就先 `ours/theirs` 粗暴选边再回头补。
- 不允许把“我理解的最终样子”手工重写一版，冒充完成 merge。
- 不允许跳过 `betrayal` 三条真实 E2E，直接把“能编译”当作合并完成。
