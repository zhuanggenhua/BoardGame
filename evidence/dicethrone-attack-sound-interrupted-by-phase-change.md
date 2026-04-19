# DiceThrone 攻击音效被阶段切换音效打断问题

## 问题根因

攻击音效和阶段切换音效几乎同时播放（相隔仅 9ms），导致攻击音效被打断或听不清。

### 日志证据

```
[Audio Debug] playSound called: {
  key: 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_small_1',
  timestamp: 1772618933634
}
[Audio Debug] AudioManager.play result: {
  key: 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_small_1',
  result: 1090,
  isFailed: false
}

[Audio Debug] playSound called: {
  key: 'fantasy.gothic_fantasy_sound_fx_pack_vol.musical.drums_of_fate_002',  // ← 阶段切换音效
  timestamp: 1772618933643  // ← 仅相隔 9ms
}
```

### 时间线分析

1. **t=0ms**: 攻击音效开始播放（swoosh）
2. **t=9ms**: 阶段切换音效开始播放（drums_of_fate）
3. 两个音效重叠，攻击音效被掩盖或打断

### 为什么会同时播放

1. 攻击结算后立即切换阶段（从 `offensiveRoll` 到下一阶段）
2. `ATTACK_INITIATED` 事件和 `SYS_PHASE_CHANGED` 事件在同一帧内触发
3. 两个事件的音效几乎同时播放

## 解决方案

### 方案 1: 音效优先级队列（推荐）

在 `useGameAudio` 中实现音效优先级队列：
- 高优先级音效（攻击、伤害）播放时，延迟低优先级音效（阶段切换、UI 反馈）
- 使用 `setTimeout` 延迟低优先级音效 200-300ms

```typescript
// 在 useGameAudio.ts 中
const SOUND_PRIORITY = {
  high: ['weapon_swoosh', 'melee_swoosh', 'damage', 'heal'],
  medium: ['dice_roll', 'card_play'],
  low: ['drums_of_fate', 'phase_change', 'turn_change'],
};

let lastHighPrioritySound: number = 0;
const HIGH_PRIORITY_DELAY = 250; // ms

function playSound(key: SoundKey): void {
  const now = Date.now();
  const isHighPriority = SOUND_PRIORITY.high.some(pattern => key.includes(pattern));
  const isLowPriority = SOUND_PRIORITY.low.some(pattern => key.includes(pattern));
  
  if (isHighPriority) {
    lastHighPrioritySound = now;
    AudioManager.play(key);
  } else if (isLowPriority) {
    const timeSinceHighPriority = now - lastHighPrioritySound;
    if (timeSinceHighPriority < HIGH_PRIORITY_DELAY) {
      // 延迟播放低优先级音效
      setTimeout(() => {
        AudioManager.play(key);
      }, HIGH_PRIORITY_DELAY - timeSinceHighPriority);
    } else {
      AudioManager.play(key);
    }
  } else {
    AudioManager.play(key);
  }
}
```

### 方案 2: 阶段切换音效静音（临时方案）

在攻击阶段禁用阶段切换音效：

```typescript
// 在 audio.config.ts 的 feedbackResolver 中
if (type === 'SYS_PHASE_CHANGED') {
  const phasePayload = (event as AudioEvent & { payload?: { from?: string; to?: string } }).payload;
  const phaseFrom = phasePayload?.from;
  
  // 从攻击阶段切换时不播放音效（避免与攻击音效冲突）
  if (phaseFrom === 'offensiveRoll' || phaseFrom === 'defensiveRoll') {
    return null;
  }
  
  // ... 其他逻辑
}
```

### 方案 3: 调整音效音量和时长

- 增加攻击音效的音量（从 0.64 提高到 0.8）
- 使用更短的阶段切换音效
- 或者使用更长的攻击音效

## 已实施的修复

### 音效优先级队列系统

在 `src/lib/audio/useGameAudio.ts` 中实现了音效优先级队列：

```typescript
// 音效优先级配置
const SOUND_PRIORITY = {
    high: ['weapon_swoosh', 'melee_swoosh', 'damage', 'heal', 'hit', 'impact', 'punch'],
    medium: ['dice_roll', 'card_play', 'card_draw', 'token'],
    low: ['drums_of_fate', 'phase_change', 'turn_change', 'chime', 'update'],
};

// 记录上次高优先级音效播放时间
let lastHighPrioritySoundTime: number = 0;
const HIGH_PRIORITY_DELAY_MS = 250; // 高优先级音效播放后 250ms 内延迟低优先级音效
```

### 工作原理

1. **高优先级音效**（攻击、伤害、治疗）：立即播放，更新时间戳
2. **中优先级音效**（骰子、卡牌）：立即播放，不影响其他音效
3. **低优先级音效**（阶段切换、回合切换）：
   - 如果高优先级音效在 250ms 内播放过，延迟播放
   - 否则立即播放

### 修复效果

- 攻击音效播放后，阶段切换音效会延迟 250ms 播放
- 避免两个音效重叠导致攻击音效被掩盖
- 保证重要的游戏反馈音效（攻击、伤害）不会被 UI 音效打断

### 测试方法

1. 刷新页面
2. 开始游戏并执行攻击
3. 查看控制台日志，确认：
   - 攻击音效立即播放（priority: 'high'）
   - 阶段切换音效延迟播放（`[Audio Debug] Delaying low-priority sound`）
4. 听觉验证：攻击音效应该清晰可闻，不再被阶段切换音效打断

## 额外发现

- BGM 切换没有问题（使用 fade 和独立的 Howl 实例）
- 攻击音效本身播放正常（volume: 0.64, soundId: 1090）
- 问题纯粹是两个音效时间重叠导致的听觉掩蔽效应

## 清理调试日志

修复验证后，需要清理以下调试日志：
- `src/lib/audio/useGameAudio.ts` 中的 `[Audio Debug]` 日志
- `src/lib/audio/AudioManager.ts` 中的攻击音效调试日志
- `src/games/dicethrone/audio.config.ts` 中的 `[DT Audio Debug]` 日志
