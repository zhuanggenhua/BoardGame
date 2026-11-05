import { describe, expect, it } from 'vitest';
import { createTimingPoint } from '../../../engine/TimingOpportunity';
import { createInitialSystemState } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import {
    commitDiceThroneDamagePrevention,
    commitDiceThroneDamagePreventionEvent,
    estimateDiceThroneDamageAfterExistingPrevention,
} from '../domain/damagePreventionCommit';
import { STATUS_IDS } from '../domain/ids';
import { reduce } from '../domain/reducer';
import { RESOURCE_IDS } from '../domain/resources';
import {
    buildDiceThroneDamageShieldPreventionOpportunityId,
    buildDiceThroneTokenResponseFrameIdFromPendingDamageId,
} from '../domain/timingOpportunityIdentities';
import type { DamageDealtEvent } from '../domain/types';
import {
    applyExistingDamagePreventionToPendingDamage,
    createPendingDamage,
    createTokenResponseRequestedEvent,
    finalizeTokenResponse,
} from '../domain/tokenResponse';
import { fixedRandom } from './test-utils';

describe('DiceThrone damage prevention commit', () => {
    const runFixedShieldResponseScenario = ({
        incomingDamage,
        initialShields,
        appendedShields,
    }: {
        incomingDamage: number;
        initialShields: Array<{ value: number; sourceId: string }>;
        appendedShields: Array<{ value: number; sourceId: string }>;
    }) => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        let state = reduce(core, {
            type: 'ATTACK_INITIATED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'test-attack',
                isDefendable: true,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 0,
        });
        state = {
            ...state,
            players: {
                ...state.players,
                '1': {
                    ...state.players['1'],
                    damageShields: initialShields.map((shield) => ({
                        ...shield,
                        preventStatus: false,
                    })),
                },
            },
        };

        const initialPendingDamage = createPendingDamage(
            '0',
            '1',
            incomingDamage,
            'beforeDamageReceived',
            'test-attack',
            1,
            undefined,
            'attack',
        );
        const committedPendingDamage = applyExistingDamagePreventionToPendingDamage(
            state,
            initialPendingDamage,
        );

        state = reduce(state, createTokenResponseRequestedEvent(committedPendingDamage));
        appendedShields.forEach((shield, index) => {
            state = reduce(state, {
                type: 'DAMAGE_SHIELD_GRANTED',
                payload: {
                    targetId: '1',
                    value: shield.value,
                    sourceId: shield.sourceId,
                    preventStatus: false,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: index + 2,
            });
        });

        const responseState = state;
        const closeEvents = finalizeTokenResponse(state.pendingDamage!, state, appendedShields.length + 2);
        for (const event of closeEvents) {
            state = reduce(state, event);
        }
        state = reduce(state, {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'test-attack',
                totalDamage: incomingDamage,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: appendedShields.length + 3,
        });

        return { responseState, finalizedState: state };
    };

    it('集中处理百分比护盾优先、固定护盾后置和剩余护盾', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        core.players['0'].damageShields = [
            { value: 6, sourceId: 'card-next-time', preventStatus: false },
            { value: 0, sourceId: 'miss-me', preventStatus: false, reductionPercent: 50 },
            { value: 2, sourceId: 'prevent-status', preventStatus: true },
        ];

        const result = commitDiceThroneDamagePrevention({
            state: core,
            targetId: '0',
            incomingDamage: 14,
        });

        expect(result.remainingDamage).toBe(1);
        expect(result.nextDamageShields).toEqual([
            { value: 2, sourceId: 'prevent-status', preventStatus: true },
        ]);
        expect(result.shieldsConsumed).toEqual([
            expect.objectContaining({
                sourceId: 'miss-me',
                shieldIndex: 1,
                reductionPercent: 50,
                absorbed: 7,
            }),
            expect.objectContaining({
                sourceId: 'card-next-time',
                shieldIndex: 0,
                value: 6,
                absorbed: 6,
            }),
        ]);
    });

    it('带 Token 响应 frame 时把正式防止提交追溯到同一个 prevention Opportunity', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        const pendingDamageId = 'damage-test-1';
        const resolutionFrameId = buildDiceThroneTokenResponseFrameIdFromPendingDamageId(pendingDamageId);
        core.players['0'].damageShields = [
            { value: 6, sourceId: 'card-next-time', preventStatus: false },
        ];

        const result = commitDiceThroneDamagePrevention({
            state: core,
            targetId: '0',
            incomingDamage: 3,
            resolutionFrameId,
        });

        expect(result.shieldsConsumed).toEqual([
            expect.objectContaining({
                sourceId: 'card-next-time',
                shieldIndex: 0,
                absorbed: 3,
                pendingDamageId,
                resolutionFrameId,
                preventionOpportunityId: buildDiceThroneDamageShieldPreventionOpportunityId({
                    pendingDamageId,
                    targetPlayerId: '0',
                    shieldIndex: 0,
                    shieldSourceId: 'card-next-time',
                }),
            }),
        ]);
    });

    it('估算路径复用同一防止规则但不消耗护盾', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        core.players['0'].damageShields = [
            { value: 6, sourceId: 'card-next-time', preventStatus: false },
            { value: 0, sourceId: 'miss-me', preventStatus: false, reductionPercent: 50 },
        ];

        const remainingDamage = estimateDiceThroneDamageAfterExistingPrevention(core, '0', 14);

        expect(remainingDamage).toBe(1);
        expect(core.players['0'].damageShields).toEqual([
            { value: 6, sourceId: 'card-next-time', preventStatus: false },
            { value: 0, sourceId: 'miss-me', preventStatus: false, reductionPercent: 50 },
        ]);
    });

    it('EventCommit 预提交护盾后，reducer 只消费提交结果不二次扣盾', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        core.players['0'].resources[RESOURCE_IDS.HP] = 50;
        core.players['0'].damageShields = [
            { value: 6, sourceId: 'card-next-time', preventStatus: false },
        ];
        const event: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '0',
                amount: 14,
                actualDamage: 14,
                sourceAbilityId: 'test-attack',
            },
            timestamp: 1,
        };

        const committedEvent = commitDiceThroneDamagePreventionEvent({ state: core, event });
        const afterDamage = reduce(core, committedEvent);

        expect(committedEvent.payload).toMatchObject({
            amount: 14,
            actualDamage: 8,
            preventionCommitted: true,
            shieldsConsumed: [
                expect.objectContaining({
                    sourceId: 'card-next-time',
                    absorbed: 6,
                }),
            ],
        });
        expect(afterDamage.players['0'].resources[RESOURCE_IDS.HP]).toBe(42);
        expect(afterDamage.players['0'].damageShields).toEqual([]);
        expect(committedEvent.payload.actualDamage).toBe(8);
    });

    it('回归：神圣防御预提交后再打出下次一定，收口必须继续消耗新护盾', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        core.players['1'].damageShields = [
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];

        const initialPendingDamage = createPendingDamage(
            '0',
            '1',
            10,
            'beforeDamageReceived',
            'test-attack',
            1,
            undefined,
            'attack',
        );
        const committedPendingDamage = applyExistingDamagePreventionToPendingDamage(
            core,
            initialPendingDamage,
        );
        expect(committedPendingDamage.currentDamage).toBe(7);
        expect(committedPendingDamage.preventionCommitted).toBe(true);

        let state = reduce(core, createTokenResponseRequestedEvent(committedPendingDamage));
        state = reduce(state, {
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: {
                targetId: '1',
                value: 6,
                sourceId: 'card-next-time',
                preventStatus: false,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 2,
        });

        const closeEvents = finalizeTokenResponse(state.pendingDamage!, state, 3);
        for (const event of closeEvents) {
            state = reduce(state, event);
        }

        expect(state.players['1'].resources[RESOURCE_IDS.HP]).toBe(49);
        expect(state.players['1'].damageShields).toEqual([]);
    });

    it.each([
        {
            name: '无预提交护盾，窗口内追加下次一定',
            incomingDamage: 10,
            initialShields: [],
            appendedShields: [{ value: 6, sourceId: 'card-next-time' }],
            expectedResponseDamage: 4,
            expectedResponseShields: [{ value: 6, sourceId: 'card-next-time', preventStatus: false }],
            expectedHp: 46,
            expectedShields: [],
        },
        {
            name: '神圣防御预提交后追加下次一定',
            incomingDamage: 10,
            initialShields: [{ value: 3, sourceId: 'holy-defense' }],
            appendedShields: [{ value: 6, sourceId: 'card-next-time' }],
            expectedResponseDamage: 1,
            expectedResponseShields: [
                { value: 3, sourceId: 'holy-defense', preventStatus: false },
                { value: 6, sourceId: 'card-next-time', preventStatus: false },
            ],
            expectedHp: 49,
            expectedShields: [],
        },
        {
            name: '已有护盾与窗口内追加护盾只部分消费',
            incomingDamage: 4,
            initialShields: [{ value: 3, sourceId: 'holy-defense' }],
            appendedShields: [{ value: 6, sourceId: 'card-next-time' }],
            expectedResponseDamage: 0,
            expectedResponseShields: [
                { value: 3, sourceId: 'holy-defense', preventStatus: false },
                { value: 6, sourceId: 'card-next-time', preventStatus: false },
            ],
            expectedHp: 50,
            expectedShields: [],
        },
        {
            name: '窗口内连续追加两个护盾并在同一事务收口',
            incomingDamage: 10,
            initialShields: [{ value: 3, sourceId: 'holy-defense' }],
            appendedShields: [
                { value: 2, sourceId: 'card-next-time' },
                { value: 5, sourceId: 'card-next-time-2' },
            ],
            expectedResponseDamage: 0,
            expectedResponseShields: [
                { value: 3, sourceId: 'holy-defense', preventStatus: false },
                { value: 2, sourceId: 'card-next-time', preventStatus: false },
                { value: 5, sourceId: 'card-next-time-2', preventStatus: false },
            ],
            expectedHp: 50,
            expectedShields: [],
        },
        {
            name: '窗口内追加后仍保留未消费护盾',
            incomingDamage: 10,
            initialShields: [{ value: 3, sourceId: 'holy-defense' }],
            appendedShields: [{ value: 4, sourceId: 'card-next-time' }],
            expectedResponseDamage: 3,
            expectedResponseShields: [
                { value: 3, sourceId: 'holy-defense', preventStatus: false },
                { value: 4, sourceId: 'card-next-time', preventStatus: false },
            ],
            expectedHp: 47,
            expectedShields: [],
        },
    ])(
        '组合回归：$name',
        ({
            incomingDamage,
            initialShields,
            appendedShields,
            expectedResponseDamage,
            expectedResponseShields,
            expectedHp,
            expectedShields,
        }) => {
            const { responseState, finalizedState } = runFixedShieldResponseScenario({
                incomingDamage,
                initialShields,
                appendedShields,
            });

            expect(responseState.pendingDamage?.currentDamage).toBe(expectedResponseDamage);
            expect(responseState.players['1'].damageShields).toEqual(expectedResponseShields);
            expect(finalizedState.players['1'].resources[RESOURCE_IDS.HP]).toBe(expectedHp);
            expect(finalizedState.players['1'].damageShields).toEqual(expectedShields);
            expect(finalizedState.pendingDamage).toBeUndefined();
            expect(finalizedState.pendingAttack).toBeNull();
        },
    );

    it('DiceThroneDomain.commitEvent 通过通用 Opportunity composer 返回护盾提交事件', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        const pendingDamageId = 'damage-test-1';
        const resolutionFrameId = buildDiceThroneTokenResponseFrameIdFromPendingDamageId(pendingDamageId);
        core.players['0'].resources[RESOURCE_IDS.HP] = 50;
        core.players['0'].damageShields = [
            { value: 6, sourceId: 'card-next-time', preventStatus: false },
        ];
        const event: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '0',
                amount: 14,
                actualDamage: 14,
                sourceAbilityId: 'test-attack',
                resolutionFrameId,
            },
            timestamp: 1,
        };
        const state = {
            core,
            sys: createInitialSystemState(['0', '1'], []),
        };
        const timing = createTimingPoint({
            gameId: 'dicethrone',
            position: 'eventCommit',
            factKind: 'DAMAGE_DEALT',
            event,
            timestamp: event.timestamp,
        });

        const result = DiceThroneDomain.commitEvent?.({ state, event, timing });
        const committedEvents = Array.isArray(result)
            ? result
            : result && 'events' in result
                ? result.events
                : result
                    ? [result]
                    : [];
        const [committedEvent] = committedEvents;
        const expectedOpportunityId = buildDiceThroneDamageShieldPreventionOpportunityId({
            pendingDamageId,
            targetPlayerId: '0',
            shieldIndex: 0,
            shieldSourceId: 'card-next-time',
        });

        expect(committedEvent).toMatchObject({
            type: 'DAMAGE_DEALT',
            payload: {
                actualDamage: 8,
                preventionCommitted: true,
                shieldsConsumed: [
                    expect.objectContaining({
                        pendingDamageId,
                        resolutionFrameId,
                        preventionOpportunityId: expectedOpportunityId,
                    }),
                ],
            },
        });
        expect(result && !Array.isArray(result) && 'events' in result ? result.evidence : undefined)
            .toMatchObject({
                timingPointId: timing.id,
                gameId: 'dicethrone',
                position: 'eventCommit',
                originalEventType: 'DAMAGE_DEALT',
                opportunityIds: [expectedOpportunityId],
                appliedOpportunityIds: [expectedOpportunityId],
            });
    });

    it('EventCommit 不提前提交被 Parley 完全阻止的当前攻击伤害', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-attack',
            isDefendable: true,
            damageResolved: false,
            resolvedDamage: 0,
        };
        core.players['0'].statusEffects[STATUS_IDS.PARLEY] = 1;
        core.players['1'].resources[RESOURCE_IDS.HP] = 50;
        core.players['1'].damageShields = [
            { value: 6, sourceId: 'card-next-time', preventStatus: false },
        ];
        const event: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 14,
                actualDamage: 14,
                sourcePlayerId: '0',
                sourceAbilityId: 'test-attack',
                damageScope: 'attack',
            },
            timestamp: 1,
        };

        const committedEvent = commitDiceThroneDamagePreventionEvent({ state: core, event });
        const afterDamage = reduce(core, committedEvent);

        expect(committedEvent).toBe(event);
        expect(committedEvent.payload.preventionCommitted).toBeUndefined();
        expect(afterDamage.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(afterDamage.players['1'].damageShields).toEqual([
            { value: 6, sourceId: 'card-next-time', preventStatus: false },
        ]);
        expect(committedEvent.payload.actualDamage).toBe(0);
    });
});
