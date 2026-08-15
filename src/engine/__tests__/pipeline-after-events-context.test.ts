import { describe, expect, it } from 'vitest';

import { createInitialSystemState, createSeededRandom, executePipeline } from '../pipeline';
import { createFlowSystem } from '../systems/FlowSystem';
import type { EngineSystem } from '../systems/types';
import type { Command, DomainCore, GameEvent, MatchState, ValidationResult } from '../types';

interface TestCore {
  value: number;
}

type TestCommand = Command<'NOOP'>;
type TestEvent = GameEvent<'AFTER_EVENTS_INCREMENTED'>;

const testDomain: DomainCore<TestCore, TestCommand, TestEvent> = {
  gameId: 'pipeline-after-events-context-test',
  setup: () => ({ value: 0 }),
  validate: (): ValidationResult => ({ valid: true }),
  execute: (): TestEvent[] => [],
  reduce: (core, event): TestCore => {
    if (event.type === 'AFTER_EVENTS_INCREMENTED') {
      return { ...core, value: core.value + 1 };
    }
    return core;
  },
};

describe('pipeline afterEvents pending context', () => {
  it('前置系统产出未归约事件时，FlowSystem 应等到下一轮读取已落地状态', () => {
    let produced = false;
    const producer: EngineSystem<TestCore> = {
      id: 'after-events-producer',
      name: 'afterEvents producer',
      priority: 10,
      afterEvents: () => {
        if (produced) return;
        produced = true;
        return {
          events: [{
            type: 'AFTER_EVENTS_INCREMENTED',
            payload: {},
            timestamp: 1,
          }],
        };
      },
    };

    const observedValues: number[] = [];
    const flow = createFlowSystem<TestCore>({
      hooks: {
        initialPhase: 'phase1',
        getNextPhase: ({ from }) => from === 'phase1' ? 'phase2' : from,
        onAutoContinueCheck: ({ state }) => {
          observedValues.push(state.core.value);
          return state.sys.phase === 'phase1'
            ? { autoContinue: true, playerId: '0' }
            : undefined;
        },
      },
    });

    const systems = [producer, flow];
    const state: MatchState<TestCore> = {
      core: testDomain.setup(['0'], createSeededRandom('setup')),
      sys: createInitialSystemState(['0'], systems, 'pending-after-events-test'),
    };

    const result = executePipeline(
      { domain: testDomain, systems },
      state,
      { type: 'NOOP', playerId: '0', payload: {}, timestamp: 1 },
      createSeededRandom('pending-after-events-test'),
      ['0'],
    );

    expect(result.success).toBe(true);
    expect(result.state.core.value).toBe(1);
    expect(result.state.sys.phase).toBe('phase2');
    expect(observedValues).toEqual([1, 1]);
  });
});
