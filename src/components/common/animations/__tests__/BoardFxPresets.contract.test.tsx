/* @vitest-environment happy-dom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../SummonHybridEffect', () => ({
  SummonHybridEffect: ({
    durationScale,
    visualScale,
    dimStrength,
    pillarWidthRatio,
  }: {
    durationScale?: number;
    visualScale?: number;
    dimStrength?: number;
    pillarWidthRatio?: number;
  }) => (
    <div
      data-testid="mock-summon-hybrid"
      data-duration-scale={durationScale ?? ''}
      data-visual-scale={visualScale ?? ''}
      data-dim-strength={dimStrength ?? ''}
      data-pillar-width-ratio={pillarWidthRatio ?? ''}
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
    expect(effect).toHaveAttribute('data-pillar-width-ratio', '');
  });

  it('只有游戏侧显式传参时才改变召唤调参', () => {
    render(
      <BoardSummonEffectPreset
        cellBox={CELL_BOX}
        durationScale={2.4}
        visualScale={1.55}
        dimStrength={0}
        pillarWidthRatio={1}
      />,
    );

    const effect = screen.getByTestId('mock-summon-hybrid');
    expect(effect).toHaveAttribute('data-duration-scale', '2.4');
    expect(effect).toHaveAttribute('data-visual-scale', '1.55');
    expect(effect).toHaveAttribute('data-dim-strength', '0');
    expect(effect).toHaveAttribute('data-pillar-width-ratio', '1');
  });

  it('只有显式 overlayStyle 才渲染卡缘光圈层，默认游戏不受影响', () => {
    const { rerender } = render(<BoardSummonEffectPreset cellBox={CELL_BOX} />);
    expect(screen.queryByTestId('board-fx-summon-preset-halo')).toBeNull();

    rerender(
      <BoardSummonEffectPreset
        cellBox={CELL_BOX}
        overlayStyle={{ border: '3px solid rgb(186, 230, 253)' }}
        overlayTestId="shared-summon-halo"
      />,
    );
    expect(screen.getByTestId('shared-summon-halo').style.border).toContain('3px');
  });
});
