import { describe, it, expect, vi } from 'vitest';
import { executeActionHook, getVisibleActions } from '../runtime/actionHooks';

const baseAction = {
  id: 'action-1',
  label: '动作',
  scope: 'all' as const,
};

describe('executeActionHook', () => {
  it('空钩子应返回错误', async () => {
    const result = await executeActionHook({
      action: { ...baseAction, hookCode: '' },
      context: {},
      state: null,
      sdk: null,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('动作钩子为空');
  });

  it('非函数表达式应返回错误', async () => {
    const result = await executeActionHook({
      action: { ...baseAction, hookCode: 'const value = 1;' },
      context: {},
      state: null,
      sdk: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('动作钩子需要函数表达式');
  });

  it('同步钩子应执行成功', async () => {
    const context = { hit: false };
    const result = await executeActionHook({
      action: {
        ...baseAction,
        hookCode: '(payload) => { payload.context.hit = true; }',
      },
      context,
      state: null,
      sdk: null,
    });

    expect(result.success).toBe(true);
    expect(context.hit).toBe(true);
  });

  it('异步钩子应执行成功', async () => {
    const context = { hit: false };
    const result = await executeActionHook({
      action: {
        ...baseAction,
        hookCode: 'async (payload) => { payload.context.hit = true; }',
      },
      context,
      state: null,
      sdk: null,
    });

    expect(result.success).toBe(true);
    expect(context.hit).toBe(true);
  });

  it('返回命令对象应自动派发', async () => {
    const sendCommand = vi.fn().mockReturnValue('cmd-1');
    const sdk = { sendCommand } as unknown as Parameters<typeof executeActionHook>[0]['sdk'];
    const context = { componentId: 'comp-1', componentType: 'hand-zone' };
    const result = await executeActionHook({
      action: {
        ...baseAction,
        hookCode: '(payload) => ({ type: "PASS", payload: { foo: 1 } })',
      },
      context,
      state: null,
      sdk,
    });

    expect(result.success).toBe(true);
    expect(result.commandId).toBe('cmd-1');
    expect(sendCommand).toHaveBeenCalledWith(
      'PASS',
      expect.objectContaining({
        actionId: 'action-1',
        actionLabel: '动作',
        componentId: 'comp-1',
        componentType: 'hand-zone',
        foo: 1,
      }),
      undefined
    );
  });

  it('选中卡牌应随命令派发', async () => {
    const sendCommand = vi.fn().mockReturnValue('cmd-1');
    const sdk = { sendCommand } as unknown as Parameters<typeof executeActionHook>[0]['sdk'];
    const context = {
      componentId: 'comp-1',
      componentType: 'hand-zone',
      selectedCardIds: ['card-1', 'card-2'],
    };
    const result = await executeActionHook({
      action: {
        ...baseAction,
        hookCode: '(payload) => ({ type: "PLAY_CARD" })',
      },
      context,
      state: null,
      sdk,
    });

    expect(result.success).toBe(true);
    expect(sendCommand).toHaveBeenCalledWith(
      'PLAY_CARD',
      expect.objectContaining({
        selectedCardIds: ['card-1', 'card-2'],
      }),
      undefined
    );
  });

  it('返回命令数组应依次派发', async () => {
    const sendCommand = vi.fn()
      .mockReturnValueOnce('cmd-1')
      .mockReturnValueOnce('cmd-2');
    const sdk = { sendCommand } as unknown as Parameters<typeof executeActionHook>[0]['sdk'];
    const result = await executeActionHook({
      action: {
        ...baseAction,
        hookCode: '(payload) => ([{ type: "A" }, { type: "B" }])',
      },
      context: { componentId: 'comp-1', componentType: 'hand-zone' },
      state: null,
      sdk,
    });

    expect(result.success).toBe(true);
    expect(result.commandId).toBe('cmd-1');
    expect(sendCommand).toHaveBeenCalledTimes(2);
  });

  it('返回命令但 SDK 不可用应失败', async () => {
    const result = await executeActionHook({
      action: {
        ...baseAction,
        hookCode: '(payload) => ({ type: "PASS" })',
      },
      context: { componentId: 'comp-1', componentType: 'hand-zone' },
      state: null,
      sdk: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('动作钩子无法派发命令：SDK 不可用');
  });
});

describe('getVisibleActions', () => {
  const actions = [
    { id: 'a1', label: '动作A', scope: 'current-player' as const },
    { id: 'a2', label: '动作B', scope: 'all' as const },
    { id: 'a3', label: '动作C' },
  ];

  it('禁用动作钩子时应返回空数组', () => {
    const result = getVisibleActions({
      actions,
      allowActionHooks: false,
      isCurrentPlayer: true,
    });

    expect(result).toEqual([]);
  });

  it('当前玩家可见时应包含 current-player 与 all', () => {
    const result = getVisibleActions({
      actions,
      allowActionHooks: true,
      isCurrentPlayer: true,
    });

    expect(result.map(item => item.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('非当前玩家时仅保留 all', () => {
    const result = getVisibleActions({
      actions,
      allowActionHooks: true,
      isCurrentPlayer: false,
    });

    expect(result.map(item => item.id)).toEqual(['a2', 'a3']);
  });
});
