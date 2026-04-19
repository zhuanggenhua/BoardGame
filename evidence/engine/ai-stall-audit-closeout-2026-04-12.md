# 全量审计收口汇总：AI 卡死 / response-window 重触发（DiceThrone / SummonerWars / SmashUp）（2026-04-12）

> 口径：**本轮未复跑测试，仅引用历史证据与既有审计文档。**
> 目标：基于既有审计证据完成跨游戏收口判断、未覆盖风险汇总、行动项责任链建议。

## 审计范围
- DiceThrone：AI 交互卡死 / response-window 重触发
- SummonerWars：AI 交互可见性与本地 mode 造成的“假卡死/重复提示”
- SmashUp：在线 AI watchdog 兜底链与响应窗口/afterScoring 组合链

## 证据来源（单一真相源）
- evidence/engine/ai-stall-loop-full-chain-audit-2026-04-12.md
- evidence/dicethrone/dicethrone-ai-interaction-audit-2026-04-11.md
- evidence/dicethrone/dicethrone-response-window-retrigger-audit-2026-04-12.md
- evidence/summonerwars/summonerwars-ai-interaction-audit-2026-04-12.md
- evidence/smashup-ai-interaction-audit-2026-04-11.md

## 收口判断（明确结论）

### DiceThrone
- **结论：未完全收口（核心主链有证据，但仍存在关键未覆盖风险）**
- 依据：
  - response-window 重触发已补门禁与 AI 行为收敛，但仍有 rollConfirmed 重置链、Undo/重放序列导致重复开窗的未覆盖项。
  - action-loop detector 对经济动作（SELL/DISCARD/UNDO_SELL）存在**结构性盲区**，不能视为“已兜底”。
  - selectStatus/selectPlayer 交互仍有“可选但不可执行”的卡死风险。

### SummonerWars
- **结论：未收口（结构性根因未闭环）**
- 依据：
  - 大量等待态仍停留在本地 UI mode，AI/自动反馈不可见；职责分裂为主要根因（D41）。
  - 仅部分交互迁入 sys.interaction，Phase B 范围仍为高风险盲区。
  - 重复提示/音效循环更像“本地提示重建”，不是 response-window 真正重开。

### SmashUp
- **结论：主链可宣称“已拿到强证据”，但全量审计未收口**
- 依据：
  - watchdog 主链（force-skip / force-end-turn）已有历史 E2E 证据。
  - 仍存在多条 skipped 的高风险历史用例与响应牌矩阵未穷尽，不能宣称全量已审完。

## 未覆盖风险汇总（跨游戏一致口径）

### 跨游戏共性
1. **action-loop detector 覆盖面不足**：仅 repeat/alternating，且依赖 ActionLog allowlist，三步循环与“日志未收录动作”无法检测。
2. **“等待态真相源分裂”**：服务端/引擎与 UI 本地 mode 并存时，AI/自动反馈不可见。
3. **response-window 重触发的“序列/签名”边界需严格治理**：Undo/回放/重放路径仍可能引发重复开窗。

### DiceThrone
- 经济动作循环（弃牌/卖牌/撤回）ActionLog 不可见 → detector 盲区。
- selectStatus/selectPlayer 交互中“validate 放行但 execute 不产事件”导致交互悬空。
- rollConfirmed 被其他链路重置后 reopen 边界未完全闭环。

### SummonerWars
- Phase B 本地 mode（rapid_fire/withdraw/afterMove/event card 多步/magic 二选一）仍为 AI 盲区。
- 请求事件无稳定 requestId，重复事件会重建提示与音效。

### SmashUp
- skipped 历史高风险用例未恢复；响应牌矩阵未逐卡覆盖。

## 行动项 → 责任链建议清单（仅方案，不改代码）

### 引擎/传输层（Platform）
1. **action-loop detector 数据源补齐或替代**
   - 交付：扩展 ActionLog allowlist 或新增“动作序列追踪”信号源；完善检测说明文档。
2. **watchdog 噪音抑制与反馈可解释性**
   - 交付：human responder 门禁保持；反馈上报包含无法选择原因 + 动作轨迹。

### DiceThrone 游戏层
1. **response-window reopen 边界治理**
   - 交付：明确 rollConfirmed 重置链与 reopen 条件；补“经济动作循环”最小回归。
2. **selectStatus/selectPlayer 交互兜底**
   - 交付：不可移除/不可选时阻断或 emergency cancel，避免交互悬空。

### SummonerWars 游戏层
1. **Phase B 本地 mode 迁移到 sys.interaction**
   - 交付：rapid_fire / withdraw / afterMove / event card 多步 / magic 二选一迁移完成，AI 可解矩阵更新。
2. **请求事件增加稳定 requestId / interactionId**
   - 交付：重复事件去重与可追踪。

### SmashUp 游戏层
1. **恢复 skipped 高风险用例**
   - 交付：隐藏交互 + afterScoring 链式传递 + 最后基地换基地的最小回归集合。
2. **响应牌矩阵最小覆盖**
   - 交付：每派系至少 1 条代表性 response 牌的行为测试。

### 前端/体验层
1. **失败提示与兜底提示口径统一**
   - 交付：区分“等待真人响应”与“AI 无解卡死”，避免误导。

## 最终结论（本轮）
- **DiceThrone：未完全收口。**
- **SummonerWars：未收口。**
- **SmashUp：主链有历史强证据，但全量审计未收口。**

> 本结论基于既有证据文档与静态审计，**本轮未复跑测试，仅引用历史证据**。

