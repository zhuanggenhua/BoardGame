import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FxAnchorSnapshot, FxEvent } from '../../../engine/fx';
import { SU_FX, smashUpFxRegistry } from '../ui/fxSetup';
import { SMASH_UP_TABLE_FX_SURFACE_ID, smashUpBaseAnchorId } from '../ui/useGameEvents';

function createBaseSnapshot(baseIndex: number): FxAnchorSnapshot {
  const anchorId = smashUpBaseAnchorId(baseIndex);
  return {
    surfaceId: SMASH_UP_TABLE_FX_SURFACE_ID,
    anchorId,
    anchorKind: 'base',
    entityRef: anchorId,
    box: { left: 22, top: 20, width: 20, height: 16 },
    center: { xPct: 32, yPct: 28 },
    size: { widthPct: 20, heightPct: 16 },
    capturedAt: 123,
    mode: 'spawn-snapshot',
  };
}

function getRenderer(cue: string) {
  const renderer = smashUpFxRegistry.resolve(cue)?.renderer;
  expect(renderer).toBeDefined();
  return renderer!;
}

const getCellPosition = () => ({ left: 0, top: 0, width: 0, height: 0 });

describe('Smash Up FX anchor snapshots', () => {
  afterEach(() => {
    cleanup();
  });

  it('力量浮字使用 table-local 基地快照，而不是旧 screen 坐标', () => {
    const targetSnapshot = createBaseSnapshot(2);
    const Renderer = getRenderer(SU_FX.POWER_CHANGE);
    const event: FxEvent = {
      id: 'fx-power',
      cue: SU_FX.POWER_CHANGE,
      ctx: {
        space: 'table',
        surfaceId: SMASH_UP_TABLE_FX_SURFACE_ID,
        targetSnapshot,
      },
      params: {
        delta: 3,
        targetSnapshot,
        position: { left: 999, top: 999 },
      },
    };

    const { container } = render(
      <div style={{ position: 'relative', width: 1000, height: 600 }}>
        <Renderer
          event={event}
          getCellPosition={getCellPosition}
          onComplete={vi.fn()}
          onImpact={vi.fn()}
        />
      </div>,
    );

    const feedback = container.querySelector<HTMLElement>('[data-target-anchor-id="base:2"]');
    expect(feedback).not.toBeNull();
    expect(feedback?.className).toContain('absolute');
    expect(feedback?.style.left).toBe('42.7%');
    expect(feedback?.style.top).toBe('18.8%');
  });

  it('基地计分反馈使用 table-local 基地快照居中显示', () => {
    const targetSnapshot = createBaseSnapshot(1);
    const Renderer = getRenderer(SU_FX.BASE_SCORED);
    const event: FxEvent = {
      id: 'fx-score',
      cue: SU_FX.BASE_SCORED,
      ctx: {
        space: 'table',
        surfaceId: SMASH_UP_TABLE_FX_SURFACE_ID,
        targetSnapshot,
      },
      params: {
        rankings: [{ playerId: '0', power: 8, vp: 3, playerName: 'P1' }],
        targetSnapshot,
      },
    };

    render(
      <div style={{ position: 'relative', width: 1000, height: 600 }}>
        <Renderer
          event={event}
          getCellPosition={getCellPosition}
          onComplete={vi.fn()}
          onImpact={vi.fn()}
        />
      </div>,
    );

    const feedback = screen.getByTestId('su-vp-gain-feedback-0');
    expect(feedback.getAttribute('data-target-anchor-id')).toBe('base:1');
    expect(feedback.className).toContain('absolute');
    expect(feedback.style.left).toBe('32%');
    expect(feedback.style.top).toBe('calc(28% + 0px)');
  });
});
