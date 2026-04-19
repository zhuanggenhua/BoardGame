# Cardia 音频播放修复 Design

## Overview

Cardia 游戏的音频配置、事件定义、测试覆盖均已完整实现，但实际游戏中无音效播放。本文档基于已有证据和对比分析，制定具体的排查和修复方案。

**核心发现**：
- ✅ 音频配置已完整（`audio.config.ts`）
- ✅ 事件定义已完整（`events.ts`）
- ✅ `useGameAudio` Hook 已正确使用（`Board.tsx` 第 413-418 行）
- ❌ **根因假设**：`useGameAudio` 传入的 `ctx` 对象结构不正确，导致音频系统无法正常工作

## Glossary

- **Bug_Condition (C)**: Cardia 游戏中应该触发音效的事件（`audioStrategy` 为 `'immediate'` 或 `'fx'`）实际未播放音效
- **Property (P)**: 修复后，所有 Cardia 游戏事件应该按照 `audio.config.ts` 中定义的策略正确播放音效
- **Preservation**: 其他游戏（DiceThrone、SmashUp）的音效播放行为必须保持不变
- **useGameAudio**: 音频系统的 React Hook，负责订阅 EventStream 并根据配置播放音效
- **EventStream**: 引擎层事件流系统，记录所有游戏事件
- **feedbackResolver**: 音频配置中的函数，根据事件动态选择音效 key

## Bug Details

### Bug Condition

Cardia 游戏中，玩家执行操作（打出卡牌、抽取卡牌、获得印戒、放置修正标记等）时，系统不播放对应的音效。根据代码审查，`useGameAudio` Hook 已正确使用，但传入的 `ctx` 对象结构可能不符合音频系统的预期。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type CardiaGameEvent
  OUTPUT: boolean
  
  RETURN input.game = 'cardia' 
    AND input.audioStrategy IN ['immediate', 'fx'] 
    AND NOT audioPlayed(input)
END FUNCTION
```

### Examples

**当前行为（缺陷）**：
- 玩家打出卡牌 → 无音效（应播放 `card_take_001`）
- 玩家抽取卡牌 → 无音效（应播放 `card_take_001`）
- 玩家获得印戒 → 无音效（应播放 `small_reward_001`）
- 玩家放置正值修正标记 → 无音效（应播放 `charged_a`）
- 玩家放置负值修正标记 → 无音效（应播放 `cursed_a`）
- 游戏结束 → 无音效（应播放 `stgr_action_win`）

**预期行为（正确）**：
- 所有 `immediate` 策略事件应立即播放对应音效
- 所有 `fx` 策略事件应由动画系统触发音效
- BGM 应根据 `bgmRules` 自动播放和切换

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- DiceThrone 游戏的音效播放必须继续正常工作
- SmashUp 游戏的音效播放必须继续正常工作
- 音频音量设置必须继续正确应用
- 音频预加载机制必须继续正常工作
- 浏览器音频权限处理必须继续正常工作

**Scope:**
所有非 Cardia 游戏的音效播放应完全不受此次修复影响。音频系统的核心逻辑（EventStream 订阅、音效播放、BGM 切换）不应被修改，只需修复 Cardia 游戏的接入方式。

## Hypothesized Root Cause

基于代码审查和对比分析（Cardia vs DiceThrone），最可能的根因是：

### 1. **ctx 对象结构不匹配（最可能）**

**证据**：
- Cardia `Board.tsx` 第 415-420 行：
  ```typescript
  useGameAudio({
      config: CARDIA_AUDIO_CONFIG,
      gameId: CARDIA_MANIFEST.id,
      G: core,  // ❌ 传入的是 core，而不是完整的 G
      ctx: {
          currentPlayer: core.currentPlayerId,
          phase: phase,
          gameover: isGameOver,
      },
  });
  ```

- DiceThrone `Board.tsx` 使用 `useDiceThroneAudio` 自定义 Hook，传入完整的 `G` 和 `rawState`：
  ```typescript
  useDiceThroneAudio({
      G,
      rawState: rawG,
      currentPlayerId: playerID ?? undefined,
      currentPhase,
      isGameOver: !!isGameOver,
      isWinner,
  });
  ```

**问题分析**：
- `useGameAudio` 可能期望 `G` 是完整的游戏状态（包含 `sys.eventStream`），但 Cardia 传入的是 `core`（只包含领域状态）
- `ctx` 对象的字段名可能不匹配（`currentPlayer` vs `currentPlayerId`）
- 缺少必要的上下文信息（如 `playerID`）

### 2. **EventStream 未正确发射事件（可能性较低）**

**证据**：
- `game.ts` 第 90 行已正确注册 `createEventStreamSystem()`
- Board 组件第 380-430 行已正确订阅 EventStream 并触发动画

**排查方法**：
- 在浏览器控制台检查 `window.__BG_EVENT_STREAM__`
- 确认事件是否被正确记录

### 3. **音频文件缺失或路径错误（可能性较低）**

**证据**：
- `audio.config.ts` 中的音效 key 都来自标准音频注册表
- 其他游戏使用相同的音效 key 且正常工作

**排查方法**：
- 检查浏览器 Network 面板，确认音频文件是否成功加载
- 检查 `registry-slim.json` 是否包含所有引用的音效 key

### 4. **feedbackResolver 返回值错误（可能性较低）**

**证据**：
- `audio.config.ts` 第 51-63 行的 `feedbackResolver` 逻辑简单清晰
- 只有 `MODIFIER_TOKEN_PLACED` 事件使用动态选择，其他事件使用基础 resolver

**排查方法**：
- 在 `feedbackResolver` 中添加日志，确认返回值是否正确

## Correctness Properties

Property 1: Bug Condition - Cardia 音效播放

_For any_ Cardia 游戏事件，当该事件的 `audioStrategy` 为 `'immediate'` 或 `'fx'` 时，修复后的音频系统 SHALL 正确播放对应的音效，且音效 key 与 `audio.config.ts` 中定义的一致。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 其他游戏音效播放

_For any_ 非 Cardia 游戏的音效播放事件，修复后的代码 SHALL 产生与原始代码完全相同的行为，保持 DiceThrone、SmashUp 等游戏的音效播放正常工作。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

假设根因分析正确（ctx 对象结构不匹配），修复方案如下：

**File**: `src/games/cardia/Board.tsx`

**Specific Changes**:

1. **修正 useGameAudio 的参数**：
   - 将 `G: core` 改为 `G: G`（传入完整的游戏状态，包含 `sys.eventStream`）
   - 或者确认 `useGameAudio` 是否需要 `core` 还是完整的 `G`
   - 检查 `ctx` 对象的字段名是否与 `useGameAudio` 的类型定义匹配

2. **对比 DiceThrone 的实现**：
   - 检查 `useDiceThroneAudio` 的实现，了解正确的参数结构
   - 如果需要，创建 `useCardiaAudio` 自定义 Hook，封装音频逻辑

3. **添加调试日志**：
   - 在 `useGameAudio` 调用前后添加日志，确认参数是否正确
   - 在 `feedbackResolver` 中添加日志，确认事件是否被正确处理

4. **验证 EventStream**：
   - 在浏览器控制台检查 `window.__BG_EVENT_STREAM__`
   - 确认 Cardia 游戏事件是否被正确记录

5. **验证音频文件**：
   - 检查浏览器 Network 面板，确认音频文件是否成功加载
   - 检查 `registry-slim.json` 是否包含所有引用的音效 key

### Implementation Steps

1. **阶段 1：诊断与日志**
   - 在 `Board.tsx` 的 `useGameAudio` 调用前添加日志，打印传入的参数
   - 在浏览器控制台检查 `window.__BG_EVENT_STREAM__`
   - 在浏览器 Network 面板检查音频文件加载情况

2. **阶段 2：修正参数**
   - 根据诊断结果，修正 `useGameAudio` 的参数
   - 参考 DiceThrone 的实现，确保参数结构正确

3. **阶段 3：验证修复**
   - 运行游戏，执行各种操作（打出卡牌、抽取卡牌、获得印戒等）
   - 确认音效是否正确播放
   - 检查浏览器控制台是否有错误日志

4. **阶段 4：回归测试**
   - 运行 DiceThrone 和 SmashUp 游戏，确认音效播放正常
   - 运行 E2E 测试，确认没有破坏现有功能

## Testing Strategy

### Validation Approach

测试策略分为两个阶段：
1. **诊断阶段**：通过日志和浏览器工具确认根因
2. **验证阶段**：确认修复后音效正确播放，且没有破坏其他游戏

### Exploratory Bug Condition Checking

**Goal**: 在修复前，通过浏览器工具和日志确认根因。

**Test Plan**: 
1. 打开 Cardia 游戏，打开浏览器开发者工具
2. 在 Console 面板检查 `window.__BG_EVENT_STREAM__`，确认事件是否被正确记录
3. 在 Network 面板检查音频文件加载情况，确认是否有 404 错误
4. 在 `Board.tsx` 的 `useGameAudio` 调用前添加日志，打印传入的参数
5. 执行游戏操作（打出卡牌、抽取卡牌、获得印戒等），观察日志输出

**Test Cases**:
1. **EventStream 检查**：确认 `window.__BG_EVENT_STREAM__` 是否包含 Cardia 游戏事件
2. **音频文件检查**：确认音频文件是否成功加载（200 状态码）
3. **参数检查**：确认 `useGameAudio` 的参数是否正确（`G` vs `core`，`ctx` 字段名）
4. **feedbackResolver 检查**：确认 `feedbackResolver` 是否返回正确的音效 key

**Expected Counterexamples**:
- `useGameAudio` 的 `G` 参数可能不包含 `sys.eventStream`
- `ctx` 对象的字段名可能不匹配（`currentPlayer` vs `currentPlayerId`）
- 音频文件可能未上传到 CDN/R2

### Fix Checking

**Goal**: 验证修复后，所有 Cardia 游戏事件都能正确播放音效。

**Pseudocode:**
```
FOR ALL event WHERE isBugCondition(event) DO
  result := playAudio_fixed(event)
  ASSERT result.played = true 
    AND result.soundKey = expectedSoundKey(event)
    AND no_error(result)
END FOR
```

**Test Plan**: 
1. 修复 `useGameAudio` 的参数
2. 运行游戏，执行各种操作
3. 确认音效是否正确播放
4. 检查浏览器控制台是否有错误日志

**Test Cases**:
1. **打出卡牌**：确认播放 `card_take_001`
2. **抽取卡牌**：确认播放 `card_take_001`
3. **获得印戒**：确认播放 `small_reward_001`
4. **放置正值修正标记**：确认播放 `charged_a`
5. **放置负值修正标记**：确认播放 `cursed_a`
6. **游戏结束**：确认播放 `stgr_action_win`
7. **BGM 播放**：确认 `Mystwood Reverie` 正确播放

### Preservation Checking

**Goal**: 验证修复后，其他游戏的音效播放行为保持不变。

**Pseudocode:**
```
FOR ALL event WHERE NOT isBugCondition(event) DO
  ASSERT playAudio_original(event) = playAudio_fixed(event)
END FOR
```

**Test Plan**: 
1. 运行 DiceThrone 游戏，执行各种操作
2. 运行 SmashUp 游戏，执行各种操作
3. 确认音效播放正常
4. 运行 E2E 测试，确认没有破坏现有功能

**Test Cases**:
1. **DiceThrone 音效**：确认掷骰、攻击、技能等音效正常播放
2. **SmashUp 音效**：确认打出随从、使用行动等音效正常播放
3. **音量设置**：确认音量调整功能正常工作
4. **BGM 切换**：确认 BGM 根据游戏阶段正确切换

### Unit Tests

- 测试 `feedbackResolver` 的动态音效选择逻辑（`MODIFIER_TOKEN_PLACED` 事件）
- 测试 `useGameAudio` 的参数验证逻辑
- 测试 EventStream 订阅和取消订阅逻辑

### Property-Based Tests

- 生成随机 Cardia 游戏事件，验证音效播放正确性
- 生成随机游戏状态，验证 BGM 切换规则正确性
- 生成随机修正标记数值，验证动态音效选择正确性

### Integration Tests

- E2E 测试：完整游戏流程，确认所有音效正确播放
- E2E 测试：切换游戏（Cardia → DiceThrone → SmashUp），确认音效系统正常工作
- E2E 测试：调整音量设置，确认音效音量正确应用

### Manual Testing Checklist

**必须在浏览器中手动测试以下场景**：

1. **基础音效播放**：
   - [ ] 打出卡牌时播放 `card_take_001`
   - [ ] 抽取卡牌时播放 `card_take_001`
   - [ ] 获得印戒时播放 `small_reward_001`
   - [ ] 弃牌时播放 `fx_discard_001`
   - [ ] 洗牌时播放 `cards_shuffle_fast_001`

2. **动态音效选择**：
   - [ ] 放置正值修正标记（+1, +2, +3）时播放 `charged_a`
   - [ ] 放置负值修正标记（-1, -2, -3）时播放 `cursed_a`
   - [ ] 放置零值修正标记时播放 `charged_a`（根据 `audio.config.ts` 第 54 行）

3. **游戏结束音效**：
   - [ ] 游戏结束时播放 `stgr_action_win`

4. **BGM 播放**：
   - [ ] 游戏开始时自动播放 `Mystwood Reverie`
   - [ ] BGM 音量正确应用（默认 0.5）

5. **浏览器控制台检查**：
   - [ ] 无音频加载错误
   - [ ] 无音频播放错误
   - [ ] `window.__BG_EVENT_STREAM__` 正确记录事件

6. **回归测试**：
   - [ ] DiceThrone 音效正常播放
   - [ ] SmashUp 音效正常播放
   - [ ] 音量设置功能正常工作

## Next Steps

1. **立即执行诊断**：
   - 在浏览器中打开 Cardia 游戏
   - 检查 `window.__BG_EVENT_STREAM__`
   - 检查 Network 面板的音频文件加载情况
   - 在 `Board.tsx` 添加日志，打印 `useGameAudio` 的参数

2. **根据诊断结果修复**：
   - 如果是 `ctx` 对象结构问题，修正参数
   - 如果是 EventStream 问题，检查事件发射逻辑
   - 如果是音频文件问题，检查 CDN/R2 上传情况

3. **验证修复**：
   - 手动测试所有音效场景
   - 运行回归测试
   - 创建证据文档记录测试结果

4. **提交修复**：
   - 提交代码变更
   - 更新相关文档
   - 关闭 bugfix spec
