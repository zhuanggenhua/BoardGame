/* @vitest-environment happy-dom */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FxLayer } from '../FxLayer';
import { FxRegistry } from '../FxRegistry';
import type { FxRenderBackend, FxBackendRuntime } from '../backend';
import type { FxBus } from '../useFxBus';
import type { FxEvent } from '../types';

function createTestBus(): FxBus {
  const emptyEffects: FxEvent[] = [];
  return {
    push: vi.fn(),
    pushEvent: vi.fn(),
    pushSequence: vi.fn(),
    cancelSequence: vi.fn(),
    activeEffects: emptyEffects,
    subscribe: vi.fn(() => vi.fn()),
    getSnapshot: vi.fn(() => emptyEffects),
    removeEffect: vi.fn(),
    registry: new FxRegistry(),
    fireImpact: vi.fn(),
  };
}

function createMutableTestBus(initialEffects: FxEvent[] = []): {
  bus: FxBus;
  setEffects: (nextEffects: FxEvent[]) => void;
} {
  let effects = initialEffects;
  const listeners = new Set<() => void>();
  const registry = new FxRegistry();
  const notify = () => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const bus: FxBus = {
    push: vi.fn(),
    pushEvent: vi.fn(),
    pushSequence: vi.fn(),
    cancelSequence: vi.fn(),
    get activeEffects() {
      return effects;
    },
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    getSnapshot: vi.fn(() => effects),
    removeEffect: vi.fn((id: string) => {
      effects = effects.filter((effect) => effect.id !== id);
      notify();
    }),
    registry,
    fireImpact: vi.fn(),
  };

  return {
    bus,
    setEffects: (nextEffects: FxEvent[]) => {
      effects = nextEffects;
      notify();
    },
  };
}

describe('FxLayer backend', () => {
  afterEach(() => {
    cleanup();
  });

  it('传入 backend 时挂载外部后端，并保留 FxLayer 统一生命周期订阅', () => {
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
    expect(bus.subscribe).toHaveBeenCalled();
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

  it('backend 路径中 FX 被总线外部移除时，同样触发 impact 和 complete', async () => {
    const { bus, setEffects } = createMutableTestBus([{
      id: 'fx-backend-stalled',
      cue: 'fx.backend.stalled',
      ctx: {},
      params: {},
    }]);
    const backend: FxRenderBackend = {
      kind: 'custom',
      mount: () => ({
        destroy: vi.fn(),
      }),
    };
    const onEffectImpact = vi.fn();
    const onEffectComplete = vi.fn();

    render(
      <FxLayer
        bus={bus}
        backend={backend}
        getCellPosition={() => ({ left: 0, top: 0, width: 0, height: 0 })}
        onEffectImpact={onEffectImpact}
        onEffectComplete={onEffectComplete}
      />,
    );

    await act(async () => {
      setEffects([]);
    });

    expect(bus.fireImpact).toHaveBeenCalledWith('fx-backend-stalled');
    expect(onEffectImpact).toHaveBeenCalledWith('fx-backend-stalled', 'fx.backend.stalled');
    expect(onEffectComplete).toHaveBeenCalledWith('fx-backend-stalled', 'fx.backend.stalled');
  });
});

describe('FxLayer React lifecycle', () => {
  afterEach(() => {
    cleanup();
  });

  it('FX 被总线外部移除但渲染器没有完成回调时，统一触发 impact 和 complete', async () => {
    const { bus, setEffects } = createMutableTestBus([{
      id: 'fx-stalled',
      cue: 'fx.stalled',
      ctx: {},
      params: {},
    }]);
    bus.registry.register('fx.stalled', () => <div data-testid="stalled-fx" />);
    const onEffectImpact = vi.fn();
    const onEffectComplete = vi.fn();

    render(
      <FxLayer
        bus={bus}
        getCellPosition={() => ({ left: 0, top: 0, width: 0, height: 0 })}
        onEffectImpact={onEffectImpact}
        onEffectComplete={onEffectComplete}
      />,
    );

    await act(async () => {
      setEffects([]);
    });

    expect(bus.fireImpact).toHaveBeenCalledWith('fx-stalled');
    expect(onEffectImpact).toHaveBeenCalledWith('fx-stalled', 'fx.stalled');
    expect(onEffectComplete).toHaveBeenCalledWith('fx-stalled', 'fx.stalled');
  });

  it('渲染器正常 impact 和 complete 后，不再重复触发共享兜底', async () => {
    const { bus } = createMutableTestBus([{
      id: 'fx-normal',
      cue: 'fx.normal',
      ctx: {},
      params: {},
    }]);
    bus.registry.register('fx.normal', ({ onImpact, onComplete }) => (
      <div>
        <button data-testid="normal-impact" onClick={onImpact} type="button">impact</button>
        <button data-testid="normal-complete" onClick={onComplete} type="button">complete</button>
      </div>
    ));
    const onEffectImpact = vi.fn();
    const onEffectComplete = vi.fn();

    const view = render(
      <FxLayer
        bus={bus}
        getCellPosition={() => ({ left: 0, top: 0, width: 0, height: 0 })}
        onEffectImpact={onEffectImpact}
        onEffectComplete={onEffectComplete}
      />,
    );

    await act(async () => {
      view.getByTestId('normal-impact').click();
      view.getByTestId('normal-impact').click();
      view.getByTestId('normal-complete').click();
    });

    expect(bus.fireImpact).toHaveBeenCalledTimes(1);
    expect(bus.fireImpact).toHaveBeenCalledWith('fx-normal');
    expect(onEffectImpact).toHaveBeenCalledTimes(1);
    expect(onEffectImpact).toHaveBeenCalledWith('fx-normal', 'fx.normal');
    expect(onEffectComplete).toHaveBeenCalledTimes(1);
    expect(onEffectComplete).toHaveBeenCalledWith('fx-normal', 'fx.normal');
  });

  it('渲染器直接 complete 但没有 impact 时，完成前合成一次 impact', async () => {
    const { bus } = createMutableTestBus([{
      id: 'fx-complete-only',
      cue: 'fx.complete-only',
      ctx: {},
      params: {},
    }]);
    bus.registry.register('fx.complete-only', ({ onComplete }) => (
      <button data-testid="complete-only" onClick={onComplete} type="button">complete</button>
    ));
    const onEffectImpact = vi.fn();
    const onEffectComplete = vi.fn();

    const view = render(
      <FxLayer
        bus={bus}
        getCellPosition={() => ({ left: 0, top: 0, width: 0, height: 0 })}
        onEffectImpact={onEffectImpact}
        onEffectComplete={onEffectComplete}
      />,
    );

    await act(async () => {
      view.getByTestId('complete-only').click();
    });

    expect(bus.fireImpact).toHaveBeenCalledTimes(1);
    expect(bus.fireImpact).toHaveBeenCalledWith('fx-complete-only');
    expect(onEffectImpact).toHaveBeenCalledTimes(1);
    expect(onEffectImpact).toHaveBeenCalledWith('fx-complete-only', 'fx.complete-only');
    expect(onEffectComplete).toHaveBeenCalledTimes(1);
    expect(onEffectComplete).toHaveBeenCalledWith('fx-complete-only', 'fx.complete-only');
  });

  it('渲染器已触发 impact 后被总线外部移除时，只补 complete 不重复 impact', async () => {
    const { bus, setEffects } = createMutableTestBus([{
      id: 'fx-impacted',
      cue: 'fx.impacted',
      ctx: {},
      params: {},
    }]);
    bus.registry.register('fx.impacted', ({ onImpact }) => (
      <button data-testid="impacted-impact" onClick={onImpact} type="button">impact</button>
    ));
    const onEffectImpact = vi.fn();
    const onEffectComplete = vi.fn();

    const view = render(
      <FxLayer
        bus={bus}
        getCellPosition={() => ({ left: 0, top: 0, width: 0, height: 0 })}
        onEffectImpact={onEffectImpact}
        onEffectComplete={onEffectComplete}
      />,
    );

    await act(async () => {
      view.getByTestId('impacted-impact').click();
    });
    await act(async () => {
      setEffects([]);
    });

    expect(bus.fireImpact).toHaveBeenCalledTimes(1);
    expect(bus.fireImpact).toHaveBeenCalledWith('fx-impacted');
    expect(onEffectImpact).toHaveBeenCalledTimes(1);
    expect(onEffectImpact).toHaveBeenCalledWith('fx-impacted', 'fx.impacted');
    expect(onEffectComplete).toHaveBeenCalledTimes(1);
    expect(onEffectComplete).toHaveBeenCalledWith('fx-impacted', 'fx.impacted');
  });
});
