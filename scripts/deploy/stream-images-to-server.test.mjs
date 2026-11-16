import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';

const rootDir = process.cwd();
const streamScript = path.join(rootDir, 'scripts', 'deploy', 'stream-images-to-server.mjs');

test('--deploy 的发布计划先同步宿主 CPU 采集脚本，再执行 update-local', () => {
    const result = spawnSync(process.execPath, [streamScript, '--deploy', '--dry-run', '--host', 'deploy@example.test'], {
        cwd: rootDir,
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /上传宿主 CPU 采集脚本/);
    assert.match(result.stdout, /校验并原子安装宿主 CPU 采集脚本/);
    assert.match(result.stdout, /远端 update-local 部署/);
    assert.ok(
        result.stdout.indexOf('上传宿主 CPU 采集脚本') < result.stdout.indexOf('远端 update-local 部署'),
        result.stdout,
    );
    assert.ok(
        result.stdout.indexOf('校验并原子安装宿主 CPU 采集脚本') < result.stdout.indexOf('远端 update-local 部署'),
        result.stdout,
    );
});

test('--deploy 在替换旧容器前同步并运行旧版静态资源保留工具', () => {
    const result = spawnSync(process.execPath, [streamScript, '--deploy', '--dry-run', '--host', 'deploy@example.test'], { cwd: rootDir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /上传静态资源保留工具/);
    assert.match(result.stdout, /保留旧版静态资源/);
    assert.ok(result.stdout.indexOf('保留旧版静态资源') < result.stdout.indexOf('远端 update-local 部署'));
});
