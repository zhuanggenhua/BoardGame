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
const lowerId = 'abcdef0123456789abcdef01';
const upperId = lowerId.toUpperCase();

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
    assert.equal(JSON.parse(stdout).totalFetched, 1);
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
