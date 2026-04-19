## Context
- 在线 AI 当前同时依赖两类状态：房间级 `sharedState` 与每个 AI seat 的 `latestState`。前者是公共真相，后者是带私有信息的 seat 视图快照。
- 现有实现把“seat 是否 fresh”与“AI 是否能决策”绑定过紧：seat stale 时整份 seat 视图被拒绝，导致公开 setup / 公开决策也无法继续。
- 反过来，如果无条件信任整份 seat 快照，又会把过期的公共 phase / turn / currentPlayer 一并带入决策，导致 stale-seat 抢跑。

## Goals / Non-Goals
- Goals:
  - 让在线 AI 决策统一基于“公共真相 + 私有增量”视图，而不是在 shared / seat 快照之间二选一。
  - 默认自动推断本次决策是否依赖 private overlay，覆盖绝大多数游戏，不要求每个游戏逐条手配。
  - 保持当前 stale-seat 防护，避免旧的 summon / response stale 抢跑回归。
  - 让客户端桥接层与服务端 watchdog 读同一套决策视图语义。
- Non-Goals:
  - 不把所有在线 AI 正常执行主链迁移到服务端常驻 worker。
  - 不在本轮重写所有游戏 AI runtime，只允许最小量按需覆盖。
  - 不改变 playerView 的隐私边界；private overlay 仍必须受 seat 可见性约束。

## Decision

### Decision: 在线 AI 统一使用 `authoritative shared + private overlay` 视图
- 公共字段（phase、turn、currentPlayer、公共棋盘、公共资源、公共 setup 状态）始终以 authoritative shared 为准。
- 私有字段（hidden interaction、seat 专属 options、私有手牌、私有候选目标）从 seat overlay 读取。
- 决策视图不再是“整份 shared”或“整份 seat 快照”二选一，而是显式组合。
- Why:
  - 这样既不会因为 seat stale 把旧的公共字段整份带进来，也不会因为缺少 seat 私有信息而让合法交互完全不可解。

### Decision: 框架默认自动推断“本次决策是否需要 private overlay”
- 默认规则优先根据当前决策输入来源推断，而不是按游戏名/阶段名散落硬编码。
- 推断结果至少区分：
  - `shared`：只依赖公共真相即可决策
  - `private-required`：必须依赖与当前 shared 对齐的 private overlay
- 仅当框架无法稳定从结构推断时，游戏层 runtime 才允许少量覆盖。
- Why:
  - 这符合项目“智能默认 + 可覆盖”的设计原则，避免每个游戏、每个阶段都手工配置。

### Decision: seat overlay freshness 只影响 private-required 决策
- 若当前决策被判定为 `shared`，即使 seat overlay 缺失或 stale，AI 也可以继续基于 authoritative shared 决策。
- 若当前决策被判定为 `private-required`，seat overlay stale 时必须阻止 AI 决策，并把恢复交给等待/服务端 watchdog。
- Why:
  - 这样既能恢复公开 setup 决策，又不会回退 stale-seat 抢跑旧 bug。

### Decision: 客户端与服务端复用同一套决策视图解析 helper
- `OnlineAiSeatBridge` 的 `visibleStateResolver`、服务端 `resolveNextAiAction` 调用点、watchdog legal-action recovery 均复用统一 helper。
- 同一 AI 决策在客户端桥接层与服务端 watchdog 中必须得出一致的“可否继续 / 是否需要 private overlay”结论。
- Why:
  - 否则会继续出现一边能恢复、一边直接跳过，或一边留 feedback、一边完全静默的分叉行为。

## Proposed API Shape

### 决策视图解析
```ts
type OnlineAiDecisionVisibility = 'shared' | 'private-required';

type ResolvedOnlineAiDecisionView = {
  visibility: OnlineAiDecisionVisibility;
  sharedState: MatchState<unknown>;
  privateOverlay: MatchState<unknown> | null;
  canDecide: boolean;
  blockedReason: 'missing-private-overlay' | 'stale-private-overlay' | null;
};
```

### 默认推断输入
- 当前 shared authoritative 状态
- seat overlay（若存在）
- 当前 interaction / responseWindow / legalActions 诊断
- 可选的 runtime 覆盖 hook

## Risks / Trade-offs
- 默认推断若过于激进，可能误把需要私有信息的场景当成 shared。
  - Mitigation: 默认规则保守，看到 private-only 结构就要求 overlay；极少数场景再由 runtime 覆盖。
- 统一 helper 改造会触碰客户端桥接层与服务端 recovery 两边，回归面较大。
  - Mitigation: 必须同时补 shared 决策与 private-required 决策两类测试，并保留现有 stale-seat E2E 作为保护。

## Migration Plan
1. 先引入共享 helper，只在现有调用点做等价替换。
2. 先覆盖公开 setup 与私有 hidden/response 两个最典型决策类型。
3. 确认 stale-seat 保护未回退后，再清理旧的散落 freshness 判断。
4. 更新文档，要求后续新游戏/新交互若有特殊可见性，再做少量 runtime override。

