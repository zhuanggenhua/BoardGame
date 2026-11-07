import { describe, expect, it } from 'vitest';
import type { BetrayalCore } from '../game';
import { resolveEndgameDeathRoll } from '../endgameDeathRoll';

const makeCore = () => ({
  phase: 'endgame', endgameResult: { outcome: 'traitor', hauntId: 'mummy-rampage' },
  scenarioRuntime: { deadExplorerPlayerIds: ['0'] },
  recentRoll: { kind: 'deathPrevention', playerId: '0', dice: [0, 1, 1], passiveBonus: 0,
    deathPrevention: { minTotal: 4, scenarioRuntimeBeforeDefeat: { secret: 'do-not-expose' } },
    lastRabbitFootRerollPreviousDice: [2, 0, 0] },
}) as unknown as BetrayalCore;

describe('endgame retained death roll', () => {
  it('exposes only public dice and the last reroll for either supported haunt', () => {
    const core = makeCore();
    const result = resolveEndgameDeathRoll(core);
    expect(result).toEqual({ playerId: '0', dice: [0, 1, 1], previousDice: [2, 0, 0], total: 2, bonus: 0, minTotal: 4 });
    expect(JSON.stringify(result)).not.toContain('do-not-expose');
    core.endgameResult!.hauntId = 'the-dust';
    expect(resolveEndgameDeathRoll(core)).not.toBeNull();
  });
  it('handles no reroll, bonuses, and does not expose other outcomes or rolls', () => {
    const core = makeCore();
    delete core.recentRoll!.lastRabbitFootRerollPreviousDice;
    core.recentRoll!.passiveBonus = 1;
    expect(resolveEndgameDeathRoll(core)).toMatchObject({ previousDice: null, total: 3 });
    core.recentRoll!.kind = 'attackRoll';
    expect(resolveEndgameDeathRoll(core)).toBeNull();
    core.recentRoll = null;
    expect(resolveEndgameDeathRoll(core)).toBeNull();
  });
  it('labels only the most recently retained check even if the victory happened later', () => {
    const core = makeCore();
    core.recentRoll!.lastRabbitFootRerollPreviousDice = [1, 1, 0];
    expect(resolveEndgameDeathRoll(core)?.previousDice).toEqual([1, 1, 0]);
    core.endgameResult!.hauntId = 'blood-from-a-stone';
    expect(resolveEndgameDeathRoll(core)).toBeNull();
  });
  it('ignores checks for a surviving explorer or an unrelated victory', () => {
    const core = makeCore();
    core.scenarioRuntime.deadExplorerPlayerIds = [];
    expect(resolveEndgameDeathRoll(core)).toBeNull();
    core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
    core.endgameResult!.outcome = 'survivors';
    expect(resolveEndgameDeathRoll(core)).toBeNull();
  });
});
