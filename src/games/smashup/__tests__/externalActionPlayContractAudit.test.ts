import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getAllCardDefs } from '../data/cards';
import { clearRegistry, getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { appendResolvedActionAbility } from '../domain/externalActionPlay';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import type { ActionCardDef } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { makeBase, makeMatchState, makeMinion, makeState } from './helpers';

const AUDIT_RANDOM = {
    random: () => 0.5,
    shuffle: <T>(items: T[]) => [...items],
    d: () => 1,
    range: (min: number) => min,
};

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('SmashUp external action play contract 审计', () => {
    it('无 onPlay/special 声明的纯 ongoing 行动卡，走 appendResolvedActionAbility 时不得抛缺声明', () => {
        const abilityKeys = getRegisteredAbilityKeys();
        const candidateDefs = getAllCardDefs()
            .filter((def): def is ActionCardDef => def.type === 'action')
            .filter(def => def.subtype === 'ongoing')
            .filter(def => !abilityKeys.has(`${def.id}::onPlay`) && !abilityKeys.has(`${def.id}::special`));

        const violations: string[] = [];

        for (const def of candidateDefs) {
            const targetMinionUid = def.ongoingTarget === 'minion' ? 'audit-minion-1' : undefined;
            const state = makeMatchState(makeState([
                makeBase({
                    minions: targetMinionUid ? [makeMinion({ uid: targetMinionUid, defId: 'test_minion_target', controller: '0', owner: '0' })] : [],
                    ongoingActions: [],
                }),
            ]));

            const events = [{
                type: SU_EVENTS.ACTION_PLAYED,
                payload: {
                    playerId: '0',
                    cardUid: `audit-${def.id}`,
                    defId: def.id,
                    targetBaseIndex: 0,
                    ...(targetMinionUid ? { targetMinionUid } : {}),
                },
                timestamp: 100,
            }, {
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: `audit-${def.id}`,
                    defId: def.id,
                    ownerId: '0',
                    targetType: targetMinionUid ? 'minion' : 'base',
                    targetBaseIndex: 0,
                    ...(targetMinionUid ? { targetMinionUid } : {}),
                },
                timestamp: 100,
            }] as any[];

            try {
                appendResolvedActionAbility({
                    state,
                    events,
                    playerId: '0',
                    cardUid: `audit-${def.id}`,
                    defId: def.id,
                    random: AUDIT_RANDOM,
                    timestamp: 100,
                    baseIndex: 0,
                    targetMinionUid,
                });
            } catch (error) {
                violations.push(`${def.id}: ${(error as Error).message}`);
            }
        }

        expect(violations, '以下纯 ongoing 行动卡在外部代打路径上仍会抛缺声明或其它异常').toEqual([]);
    });
});
