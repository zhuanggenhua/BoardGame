# Change: 重构在线 AI 决策视图与可见性边界

## Why
- 当前在线 AI 决策在 `sharedState` 与 seat `latestState` 之间使用粗粒度切换：seat 视图一旦被判定为 stale，客户端 AI 会直接跳过整个 seat，导致公开 setup / 公开决策也一起失效。
- 这不是 SummonerWars 单点问题，而是所有在线 AI 游戏的框架级缺口：系统尚未显式建模“本次 AI 决策依赖公共真相，还是依赖 seat 私有增量”。
- 现有实现容易在两个方向同时出错：一方面 stale seat 会把公共 phase / currentPlayer 也带旧；另一方面一刀切的 freshness gate 会把本可基于公共状态完成的 AI 决策整体阻断。

## What Changes
- 引入统一的在线 AI 决策视图层：以 authoritative shared 为公共真相，以 private overlay 承载 seat 私有信息。
- 新增框架级“决策可见性”解析：默认自动推断本次决策是否需要 private overlay，而不是按游戏/阶段名散落硬编码。
- 客户端 `OnlineAiSeatBridge` 与服务端 watchdog / legal-action recovery 统一复用同一套视图解析语义，避免一边能决策、一边只能卡死或不留反馈。
- 为公开 setup / 公开决策建立 shared fallback 规则；为 hidden interaction / response window / 私有候选项建立 private-required 规则。
- 补齐相关测试与文档，明确在线 AI 决策的“公共真相 + 私有增量”原则。

## Impact
- Affected specs:
  - `systems-layer`
  - `online-ai-decision-view`（新增 capability）
- Affected code:
  - `src/pages/MatchRoom.tsx`
  - `src/engine/ai/localRunner.ts`
  - `src/engine/transport/server.ts`
  - `src/engine/transport/onlineAiRecovery.ts`
  - `src/pages/__tests__/matchSeatValidation.test.ts`
  - `src/engine/transport/__tests__/server.test.ts`
  - 对应 `e2e/src/**` 镜像文件
  - `.spec/knowledge/standards/engine-systems.md`

