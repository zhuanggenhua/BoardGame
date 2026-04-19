# 爆裂箭特写描述修复完成

## 问题描述

用户反馈："dicethrone看箭 投掷的额外骰子下面特写的描述"不清楚。

## 根本原因

投掷额外骰子时显示的特写文本只显示最终伤害数字，没有显示计算公式，导致用户无法理解伤害是如何计算的。

**修复前**：
```
2弓 1足 1月：8伤害
```

用户看不出：
1. 伤害是怎么算出来的
2. I级和II/III级的公式有什么区别

## 修复内容

### 1. 中文 i18n（`public/locales/zh-CN/game-dicethrone.json`）

```json
"explodingArrow.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月：3 + 2×{{bowCount}} + 1×{{footCount}} = {{damage}}伤害",
"explodingArrow2.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月：3 + 1×{{bowCount}} + 2×{{footCount}} = {{damage}}伤害",
"explodingArrow3.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月：3 + 1×{{bowCount}} + 2×{{footCount}} = {{damage}}伤害"
```

### 2. 英文 i18n（`public/locales/en/game-dicethrone.json`）

```json
"explodingArrow.result": "{{bowCount}}Bow {{footCount}}Foot {{moonCount}}Moon: 3 + 2×{{bowCount}} + 1×{{footCount}} = {{damage}} Damage",
"explodingArrow2.result": "{{bowCount}}Bow {{footCount}}Foot {{moonCount}}Moon: 3 + 1×{{bowCount}} + 2×{{footCount}} = {{damage}} Damage",
"explodingArrow3.result": "{{bowCount}}Bow {{footCount}}Foot {{moonCount}}Moon: 3 + 1×{{bowCount}} + 2×{{footCount}} = {{damage}} Damage"
```

### 3. 代码修改（`src/games/dicethrone/domain/customActions/moon_elf.ts`）

**爆裂箭 I**：
```typescript
effectKey: 'bonusDie.effect.explodingArrow.result',  // 保持不变
```

**爆炸射击 II**：
```typescript
effectKey: 'bonusDie.effect.explodingArrow2.result',  // 从 explodingArrow.result 改为 explodingArrow2.result
```

**爆炸射击 III**：
```typescript
effectKey: 'bonusDie.effect.explodingArrow3.result',  // 从 explodingArrow.result 改为 explodingArrow3.result
```

## 修复后效果

### 爆裂箭 I（投出 2弓 1足 1月）
```
2弓 1足 1月：3 + 2×2 + 1×1 = 8伤害
```

### 爆炸射击 II（投出 2弓 1足 1月）
```
2弓 1足 1月：3 + 1×2 + 2×1 = 7伤害
```

### 爆炸射击 III（投出 2弓 1足 1月）
```
2弓 1足 1月：3 + 1×2 + 2×1 = 7伤害
```

## 改进点

1. ✅ **显示完整计算公式**：用户可以清楚看到伤害是如何计算的
2. ✅ **区分不同等级**：I级和II/III级使用不同的文本，清楚展示公式差异
3. ✅ **可验证性**：用户可以自己验证伤害计算是否正确
4. ✅ **教学价值**：帮助玩家理解技能升级后的机制变化

## 测试建议

1. 进入游戏选择月精灵（Moon Elf）
2. 触发爆裂箭 I（1弓+3月）
3. 查看投掷5骰后的特写描述，确认显示完整公式
4. 升级到爆炸射击 II，再次触发，确认公式变化
5. 升级到爆炸射击 III，再次触发，确认公式与 II 级相同

## 相关文件

- `public/locales/zh-CN/game-dicethrone.json`
- `public/locales/en/game-dicethrone.json`
- `src/games/dicethrone/domain/customActions/moon_elf.ts`
- `evidence/exploding-arrow-verification.md`（初步验证报告）
- `evidence/exploding-arrow-display-fix.md`（修复方案）
