import { describe, expect, it } from 'vitest';

import { DiceThroneDomain } from '../domain';
import type { PlayerId, RandomFn } from '../../../engine/types';
import { GameTestRunner } from '../../../engine/testing';
import { RESOURCE_IDS } from '../domain/resources';
import { cmd, createHeroMatchup, createQueuedRandom, testSystems, assertState } from './test-utils';

describe('gunslinger take-cover vs samurai stand-tall', () => {
    it('Loaded 奖励骰加伤不应在 Stand Tall 防御后被吞成 0', () => {
        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: createQueuedRandom([1, 1, 4, 4, 5, 1, 6, 5, 6]),
            setup: createHeroMatchup('gunslinger', 'samurai', (core) => {
                core.players['0'].tokens.loaded = 1;
                core.players['0'].resources[RESOURCE_IDS.CP] = 0;
            }) as (playerIds: PlayerId[], random: RandomFn) => any,
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: 'gunslinger take-cover loaded vs samurai stand-tall',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'take-cover' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                pendingInteraction: null,
            },
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.finalState.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(result.finalState.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(49);
        expect(result.finalState.core.pendingAttack).toBeNull();

        const damageEntries = result.finalState.sys.actionLog?.entries?.filter((entry) => entry.kind === 'DAMAGE_DEALT') ?? [];
        expect(damageEntries.length).toBeGreaterThan(0);
        expect(JSON.stringify(damageEntries)).toContain('"displayText":"1"');
    });
});
