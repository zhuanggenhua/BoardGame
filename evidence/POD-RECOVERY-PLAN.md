# POD 提交恢复计划

## 背景

POD 提交（6ea1f9f）只应该添加种族（Property-based Testing），但错误地删除了大量与 POD 无关的代码。用户已经完成了部分恢复工作，现在需要恢复剩余的 5 个文件。

**重要**：用户有其他改动（tmd 改动），不能直接覆盖文件，必须使用 `strReplace` 逐行恢复。

---

## 需要恢复的文件清单

### 1. `src/games/dicethrone/domain/customActions/pyromancer.ts`

#### 需要恢复的内容：

1. **恢复 `damagePhase` 字段**（7 处）
   - 所有 `createDamageCalculation` 调用中的 `source` 对象都需要添加 `phase: ctx.damagePhase`

2. **恢复 `resolveMagmaArmor` 函数签名**
   ```typescript
   // 当前（错误）
   const resolveMagmaArmor = (ctx: CustomActionContext, _diceCount: number, dmgPerFire: number = 1): DiceThroneEvent[] => {
   
   // 应该恢复为
   const resolveMagmaArmor = (ctx: CustomActionContext, opts: { dmgPerFire?: number; checkBurn?: boolean } = {}): DiceThroneEvent[] => {
       const { dmgPerFire = 1, checkBurn = false } = opts;
   ```

3. **恢复 Magma Armor 的条件灼烧逻辑**
   - 在 `resolveMagmaArmor` 函数中，火焰精通获取之后，添加条件灼烧检查：
   ```typescript
   const magmaCount = faceCounts[PYROMANCER_DICE_FACE_IDS.MAGMA] ?? 0;
   
   // 条件灼烧（II级）：同时有 fire 和 magma 面时施加灼烧
   if (checkBurn && fireCount > 0 && magmaCount > 0) {
       const opponentId = ctx.ctx.defenderId;
       events.push({
           type: 'STATUS_APPLIED',
           payload: { targetId: opponentId, statusId: STATUS_IDS.BURN, stacks: 1, newTotal: (ctx.state.players[opponentId]?.statusEffects[STATUS_IDS.BURN] || 0) + 1, sourceAbilityId: ctx.sourceAbilityId },
           sourceCommandType: 'ABILITY_EFFECT',
           timestamp: ctx.timestamp + 0.05
       } as StatusAppliedEvent);
   }
   ```

4. **恢复注册器调用**
   ```typescript
   // 当前（错误）
   registerCustomActionHandler('burn-down-2-resolve', (ctx) => resolveBurnDown(ctx, 4, 99), { categories: ['damage', 'resource'] });
   registerCustomActionHandler('magma-armor-resolve', (ctx) => resolveMagmaArmor(ctx, 1), { categories: ['damage', 'resource', 'defense'] });
   registerCustomActionHandler('magma-armor-2-resolve', (ctx) => resolveMagmaArmor(ctx, 2), { categories: ['damage', 'resource', 'defense'] });
   
   // 应该恢复为
   registerCustomActionHandler('burn-down-2-resolve', (ctx) => resolveBurnDown(ctx, 4, 4), { categories: ['damage', 'resource'] });
   registerCustomActionHandler('magma-armor-resolve', (ctx) => resolveMagmaArmor(ctx), { categories: ['damage', 'resource', 'defense'] });
   registerCustomActionHandler('magma-armor-2-resolve', (ctx) => resolveMagmaArmor(ctx, { checkBurn: true }), { categories: ['damage', 'resource', 'defense', 'status'] });
   ```

---

### 2. `src/games/dicethrone/domain/customActions/moon_elf.ts`

#### 需要恢复的内容：

1. **恢复 `damagePhase` 字段**（1 处）
   - `dealDamage` 函数中的 `createDamageCalculation` 调用

2. **恢复 `DAMAGE_SHIELD_GRANTED` 事件**（2 处）
   - `resolveLongbow2` 函数中的护盾授予
   - `resolveLongbow3` 函数中的护盾授予

---

### 3. `src/games/dicethrone/heroes/shadow_thief/abilities.ts`

#### 需要恢复的内容：

1. **恢复音效常量**（5 个）
   ```typescript
   /** 匕首打击（标志性匕首音） */
   export const SHADOW_THIEF_SFX_DAGGER = 'combat.general.khron_studio_fight_fury_vol_1_assets.knife_stab.weapknif_knife_stab_01';
   /** 抢夺（快速匕首变体） */
   export const SHADOW_THIEF_SFX_PICKPOCKET = 'combat.general.khron_studio_fight_fury_vol_1_assets.knife_stab.weapknif_knife_stab_02';
   /** 偷窃（偷钱音效） */
   export const SHADOW_THIEF_SFX_STEAL = 'coins.decks_and_cards_sound_fx_pack.small_coin_drop_001';
   /** 破隐一击（重匕首音） */
   export const SHADOW_THIEF_SFX_KIDNEY = 'combat.general.khron_studio_fight_fury_vol_1_assets.knife_stab.weapknif_knife_stab_03';
   /** 聚宝盆（战利品音效） */
   export const SHADOW_THIEF_SFX_LOOT = 'coins.decks_and_cards_sound_fx_pack.big_coin_drop_001';
   ```

2. **恢复技能音效引用**（多处）
   - `pickpocket` 技能使用 `SHADOW_THIEF_SFX_PICKPOCKET`
   - `steal` 技能使用 `SHADOW_THIEF_SFX_STEAL`
   - `kidney-shot` 技能使用 `SHADOW_THIEF_SFX_KIDNEY`
   - 等等

3. **恢复 `stealLimit` 参数**（多处）
   - `steal` 技能变体中的 `stealLimit: 1`
   - `steal-2` 技能变体中的 `stealLimit: 2`

4. **恢复 `bonusCp` 参数**（多处）
   - `pickpocket` 技能中的 `params: { bonusCp: 3 }`
   - `kidney-shot` 技能中的 `params: { bonusCp: 4 }`
   - 等等

---

### 4. `src/games/dicethrone/heroes/pyromancer/abilities.ts`

#### 需要恢复的内容：

1. **恢复 `soul-burn-5` 技能变体**
   ```typescript
   {
       // 5火魂：基本效果 + 施加灼烧 + 火焰精通堆叠上限+1（递增叠加）
       id: 'soul-burn-5',
       name: abilityText('soul-burn-5', 'name'),
       trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 5 } },
       effects: [
           {
               description: abilityEffectText('soul-burn-5', 'increaseLimit'),
               action: { type: 'custom', target: 'self', customActionId: 'increase-fm-limit' }
           },
           {
               description: abilityEffectText('soul-burn-5', 'fm'),
               action: { type: 'custom', target: 'self', customActionId: 'soul-burn-2-fm' }
           },
           inflictStatus(STATUS_IDS.BURN, 1, abilityEffectText('soul-burn-5', 'inflictBurn')),
           {
               description: abilityEffectText('soul-burn-5', 'damage'),
               action: { type: 'custom', target: 'opponent', customActionId: 'soul-burn-damage' }
           }
       ],
       priority: 3
   }
   ```

2. **恢复变体 `name` 字段**（4 处）
   - `soul-burn-2` 变体
   - `soul-burn-3` 变体
   - `blazing-soul` 变体
   - 等等

3. **恢复 `blazing-soul` 的 `priority`**
   - 从 `priority: 3` 改回 `priority: 4`

---

### 5. `src/engine/hooks/useEventStreamCursor.ts`

#### 需要恢复的内容：

1. **恢复 `didOptimisticRollback` 字段**
   - 在 `ConsumeResult` 接口中添加
   - 在所有返回语句中添加

2. **恢复乐观引擎回滚逻辑**（约 60 行）
   - `rollback.seq` 变化检测
   - `rollback.watermark` 处理
   - `rollback.reconcileSeq` 处理

3. **恢复调试日志**（约 20 行）
   - `[CURSOR-DIAG:consume]` 日志

---

## 恢复策略

由于用户有其他改动，建议：

1. **先检查当前文件状态**
   - 使用 `git diff` 查看用户的改动
   - 确认哪些改动是用户的，哪些是 POD 错误删除的

2. **逐个文件恢复**
   - 使用 `strReplace` 精确恢复每个删除的内容
   - 保留用户的改动

3. **验证恢复结果**
   - 运行 TypeScript 编译检查
   - 运行相关测试

---

## 下一步

请确认是否需要恢复所有内容，或者只恢复部分内容。
