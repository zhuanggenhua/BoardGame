import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    makeState,
    makeMinion,
    triggerBaseAbilityWithMS,
    makeMatchState,
    SU_EVENTS,
    type BaseAbilityContext,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('new base extra timing regression coverage', () => {
    it('base_the_workshop marks off-phase extra actions as immediate', () => {
        const core = makeState({
            bases: [{
                defId: 'base_the_workshop',
                minions: [],
                ongoingActions: [],
            }],
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'startTurn';

        const result = triggerBaseAbilityWithMS('base_the_workshop', 'onActionPlayed', {
            state: core,
            matchState: ms,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            actionTargetBaseIndex: 0,
            now: 1000,
        } as BaseAbilityContext);

        expect((result.events[0] as any).payload.playTiming).toBe('immediate');
    });
});

describe('base_the_workshop: 额外行动额度', () => {
    it('打出战术到工坊时获得+1行动额度', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_workshop',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            actionTargetBaseIndex: 0,
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_the_workshop', 'onActionPlayed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.limitType).toBe('action');
        expect((events[0] as any).payload.delta).toBe(1);
    });

    it('打到工坊随从上的战术不应给予额外战术额度', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_workshop',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            actionTargetBaseIndex: 0,
            actionTargetMinionUid: 'm1',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_the_workshop', 'onActionPlayed', ctx);
        expect(events).toHaveLength(0);
    });
});

// ============================================================================
// base_crypt: 地窖 - 随从被消灭后消灭者在自己这里的随从上放 +1 指示物
// ============================================================================
