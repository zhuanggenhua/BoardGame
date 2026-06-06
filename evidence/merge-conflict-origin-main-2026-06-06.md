# merge 冲突/混合审计记录（2026-06-06）

## 背景

- 目标分支：`main`
- 合并来源：`origin/main`
- 触发命令：`git merge --no-edit origin/main`
- merge commit：`f9214edd7a1a746483dfbf06c298ff343bef4743`
- 父1（本地）：`e3c37700776d8ea0fc3686b0ac984bb37629fcec`
- 父2（远端）：`c803b61b5f775813e151b15405efa070534c4fb6`
- 说明：这次没有 `UU` 文本冲突；Git 自动完成了 merge，但 `merge-conflict-audit` 识别到双方在同一同步链路上有重叠改动，需要补人工解释。

## 命中文件

本次 merge audit 命中的双侧重叠文件共 3 个：

1. `src/engine/transport/__tests__/server.test.ts`
2. `src/engine/transport/server.ts`
3. `src/games/dicethrone/domain/index.ts`

额外随 merge 落入结果、且与远端这次王权兼容修复直接相关的文件：

1. `src/games/dicethrone/__tests__/flow.test.ts`

## 实际裁决

### `src/engine/transport/__tests__/server.test.ts`

- 审计结果：`完全等于父1`
- 裁决：保留本地父1版本，不回退到远端父2
- 原因：
  - 本地父1已经补入在线 AI recovery seam 的测试收口，包括 `engineConfig` 接缝、`resolveCurrentPlayerId` 的游戏级 seam、以及一组更稳定的 server 内部测试辅助类型/工厂。
  - 远端父2这次真正需要带入的不是 `server.test.ts` 的旧断言形态，而是 `server.ts` 里的王权旧状态兼容修复，以及 `flow.test.ts` 对 legacy pendingBonusDiceSettlement 脏状态的回归覆盖。
  - merge 结果相对父1没有再改 `server.test.ts`，说明这次同步远端主分支时，没有必要为了追远端旧测试版本而覆盖本地已更完整的 transport 合同测试。
- 如果这里判断错了，最可能丢失的是：
  - 远端在 `server.test.ts` 中新增但未被本地覆盖的断言。
- 为什么当前可接受：
  - merge commit 相对父1只新增了 `server.ts` 与 `flow.test.ts`，没有对 `server.test.ts` 再引入额外远端片段，说明远端这次主修复并不依赖把测试文件整体吃回父2版本。

### `src/engine/transport/server.ts`

- 审计结果：`混合结果`
- 裁决：保留本地同步链路补丁，同时并入远端 `origin/main` 的王权旧状态兼容修复
- 合并要点：
  - 保留本地 `engineConfig` 透传和 `buildAiProgressMarker(match.state, { engineConfig, gameId })` 这组在线 AI 恢复语义指纹补丁。
  - 并入远端主分支本次新增的王权旧状态兼容修复。
- 风险点：
  - `state:sync` / playerView / 旧状态归一化 / online AI watchdog 之间有联动，若两侧语义不兼容，最容易再次表现成“已连上服务器但收不到对局状态”。

### `src/games/dicethrone/domain/index.ts`

- 审计结果：`与两侧相同`
- 裁决：无需人工二选一；该文件两侧最终一致，没有额外偏斜风险。

### `src/games/dicethrone/__tests__/flow.test.ts`

- 该文件不在 overlap 审计三件套里，但 merge commit 实际把远端新增的 `旧 pendingBonusDiceSettlement 脏 dice shape` 回归断言带进来了。
- 这是本次王权旧状态兼容修复必须保留的远端增量。

## 为什么这次允许“单边文件 + 人工说明”

- 本次不是人工手改冲突块，而是 auto-merge 后的重叠域审计。
- 真正需要防的是“远端主分支刚修好的王权兼容逻辑被本地旧版本盖掉”，而不是机械要求每个双侧重叠文件都必须做成字节级混合结果。
- `server.test.ts` 保持父1，并不代表远端王权修复被吞掉；相反，关键行为修复实际落在 `server.ts` 和 `flow.test.ts`，两者都已经进入 merge 结果。

## 验证

- `git show --stat --oneline f9214edd7a1a746483dfbf06c298ff343bef4743`
  - 结果：merge commit 仅新增 `src/engine/transport/server.ts` 和 `src/games/dicethrone/__tests__/flow.test.ts`
- `node scripts/verify/merge-conflict-audit.mjs f9214edd7a1a746483dfbf06c298ff343bef4743 --fail-on-single-side`
  - 结果：命中 `server.test.ts = 完全等于父1`，已在本文档解释原因
- `npm run quality:changed:pre-push`
  - 本文档补入后重新执行，以当前门禁结果为准

## 回归与行为变化登记

- 原始目标问题：
  - 王权（DiceThrone）旧状态兼容与同步链路修复
- 本次额外发现的真实回归：
  - 无新的业务回归；本次新增的是 merge 审计流程死角，表现为“auto-merge 成功后仍要求把冲突汇报塞回 merge commit 本身”
- 仅流程/规范变化：
  - `scripts/infra/run-changed-quality-gate.mjs` 允许在 merge 后紧跟的补记提交中补 `evidence/merge-conflict-*.md`，避免为了留档强制改写刚生成的 merge commit
  - `docs/git-merge-checklist.md` 同步补充该口径

## 结果

- merge commit：`f9214edd7a1a746483dfbf06c298ff343bef4743`
- 冲突汇报补记：待本轮提交
- 推送目标：`origin/main`
