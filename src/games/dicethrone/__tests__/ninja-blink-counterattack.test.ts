import { expect, it } from 'vitest';
import { resolveAttack } from '../domain/attack';
import { NINJA_DICE_FACE_IDS } from '../domain/ids';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

it('基础瞬身的反馈骰面 6、1、2 只触发一次忍刀的 1 点反击', () => {
    const state = createHeroMatchup('barbarian', 'ninja')(['0', '1'], createQueuedRandom([1]));
    state.sys.phase = 'defensiveRoll';
    state.core.turnPhase = 'defensiveRoll';
    state.core.activePlayerId = '1';
    state.core.pendingAttack = {
        attackerId: '0', defenderId: '1', sourceAbilityId: 'reckless-strike',
        defenseAbilityId: 'blink', isDefendable: true, damage: 15, preDefenseResolved: true,
    };
    state.core.dice = [6, 1, 2].map((value, id) => ({
        id, value, definitionId: 'ninja-dice', isKept: false,
        symbol: value === 6 ? NINJA_DICE_FACE_IDS.MASK : NINJA_DICE_FACE_IDS.KATANA,
        symbols: [value === 6 ? NINJA_DICE_FACE_IDS.MASK : NINJA_DICE_FACE_IDS.KATANA],
    }));
    state.core.rollDiceCount = 3;
    const events = resolveAttack(state.core, createQueuedRandom([1]), { includePreDefense: false }, 100);
    const reflected = events.filter(event => event.type === 'DAMAGE_DEALT' && event.payload.sourceAbilityId === 'blink');
    expect(reflected).toHaveLength(1);
    expect(reflected[0].payload).toMatchObject({ targetId: '0', amount: 1 });
});
