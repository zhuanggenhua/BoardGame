# Cardia - 能力激活音效调试

## 问题

用户报告：听不到任何能力音效

## 已完成的修复

1. ✅ 修复了 `feedbackResolver` 中的事件类型匹配问题（使用事件常量而不是硬编码字符串）
2. ✅ 创建了 `ABILITY_SOUND_MAP` 为 16 张卡牌定制音效
3. ✅ 所有能力音效已添加到 `criticalSounds` 预加载列表
4. ✅ 单元测试全部通过（29/29）

## 当前调查

### 音频播放链路

```
事件发射 (execute.ts)
  ↓
EventStreamSystem.entries
  ↓
useGameAudio (Board.tsx)
  ↓
resolveAudioEvent (从 entry.event 提取事件)
  ↓
resolveFeedback (调用 feedbackResolver)
  ↓
playSound (播放音效)
```

### 已添加调试日志

在 `src/lib/audio/useGameAudio.ts` 中添加了临时调试日志，用于追踪：

1. **事件检测**：是否检测到 `ABILITY_ACTIVATED` 事件
2. **事件结构**：事件的 `type` 和 `payload` 是否正确
3. **音效解析**：`feedbackResolver` 是否返回正确的音效 key
4. **播放决策**：是否实际调用 `playSound`

### 调试步骤

1. 在游戏中激活任意卡牌的能力
2. 打开浏览器开发者工具控制台
3. 查找 `[Cardia Audio Debug]` 开头的日志
4. 检查以下信息：
   - 事件是否被检测到
   - `abilityId` 是否正确
   - `resolvedKey` 是否为预期的音效 key
   - `willPlay` 是否为 `true`

### 可能的问题点

#### 1. 事件未发射

**症状**：控制台没有任何 `[Cardia Audio Debug]` 日志

**原因**：`ABILITY_ACTIVATED` 事件可能没有被正确发射

**排查**：检查 `src/games/cardia/domain/execute.ts` 中的事件发射代码

#### 2. 事件类型不匹配

**症状**：日志显示事件被检测到，但 `resolvedKey` 为 `null`

**原因**：`event.type` 与 `CARDIA_EVENTS.ABILITY_ACTIVATED.type` 不匹配

**排查**：在日志中比较 `event.type` 的实际值

#### 3. abilityId 缺失或错误

**症状**：日志显示 `abilityId` 为 `undefined` 或不在 `ABILITY_SOUND_MAP` 中

**原因**：事件 payload 结构不正确

**排查**：检查 `execute.ts` 中事件发射时的 payload 结构

#### 4. 音效加载失败

**症状**：日志显示 `willPlay: true`，但仍然听不到声音

**原因**：音效文件加载失败或音频管理器问题

**排查**：
- 检查浏览器网络面板，查看音效文件是否成功加载
- 检查浏览器控制台是否有音频加载错误
- 检查音量设置和浏览器音频权限

#### 5. 音效被节流

**症状**：第一次激活能力有声音，后续没有

**原因**：`SFX_THROTTLE_MS` (80ms) 节流机制

**排查**：检查日志中的时间戳，确认两次激活间隔是否 > 80ms

## 下一步

1. ⏳ 在游戏中测试并收集调试日志
2. ⏳ 根据日志结果定位具体问题
3. ⏳ 实施针对性修复
4. ⏳ 移除临时调试日志

## 临时调试代码位置

- `src/lib/audio/useGameAudio.ts` (第 ~420-445 行)

**注意**：调试完成后需要移除这些临时日志
