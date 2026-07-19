import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiceResultOverlay } from '../DiceResultOverlay';

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');
  const motion = new Proxy({}, {
    get: (_target, tag: string) => ReactModule.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
      ({ children, ...props }, ref) => ReactModule.createElement(tag, { ...props, ref }, children),
    ),
  });

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('../attackDebug', () => ({
  swAttackDebugLog: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (
      typeof options?.count === 'number' ? `${key}:${options.count}` : key
    ),
  }),
}));

describe('DiceResultOverlay', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('骰子揭示完成应先触发攻击动画入口，浮层关闭仍保留到展示时长结束', () => {
    vi.useFakeTimers();
    const onRevealComplete = vi.fn();
    const onClose = vi.fn();

    render(
      <DiceResultOverlay
        results={[{ faceIndex: 0, marks: ['melee'] }]}
        attackType="melee"
        hits={1}
        duration={3000}
        onRevealComplete={onRevealComplete}
        onClose={onClose}
      />,
    );

    expect(onRevealComplete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(onRevealComplete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onRevealComplete).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2200);
    });
    expect(onRevealComplete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('激励待结算时显示重掷与保留按钮且不自动关闭', () => {
    vi.useFakeTimers();
    const onReroll = vi.fn();
    const onKeep = vi.fn();
    const onClose = vi.fn();

    render(
      <DiceResultOverlay
        results={[{ faceIndex: 3, marks: ['special', 'ranged'] }]}
        attackType="melee"
        hits={0}
        duration={1000}
        pendingDecision
        onReroll={onReroll}
        onKeep={onKeep}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'actions.shourenRerollAll' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.shourenKeepRoll' }));
    expect(onReroll).toHaveBeenCalledTimes(1);
    expect(onKeep).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(3000));
    expect(onClose).not.toHaveBeenCalled();
  });
});
