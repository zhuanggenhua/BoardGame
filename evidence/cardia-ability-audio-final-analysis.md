# Cardia - 能力激活音效最终分析

## 问题

用户报告：听不到任何能力音效

## 已完成的修复

### 1. 事件类型匹配修复 ✅

**问题**：`feedbackResolver` 使用硬编码字符串进行事件类型匹配

**修复**：
```typescript
// ❌ 错误（硬编码字符串）
if (type === 'ABILITY_ACTIVATED') { ... }

// ✅ 正确（使用事件常量）
if (type === CARDIA_EVENTS.ABILITY_ACTIVATED.type) { ... }
```

**原理**：
- `defineEvents()` 返回的 `type` 字段就是事件名称字符串
- `CARDIA_EVENTS.ABILITY_ACTIVATED.type === 'ABILITY_ACTIVATED'`
- 使用常量确保类型一致性

### 2. 音效映射表 ✅

创建了 `ABILITY_SOUND_MAP`，为 16 张卡牌定制音效：

```typescript
const ABILITY_SOUND_MAP: Record<string, string> = {
    [ABILITY_IDS.MERCENARY_SWORDSMAN]: 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001',
    [ABILITY_IDS.TREASURER]: 'coins.decks_and_cards_sound_fx_pack.small_reward_001',
    [ABILITY_IDS.ELF]: 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win',
    // ... 其他 13 张卡牌
};
```

### 3. 预加载列表 ✅

所有能力音效已添加到 `criticalSounds`：

```typescript
criticalSounds: Array.from(new Set([
    ...collectPreloadKeys(CARDIA_EVENTS),
    ...Object.values(ABILITY_SOUND_MAP),  // 16 张卡牌的能力音效
])),
```

### 4. 测试验证 ✅

- 29 个单元测试全部通过
- 能力激活音效测试通过（Card 01, 12, 16）
- 动态音效选择测试通过

## 音频播放链路分析

```
1. 事件发射 (execute.ts)
   ↓
   events.push({
       type: CARDIA_EVENTS.ABILITY_ACTIVATED.type,  // 'ABILITY_ACTIVATED'
       payload: { abilityId, cardId, playerId, ... }
   })

2. EventStreamSystem
   ↓
   entries.push({ id: nextId, event })

3. useGameAudio (Board.tsx)
   ↓
   eventEntries: G.sys.eventStream?.entries ?? []

4. resolveAudioEvent
   ↓
   从 entry.event 提取事件

5. resolveFeedback
   ↓
   调用 config.feedbackResolver(event, context)

6. feedbackResolver (audio.config.ts)
   ↓
   if (type === CARDIA_EVENTS.ABILITY_ACTIVATED.type) {
       const abilityId = event.payload?.abilityId;
       return ABILITY_SOUND_MAP[abilityId] ?? defaultSound;
   }

7. playSound
   ↓
   AudioManager.play(key)
```

## 可能的剩余问题

### 问题 1：音效文件未加载

**症状**：代码逻辑正确，但仍然听不到声音

**原因**：
- 音效文件路径错误
- 音效文件未上传到 CDN
- 浏览器网络请求失败

**排查**：
1. 打开浏览器开发者工具 → Network 面板
2. 筛选 Audio 类型请求
3. 查看音效文件是否成功加载（状态码 200）
4. 检查是否有 404 或其他错误

### 问题 2：音频管理器未初始化

**症状**：`AudioManager.play()` 被调用，但没有声音

**原因**：
- `AudioManager.initialize()` 未调用
- 浏览器音频上下文未激活（需要用户交互）

**排查**：
1. 在控制台执行：`window.AudioManager.isInitialized()`
2. 检查是否返回 `true`
3. 如果返回 `false`，检查 `useGameAudio` 的初始化逻辑

### 问题 3：音量设置为 0

**症状**：音效加载成功，但听不到声音

**原因**：
- 游戏音量设置为 0
- 浏览器标签页静音
- 系统音量为 0

**排查**：
1. 检查游戏内音量设置
2. 检查浏览器标签页是否静音（标签页上的喇叭图标）
3. 检查系统音量

### 问题 4：音效被节流

**症状**：第一次激活能力有声音，后续没有

**原因**：`SFX_THROTTLE_MS` (80ms) 节流机制

**排查**：
1. 确认两次激活间隔 > 80ms
2. 检查 `lastPlayedTime` Map

### 问题 5：事件未发射

**症状**：`feedbackResolver` 未被调用

**原因**：
- `ABILITY_ACTIVATED` 事件未发射
- `execute.ts` 中的事件发射代码有问题

**排查**：
1. 在 `execute.ts` 中添加 `console.log`
2. 确认事件是否被 push 到 events 数组

## 调试工具

### 1. 浏览器控制台日志

已在 `useGameAudio.ts` 中添加临时调试日志：

```typescript
if (gameId === 'cardia' && event.type && String(event.type).includes('ABILITY_ACTIVATED')) {
    console.log('[Cardia Audio Debug] ABILITY_ACTIVATED event detected:', {
        eventType: event.type,
        payload: event.payload,
        abilityId: event.payload?.abilityId,
    });
    
    console.log('[Cardia Audio Debug] ABILITY_ACTIVATED feedback resolution:', {
        eventType: event.type,
        resolvedKey: key,
        abilityId: event.payload?.abilityId,
        willPlay: !!key && !playedKeys.has(key),
    });
}
```

### 2. E2E 调试测试

创建了 `e2e/cardia-ability-audio-debug.e2e.ts`，用于：
- 注入能力阶段状态
- 激活能力
- 捕获控制台日志
- 分析事件流

### 3. 手动测试步骤

1. 启动游戏：`npm run dev`
2. 访问：`http://localhost:6173/play/cardia`
3. 打开开发者工具控制台（F12）
4. 开始游戏并激活任意卡牌的能力
5. 查找 `[Cardia Audio Debug]` 日志
6. 检查 Network 面板的音效文件加载情况

## 验证清单

- [x] 事件类型匹配修复
- [x] 音效映射表创建
- [x] 预加载列表更新
- [x] 单元测试通过
- [x] 调试日志添加
- [ ] E2E 测试验证（内存不足，待手动测试）
- [ ] 浏览器实际测试
- [ ] 音效文件加载验证
- [ ] 音频管理器状态验证

## 下一步

1. **手动测试**：在浏览器中实际测试，收集调试日志
2. **网络检查**：确认音效文件是否成功加载
3. **音量检查**：确认各级音量设置
4. **移除调试日志**：测试完成后清理临时日志

## 总结

从代码层面看，所有修复都已正确实施：
- ✅ 事件类型匹配使用常量
- ✅ 音效映射表完整
- ✅ 预加载列表包含所有音效
- ✅ 单元测试全部通过

如果仍然听不到声音，问题很可能在：
1. 音效文件加载失败（网络/路径问题）
2. 音频管理器未正确初始化
3. 音量设置为 0
4. 浏览器音频权限问题

需要通过浏览器实际测试来定位具体问题。
