# 冲突解决汇报：PR85（SmashUp 猫咪 / 小马派系接入）

## 1. 背景

- 目标分支：`main`
- merge commit：`f584d767720c6c8a0ace925b7fefab4b9a0173fb`
- 父1（合并前本地 `main`）：`e64c04f2b00f2f25d4b7b734a80fc1510b6613c4`
- 父2（PR85 头分支）：`eed00b2ebef905849574931a5aa10e228e0bc1e9`
- 说明：这次没有 `UU` 文本冲突；Git 自动完成了 merge，但 merge audit 识别到双方都改了 `src/games/smashup/domain/commands.ts`，因此需要补人工裁决说明。

## 2. 命中文件

本次 merge audit 命中的双侧重叠文件共 1 个：

1. `src/games/smashup/domain/commands.ts`

## 3. 解决策略

### `src/games/smashup/domain/commands.ts`

- 审计结果：`混合结果`
- 策略：保留父1里已经存在的共享弃牌堆出牌语义校验，同时并入父2里猫咪 / 小马派系接入带来的命令验证增量。

#### 冲突块裁决

- 弃牌堆打出随从的校验链：
  - 保留父1中的 `validateDiscardMinionPlaySemantics(...)`
  - 不采用父2里把这段 helper 改回内联额度判断的版本
- 小马额外天赋使用次数：
  - 并入父2新增的 `mythicHorsesSeastarExtraTalent` / `mythicHorsesSeastarExtraTalentConsumed` 分支
  - 允许小马派系对应效果在命令验证层被识别

#### 合并要点

- 父1承载的是更靠共享层的弃牌堆出牌语义校验，避免把已有的合法性 helper 静默回退成散落在命令里的局部判断。
- 父2承载的是 PR85 真正要带入的派系接入语义，尤其是小马额外天赋次数的验证分支。
- merge 结果最终同时保留了这两类内容，因此审计结果是 `混合结果`，不是单边覆盖。

#### 文件级原因说明

1. 为什么这份文件不能直接整份保留父1：
   - 父1没有 PR85 引入的小马额外天赋验证分支。
   - 如果整份保留父1，会把小马派系接入要求带来的命令层行为静默丢掉。

2. 为什么这份文件不能直接整份保留父2：
   - 父2把弃牌堆打出随从的共享语义校验从 helper 退回成局部判断。
   - 如果整份保留父2，会把 `e64c04f2` 里已有的共享合法性校验路径吃掉。

3. 另一侧仍然有效但最终未整份保留/已迁移的内容：
   - 父1有效内容：`validateDiscardMinionPlaySemantics(...)` 这条共享校验链，已保留在 merge 结果中。
   - 父2有效内容：`mythicHorsesSeastarExtraTalent` 相关命令验证分支，已保留在 merge 结果中。

4. 若这次判断错了，最可能丢失的用户可感知行为：
   - 小马派系的额外天赋机会在实际对局中被误拦截；
   - 或者弃牌堆打出随从的合法性校验回退，重新出现“局部额度判断覆盖共享语义”的旧问题。

5. 支撑证据：
   - `node scripts/verify/merge-conflict-audit.mjs f584d767720c6c8a0ace925b7fefab4b9a0173fb --fail-on-single-side`
   - `git diff e64c04f2b00f2f25d4b7b734a80fc1510b6613c4 eed00b2ebef905849574931a5aa10e228e0bc1e9 -- src/games/smashup/domain/commands.ts`
   - `git show f584d767720c6c8a0ace925b7fefab4b9a0173fb:src/games/smashup/domain/commands.ts`

## 4. 风险与验证

- 风险点：
  - `commands.ts` 同时承载共享命令验证和新派系接入语义，若混合判断失误，最容易表现成“部分新派系效果可录入但实战命令被误拒绝”。
- 已执行验证：
  - `node scripts/verify/merge-conflict-audit.mjs f584d767720c6c8a0ace925b7fefab4b9a0173fb --fail-on-single-side`
    - 结果：只命中 `src/games/smashup/domain/commands.ts`，且为 `混合结果`
- 未追加执行：
  - 本补记提交只为满足 merge 留档门禁，没有在当前步骤额外重跑游戏测试；代码行为验证仍以前序合并与后续撤回提交各自的原始验证为准。

## 5. 回归与行为变化登记

- 原 PR 目标问题：
  - 接入 SmashUp 猫咪与小马派系实现。
- 本次额外发现的真实回归：
  - 无新的实现型业务回归；本次补记主要是 merge audit 要求把自动混合结果显式解释清楚。
- 仅业务口径 / 规则变化：
  - 合并当时曾额外把“猫咪 / 小马不再标记为实施中”一起带入主线，但这不是 PR85 作者已锁定的长期合同。
  - 该额外改动已在后续提交 `fe56a4a4ddcac873263f74d2f93dded14eb76985` 撤回；当前主线已恢复为“猫咪 / 小马仍标记为实施中”。

## 6. 结果

- merge commit：`f584d767720c6c8a0ace925b7fefab4b9a0173fb`
- 冲突汇报补记：待本轮提交
- 推送目标：`origin/main`
