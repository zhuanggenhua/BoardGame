# Howler BGM 递归崩溃收口（2026-06-04）

## 范围

- 本文只覆盖 `client-window-error / [auto][window.error] Maximum call stack size exceeded` 这一簇。
- 不包含单独的 `player-command-failure / SYS_INTERACTION_RESPOND pipeline_error: Maximum call stack size exceeded`
  - `6a2013a178c1ecf399a6793a`

## 反馈 ID

- DiceThrone
  - `6a1ff12078c1ecf399a6740b`
  - `6a1fa64178c1ecf399a67309`
  - `6a1ed9b5952559643efd3b3c`
  - `6a1ed7fb952559643efd3b34`
- SmashUp
  - `6a1fbd1478c1ecf399a67362`
  - `6a1e712c952559643efd3669`
  - `6a1e5b8b952559643efd35ef`
- Client
  - `6a200ee278c1ecf399a6786d`

## 生产症状

- 8 条自动反馈都落在同一份前端 vendor：
  - `https://easyboardgame.top/assets/vendor-howler-Bp1HXCiM.js`
- 主要栈形状一致：
  - `_._ended -> _.play -> _._ended -> _.play`
- 代表性入口点有三类，但都属于同一 Howler 循环重播链：
  - `_._clearTimer`
  - `_._emit`
  - `_._soundById`

## 根因结论

- 当前 worktree 的 BGM 仍让 `html5: true` 的 Howler 实例使用内建 `loop: true`。
- 在异常媒体状态下，Howler 会在 `ended` 分支里同步再次 `play()`，形成 `_ended -> play` 递归。
- 这条链发生在共享音频层，不依赖具体游戏规则；因此会同时污染 DiceThrone、SmashUp 和无 gameId 的 client 自动反馈。

## 代码修复

- `src/lib/audio/AudioManager.ts`
  - 对 `html5` BGM 关闭 Howler 内建 `loop: true`，改为受控的异步手动重播。
  - 新增 BGM 循环状态管理：
    - `bgmLoopRestartTimers`
    - `bgmRapidEndCounts`
    - `bgmLastPlayStartedAt`
  - 新增快速异常结束熔断：
    - 1.5s 内连续快速 `end` 达到 3 次时，停止并卸载当前 BGM，避免 vendor 继续递归。
  - 在 `stopBgm / stopAll / unloadAll / 切歌` 时同步清理循环状态，避免残留定时器继续重播。

## 回归测试

- `node scripts/infra/vitest-cli-safe.mjs run src/lib/audio/__tests__/audioManager.test.ts src/lib/audio/__tests__/useGameAudio.test.ts --configLoader native`
- 结果：
  - `2 passed`
  - `8 passed`

## 关键回归断言

- `audioManager.test.ts`
  - BGM 不再使用 Howler 内建 `loop`。
  - `onend` 改为异步手动重播，不再把同步递归留给 vendor。
  - 连续异常快速结束会触发熔断，停止并卸载当前 BGM。
- `useGameAudio.test.ts`
  - 共享 `playBgm / stopBgm` 上层行为未被这次循环策略调整带坏。

## 状态口径

- 这 8 条反馈都属于共享音频层真 bug，当前应统一回写为 `resolved`。
- 理由：
  - 已有明确根因。
  - 已完成代码修复。
  - 已有定向自动化验证。
  - 不需要等待生产部署后“观察是否还会报”才回写。

## 备注

- 这次收口只处理 `window.error` 的 Howler 递归簇。
- 当前剩余未收口项里，`6a2013a178c1ecf399a6793a` 需要继续按 SmashUp `action counter` / watchdog 方向单独处理，不能并入本文证据。
