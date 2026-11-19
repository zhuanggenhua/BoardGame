import assert from 'node:assert/strict';
import test from 'node:test';
import { readProductionFeedback } from './production-feedback-reader.mjs';

test('生产反馈读取使用只读 Mongo 查询并保留原文及独立记录', () => {
    let invocation;
    const rows = [
        { _id: '6af94eb4205360545acbecb6', status: 'open', content: 'CSS 第一条', reporterType: 'system' },
        { _id: '6af97194205360545acbef78', status: 'open', content: 'CSS 第二条', reporterType: 'system' },
        { _id: '6afc43c7f6f035b1676b31d6', status: 'open', content: '玩家原文', reporterType: 'user' },
    ];
    const result = readProductionFeedback(['open', 'in_progress'], [], {
        spawnSync: (command, args, options) => {
            invocation = { command, args, input: options.input };
            return { status: 0, stdout: `boardgame> FEEDBACK_READ:${JSON.stringify(rows)}\n`, stderr: '' };
        },
    });
    assert.deepEqual(result, rows);
    assert.equal(invocation.command, 'ssh');
    assert.match(invocation.input, /db\.feedbacks\.find/);
    assert.match(invocation.input, /privateReplay:0/);
    assert.doesNotMatch(invocation.input, /update|delete|insert/);
});

test('生产读取失败或不完整时不生成空的成功清单', () => {
    assert.throws(() => readProductionFeedback(['open'], [], { spawnSync: () => ({ status: 1, stderr: 'offline' }) }), /生产反馈读取失败/);
    assert.throws(() => readProductionFeedback(['open'], [], { spawnSync: () => ({ status: 0, stdout: 'no result' }) }), /未返回完整结果/);
});

test('Mongo 旧自动上报和 watchdog 使用与反馈 API 一致的来源判定', () => {
    const rows = [
        { _id: '6a2056e178c1ecf399a67f9c', status: 'resolved', content: '[auto] error', reporterType: 'user', source: 'client-runtime-guard' },
        { _id: '6a200ee278c1ecf399a6786d', status: 'resolved', content: '[system][online-ai-watchdog] failed', errorContext: { name: 'blocked' } },
        { _id: '6afc43c7f6f035b1676b31d6', status: 'open', content: '玩家原文', reporterType: 'user', source: 'feedback-modal' },
    ];
    const actual = readProductionFeedback(['open', 'resolved'], [], {
        spawnSync: () => ({ status: 0, stdout: `FEEDBACK_READ:${JSON.stringify(rows)}\n` }),
    });
    assert.equal(actual[0].reporterType, 'system');
    assert.equal(actual[1].reporterType, 'system');
    assert.equal(actual[1].source, 'online-ai-watchdog');
    assert.equal(actual[1].autoReportKind, 'blocked');
    assert.equal(actual[2].reporterType, 'user');
});
