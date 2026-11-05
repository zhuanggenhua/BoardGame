import { describe, expect, it } from 'vitest';
import { buildEventChoiceRecentRollId } from '../eventResolutionStateModel';

describe('betrayal event roll identity', () => {
  it('同一毫秒的连续属性检定仍生成不同轮次标识', () => {
    const base = {
      timestamp: 1700000000000,
      payload: {
        playerId: '0',
        sourceTitle: '吊死鬼',
        eventRoll: {
          kind: 'trait',
          trait: 'knowledge',
          dice: [6, 6, 6],
          rollLabel: '知识检定',
          label: '知识检定通过',
        },
      },
    } as any;

    const first = buildEventChoiceRecentRollId({
      ...base,
      payload: {
        ...base.payload,
        allTraitCheckProgress: { results: [{ trait: 'knowledge' }] },
      },
    });
    const second = buildEventChoiceRecentRollId({
      ...base,
      payload: {
        ...base.payload,
        eventRoll: { ...base.payload.eventRoll, trait: 'speed' },
        allTraitCheckProgress: {
          results: [{ trait: 'knowledge' }, { trait: 'speed' }],
        },
      },
    });

    expect(first).not.toBe(second);
  });

  it('同一检定轮次保持稳定标识', () => {
    const event = {
      timestamp: 1700000000000,
      payload: {
        playerId: '0',
        sourceTitle: '吊死鬼',
        eventRoll: {
          kind: 'trait',
          trait: 'knowledge',
          dice: [6, 6, 6],
          rollLabel: '知识检定',
        },
        allTraitCheckProgress: { results: [{ trait: 'knowledge' }] },
      },
    } as any;

    expect(buildEventChoiceRecentRollId(event)).toBe(buildEventChoiceRecentRollId(event));
  });
});
