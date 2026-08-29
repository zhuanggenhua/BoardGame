# E2E 测试重构旧提案归档

本文是旧测试重构提案，不是当前测试体系设计。当前 E2E 口径以 [`.spec` E2E 标准](../../../.spec/knowledge/standards/e2e-verification.md)、[`automated-testing`](../../automated-testing.md) 和当前测试脚本为准。本文保留当时的问题分析和方案取舍，避免只剩一句“用 fixture”。

## 当时问题

旧提案认为当时 E2E 的主要成本来自：

- 启动慢：每次测试要启动前端、游戏服务器和 API 服务器。
- 设置慢：例如 Smash Up 派系选择需要完整 UI 流程，可能消耗 30-60 秒。
- 不稳定：网络、UI 选择器、动画、随机数、抽牌/洗牌和异步状态同步都会引入波动。
- 难并行：服务端缺少 per-test 状态隔离时只能串行，旧配置常见 `workers: 1`。

## 方案 1：专用 test 游戏模式

旧方案设想新增与 `online` / `tutorial` 并列的 `test` 模式：

```ts
type GameMode = 'online' | 'tutorial' | 'test';
```

设想能力：

- 跳过派系选择，直接指定派系。
- 通过 URL 参数或 TestHarness 注入初始状态。
- 固定随机种子。
- 跳过动画、教学提示等慢路径。

旧 URL 示例：

```text
/play/smashup/test?p0=robots,aliens&p1=zombies,pirates&seed=12345&state=base64...
```

当时优点：

- 快，能跳过冗长 setup。
- 稳定，确定性随机和状态注入减少波动。
- 易并行，每个测试可独立状态。

当时缺点：

- 需要修改游戏代码。
- 与真实用户体验有差异。
- 维护成本较高。

## 方案 2：Fixtures + 状态注入

旧方案的短期推荐是保留 `online` 模式，通过 Playwright fixtures 和 TestHarness 优化 setup。

旧设想能力：

- `quickMatch(factions)` 快速建局。
- `injectState(partialState)` 注入目标状态。
- `random.setSeed(seed)` 固定随机性。

旧用例形态：

```ts
test('wizard portal should work', async ({ quickMatch, injectState }) => {
  const page = await quickMatch([
    ['wizard', 'robots'],
    ['aliens', 'pirates'],
  ]);

  await injectState({
    players: {
      '0': {
        hand: [{ uid: 'portal-1', defId: 'wizard_portal' }],
        deck: [{ uid: 'zapbot-1', defId: 'robot_zapbot' }],
      },
    },
  });

  await page.click('[data-card-uid="portal-1"]');
});
```

当时优点：

- 不必新增游戏模式。
- 比纯真实 UI 流程更快。
- 可复用 fixtures，减少重复测试代码。

当时缺点：

- 仍需要完整服务器。
- 仍有 WebSocket 和网络延迟。
- 如果服务端状态不隔离，仍难完全并行。

## 方案 3：混合分层

旧长期建议是混合方案：

- 快速冒烟：使用测试模式或更低层入口，覆盖核心快乐路径。
- 完整 E2E：使用 `online` 模式 + fixtures，覆盖复杂交互。
- 关键黄金链：少量测试完整走真实 UI 流程，不使用状态注入。

旧配置示例：

```ts
export default defineConfig({
  projects: [
    { name: 'smoke', testMatch: '**/*.smoke.e2e.ts', fullyParallel: true },
    { name: 'e2e', testMatch: '**/*.e2e.ts', fullyParallel: false },
    { name: 'critical', testMatch: '**/*.critical.e2e.ts', fullyParallel: false },
  ],
});
```

## 保留裁决

旧提案当时建议：

- 短期：优先做 fixture + 状态注入，降低 setup 成本。
- 长期：用混合分层区分速度、稳定性和真实性。
- 真实黄金链只能证明连续玩家流程；状态注入链只能作为分段或代表态证据。

## 当前使用口径

- 不要直接按本文新增 `test` 模式；是否需要测试模式要回到当前 `.spec` 标准和现有测试架构。
- 如果用户要“真实 E2E”，不能用状态注入代表完整用户流程。
- 如果目标是规则或状态机回归，优先用更窄的领域测试或代表态测试，避免用慢 E2E 承担所有覆盖。
