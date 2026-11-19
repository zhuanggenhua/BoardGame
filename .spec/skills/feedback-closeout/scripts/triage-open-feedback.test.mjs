import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { readPrivateFeedbackReplaysViaMongoSsh } from './lib/private-replay-diagnostic.mjs';

const scriptPath = fileURLToPath(new URL('./triage-open-feedback.mjs', import.meta.url));
const finalizePath = fileURLToPath(new URL('./finalize-feedback-group.mjs', import.meta.url));
const lowerId = 'abcdef0123456789abcdef01';
const upperId = lowerId.toUpperCase();

test('独立系统告警不会因相同错误签名被当作重复记录批量收口', async (t) => {
    const records = [
        { _id: '6af94eb4205360545acbecb6', content: 'Unable to preload CSS for /assets/HomeEntry-Bo8WHdSd.css' },
        { _id: '6af97194205360545acbef78', content: 'Unable to preload CSS for /assets/HomeEntry-Bo8WHdSd.css' },
        { _id: '6afc43c7f6f035b1676b31d6', content: 'Unable to preload CSS for /assets/manifest.client-DPbXyle8.css' },
    ].map((record) => ({
        ...record, status: 'open', reporterType: 'system', source: 'react-error-boundary',
        gameId: 'client', type: 'bug', severity: 'medium',
        errorContext: { source: 'react-error-boundary', name: 'Error', message: 'Unable to preload CSS' },
    }));
    const server = http.createServer((request, response) => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ items: request.url.includes('status=open') ? records : [], total: request.url.includes('status=open') ? records.length : 0 }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedback-triage-system-'));
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await fs.rm(outDir, { recursive: true, force: true });
    });
    const child = spawn(process.execPath, [scriptPath, '--base-url', `http://127.0.0.1:${address.port}`, '--out-dir', outDir]);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill(), 10000);
    const [exitCode] = await once(child, 'close');
    clearTimeout(timer);
    assert.equal(exitCode, 0, stderr);
    const summary = JSON.parse(stdout);
    assert.equal(summary.totalFetched, 3);
    assert.equal(summary.uniqueGroups, 3);
    assert.deepEqual(summary.groups.flatMap((group) => group.duplicateIds), []);
});

test('旧摘要与状态板分组冲突时，在远端回写前拒绝批量收口', async (t) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedback-stale-group-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const summaryPath = path.join(dir, 'summary.json');
    const boardPath = path.join(dir, 'board.json');
    const primaryId = '6af816f3205360545acbda0b';
    const otherId = '6af67cd624b60c04d6ba701f';
    await fs.writeFile(summaryPath, JSON.stringify({ groups: [{ primaryId, duplicateIds: [otherId] }] }));
    await fs.writeFile(boardPath, JSON.stringify({ items: [
        { id: primaryId, groupPrimaryId: primaryId },
        { id: otherId, groupPrimaryId: otherId },
    ] }));
    const result = spawnSync(process.execPath, [finalizePath, summaryPath, primaryId, 'resolved',
        '--resolved-method', '本地修复并验证', '--board', boardPath, '--base-url', 'http://127.0.0.1:1'],
    { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /分组不一致.*未执行远端回写/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED/);
});

test('接口只返回摘要而没有原文时，拒绝生成分诊清单', async (t) => {
    const server = http.createServer((request, response) => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ items: request.url.includes('status=open')
            ? [{ _id: lowerId, status: 'open', reporterType: 'system' }] : [],
        total: request.url.includes('status=open') ? 1 : 0 }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedback-triage-summary-'));
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await fs.rm(outDir, { recursive: true, force: true });
    });
    const child = spawn(process.execPath, [scriptPath, '--base-url', `http://127.0.0.1:${address.port}`, '--out-dir', outDir]);
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill(), 10000);
    const [exitCode] = await once(child, 'close');
    clearTimeout(timer);
    assert.equal(exitCode, 1);
    assert.match(stderr, /反馈读取缺少原文/);
    await assert.rejects(fs.access(path.join(outDir, 'summary.json')), { code: 'ENOENT' });
});

test('explicit empty --ids fails before any request can expand to a list read', () => {
    for (const ids of ['', ', ,']) {
        const result = spawnSync(process.execPath, [
            scriptPath,
            '--base-url', 'http://127.0.0.1:1',
            '--ids', ids,
        ], { encoding: 'utf8', timeout: 5000 });

        assert.equal(result.status, 1);
        assert.match(result.stderr, /--ids 必须至少指定一个反馈 ID/);
        assert.doesNotMatch(result.stderr, /ECONNREFUSED/);
    }
});

test('targeted feedback ID count is capped before HTTP or SSH access', () => {
    const tooManyIds = Array.from({ length: 101 }, (_, index) => index.toString(16).padStart(24, '0'));
    const cliResult = spawnSync(process.execPath, [
        scriptPath,
        '--base-url', 'http://127.0.0.1:1',
        '--ids', tooManyIds.join(','),
    ], { encoding: 'utf8', timeout: 5000 });

    assert.equal(cliResult.status, 1);
    assert.match(cliResult.stderr, /--ids 最多指定 100 个反馈 ID/);
    assert.doesNotMatch(cliResult.stderr, /ECONNREFUSED/);

    let sshCalled = false;
    assert.throws(
        () => readPrivateFeedbackReplaysViaMongoSsh(tooManyIds, {
            spawnSync: () => { sshCalled = true; return { status: 0, stdout: '' }; },
        }),
        /最多指定 100 个反馈 ID/,
    );
    assert.equal(sshCalled, false);
});

test('targeted ObjectIds are normalized and deduplicated before detail reads', async (t) => {
    const requests = [];
    const server = http.createServer((request, response) => {
        requests.push(request.url);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
            _id: lowerId,
            status: 'open',
            source: 'player-feedback',
            reporterType: 'human',
            gameId: 'qidahen',
            type: 'bug',
            severity: 'medium',
            createdAt: '2026-01-01T00:00:00.000Z',
            content: 'Fixture feedback record',
        }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedback-triage-ids-'));
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await fs.rm(outDir, { recursive: true, force: true });
    });

    const child = spawn(process.execPath, [
        scriptPath,
        '--base-url', `http://127.0.0.1:${address.port}`,
        '--ids', `${upperId},${lowerId}`,
        '--out-dir', outDir,
    ]);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill(), 10000);
    const [exitCode] = await once(child, 'close');
    clearTimeout(timer);

    assert.equal(exitCode, 0, stderr);
    assert.deepEqual(requests, [`/admin-api/feedback/${lowerId}`]);
    const summary = JSON.parse(stdout);
    assert.equal(summary.totalFetched, 1);
    assert.deepEqual(summary.privateReplayStatusCounts, { 'not-read-non-production': 1 });
    assert.deepEqual(summary.groups[0].privateReplayMembers, [{ feedbackId: lowerId, diagnostic: { status: 'not-read-non-production' } }]);
});

test('历史反馈诊断包不输出原始日志、快照、异常文本、堆栈或路由', async (t) => {
    const id = '64f0c0ffee00000000000002';
    const canaries = [
        'SECRET_CARD_CANARY',
        'SECRET_OPTION_CANARY',
        'SECRET_SOURCE_CANARY',
        'SECRET_ERROR_NAME_CANARY',
        'SECRET_EXCEPTION_MESSAGE_CANARY',
        'SECRET_STACK_CANARY',
        'SECRET_ROUTE_CANARY',
        'SECRET_ACTION_ID_CANARY',
    ];
    const requests = [];
    const legacyRecord = {
        _id: id,
        status: 'open',
        source: 'player-feedback',
        reporterType: 'human',
        gameId: 'qidahen',
        type: 'bug',
        severity: 'high',
        createdAt: '2026-01-01T00:00:00.000Z',
        content: '攻击时点无法继续',
        actionLog: JSON.stringify([{
            id: 'SECRET_ACTION_ID_CANARY',
            timestamp: 42,
            actorId: '0',
            kind: 'attack',
            event: { type: 'ATTACK_RESOLVED', payload: { card: 'SECRET_CARD_CANARY', option: 'SECRET_OPTION_CANARY' } },
            segments: [{ value: 'SECRET_CARD_CANARY' }],
        }]),
        stateSnapshot: JSON.stringify({
            sys: {
                phase: 'offensiveRoll',
                turnNumber: 3,
                interaction: {
                    isBlocked: true,
                    current: { playerId: '0', type: 'choice', data: { options: ['SECRET_OPTION_CANARY'] } },
                },
            },
            core: { turnPhase: 'attack', hand: ['SECRET_CARD_CANARY'] },
            blockerFingerprint: 'SECRET_OPTION_CANARY',
        }),
        errorContext: {
            source: 'SECRET_SOURCE_CANARY',
            name: 'SECRET_ERROR_NAME_CANARY',
            message: 'SECRET_EXCEPTION_MESSAGE_CANARY',
            stack: 'SECRET_STACK_CANARY\n    at SECRET_CARD_CANARY',
            jsStack: 'SECRET_STACK_CANARY',
        },
        clientContext: { gameId: 'qidahen', route: `/play/qidahen/match/SECRET_ROUTE_CANARY` },
    };
    const server = http.createServer((request, response) => {
        requests.push(request.url);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(legacyRecord));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedback-triage-private-'));
    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await fs.rm(outDir, { recursive: true, force: true });
    });

    const child = spawn(process.execPath, [
        scriptPath,
        '--base-url', `http://127.0.0.1:${address.port}`,
        '--ids', id,
        '--out-dir', outDir,
    ]);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill(), 10000);
    const [exitCode] = await once(child, 'close');
    clearTimeout(timer);

    assert.equal(exitCode, 0, stderr);
    assert.deepEqual(requests, [`/admin-api/feedback/${id}`]);
    const packet = await fs.readFile(path.join(outDir, `${id}.md`), 'utf8');
    const summary = await fs.readFile(path.join(outDir, 'summary.json'), 'utf8');
    for (const output of [packet, summary, stdout]) {
        for (const canary of canaries) assert.equal(output.includes(canary), false, canary);
    }
    assert.match(packet, /offensiveRoll/);
    assert.match(packet, /"isBlocked": true/);
    assert.match(packet, /"hasStack": true/);
    assert.match(packet, /routeClass: game-match/);
});
