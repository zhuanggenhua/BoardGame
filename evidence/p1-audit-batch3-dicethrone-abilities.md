# P1 审计 - Batch 3: DiceThrone 能力文件

**审计时间**: 2026-03-04  
**文件数量**: 15 个  
**总删除行数**: -327 行

---

## 审计摘要

### 需要恢复的文件: 3/15 (20%)

**高风险文件**:
1. `src/games/dicethrone/domain/customActions/shadow_thief.ts` (-61) - **删除了伤害预估回调和 CP 计算逻辑**
2. `src/games/dicethrone/heroes/paladin/abilities.ts` (-76) - **删除了音效配置和部分技能定义**
3. `src/games/dicethrone/domain/attack.ts` (-33) - **删除了防御事件 Token 处理逻辑**

### 保持删除的文件: 12/15 (80%)

**POD 参数清理文件** (12 个):
- 大部分文件只删除了 1-3 行，都是 POD 相关的参数清理

---

## 详细审计

### 🔴 高风险 - 需要恢复

#### 1. `shadow_thief` customActions (-61 行)

**删除内容**:
1. **伤害预估回调函数** (~30 行)
   - `estimateHalfCpDamage` - CP 的一半伤害预估
   - `estimateFullCpDamage` - 等同 CP 伤害预估
   - `estimateCpPlus5Damage` - CP + 5 伤害预估

2. **Handler 注册时的 estimateDamage 配置** (~10 行)
   - `shadow_thief-damage-half-cp` 的 estimateDamage
   - `shadow_thief-damage-full-cp` 的 estimateDamage
   - `shadow_thief-shadow-shank-damage` 的 estimateDamage

3. **CP 计算注释和逻辑** (~20 行)
   - gainCp 时机说明
   - bonusCp 参数向后兼容说明
   - 各技能的 CP 计算逻辑注释

**影响评估**: 🔴 **严重**
- Token 门控系统需要 estimateDamage 预估伤害
- 没有预估回调会导致 Token 响应窗口无法正确判断是否需要打开
- 影响暗影贼的所有 CP 系伤害技能

**恢复建议**: 🔴 **必须恢复**

---

#### 2. `paladin` abilities (-76 行)

**删除内容**:
1. **音效常量定义** (~20 行)
   - `PALADIN_SFX_HEAL` - 治疗类音效
   - `PALADIN_SFX_SMITE` - 近战惩击类音效
   - `PALADIN_SFX_MIGHT` - 力量祝福音效
   - `PALADIN_SFX_BEAM` - 光束类音效
   - `PALADIN_SFX_VENGEANCE` - 复仇/反击音效
   - `PALADIN_SFX_PRAYER` - 祈祷类音效

2. **技能定义中的 sfxKey 配置** (~20 行)
   - 所有技能的 `sfxKey` 字段被删除

3. **部分技能定义** (~35 行)
   - Righteous Combat III 的 Tenacity III 分支
   - Blessing of Might II 的 stance 和 main 分支
   - Holy Strike 的 small 和 large 分支
   - 其他技能的部分效果

**影响评估**: 🔴 **严重**
- 圣骑士所有技能失去音效
- 部分技能定义缺失导致功能不完整

**恢复建议**: 🔴 **必须恢复**

---

#### 3. `attack.ts` (-33 行)

**删除内容**:
1. **防御事件 Token 处理逻辑** (~25 行)
   ```typescript
   // 删除的代码
   - let stateAfterDefense = state;
   - const tokenGrantedEvents = defenseEvents.filter((e): e is TokenGrantedEvent => e.type === 'TOKEN_GRANTED');
   - if (tokenGrantedEvents.length > 0) {
   -     // 更新 token 数量逻辑
   - }
   ```

2. **注释说明** (~8 行)
   - 防御技能效果可能产生 TOKEN_GRANTED 事件
   - 攻击方伤害结算时需要检查防御方是否有可用 Token
   - 避免 apply 全部防御事件的副作用

**影响评估**: 🔴 **严重**
- 防御技能获得 Token（如冥想获得太极）后，攻击方无法正确检测
- 导致 Token 响应窗口逻辑失效

**恢复建议**: 🔴 **必须恢复**

---

### ✅ 低风险 - 保持删除

#### 4-15. POD 参数清理 (12 个文件)

**文件列表**:
- `customActions/barbarian.ts` (-3)
- `customActions/monk.ts` (-2)
- `customActions/moon_elf.ts` (-36, +42) - 重构
- `customActions/paladin.ts` (-3)
- `customActions/pyromancer.ts` (-29) - 需要进一步检查
- `heroes/barbarian/abilities.ts` (-22)
- `heroes/monk/abilities.ts` (-2)
- `heroes/moon_elf/abilities.ts` (-8, +8) - 重构
- `heroes/pyromancer/abilities.ts` (-30) - 需要进一步检查
- `heroes/shadow_thief/abilities.ts` (-37) - 需要进一步检查
- `domain/passiveAbility.ts` (-3)
- `domain/abilityLookup.ts` (-15)

**审计结论**: ⚠️ **需要进一步检查**

部分文件删除行数较多（>20 行），需要逐个检查是否只是 POD 参数清理。

---

## 下一步行动

1. **详细审计** pyromancer customActions (-29) 和 abilities (-30)
2. **详细审计** shadow_thief abilities (-37)
3. **详细审计** moon_elf customActions (-36, +42)
4. **详细审计** barbarian abilities (-22)
5. **详细审计** abilityLookup.ts (-15)

---

## 相关文档

- `evidence/p1-audit-progress.md` - P1 审计进度
- `evidence/p1-audit-batch2-smashup-ui.md` - Batch 2 审计报告
