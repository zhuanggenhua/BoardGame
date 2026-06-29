# 客户端自动反馈核对（6a3fe91aabaf577dd588786c）

## 范围

- 反馈 ID：`6a3fe91aabaf577dd588786c`
- 类型：系统自动反馈
- 游戏页面：`smashup`
- 反馈摘要：`[auto][unhandledrejection] No codec support for selected audio sources.`
- 真实路由：`/play/smashup/match/T9xp-fQW-cw?playerID=0`

## 结论

- 本轮归类：`当前树已恢复`
- 现实含义：
  - 这不是一个仍需继续修业务规则的现存 SmashUp bug。
  - 当前客户端已经把这类浏览器音频编解码噪音识别为自动反馈噪音并过滤，不应继续留在 open 队列。

## 本轮证据

- 过滤实现：
  - `src/lib/feedback/clientAutoReport.ts`
  - 相关噪音判断：
    - `isKnownClientAudioCodecNoise(...)`
    - `isKnownClientAudioHowlerCodeNoise(...)`
    - `shouldSkipClientAutoReport(...)`
- 当前过滤范围：
  - `No codec support for selected audio sources`
  - `Decoding audio data failed`
  - Howler 音频错误码 `4`

## 本地验证

- 验证命令：
  - `npx vitest run src/lib/__tests__/clientAutoReport.test.ts -t "音频编解码不支持噪音会被过滤|Howler 音频错误码噪音会被过滤|音频解码失败噪音会被过滤"`
- 结果：
  - `3 passed`

## 收口口径

- 这条反馈更适合按 `closed` 收口。
- 关闭理由：
  - 当前客户端已经把该类浏览器音频编解码失败识别为自动反馈噪音并过滤；
  - 当前树验证通过，不再作为现存业务 bug 继续推进。
