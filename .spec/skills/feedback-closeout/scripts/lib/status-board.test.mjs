import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assertItemCanUseStatus,
    buildBoardFromSummary,
} from './status-board.mjs';

const SUMMARY_PATH = 'temp/feedback-closeout/test-summary.json';

function makeResolvedSummary() {
    return {
        baseUrl: 'https://api.easyboardgame.top',
        generatedAt: '2026-08-14T15:52:11.213Z',
        groups: [
            {
                dedupeKey: 'dedupe-1',
                classification: 'bug_candidate',
                conflictKey: 'dicethrone::play/dicethrone/match',
                primaryId: '64f0c0ffee00000000000001',
                duplicateIds: [],
                groupSize: 1,
                gameId: 'dicethrone',
                type: 'bug',
                severity: 'low',
                status: 'resolved',
                summary: 'AI 卡死了',
                packetPath: 'temp/feedback-closeout/test/64f0c0ffee00000000000001.md',
                screenshotPaths: [],
            },
        ],
    };
}

test('同步线上历史 resolved 时补本地镜像证据与备注', () => {
    const board = buildBoardFromSummary(makeResolvedSummary(), SUMMARY_PATH);
    const item = board.items[0];

    assert.equal(item.status, 'resolved');
    assert.deepEqual(item.evidence, [
        'temp/feedback-closeout/test/64f0c0ffee00000000000001.md',
        SUMMARY_PATH,
    ]);
    assert.match(item.verification[0], /线上反馈接口在 2026-08-14T15:52:11\.213Z 返回该记录状态为 resolved/);
    assert.match(item.notes, /仅同步历史状态/);
    assert.doesNotThrow(() => assertItemCanUseStatus(item));
});

test('重新同步会回填旧状态板中缺失的历史 resolved 镜像字段', () => {
    const existingBoard = {
        version: 1,
        updatedAt: '2026-08-14T15:00:00.000Z',
        items: [
            {
                id: '64f0c0ffee00000000000001',
                feedbackId: '64f0c0ffee00000000000001',
                title: 'AI 卡死了',
                status: 'resolved',
                evidence: [],
                verification: [],
                notes: '',
                updatedAt: '2026-08-14T15:00:00.000Z',
            },
        ],
    };

    const board = buildBoardFromSummary(makeResolvedSummary(), SUMMARY_PATH, existingBoard);
    const item = board.items[0];

    assert.deepEqual(item.evidence, [
        'temp/feedback-closeout/test/64f0c0ffee00000000000001.md',
        SUMMARY_PATH,
    ]);
    assert.match(item.verification[0], /返回该记录状态为 resolved/);
    assert.match(item.notes, /仅同步历史状态/);
    assert.doesNotThrow(() => assertItemCanUseStatus(item));
});
