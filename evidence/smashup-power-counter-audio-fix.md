# 大杀四方 - 施加力量指示物音效调试

## 问题描述

用户反馈：巨蚂蚁派系直接添加力量指示物的能力（如疯狂怪物派对）没有播放音效。

## 当前状态

已添加调试日志来定位问题。需要用户测试并提供控制台输出。

## 调试步骤

### 1. 运行游戏并触发能力

1. 创建巨蚂蚁派系对局
2. 打出"疯狂怪物派对"或其他添加力量指示物的能力
3. 打开浏览器控制台（F12）
4. 查看是否有 `[Audio Debug] POWER_COUNTER_ADDED event:` 日志

### 2. 分析日志输出

日志会显示：
- `eventType`: 事件类型（应该是 `'su:power_counter_added'`）
- `resolvedKey`: 解析出的音效 key（应该是 `'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a'`）
- `payload`: 事件数据（包含 minionUid、baseIndex、amount、reason）

### 3. 可能的问题场景

#### 场景 A：没有日志输出
- **原因**：事件没有被生成或没有进入音频处理流程
- **排查**：检查事件生成代码（`abilityHelpers.ts` 中的 `addPowerCounter`）

#### 场景 B：日志显示 `resolvedKey: null`
- **原因**：`feedbackResolver` 没有正确解析事件
- **排查**：检查 `audio.config.ts` 中的 `feedbackResolver` 和 `baseFeedbackResolver`

#### 场景 C：日志显示正确的 key 但没有音效
- **原因**：音频文件加载失败或被节流机制拦截
- **排查**：检查 `registry-slim.json` 中是否包含该音效，检查音频节流机制

#### 场景 D：日志显示正确的 key 且有音效，但音量太小
- **原因**：音效文件本身音量较低，或被其他音效掩盖
- **排查**：调整音量或使用不同的音效文件

## 已验证的配置

### 1. 事件定义正确

```typescript
// src/games/smashup/domain/events.ts
'su:power_counter_added': { 
    audio: 'immediate', 
    sound: 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a' 
}
```

### 2. 事件类型常量正确

```typescript
// src/games/smashup/domain/events.ts
export const SU_EVENT_TYPES = {
    POWER_COUNTER_ADDED: SU_EVENTS['su:power_counter_added'].type,
    // ...
}
```

### 3. 事件生成正确

```typescript
// src/games/smashup/domain/abilityHelpers.ts
export function addPowerCounter(...): PowerCounterAddedEvent {
    return {
        type: SU_EVENTS.POWER_COUNTER_ADDED,
        payload: { minionUid, baseIndex, amount, reason },
        timestamp: now,
    };
}
```

### 4. feedbackResolver 配置正确

```typescript
// src/games/smashup/audio.config.ts
const baseFeedbackResolver = createFeedbackResolver(SU_EVENTS);

feedbackResolver: (event) => {
    // ... 特殊处理 ...
    
    // 使用框架自动生成的默认音效
    return baseFeedbackResolver(event);
}
```

### 5. 音频文件存在

- 文件路径：`sfx/status/general/Player Status Sound FX Pack Vol. 3/Positive Buffs and Cures/Charged A.ogg`
- 已在 `registry-slim.json` 中注册（298 个条目）

## 修改的文件

- `src/lib/audio/useGameAudio.ts`（添加调试日志）

## 下一步

等待用户提供控制台日志输出，根据日志内容进一步定位问题。

## 相关文档

- `evidence/smashup-minion-destroyed-sound-fix.md` - 消灭随从音效修复（registry 扫描问题）
- `docs/ai-rules/engine-systems.md` - 引擎系统规范
- `src/lib/audio/useGameAudio.ts` - 音频播放机制
- `src/games/smashup/domain/events.ts` - 事件音频配置
