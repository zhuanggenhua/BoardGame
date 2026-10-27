import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

test('目录模式不得绕过整组 REVISE 裁决并输出验收链接', () => {
    const directory = path.resolve('test-results/evidence-screenshots', `directory-gate-${process.pid}`);
    mkdirSync(directory, { recursive: true });
    try {
        writeFileSync(path.join(directory, '01.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=', 'base64'));
        writeFileSync(path.join(directory, 'focused-pass-manifest.json'), JSON.stringify({ verdict: 'REVISE' }));
        const result = spawnSync(process.execPath, ['scripts/verify/open-verified-image.mjs', '--dir', directory, '--no-open'], { encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /verdict 必须是 "PASS"/);
        assert.doesNotMatch(result.stdout, /VIEWER_URL=/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
});
