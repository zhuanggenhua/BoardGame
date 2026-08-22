import { describe, expect, it } from 'vitest';
import { buildChoiceRequestFromOpportunity, createTimingPoint, discoverTimingOpportunities } from '../../../engine/TimingOpportunity';
import { createInitialSystemState } from '../../../engine/pipeline';
import { createTimingOpportunitySystem } from '../../../engine/systems/TimingOpportunitySystem';
import { SYSTEM_IDS } from '../../../engine/systems/types';
import type { MatchState } from '../../../engine/types';
import { DiceThroneDomain, TOKEN_IDS } from '../domain';
import { createDiceThroneEventSystem } from '../domain/systems';
import { createDiceThroneTimingOpportunitySystemConfig } from '../domain/timingOpportunities';
import type { DiceThroneCore, PendingDamage } from '../domain/types';
import { fixedRandom } from './test-utils';
import { diceThroneSystemsForTest } from '../game';

function makeState(pendingDamage?: PendingDamage): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
    core.players['1'].tokens[TOKEN_IDS.TAIJI] = 2;
    core.players['1'].tokens[TOKEN_IDS.EVASIVE] = 1;
    core.pendingDamage = pendingDamage;
    return {
        core,
        sys: createInitialSystemState(['0', '1'], []),
    };
}

function makePendingDamage(overrides: Partial<PendingDamage> = {}): PendingDamage {
    return {
        id: 'damage-test-1',
        sourcePlayerId: '0',
        targetPlayerId: '1',
        originalDamage: 5,
        currentDamage: 5,
        responseType: 'beforeDamageReceived',
        responderId: '1',
        isFullyEvaded: false,
        ...overrides,
    };
}

function makeTimingPoint() {
    return createTimingPoint({
        gameId: 'dicethrone',
        position: 'postCommit',
        factKind: 'damage',
        event: {
            type: 'TOKEN_RESPONSE_REQUESTED',
            payload: { pendingDamage: makePendingDamage() },
            timestamp: 100,
        },
        timestamp: 100,
    });
}

function makeDamagePreventionTimingPoint() {
    return createTimingPoint({
        gameId: 'dicethrone',
        position: 'prevent',
        factKind: 'damage',
        event: {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 5,
                actualDamage: 5,
                damageScope: 'attack',
            },
            timestamp: 100,
        },
        timestamp: 100,
    });
}

function makeCommittedDamagePreventionTimingPoint() {
    return createTimingPoint({
        gameId: 'dicethrone',
        position: 'prevent',
        factKind: 'damage',
        event: {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 5,
                actualDamage: 5,
                sourcePlayerId: '0',
                sourceAbilityId: 'strike',
                damageScope: 'attack',
                resolutionFrameId: 'dicethrone:token-response-frame:damage-test-1',
            },
            timestamp: 101,
        },
        timestamp: 101,
    });
}

describe('DiceThrone timing opportunities', () => {
    const findTokenResponseChoiceOpportunity = (
        opportunities: ReturnType<typeof discoverTimingOpportunities>['opportunities'],
    ) => {
        const opportunity = opportunities.find(item => item.resolution.type === 'choice-request');
        if (!opportunity) throw new Error('missing token response choice opportunity');
        return opportunity;
    };

    it('production systems opt into the timing opportunity system', () => {
        expect(diceThroneSystemsForTest.map(system => system.id))
            .toContain(SYSTEM_IDS.TIMING_OPPORTUNITY);
    });

    it('旧 DiceThrone 事件系统不再直接创建 Token 响应 interaction', () => {
        const state = makeState(makePendingDamage());
        state.core.currentChoiceSourceAbilityId = 'old-choice-source';
        const eventSystem = createDiceThroneEventSystem();

        const result = eventSystem.afterEvents?.({
            state,
            events: [makeTimingPoint().event!],
            command: { type: 'DAMAGE_DEALT', playerId: '0', payload: {}, timestamp: 100 },
            random: fixedRandom,
            playerIds: ['0', '1'],
        });

        expect(result).toBeUndefined();
        expect(state.sys.interaction.current).toBeUndefined();
        expect(state.core.currentChoiceSourceAbilityId).toBe('old-choice-source');
    });

    it('没有 pendingDamage 时不产出时点机会', () => {
        const result = discoverTimingOpportunities(DiceThroneDomain, {
            state: makeState(undefined),
            timing: makeTimingPoint(),
        }, { activeOnly: true, sorted: true });

        expect(result.opportunities).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it('把 pendingDamage Token 响应暴露为 Opportunity -> ChoiceRequest 合同', () => {
        const pendingDamage = makePendingDamage();
        const result = discoverTimingOpportunities(DiceThroneDomain, {
            state: makeState(pendingDamage),
            timing: makeTimingPoint(),
        }, { activeOnly: true, sorted: true });

        expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
        expect(result.opportunities).toHaveLength(2);
        expect(result.opportunities[0]).toMatchObject({
            id: 'dicethrone:token-response-frame-opportunity:damage-test-1',
            controllerId: '1',
            class: 'mandatory',
            sourceRef: {
                kind: 'system',
                id: 'dicethrone_token_response',
            },
            resolution: {
                type: 'child-frame',
                frameId: 'dicethrone:token-response-frame:damage-test-1',
                frameKind: 'dicethrone-token-response',
                phaseGate: 'block-advance-when-blocked',
            },
            metadata: expect.objectContaining({
                pendingDamageId: 'damage-test-1',
                resolutionFrameId: 'dicethrone:token-response-frame:damage-test-1',
            }),
        });
        const tokenResponseOpportunity = findTokenResponseChoiceOpportunity(result.opportunities);
        expect(tokenResponseOpportunity).toMatchObject({
            id: 'dicethrone:token-response:damage-test-1:beforeDamageReceived:1',
            controllerId: '1',
            class: 'optional',
            sourceRef: {
                kind: 'system',
                id: 'dicethrone_token_response',
            },
            resolution: { type: 'choice-request' },
            aiSupport: {
                status: 'game-policy',
                policyId: 'dicethrone-token-response',
            },
        });

        const choice = buildChoiceRequestFromOpportunity(tokenResponseOpportunity);
        expect(choice).toMatchObject({
            requestId: 'dicethrone:token-response:damage-test-1:beforeDamageReceived:1',
            gameId: 'dicethrone',
            playerId: '1',
            kind: 'choose-option',
            sourceId: 'dicethrone_token_response',
            selection: { min: 1, max: 1 },
            resolution: { type: 'candidate-commands' },
            metadata: {
                opportunityId: 'dicethrone:token-response:damage-test-1:beforeDamageReceived:1',
                pendingDamageId: 'damage-test-1',
                resolutionFrameId: 'dicethrone:token-response-frame:damage-test-1',
                responseType: 'beforeDamageReceived',
                responderId: '1',
            },
        });
        expect(choice.candidates).toEqual([
            expect.objectContaining({
                id: `use-token:${TOKEN_IDS.TAIJI}:1`,
                value: { kind: 'use-token', tokenId: TOKEN_IDS.TAIJI, amount: 1 },
                commands: [{ type: 'USE_TOKEN', payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1, pendingDamageId: 'damage-test-1' } }],
            }),
            expect.objectContaining({
                id: `use-token:${TOKEN_IDS.EVASIVE}:1`,
                value: { kind: 'use-token', tokenId: TOKEN_IDS.EVASIVE, amount: 1 },
                commands: [{ type: 'USE_TOKEN', payload: { tokenId: TOKEN_IDS.EVASIVE, amount: 1, pendingDamageId: 'damage-test-1' } }],
            }),
            expect.objectContaining({
                id: 'skip',
                value: { kind: 'skip' },
                commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: { pendingDamageId: 'damage-test-1' } }],
            }),
        ]);
    });

    it('没有可用 Token 时仍暴露跳过候选，保留伤害响应收口入口', () => {
        const state = makeState(makePendingDamage());
        state.core.players['1'].tokens[TOKEN_IDS.TAIJI] = 0;
        state.core.players['1'].tokens[TOKEN_IDS.EVASIVE] = 0;

        const result = discoverTimingOpportunities(DiceThroneDomain, {
            state,
            timing: makeTimingPoint(),
        }, { activeOnly: true, sorted: true });
        const choice = buildChoiceRequestFromOpportunity(findTokenResponseChoiceOpportunity(result.opportunities));

        expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
        expect(choice.candidates).toEqual([
            expect.objectContaining({
                id: 'skip',
                commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: { pendingDamageId: 'damage-test-1' } }],
            }),
        ]);
    });

    it('在 prevent damage 时点把伤害护盾暴露为 prevention Opportunity，不混入 Token 响应窗口', () => {
        const state = makeState(makePendingDamage());
        state.core.players['1'].damageShields = [{
            value: 2,
            sourceId: 'artificer-arc-shield',
            preventStatus: false,
        }];

        const result = discoverTimingOpportunities(DiceThroneDomain, {
            state,
            timing: makeDamagePreventionTimingPoint(),
        }, { activeOnly: true, sorted: true });

        expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
        expect(result.opportunities).toEqual([
            expect.objectContaining({
                id: 'dicethrone:damage-shield-prevention:damage-test-1:1:0:artificer-arc-shield',
                controllerId: '1',
                class: 'prevention',
                sourceRef: expect.objectContaining({
                    kind: 'status',
                    id: 'dicethrone_damage_shield_prevention',
                }),
                resolution: { type: 'none' },
                metadata: expect.objectContaining({
                    pendingDamageId: 'damage-test-1',
                    targetPlayerId: '1',
                    shieldSourceId: 'artificer-arc-shield',
                    shieldValue: 2,
                    currentDamage: 5,
                }),
            }),
        ]);
    });

    it('最终 DAMAGE_DEALT 带 Token 响应 frame 时，仍能发现同一笔伤害的 prevention Opportunity', () => {
        const state = makeState(undefined);
        state.core.players['1'].damageShields = [{
            value: 2,
            sourceId: 'artificer-arc-shield',
            preventStatus: false,
        }];

        const result = discoverTimingOpportunities(DiceThroneDomain, {
            state,
            timing: makeCommittedDamagePreventionTimingPoint(),
        }, { activeOnly: true, sorted: true });

        expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
        expect(result.opportunities).toEqual([
            expect.objectContaining({
                id: 'dicethrone:damage-shield-prevention:damage-test-1:1:0:artificer-arc-shield',
                controllerId: '1',
                class: 'prevention',
                resolution: { type: 'none' },
                metadata: expect.objectContaining({
                    pendingDamageId: 'damage-test-1',
                    sourcePlayerId: '0',
                    targetPlayerId: '1',
                    sourceAbilityId: 'strike',
                    currentDamage: 5,
                }),
            }),
        ]);
    });

    it('bypassShields 的最终伤害不会暴露伤害护盾 prevention Opportunity', () => {
        const state = makeState(undefined);
        state.core.players['1'].damageShields = [{
            value: 2,
            sourceId: 'artificer-arc-shield',
            preventStatus: false,
        }];
        const timing = makeCommittedDamagePreventionTimingPoint();
        timing.event!.payload.bypassShields = true;

        const result = discoverTimingOpportunities(DiceThroneDomain, {
            state,
            timing,
        }, { activeOnly: true, sorted: true });

        expect(result.opportunities).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it('终极伤害不会暴露伤害护盾 prevention Opportunity', () => {
        const state = makeState(makePendingDamage());
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'ultimate-strike',
            isDefendable: true,
            damageResolved: false,
            resolvedDamage: 0,
            isUltimate: true,
        };
        state.core.players['1'].damageShields = [{
            value: 2,
            sourceId: 'artificer-arc-shield',
            preventStatus: false,
        }];

        const result = discoverTimingOpportunities(DiceThroneDomain, {
            state,
            timing: makeDamagePreventionTimingPoint(),
        }, { activeOnly: true, sorted: true });

        expect(result.opportunities).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it('裸 DAMAGE_DEALT 没有响应 frame 时，不凭空生成 prevention Opportunity 归属', () => {
        const state = makeState(undefined);
        state.core.players['1'].damageShields = [{
            value: 2,
            sourceId: 'artificer-arc-shield',
            preventStatus: false,
        }];
        const timing = makeDamagePreventionTimingPoint();

        const result = discoverTimingOpportunities(DiceThroneDomain, {
            state,
            timing,
        }, { activeOnly: true, sorted: true });

        expect(result.opportunities).toEqual([]);
        expect(result.diagnostics).toEqual([]);
    });

    it('TimingOpportunitySystem 可以把 DiceThrone Token 响应投影为既有 dt:token-response interaction', () => {
        const state = makeState(makePendingDamage());
        state.core.currentChoiceSourceAbilityId = 'old-choice-source';
        const system = createTimingOpportunitySystem(
            DiceThroneDomain,
            createDiceThroneTimingOpportunitySystemConfig(),
        );

        const result = system.afterEvents?.({
            state,
            events: [makeTimingPoint().event!],
            command: { type: 'DAMAGE_DEALT', playerId: '0', payload: {}, timestamp: 100 },
            random: fixedRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.state.sys.interaction.current).toMatchObject({
            id: 'dt-token-response-damage-test-1',
            kind: 'dt:token-response',
            playerId: '1',
            resolutionFrameId: 'dicethrone:token-response-frame:damage-test-1',
            data: {
                choiceRequest: {
                    requestId: 'dicethrone:token-response:damage-test-1:beforeDamageReceived:1',
                    choiceKind: 'choose-option',
                    sourceId: 'dicethrone_token_response',
                    aiStatus: 'game-policy',
                    metadata: {
                        opportunityId: 'dicethrone:token-response:damage-test-1:beforeDamageReceived:1',
                        pendingDamageId: 'damage-test-1',
                        resolutionFrameId: 'dicethrone:token-response-frame:damage-test-1',
                    },
                },
                choiceRequestContract: {
                    requestId: 'dicethrone:token-response:damage-test-1:beforeDamageReceived:1',
                    kind: 'choose-option',
                    sourceId: 'dicethrone_token_response',
                    resolution: { type: 'candidate-commands' },
                    candidates: expect.arrayContaining([
                        expect.objectContaining({
                            id: `use-token:${TOKEN_IDS.TAIJI}:1`,
                            actionKind: 'token-response',
                            commands: [{ type: 'USE_TOKEN', payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1, pendingDamageId: 'damage-test-1' } }],
                        }),
                        expect.objectContaining({
                            id: 'skip',
                            actionKind: 'skip-token-response',
                            commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: { pendingDamageId: 'damage-test-1' } }],
                        }),
                    ]),
                },
            },
        });
        expect(result?.state.sys.resolution).toMatchObject({
            activeFrameId: 'dicethrone:token-response-frame:damage-test-1',
            frames: [
                expect.objectContaining({
                    id: 'dicethrone:token-response-frame:damage-test-1',
                    kind: 'dicethrone-token-response',
                    status: 'blocked',
                    blockedBy: {
                        type: 'interaction',
                        id: 'dt-token-response-damage-test-1',
                        reason: 'dt:token-response',
                    },
                }),
            ],
        });
        expect(result?.state.core.currentChoiceSourceAbilityId).toBeUndefined();
    });

    it('当前 dt:token-response 存在时，TimingOpportunitySystem 原地替换而不是追加第二个窗口', () => {
        const pendingDamage = makePendingDamage({
            id: 'damage-test-2',
            responseType: 'beforeDamageDealt',
            responderId: '0',
        });
        const state = makeState(pendingDamage);
        state.sys.interaction.current = {
            id: 'dt-token-response-damage-test-1',
            kind: 'dt:token-response',
            playerId: '1',
            data: null,
        };
        const system = createTimingOpportunitySystem(
            DiceThroneDomain,
            createDiceThroneTimingOpportunitySystemConfig(),
        );

        const result = system.afterEvents?.({
            state,
            events: [makeTimingPoint().event!],
            command: { type: 'DAMAGE_DEALT', playerId: '0', payload: {}, timestamp: 100 },
            random: fixedRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.state.sys.interaction.current).toMatchObject({
            id: 'dt-token-response-damage-test-2',
            kind: 'dt:token-response',
            playerId: '0',
            resolutionFrameId: 'dicethrone:token-response-frame:damage-test-2',
            data: {
                choiceRequest: {
                    requestId: 'dicethrone:token-response:damage-test-2:beforeDamageDealt:0',
                    sourceId: 'dicethrone_token_response',
                    metadata: {
                        opportunityId: 'dicethrone:token-response:damage-test-2:beforeDamageDealt:0',
                        pendingDamageId: 'damage-test-2',
                        resolutionFrameId: 'dicethrone:token-response-frame:damage-test-2',
                        responseType: 'beforeDamageDealt',
                        responderId: '0',
                    },
                },
            },
        });
        expect(result?.state.sys.interaction.queue).toEqual([]);
    });

    it('旧 dt:token-response 已存在时，TimingOpportunitySystem 不重复排队', () => {
        const state = makeState(makePendingDamage());
        state.sys.interaction.current = {
            id: 'dt-token-response-damage-test-1',
            kind: 'dt:token-response',
            playerId: '1',
            data: null,
        };
        const system = createTimingOpportunitySystem(
            DiceThroneDomain,
            createDiceThroneTimingOpportunitySystemConfig(),
        );

        const result = system.afterEvents?.({
            state,
            events: [makeTimingPoint().event!],
            command: { type: 'DAMAGE_DEALT', playerId: '0', payload: {}, timestamp: 100 },
            random: fixedRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.state.sys.interaction.current).toMatchObject({
            id: 'dt-token-response-damage-test-1',
            kind: 'dt:token-response',
            playerId: '1',
            resolutionFrameId: 'dicethrone:token-response-frame:damage-test-1',
            data: {
                choiceRequestContract: expect.objectContaining({
                    requestId: 'dicethrone:token-response:damage-test-1:beforeDamageReceived:1',
                }),
            },
        });
        expect(result?.state.sys.interaction.queue).toEqual([]);
        expect(result?.state.sys.resolution?.frames).toHaveLength(1);
    });
});
