# E2E 测试示例模板

本文只展示 E2E 用例的结构。测试分层、黄金链资格、截图证据和状态注入边界以 [E2E 标准](../../.spec/knowledge/standards/e2e-verification.md) 为准。

## 适用

- 写新的真实入口 E2E 或场景注入 E2E 前，用本文检查结构是否完整。
- 需要具体 API 时查 [`testing-tools-quick-reference`](../testing-tools-quick-reference.md)。

## 真实入口 E2E 骨架

```ts
test('player can complete the target flow', async ({ page }) => {
  await page.goto('/games/<gameId>');

  await page.getByRole('button', { name: /start/i }).click();
  await expect(page.getByText(/ready/i)).toBeVisible();

  await page.getByRole('button', { name: /confirm/i }).click();
  await expect(page.getByText(/result/i)).toBeVisible();
});
```

## 场景注入 E2E 骨架

```ts
test('scenario state exposes the expected branch', async ({ page }) => {
  await page.goto('/games/<gameId>');
  await waitForTestHarness(page);

  await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({
      core: { /* minimal scenario state */ },
    });
  });

  await expect(page.getByText(/expected branch/i)).toBeVisible();
});
```

## 必查点

- 用例名说明它是“真实入口”还是“场景注入”。
- 真实入口用例只靠用户可执行动作、页面控件和合法系统结算推进。
- 使用 TestHarness、fixture、服务端注入或手工状态替换后，只能登记为场景注入 / 代表态证据。
- 注入后必须断言状态或 UI 已实际生效。
- 截图只作为证据补充，不能替代关键断言。
