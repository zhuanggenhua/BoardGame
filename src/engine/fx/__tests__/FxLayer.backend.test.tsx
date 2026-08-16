/* @vitest-environment happy-dom */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FxLayer } from '../FxLayer';
import { FxRegistry } from '../FxRegistry';
import type { FxRenderBackend, FxBackendRuntime } from '../backend';
import type { FxBus } from '../useFxBus';

function createTestBus(): FxBus {
  return {
    push: vi.fn(),
    pushEvent: vi.fn(),
    pushSequence: vi.fn(),
    cancelSequence: vi.fn(),
    activeEffects: [],
    subscribe: vi.fn(() => vi.fn()),
    getSnapshot: vi.fn(() => []),
    removeEffect: vi.fn(),
    registry: new FxRegistry(),
    fireImpact: vi.fn(),
  };
}

describe('FxLayer backend', () => {
  afterEach(() => {
    cleanup();
  });

  it('传入 backend 时挂载外部后端，并由后端接管事件订阅', () => {
    const bus = createTestBus();
    const updateSpy = vi.fn();
    const destroySpy = vi.fn();
    const onEffectComplete = vi.fn();
    const onEffectImpact = vi.fn();
    let runtimeFromMount: FxBackendRuntime | null = null;

    const backend: FxRenderBackend = {
      kind: 'custom',
      mount: ({ element }, runtime) => {
        element.setAttribute('data-mounted-backend', 'custom');
        runtimeFromMount = runtime;
        return {
          update: updateSpy,
          destroy: destroySpy,
        };
      },
    };

    const getCellPosition = vi.fn(() => ({ left: 1, top: 2, width: 3, height: 4 }));

    const { container, rerender, unmount } = render(
      <FxLayer
        bus={bus}
        backend={backend}
        getCellPosition={getCellPosition}
        onEffectComplete={onEffectComplete}
        onEffectImpact={onEffectImpact}
      />,
    );

    expect(container.querySelector('[data-mounted-backend="custom"]')).not.toBeNull();
    expect(bus.subscribe).not.toHaveBeenCalled();
    expect(runtimeFromMount?.getCellPosition(0, 0)).toEqual({ left: 1, top: 2, width: 3, height: 4 });

    runtimeFromMount?.completeEffect('fx-1', 'fx.test');
    expect(onEffectComplete).toHaveBeenCalledWith('fx-1', 'fx.test');
    expect(bus.removeEffect).toHaveBeenCalledWith('fx-1');

    runtimeFromMount?.fireImpact('fx-2', 'fx.hit');
    expect(bus.fireImpact).toHaveBeenCalledWith('fx-2');
    expect(onEffectImpact).toHaveBeenCalledWith('fx-2', 'fx.hit');

    const nextGetCellPosition = vi.fn(() => ({ left: 5, top: 6, width: 7, height: 8 }));
    rerender(
      <FxLayer
        bus={bus}
        backend={backend}
        getCellPosition={nextGetCellPosition}
      />,
    );

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      bus,
      getCellPosition: nextGetCellPosition,
    }));

    unmount();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
