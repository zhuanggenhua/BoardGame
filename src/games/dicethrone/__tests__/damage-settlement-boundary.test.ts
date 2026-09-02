import { describe, expect, it } from 'vitest';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { TOKEN_IDS } from '../domain/ids';
import { reduce } from '../domain/reducer';
import { RESOURCE_IDS } from '../domain/resources';
import { createPendingDamage, finalizeTokenResponse, maybeCreateDamageResponseEvent } from '../domain/tokenResponse';
import type { DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { createHeroMatchup, createInitializedState, createQueuedRandom, fixedRandom } from './test-utils';

function createCore(): DiceThroneCore {
    return createInitializedState(['0', '1'], fixedRandom).core;
}

function ev(type: string, payload: Record<string, unknown>, timestamp = 1): DiceThroneEvent {
    return { type, payload, timestamp } as DiceThroneEvent;
}

function command(
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
): DiceThroneCommand {
    return { type, playerId, payload, timestamp: 100 } as DiceThroneCommand;
}

describe('Token 响应正式结算边界', () => {
    it('攻击方加伤写入同一份 pendingDamage，并由最终结算消费', () => {
        let state = reduce(createCore(), ev('ATTACK_INITIATED', {
            attackerId: '0', defenderId: '1', sourceAbilityId: 'test-attack', isDefendable: true,
        }));
        const hpBefore = state.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const pendingDamage = createPendingDamage('0', '1', 5, 'beforeDamageDealt', 'test-attack', 10, undefined, 'attack');

        state = reduce(state, ev('TOKEN_RESPONSE_REQUESTED', { pendingDamage }, 10));
        state = reduce(state, ev('TOKEN_USED', {
            playerId: '0', tokenId: TOKEN_IDS.TAIJI, amount: 1, effectType: 'damageBoost', damageModifier: 2,
        }, 11));

        expect(state.pendingDamage?.currentDamage).toBe(7);
        expect(state.pendingAttack?.bonusDamage).toBe(2);

        const events = finalizeTokenResponse(state.pendingDamage!, state, 12);
        const damageEvent = events.find((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => event.type === 'DAMAGE_DEALT');
        expect(damageEvent?.payload.amount).toBe(7);

        for (const event of events) state = reduce(state, event);

        expect(state.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 7);
        expect(damageEvent?.payload.actualDamage).toBe(7);
        expect(state.pendingAttack?.resolvedDamage).toBe(7);
    });

    it('防御方减伤写入同一份 pendingDamage，并由最终结算消费', () => {
        let state = reduce(createCore(), ev('ATTACK_INITIATED', {
            attackerId: '0', defenderId: '1', sourceAbilityId: 'test-attack', isDefendable: true,
        }));
        const hpBefore = state.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const pendingDamage = createPendingDamage('0', '1', 8, 'beforeDamageReceived', 'test-attack', 20, undefined, 'attack');

        state = reduce(state, ev('TOKEN_RESPONSE_REQUESTED', { pendingDamage }, 20));
        state = reduce(state, ev('TOKEN_USED', {
            playerId: '1', tokenId: TOKEN_IDS.TAIJI, amount: 3, effectType: 'damageReduction', damageModifier: -3,
        }, 21));

        expect(state.pendingDamage?.currentDamage).toBe(5);
        expect(state.pendingAttack?.bonusDamage ?? 0).toBe(0);

        const events = finalizeTokenResponse(state.pendingDamage!, state, 22);
        const damageEvent = events.find((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => event.type === 'DAMAGE_DEALT');
        expect(damageEvent?.payload.amount).toBe(5);

        for (const event of events) state = reduce(state, event);

        expect(state.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 5);
        expect(damageEvent?.payload.actualDamage).toBe(5);
        expect(state.pendingAttack?.resolvedDamage).toBe(5);
    });

    it('防御方受伤响应窗口应先反映已有护盾，并在收口时只消费一次护盾', () => {
        const match = createHeroMatchup('monk', 'tianshi')(['0', '1'], createQueuedRandom([1]));
        let state = match.core;
        state.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'fist-technique-5',
            isDefendable: true,
            damage: 8,
        };
        state.players['1'].resources[RESOURCE_IDS.HP] = 50;
        state.players['1'].tokens[TOKEN_IDS.FLIGHT] = 1;
        state.players['1'].damageShields = [
            { value: 1, sourceId: 'angelic-cloak', preventStatus: false },
        ];

        const responseEvent = maybeCreateDamageResponseEvent({
            state,
            attackerId: '0',
            sourceAbilityId: 'fist-technique-5',
            timestamp: 40,
            damageEvent: ev('DAMAGE_DEALT', {
                targetId: '1',
                amount: 8,
                actualDamage: 8,
                sourceAbilityId: 'fist-technique-5',
                sourcePlayerId: '0',
                damageScope: 'attack',
            }) as Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }>,
        });

        expect(responseEvent?.payload.pendingDamage).toMatchObject({
            originalDamage: 8,
            currentDamage: 7,
            preventionCommitted: true,
            shieldsConsumed: [
                expect.objectContaining({
                    sourceId: 'angelic-cloak',
                    absorbed: 1,
                    pendingDamageId: expect.any(String),
                }),
            ],
        });

        state = reduce(state, responseEvent!);
        const events = finalizeTokenResponse(state.pendingDamage!, state, 41);
        const damageEvent = events.find((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => event.type === 'DAMAGE_DEALT');

        expect(damageEvent?.payload).toMatchObject({
            amount: 8,
            actualDamage: 7,
            preventionCommitted: true,
            shieldsConsumed: [
                expect.objectContaining({
                    sourceId: 'angelic-cloak',
                    absorbed: 1,
                }),
            ],
        });

        for (const event of events) state = reduce(state, event);

        expect(state.players['1'].resources[RESOURCE_IDS.HP]).toBe(43);
        expect(state.players['1'].damageShields).toEqual([]);
        expect(state.pendingAttack?.resolvedDamage).toBe(7);
    });
});

describe('伤害结算输出边界', () => {
    it('DAMAGE_DEALT 回填扣除护盾和低生命钳制后的净掉血', () => {
        const core = createCore();
        const withLowHpAndShield: DiceThroneCore = {
            ...core,
            players: {
                ...core.players,
                '1': {
                    ...core.players['1'],
                    resources: { ...core.players['1'].resources, [RESOURCE_IDS.HP]: 2 },
                    damageShields: [{ value: 3, sourceId: 'test-shield', preventStatus: false }],
                },
            },
        };
        const damageEvent = ev('DAMAGE_DEALT', {
            targetId: '1', amount: 10, actualDamage: 10, sourceAbilityId: 'test-attack',
        });

        const afterDamage = reduce(withLowHpAndShield, damageEvent);

        expect(afterDamage.players['1'].resources[RESOURCE_IDS.HP]).toBe(0);
        expect((damageEvent as Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }>).payload.actualDamage).toBe(2);
        expect((damageEvent as Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }>).payload.shieldsConsumed?.[0]?.absorbed).toBe(3);
    });

    it('攻击进行中的直接伤害扣 HP，但不改本次攻击伤害和 onHit 依据', () => {
        const core = createCore();
        const hpBefore = core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const initiated = reduce(core, ev('ATTACK_INITIATED', {
            attackerId: '0', defenderId: '1', sourceAbilityId: 'test-attack', isDefendable: true,
        }));
        const directDamageEvent = ev('DAMAGE_DEALT', {
            targetId: '1', amount: 4, actualDamage: 4, sourceAbilityId: 'direct-damage', sourcePlayerId: '0', damageScope: 'direct',
        });

        const afterDirectDamage = reduce(initiated, directDamageEvent);

        expect(afterDirectDamage.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 4);
        expect((directDamageEvent as Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }>).payload.actualDamage).toBe(4);
        expect(afterDirectDamage.pendingAttack?.resolvedDamage).toBe(0);

        const resolved = reduce(afterDirectDamage, ev('ATTACK_RESOLVED', {
            attackerId: '0', defenderId: '1', sourceAbilityId: 'test-attack', totalDamage: 0,
        }));

        expect(resolved.lastResolvedAttackDamage).toBe(0);
    });
});

describe('防止、闪避与命中依据边界', () => {
    it('PREVENT_DAMAGE 只改 pendingDamage，不把防止量编码成负攻击加伤', () => {
        let state = reduce(createCore(), ev('ATTACK_INITIATED', {
            attackerId: '0', defenderId: '1', sourceAbilityId: 'test-attack', isDefendable: true,
        }));
        state = {
            ...state,
            pendingAttack: state.pendingAttack
                ? { ...state.pendingAttack, bonusDamage: 4, attackModifierBonusDamage: 4 }
                : state.pendingAttack,
        };
        const hpBefore = state.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const pendingDamage = createPendingDamage('0', '1', 8, 'beforeDamageReceived', 'test-attack', 30, undefined, 'attack');

        state = reduce(state, ev('TOKEN_RESPONSE_REQUESTED', { pendingDamage }, 30));
        state = reduce(state, ev('PREVENT_DAMAGE', { targetId: '1', amount: 8, sourceAbilityId: 'test-prevent' }, 31));

        expect(state.pendingDamage?.currentDamage).toBe(0);
        expect(state.pendingDamage?.isFullyEvaded).toBe(true);
        expect(state.pendingAttack?.bonusDamage).toBe(4);
        expect(state.pendingAttack?.attackModifierBonusDamage).toBe(4);

        const events = finalizeTokenResponse(state.pendingDamage!, state, 32);
        expect(events.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);

        for (const event of events) state = reduce(state, event);

        expect(state.players['1'].resources[RESOURCE_IDS.HP]).toBe(hpBefore);
        expect(state.pendingAttack?.damageResolved).toBe(true);
        expect(state.pendingAttack?.tokenResponseFullyEvaded).toBe(true);
        expect(state.pendingAttack?.resolvedDamage).toBe(0);
        expect(state.pendingAttack?.bonusDamage).toBe(4);
    });

    it('完全闪避后不伤防御方，但 onHit 的攻击者自伤仍落地', () => {
        const playerIds = ['0', '1'] as const;
        const state = createHeroMatchup('barbarian', 'monk')([...playerIds], createQueuedRandom([1]));
        state.sys.phase = 'defensiveRoll';
        state.core.pendingAttack = {
            attackerId: '0', defenderId: '1', sourceAbilityId: 'reckless-strike', isDefendable: true, damage: 15,
            damageResolved: true, resolvedDamage: 0, settlementStage: 'postDamagePending', tokenResponseFullyEvaded: true,
        };
        const attackerHpBefore = state.core.players['0'].resources[RESOURCE_IDS.HP] ?? 0;
        const defenderHpBefore = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const result = diceThroneFlowHooks.onPhaseExit?.({
            state, from: 'defensiveRoll', to: 'main2', command: command('ADVANCE_PHASE', '1'), random: createQueuedRandom([1]),
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(result) ? result : result?.events ?? [];
        const damageEvents = events.filter((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => event.type === 'DAMAGE_DEALT');

        expect(damageEvents).toHaveLength(1);
        expect(damageEvents[0].payload.targetId).toBe('0');
        expect(damageEvents[0].payload.amount).toBe(4);

        let nextCore = state.core;
        for (const event of events) nextCore = reduce(nextCore, event as DiceThroneEvent);

        expect(nextCore.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHpBefore);
        expect(nextCore.players['0'].resources[RESOURCE_IDS.HP]).toBe(attackerHpBefore - 4);
        expect(nextCore.lastResolvedAttackDamage).toBe(0);
        expect(nextCore.pendingAttack).toBeNull();
    });
});
