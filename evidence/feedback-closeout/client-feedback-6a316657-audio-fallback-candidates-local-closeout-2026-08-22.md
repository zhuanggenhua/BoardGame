# 本地反馈收口：音频候选列表顺序错误

- 反馈 ID：`6a3166576043f687e5574c12`
- 口径：本地数据库（`mongodb://127.0.0.1:27017/boardgame.feedbacks`）
- 反馈内容：`[auto][board-render-error] Audio fallback candidates must start with a URL candidate.`
- 自动检测场景：客户端棋盘渲染时进入 React 错误边界；堆栈显示发生在 `FantasyRealmsBoard` 进入棋盘后播放 BGM 的链路。

## 结论

这条旧崩溃在当前代码树已失效。当前音频回退链会先创建 URL 候选，再在本地 `_capacitor_file_` 路径加载失败后优先尝试原生包读取生成的 blob URL，最后才回退官方远端资源；空 BGM 源地址也不会继续抛异常打挂棋盘。

## 证据

- 本地 Mongo 原始反馈堆栈命中 `AudioManager.createHowlWithFallback -> AudioManager.playBgm -> AudioContext -> useGameAudio -> FantasyRealmsBoard`。
- 当前 `buildAudioFallbackCandidates` 对每个非空音频源先加入 `url` 候选，再加入 `native-blob` 和远端兜底候选。
- 当前 `createHowlWithFallback` 在候选为空或首项不是 URL 时只回调加载失败并返回 `null`，不会向棋盘渲染链路继续抛异常。
- 幻想国度 BGM 配置中的 `src` 均为非空字符串相对路径。
- 本轮新增 BGM 版回归：共享音频包 `_capacitor_file_` 本地 BGM 路径失败时，优先调用原生包读取，并用 blob URL 续播，不触发音频错误 toast。

## 验证

```powershell
node scripts\infra\vitest-cli-safe.mjs run src\lib\audio\__tests__\audioManager.test.ts --configLoader native
```

结果：`1 file passed / 12 tests passed`。

## 回写建议

状态：`closed`

原因：这条崩溃对应的音频候选顺序问题在当前代码树已经不再具备触发条件；本轮补了 BGM 回归，覆盖反馈堆栈中的真实播放入口。
