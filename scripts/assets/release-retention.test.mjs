import assert from 'node:assert/strict';
import test from 'node:test';
import {
    selectExpiredReleaseIds,
    selectRetainedReleaseIds,
} from './release-retention.mjs';

test('默认保留最近五个 release，并始终保留 current', () => {
    const retained = selectRetainedReleaseIds([
        '20260701000000000',
        '20260702000000000',
        '20260703000000000',
        '20260704000000000',
        '20260705000000000',
        '20260706000000000',
    ], '20260706000000000');

    assert.deepEqual([...retained], [
        '20260702000000000',
        '20260703000000000',
        '20260704000000000',
        '20260705000000000',
        '20260706000000000',
    ]);
});

test('current 不在最近五个时仍然保留 current', () => {
    const retained = selectRetainedReleaseIds([
        '20260701000000000',
        '20260702000000000',
        '20260703000000000',
        '20260704000000000',
        '20260705000000000',
        '20260706000000000',
    ], '20260701000000000');

    assert.equal(retained.has('20260701000000000'), true);
    assert.equal(retained.size, 6);
});

test('current 缺失或 retention 数量非法时拒绝清理', () => {
    assert.throws(
        () => selectRetainedReleaseIds(['20260701000000000'], '20260702000000000'),
        /current release 不在 release 目录中/,
    );
    assert.throws(
        () => selectRetainedReleaseIds(['20260701000000000'], '20260701000000000', 0),
        /必须是正整数/,
    );
});

test('空间预检只允许清理保留规则之外的旧 release', () => {
    assert.deepEqual(
        selectExpiredReleaseIds([
            '20260701000000000',
            '20260702000000000',
            '20260703000000000',
            '20260704000000000',
            '20260705000000000',
            '20260706000000000',
        ], '20260706000000000'),
        ['20260701000000000'],
    );
});
