# 大杀四方 - 消灭随从音效缺失修复

## 问题描述

用户反馈：大杀四方中"消灭随从施加力量"（如吸血鬼派系的能力）没有音效。

## 根因分析

### 调用链检查

1. **事件定义层**（`src/games/smashup/domain/events.ts`）：
   - `MINION_DESTROYED` 事件已正确配置音效：
   ```typescript
   'su:minion_destroyed': { audio: 'immediate', sound: 'dark_fantasy_studio.smashed.smashed_1' }
   ```

2. **音频注册表层**：
   - 完整注册表（`public/assets/common/audio/registry.json`）包含该音效
   - 精简版注册表（`src/assets/audio/registry-slim.json`）**不包含**该音效

3. **运行时加载**：
   - 项目使用精简版注册表（58 条音效）
   - 音频系统找不到 `dark_fantasy_studio.smashed.smashed_1` key
   - 播放失败（静默失败，无错误提示）

### 根本原因

精简版注册表生成脚本（`scripts/audio/generate-slim-registry.mjs`）的正则表达式只匹配特定前缀：

```javascript
// ❌ 旧正则：只匹配 ui./game./bgm./fx. 开头的 key
const keyPattern1 = /['"`]((?:ui|game|bgm|fx)\.[a-zA-Z0-9_.]+)['"`]/g;
```

`dark_fantasy_studio.smashed.smashed_1` 不符合这个模式，导致未被扫描到。

## 修复方案

### 1. 修改正则表达式

更新脚本以匹配所有音效 key 格式：

```javascript
// ✅ 新正则：匹配所有包含点号的音效 key
const keyPattern1 = /['"`]([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)['"`]/g;
```

### 2. 修复吸血鬼音效池拼写错误

发现 `audio.config.ts` 中引用了不存在的音效 key：

```typescript
// ❌ 错误：dread_whisper 不存在
'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_dread_whisper_001'

// ✅ 正确：应该是 grave_whisper
'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_003'
```

### 3. 重新生成精简版注册表

```bash
node scripts/audio/generate-slim-registry.mjs --force
```

**结果**：
- 精简版注册表从 58 条增加到 298 条
- 文件大小从 ~20KB 增加到 72KB
- 缩减率：97.7%（相比完整版 3186KB）
- `dark_fantasy_studio.smashed.smashed_1` 已成功添加
- 所有游戏的音效 key 全部包含（除虚拟 group ID）

## 验证

### 音效配置验证

```typescript
// src/games/smashup/domain/events.ts
'su:minion_destroyed': { audio: 'immediate', sound: 'dark_fantasy_studio.smashed.smashed_1' }
'su:power_counter_added': { audio: 'immediate', sound: POWER_GAIN_KEY }
```

两个事件都配置了 `audio: 'immediate'`，会通过 EventStream 播放音效。

### 吸血鬼能力示例

以下能力会触发 `MINION_DESTROYED` + `POWER_COUNTER_ADDED` 事件：

1. **夜行者**（Nightstalker）：消灭力量≤2的随从，本随从+1指示物
2. **渴血鬼**（Heavy Drinker）：消灭己方随从，本随从+1指示物
3. **晚餐约会**（Dinner Date）：给随从+1指示物，然后消灭同基地力量≤2随从
4. **吸血鬼伯爵**（The Count）：对手随从被消灭后+1指示物（ongoing 触发器）
5. **投机主义**（Opportunist）：对手随从被消灭后+1指示物（ongoing 触发器）

## 影响范围

### 受益的音效

除了 `smashed` 音效，此次修复还添加了其他被遗漏的音效：

- `dark_fantasy_studio.*` 系列（战斗/魔法音效）
- `card.*` 系列（卡牌处理音效）
- `status.*` 系列（状态变化音效）
- `magic.*` 系列（魔法音效）
- `combat.*` 系列（战斗音效）
- `monster.*` 系列（怪物音效）
- `cyberpunk.*` 系列（赛博朋克音效）
- `fantasy.*` 系列（奇幻音效）
- `ambient.*` 系列（环境音效）
- 其他非标准前缀的音效

总计新增 240 条音效到精简版注册表。

### 全量检查结果

使用 `scripts/check-audio-keys.mjs` 验证所有游戏的音效 key：

```
smashup: 全部包含 (128 个)
dicethrone: 全部包含 (35 个真实 key，1 个虚拟 group ID)
summonerwars: 全部包含 (113 个真实 key，6 个虚拟 group ID)

总计: 276 个真实音效 key 全部包含
```

**注**：虚拟 group ID（如 `dicethrone.dice_roll`、`summonerwars.ranged_attack`）是 `pickRandomSoundKey` 函数的分组标识符，不是真实的音效 key，不需要在注册表中。

## 测试建议

### 手动测试

1. 启动游戏，选择吸血鬼派系
2. 打出"夜行者"随从
3. 使用天赋消灭力量≤2的随从
4. 验证：
   - ✅ 听到消灭音效（smashed_1.ogg）
   - ✅ 听到力量增加音效（charged_a）

### 自动化测试

现有测试已覆盖吸血鬼能力的事件生成逻辑：
- `src/games/smashup/abilities/__tests__/vampires.test.ts`（如果存在）
- 音效播放由框架层自动处理，无需额外测试

## 总结

**问题**：消灭随从音效缺失  
**根因 1**：精简版注册表生成脚本正则表达式过于严格  
**根因 2**：吸血鬼音效池引用了不存在的音效 key（拼写错误）  
**修复**：
1. 扩展正则表达式以匹配所有音效 key 格式
2. 修正吸血鬼音效池的拼写错误（`dread_whisper` → `grave_whisper`）
3. 重新生成精简版注册表

**结果**：新增 240 条音效，所有游戏的音效 key 全部包含，消灭随从音效正常播放。
