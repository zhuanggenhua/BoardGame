import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
    readPrivateFeedbackReplaysViaMongoSsh,
    summarizeFeedbackDiagnosticPacket,
    summarizeLegacyFeedbackDiagnostics,
    summarizePrivateFeedbackReplay,
} from './private-replay-diagnostic.mjs';

const FEEDBACK_ID = '64f0c0ffee00000000000001';

function encodeReplay(archive) {
    return gzipSync(Buffer.from(JSON.stringify(archive), 'utf8')).toString('base64');
}

test('私密回放摘要保留 Qidahen 故障定位字段并过滤隐藏选项内容', () => {
    const encoded = encodeReplay({
        schemaVersion: 1,
        matchId: 'private-replay-match-id-canary-7f31',
        gameId: 'qidahen',
        stateId: 734561,
        randomSeed: 'must-not-appear',
        randomCursor: 101,
        serverMetrics: { capturedAt: '2026-11-11T01:00:00.000Z', processUptimeSeconds: 120, processCpuUserMicros: 1234, processCpuSystemMicros: 567, processRssBytes: 500000, processHeapUsedBytes: 200000, systemLoadAverage: [1, 2, 3], secret: 'server-private-canary' },
        state: {
            sys: {
                phase: '', turnNumber: 0,
                interaction: {
                    isBlocked: true,
                    current: { playerId: 'private-interaction-player-canary-7f31', type: 'choice', data: { sourceId: 'private-source-id-canary' } },
                },
            },
            core: {
                turnPhase: 'action-window',
                currentPlayer: 'private-current-player-canary-7f31',
                playerIds: ['0', 'private-player-map-canary'],
                factions: {
                    'hidden-faction-canary': { playerId: 'private-player-map-canary' },
                    other: { playerId: '0' },
                },
                factionSelection: { selections: { 'private-player-map-canary': 'hidden-faction-canary' } },
                pendingScenarioCharacterChoices: [{
                    id: 'private-choice-id-canary', factionId: 'hidden-faction-canary', count: 1,
                    characterIds: ['secret-character-a', 'secret-character-b'],
                }],
                pendingScenarioArmamentChoices: [{
                    id: 'private-armament-choice-id-canary', factionId: 'hidden-faction-canary', count: 1,
                    armamentIds: ['secret-armament'],
                }],
                hand: ['secret-hand-card'],
            },
        },
    });

    const summary = summarizePrivateFeedbackReplay(encoded);
    assert.equal(summary.status, 'available');
    assert.equal(summary.hasMatchId, true);
    assert.equal(summary.hasStateId, true);
    assert.equal(summary.randomCursor, 101);
    assert.deepEqual(summary.serverMetrics, { capturedAt: '2026-11-11T01:00:00.000Z', processUptimeSeconds: 120, processCpuUserMicros: 1234, processCpuSystemMicros: 567, processRssBytes: 500000, processHeapUsedBytes: 200000, systemLoadAverage: [1, 2, 3] });
    assert.equal(summary.stateSummary.hasCurrentPlayer, true);
    assert.deepEqual(summary.stateSummary.interaction, {
        isBlocked: true,
        current: { hasPlayerId: true, type: 'choice', hasSourceId: true },
    });
    assert.deepEqual(summary.stateSummary.factionSelection, {
        pendingCount: 1,
        selectedCount: 1,
    });
    assert.deepEqual(summary.stateSummary.pendingScenarioCharacterChoices, [{
        count: 1, optionCount: 2,
    }]);
    const serialized = JSON.stringify(summary);
    for (const secret of [
        'must-not-appear', 'secret-character-a', 'secret-armament', 'secret-hand-card',
        'hidden-faction-canary', 'private-player-map-canary', 'private-choice-id-canary',
        'private-armament-choice-id-canary', 'private-replay-match-id-canary-7f31',
        'private-current-player-canary-7f31', 'private-interaction-player-canary-7f31',
        'private-source-id-canary', 'server-private-canary', '734561',
    ]) {
        assert.equal(serialized.includes(secret), false);
    }
});

test('私密回放摘要如实区分缺失、无效编码和解压失败，且不复制捕获错误细节', () => {
    const missing = summarizePrivateFeedbackReplay(null, 'private_replay_capture_failed:secret-hand-card-value');
    assert.deepEqual(missing, {
        status: 'not-attached',
        captureFailure: 'capture-failed',
    });
    assert.equal(JSON.stringify(missing).includes('secret-hand-card-value'), false);
    assert.equal(summarizePrivateFeedbackReplay('not base64').status, 'invalid-encoding');
    assert.equal(summarizePrivateFeedbackReplay(Buffer.from('not gzip').toString('base64')).status, 'decode-failed');
    const availableButIncomplete = summarizePrivateFeedbackReplay(
        encodeReplay({ schemaVersion: 1, gameId: 'qidahen', state: { sys: {}, core: {} } }),
        'private_replay_missing:randomSeed,randomCursor',
    );
    assert.equal(availableButIncomplete.status, 'available');
    assert.equal(availableButIncomplete.captureFailure, 'missing-fields');
    assert.equal(JSON.stringify(availableButIncomplete).includes('randomSeed'), false);
});

test('结构化诊断摘要保留 replayability 和关联字段但不复制快照私密内容', () => {
    const summary = summarizeFeedbackDiagnosticPacket({
        schemaVersion: 1,
        captureId: 'private-capture-id-canary-7f31',
        chainId: 'private-chain-id-canary-7f31',
        source: 'server',
        collectionStatus: 'complete',
        replayability: 'partial',
        missingFields: ['snapshots.before'],
        correlation: {
            matchId: 'private-packet-match-id-canary-7f31',
            roomId: 'private-room-id-canary-7f31',
            requestId: 'private-request-id-canary-7f31',
            stateId: 876543,
            stateRevision: 876544,
            decisionEpoch: 876545,
        },
        gameId: 'qidahen',
        currentPlayerId: 'private-packet-player-id-canary-7f31',
        snapshots: {
            at: JSON.stringify({
                phase: '',
                turnNumber: 0,
                currentPlayerId: 'private-packet-player-id-canary-7f31',
                blockerFingerprint: 'active-turn-legal-only:1:secret-option-id:secret-option-value',
                progressMarker: 'attack:secret-option-id:secret-option-value',
                interaction: {
                    isBlocked: true,
                    sharedUnsatisfiableReason: 'all-options-disabled',
                    seatUnsatisfiableReason: 'private-option-value-canary',
                },
                legalActions: { total: 0, truncated: false, items: ['private-action-detail'] },
                aiDecisionPreview: { previewSource: 'seat-policy', chosenAction: null },
                hiddenData: ['private-card'],
            }),
        },
    });

    assert.equal(summary.replayability, 'partial');
    assert.deepEqual(summary.missingFields, ['snapshots.before']);
    assert.equal(summary.hasCaptureId, true);
    assert.equal(summary.hasChainId, true);
    assert.deepEqual(summary.correlation, {
        hasMatchId: true,
        hasRoomId: true,
        hasRequestId: true,
        hasStateId: true,
        hasStateRevision: true,
        hasDecisionEpoch: true,
    });
    assert.equal(summary.hasCurrentPlayer, true);
    assert.equal(summary.stateAtSummary.hasCurrentPlayer, true);
    assert.equal(summary.stateAtSummary.legalActions.total, 0);
    assert.equal(summary.stateAtSummary.hasBlockerFingerprint, true);
    assert.equal(summary.stateAtSummary.hasProgressMarker, true);
    assert.deepEqual(summary.stateAtSummary.interaction, {
        isBlocked: true,
        sharedUnsatisfiableReason: 'all-options-disabled',
    });
    assert.equal(JSON.stringify(summary).includes('private-card'), false);
    assert.equal(JSON.stringify(summary).includes('private-action-detail'), false);
    assert.equal(JSON.stringify(summary).includes('secret-option-id'), false);
    assert.equal(JSON.stringify(summary).includes('secret-option-value'), false);
    assert.equal(JSON.stringify(summary).includes('private-option-value-canary'), false);
    for (const identifier of [
        'private-capture-id-canary-7f31', 'private-chain-id-canary-7f31',
        'private-packet-match-id-canary-7f31', 'private-room-id-canary-7f31',
        'private-request-id-canary-7f31', 'private-packet-player-id-canary-7f31',
        '876543', '876544', '876545',
    ]) {
        assert.equal(JSON.stringify(summary).includes(identifier), false);
    }
    const withPrivateError = summarizeFeedbackDiagnosticPacket({
        collectionErrors: ['private_replay_capture_failed:secret-hand-card-value'],
    });
    assert.deepEqual(withPrivateError.collectionErrors, ['private-replay-capture-failed']);
    assert.equal(JSON.stringify(withPrivateError).includes('secret-hand-card-value'), false);
});

test('旧版本地状态摘要也只公开关联标识是否存在', () => {
    const summary = summarizeLegacyFeedbackDiagnostics({
        stateSnapshot: JSON.stringify({
            gameId: 'qidahen',
            matchId: 'private-legacy-match-canary-7f31',
            roomId: 'private-legacy-room-canary-7f31',
            requestId: 'private-legacy-request-canary-7f31',
            interactionId: 'private-legacy-interaction-canary-7f31',
            stateId: 987650,
            stateRevision: 987651,
            decisionEpoch: 987652,
            currentPlayerId: 'private-legacy-player-canary-7f31',
            phase: 'main2',
            turnNumber: 4,
            randomCursor: 17,
        }),
    });

    const serialized = JSON.stringify(summary);
    for (const identifier of [
        'private-legacy-match-canary-7f31', 'private-legacy-room-canary-7f31',
        'private-legacy-request-canary-7f31', 'private-legacy-interaction-canary-7f31',
        'private-legacy-player-canary-7f31', '987650', '987651', '987652',
    ]) {
        assert.equal(serialized.includes(identifier), false);
    }
    assert.deepEqual(summary.stateSnapshot, {
        present: true,
        gameId: 'qidahen',
        phase: 'main2',
        hasMatchId: true,
        hasRoomId: true,
        hasRequestId: true,
        hasInteractionId: true,
        hasCurrentPlayer: true,
        turnNumber: 4,
        hasStateId: true,
        hasStateRevision: true,
        hasDecisionEpoch: true,
        randomCursor: 17,
    });
});

test('历史诊断摘要拒绝未知来源状态和缺失路径，并限制缺失字段数量', () => {
    const summary = summarizeFeedbackDiagnosticPacket({
        source: 'legacy-source-canary',
        collectionStatus: 'legacy-status-canary',
        replayability: 'legacy-replayability-canary',
        missingFields: [
            'legacy-missing-field-canary',
            'snapshots.before',
            'correlation.matchId',
            'correlation.roomId',
            'correlation.requestId',
            'correlation.stateId',
            'correlation.stateRevision',
            'correlation.decisionEpoch',
            'randomCursor',
            'snapshots.at',
            'snapshots.privateStateRedacted',
            'snapshots.after',
            'undo.snapshots',
            'snapshots.before',
        ],
    });

    assert.equal('source' in summary, false);
    assert.equal('collectionStatus' in summary, false);
    assert.equal('replayability' in summary, false);
    assert.deepEqual(summary.missingFields, [
        'snapshots.before',
        'correlation.matchId',
        'correlation.roomId',
        'correlation.requestId',
        'correlation.stateId',
        'correlation.stateRevision',
        'correlation.decisionEpoch',
        'randomCursor',
        'snapshots.at',
        'snapshots.privateStateRedacted',
        'snapshots.after',
        'undo.snapshots',
    ]);
    assert.equal(summary.missingFields.length, 12);
    assert.equal(JSON.stringify(summary).includes('legacy-'), false);
});

test('生产私密回放读取只对指定 ID 做 Mongo 投影查询', () => {
    let sshCall;
    const encoded = encodeReplay({
        schemaVersion: 1,
        gameId: 'test-game',
        stateId: 1,
        state: { sys: {}, core: {} },
    });
    const result = readPrivateFeedbackReplaysViaMongoSsh([FEEDBACK_ID], {
        mongoSshTarget: 'reader@example.invalid',
        mongoCommand: 'docker exec -i mongodb mongosh --quiet boardgame',
        spawnSync: (binary, args, options) => {
            sshCall = { binary, args, options };
            return {
                status: 0,
                stdout: JSON.stringify({ items: [{ id: FEEDBACK_ID, privateReplay: encoded }] }),
            };
        },
    });

    assert.equal(sshCall.binary, 'ssh');
    assert.deepEqual(sshCall.args, [
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=8',
        '-o', 'ServerAliveInterval=5',
        '-o', 'ServerAliveCountMax=2',
        'reader@example.invalid',
        'docker exec -i mongodb mongosh --quiet boardgame',
    ]);
    assert.match(sshCall.options.input, /db\.feedbacks\.find/);
    assert.match(sshCall.options.input, /privateReplay: 1/);
    assert.doesNotMatch(sshCall.options.input, /updateOne|deleteOne|insertOne/);
    assert.equal(sshCall.options.timeout, 20_000);
    assert.equal(result.get(FEEDBACK_ID).privateReplay, encoded);
});

test('生产私密回放 SSH 超时被归类为只读失败且不泄漏底层错误', () => {
    assert.throws(
        () => readPrivateFeedbackReplaysViaMongoSsh([FEEDBACK_ID], {
            spawnSync: () => ({
                status: null,
                error: Object.assign(new Error('private host and key path'), { code: 'ETIMEDOUT' }),
            }),
        }),
        (error) => {
            assert.equal(error.message, '生产 Mongo 私密回放读取失败（ssh 退出码 unknown）');
            assert.equal(error.message.includes('private host'), false);
            return true;
        },
    );
});

test('生产私密回放读取拒绝无效 Mongo ID', () => {
    assert.throws(
        () => readPrivateFeedbackReplaysViaMongoSsh(['unsafe-id'], {
            spawnSync: () => assert.fail('无效 ID 不应触发 SSH'),
        }),
        /有效的 Mongo ObjectId/,
    );
});
