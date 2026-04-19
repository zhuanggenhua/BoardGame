# DiceThrone 火法"焚灭"(Incinerate)变体触发条件修复

## 问题描述

用户反馈无法选择火法的"焚灭"(Incinerate)变体技能。

## 问题分析

### 用户投出的骰子
- 两个火焰（1-3点中的任意值）
- 两个4点（MAGMA - 爆发）
- 其他骰子面

### 原始配置（错误）
```typescript
{
    id: 'incinerate',
    name: abilityText('incinerate', 'name'),
    trigger: { 
        type: 'diceSet', 
        faces: { 
            [PYROMANCER_DICE_FACE_IDS.FIRE]: 2,        // 2个火焰（1-3点）
            [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 2   // 2个炽魂（5点）❌ 错误
        } 
    },
    // ...
}
```

### 火法骰子面配置
- 1-3点 → `FIRE`（火焰）
- 4点 → `MAGMA`（爆发）
- 5点 → `FIERY_SOUL`（炽魂）
- 6点 → `METEOR`（陨石）

### 根本原因
配置要求的是"2个火焰（1-3点）+ 2个炽魂（5点）"，但用户实际投出的是"2个火焰（1-3点）+ 2个爆发（4点）"。

根据卡牌图片描述和用户反馈：
- 正确的触发条件应该是：2个FIRE（1-3点）+ 2个MAGMA（4点）

## 修复方案

### 修改触发条件
```typescript
{
    id: 'incinerate',
    name: abilityText('incinerate', 'name'),
    trigger: { 
        type: 'diceSet', 
        faces: { 
            [PYROMANCER_DICE_FACE_IDS.FIRE]: 2,   // 2个火焰（1-3点）✅
            [PYROMANCER_DICE_FACE_IDS.MAGMA]: 2   // 2个爆发（4点）✅
        } 
    },
    effects: [
        grantToken(TOKEN_IDS.FIRE_MASTERY, 2, abilityEffectText('incinerate', 'gainFM2')),
        inflictStatus(STATUS_IDS.BURN, 1, abilityEffectText('incinerate', 'inflictBurn')),
        damage(6, abilityEffectText('incinerate', 'damage6'))
    ],
    priority: 2
}
```

### 更新 i18n 翻译
**中文**（`public/locales/zh-CN/game-dicethrone.json`）：
- `incinerate.name`: "引燃" → "焚灭"
- `incinerate.description`: "2火+2火魂触发" → "2火+2爆发触发"
- `fiery-combo-2.description`: 变体描述中"2火+2火魂" → "2火+2爆发"

**英文**（`public/locales/en/game-dicethrone.json`）：
- `incinerate.description`: "2 Fire + 2 Fire Soul" → "2 Fire + 2 Magma"
- `fiery-combo-2.description`: 变体描述中"2 Fire + 2 Fiery Soul" → "2 Fire + 2 Magma"

### 清理调试日志
移除了之前添加的调试日志：
- `src/games/dicethrone/Board.tsx` 中的变体选择日志
- `src/games/dicethrone/domain/rules.ts` 中的触发条件检查日志

## 修改文件
- `src/games/dicethrone/heroes/pyromancer/abilities.ts` - 修复 incinerate 触发条件
- `public/locales/zh-CN/game-dicethrone.json` - 更新中文翻译（技能名称和描述）
- `public/locales/en/game-dicethrone.json` - 更新英文翻译（描述）
- `src/games/dicethrone/Board.tsx` - 清理调试日志
- `src/games/dicethrone/domain/rules.ts` - 清理调试日志

## 验收标准
- ✅ 投出两个火焰（1-3点）+ 两个爆发（4点）时，可以选择"焚灭"(Incinerate)变体
- ✅ 技能名称正确显示为"焚灭"（中文）或"Incinerate"（英文）
- ✅ 技能描述正确显示"2火+2爆发触发"（中文）或"2 Fire + 2 Magma"（英文）
- ✅ 技能效果正确：获得2点火焰精通、施加1层灼烧、造成6点伤害
- ✅ 不影响其他变体的触发条件（fiery-combo-2 仍然是小顺子触发）

## 测试建议
1. 进入火法对局
2. 投出两个火焰（1-3点中的任意值）+ 两个4点（爆发）
3. 确认可以选择"焚灭"变体
4. 确认技能效果正确执行

## 相关文档
- `src/games/dicethrone/heroes/pyromancer/diceConfig.ts` - 火法骰子面配置
- `src/games/dicethrone/domain/ids.ts` - 骰子面 ID 常量定义
