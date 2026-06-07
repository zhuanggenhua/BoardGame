> 2026-05-30 更正说明：
> 本文档若被用于引用隐形忍者（`ninjas_invisible_ninja`）规则，请以 `evidence/smashup/smashup-feedback-6a1a888c-invisible-ninja-card-destroy-trigger-2026-05-30.md` 为准。旧口径把它收窄成“消灭对手随从后触发”，现已确认正式卡图实际是“每回合一次，消灭另一名玩家的一张卡，或将自己一个随从返回手牌后触发”。

# SmashUp lane-2 人类反馈遗留簇复验与最小修复（2026-04-26）

## 范围

- lane: `lane-2`
- 游戏：`smashup`
- 本轮目标：对 8 条人类反馈做“映射 -> 现状核验 -> 最小修复或阻塞说明”
- 本轮不是关单；只确认哪些已被覆盖、哪些本轮补修、哪些仍缺证据

## 反馈映射与状态矩阵

| 反馈 ID | 映射对象 | 规则/交互链路 | 状态 | 可复查证据 |
| --- | --- | --- | --- | --- |
| `69a2e36317d6c588726811bb` | `zombie_lord` | 弃牌堆选低战力随从 -> 直点基地部署 | `already-fixed-verified` | `evidence/smashup/smashup-zombie-lord-direct-click-e2e.md`、`evidence/smashup/smashup-feedback-69daa34c-zombie-lord-stall-2026-04-22.md` |
| `69a2e99717d6c5887268121b` | `bear_cavalry_bear_necessities` | 打出后选择并移除“已打出的行动卡” | `fixed-now` | `src/games/smashup/abilities/bear_cavalry.ts`、`src/games/smashup/__tests__/newFactionAbilities.test.ts` |
| `69a2ea9217d6c5887268121d` | `base_the_field_of_honor` | 荣耀之地对 destroy 归属的 VP 发放 | `already-fixed-verified` | `src/games/smashup/__tests__/newBaseAbilities.test.ts` |
| `69a434d91eb921c6091f1137` | `wizard_scry` | 占卜进入选牌后从当前牌库实时生成行动卡候选 | `fixed-now` | `src/games/smashup/abilities/wizards.ts`、`src/games/smashup/__tests__/query6Abilities.test.ts` |
| `69a435f91eb921c6091f114d` | `wizard_portal_order` | 传送揭示后对剩余牌库顶做实时排序 | `already-fixed-verified` | `src/games/smashup/__tests__/query6Abilities.test.ts`、`evidence/smashup/wizard-portal-e2e-test.md` |
| `69a6e0b584ff8ed02e45ae66` | `pirate_saucy_wench` -> `wizard_neophyte` | 粗鲁少妇选择目标后应消灭学徒 | `fixed-now` | `src/games/smashup/__tests__/pirate-broadside-self-target.test.ts` |
| `69a6f2f5b832e79689a367af` | `bear_cavalry_high_ground` + 海盗 destroy 链 | 黑熊移动消灭归属 / 海盗 destroy 交互 | `already-fixed-verified` | `src/games/smashup/__tests__/feedback-high-ground-destroyer.test.ts`、`evidence/smashup/smashup-feedback-69a6eac7b832e79689a366dc-pirates-destroy-fix-2026-04-26.md` |
| `69b3ea3c57a311c84a8fe431` | `base_the_workshop` | 工坊只应奖励“打到基地本身”的 action | `fixed-now` | `src/games/smashup/domain/baseAbilities.ts`、`src/games/smashup/__tests__/newBaseAbilities.test.ts` |

## 本轮新修的 3 条

### 1. `69a2e99717d6c5887268121b` -> `bear_cavalry_bear_necessities`

判定：

- 真实规则是“destroy an action played on a base or minion”
- 旧实现错误包含“消灭对手随从”

最小修复：

- `src/games/smashup/abilities/bear_cavalry.ts`
  - 只收集已打出的行动卡目标
  - 交互标题改成“选择要消灭的已打出行动卡”
  - 响应时补 live revalidate，若所选 action 已离场则不再结算

回归覆盖：

- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - 只暴露 action 目标
  - 多目标创建 prompt
  - 单目标自动 detach
  - stale target 离场后不再结算

### 2. `69a434d91eb921c6091f1137` -> `wizard_scry`

判定：

- 反馈截图显示 `占卜：选择一张行动卡放入手牌` 时界面 `暂无可选项`
- 原因是交互进入后依赖 `autoRefresh: 'deck'`，但没有为 refresh 提供新的 options 生成器

最小修复：

- `src/games/smashup/abilities/wizards.ts`
  - 抽出 `buildWizardScryOptions(...)`
  - 初次交互与 refresh 都复用同一份 deck -> action options 生成逻辑
  - 给 `wizard_scry` 交互补 `optionsGenerator`

回归覆盖：

- `src/games/smashup/__tests__/query6Abilities.test.ts`
  - `wizard_scry: refresh 后仍应从当前牌库重新生成行动卡候选`

### 3. `69b3ea3c57a311c84a8fe431` -> `base_the_workshop`

判定：

- 用户反馈是“把战术打到工坊上的一个随从后，系统给了一个战术位”
- 正确规则只覆盖“打到基地本身的 action”

最小修复：

- `src/games/smashup/domain/baseAbilities.ts`
  - `base_the_workshop` 只接受 `actionTargetType === 'base'`

回归覆盖：

- `src/games/smashup/__tests__/newBaseAbilities.test.ts`
  - `打到工坊随从上的战术不应给予额外战术额度`

## 已有修复，本轮复验通过的 4 条

### 1. `69a2e36317d6c588726811bb` -> `zombie_lord`

- 现有 E2E 已覆盖“弃牌横排选随从 -> 直点基地部署 -> 成功收口”
- 现有根因修复文档已覆盖“只回 optionId 时也不会写 `undefined` 基地状态”

### 2. `69a2ea9217d6c5887268121d` -> `base_the_field_of_honor`

- 规则验证后判断为“当这里一个或多个随从被消灭时，消灭者得 1VP”
- 本轮新增定向回归：`robot_microbot_guard` 在荣耀之地一次消灭 1 个随从时，只发 1 次 `VP_AWARDED`

### 3. `69a435f91eb921c6091f114d` -> `wizard_portal_order`

- 现有 `wizard_portal_order` 已有 live options / snapshot 防 stale 逻辑
- 现有测试与 E2E 都能复查“剩余牌库顶排序”链路

### 4. `69a6f2f5b832e79689a367af` -> `bear_cavalry_high_ground` + pirates destroy

- 黑熊半边：`feedback-high-ground-destroyer.test.ts` 已覆盖 destroyerId / VP 归属
- 海盗半边：现有证据文档已覆盖 `Broadside` 与 `Saucy Wench` destroy 链

## 补修追加（本轮收口）

### `69a6e0b584ff8ed02e45ae66` -> `pirate_saucy_wench` 消灭学徒

补充结论：

- 已在现有海盗测试文件补定向回归：`粗鲁少妇应能消灭对手学徒（wizard_neophyte）`
- 场景明确覆盖“粗鲁少妇打出 -> 选择 `wizard_neophyte` -> 学徒被消灭”
- 实跑通过，确认该反馈链路可收口

## 本轮测试命令与结果

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/query6Abilities.test.ts --configLoader native --maxWorkers 1
```

- 结果：`30 passed`

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --maxWorkers 1 -t "base_the_field_of_honor|base_the_workshop"
```

- 结果：`9 passed`

```powershell
node --max-old-space-size=4096 scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 -t "bear_cavalry_bear_necessities|bear cavalry interaction regressions"
```

- 结果：`7 passed`

```powershell
node --max-old-space-size=4096 scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 -t "bear_cavalry_bear_necessities: 目标已离场时不再消灭"
```

- 结果：`1 passed`

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/feedback-high-ground-destroyer.test.ts --configLoader native --maxWorkers 1
```

- 结果：`2 passed`

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/pirate-broadside-self-target.test.ts --configLoader native --maxWorkers 1
```

- 结果：`6 passed`

## 本轮涉及文件

代码：

- `src/games/smashup/abilities/wizards.ts`
- `src/games/smashup/abilities/bear_cavalry.ts`
- `src/games/smashup/domain/baseAbilities.ts`

测试：

- `src/games/smashup/__tests__/query6Abilities.test.ts`
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
- `src/games/smashup/__tests__/newBaseAbilities.test.ts`
- `src/games/smashup/__tests__/feedback-high-ground-destroyer.test.ts`
- `src/games/smashup/__tests__/pirate-broadside-self-target.test.ts`

旁证：

- `evidence/smashup/smashup-zombie-lord-direct-click-e2e.md`
- `evidence/smashup/smashup-feedback-69daa34c-zombie-lord-stall-2026-04-22.md`
- `evidence/smashup/wizard-portal-e2e-test.md`
- `evidence/smashup/smashup-feedback-69a6eac7b832e79689a366dc-pirates-destroy-fix-2026-04-26.md`

## 结论

- 本轮 `fixed-now`：`69a2e99717d6c5887268121b`、`69a434d91eb921c6091f1137`、`69a6e0b584ff8ed02e45ae66`、`69b3ea3c57a311c84a8fe431`
- 本轮 `already-fixed-verified`：`69a2e36317d6c588726811bb`、`69a2ea9217d6c5887268121d`、`69a435f91eb921c6091f114d`、`69a6f2f5b832e79689a367af`
- 本轮 `still-blocked(with reason)`：无

这份文档只覆盖 lane-2 这 8 条反馈的现状与最小修复，不等同于整簇已关单。
