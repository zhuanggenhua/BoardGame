/* @vitest-environment happy-dom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../SummonHybridEffect', () => ({
  SummonHybridEffect: ({
    durationScale,
    visualScale,
    dimStrength,
  }: {
    durationScale?: number;
    visualScale?: number;
    dimStrength?: number;
  }) => (
    <div
      data-testid="mock-summon-hybrid"
      data-duration-scale={durationScale ?? ''}
      data-visual-scale={visualScale ?? ''}
      data-dim-strength={dimStrength ?? ''}
    />
  ),
}));

import { BoardSummonEffectPreset } from '../BoardFxPresets';
import type { FxBox } from '../../../../engine/fx';

const CELL_BOX: FxBox = {
  left: 10,
  top: 20,
  width: 12,
  height: 16,
};

describe('BoardSummonEffectPreset contract', () => {
  afterEach(() => {
    cleanup();
  });

  it('默认不把单游戏召唤调参写入共享 preset', () => {
    render(<BoardSummonEffectPreset cellBox={CELL_BOX} />);

    const effect = screen.getByTestId('mock-summon-hybrid');
    expect(effect).toHaveAttribute('data-duration-scale', '');
    expect(effect).toHaveAttribute('data-visual-scale', '');
    expect(effect).toHaveAttribute('data-dim-strength', '');
  });

  it('只有游戏侧显式传参时才改变召唤调参', () => {
    render(
      <BoardSummonEffectPreset
        cellBox={CELL_BOX}
        durationScale={2.4}
        visualScale={1.55}
        dimStrength={0}
      />,
    );

    const effect = screen.getByTestId('mock-summon-hybrid');
    expect(effect).toHaveAttribute('data-duration-scale', '2.4');
    expect(effect).toHaveAttribute('data-visual-scale', '1.55');
    expect(effect).toHaveAttribute('data-dim-strength', '0');
  });
});
