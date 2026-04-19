# Implementation Plan

## 概述

根据 design.md 的分析，最可能的根因是 `useGameAudio` Hook 的参数结构不匹配：
- Cardia 传入的是 `G: core`（只包含领域状态）
- 可能缺少 `sys.eventStream`
- `ctx` 对象的字段名可能不匹配

修复方案分为三个阶段：诊断、修复、验证。

---

## 任务列表

- [ ] 1. 诊断阶段 - 通过浏览器工具和日志确认根因
  - **Property 1: Bug Condition** - Cardia 音效播放失败
  - **CRITICAL**: 这个诊断任务必须在浏览器中手动执行 - 无法自动化
  - **DO NOT attempt to fix the code when diagnosing**
  - **NOTE**: 诊断结果将指导后续修复方案
  - **GOAL**: 确认 `useGameAudio` 参数结构问题
  - 打开 Cardia 游戏，打开浏览器开发者工具（F12）
  - 在 Console 面板检查 `window.__BG_EVENT_STREAM__`，确认事件是否被正确记录
  - 在 Network 面板检查音频文件加载情况（搜索 `.ogg` 或 `.mp3`），确认是否有 404 错误
  - 在 `src/games/cardia/Board.tsx` 的 `useGameAudio` 调用前添加临时日志：
    ```typescript
    console.log('[Cardia Audio Debug]', {
      G_type: typeof G,
      G_keys: Object.keys(G),
      core_type: typeof core,
      core_keys: Object.keys(core),
      has_sys: 'sys' in G,
      has_eventStream: G.sys?.eventStream ? 'yes' : 'no',
      ctx_structure: {
        currentPlayer: core.currentPlayerId,
        phase: phase,
        gameover: isGameOver,
      }
    });
    ```
  - 执行游戏操作（打出卡牌、抽取卡牌、获得印戒等），观察日志输出
  - 记录诊断结果到 `evidence/cardia-audio-playback-fix-diagnosis.md`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. 修复阶段 - 修正 `useGameAudio` 的参数

  - [x] 2.1 根据诊断结果修正参数
    - 如果 `G` 包含 `sys.eventStream`，将 `G: core` 改为 `G: G`
    - 如果 `ctx` 字段名不匹配，参考 DiceThrone 的实现修正字段名
    - 如果需要，创建 `useCardiaAudio` 自定义 Hook 封装音频逻辑
    - _Bug_Condition: isBugCondition(input) where input.game = 'cardia' AND input.audioStrategy IN ['immediate', 'fx'] AND NOT audioPlayed(input)_
    - _Expected_Behavior: 修复后，所有 Cardia 游戏事件应该按照 audio.config.ts 中定义的策略正确播放音效_
    - _Preservation: 其他游戏（DiceThrone、SmashUp）的音效播放行为必须保持不变_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 2.2 验证修复 - 手动测试所有音效场景
    - **Property 1: Expected Behavior** - Cardia 音效正确播放
    - **IMPORTANT**: 这是手动验证任务 - 必须在浏览器中实际测试
    - 运行游戏，执行各种操作
    - 确认音效是否正确播放（参考 design.md 的 Manual Testing Checklist）
    - 检查浏览器控制台是否有错误日志
    - 记录测试结果到 `evidence/cardia-audio-playback-fix-manual-test.md`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 2.3 验证回归 - 确认其他游戏音效正常
    - **Property 2: Preservation** - 其他游戏音效播放
    - **IMPORTANT**: 这是回归测试任务 - 必须在浏览器中实际测试
    - 运行 DiceThrone 游戏，执行各种操作
    - 运行 SmashUp 游戏，执行各种操作
    - 确认音效播放正常
    - 记录测试结果到 `evidence/cardia-audio-playback-fix-regression-test.md`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Checkpoint - 确保所有测试通过
  - 确认所有音效场景测试通过
  - 确认回归测试通过
  - 如有问题，回到诊断阶段重新分析

---

## 注意事项

1. **诊断优先**：必须先完成诊断任务，确认根因后再修复
2. **手动测试**：音效播放必须在浏览器中手动测试，无法自动化
3. **证据保留**：所有测试结果必须记录到 `evidence/` 目录
4. **回归测试**：修复后必须确认其他游戏音效正常工作

---

## 参考资料

- **Bugfix Requirements**: `.kiro/specs/cardia-audio-playback-fix/bugfix.md`
- **Design Document**: `.kiro/specs/cardia-audio-playback-fix/design.md`
- **Audio Config**: `src/games/cardia/audio.config.ts`
- **Board Component**: `src/games/cardia/Board.tsx` (第 413-418 行)
- **DiceThrone Audio**: `src/games/dicethrone/Board.tsx` (参考实现)
