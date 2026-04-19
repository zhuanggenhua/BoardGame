# Cardia 音频播放修复证据文档

## 问题描述

用户反馈 Cardia 游戏听不到音效。经过代码审查和对比分析，发现根因是 `Board.tsx` 中的 `useGameAudio` Hook 缺少 `eventEntries` 参数。

## 根因分析

### 对比分析：Cardia vs DiceThrone

**DiceThrone（正确实现）**：
- 文件：`src/games/dicethrone/hooks/useDiceThroneAudio.ts`
- 通过自定义 Hook `useDiceThroneAudio` 封装音频逻辑
- 正确传递 `eventEntries: rawState.sys.eventStream.entries` 参数

```typescript
// DiceThrone 的正确实现
useGameAudio({
    config: DICETHRONE_AUDIO_CONFIG,
    gameId: DICETHRONE_MANIFEST.id,
    G: rawState.core,
    ctx: {
        currentPlayer: rawState.core.currentPlayerId,
        phase: currentPhase,
        gameover: isGameOver,
    },
    eventEntries: rawState.sys.eventStream.entries, // ✅ 正确传递
});
```

**Cardia（修复前）**：
- 文件：`src/games/cardia/Board.tsx` (第 413-420 行)
- 直接调用 `useGameAudio`，但缺少 `eventEntries` 参数
- 导致音频系统无法订阅 EventStream，无法播放音效

```typescript
// Cardia 修复前的错误实现
useGameAudio({
    config: CARDIA_AUDIO_CONFIG,
    gameId: CARDIA_MANIFEST.id,
    G: core,
    ctx: {
        currentPlayer: core.currentPlayerId,
        phase: phase,
        gameover: isGameOver,
    },
    // ❌ 缺少 eventEntries 参数
});
```

### useGameAudio Hook 的工作原理

`useGameAudio` Hook 需要 `eventEntries` 参数来订阅 EventStream：
1. Hook 内部使用 `useEffect` 监听 `eventEntries` 的变化
2. 当新事件被添加到 EventStream 时，Hook 会根据 `audio.config.ts` 中的配置播放对应的音效
3. 如果缺少 `eventEntries` 参数，Hook 无法订阅事件，导致音效不播放

## 修复方案

### 代码变更

**文件**：`src/games/cardia/Board.tsx` (第 413-421 行)

**修复后的代码**：
```typescript
useGameAudio({
    config: CARDIA_AUDIO_CONFIG,
    gameId: CARDIA_MANIFEST.id,
    G: core,
    ctx: {
        currentPlayer: core.currentPlayerId,
        phase: phase,
        gameover: isGameOver,
    },
    eventEntries: G.sys.eventStream?.entries ?? [], // ✅ 添加 eventEntries 参数
});
```

**关键变更**：
- 添加 `eventEntries: G.sys.eventStream?.entries ?? []` 参数
- 使用可选链操作符 `?.` 和空值合并操作符 `??` 确保安全访问
- 当 `sys.eventStream` 不存在时，回退到空数组

### 为什么这样修复

1. **参数完整性**：`useGameAudio` 需要 `eventEntries` 参数来订阅 EventStream
2. **安全访问**：使用 `?.` 和 `??` 确保在 `sys.eventStream` 不存在时不会报错
3. **与 DiceThrone 一致**：修复后的实现与 DiceThrone 的模式一致
4. **最小改动**：只添加一个参数，不修改其他逻辑

## 验证结果

### 静态分析

运行 ESLint 检查：
```bash
npx eslint src/games/cardia/Board.tsx
```

**结果**：0 errors, 71 warnings（warnings 为预存在的代码风格问题，与本次修复无关）

### 预期行为

修复后，以下音效应该正确播放：

1. **基础音效**：
   - 打出卡牌 → `card_take_001`
   - 抽取卡牌 → `card_take_001`
   - 获得印戒 → `small_reward_001`
   - 弃牌 → `fx_discard_001`
   - 洗牌 → `cards_shuffle_fast_001`

2. **动态音效**：
   - 放置正值修正标记 → `charged_a`
   - 放置负值修正标记 → `cursed_a`

3. **游戏结束音效**：
   - 游戏结束 → `stgr_action_win`

4. **BGM**：
   - 游戏开始 → `Mystwood Reverie`（音量 0.5）

### 回归风险评估

**影响范围**：仅 Cardia 游戏的音频播放

**回归风险**：极低
- 只修改了 Cardia 的 `Board.tsx`
- 没有修改音频系统核心逻辑
- 没有修改其他游戏的代码
- 修复方案与 DiceThrone 的实现模式一致

**需要验证的回归场景**：
- DiceThrone 音效播放（应保持正常）
- SmashUp 音效播放（应保持正常）
- 音量设置功能（应保持正常）

## 技术债务

无。此修复是标准的参数补全，不引入技术债务。

## 相关文档

- **Bugfix Requirements**: `.kiro/specs/cardia-audio-playback-fix/bugfix.md`
- **Design Document**: `.kiro/specs/cardia-audio-playback-fix/design.md`
- **Tasks**: `.kiro/specs/cardia-audio-playback-fix/tasks.md`
- **Audio Config**: `src/games/cardia/audio.config.ts`
- **Audio System Evidence**: `evidence/cardia-audio-system.md`
- **DiceThrone Audio Hook**: `src/games/dicethrone/hooks/useDiceThroneAudio.ts`

## 结论

根因已确认：Cardia 的 `Board.tsx` 缺少 `eventEntries` 参数，导致 `useGameAudio` Hook 无法订阅 EventStream。修复方案简单明确：添加 `eventEntries: G.sys.eventStream?.entries ?? []` 参数。修复后的实现与 DiceThrone 的模式一致，回归风险极低。

**下一步**：
1. 手动测试确认音效播放正常（Task 2.2）
2. 回归测试确认其他游戏音效正常（Task 2.3）
3. 提交代码变更
