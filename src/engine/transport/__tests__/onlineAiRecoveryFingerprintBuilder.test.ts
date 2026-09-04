import { describe, expect, it } from 'vitest';
import { GameTransportServer } from '../server';
import { buildAiProgressMarker, resolveForceEndTurnForStalledAi } from '../onlineAiRecovery';
import { createCompareRollChoice, createSimpleChoice } from '../../systems/InteractionSystem';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfig,
    createEngineConfigWithId,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
} from './helpers/serverTestHarness';

describe('online AI recovery fingerprint builder', () => {
    it('buildOnlineAiRecoveryFingerprint 在 visible simple-choice 的 option id/disabled 相同但 value 漂移时，也必须变化', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-visible-simple-choice-value-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-1',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'trigger:afterScoring:base_a:1:0',
                                label: '先结算触发 A',
                                value: { kind: 'trigger', triggerId: 'afterScoring:base_a:1:0' },
                            },
                            {
                                id: 'pass',
                                label: 'Pass',
                                value: { kind: 'pass' },
                            },
                        ],
                        { sourceId: 'smashup_reaction_choose' },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-visible-simple-choice-value-drift');
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };

        const baseCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
        });
        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            baseCandidate,
            buildAiProgressMarker(match.state),
        );

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-1',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'trigger:afterScoring:base_a:1:0',
                                label: '先结算触发 A',
                                value: { kind: 'trigger', triggerId: 'afterScoring:base_a:1:0:drifted' },
                            },
                            {
                                id: 'pass',
                                label: 'Pass',
                                value: { kind: 'pass' },
                            },
                        ],
                        { sourceId: 'smashup_reaction_choose' },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            },
        };

        const driftedCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
        });
        const driftedFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            driftedCandidate,
            buildAiProgressMarker(match.state),
        );

        expect(baseFingerprint).not.toBe(driftedFingerprint);
    });
    it('buildOnlineAiRecoveryFingerprint 在 visible simple-choice 的 sourceId/title/options 相同但 slider 配置漂移时，也必须变化', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        const baseChoice = createSimpleChoice(
            'reaction-slider-choice',
            '1',
            '选择要转移的数量',
            [
                {
                    id: 'confirm',
                    label: '确认转移',
                    value: { kind: 'confirm' },
                },
                {
                    id: 'skip',
                    label: '跳过',
                    value: { kind: 'pass', skip: true },
                },
            ],
            { sourceId: 'giant_ants_transfer_counter_prompt' },
        );
        (baseChoice.data as typeof baseChoice.data & { slider?: unknown }).slider = {
            min: 1,
            max: 2,
            step: 1,
            defaultValue: 2,
            confirmOptionId: 'confirm',
            skipOptionId: 'skip',
            confirmLabel: '确认转移 {{value}}',
            valueLabel: '当前数量：{{value}} / {{max}}',
            skipLabel: '跳过',
        };

        await storage.createMatch('match-watchdog-visible-simple-choice-slider-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: baseChoice,
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-visible-simple-choice-slider-drift');
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };

        const baseCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
            gameId: 'smashup',
        });
        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            baseCandidate,
            buildAiProgressMarker(match.state),
        );

        const driftedChoice = createSimpleChoice(
            'reaction-slider-choice',
            '1',
            '选择要转移的数量',
            [
                {
                    id: 'confirm',
                    label: '确认转移',
                    value: { kind: 'confirm' },
                },
                {
                    id: 'skip',
                    label: '跳过',
                    value: { kind: 'pass', skip: true },
                },
            ],
            { sourceId: 'giant_ants_transfer_counter_prompt' },
        );
        (driftedChoice.data as typeof driftedChoice.data & { slider?: unknown }).slider = {
            min: 1,
            max: 4,
            step: 1,
            defaultValue: 4,
            confirmOptionId: 'confirm',
            skipOptionId: 'skip',
            confirmLabel: '确认转移 {{value}}',
            valueLabel: '当前数量：{{value}} / {{max}}',
            skipLabel: '跳过',
        };

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                interaction: {
                    current: driftedChoice,
                    queue: [],
                    isBlocked: false,
                },
            },
        };

        const driftedCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
            gameId: 'smashup',
        });
        const driftedFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            driftedCandidate,
            buildAiProgressMarker(match.state),
        );

        expect(baseFingerprint).not.toBe(driftedFingerprint);
    });
    it('buildOnlineAiRecoveryFingerprint 在 compare-roll-choice 的 interactionId/sourceId 相同但 confirmValue 漂移时，也必须变化', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-compare-roll-confirm-value-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: createCompareRollChoice(
                        'compare-roll-choice-1',
                        '1',
                        {
                            title: 'compareRoll.gunslingerDuel.title',
                            sourceId: 'gunslinger_showdown',
                            contestants: [
                                { playerId: '1', roll: 6, labelKey: 'compareRoll.gunslingerDuel.attacker', characterId: 'gunslinger' },
                                { playerId: '0', roll: 2, labelKey: 'compareRoll.gunslingerDuel.defender', characterId: 'monk' },
                            ],
                            options: [
                                { id: 'confirm', label: '确认', value: { accepted: true } },
                            ],
                            confirmValue: { accepted: true },
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-compare-roll-confirm-value-drift');
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };

        const baseCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
        });
        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            baseCandidate,
            buildAiProgressMarker(match.state),
        );

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                interaction: {
                    current: createCompareRollChoice(
                        'compare-roll-choice-1',
                        '1',
                        {
                            title: 'compareRoll.gunslingerDuel.title',
                            sourceId: 'gunslinger_showdown',
                            contestants: [
                                { playerId: '1', roll: 6, labelKey: 'compareRoll.gunslingerDuel.attacker', characterId: 'gunslinger' },
                                { playerId: '0', roll: 2, labelKey: 'compareRoll.gunslingerDuel.defender', characterId: 'monk' },
                            ],
                            options: [
                                { id: 'confirm', label: '确认', value: { accepted: false } },
                            ],
                            confirmValue: { accepted: false },
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
            },
        };

        const driftedCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
        });
        const driftedFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            driftedCandidate,
            buildAiProgressMarker(match.state),
        );

        expect(baseFingerprint).not.toBe(driftedFingerprint);
    });
    it('buildOnlineAiRecoveryFingerprint 在 multistep-choice 的 sourceId 相同但 allowed/completed 骰集合漂移时，也必须变化', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-multistep-choice-dice-signature-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'multistep-choice-1',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'santa_s_coming',
                            allowedDieIds: [0, 1, 2],
                            completedDieIds: [0],
                            meta: {
                                dtType: 'selectDie',
                                selectCount: 2,
                            },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-multistep-choice-dice-signature-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: false,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:multistep-choice-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:multistep-choice-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };

        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        );

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                interaction: {
                    current: {
                        id: 'multistep-choice-1',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'santa_s_coming',
                            allowedDieIds: [1, 2, 3],
                            completedDieIds: [1, 2],
                            meta: {
                                dtType: 'selectDie',
                                selectCount: 2,
                            },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            },
        };

        const driftedFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        );

        expect(baseFingerprint).not.toBe(driftedFingerprint);
    });
    it('buildOnlineAiRecoveryFingerprint 在 multistep-choice 的 allowed/completed 相同但 selectCount 漂移时，也必须变化', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-multistep-choice-select-count-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'multistep-choice-1',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'shadow_thief_samesies',
                            allowedDieIds: [0, 1, 2],
                            completedDieIds: [],
                            meta: {
                                dtType: 'selectDie',
                                selectCount: 1,
                            },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-multistep-choice-select-count-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: false,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:multistep-choice-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:multistep-choice-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };

        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        );

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                interaction: {
                    current: {
                        id: 'multistep-choice-1',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'shadow_thief_samesies',
                            allowedDieIds: [0, 1, 2],
                            completedDieIds: [],
                            meta: {
                                dtType: 'selectDie',
                                selectCount: 2,
                            },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            },
        };

        const driftedFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        );

        expect(baseFingerprint).not.toBe(driftedFingerprint);
    });
    it('buildOnlineAiRecoveryFingerprint 在 multistep-choice 的 allowed/completed 相同但 dieModifyConfig 漂移时，也必须变化', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-multistep-choice-die-config-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                interaction: {
                    current: {
                        id: 'multistep-choice-1',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'gunslinger_tip_it',
                            allowedDieIds: [0, 1],
                            completedDieIds: [0],
                            meta: {
                                dtType: 'modifyDie',
                                selectCount: 1,
                                dieModifyConfig: {
                                    mode: 'set',
                                    targetValue: 1,
                                },
                            },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-multistep-choice-die-config-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: false,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:multistep-choice-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:multistep-choice-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };

        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        );

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                interaction: {
                    current: {
                        id: 'multistep-choice-1',
                        playerId: '1',
                        kind: 'multistep-choice',
                        data: {
                            title: 'dice.modify',
                            sourceId: 'gunslinger_tip_it',
                            allowedDieIds: [0, 1],
                            completedDieIds: [0],
                            meta: {
                                dtType: 'modifyDie',
                                selectCount: 1,
                                dieModifyConfig: {
                                    mode: 'set',
                                    targetValue: 6,
                                },
                            },
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            },
        };

        const driftedFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        );

        expect(baseFingerprint).not.toBe(driftedFingerprint);
    });
    it('buildOnlineAiRecoveryFingerprint 在 dt:defender-choice 的 interactionId/sourceId 相同但 sourceId 漂移时，也必须变化', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-dt-defender-choice-source-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'targetingRoll',
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                },
                interaction: {
                    current: {
                        id: 'dt-defender-choice-1',
                        playerId: '1',
                        kind: 'dt:defender-choice',
                        data: {
                            attackerId: '0',
                            chooserPlayerId: '1',
                            sourceId: 'barbarian_reckless',
                            targetRollValue: 6,
                            options: [
                                { playerId: '2', customId: 'defender-2' },
                                { playerId: '3', customId: 'defender-3' },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dt-defender-choice-source-drift');
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };

        const baseCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
        });
        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            baseCandidate,
            buildAiProgressMarker(match.state),
        );

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                interaction: {
                    current: {
                        id: 'dt-defender-choice-1',
                        playerId: '1',
                        kind: 'dt:defender-choice',
                        data: {
                            attackerId: '0',
                            chooserPlayerId: '1',
                            sourceId: 'barbarian_reckless_drifted',
                            targetRollValue: 6,
                            options: [
                                { playerId: '2', customId: 'defender-2' },
                                { playerId: '3', customId: 'defender-3' },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            },
        };

        const driftedCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
        });
        const driftedFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            driftedCandidate,
            buildAiProgressMarker(match.state),
        );

        expect(baseFingerprint).not.toBe(driftedFingerprint);
    });
    it('buildOnlineAiRecoveryFingerprint 在 dt:token-response 的 sourceId/title 相同但 pendingDamage 语义漂移时，也必须变化', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-dt-token-response-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'defensiveRoll',
                pendingDamage: {
                    id: 'pending-damage-1',
                    responderId: '1',
                    responseType: 'token',
                    currentDamage: 2,
                    sourceAbilityId: 'barbarian_revenge',
                    tokenUsageTotals: { rage: 2 },
                },
                interaction: {
                    current: {
                        id: 'token-response-1',
                        playerId: '1',
                        kind: 'dt:token-response',
                        data: {
                            sourceId: 'barbarian_revenge',
                            title: '是否消耗 token',
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dt-token-response-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: false,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:token-response-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:token-response-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };

        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        );

        match.state = {
            ...match.state,
            core: {
                ...match.state.core,
                pendingDamage: {
                    id: 'pending-damage-1',
                    responderId: '1',
                    responseType: 'token',
                    currentDamage: 4,
                    sourceAbilityId: 'barbarian_revenge',
                    tokenUsageTotals: { rage: 4 },
                },
            },
        };

        const driftedFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        );

        expect(baseFingerprint).not.toBe(driftedFingerprint);
    });
    it('buildOnlineAiRecoveryFingerprint 在 dt:bonus-dice 的 sourceId/title 相同但 settlement 语义漂移时，也必须变化', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-dt-bonus-dice-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'offensiveRoll',
                pendingBonusDiceSettlement: {
                    id: 'bonus-settlement-1',
                    attackerId: '1',
                    displayOnly: false,
                    rerollCount: 1,
                    dice: [{ index: 0, value: 6 }],
                },
                interaction: {
                    current: {
                        id: 'bonus-dice-1',
                        playerId: '1',
                        kind: 'dt:bonus-dice',
                        data: {
                            sourceId: 'bonus-roll',
                            title: '是否重掷奖励骰',
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dt-bonus-dice-drift');
        const candidate = {
            playerId: '1',
            reason: 'visible-interaction',
            requiresConfirmedAdvancePhase: false,
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:bonus-dice-1',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:bonus-dice-1',
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [],
                },
            },
        };

        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        );

        match.state = {
            ...match.state,
            core: {
                ...match.state.core,
                pendingBonusDiceSettlement: {
                    id: 'bonus-settlement-1',
                    attackerId: '1',
                    displayOnly: false,
                    rerollCount: 2,
                    dice: [{ index: 0, value: 4 }],
                },
            },
        };

        const driftedFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            candidate,
            buildAiProgressMarker(match.state),
        );

        expect(baseFingerprint).not.toBe(driftedFingerprint);
    });
    it('buildOnlineAiRecoveryFingerprint 在 response-window 的 source/responder 相同但 window id 漂移时，也必须变化', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();

        await storage.createMatch('match-watchdog-response-window-id-drift', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '0',
                phase: 'defensiveRoll',
                responseWindow: {
                    current: {
                        id: 'response-window-old-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-old-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            buildOnlineAiRecoveryFingerprint: (match: any, candidate: any, progressMarker: string) => string;
        };

        const match = await serverInternal.loadMatch('match-watchdog-response-window-id-drift');
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const },
        };

        const baseCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
        });
        const baseFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            baseCandidate,
            buildAiProgressMarker(match.state),
        );

        match.state = {
            ...match.state,
            sys: {
                ...match.state.sys,
                responseWindow: {
                    current: {
                        id: 'response-window-new-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-old-1',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        };

        const driftedCandidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates: {},
        });
        const driftedFingerprint = serverInternal.buildOnlineAiRecoveryFingerprint(
            match,
            driftedCandidate,
            buildAiProgressMarker(match.state),
        );

        expect(baseFingerprint).not.toBe(driftedFingerprint);
    });
});
