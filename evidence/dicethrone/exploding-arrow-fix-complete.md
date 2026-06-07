# 爆裂箭特写描述专项修复证据

> 2026-06-06 当前有效口径：本文只保留月精灵“爆裂箭特写描述/公式文案”这一条专项修复证据，不代表月精灵整英雄、DiceThrone 全体英雄，或四位新英雄整批当前已经审计完成。它的现行用途仅限说明当时如何把特写文案从“只显示结果”修到“显示计算公式”；若要判断新英雄批次当前残余，应回到 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md`、`evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 与对应单英雄主审计文档。

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
- `evidence/dicethrone/exploding-arrow-verification.md`（初步验证报告）
- `evidence/dicethrone/exploding-arrow-display-fix.md`（修复方案）

## 当前阅读说明

- 本文只覆盖“特写描述公式是否清楚”这一条专项，不覆盖技能本体实现、对象级 `L3/L4`、单英雄审计完成态或新英雄整批完成态。
- 即使本文描述的修复在当轮成立，也不能把标题里的“修复”外推成“月精灵或 DiceThrone 当前已经全面收口”。
