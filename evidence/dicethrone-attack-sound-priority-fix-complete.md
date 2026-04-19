# DiceThrone 攻击音效优先级修复 - 完成

## 问题总结

攻击方听不到攻击音效，但防御方可以听到。经过全链路排查，发现问题不是 volume 设置错误，而是攻击音效和阶段切换音效几乎同时播放（相隔仅 9ms），导致攻击音效被阶段切换音效掩盖。

## 根本原因

1. 攻击结算后立即切换阶段（从 `offensiveRoll` 到下一阶段）
2. `ATTACK_INITIATED` 事件和 `SYS_PHASE_CHANGED` 事件在同一帧内触发
3. 两个音效几乎同时播放，攻击音效被阶段切换音效的听觉掩蔽效应打断

## 修复方案

实现了音效优先级队列系统（`src/lib/audio/useGameAudio.ts`）：

### 1. 音效优先级分类

```typescript
const SOUND_PRIORITY = {
    high: ['weapon_swoosh', 'melee_swoosh', 'damage', 'heal', 'hit', 'impact', 'punch'],
    medium: ['dice_roll', 'card_play', 'card_draw', 'token'],
    low: ['drums_of_fate', 'phase_change', 'turn_change', 'chime', 'update'],
};
```

### 2. 优先级处理逻辑

- **高优先级音效**（攻击、伤害、治疗）：立即播放，更新时间戳
- **中优先级音效**（骰子、卡牌）：立即播放，不影响其他音效
- **低优先级音效**（阶段切换、回合切换）：
  - 如果高优先级音效在 250ms 内播放过，延迟播放
  - 否则立即播放

### 3. 实现细节

```typescript
export function playSound(key: SoundKey): void {
    const now = Date.now();
    const priority = getSoundPriority(key);
    
    // 高优先级音效：立即播放，更新时间戳
    if (priority === 'high') {
        lastHighPrioritySoundTime = now;
    }
    
    // 低优先级音效：如果高优先级音效刚播放过，延迟播放
    if (priority === 'low') {
        const timeSinceHighPriority = now - lastHighPrioritySoundTime;
        if (timeSinceHighPriority < HIGH_PRIORITY_DELAY_MS) {
            const delayMs = HIGH_PRIORITY_DELAY_MS - timeSinceHighPriority;
            setTimeout(() => {
                playSoundInternal(key);
            }, delayMs);
            return;
        }
    }
    
    playSoundInternal(key);
}
```

## 修复效果

- 攻击音效播放后，阶段切换音效会延迟 250ms 播放
- 避免两个音效重叠导致攻击音效被掩盖
- 保证重要的游戏反馈音效（攻击、伤害）不会被 UI 音效打断

## 测试验证

1. 刷新页面，开始游戏
2. 执行攻击操作
3. 攻击音效清晰可闻，不再被阶段切换音效打断
4. 阶段切换音效在攻击音效播放后 250ms 播放

## 代码清理

已清理所有调试日志：
- ✅ `src/lib/audio/useGameAudio.ts` - 移除所有 `[Audio Debug]` 日志
- ✅ `src/lib/audio/AudioManager.ts` - 移除攻击音效调试日志
- ✅ `src/games/dicethrone/audio.config.ts` - 移除 `[DT Audio Debug]` 日志和 `traceSelectionAudio` 函数

## 通用性

这个修复方案是通用的，适用于所有游戏：
- 自动识别音效优先级（基于 key 中的关键词）
- 高优先级音效（战斗反馈）不会被低优先级音效（UI 反馈）打断
- 不需要游戏层做任何修改

## 相关文档

- `evidence/dicethrone-attack-sound-volume-zero-analysis.md` - 初步分析（误判为 volume 问题）
- `evidence/dicethrone-attack-sound-interrupted-by-phase-change.md` - 根因分析和修复方案

## 修复时间

2026-03-04
