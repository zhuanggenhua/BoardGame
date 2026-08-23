# 单元测试示例模板

本文只展示领域 / 系统单元测试结构，不承载具体游戏规则示例。规则事实回到对应游戏的 `src/games/<gameId>/rule/` 或 `docs/games/<gameId>/sources/`。

## 领域行为骨架

```ts
it('applies the rule effect when all preconditions are met', () => {
  const state = createTestState();
  const command = {
    type: 'COMMAND_TYPE',
    playerId: '0',
    payload: { targetId: 'target' },
  };

  const events = executeCommand(state, command, testRandom);

  expect(events).toContainEqual(
    expect.objectContaining({
      type: 'EXPECTED_EVENT',
      payload: expect.objectContaining({ targetId: 'target' }),
    }),
  );
});
```

## 边界行为骨架

```ts
it('rejects the command when the target is illegal', () => {
  const state = createTestState({ illegalTarget: true });

  expect(() => executeCommand(state, illegalCommand, testRandom)).toThrow(/illegal/i);
});
```

## 必查点

- 测试名写现实行为，不只写内部函数名。
- 每个用例只证明一个规则判断或一个边界。
- 随机、骰子、抽牌和顺序必须可控。
- 失败分支要断言明确拒绝，不能只看状态没变。
- UI、截图和联网同步不放单元测试里证明。
