# 大杀四方派系选择性能复测

- Measurement note: this run used the existing E2E `skipImageGate` switch to enter the faction-selection screen because the full critical-image gate stalled at 16/77 assets for 120s during post-fix verification.
- URL: http://127.0.0.1:6174/play/smashup/match/RVhRTIAPfjQ?playerID=0
- total/rendered factions: 108/25
- DOM elements: 571
- idle frame p95/max: 66.8ms / 83.3ms
- scroll frame p95/max: 166.7ms / 166.7ms
- style recalc delta: 0.661s
- trace: D:\gongzuo\webgame\BoardGame\evidence\大杀四方-派系选择性能诊断\2026-08-15T13-04-37-332Z\chrome-trace-smashup-faction-selection-after.json
- screenshot: D:\gongzuo\webgame\BoardGame\evidence\大杀四方-派系选择性能诊断\2026-08-15T13-04-37-332Z\smashup-faction-selection-after.png
