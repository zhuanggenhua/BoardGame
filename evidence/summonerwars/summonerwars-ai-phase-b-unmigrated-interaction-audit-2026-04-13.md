# Summoner Wars AI 交互全链路审计（Phase B 全量迁移范围，2026-04-13）

## 审计范围
- `src/games/summonerwars/ai.ts`
- `src/games/summonerwars/Board.tsx`
- `src/games/summonerwars/ui/useGameEvents.ts`
- `src/games/summonerwars/ui/useCellInteraction.ts`
- `src/games/summonerwars/ui/useEventCardModes.ts`
- `src/games/summonerwars/ui/AbilityButtonsPanel.tsx`
- `src/games/summonerwars/ui/StatusBanners.tsx`
- `src/games/summonerwars/domain/systems.ts`
- `src/games/summonerwars/domain/validate.ts`
- `src/games/summonerwars/domain/execute.ts`
- `src/games/summonerwars/domain/abilities.ts`
- `src/games/summonerwars/domain/abilities-barbaric.ts`
- `src/games/summonerwars/domain/abilities-frost.ts`
- `src/games/summonerwars/domain/abilities-goblin.ts`
- `src/games/summonerwars/domain/abilities-paladin.ts`
- `src/games/summonerwars/domain/abilities-trickster.ts`

## 权威来源
- 当前仓库实现（仅静态代码审计，不改实现）
- `openspec/changes/refactor-summonerwars-local-ui-interactions/design.md`
- `openspec/changes/refactor-summonerwars-local-ui-interactions/specs/summonerwars-core/spec.md`
- `.spec/knowledge/standards/testing-audit.md`

## 审计边界
- 本轮只回答 **“还有哪些交互没迁到 InteractionSystem 真相源”**。
- **不把“UI 里仍有本地展示 state，但真相已来自 `sys.interaction`”算作未迁移。**
- 已迁移、因此不在本清单中的链路：
  - `magic_event_choice`
  - `blood_summon`
  - `annihilate`
  - `mind_control`
  - `stun`
  - `hypnotic_lure`
  - `chant_entanglement`
  - `sneak`
  - `glacial_shift`
  - `infection`
  - `grab_follow`
  - `soul_transfer`
  - `mind_capture`
  - `ice_shards`
  - `feed_beast`
  - 以上均已由 `domain/systems.ts` 创建 `simple-choice` 交互并由 `ai.ts` 的 `buildInteractionActions(...)` 消费。

## 结论摘要
- **已完成迁移的主线**：事件卡链、Phase A 六条 AI 关键链、magic 二选一。
- **仍未迁移的真问题**：`useGameEvents.ts` / `useCellInteraction.ts` 里仍然直接 `setAbilityMode / setAfterAttackAbilityMode / setRapidFireMode / setWithdrawTrigger / setFireSacrificeSummonMode / setTelekinesisTargetMode`。
- **AI 现状分三类**：
  1. **完全看不见**：只能靠本地 mode 才能继续；
  2. **伪可见 / 半截可见**：AI 会直接拼 `ACTIVATE_ABILITY`，但看不到真实 prompt，甚至可能发出半截 payload；
  3. **已迁移**：真人/AI 都读 `sys.interaction.current`。

---

## 一、未迁移清单（按分类）

| 分类 | 交互 | 当前本地状态入口 | AI 可见性结论 | 建议交互设计 | resolve 映射 |
| --- | --- | --- | --- | --- | --- |
| beforeAttack | `life_drain` | `useCellInteraction.ts:851-873,1093-1158` | **看不见**。`ai.ts:1537` 只直发 `DECLARE_ATTACK`，不会进入这条本地选择链。 | `simple-choice`：选 2 格内友军或 skip；interaction data 带 `attacker/target/sourceUnitId` | `DECLARE_ATTACK`（带 `beforeAttack.abilityId='life_drain' + targetUnitId`） |
| beforeAttack | `holy_arrow` | `useCellInteraction.ts:851-873,1093-1144` | **看不见**。AI 不会生成弃牌型 beforeAttack payload。 | `simple-choice + multi(min=0)`：候选为可弃单位卡；允许空选 | `DECLARE_ATTACK`（带 `beforeAttack.discardCardIds`；空选则直接攻击） |
| beforeAttack | `healing` | `useCellInteraction.ts:851-873,1110-1144` | **看不见**。AI 不会生成“攻击友军前弃 1 张牌”的本地模式。 | `simple-choice` 或 `multi(min=0,max=1)`：候选手牌 + skip | `DECLARE_ATTACK`（带 `beforeAttack.targetCardId`；空选则直接攻击） |
| afterAttack | `telekinesis` | `useGameEvents.ts:494-510` → `useEventCardModes.ts:528-569` | **看不见**。afterAttack 跟进选择不进 `sys.interaction`。 | `multistep-choice`：①选目标 ②选终点/方向 | `ACTIVATE_ABILITY('telekinesis')` |
| afterAttack | `high_telekinesis` | `useGameEvents.ts:494-510` → `useEventCardModes.ts:528-569` | **看不见**。 | `multistep-choice`：①选目标 ②选终点/方向 | `ACTIVATE_ABILITY('high_telekinesis')` |
| afterAttack | `mind_transmission` | `useGameEvents.ts:494-510` → `useEventCardModes.ts:528-546` | **看不见**。 | `simple-choice`：选 3 格内友方士兵或 skip | `ACTIVATE_ABILITY('mind_transmission')` |
| afterAttack | `rapid_fire` | `useGameEvents.ts:513-523` + `Board.tsx:766-769` | **看不见**。只在本地 `rapidFireMode` 里确认/跳过。 | `simple-choice`：confirm / skip | `ACTIVATE_ABILITY('rapid_fire')` |
| afterAttack | `withdraw` | `useGameEvents.ts:526-536` → `Board.tsx:451-456` → `useEventCardModes.ts:405-417,649-663` | **看不见**。本地先选费用再选位置。 | `multistep-choice`：① `costType` ② `targetPosition` | `ACTIVATE_ABILITY('withdraw')` |
| afterMove | `spirit_bond` | `useGameEvents.ts:579-589` + `useCellInteraction.ts:606-619` | **看不见**。AI 也无法补全 `choice`。 | `multistep-choice`：① self / transfer ② 若 transfer 再选友军 | `ACTIVATE_ABILITY('spirit_bond')` |
| afterMove | `structure_shift` | `useGameEvents.ts:591-603` + `useCellInteraction.ts:611-619,681-704` | **看不见**。 | `multistep-choice`：①选建筑 ②选新位置 | `ACTIVATE_ABILITY('structure_shift')` |
| afterMove | `frost_axe` | `useGameEvents.ts:605-617` + `useCellInteraction.ts:620-627` | **看不见**。AI 也无法补全 `choice`。 | `multistep-choice`：① self / attach ② 若 attach 再选目标士兵 | `ACTIVATE_ABILITY('frost_axe')` |
| afterMove | `ancestral_bond` | `useGameEvents.ts:564-575` + `useCellInteraction.ts:598-605` | **半可见**。AI 可绕过 prompt 直发 `ACTIVATE_ABILITY(targetPosition)`，但**看不见同一条 afterMove prompt**。 | `simple-choice`：选 3 格内友军或 skip | `ACTIVATE_ABILITY('ancestral_bond')` |
| onPhaseStart | `illusion` | `useGameEvents.ts:539-549` + `useCellInteraction.ts:594-598` | **看不见**。 | `simple-choice`：选 3 格内士兵 | `ACTIVATE_ABILITY('illusion')` |
| onPhaseStart | `blood_rune` | `useGameEvents.ts:552-561` + `Board.tsx:773-781` | **看不见**，且是**强制收口链**。 | `simple-choice`：`damage` / `charge`，无 cancel | `ACTIVATE_ABILITY('blood_rune')` |
| 主动按钮 | `revive_undead` | `useCellInteraction.ts:741-750` + `Board.tsx:1234-1273` | **看不见**。`ai.ts:1173-1300` 没有 `targetSelection.type='card'` 扩展。 | `multistep-choice`：①弃牌堆选卡 ②选召唤位置 | `ACTIVATE_ABILITY('revive_undead')` |
| 主动按钮 | `fortress_power` | `Board.tsx:1234-1267` | **看不见**。同样缺少 card 目标分支。 | `simple-choice`（弃牌堆单选卡）或 `multistep-choice`（若后续要加更多约束） | `ACTIVATE_ABILITY('fortress_power')` |
| 主动按钮 | `telekinesis_instead` | `useCellInteraction.ts:653-668` → `useEventCardModes.ts:560-569` | **伪可见**。AI 会生成只带 `targetPosition` 的 `ACTIVATE_ABILITY`，但执行器还需要 `moveRow/moveCol`，可能变成半截命令。 | `multistep-choice`：①选目标 ②选终点/方向 | `ACTIVATE_ABILITY('telekinesis_instead')` |
| 主动按钮 | `high_telekinesis_instead` | `useCellInteraction.ts:640-652` → `useEventCardModes.ts:560-569` | **伪可见**。同上。 | `multistep-choice`：①选目标 ②选终点/方向 | `ACTIVATE_ABILITY('high_telekinesis_instead')` |
| 召唤 | `fire_sacrifice_summon` | `useCellInteraction.ts:125,295-316,758-770,1009-1026` + `validate.ts:256-283` | **看不见**。AI 的 `buildSummonActions()` 不会补 `sacrificeUnitId`，因此根本不会拿到合法召唤动作。 | `multistep-choice`：①选牺牲品单位；确认后把其位置当 summon position | `SUMMON_UNIT`（带 `cardId + sacrificeUnitId + position=sacrifice.position`） |
| 事件后续 | `ice_ram_trigger` | `useGameEvents.ts:620-636` + `useCellInteraction.ts:560-584,706-720` | **看不见**。事件卡主链已迁移，但这个后续仍是本地 mode。 | `multistep-choice`：①选建筑相邻目标 ②选推拉终点/或 skipPush | `ACTIVATE_ABILITY('ice_ram')` |

---

## 二、每条交互的建议映射（细化）

### A. 应 resolve 到 `DECLARE_ATTACK`
这些交互本质上不是“单独发动技能”，而是**攻击声明的一部分**：

1. `life_drain`
   - 建议事件：`BEFORE_ATTACK_INTERACTION_REQUESTED`
   - 交互：`simple-choice`
   - option value：
     - `{ kind: 'beforeAttack', abilityId: 'life_drain', targetUnitId }`
     - `{ skip: true }`
   - resolve：
     - `DECLARE_ATTACK({ attacker, target, beforeAttack: { abilityId:'life_drain', targetUnitId } })`
     - skip 时直接 `DECLARE_ATTACK({ attacker, target })`

2. `holy_arrow`
   - 建议事件：`BEFORE_ATTACK_INTERACTION_REQUESTED`
   - 交互：`simple-choice` + `multi(min=0)`
   - option value：`{ discardCardId }`
   - resolve：
     - `DECLARE_ATTACK({ ..., beforeAttack: { abilityId:'holy_arrow', discardCardIds } })`
     - 空选直接攻击

3. `healing`
   - 建议事件：`BEFORE_ATTACK_INTERACTION_REQUESTED`
   - 交互：`simple-choice` 或 `multi(min=0,max=1)`
   - option value：`{ targetCardId }`
   - resolve：
     - `DECLARE_ATTACK({ ..., beforeAttack: { abilityId:'healing', targetCardId } })`
     - 空选直接攻击

### B. 应 resolve 到 `ACTIVATE_ABILITY`
这些交互是“先进入 prompt，确认后再发能力命令”：

- `telekinesis` / `high_telekinesis` / `telekinesis_instead` / `high_telekinesis_instead`
  - 推荐 `multistep-choice`
  - step1：`targetPosition`
  - step2：`moveRow/moveCol` 或直接编码成 destination option value
  - resolve：`ACTIVATE_ABILITY`

- `mind_transmission`
  - 推荐 `simple-choice`
  - 单步选友方士兵
  - resolve：`ACTIVATE_ABILITY`

- `rapid_fire`
  - 推荐 `simple-choice(button)`
  - confirm / skip
  - resolve：confirm 才发 `ACTIVATE_ABILITY`

- `withdraw`
  - 推荐 `multistep-choice`
  - step1：`costType`
  - step2：`targetPosition`
  - resolve：`ACTIVATE_ABILITY`

- `spirit_bond`
  - 推荐 `multistep-choice`
  - step1：`choice=self|transfer`
  - step2：transfer 时选 `targetPosition`
  - resolve：`ACTIVATE_ABILITY`

- `ancestral_bond`
  - 推荐 `simple-choice`
  - 单步选 3 格内友军，另加 skip
  - resolve：`ACTIVATE_ABILITY`

- `structure_shift`
  - 推荐 `multistep-choice`
  - step1：选建筑
  - step2：选新位置
  - resolve：`ACTIVATE_ABILITY`

- `frost_axe`
  - 推荐 `multistep-choice`
  - step1：`choice=self|attach`
  - step2：attach 时选士兵
  - resolve：`ACTIVATE_ABILITY`

- `illusion`
  - 推荐 `simple-choice`
  - 单步选目标士兵
  - resolve：`ACTIVATE_ABILITY`

- `blood_rune`
  - 推荐 `simple-choice(button)`
  - `damage` / `charge`
  - resolve：`ACTIVATE_ABILITY`
  - 备注：这是 phase-start 强制链，interaction 应无 cancel，只允许二选一

- `revive_undead`
  - 推荐 `multistep-choice`
  - step1：弃牌堆选 card
  - step2：选召唤位置
  - resolve：`ACTIVATE_ABILITY`

- `fortress_power`
  - 推荐 `simple-choice(card)`（只差一张弃牌卡）
  - resolve：`ACTIVATE_ABILITY`

- `ice_ram_trigger`
  - 推荐 `multistep-choice`
  - step1：选建筑相邻单位
  - step2：选推/拉终点，另加 skipPush
  - resolve：`ACTIVATE_ABILITY('ice_ram')`

### C. 应 resolve 到 `SUMMON_UNIT`
- `fire_sacrifice_summon`
  - 推荐事件：`SUMMON_INTERACTION_REQUESTED`
  - 推荐 `simple-choice`（若只差选牺牲品）或 `multistep-choice`（若未来要在 Interaction 中同时展示 hand card）
  - option value：`{ sacrificeUnitId, position }`
  - resolve：
    - `SUMMON_UNIT({ cardId, sacrificeUnitId, position })`
  - 关键点：**不要**再把“选中手牌 + 选牺牲品”只留在 `selectedHandCardId/fireSacrificeSummonMode`

---

## 三、风险 / 冲突点

### 1. AI 只认 `sys.interaction`，本地 mode 仍是双真相源
- 证据：
  - `ai.ts:976-1092` 只消费 `sys.interaction.current`
  - `useGameEvents.ts:494-636` 仍直接起本地 mode
- 风险：
  - AI、真人 UI、服务端诊断看到的是三套真相

### 2. `buildActivatedAbilityActions()` 只会扩展 `unit/position`，且默认只懂 `targetPosition`
- 证据：
  - `ai.ts:458`
  - `ai.ts:1173-1300`
- 风险：
  - `revive_undead` / `fortress_power` 这种 card 选择型能力完全不可见
  - `telekinesis_instead` / `high_telekinesis_instead` 会出现“AI 能发命令，但 payload 不完整”的伪可见问题

### 3. `buildAttackActions()` 不认识 beforeAttack 跟进交互
- 证据：
  - `ai.ts:1537-1544` 只生成裸 `DECLARE_ATTACK`
  - `useCellInteraction.ts:851-873` 在真人 UI 点击目标时才注入 `abilityMode/pendingAttackTarget`
- 风险：
  - beforeAttack 被动技能对 AI 等于不存在

### 4. refresh / reset 恢复覆盖不完整
- 证据：
  - `useGameEvents.ts:268-310` 只恢复 `illusion_copy`、`blood_rune_choice`
  - `useGameEvents.ts:338-341` reset 时会清掉 `abilityMode/afterAttackAbilityMode/rapidFireMode/withdrawTrigger`
- 风险：
  - `rapid_fire` / `withdraw` / afterMove 系列本地链路在 reset/刷新/托管切换时更容易丢失

### 5. afterMove 语义与“主动技能”语义已经分叉
- 证据：
  - `useGameEvents.ts:564-617`：afterMove 真正通过 `ABILITY_TRIGGERED(afterMove:...)` 打开本地 prompt
  - 但 `ai.ts:1173-1300`：仍会把部分 `trigger:'activated'` 能力当普通主动技能遍历
- 风险：
  - `ancestral_bond` 这类能力出现“AI 可绕过 prompt 直接发动，但不是消费同一条交互”的语义漂移
  - 后续如果再加 watchdog / retry，会更难判断到底该以“prompt”还是“直发命令”为真

### 6. 事件卡主链已迁移，但事件后的能力尾巴还残留本地链
- 典型：
  - `ice_ram_trigger`
- 风险：
  - 用户会看到“事件卡大部分已进 InteractionSystem，但某个后续尾巴还是本地 mode”
  - 这类“半迁移”最容易造成排查错觉

---

## 四、优先级建议（仅审计建议，不改实现）

### P0
- `blood_rune`
- `life_drain / holy_arrow / healing`
- `rapid_fire`
- `withdraw`
- `fire_sacrifice_summon`

理由：要么是强制链，要么直接影响攻击/召唤主流程，要么 AI 完全不可见。

### P1
- `telekinesis / high_telekinesis / mind_transmission`
- `telekinesis_instead / high_telekinesis_instead`
- `spirit_bond / structure_shift / frost_axe`
- `ice_ram_trigger`

理由：都属于多步链，且当前容易落成“本地 mode + AI 半截/不可见”。

### P2
- `illusion`
- `ancestral_bond`
- `fortress_power`

理由：要么已有局部恢复，要么 AI 还能部分绕过，但仍不满足“真人/AI 共用同一交互真相源”。

---

## 五、总裁决
- **Phase B 并未“全部迁完”**。
- 事件卡链和 Phase A 关键链已经大幅进入 `InteractionSystem`，但**攻击前 / 攻击后 / 移动后 / 阶段开始 / 主动按钮 / 特殊召唤** 仍有一整批本地 mode。
- 如果要满足 OpenSpec 里的目标“AI、真人 UI 与服务端诊断都以同一交互状态为真相源”，上表这些链路仍需要继续迁移。
