# Summoner Wars 在线 AI stale seat / watchdog 恢复验证

日期：2026-04-17

## 范围

- 问题：在线房中，AI seat 的可见状态若仍停在上一拍 `draw`，是否会被客户端 8 秒兜底直接跳过 `summon`
- 同时验证：服务端 watchdog 若改走 legal-action recovery，是否会留下可追踪记录，并把召唤结果真实广播到前端

## 本轮修改

- `src/pages/MatchRoom.tsx`
  - host 端 AI seat 决策前新增 `seatState` 新鲜度校验
  - 当 `seatState` 落后一拍时，不再拿陈旧状态做 AI 决策
  - 禁止客户端 `active-turn` 8 秒兜底直接 force-end
- `src/engine/transport/server.ts`
  - watchdog 用 legal action 恢复成功后，新增 `legal-action-recovered` feedback 留痕
  - legal-action recovery 在合并中间态后补发统一 `broadcastState`，确保房间前端能看到 summon 结果
- `src/engine/transport/__tests__/server.test.ts`
  - 新增 watchdog legal-action recovery feedback 测试
- `e2e/summonerwars/summonerwars.e2e.ts`
  - 新增 stale-seat 在线房 E2E

## 运行记录

1. 后端定向测试

```powershell
npx vitest run src/engine/transport/__tests__/server.test.ts -t "online AI watchdog 完成 legal action 恢复后也应写入系统反馈"
```

结果：通过

关键日志：

- `online-ai-watchdog recovered stalled AI via legal action`
- `online-ai-watchdog feedback reported`
- `incidentKind: "legal-action-recovered"`

2. E2E

```powershell
$env:CODEX_MANAGED_BY_NPM='1'
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "在线 AI 回合起始若 seatState 落后上一拍 draw，不得在 8 秒兜底中直接跳过 summon，且后续应由 watchdog 真正召唤单位"
```

结果：通过

## 截图证据

### 1. 注入 authoritative `summon` 后，2.5 秒内没有被客户端错误跳到 `move`

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-回合起始若-seatState-落后上一拍-draw，不得在-8-秒兜底中直接跳过-summon，且后续应由-watchdog-真正召唤单位\online-ai-stale-seat-before-guard.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-回合起始若-seatState-落后上一拍-draw，不得在-8-秒兜底中直接跳过-summon，且后续应由-watchdog-真正召唤单位\online-ai-stale-seat-after-guard.png`

肉眼观察：

- 两张图右侧调试面板都显示 `phase = summon`、`currentPlayer = 1`
- 棋盘上 AI 一侧在这两张图之间没有新增单位，说明没有发生“客户端 8 秒兜底先把 summon 跳没了”的情况
- 顶部仍是等待对手行动中的在线房界面，不是本地单机假场景

验收判断：

- 达到“不会先被客户端 force-end 直接跳过 summon”的验收标准

### 2. 随后由服务端 watchdog 真正召唤出新单位

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-回合起始若-seatState-落后上一拍-draw，不得在-8-秒兜底中直接跳过-summon，且后续应由-watchdog-真正召唤单位\online-ai-stale-seat-watchdog-summoned.png`

肉眼观察：

- AI 上半场城门右侧新增一张亡灵单位卡面，位置对应新召唤落点
- 右上角 AI 魔力从前两张图的 `3` 下降到 `1`，与一次常规亡灵单位召唤成本一致
- 调试面板仍显示 `phase = summon`、`currentPlayer = 1`，说明这不是靠直接跳阶段掩盖问题，而是 watchdog 在 summon 阶段代打了合法召唤

验收判断：

- 达到“watchdog 真正合法召唤单位，而不是空过 summon”的验收标准

## 结论

- 之前这类现象的关键风险点，确实包含客户端 `MatchRoom` 的 `active-turn` 自动 force-end
- 现在客户端不再接管 `active-turn`
- 服务端 watchdog 会优先走 legal action
- 若 legal action 成功：
  - 现在会写 `legal-action-recovered` feedback
  - 也会补发状态广播，前端可看到真实 summon 结果

## 剩余风险

- 目前新增的 `legal-action-recovered` 属于“已恢复 incident”留痕，不是 `failed` 告警；后续若要在管理台单独筛“被 watchdog 救回的 AI 房间”，建议再补 UI 侧筛选口径或统计口径
