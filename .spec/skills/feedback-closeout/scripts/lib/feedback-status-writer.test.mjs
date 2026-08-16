import assert from 'node:assert/strict';
import test from 'node:test';

import {
    selectFeedbackStatusWriter,
    shouldFallbackToMongoAfterHttpFailure,
    updateFeedbackStatusViaBestAvailableWriter,
} from './feedback-status-writer.mjs';

const FEEDBACK_ID = '64f0c0ffee00000000000001';

test('线上无 token 时选择生产 Mongo 写入口', () => {
    const selected = selectFeedbackStatusWriter({
        baseUrl: 'https://api.easyboardgame.top',
        token: '',
    });

    assert.equal(selected.writer, 'mongo-ssh');
    assert.equal(selected.reason, 'missing-token-production-mongo');
});

test('有 token 时优先选择 HTTP 管理接口', () => {
    const selected = selectFeedbackStatusWriter({
        baseUrl: 'https://api.easyboardgame.top',
        token: 'token',
    });

    assert.equal(selected.writer, 'http');
    assert.equal(selected.reason, 'token-provided');
});

test('非线上目标且无 token 时不自动写生产 Mongo', () => {
    assert.throws(
        () => selectFeedbackStatusWriter({
            baseUrl: 'http://127.0.0.1:3000',
            token: '',
        }),
        /不会把非线上目标自动改写到生产 Mongo/,
    );
});

test('线上 HTTP 认证失败才允许切到生产 Mongo', () => {
    assert.equal(shouldFallbackToMongoAfterHttpFailure({
        baseUrl: 'https://api.easyboardgame.top',
        status: 401,
    }), true);
    assert.equal(shouldFallbackToMongoAfterHttpFailure({
        baseUrl: 'https://api.easyboardgame.top',
        status: 500,
    }), false);
    assert.equal(shouldFallbackToMongoAfterHttpFailure({
        baseUrl: 'http://127.0.0.1:3000',
        status: 401,
    }), false);
});

test('线上无 token 时直接通过 SSH/Mongo 回写状态', async () => {
    const spawnCalls = [];
    const result = await updateFeedbackStatusViaBestAvailableWriter({
        baseUrl: 'https://api.easyboardgame.top',
        token: '',
        id: FEEDBACK_ID,
        status: 'resolved',
        resolvedMethod: '已修复真实阻塞链路，后续版本会继续推进。',
    }, {
        spawnSync(command, args, options) {
            spawnCalls.push({ command, args, input: options.input });
            return {
                status: 0,
                stdout: `${JSON.stringify({
                    acknowledged: true,
                    matchedCount: 1,
                    modifiedCount: 1,
                    feedback: {
                        _id: FEEDBACK_ID,
                        status: 'resolved',
                        resolvedMethod: '已修复真实阻塞链路，后续版本会继续推进。',
                        closedReason: null,
                    },
                })}\n`,
                stderr: '',
            };
        },
    });

    assert.equal(result.writer, 'mongo-ssh');
    assert.equal(result.status, 'resolved');
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, 'ssh');
    assert.match(spawnCalls[0].input, /db\.feedbacks\.updateOne/);
});

test('生产 Mongo 输出带 mongosh 提示符时仍能解析最终回写 JSON', async () => {
    const result = await updateFeedbackStatusViaBestAvailableWriter({
        baseUrl: 'https://api.easyboardgame.top',
        token: '',
        id: FEEDBACK_ID,
        status: 'resolved',
        resolvedMethod: '奖励骰确认链路已修复。',
    }, {
        spawnSync() {
            return {
                status: 0,
                stdout: [
                    'boardgame> ',
                    "boardgame> | | { closedReason: '' }",
                    `boardgame> | | | ${JSON.stringify({
                        acknowledged: true,
                        matchedCount: 1,
                        modifiedCount: 0,
                        feedback: {
                            _id: FEEDBACK_ID,
                            status: 'resolved',
                            resolvedMethod: '奖励骰确认链路已修复。',
                            closedReason: null,
                        },
                    })}`,
                    'boardgame>',
                ].join('\n'),
                stderr: '',
            };
        },
    });

    assert.equal(result.writer, 'mongo-ssh');
    assert.equal(result.status, 'resolved');
    assert.equal(result.matchedCount, 1);
});

test('线上 HTTP 返回 401 时切到 SSH/Mongo 回写', async () => {
    const result = await updateFeedbackStatusViaBestAvailableWriter({
        baseUrl: 'https://api.easyboardgame.top',
        token: 'expired-token',
        id: FEEDBACK_ID,
        status: 'in_progress',
    }, {
        async fetch() {
            return {
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                async text() {
                    return 'Missing token';
                },
            };
        },
        spawnSync() {
            return {
                status: 0,
                stdout: `${JSON.stringify({
                    acknowledged: true,
                    matchedCount: 1,
                    modifiedCount: 1,
                    feedback: {
                        _id: FEEDBACK_ID,
                        status: 'in_progress',
                        resolvedMethod: null,
                        closedReason: null,
                    },
                })}\n`,
                stderr: '',
            };
        },
    });

    assert.equal(result.writer, 'mongo-ssh');
    assert.equal(result.reason, 'http-auth-failed-401-production-mongo');
    assert.equal(result.status, 'in_progress');
});
