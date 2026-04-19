# Cardia 音效无声问题修复

## 问题根因

通过代码审查和音频注册表检查，发现 **打出卡牌音效键名错误**：

- ❌ 错误：`card.handling.decks_and_cards_sound_fx_pack.card_place_001`
- ✅ 正确：`card.handling.decks_and_cards_sound_fx_pack.card_placing_001`

音频注册表中不存在 `card_place_001`，正确的键名是 `card_placing_001`。

## 其他音效验证

| 事件 | 音效键 | 状态 |
|------|--------|------|
| `CARD_PLAYED` | `card_placing_001` | ✅ 已修复 |
| `SIGNET_GRANTED` | `small_reward_001` | ✅ 正确 |
| `GAME_WON` | `stgr_action_win` | ✅ 正确 |

## 修复内容

### 1. 修复事件定义

**文件**: `src/games/cardia/domain/events.ts`

```typescript
// 修复前
CARD_PLAYED: { 
    audio: 'immediate', 
    sound: 'card.handling.decks_and_cards_sound_fx_pack.card_place_001'  // ❌ 错误
},

// 修复后
CARD_PLAYED: { 
    audio: 'immediate', 
    sound: 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001'  // ✅ 正确
},
```

### 2. 更新预加载列表

**文件**: `src/games/cardia/audio.config.ts`

```typescript
criticalSounds: Array.from(new Set([
    ...collectPreloadKeys(CARDIA_EVENTS),
    'card.handling.decks_and_cards_sound_fx_pack.card_placing_001',  // ✅ 已修复
    'card.handling.decks_and_cards_sound_fx_pack.card_take_001',
    // ... 其他音效
])),
```

## 调试过程

### 1. 验证事件定义结构

创建了调试脚本 `scripts/debug/check-cardia-events.mjs` 验证 `defineEvents` 和 `createFeedbackResolver` 的逻辑：

```
=== CARDIA_EVENTS 结构检查 ===

CARD_PLAYED:
  - type: "CARD_PLAYED"
  - audio: "immediate"
  - sound: "card.handling.decks_and_cards_sound_fx_pack.card_place_001"
  - type === eventName: true

=== createFeedbackResolver 测试 ===

soundMap 内容:
  "CARD_PLAYED" -> "card.handling.decks_and_cards_sound_fx_pack.card_place_001"
  "SIGNET_GRANTED" -> "coins.decks_and_cards_sound_fx_pack.small_reward_001"
  "GAME_WON" -> "stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win"

事件解析测试:
  CARD_PLAYED -> ✅ card.handling.decks_and_cards_sound_fx_pack.card_place_001
  SIGNET_GRANTED -> ✅ coins.decks_and_cards_sound_fx_pack.small_reward_001
  GAME_WON -> ✅ stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win
```

**结论**: 事件定义和解析逻辑都正确，问题在于音效键名本身。

### 2. 检查音频注册表

使用 `grepSearch` 在 `src/assets/audio/registry-slim.json` 中搜索音效键：

- ❌ `card_place_001` - **未找到**
- ✅ `card_placing_001` - **找到**
- ✅ `small_reward_001` - **找到**
- ✅ `stgr_action_win` - **找到**

**结论**: `card_place_001` 不存在于音频注册表中，应该使用 `card_placing_001`。

## 验证结果

### ESLint 检查
```bash
npx eslint src/games/cardia/audio.config.ts src/games/cardia/domain/events.ts
```
- ✅ 0 errors
- ⚠️ 3 warnings (pre-existing, 与本次修改无关)

### i18n 检查
```bash
npm run i18n:check
```
- ✅ 通过
- ⚠️ 3 warnings (DiceThrone 动态键，与本次修改无关)

## 预期效果

修复后，以下音效应该能正常播放：

1. **打出卡牌** (`CARD_PLAYED`) → 播放 `card_placing_001` 音效
2. **获得印戒** (`SIGNET_GRANTED`) → 播放 `small_reward_001` 音效
3. **游戏胜利** (`GAME_WON`) → 播放 `stgr_action_win` 音效

## 文件清单

### 修改的文件
1. `src/games/cardia/domain/events.ts` - 修复 `CARD_PLAYED` 音效键名
2. `src/games/cardia/audio.config.ts` - 更新预加载列表中的音效键名

### 调试工具
- `scripts/debug/check-cardia-events.mjs` - 事件定义验证脚本

### 证据文档
- `evidence/cardia-audio-missing-sounds-fix.md` (本文档)
- `evidence/cardia-audio-debug-investigation.md` (调试指南)
- `evidence/cardia-audio-config-adjustments.md` (配置调整记录)

## 技术总结

### 问题类型
**音效键名拼写错误** - 配置中使用了不存在的音效键

### 排查方法
1. 验证事件定义结构和解析逻辑（通过调试脚本）
2. 检查音频注册表中的实际键名（通过 grepSearch）
3. 对比配置与注册表，找出不匹配的键名

### 预防措施
1. 使用 TypeScript 类型系统约束音效键（如果可能）
2. 添加音效键存在性验证脚本
3. 在开发时测试音效播放，及早发现问题

## 完成状态

- ✅ 问题根因已确定：音效键名拼写错误
- ✅ 修复已完成：更正为 `card_placing_001`
- ✅ ESLint 验证通过
- ✅ i18n 检查通过
- ✅ 其他两个音效键验证正确

所有音效配置问题已修复，用户应该能听到打出卡牌、获得印戒和游戏胜利的音效。
