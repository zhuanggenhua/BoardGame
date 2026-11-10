import { describe, expect, it } from 'vitest';
import {
    assertFeedbackDiagnosticPacketConsumed,
    buildFeedbackDiagnosticPacket,
    projectFeedbackDiagnosticPacket,
    projectFeedbackSnapshot,
    serializeFeedbackDiagnosticPacket,
} from '../feedback/diagnosticPacket';

const state = {
    sys: {
        schemaVersion: 1,
        matchId: 'match-1',
        roomId: 'room-1',
        phase: 'scoreBases',
        turnNumber: 4,
        decisionEpoch: 9,
        interaction: { current: { id: 'interaction-1', kind: 'choose' } },
        responseWindow: { current: { id: 'response-1' } },
        actionLog: { entries: [{ type: 'score' }] },
        eventStream: { entries: [{ type: 'base_scored' }] },
        undo: { snapshots: [] },
    },
    core: { currentPlayer: '1' },
} as any;

describe('FeedbackDiagnosticPacket', () => {
    it('联网投影剥离撤回快照时不能误报完整可重放', () => {
        const projected = { ...state, sys: { ...state.sys, undo: { snapshots: [], snapshotCount: 3 } } };
        const packet = buildFeedbackDiagnosticPacket({
            state: projected, before: projected, after: projected, source: 'user',
            roomId: 'room-1', requestId: 'request-1', stateId: 12, stateRevision: 3,
            randomCursor: 17, clientContext: { matchId: 'match-1' },
        });
        expect(packet.replayability).toBe('partial');
        expect(packet.missingFields).toContain('undo.snapshots');
    });
    it('缺少随机游标或决策序号时不能标记为完整可复现', () => {
        const args = {
            state, before: state, after: state, source: 'client-auto' as const,
            roomId: 'room-1', requestId: 'request-1', stateId: 12, stateRevision: 3,
            clientContext: { matchId: 'match-1' },
        };
        const withoutRandom = buildFeedbackDiagnosticPacket(args);
        expect(withoutRandom.replayability).toBe('partial');
        expect(withoutRandom.missingFields).toContain('randomCursor');

        const withoutEpoch = buildFeedbackDiagnosticPacket({
            ...args, state: { ...state, sys: { ...state.sys, decisionEpoch: undefined } }, randomCursor: 0,
        });
        expect(withoutEpoch.replayability).toBe('partial');
        expect(withoutEpoch.missingFields).toContain('correlation.decisionEpoch');
    });
    it('缺少原始关联和前后状态时明确降级为 partial 并列出缺失字段', () => {
        const packet = buildFeedbackDiagnosticPacket({
            state,
            source: 'user' as const,
            clientContext: { matchId: 'match-1', appCommitSha: 'abc123' },
        });

        expect(packet.replayability).toBe('partial');
        expect(packet.collectionStatus).toBe('partial');
        expect(packet.correlation.matchId).toBe('match-1');
        expect(packet.phase).toBe('scoreBases');
        expect(packet.interaction).toEqual({ id: 'interaction-1', kind: 'choose' });
        expect(packet.missingFields).toEqual(expect.arrayContaining([
            'correlation.roomId',
            'correlation.requestId',
            'correlation.stateId',
            'randomCursor',
            'snapshots.before',
            'snapshots.after',
        ]));
    });

    it('补齐状态时点、稳定关联和前后快照后标记为 full', () => {
        const versionedState = { ...state, sys: { ...state.sys, revision: 3, decisionEpoch: 9 } };
        const packet = buildFeedbackDiagnosticPacket({
            state: versionedState,
            before: versionedState,
            after: versionedState,
            source: 'client-auto',
            roomId: 'room-1',
            requestId: 'request-1',
            stateId: 12,
            randomCursor: 17,
            clientContext: { matchId: 'match-1' },
        });

        expect(packet.replayability).toBe('partial');
        expect(packet.collectionStatus).toBe('partial');
        expect(packet.missingFields).toEqual(['snapshots.privateStateRedacted']);
        expect(packet.randomCursor).toBe(17);
        expect(packet.correlation).toMatchObject({
            matchId: 'match-1',
            roomId: 'room-1',
            requestId: 'request-1',
            stateId: 12,
            stateRevision: 3,
            decisionEpoch: 9,
        });
    });

    it('在线权威私有现场尚未绑定前必须显式标记缺失与附件状态', () => {
        const args = {
            state,
            before: state,
            after: state,
            source: 'user',
            roomId: 'room-1',
            requestId: 'request-1',
            stateId: 12,
            stateRevision: 3,
            randomCursor: 17,
            clientContext: { matchId: 'match-1' },
            privateReplayRequired: true,
            collectionErrors: ['private_replay_pending_attachment'],
        };
        const packet = buildFeedbackDiagnosticPacket(args);

        expect(packet.collectionStatus).toBe('partial');
        expect(packet.replayability).toBe('partial');
        expect(packet.missingFields).toContain('privateReplay');
        expect(packet.missingFields).toContain('privateReplay.trigger');
        expect(packet.collectionErrors).toContain('private_replay_pending_attachment');
        const serialized = JSON.parse(serializeFeedbackDiagnosticPacket(packet)!);
        expect(serialized.missingFields).toContain('privateReplay');
        expect(serialized.missingFields).toContain('privateReplay.trigger');
        expect(serialized.collectionErrors).toContain('private_replay_pending_attachment');

        const prepared = buildFeedbackDiagnosticPacket({ ...args, privateReplayTriggerCaptured: true });
        expect(prepared.missingFields).toContain('privateReplay');
        expect(prepared.missingFields).not.toContain('privateReplay.trigger');
    });

    it('没有独立 revision 字段时保留 decisionEpoch 并明确报告 stateRevision 缺失', () => {
        const packet = buildFeedbackDiagnosticPacket({
            state,
            before: state,
            after: state,
            source: 'client-auto',
            roomId: 'room-1',
            requestId: 'request-1',
            stateId: 12,
            randomCursor: 17,
            clientContext: { matchId: 'match-1' },
        });

        expect(packet.collectionStatus).toBe('partial');
        expect(packet.correlation.stateRevision).toBeUndefined();
        expect(packet.correlation.decisionEpoch).toBe(9);
        expect(packet.missingFields).toContain('correlation.stateRevision');
    });

    it('匿名历史诊断投影只保留枚举白名单和规范缺失字段', () => {
        const projected = projectFeedbackDiagnosticPacket({
            schemaVersion: 1,
            source: 'legacy-source-canary',
            collectionStatus: 'legacy-status-canary',
            replayability: 'legacy-replayability-canary',
            missingFields: ['legacy-missing-field-canary', 'snapshots.before', 'correlation.stateRevision'],
        })!;

        expect(projected).not.toHaveProperty('source');
        expect(projected).not.toHaveProperty('collectionStatus');
        expect(projected).not.toHaveProperty('replayability');
        expect(projected.missingFields).toEqual(['snapshots.before', 'correlation.stateRevision']);
        expect(JSON.stringify(projected)).not.toContain('legacy-');
    });

    it('诊断包各摘要仅保留白名单字段，不序列化命令、选择、牌区、随机种子或未知 payload', () => {
        const secret = 'hidden-card-option-canary';
        const unsafeState = {
            ...state,
            sys: {
                ...state.sys,
                interaction: { current: { id: 'choice-1', kind: 'simple-choice', playerId: '0', data: { options: [{ id: secret }] } } },
                responseWindow: { current: { id: 'response-1', windowType: 'before-damage', sourceId: secret, responderQueue: ['0'], passedPlayers: [] } },
                actionLog: { entries: [{ id: 'log-1', timestamp: 1, actorId: '0', kind: 'CHOOSE', segments: [{ text: secret }] }] },
                eventStream: { entries: [{ id: 1, event: { type: 'CHOICE_RESOLVED', timestamp: 2, payload: { optionId: secret }, resolutionContinuation: { payload: { cardId: secret } } } }] },
                undo: { snapshots: [{ core: { players: { '0': { hand: [{ id: secret }] } } } }] },
            },
            core: { currentPlayer: '0', players: { '0': { hand: [{ id: secret }] } } },
        } as any;
        const packet = buildFeedbackDiagnosticPacket({
            state: unsafeState,
            before: unsafeState,
            after: unsafeState,
            source: 'user',
            lastCommand: {
                commandType: 'RESOLVE_INTERACTION',
                playerId: '0',
                payload: { optionId: secret, cardId: secret },
                unknownNested: { value: secret },
            },
            commandTraceTail: [{ commandType: 'PLAY_CARD', payload: { cardId: secret } }],
            legalActions: [{ type: 'PLAY_CARD', payload: { cardId: secret } }],
            aiDecisionPreview: { commandType: 'PLAY_CARD', selectedOptionId: secret, randomSeed: secret },
            randomCursor: 8,
        });

        expect(packet.lastCommand).toEqual({ commandType: 'RESOLVE_INTERACTION', playerId: '0' });
        expect(packet.commandTraceTail).toEqual([{ commandType: 'PLAY_CARD' }]);
        expect(JSON.stringify(packet)).not.toContain(secret);
        expect(JSON.stringify(packet)).not.toContain('randomSeed');
        expect(packet.eventStreamTail).toEqual([{ id: 1, event: { type: 'CHOICE_RESOLVED', timestamp: 2 } }]);
        expect(packet.interaction).toEqual({ id: 'choice-1', kind: 'simple-choice', playerId: '0', optionCount: 1, disabledOptionCount: 0 });
        expect(packet.responseWindow).toMatchObject({ id: 'response-1', windowType: 'before-damage', responderCount: 1 });
        expect(packet.legalActions).toEqual({ count: 1, types: ['PLAY_CARD'] });
    });

    it('导入现场包后必须从运行时状态证明阶段、交互和关联键已被消费', () => {
        const packet = buildFeedbackDiagnosticPacket({
            state,
            before: state,
            after: state,
            source: 'client-auto',
            roomId: 'room-1',
            requestId: 'interaction-1',
            stateId: 12,
            stateRevision: 12,
            clientContext: { matchId: 'match-1' },
        });

        const result = assertFeedbackDiagnosticPacketConsumed({
            packet,
            runtimeState: { ...state, sys: { ...state.sys, revision: 12 } },
            runtimeStateId: 12,
        });

        expect(result.consumed).toBe(true);
        expect(result.reasons).toEqual([]);
        expect(result.observed).toMatchObject({
            matchId: 'match-1',
            roomId: 'room-1',
            requestId: 'interaction-1',
            stateId: 12,
            stateRevision: 12,
            decisionEpoch: 9,
            phase: 'scoreBases',
        });
    });

    it('服务器自动反馈摘要经过构建、序列化和再次白名单投影后仍保留定位字段', () => {
        const secret = 'hidden-qidahen-option-canary';
        const packet = {
            schemaVersion: 1,
            captureId: 'capture-qidahen-watchdog',
            capturedAt: '2026-11-05T00:00:00.000Z',
            source: 'server',
            collectionStatus: 'partial',
            replayability: 'partial',
            missingFields: [],
            correlation: { matchId: 'match-qidahen', stateId: 22, stateRevision: 9, decisionEpoch: 4 },
            phase: 'select-region',
            turnNumber: 5,
            currentPlayerId: '1',
            snapshots: {
                before: { matchId: 'match-qidahen', phase: 'select-region', stateRevision: 8 },
                at: {
                    matchId: 'match-qidahen',
                    gameId: 'qidahen',
                    phase: 'select-region',
                    turnNumber: 5,
                    currentPlayerId: '1',
                    blockerFingerprint: 'phase:select-region|choice:2',
                    progressMarker: 'turn-5|step-2',
                    interaction: {
                        isBlocked: true,
                        seat: { id: 'choice-1', kind: 'selection', options: [{ id: secret }] },
                        seatSelectability: {
                            totalOptions: 2,
                            enabledOptions: 0,
                            disabledOptions: 2,
                            minSelectionCount: 1,
                            selectionState: 'all-options-disabled',
                            disabledOptionIds: [secret],
                        },
                        seatUnsatisfiableReason: 'all-options-disabled',
                    },
                    legalActions: {
                        total: 2,
                        truncated: false,
                        items: [{ actionId: secret, label: secret, commandTypes: ['SELECT_REGION'] }],
                    },
                    responseWindow: { id: 'response-1', windowType: 'before-damage', responderQueue: ['0', '1'] },
                    aiDecisionPreview: { commandType: 'SELECT_REGION', candidateCount: 2, selectedOptionId: secret },
                    gameStateSummary: {
                        turnPhase: 'march',
                        factionOwners: { 'player-map-canary': 'hidden-faction-canary' },
                        factionSelection: { pendingPlayerIds: ['player-map-canary', '1'], selectedPlayerIds: [secret] },
                        scenarioVote: { pendingPlayerIds: ['player-map-canary'] },
                        pendingScenarioCharacterChoices: [{ count: 2, optionCount: 3, characterIds: [secret] }],
                        secret: secret,
                    },
                },
                after: { matchId: 'match-qidahen', phase: 'select-region', stateRevision: 9 },
            },
            interaction: { id: 'choice-1', kind: 'selection', data: { options: [{ id: secret }] } },
            responseWindow: { id: 'response-1', windowType: 'before-damage', responderQueue: ['0', '1'] },
            legalActions: [{ type: 'SELECT_REGION', payload: { regionId: secret } }],
            actionLogTail: [{ id: 'log-1', kind: 'SELECT_REGION', segments: [{ text: secret }] }],
        };

        const once = projectFeedbackDiagnosticPacket(packet)!;
        const serialized = serializeFeedbackDiagnosticPacket(packet as any)!;
        const twice = projectFeedbackDiagnosticPacket(JSON.parse(serialized))!;
        const persistedAgain = projectFeedbackDiagnosticPacket(once)!;
        const at = once.snapshots && (once.snapshots as any).at;

        expect(persistedAgain).toEqual(once);
        expect(twice).toEqual(once);
        expect(once.legalActions).toEqual({ count: 1, types: ['SELECT_REGION'] });
        expect((once.interaction as any).optionCount).toBe(1);
        expect((once.responseWindow as any).responderCount).toBe(2);
        expect((once.actionLogTail as any[])[0].segmentCount).toBe(1);
        expect(at).toMatchObject({
            hasBlockerFingerprint: true,
            hasProgressMarker: true,
            currentPlayerId: '1',
            interaction: { isBlocked: true, seatSelectability: { totalOptions: 2, enabledOptions: 0, selectionState: 'all-options-disabled' } },
            legalActions: { count: 2, types: ['SELECT_REGION'] },
            gameStateSummary: {
                turnPhase: 'march',
                factionSelection: { active: true, pendingCount: 2, selectedCount: 1 },
                scenarioVote: { active: true, pendingCount: 1 },
                pendingScenarioCharacterChoiceCount: 1,
            },
        });
        expect(JSON.stringify(once)).not.toContain(secret);
        expect(JSON.stringify(once)).not.toContain('phase:select-region|choice:2');
        expect(JSON.stringify(once)).not.toContain('turn-5|step-2');

        const directSnapshot = projectFeedbackSnapshot({
            phase: 'select-region',
            gameStateSummary: { turnPhase: 'march', factionSelection: { pendingPlayerIds: ['0'] } },
        });
        expect(directSnapshot).toMatchObject({
            gameStateSummary: { turnPhase: 'march', factionSelection: { active: true, pendingCount: 1 } },
        });
        expect(JSON.stringify(once)).not.toContain('player-map-canary');
        expect(JSON.stringify(once)).not.toContain('hidden-faction-canary');
    });

    it('真实状态字段中的手牌、隐藏派系和玩家映射不会进入诊断包', () => {
        const privateCanaries = [
            'actual-hand-card-canary',
            'actual-hidden-faction-canary',
            'actual-player-map-canary',
        ];
        const authoritativeState = {
            sys: { phase: 'select-faction', turnNumber: 1 },
            core: {
                hand: [privateCanaries[0]],
                selectedFactions: { 'actual-player-map-canary': privateCanaries[1] },
                factionSelection: {
                    takenFactions: [privateCanaries[1]],
                    playerSelections: { 'actual-player-map-canary': [privateCanaries[1]] },
                },
            },
        };

        const packet = projectFeedbackDiagnosticPacket({
            source: 'server',
            collectionStatus: 'complete',
            replayability: 'partial',
            snapshots: { before: authoritativeState, at: authoritativeState, after: authoritativeState },
        })!;
        const serialized = JSON.stringify(packet);
        for (const canary of privateCanaries) expect(serialized).not.toContain(canary);
        expect((packet.snapshots as any).at.core).toBeUndefined();
    });

    it('reason、blocker fingerprint 和 progress marker 只公开安全类别与存在性', () => {
        const privateCanary = 'private-card-option-reason-canary';
        const projected = projectFeedbackSnapshot({
            phase: 'offensiveRoll',
            reason: `pipeline_error: ${privateCanary}`,
            blockerFingerprint: `simple-choice:${privateCanary}`,
            progressMarker: `interaction:${privateCanary}`,
        });

        expect(projected).toMatchObject({
            phase: 'offensiveRoll',
            reason: 'pipeline_error',
            hasBlockerFingerprint: true,
            hasProgressMarker: true,
        });
        expect(JSON.stringify(projected)).not.toContain(privateCanary);
    });
});
