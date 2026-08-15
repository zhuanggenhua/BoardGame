# 大杀四方派系选择性能诊断

- 页面：http://127.0.0.1:6174/play/smashup/match/AA-dNNvZvn6?playerID=0
- Chrome trace：evidence/大杀四方-派系选择性能诊断/2026-08-15T12-13-34-870Z/chrome-trace-smashup-faction-selection.json
- 截图：evidence/大杀四方-派系选择性能诊断/2026-08-15T12-13-34-870Z/smashup-faction-selection-captured.png
- DOM：候选派系 108 个，页面元素 1896 个，带阴影元素 229 个。原始 `transition-property=all` 计数包含浏览器默认 0s 过渡，不作为独立结论；本次结论以实际卡面样本和源码命中为准。
- 首个派系卡外框：transition-property=all，transition-duration=0.15s，border-right-color=rgb(255, 255, 255)。
- 页面帧间隔：p95=66.60ms，p99=416.60ms，最大=2183.20ms，>33ms 101 次。
- Performance 指标增量：任务 29382.94ms，脚本 13232.44ms，布局 312.15ms，样式重算 3596.3ms。
- trace 中属性命中：{"border-right-color":42,"border-left-color":42,"border-top-color":42,"border-bottom-color":42,"box-shadow":0,"backdrop-filter":0}。

## 主要长任务

- RunTask：2182.59ms
- ThreadControllerImpl::RunTask：2181.16ms
- SimpleWatcher::OnHandleReady：2181.16ms
- v8.callFunction：2180.99ms
- FunctionCall：2177.22ms
- UpdateLayoutTree：1382.37ms
- RunTask：656.75ms
- ThreadControllerImpl::RunTask：630.68ms
- v8.callFunction：630.55ms
- FunctionCall：616.67ms
