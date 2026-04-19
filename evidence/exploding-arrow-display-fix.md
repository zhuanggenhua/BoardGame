# 爆裂箭特写描述修复方案

## 问题确认

用户反馈："看箭 投掷的额外骰子下面特写的描述"不清楚。

### 当前问题

**当前特写文本**（`public/locales/zh-CN/game-dicethrone.json`）：
```json
"explodingArrow.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月：{{damage}}伤害"
```

**显示效果示例**：
- `2弓 1足 1月：8伤害`

**问题**：
1. 没有显示计算公式，用户不知道伤害是怎么算出来的
2. I级和II/III级使用相同的文本，但公式不同（I级：`3+2×弓+1×足`，II/III级：`3+1×弓+2×足`）
3. 用户无法从特写中看出升级后公式的变化

## 解决方案

### 方案 A：显示完整公式（推荐）

为不同等级使用不同的特写文本，显示完整计算过程。

**修改 i18n**：
```json
"explodingArrow.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月：3 + 2×{{bowCount}} + 1×{{footCount}} = {{damage}}伤害",
"explodingArrow2.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月：3 + 1×{{bowCount}} + 2×{{footCount}} = {{damage}}伤害",
"explodingArrow3.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月：3 + 1×{{bowCount}} + 2×{{footCount}} = {{damage}}伤害"
```

**修改代码**（`src/games/dicethrone/domain/customActions/moon_elf.ts`）：
```typescript
// handleExplodingArrowResolve1
effectKey: 'bonusDie.effect.explodingArrow.result',

// handleExplodingArrowResolve2
effectKey: 'bonusDie.effect.explodingArrow2.result',

// handleExplodingArrowResolve3
effectKey: 'bonusDie.effect.explodingArrow3.result',
```

**显示效果**：
- I级：`2弓 1足 1月：3 + 2×2 + 1×1 = 8伤害`
- II级：`2弓 1足 1月：3 + 1×2 + 2×1 = 7伤害`
- III级：`2弓 1足 1月：3 + 1×2 + 2×1 = 7伤害`

### 方案 B：简化描述（备选）

只显示关键信息，不显示完整公式。

**修改 i18n**：
```json
"explodingArrow.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月 → {{damage}}伤害",
"explodingArrow2.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月 → {{damage}}伤害 (弓×1 足×2)",
"explodingArrow3.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月 → {{damage}}伤害 (弓×1 足×2)"
```

**显示效果**：
- I级：`2弓 1足 1月 → 8伤害`
- II级：`2弓 1足 1月 → 7伤害 (弓×1 足×2)`
- III级：`2弓 1足 1月 → 7伤害 (弓×1 足×2)`

### 方案 C：分行显示（最清晰）

使用换行符分行显示，更易读。

**修改 i18n**：
```json
"explodingArrow.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月\n基础3 + 弓×2 + 足×1 = {{damage}}伤害",
"explodingArrow2.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月\n基础3 + 弓×1 + 足×2 = {{damage}}伤害",
"explodingArrow3.result": "{{bowCount}}弓 {{footCount}}足 {{moonCount}}月\n基础3 + 弓×1 + 足×2 = {{damage}}伤害"
```

**显示效果**：
```
2弓 1足 1月
基础3 + 弓×2 + 足×1 = 8伤害
```

## 推荐方案

**推荐方案 A**，原因：
1. 显示完整计算过程，用户可以验证伤害是否正确
2. 清楚展示不同等级的公式差异
3. 符合游戏教学目的（让玩家理解机制）

## 实施步骤

1. 修改 `public/locales/zh-CN/game-dicethrone.json`
2. 修改 `src/games/dicethrone/domain/customActions/moon_elf.ts` 中的 effectKey
3. 同步修改英文版 `public/locales/en/game-dicethrone.json`
4. 测试游戏中的显示效果
