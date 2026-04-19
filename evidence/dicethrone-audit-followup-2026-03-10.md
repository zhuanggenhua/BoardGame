# DiceThrone 审计补查记录（2026-03-10）

## 背景

- 用户要求对 POD 混入的改动继续做**无遗漏审计**
- 复核发现旧文档把 `DiceThrone` 写成了 `100%`，但实际仍存在 `待审计 / 需要进一步检查` 项
- 本次补查重点是把“文档声称已完成、实际未闭环”的部分重新校正

## 本次已补审文件

### 1. `src/games/dicethrone/domain/customActions/moon_elf.ts`

#### 发现

- `Watch Out` 奖励骰特写文案 key 被固定成通用值 `bonusDie.effect.watchOut`
- 该回滚来自提交 `9c9dd78`
- 结果是特写只能显示通用标题，不能按骰面显示具体效果

#### 处理

- 已改为按骰面派发：
  - `bonusDie.effect.watchOut.bow`
  - `bonusDie.effect.watchOut.foot`
  - `bonusDie.effect.watchOut.moon`

#### 验证

- `src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx`
- `src/games/dicethrone/__tests__/moon_elf-behavior.test.ts`
- `e2e/dicethrone-watch-out-spotlight.e2e.ts`

以上已通过。

---

### 2. `src/games/dicethrone/domain/attack.ts`

#### 复核点

- 防御技能产生 `TOKEN_GRANTED` 后，攻击方是否还能正确感知 token 变化
- Token 响应窗口链路是否仍保留

#### 结论

- 当前文件已保留 `defenseEvents -> TOKEN_GRANTED 过滤 -> token 数量同步` 逻辑
- 这条此前文档标红的回滚链路目前**已恢复**
- 本次未发现新的 POD 残留问题

---

### 3. `src/games/dicethrone/domain/abilityLookup.ts`

#### 复核点

- 升级技能/变体技能查询是否错误回退到全局注册表
- 伤害判定是否忽略 variant / customAction categories

#### 结论

- 当前实现以 `player.abilities` 为唯一真实来源
- `findPlayerAbility / getPlayerAbilityEffects / playerAbilityHasDamage` 链路正常
- 本次未发现新的 POD 残留问题

---

### 4. `src/games/dicethrone/domain/customActions/barbarian.ts`
### 5. `src/games/dicethrone/domain/customActions/shadow_thief.ts`

#### 发现

- `customaction-category-consistency` 审计给出 3 条语义不一致建议
- 复核 `git blame` 后确认这 3 处 categories 元数据都来自 `9c9dd78`

#### 修复

- `barbarian-thick-skin`：`['other']` → `['other', 'resource']`
- `barbarian-thick-skin-2`：`['other']` → `['other', 'resource']`
- `shadow_thief-card-trick`：`['other']` → `['other', 'card']`

#### 验证

- `src/games/dicethrone/__tests__/customaction-category-consistency.test.ts`
- `src/games/dicethrone/__tests__/ability-customaction-audit.test.ts`（audit config）

以上已通过。

---

### 6. `src/games/dicethrone/heroes/paladin/abilities.ts`

#### 复核点

- 之前批次文档标记为“需要进一步检查”
- 主要关注升级技能、祝福/复仇链路、音效配置是否被 POD 回滚

#### 结论

- 现有相关测试通过，未发现本轮新的 POD 回滚残留
- 已验证测试：
  - `src/games/dicethrone/__tests__/paladin-abilities.test.ts`
  - `src/games/dicethrone/__tests__/paladin-behavior.test.ts`
  - `src/games/dicethrone/__tests__/paladin-blessing-removable.test.ts`
  - `src/games/dicethrone/__tests__/paladin-vengeance-2-cp.test.ts`

---

### 7. `src/games/dicethrone/domain/commandCategories.ts`

#### 发现

- 多组 `DiceThrone` 测试反复提示未分类命令：
  - `GRANT_TOKENS`
  - `PLAYER_UNREADY`
- 这两个命令属于元数据漏登记，不是功能逻辑错误，但会持续污染审计输出

#### 修复

- `PLAYER_UNREADY` → `STRATEGIC`
- `GRANT_TOKENS` → `STATE_MANAGEMENT`

并在 `src/games/dicethrone/__tests__/commandCategories.test.ts` 增加断言，防止再次回退。

---

### 8. `DiceThrone UI` 第二轮补审

#### 本轮复核文件

- `src/games/dicethrone/ui/AbilityOverlays.tsx`
- `src/games/dicethrone/ui/BoardOverlays.tsx`
- `src/games/dicethrone/ui/RightSidebar.tsx`
- `src/games/dicethrone/ui/LeftSidebar.tsx`
- `src/games/dicethrone/ui/GameHints.tsx`
- `src/games/dicethrone/ui/PlayerStats.tsx`
- `src/games/dicethrone/ui/DiceThroneHeroSelection.tsx`
- `src/games/dicethrone/ui/HeroSelectionOverlay.tsx`
- `src/games/dicethrone/ui/viewMode.ts`

#### 结论

- 本轮没有再发现新的 POD 逻辑回滚点
- 重点复核了：
  - 技能槽位 → 基础技能 ID 映射
  - 放大预览时升级卡叠层
  - Token 响应弹窗门控
  - 视角自动切换
  - 选角 UI
- 这些链路当前未发现新的功能性删除或回退

#### 顺手清理

- 删除了 `RightSidebar.tsx` 和 `viewMode.ts` 中残留的临时 `console.log`
- 这类日志不属于稳定业务日志，继续保留只会污染手测输出

#### 验证

- `src/games/dicethrone/__tests__/viewMode.test.ts`
- `src/games/dicethrone/__tests__/heroSelection.test.ts`
- `src/games/dicethrone/__tests__/commandCategories.test.ts`

## 本次额外发现

### 审计测试入口容易被误判为“已跑”

- 默认 `vitest` 配置会排除：
  - `**/*audit*.test.{ts,tsx}`
  - `**/*.property.test.{ts,tsx}`
- 真正要跑审计测试，必须使用：

```bash
npx vitest run --config vitest.config.audit.ts <file>
```

或：

```bash
npm run test:games:audit
```

这也是此前“感觉审过了，但其实某些审计文件根本没执行”的一个来源。

## 本次执行过的验证命令

```bash
npm run typecheck
npx vitest run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx src/games/dicethrone/__tests__/moon_elf-behavior.test.ts
PW_USE_DEV_SERVERS=true npx playwright test e2e/dicethrone-watch-out-spotlight.e2e.ts
npx vitest run src/games/dicethrone/__tests__/customaction-category-consistency.test.ts
npx vitest run --config vitest.config.audit.ts src/games/dicethrone/__tests__/ability-customaction-audit.test.ts
npx vitest run --config vitest.config.audit.ts src/games/dicethrone/__tests__/audit-effect-description.property.test.ts
npx vitest run src/games/dicethrone/__tests__/paladin-abilities.test.ts src/games/dicethrone/__tests__/paladin-behavior.test.ts src/games/dicethrone/__tests__/paladin-blessing-removable.test.ts src/games/dicethrone/__tests__/paladin-vengeance-2-cp.test.ts
npx vitest run src/games/dicethrone/__tests__/pyromancer-abilities.test.ts src/games/dicethrone/__tests__/pyromancer-behavior.test.ts
npx vitest run src/games/dicethrone/__tests__/shadow-thief-abilities.test.ts src/games/dicethrone/__tests__/shadow_thief-behavior.test.ts src/games/dicethrone/__tests__/cornucopia-e2e.test.ts src/games/dicethrone/__tests__/kidney-shot-damage-bug.test.ts
npx vitest run src/games/dicethrone/__tests__/commandCategories.test.ts src/games/dicethrone/__tests__/paladin-vengeance-2-cp.test.ts
npx vitest run src/games/dicethrone/__tests__/viewMode.test.ts src/games/dicethrone/__tests__/heroSelection.test.ts src/games/dicethrone/__tests__/commandCategories.test.ts
```

## 当前结论

- 旧文档中的“DiceThrone 已全审”是错误结论
- `moon_elf` 这条链路确实存在漏审，且已经修掉 1 个真实回滚 bug
- 本轮又顺手收掉了 3 个来自 `9c9dd78` 的 metadata 回退
- 本轮还补掉了 2 个命令分类漏登记，消除了持续刷屏的未分类警告
- `attack.ts`、`abilityLookup.ts`、`paladin abilities`、`pyromancer`、`shadow_thief abilities`、本轮复核的 UI 文件里未发现新的 POD 回滚残留

## 本轮补审（继续推进，未改业务代码）

### 9. `src/games/dicethrone/domain/passiveAbility.ts`

#### 复核点

- `9c9dd78` 是否把被动能力的可用性判定回退到“只看 CP、不看投掷上下文”
- `rerollDie` 在进攻 / 防御投掷阶段是否仍正确限制为当前掷骰方

#### 结论

- 当前 `isPassiveActionUsable` 仍保留：
  - `rollCount > 0`
  - `phase` 必须是 `offensiveRoll / defensiveRoll`
  - `rollerId === playerId`
  - 至少存在 1 颗可重掷骰子
- 本轮未发现新的 POD 回滚残留

#### 验证

- `src/games/dicethrone/__tests__/passive-reroll-validation.test.ts`

---

### 10. `src/games/dicethrone/domain/customActions/monk.ts`
### 11. `src/games/dicethrone/heroes/monk/abilities.ts`

#### 复核点

- `meditation / lotus-palm / thunder-strike` 相关 custom action 是否存在被 POD 混入后回退
- 变体技能、升级技能、奖励骰重掷链路是否还有漏审

#### 结论

- 本轮重新静态核对了 `meditation`、`lotus-palm`、`thunder-strike`、`transcendence` 链路
- `thunder-strike` 这段实现虽然在 `git blame` 上确实来自 `9c9dd78`，但**当前项目内的描述、测试、运行链路是自洽的**：
  - `public/locales/zh-CN/game-dicethrone.json` 当前文案就是“造成点数总和伤害”
  - 现有行为测试、流程测试都围绕这套语义
- 因此本轮**没有把它判定为“POD 回滚了你已有正确逻辑”**
- 其余 Monk 相关文件，本轮未发现新的明确回滚点

#### 验证

- `src/games/dicethrone/__tests__/monk-abilities.test.ts`
- `src/games/dicethrone/__tests__/monk-behavior.test.ts`
- `src/games/dicethrone/__tests__/monk-coverage.test.ts`
- `src/games/dicethrone/__tests__/monk-abilities-coverage.test.ts`
- `src/games/dicethrone/__tests__/thunder-strike.test.ts`

---

### 12. `src/games/dicethrone/heroes/barbarian/abilities.ts`

#### 复核点

- `rage` 技能是否又被删回去了
- `slap / suppress / reckless-strike / thick-skin` 等升级定义是否还存在 POD 回退残留

#### 结论

- `rage` 当前仍完整存在，未再出现“被 POD 删掉后未恢复”的情况
- `Barbarian` 基础 / 升级技能定义、行为链路本轮未发现新的明确回滚点
- 本轮没有对该文件做代码修改

#### 验证

- `src/games/dicethrone/__tests__/barbarian-abilities.test.ts`
- `src/games/dicethrone/__tests__/barbarian-behavior.test.ts`
- `src/games/dicethrone/__tests__/barbarian-coverage.test.ts`

---

### 本轮文件改动说明

- **业务代码改动：无**
- **仅更新审计记录**：`evidence/dicethrone-audit-followup-2026-03-10.md`

---

## 本轮继续补审（第二批，仍未改业务代码）

### 13. `src/games/dicethrone/domain/customActions/paladin.ts`

#### 复核点

- `holy-defense / blessing / vengeance / consecrate` 是否被 POD 改坏
- 防御投掷读取、防伤、授予守护/弹反链路是否存在删除你已修好逻辑的情况

#### 结论

- 当前 `holy-defense` 仍按防御投掷结果结算反伤、防伤、CP 与 III 级守护
- `blessing-prevent / vengeance-select-player / consecrate / holy-light-heal` 链路本轮未发现新的明确回滚点
- 本轮没有修改该文件

#### 验证

- `src/games/dicethrone/__tests__/paladin-abilities.test.ts`
- `src/games/dicethrone/__tests__/paladin-behavior.test.ts`
- `src/games/dicethrone/__tests__/paladin-coverage.test.ts`

---

### 14. `src/games/dicethrone/heroes/moon_elf/abilities.ts`

#### 复核点

- 基础 / 升级技能定义是否被 POD 回退
- `exploding-arrow / longbow / covering-fire / eclipse / elusive-step` 等链路是否缺技能、缺变体或回退了效果声明

#### 结论

- 本轮结合定义与行为测试复核，未发现新的明确回滚点
- 之前已修过的 `Watch Out` 奖励骰特写问题不在此文件，本文件当前没有再看到同类删除/回退
- 本轮没有修改该文件

#### 验证

- `src/games/dicethrone/__tests__/moon-elf-abilities.test.ts`
- `src/games/dicethrone/__tests__/moon_elf-behavior.test.ts`
- `src/games/dicethrone/__tests__/moon-elf-shield-integration.test.ts`

---

### 15. `src/games/dicethrone/ui/DiceTray.tsx`

#### 复核点

- POD 对 `multistep-choice` 骰子交互的 UI 改动，是否删掉了必要的确认 / 取消 / 选择状态逻辑
- 被动重掷模式、高亮、确认按钮门控是否存在静默回退

#### 结论

- 静态复核未发现新的明确回滚点
- 当前 `DiceTray` 仍保留：
  - `getDtMeta()` 对 `multistep-choice` 元数据的提取
  - `modifyDie / selectDie` 两套选择逻辑
  - 交互态下的 `cancel / confirm` 分流
  - 骰子重掷动画触发与按钮门控
- 结合底层交互测试，本轮没有发现“POD 把你原本好的骰子交互 UI 节点删掉”的情况

#### 验证

- `src/engine/systems/__tests__/useMultistepInteraction.test.ts`
- `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`

---

## 本轮继续补审（第三批：支撑链路）

### 16. 本轮复核文件

- `src/games/dicethrone/domain/events.ts`
- `src/games/dicethrone/domain/commandValidation.ts`
- `src/games/dicethrone/domain/index.ts`
- `src/games/dicethrone/domain/effects.ts`
- `src/games/dicethrone/ui/BonusDieOverlay.tsx`
- `src/games/dicethrone/ui/CardSpotlightOverlay.tsx`

### 17. 复核结论

- 本轮未发现新的**明确** POD 回滚点
- 重点复核了：
  - 事件类型与音效事件注册
  - 打牌 / 用 Token / 被动能力的校验链路
  - 奖励骰 displayOnly 展示
  - 卡牌特写与额外骰子特写的挂载链路
- 这些链路在当前代码里没有再看到“POD 把已修好的特写 / 事件 / 校验分支删掉”的明确证据

### 18. 验证结果

通过：

- `src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx`
- `src/games/dicethrone/__tests__/actionLogFormat.test.ts`
- `src/games/dicethrone/__tests__/token-execution.test.ts`
- `src/games/dicethrone/__tests__/shared-state-consistency.test.ts`
- `src/games/dicethrone/__tests__/daze-action-blocking.test.ts`
- `src/games/dicethrone/__tests__/interaction-chain-conditional.test.ts`

### 19. 当前工作区额外观察

- `src/games/dicethrone/__tests__/flow.test.ts` 在当前工作区有 1 条失败：
  - `阶段推进防护（状态驱动回归测试） > flowHalted=true 状态下打出大吉大利不会误触发阶段推进`
- 现象：预期停留在 `offensiveRoll`，实际到了 `main2`
- **本轮没有直接修这个问题**，原因是：
  1. 当前工作区相关流程文件已有 staged 改动（如 `commandValidation.ts`、`flowHooks.ts`、`reducer.ts`、`events.ts`）
  2. 现阶段不能安全断言这条红测仍然是“POD 残留”，还是当前工作区其他未提交调整带来的现象
- 因此这里只做记录，避免和用户当前修改冲突

### 20. 本轮文件改动说明

- **业务代码改动：无**
- **新增/更新文档**：
  - `evidence/dicethrone-audit-followup-2026-03-10.md`
  - `evidence/p1-audit-followup-2026-03-10.md`
  - `evidence/p1-audit-progress.md`

## 后续待继续

- 继续补审旧文档里仍挂着的 `pyromancer` / `shadow_thief abilities` / 其余 DiceThrone UI 待审项
- 继续按“明细文件逐个关闭”推进，不能再按总表 `100%` 判断完成
