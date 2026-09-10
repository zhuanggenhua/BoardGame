import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assertItemCanUseStatus,
    buildBoardFromSummary,
    updateBoardItems,
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

test('按开放反馈摘要刷新时保留摘要外已有终态记录', () => {
    const existingBoard = {
        version: 1,
        updatedAt: '2026-09-09T09:00:00.000Z',
        items: [
            {
                id: '64f0c0ffee00000000000001',
                feedbackId: '64f0c0ffee00000000000001',
                title: 'AI 卡死了',
                status: 'resolved',
                lastFetchedStatus: 'resolved',
                resolvedMethod: '已修复。',
                evidence: ['resolved-evidence.md'],
                verification: ['resolved verification'],
                updatedAt: '2026-09-09T09:00:00.000Z',
            },
            {
                id: '64f0c0ffee00000000000004',
                feedbackId: '64f0c0ffee00000000000004',
                title: '新开放反馈',
                status: 'open',
                lastFetchedStatus: 'open',
                evidence: [],
                verification: [],
                updatedAt: '2026-09-09T09:00:00.000Z',
            },
        ],
    };
    const summary = {
        baseUrl: 'https://api.easyboardgame.top',
        generatedAt: '2026-09-09T10:00:00.000Z',
        groups: [
            {
                dedupeKey: 'dedupe-4',
                classification: 'bug_candidate',
                conflictKey: 'client::react.error_boundary',
                primaryId: '64f0c0ffee00000000000004',
                duplicateIds: [],
                gameId: 'client',
                type: 'bug',
                severity: 'high',
                status: 'in_progress',
                summary: '新开放反馈',
                packetPath: 'temp/feedback-closeout/test/64f0c0ffee00000000000004.md',
                screenshotPaths: [],
            },
        ],
    };

    const board = buildBoardFromSummary(summary, SUMMARY_PATH, existingBoard);
    const ids = board.items.map((item) => item.id);

    assert.deepEqual(ids, [
        '64f0c0ffee00000000000004',
        '64f0c0ffee00000000000001',
    ]);
    assert.equal(board.items[0].status, 'open');
    assert.equal(board.items[0].lastFetchedStatus, 'in_progress');
    assert.equal(board.items[1].status, 'resolved');
    assert.equal(board.items[1].resolvedMethod, '已修复。');
});

test('状态离开 closed 时清理旧关闭理由', () => {
    const board = {
        version: 1,
        updatedAt: '2026-09-09T09:00:00.000Z',
        items: [
            {
                id: '64f0c0ffee00000000000002',
                feedbackId: '64f0c0ffee00000000000002',
                title: '基础魅惑之力被当成可防御',
                status: 'closed',
                lastFetchedStatus: 'closed',
                closedReason: '旧误关理由',
                resolvedMethod: '',
                evidence: ['old-evidence.md'],
                verification: ['旧关闭验证'],
                updatedAt: '2026-09-09T09:00:00.000Z',
            },
        ],
    };

    const [item] = updateBoardItems(board, ['64f0c0ffee00000000000002'], {
        status: 'in_progress',
        owner: 'codex',
        evidence: ['image-recheck.png'],
        verification: ['重新核图后继续处理'],
    });

    assert.equal(item.status, 'in_progress');
    assert.equal(item.lastFetchedStatus, 'closed');
    assert.equal(item.closedReason, '');
    assert.equal(item.resolvedMethod, '');
    assert.deepEqual(item.evidence, ['old-evidence.md', 'image-recheck.png']);
    assert.doesNotThrow(() => assertItemCanUseStatus(item));
});

test('远端状态回写后同步最近真实状态并清理互斥终态说明', () => {
    const board = {
        version: 1,
        updatedAt: '2026-09-09T09:00:00.000Z',
        items: [
            {
                id: '64f0c0ffee00000000000003',
                feedbackId: '64f0c0ffee00000000000003',
                title: '基础魅惑之力被当成可防御',
                status: 'in_progress',
                lastFetchedStatus: 'closed',
                closedReason: '旧误关理由',
                resolvedMethod: '',
                evidence: ['image-recheck.png'],
                verification: ['重新核图后继续处理'],
                updatedAt: '2026-09-09T09:00:00.000Z',
            },
        ],
    };

    const [item] = updateBoardItems(board, ['64f0c0ffee00000000000003'], {
        status: 'resolved',
        lastFetchedStatus: 'resolved',
        owner: 'codex',
        resolvedMethod: '已按牌面修正为不可防御伤害。',
        evidence: ['fix-evidence.md'],
        verification: ['远端状态回写成功'],
    });

    assert.equal(item.status, 'resolved');
    assert.equal(item.lastFetchedStatus, 'resolved');
    assert.equal(item.closedReason, '');
    assert.equal(item.resolvedMethod, '已按牌面修正为不可防御伤害。');
    assert.doesNotThrow(() => assertItemCanUseStatus(item));
});
