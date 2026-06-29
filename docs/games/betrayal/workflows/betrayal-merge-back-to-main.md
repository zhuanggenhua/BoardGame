# 山屋惊魂回主分支合并口径

> 目的：当 `feat/game-betrayal` 准备回 `main` 时，先锁定“哪些内容以当前专项 worktree 为真相源，哪些内容必须做双边内容归并”，避免把冲突处理退化成纯文本选边。
> 当前实施现场：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal`
> 当前分支：`feat/game-betrayal`

## 当前结论

- 现在还不是直接 merge 的时机；当前 worktree 里仍有未提交改动和新增文件，应该先在这棵树里继续收口。
- `betrayal` 相关实现、证据、规则、资源合同、E2E 和 OpenSpec 变更，默认以这棵专项 worktree 为真相源。
- 共享框架、共享文档、共享脚本、共享语言包和生成产物，不允许直接“选 ours/theirs”；必须逐项看现实语义后再归并。
- 这轮 `Board.tsx` 改动后的最小真实回归矩阵已经在当前专项 worktree 串行通过，因此 merge 前的 blocker 已经从“先证明没打回已有链路”切换成“先把未提交专项改动收成可提交状态”。

## 当前专项收口就绪度

> 结论时间：`2026-06-29`
> 结论范围：只针对当前 `betrayal` 专项 worktree 的“离可提交还差什么”，不代表已经可以直接 merge 回 `main`。

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

### 还不能直接 merge 的真正原因

- 现在的问题不再是“功能没证明”，而是“这批未提交改动还没被整理成一笔专项收口提交”。
- 这批改动同时包含三层内容，提交前必须按现实语义确认一起收：
  - `betrayal` 专项正文：
    - `src/games/betrayal/**`
    - `e2e/betrayal/**`
    - `evidence/betrayal**/**`
    - `docs/games/betrayal/**`
    - `openspec/changes/add-betrayal-basic-tutorial/**`
  - 为 `betrayal` 教程 / 运行时接线而带动的共享层：
    - `src/contexts/TutorialContext.tsx`
    - `src/pages/useMatchRoomTutorialLifecycle.tsx`
    - `src/pages/useMatchRoomPageRuntimeModel.ts`
    - `src/pages/matchRoomStageRuntimeModelBuilders.ts`
    - `src/components/game/framework/ActionBarSkeleton.tsx`
    - `src/components/game/framework/types.ts`
    - `src/engine/systems/CheatSystem.ts`
    - `src/engine/types.ts`
    - `src/games/manifest.client.generated.tsx`
    - `src/games/fantasyrealms/tutorial.ts`
  - 与教程 / 规则落地配套的语言包与测试：
    - `public/locales/en/game-betrayal.json`
    - `public/locales/zh-CN/game-betrayal.json`
    - `src/components/game/framework/__tests__/ActionBarSkeleton.test.tsx`
    - `src/engine/systems/__tests__/CheatSystem.test.ts`
    - `src/pages/__tests__/*tutorial*`
    - `src/games/betrayal/__tests__/*`

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
    - `docs/games/betrayal/workflows/**`
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
- 还没发生的事情现在只剩一件：
  - **还没有进入 `main` 的分支级内容归并。**
- 因此当前最准确的口径应更新为：
  - **专项收口已提交；**
  - **尚未 merge；**
  - **下一步是内容级归并，而不是继续补收口提交。**

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

- 当前 `main` 相对 merge-base 只新增了两笔提交：
  - `d95d6066`：以 `qidahen / fantasyrealms / HomeV2 / 移动发布脚本` 为主
  - `a88352c2`：以 `qidahen / fantasyrealms` 的推送门禁修复为主
- 当前 `feat/game-betrayal` 相对 merge-base 的专项提交，主要都在 `betrayal` 目录、自身 E2E、资源、OpenSpec 和少量共享接线。
- 从 `merge-tree` 预检结果看，当前至少有 3 处共享主题必须重点归并：
  - `docs/ai-rules/ui-ux.md`
  - `vite.config.ts`
  - `src/pages/useMatchRoomTutorialLifecycle.tsx`
- 截至 `2026-06-29` 当前这轮内容级吸收后，状态已经更新为：
  - `src/pages/useMatchRoomTutorialLifecycle.tsx` 与对应测试已在专项树内完成双保留吸收；
  - `docs/ai-rules/ui-ux.md` 已补回通用分层门禁，并把误落到全局层的单游戏专名收回通用表述；
  - `vite.config.ts` 经正文比对确认当前专项树已包含 `main` 的 Android/iOS 裁剪插件与 `three-stdlib` alias，这一项不再是待吸收 blocker。
- 当前根目录 `main` 工作区里看到的 `qidahen` 脏改，只是当前工作区未提交修改，不属于 `main` 已提交历史；它们会影响“你在哪棵树上实际执行 merge 命令”，但**不是**这次 `main <-> feat/game-betrayal` 的分支级文本冲突主体。
- `merge-tree` 还显示若干共享文件会进入“双方都改”的自动归并路径，例如：
  - `src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx`
  - `src/components/game/framework/ActionBarSkeleton.tsx`
  - `src/components/game/framework/types.ts`
  - `src/engine/types.ts`
  - `src/engine/systems/CheatSystem.ts`
  - `src/engine/transport/onlineAiRecovery.ts`
  - `public/locales/{en,zh-CN}/game-betrayal.json`
- 这些文件不一定都会形成手工冲突块，但已经证明“实际归并面”比最初两处更宽，不能再按“两文件收口”来低估 merge 工作量。

## 当前这次两处共享重叠的现实含义

### 1. `docs/ai-rules/ui-ux.md`

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
  - `docs/ai-rules/ui-ux.md` 已补回 `0.0a 通用规范与单游戏专名分层`；
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

## 当前剩余冲突分级

- **高优先级手工冲突候选**：
  - `src/pages/useMatchRoomTutorialLifecycle.tsx`
  - `src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx`
- 结论依据：
  - `merge-tree` 里这两处已经出现明确的 `<<<<<<< / ======= / >>>>>>>` 冲突标记；
  - 它们分别对应教程生命周期正文和教程生命周期测试，仍然是 merge 时最需要手工双保留的共享点。
- **中优先级 changed-in-both，但当前更像“自动合并后做语义复核”**：
  - `docs/ai-rules/ui-ux.md`
  - `vite.config.ts`
- 结论依据：
  - 这两处在 `merge-tree` 中属于双方都改，但当前看到的是并排 diff 与 merged result，没有出现同等级的显式冲突标记；
  - `ui-ux.md` 重点是确认通用分层与本轮新增门禁都还在；
  - `vite.config.ts` 重点是确认 Android/iOS prune plugin 与 `three-stdlib` alias 没被后续共享改动打掉。
- **低优先级 auto-merge 候选，但 merge 后仍要定向回归**：
  - `src/components/game/framework/ActionBarSkeleton.tsx`
  - `src/components/game/framework/__tests__/ActionBarSkeleton.test.tsx`
  - `src/components/game/framework/types.ts`
  - `src/engine/systems/CheatSystem.ts`
  - `src/engine/systems/__tests__/CheatSystem.test.ts`
  - `src/engine/types.ts`
  - `public/locales/{en,zh-CN}/game-betrayal.json`
  - `src/games/manifest.client.generated.tsx`
- 结论依据：
  - `merge-tree` 对这些文件已经给出了 `result` 结果，没有展示显式文本冲突块；
  - 但它们都属于共享接线或生成物，merge 后仍需靠 `vitest + betrayal 最小 E2E` 证明没有语义回退。
- 当前建议的 merge 后最小真实回归顺序：
  - `betrayal-tutorial`
  - `basic-flow`
  - `first-scenario`
  - 若这 3 条都通过，再决定是否补跑其余 4 条边界 E2E。

## 当前这次最小风险 merge 顺序

1. 先在 `feat/game-betrayal` 里把专项未提交改动收口并提交。
2. 不要在当前根目录 `main` 的脏工作区上直接 merge；要先保证执行 merge 的那棵树本身没有无关未提交改动干扰。
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
- `docs/ai-rules/ui-ux.md`、`vite.config.ts`、`src/pages/useMatchRoomTutorialLifecycle.tsx` 都不能二选一，默认动作都是双边内容归并：
  - `ui-ux.md`：两边新增的是不同门禁，默认双保留并重排，不选单边覆盖；
  - `vite.config.ts`：保留 `main` 的 Android/iOS 裁剪与 `three-stdlib` alias，同时保留 `betrayal` 所需接线，不回退任何一边的现实能力。
  - `useMatchRoomTutorialLifecycle.tsx`：保留 `main` 的教程切换完成态判断，同时保留 `betrayal` 这边的旧实例延迟清理隔离。
- 共享层一旦出现同文件冲突，不能只看冲突标记选 `ours/theirs`；必须先回答“这边修的是哪个现实语义、另一边修的是哪个现实语义、最终保留后回哪个真实入口验证”。
- 当前不建议直接在根目录 `main` 上手工消冲突；正确顺序仍然是：先在 `betrayal` 专项树里收口并提交，再基于已提交真相去做分支级归并。

## 回主分支前的最小检查

1. 先在 `feat/game-betrayal` 内确认：
   - `basic-flow`、`first-scenario`、`betrayal-tutorial` 三条真实 E2E 都还是通过态；
   - `docs/games/betrayal/README.md`、教程覆盖矩阵和截图证据一致；
   - `openspec validate add-betrayal-basic-tutorial --strict --no-interactive` 仍通过。
2. 再看 `main` 在你准备合并的那一刻，是否也改到了以下共享区域：
   - `src/components/game/framework/`
   - `src/engine/`
   - `src/pages/`
   - `public/locales/`
   - `scripts/infra/`
   - `docs/ai-rules/`
3. 如果 `main` 在这些共享区域也有新改动，必须先做内容级比对，不能直接选边。

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
- `docs/ai-rules/**`
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

- `docs/ai-rules/asset-pipeline.md`
- `docs/ai-rules/e2e-verification.md`
- `docs/ai-rules/generated-design-implementation.md`
- `docs/ai-rules/ui-ux.md`
- `scripts/infra/run-e2e-command.mjs`
- `scripts/infra/eslint-safe-staged.mjs`
- `scripts/infra/vite-cli-safe.mjs`

归并原则：

- 这些文件常常同时服务多个任务线，不能因为 `betrayal` 用到了，就覆盖掉 `main` 的其他专项修订。
- 先看两边各自修的是哪条规则或哪类环境问题，再决定是双保留、重排，还是重新整理。

## 建议的实际合并顺序

1. 先在 `feat/game-betrayal` 内提交一笔“当前专项收口”。
2. 拉平 `main` 的最新内容后，只做一次内容级冲突归并，不要一边修一边开新需求。
3. 冲突归并后先跑最小回归：
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/basic-flow.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario.e2e.ts`
   - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts`
4. 再补一次和共享改动直接相关的最小单测。
5. 验证通过后再考虑把专项分支合回 `main`。

## 禁止动作

- 不允许因为冲突文件很多，就先 `ours/theirs` 粗暴选边再回头补。
- 不允许把“我理解的最终样子”手工重写一版，冒充完成 merge。
- 不允许跳过 `betrayal` 三条真实 E2E，直接把“能编译”当作合并完成。
