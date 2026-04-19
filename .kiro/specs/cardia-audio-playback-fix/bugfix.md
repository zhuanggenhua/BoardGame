# Bugfix Requirements Document

## Introduction

用户反馈 Cardia 游戏听不到音效。根据已有证据，音频配置、事件定义、测试覆盖均已完整实现，但实际游戏中无音效播放。本文档定义该 bug 的当前行为（缺陷）、预期行为（正确）和必须保持不变的行为（回归预防）。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 玩家在 Cardia 游戏中执行操作（如打出卡牌、抽取卡牌、获得印戒）THEN 系统不播放对应的音效

1.2 WHEN 游戏进入不同阶段（如战斗阶段、普通阶段）THEN 系统不播放或切换 BGM

1.3 WHEN 玩家放置修正标记（正值或负值）THEN 系统不播放增益或减益音效

1.4 WHEN 游戏结束并产生胜者 THEN 系统不播放胜利音效

### Expected Behavior (Correct)

2.1 WHEN 玩家在 Cardia 游戏中执行操作（如打出卡牌、抽取卡牌、获得印戒）THEN 系统 SHALL 播放对应的即时反馈音效（如 `card_take_001`、`small_reward_001`）

2.2 WHEN 游戏进入不同阶段（如战斗阶段、普通阶段）THEN 系统 SHALL 播放或切换对应的 BGM（如 `Mystwood Reverie`）

2.3 WHEN 玩家放置修正标记（正值或负值）THEN 系统 SHALL 根据数值正负播放对应的增益音效（`charged_a`）或减益音效（`cursed_a`）

2.4 WHEN 游戏结束并产生胜者 THEN 系统 SHALL 播放胜利音效（`stgr_action_win`）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 其他游戏（如 DiceThrone、SmashUp）播放音效时 THEN 系统 SHALL CONTINUE TO 正常播放音效和 BGM

3.2 WHEN Cardia 游戏的事件被正确发射到 EventStream THEN 系统 SHALL CONTINUE TO 正确记录事件（不影响日志、撤销、回放等功能）

3.3 WHEN 用户调整音效音量或 BGM 音量设置 THEN 系统 SHALL CONTINUE TO 正确应用音量设置

3.4 WHEN 音频文件从 CDN/R2 加载 THEN 系统 SHALL CONTINUE TO 正确处理加载失败、网络错误等异常情况

3.5 WHEN 浏览器需要用户交互后才能播放音频（Autoplay Policy）THEN 系统 SHALL CONTINUE TO 正确处理音频上下文初始化和用户交互触发

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type CardiaGameEvent
  OUTPUT: boolean
  
  // 当事件应该触发音效但实际未播放时，bug 条件成立
  RETURN X.game = 'cardia' 
    AND X.audioStrategy IN ['immediate', 'fx'] 
    AND NOT audioPlayed(X)
END FUNCTION
```

### Property Specification (Fix Checking)

```pascal
// Property: Fix Checking - Cardia 音效播放
FOR ALL X WHERE isBugCondition(X) DO
  result ← playAudio'(X)
  ASSERT result.played = true 
    AND result.soundKey = expectedSoundKey(X)
    AND no_error(result)
END FOR
```

**Key Definitions:**
- **playAudio**: 原始（未修复）音频播放函数 - 当前不播放音效
- **playAudio'**: 修复后的音频播放函数 - 应该正确播放音效

### Preservation Goal

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT playAudio(X) = playAudio'(X)
END FOR
```

这确保对于所有非 Cardia 游戏的音效播放，修复后的代码行为与原始代码完全一致。

## Potential Root Causes (待排查)

根据已知信息，可能的根因包括：

1. **音频文件缺失**：音效 key 在注册表中存在，但实际文件未上传到 CDN/R2
2. **音频预加载失败**：`criticalSounds` 配置正确，但预加载过程失败（网络错误、路径错误）
3. **EventStream 未正确发射事件**：游戏逻辑未调用 `emit(event)`，导致 `useGameAudio` 无法订阅到事件
4. **useGameAudio Hook 未正确初始化**：Board 组件未使用 `useGameAudio`，或初始化时机错误
5. **feedbackResolver 返回值错误**：动态音效选择逻辑有误，返回 `null` 或无效 key
6. **AudioManager 播放逻辑失败**：音效 key 正确，但 `AudioManager.playSound()` 内部失败（音频上下文未初始化、音量为 0、浏览器限制）
7. **浏览器音频权限问题**：用户未与页面交互，导致 AudioContext 被阻止
8. **音频注册表路径问题**：`registry-slim.json` 中的路径与实际 CDN 路径不匹配

## Next Steps

1. 在浏览器控制台检查是否有音频加载错误或播放错误
2. 确认 `window.__BG_EVENT_STREAM__` 是否正确记录 Cardia 游戏事件
3. 确认 `useGameAudio` Hook 是否在 Cardia Board 组件中正确使用
4. 确认音效文件是否已上传到 CDN/R2（检查 `compressed/*.ogg` 文件）
5. 手动测试：打开游戏，执行操作，观察浏览器开发者工具的 Network 和 Console 面板
