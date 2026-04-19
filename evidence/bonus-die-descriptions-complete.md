# 投骰子特效描述全面审计完成

## 审计结果

已完成对所有 `BONUS_DIE_ROLLED` 事件的特效描述审计，共检查 **16 个**投骰子事件。

## 修复内容

### ✅ 已修复：看箭（Watch Out）

**问题**：投掷骰子时只显示 `"看箭投掷：3"`，没有显示效果。

**修复**：使用动态 effectKey，根据投掷结果显示不同描述：
- 弓面：`弓🏹：伤害+2`
- 足面：`足🦶：施加缠绕`
- 月面：`月🌙：施加致盲`

**修改文件**：
- `src/games/dicethrone/domain/customActions/moon_elf.ts`
- `public/locales/zh-CN/game-dicethrone.json`
- `public/locales/en/game-dicethrone.json`

### ✅ 已修复：爆裂箭（Exploding Arrow）I/II/III

**问题**：投掷5骰时只显示最终伤害，没有显示计算公式。

**修复**：显示完整计算公式：
- I级：`2弓 1足 1月：3 + 2×2 + 1×1 = 8伤害`
- II级：`2弓 1足 1月：3 + 1×2 + 2×1 = 7伤害`
- III级：`2弓 1足 1月：3 + 1×2 + 2×1 = 7伤害`

**修改文件**：
- `src/games/dicethrone/domain/customActions/moon_elf.ts`（effectKey 更新）
- `public/locales/zh-CN/game-dicethrone.json`（添加公式）
- `public/locales/en/game-dicethrone.json`（添加公式）

## 审计发现：所有其他投骰子都正确

### ✅ 狂战士（Barbarian）

1. **压制（Suppress）**：`压制投掷：{{value}}`
2. **幸运投掷（Lucky Roll）**：`幸运投掷：{{value}}`
3. **再来一次（More Please）**：`再来投掷：{{value}}`

### ✅ 武僧（Monk）

1. **一掷千金（One Throw Fortune）**：`获得 {{cp}} CP`

### ✅ 月精灵（Moon Elf）

1. **爆裂箭 I**：✅ 已修复
2. **爆裂箭 II**：✅ 已修复
3. **爆裂箭 III**：✅ 已修复
4. **月影袭人（Moon Shadow Strike）**：动态 effectKey
   - 月面：`月🌙：施加致盲、缠绕、锁定`
   - 其他：`抽1张牌`
5. **万箭齐发（Volley）**：
   - 投掷：`万箭齐发投掷：{{value}}`
   - 结果：`{{bowCount}}个弓面：伤害+{{bonusDamage}}`
6. **看箭（Watch Out）**：✅ 已修复

### ✅ 暗影贼（Shadow Thief）

1. **暗影之舞（Shadow Dance）**：`暗影之舞`
2. **偷袭（Sneak Attack）**：`偷袭！`

### ✅ 火法师（Pyromancer）

所有火法师的投骰子都有正确的特效描述（炎爆术、烈焰精通等）。

### ✅ 圣骑士（Paladin）

所有圣骑士的投骰子都有正确的特效描述（赦免、神恩、圣光等）。

## 特效描述设计模式

### 模式 1：简单投掷（只显示骰值）

适用于：效果固定，不需要根据骰面变化

```json
"barbarianSuppress": "压制投掷：{{value}}"
```

### 模式 2：动态描述（根据骰面变化）

适用于：不同骰面有不同效果

```typescript
let effectKey = 'bonusDie.effect.watchOut';
if (face === FACE.BOW) {
    effectKey = 'bonusDie.effect.watchOut.bow';
} else if (face === FACE.FOOT) {
    effectKey = 'bonusDie.effect.watchOut.foot';
} else if (face === FACE.MOON) {
    effectKey = 'bonusDie.effect.watchOut.moon';
}
```

```json
"watchOut.bow": "弓🏹：伤害+2",
"watchOut.foot": "足🦶：施加缠绕",
"watchOut.moon": "月🌙：施加致盲"
```

### 模式 3：统计结果（显示计算过程）

适用于：投掷多骰，需要统计不同骰面数量

```json
"explodingArrow.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月：3 + 2×{{bowCount}} + 1×{{footCount}} = {{damage}}伤害"
```

## 测试建议

1. 进入游戏选择月精灵（Moon Elf）
2. 测试以下卡牌/技能：
   - 爆裂箭 I/II/III：查看5骰投掷后的公式显示
   - 看箭：查看不同骰面的效果描述
   - 万箭齐发：查看5骰统计结果
3. 确认所有特效描述清晰易懂

## 总结

所有投骰子的特效描述已全面审计完成。主要修复了：
1. ✅ 看箭：添加动态效果描述
2. ✅ 爆裂箭 I/II/III：添加完整计算公式

其他所有投骰子事件的特效描述都已正确实现，无需修改。

## 相关文件

- `src/games/dicethrone/domain/customActions/moon_elf.ts`
- `public/locales/zh-CN/game-dicethrone.json`
- `public/locales/en/game-dicethrone.json`
- `scripts/audit-bonus-die-descriptions.mjs`（审计脚本）
- `evidence/watch-out-display-fix.md`（看箭修复详情）
- `evidence/exploding-arrow-fix-complete.md`（爆裂箭修复详情）
