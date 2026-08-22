import { describe, expect, it } from 'vitest';
import type { ChoiceRequest } from '../../../engine/ChoiceRequest';
import { createInitialSystemState } from '../../../engine/pipeline';
import {
    attachCurrentInteractionFrame,
    cancelPrompt,
    getCurrentInteractionSummary,
    injectRawBlockingInteraction,
    replaceCurrentInteractionAndQueuePrevious,
    setInteractionQueue,
} from '../../../engine/testing/interactionTestFacade';
import type { MatchState } from '../../../engine/types';
import { DiceThroneDomain, TOKEN_IDS } from '../domain';
import type { DiceThroneCore, PendingDamage } from '../domain/types';
import { executeTokenCommand } from '../domain/executeTokens';
import { createDiceThroneEventSystem } from '../domain/systems';
import {
    buildDiceThroneTokenResponseChoiceContractSignature,
    isDiceThroneTokenResponseCommandAllowedByContract,
    projectDiceThroneTokenResponseChoiceContract,
    readDiceThroneTokenResponseChoiceContract,
    resolveDiceThroneTokenResponseInteractionPendingDamageId,
} from '../domain/tokenResponseChoiceContract';
import { engineConfig } from '../game';
import { fixedRandom } from './test-utils';

function makeChoiceRequest(overrides: Partial<ChoiceRequest> = {}): ChoiceRequest {
    return {
        requestId: 'dicethrone:token-response:dmg-1:beforeDamageReceived:0',
        playerId: '0',
        kind: 'choose-option',
        candidates: [
            {
                id: 'use-token:taiji:1',
                commands: [{ type: 'USE_TOKEN', payload: { tokenId: 'taiji', amount: 1, pendingDamageId: 'dmg-1' } }],
            },
            {
                id: 'skip',
                commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: { pendingDamageId: 'dmg-1' } }],
            },
        ],
        selection: { min: 1, max: 1 },
        resolution: { type: 'candidate-commands' },
        metadata: { pendingDamageId: 'dmg-1' },
        ...overrides,
    };
}

function makePendingDamage(overrides: Partial<PendingDamage> = {}): PendingDamage {
    return {
        id: 'dmg-1',
        sourcePlayerId: '1',
        targetPlayerId: '0',
        originalDamage: 5,
        currentDamage: 5,
        responseType: 'beforeDamageReceived',
        responderId: '0',
        isFullyEvaded: false,
        ...overrides,
    };
}

function makeDomainState(choiceRequestContract: ChoiceRequest | null): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
    core.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;
    core.pendingDamage = makePendingDamage();
    return {
        core,
        sys: {
            ...createInitialSystemState(['0', '1'], []),
            phase: 'defensiveRoll',
            interaction: {
                current: {
                    id: 'dt-token-response-dmg-1',
                    kind: 'dt:token-response',
                    playerId: '0',
                    data: choiceRequestContract ? { choiceRequestContract } : {},
                },
                queue: [],
            },
        },
    };
}

function attachTokenResponseFrame(state: MatchState<DiceThroneCore>, frameId = 'dicethrone:token-response-frame:dmg-1'): void {
    attachCurrentInteractionFrame(state, frameId);
    state.sys.resolution = {
        activeFrameId: frameId,
        frames: [{
            id: frameId,
            kind: 'dicethrone-token-response',
            ownerGame: 'dicethrone',
            ownerSystem: 'timing-opportunity',
            ownerToken: 'dicethrone:token-response-frame-opportunity:dmg-1',
            ordering: 'explicit',
            status: 'blocked',
            blockedBy: {
                type: 'interaction',
                id: 'dt-token-response-dmg-1',
                reason: 'dt:token-response',
            },
        }],
    };
}

function makeCancelFallbackCommand() {
    return cancelPrompt(makeDomainState(null), { playerId: '0' });
}

describe('DiceThrone token response choice contract projection', () => {
    it('从 dt:token-response interaction 读取完整 ChoiceRequest 合同', () => {
        const choiceRequest = makeChoiceRequest();

        expect(readDiceThroneTokenResponseChoiceContract({
            kind: 'dt:token-response',
            data: { choiceRequestContract: choiceRequest },
        })).toMatchObject({
            requestId: choiceRequest.requestId,
            playerId: '0',
            kind: 'choose-option',
        });
    });

    it('把合同候选投影为 UI 可点击 Token 和跳过入口', () => {
        const projection = projectDiceThroneTokenResponseChoiceContract(makeChoiceRequest());

        expect(projection).toEqual({
            requestId: 'dicethrone:token-response:dmg-1:beforeDamageReceived:0',
            playerId: '0',
            pendingDamageId: 'dmg-1',
            tokenOptions: [{
                candidateId: 'use-token:taiji:1',
                tokenId: 'taiji',
                amount: 1,
                command: { type: 'USE_TOKEN', payload: { tokenId: 'taiji', amount: 1, pendingDamageId: 'dmg-1' } },
            }],
            skipAvailable: true,
            skipCommand: { type: 'SKIP_TOKEN_RESPONSE', payload: { pendingDamageId: 'dmg-1' } },
        });
    });

    it('禁用或缺失的 Token 候选不会被 UI 从其它状态补出来', () => {
        const projection = projectDiceThroneTokenResponseChoiceContract(makeChoiceRequest({
            candidates: [
                {
                    id: 'use-token:taiji:1',
                    disabled: true,
                    commands: [{ type: 'USE_TOKEN', payload: { tokenId: 'taiji', amount: 1 } }],
                },
                {
                    id: 'skip',
                    commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: {} }],
                },
            ],
        }));

        expect(projection?.tokenOptions).toEqual([]);
        expect(projection?.skipAvailable).toBe(true);
    });

    it('旧裸 dt:token-response 没有合同，调用方应走历史兼容分支', () => {
        expect(readDiceThroneTokenResponseChoiceContract({
            kind: 'dt:token-response',
            data: {},
        })).toBeNull();
    });

    it('命令授权只接受 ChoiceRequest 合同中的启用候选命令', () => {
        const interaction = {
            kind: 'dt:token-response',
            data: {
                choiceRequestContract: makeChoiceRequest({
                    candidates: [{
                        id: 'skip',
                        commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: { pendingDamageId: 'dmg-1' } }],
                    }],
                }),
            },
        };

        expect(isDiceThroneTokenResponseCommandAllowedByContract(interaction, {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: {},
        })).toBe(false);
        expect(isDiceThroneTokenResponseCommandAllowedByContract(interaction, {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: { pendingDamageId: 'dmg-1' },
        })).toBe(true);
        expect(isDiceThroneTokenResponseCommandAllowedByContract(interaction, {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: { pendingDamageId: 'other-damage' },
        })).toBe(false);
        expect(isDiceThroneTokenResponseCommandAllowedByContract(interaction, {
            type: 'USE_TOKEN',
            playerId: '0',
            payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1 },
        })).toBe(false);
        expect(isDiceThroneTokenResponseCommandAllowedByContract(interaction, {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '1',
            payload: { pendingDamageId: 'dmg-1' },
        })).toBe(false);
    });

    it('合同签名会随可执行候选变化，供恢复 tracker 识别漂移', () => {
        const baseInteraction = {
            kind: 'dt:token-response',
            data: { choiceRequestContract: makeChoiceRequest() },
        };
        const restrictedInteraction = {
            kind: 'dt:token-response',
            data: {
                choiceRequestContract: makeChoiceRequest({
                    candidates: [{
                        id: 'skip',
                        commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: {} }],
                    }],
                }),
            },
        };

        expect(buildDiceThroneTokenResponseChoiceContractSignature(baseInteraction))
            .not.toBe(buildDiceThroneTokenResponseChoiceContractSignature(restrictedInteraction));
    });

    it('DiceThrone 强制恢复只在 ChoiceRequest 合同允许 skip 时跳过', () => {
        const resolveForced = engineConfig.onlineAiRecovery?.resolveForcedInteractionCommand;

        expect(resolveForced?.({
            state: { core: {}, sys: { phase: 'defensiveRoll' } } as never,
            playerId: '0',
            phase: 'defensiveRoll',
            interaction: {
                kind: 'dt:token-response',
                data: { choiceRequestContract: makeChoiceRequest() },
            },
            fallbackCommand: makeCancelFallbackCommand(),
        })).toEqual({ type: 'SKIP_TOKEN_RESPONSE', payload: { pendingDamageId: 'dmg-1' } });

        expect(resolveForced?.({
            state: { core: {}, sys: { phase: 'defensiveRoll' } } as never,
            playerId: '0',
            phase: 'defensiveRoll',
            interaction: {
                kind: 'dt:token-response',
                data: {
                    choiceRequestContract: makeChoiceRequest({
                        candidates: [{
                            id: 'skip',
                            commands: [{
                                type: 'SKIP_TOKEN_RESPONSE',
                                payload: { pendingDamageId: 'dmg-1' },
                            }],
                        }],
                    }),
                },
            },
            fallbackCommand: makeCancelFallbackCommand(),
        })).toEqual({
            type: 'SKIP_TOKEN_RESPONSE',
            payload: { pendingDamageId: 'dmg-1' },
        });

        expect(resolveForced?.({
            state: { core: {}, sys: { phase: 'defensiveRoll' } } as never,
            playerId: '0',
            phase: 'defensiveRoll',
            interaction: {
                kind: 'dt:token-response',
                data: {
                    choiceRequestContract: makeChoiceRequest({
                        candidates: [{
                            id: 'use-token:taiji:1',
                            commands: [{ type: 'USE_TOKEN', payload: { tokenId: 'taiji', amount: 1 } }],
                        }],
                    }),
                },
            },
            fallbackCommand: makeCancelFallbackCommand(),
        })).toBe(false);

        expect(resolveForced?.({
            state: { core: {}, sys: { phase: 'defensiveRoll' } } as never,
            playerId: '0',
            phase: 'defensiveRoll',
            interaction: {
                kind: 'dt:token-response',
                data: {},
            },
            fallbackCommand: makeCancelFallbackCommand(),
        })).toEqual({ type: 'SKIP_TOKEN_RESPONSE', payload: {} });

        expect(resolveDiceThroneTokenResponseInteractionPendingDamageId({
            id: 'dt-token-response-dmg-legacy',
            kind: 'dt:token-response',
            data: {},
        })).toBe('dmg-legacy');

        expect(resolveForced?.({
            state: { core: {}, sys: { phase: 'defensiveRoll' } } as never,
            playerId: '0',
            phase: 'defensiveRoll',
            interaction: {
                id: 'dt-token-response-dmg-legacy',
                kind: 'dt:token-response',
                data: {},
            },
            fallbackCommand: makeCancelFallbackCommand(),
        })).toEqual({ type: 'SKIP_TOKEN_RESPONSE', payload: { pendingDamageId: 'dmg-legacy' } });
    });

    it('DiceThrone 离线裁决同样只在 ChoiceRequest 合同允许 skip 时跳过', () => {
        const resolveOffline = engineConfig.onlineAiRecovery?.resolveOfflineAdjudicationCommand;
        const state = { core: {}, sys: { phase: 'defensiveRoll' } } as never;

        expect(resolveOffline?.({
            state,
            playerId: '0',
            interaction: {
                kind: 'dt:token-response',
                data: { choiceRequestContract: makeChoiceRequest() },
            },
            fallbackCommandType: makeCancelFallbackCommand().type,
        })).toBe('SKIP_TOKEN_RESPONSE');

        expect(resolveOffline?.({
            state,
            playerId: '0',
            interaction: {
                kind: 'dt:token-response',
                data: {
                    choiceRequestContract: makeChoiceRequest({
                        candidates: [{
                            id: 'use-token:taiji:1',
                            commands: [{ type: 'USE_TOKEN', payload: { tokenId: 'taiji', amount: 1 } }],
                        }],
                    }),
                },
            },
            fallbackCommandType: makeCancelFallbackCommand().type,
        })).toBeNull();

        expect(resolveOffline?.({
            state,
            playerId: '1',
            interaction: {
                kind: 'dt:token-response',
                data: { choiceRequestContract: makeChoiceRequest() },
            },
            fallbackCommandType: makeCancelFallbackCommand().type,
        })).toBeNull();

        expect(resolveOffline?.({
            state,
            playerId: '0',
            interaction: {
                kind: 'dt:token-response',
                data: {},
            },
            fallbackCommandType: makeCancelFallbackCommand().type,
        })).toBe('SKIP_TOKEN_RESPONSE');
    });

    it('DiceThrone 服务端验证会拒绝 ChoiceRequest 合同里没有的 Token 响应命令', () => {
        const restrictedState = makeDomainState(makeChoiceRequest({
            candidates: [{
                id: 'skip',
                commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: {} }],
            }],
        }));

        expect(DiceThroneDomain.validate(restrictedState, {
            type: 'USE_TOKEN',
            playerId: '0',
            payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1 },
            timestamp: 1,
        })).toEqual({ valid: false, error: 'choice_contract_mismatch' });
        expect(DiceThroneDomain.validate(restrictedState, {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: {},
            timestamp: 1,
        })).toEqual({ valid: true });

        const allowedState = makeDomainState(makeChoiceRequest({
            candidates: [{
                id: `use-token:${TOKEN_IDS.TAIJI}:1`,
                commands: [{ type: 'USE_TOKEN', payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1, pendingDamageId: 'dmg-1' } }],
            }],
        }));
        expect(DiceThroneDomain.validate(allowedState, {
            type: 'USE_TOKEN',
            playerId: '0',
            payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1 },
            timestamp: 1,
        })).toEqual({ valid: false, error: 'choice_contract_mismatch' });
        expect(DiceThroneDomain.validate(allowedState, {
            type: 'USE_TOKEN',
            playerId: '0',
            payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1, pendingDamageId: 'dmg-1' },
            timestamp: 1,
        })).toEqual({ valid: true });
        expect(DiceThroneDomain.validate(allowedState, {
            type: 'USE_TOKEN',
            playerId: '0',
            payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1, pendingDamageId: 'other-damage' },
            timestamp: 1,
        })).toEqual({ valid: false, error: 'choice_contract_mismatch' });

        const legacyState = makeDomainState(null);
        expect(DiceThroneDomain.validate(legacyState, {
            type: 'USE_TOKEN',
            playerId: '0',
            payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1 },
            timestamp: 1,
        })).toEqual({ valid: true });
        expect(DiceThroneDomain.validate(legacyState, {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: { pendingDamageId: 'other-damage' },
            timestamp: 1,
        })).toEqual({ valid: false, error: 'pending_damage_mismatch' });
    });

    it('DiceThrone 执行事件会携带来源 ChoiceRequest 候选身份', () => {
        const tokenState = makeDomainState(makeChoiceRequest({
            metadata: {
                opportunityId: 'opportunity:dmg-1',
                resolutionFrameId: 'dicethrone:token-response-frame:dmg-1',
            },
            candidates: [{
                id: `use-token:${TOKEN_IDS.TAIJI}:1`,
                commands: [{ type: 'USE_TOKEN', payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1, pendingDamageId: 'dmg-1' } }],
            }],
        }));

        const tokenEvents = DiceThroneDomain.execute(tokenState, {
            type: 'USE_TOKEN',
            playerId: '0',
            payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1, pendingDamageId: 'dmg-1' },
            timestamp: 1,
        }, fixedRandom);
        expect(tokenEvents.find(event => event.type === 'TOKEN_USED')?.payload).toMatchObject({
            choiceRequestId: 'dicethrone:token-response:dmg-1:beforeDamageReceived:0',
            choiceCandidateId: `use-token:${TOKEN_IDS.TAIJI}:1`,
            opportunityId: 'opportunity:dmg-1',
            resolutionFrameId: 'dicethrone:token-response-frame:dmg-1',
        });

        const skipState = makeDomainState(makeChoiceRequest({
            metadata: {
                opportunityId: 'opportunity:dmg-1',
                resolutionFrameId: 'dicethrone:token-response-frame:dmg-1',
            },
            candidates: [{
                id: 'skip',
                commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: { pendingDamageId: 'dmg-1' } }],
            }],
        }));
        const closeEvents = DiceThroneDomain.execute(skipState, {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: { pendingDamageId: 'dmg-1' },
            timestamp: 1,
        }, fixedRandom);
        expect(closeEvents.find(event => event.type === 'TOKEN_RESPONSE_CLOSED')?.payload).toMatchObject({
            choiceRequestId: 'dicethrone:token-response:dmg-1:beforeDamageReceived:0',
            choiceCandidateId: 'skip',
            opportunityId: 'opportunity:dmg-1',
            resolutionFrameId: 'dicethrone:token-response-frame:dmg-1',
        });
        expect(closeEvents.find(event => event.type === 'DAMAGE_DEALT')?.payload).toMatchObject({
            targetId: '0',
            amount: 5,
            resolutionFrameId: 'dicethrone:token-response-frame:dmg-1',
        });
    });

    it('DiceThrone Token 执行入口直接携带 ChoiceRequest 来源，不依赖外层补写', () => {
        const source = {
            requestId: 'dicethrone:token-response:dmg-1:beforeDamageReceived:0',
            candidateId: `use-token:${TOKEN_IDS.TAIJI}:1`,
            opportunityId: 'opportunity:dmg-1',
            resolutionFrameId: 'dicethrone:token-response-frame:dmg-1',
        };
        const state = makeDomainState(null);

        const tokenEvents = executeTokenCommand(state.core, {
            type: 'USE_TOKEN',
            playerId: '0',
            payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1, pendingDamageId: 'dmg-1' },
            timestamp: 1,
        }, fixedRandom, 1, 'defensiveRoll', source);
        expect(tokenEvents.find(event => event.type === 'TOKEN_USED')?.payload).toMatchObject({
            choiceRequestId: source.requestId,
            choiceCandidateId: source.candidateId,
            opportunityId: source.opportunityId,
            resolutionFrameId: source.resolutionFrameId,
        });

        const skipEvents = executeTokenCommand(state.core, {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: { pendingDamageId: 'dmg-1' },
            timestamp: 1,
        }, fixedRandom, 1, 'defensiveRoll', {
            ...source,
            candidateId: 'skip',
        });
        expect(skipEvents.find(event => event.type === 'TOKEN_RESPONSE_CLOSED')?.payload).toMatchObject({
            choiceRequestId: source.requestId,
            choiceCandidateId: 'skip',
            opportunityId: source.opportunityId,
            resolutionFrameId: source.resolutionFrameId,
        });
        expect(skipEvents.find(event => event.type === 'DAMAGE_DEALT')?.payload).toMatchObject({
            targetId: '0',
            amount: 5,
            resolutionFrameId: source.resolutionFrameId,
        });

        const wrongDamageEvents = executeTokenCommand(state.core, {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: { pendingDamageId: 'other-damage' },
            timestamp: 1,
        }, fixedRandom, 1, 'defensiveRoll', {
            ...source,
            candidateId: 'skip',
        });
        expect(wrongDamageEvents.find(event => event.type === 'TOKEN_RESPONSE_CLOSED')).toBeUndefined();
    });

    it('TOKEN_RESPONSE_CLOSED 只关闭匹配当前 ChoiceRequest 合同的 Token 响应交互', () => {
        const state = makeDomainState(makeChoiceRequest({
            metadata: { opportunityId: 'opportunity:dmg-1' },
        }));
        attachTokenResponseFrame(state);
        const system = createDiceThroneEventSystem();

        const result = system.afterEvents?.({
            state,
            events: [{
                type: 'TOKEN_RESPONSE_CLOSED',
                payload: {
                    pendingDamageId: 'dmg-1',
                    choiceRequestId: 'dicethrone:token-response:dmg-1:beforeDamageReceived:0',
                    choiceCandidateId: 'skip',
                    opportunityId: 'opportunity:dmg-1',
                    finalDamage: 5,
                    fullyEvaded: false,
                },
                sourceCommandType: 'SKIP_TOKEN_RESPONSE',
                timestamp: 1,
            }],
            command: {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '0',
                payload: {},
                timestamp: 1,
            },
            random: fixedRandom,
            playerIds: ['0', '1'],
        });

        expect(getCurrentInteractionSummary(result!.state).id).toBeUndefined();
        expect(result?.state?.sys.resolution).toBeUndefined();
    });

    it('TOKEN_RESPONSE_CLOSED 匹配队列中的 Token 响应时，不会关闭前台卡牌交互', () => {
        const state = makeDomainState(makeChoiceRequest({
            metadata: { opportunityId: 'opportunity:dmg-1' },
        }));
        replaceCurrentInteractionAndQueuePrevious(state, {
            id: 'dt-card-interaction-live',
            kind: 'dt:card-interaction',
            playerId: '0',
            data: {
                type: 'selectStatus',
                playerId: '0',
                sourceCardId: 'card-live',
            },
        });
        const system = createDiceThroneEventSystem();

        const result = system.afterEvents?.({
            state,
            events: [{
                type: 'TOKEN_RESPONSE_CLOSED',
                payload: {
                    pendingDamageId: 'dmg-1',
                    choiceRequestId: 'dicethrone:token-response:dmg-1:beforeDamageReceived:0',
                    choiceCandidateId: 'skip',
                    opportunityId: 'opportunity:dmg-1',
                    finalDamage: 5,
                    fullyEvaded: false,
                },
                sourceCommandType: 'SKIP_TOKEN_RESPONSE',
                timestamp: 1,
            }],
            command: {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '0',
                payload: {},
                timestamp: 1,
            },
            random: fixedRandom,
            playerIds: ['0', '1'],
        });

        expect(getCurrentInteractionSummary(result!.state)).toMatchObject({
            id: 'dt-card-interaction-live',
            kind: 'dt:card-interaction',
        });
        expect(result?.state?.sys.interaction.queue).toEqual([]);
    });

    it('旧裸 TOKEN_RESPONSE_CLOSED 按 pendingDamageId 移除队列 Token 响应，不关闭前台交互', () => {
        const state = makeDomainState(null);
        injectRawBlockingInteraction(state, {
            id: 'dt-card-interaction-live',
            kind: 'dt:card-interaction',
            playerId: '0',
            data: {
                type: 'selectStatus',
                playerId: '0',
                sourceCardId: 'card-live',
            },
        });
        setInteractionQueue(state, [{
            id: 'dt-token-response-dmg-1',
            kind: 'dt:token-response',
            playerId: '0',
            data: {},
        }]);
        const system = createDiceThroneEventSystem();

        const result = system.afterEvents?.({
            state,
            events: [{
                type: 'TOKEN_RESPONSE_CLOSED',
                payload: {
                    pendingDamageId: 'dmg-1',
                    finalDamage: 5,
                    fullyEvaded: false,
                },
                sourceCommandType: 'SKIP_TOKEN_RESPONSE',
                timestamp: 1,
            }],
            command: {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '0',
                payload: {},
                timestamp: 1,
            },
            random: fixedRandom,
            playerIds: ['0', '1'],
        });

        expect(getCurrentInteractionSummary(result!.state)).toMatchObject({
            id: 'dt-card-interaction-live',
            kind: 'dt:card-interaction',
        });
        expect(result?.state?.sys.interaction.queue).toEqual([]);
    });

    it('TOKEN_RESPONSE_CLOSED 来源合同不匹配当前交互时直接报错', () => {
        const state = makeDomainState(makeChoiceRequest({
            requestId: 'dicethrone:token-response:live:beforeDamageReceived:0',
            metadata: { opportunityId: 'opportunity:live' },
        }));
        const system = createDiceThroneEventSystem();

        expect(() => system.afterEvents?.({
            state,
            events: [{
                type: 'TOKEN_RESPONSE_CLOSED',
                payload: {
                    pendingDamageId: 'dmg-1',
                    choiceRequestId: 'dicethrone:token-response:stale:beforeDamageReceived:0',
                    choiceCandidateId: 'skip',
                    opportunityId: 'opportunity:stale',
                    finalDamage: 5,
                    fullyEvaded: false,
                },
                sourceCommandType: 'SKIP_TOKEN_RESPONSE',
                timestamp: 1,
            }],
            command: {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '0',
                payload: {},
                timestamp: 1,
            },
            random: fixedRandom,
            playerIds: ['0', '1'],
        })).toThrow('TOKEN_RESPONSE_CLOSED 来源 ChoiceRequest');
    });

    it('TOKEN_RESPONSE_CLOSED 带 ResolutionFrame 来源时不能关闭其它 frame', () => {
        const state = makeDomainState(makeChoiceRequest({
            metadata: {
                opportunityId: 'opportunity:dmg-1',
                resolutionFrameId: 'dicethrone:token-response-frame:dmg-1',
            },
        }));
        attachTokenResponseFrame(state, 'dicethrone:token-response-frame:dmg-1');
        const system = createDiceThroneEventSystem();

        expect(() => system.afterEvents?.({
            state,
            events: [{
                type: 'TOKEN_RESPONSE_CLOSED',
                payload: {
                    pendingDamageId: 'dmg-1',
                    choiceRequestId: 'dicethrone:token-response:dmg-1:beforeDamageReceived:0',
                    choiceCandidateId: 'skip',
                    opportunityId: 'opportunity:dmg-1',
                    resolutionFrameId: 'dicethrone:token-response-frame:other-damage',
                    finalDamage: 5,
                    fullyEvaded: false,
                },
                sourceCommandType: 'SKIP_TOKEN_RESPONSE',
                timestamp: 1,
            }],
            command: {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '0',
                payload: {},
                timestamp: 1,
            },
            random: fixedRandom,
            playerIds: ['0', '1'],
        })).toThrow('TOKEN_RESPONSE_CLOSED 所属 ResolutionFrame');
    });
});
