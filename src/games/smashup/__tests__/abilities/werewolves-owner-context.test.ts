import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers } from '../../domain/ongoingEffects';
import { defaultTestRandom } from '../testRunner';
import {
    makeBase,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from '../helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('Werewolves queued source-controller runtime context', () => {
    it('werewolf_loup_garou 在对手计分前仍应把 queued beforeScoring owner 交给来源随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('wolf-loup-1', 'werewolf_loup_garou', '1', 4),
                        makeMinion('scoring-minion-1', 'robot_microbot_alpha', '0', 8),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 8, vp: 1 }],
            random: defaultTestRandom,
            now: 6101,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers.find((entry: any) => entry.sourceCardUid === 'wolf-loup-1');
        expect(trigger).toBeDefined();
        expect(trigger.ownerPlayerId).toBe('1');
    });

    it('werewolf_pack_alpha 在对手计分前仍应把 queued beforeScoring owner 交给来源随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('wolf-pack-1', 'werewolf_pack_alpha', '1', 5),
                        makeMinion('wolf-pack-ally', 'test_minion', '1', 2),
                        makeMinion('scoring-minion-2', 'robot_microbot_alpha', '0', 9),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 9, vp: 1 }],
            random: defaultTestRandom,
            now: 6102,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers.find((entry: any) => entry.sourceCardUid === 'wolf-pack-1');
        expect(trigger).toBeDefined();
        expect(trigger.ownerPlayerId).toBe('1');
    });
});
