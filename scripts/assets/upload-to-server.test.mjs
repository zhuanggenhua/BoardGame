import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const uploadScriptPath = fileURLToPath(new URL('./upload-to-server.js', import.meta.url));
const runProbe = (runnerPath, cwd, env) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runnerPath], {
        cwd,
        env,
        windowsHide: true,
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
});

test('upload CLI loads ignored env config, keeps process overrides, and diagnoses missing token without printing values', async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), 'boardgame-upload-env-'));
    const assetDir = path.join(workspace, 'public', 'assets', 'i18n', 'zh-CN', 'env-check');
    const runnerPath = path.join(workspace, 'run-uploader-env-probe.mjs');
    const envLocalPath = path.join(workspace, '.env.local');
    const tokenFileValue = 'local-env-test-token';
    const tokenProcessValue = 'process-env-test-token';
    const baseEnvFileValue = 'base-env-file-test-token';

    mkdirSync(assetDir, { recursive: true });
    writeFileSync(path.join(assetDir, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n');
    writeFileSync(path.join(workspace, '.env'), 'ASSET_SERVER_UPLOAD_TOKEN=' + baseEnvFileValue + '\n', 'utf8');
    writeFileSync(envLocalPath, 'ASSET_SERVER_UPLOAD_TOKEN=' + tokenFileValue + '\n', 'utf8');
    writeFileSync(runnerPath, [
        "process.argv.push('--check', '--asset-prefix', 'i18n/zh-CN/env-check/icon.svg');",
        'await import(' + JSON.stringify(pathToFileURL(uploadScriptPath).href) + ');',
        'await new Promise((resolve) => setImmediate(resolve));',
        "const token = process.env.ASSET_SERVER_UPLOAD_TOKEN?.trim()",
        "  || process.env.BG_ASSET_PUBLISH_TOKEN?.trim()",
        "  || process.env.BG_DEPLOY_RUNNER_TOKEN?.trim()",
        "  || '';",
        "console.log(token === (process.env.EXPECTED_UPLOAD_TEST_TOKEN || '') ? 'token-config-match' : 'token-config-mismatch');",
    ].join('\n'), 'utf8');

    const baseEnv = { ...process.env, NODE_ENV: 'test' };
    for (const key of [
        'ASSET_SERVER_UPLOAD_TOKEN',
        'BG_ASSET_PUBLISH_TOKEN',
        'BG_DEPLOY_RUNNER_TOKEN',
        'ASSET_SERVER_UPLOAD_URL',
        'ASSET_SERVER_UPLOAD_ALLOW_UNAUTHENTICATED',
    ]) {
        delete baseEnv[key];
    }

    try {
        const explicitProcessEnv = await runProbe(runnerPath, workspace, {
            ...baseEnv,
            ASSET_SERVER_UPLOAD_TOKEN: tokenProcessValue,
            EXPECTED_UPLOAD_TEST_TOKEN: tokenProcessValue,
        });
        assert.equal(explicitProcessEnv.code, 0, explicitProcessEnv.stderr);
        assert.match(explicitProcessEnv.stdout, /token-config-match/);
        assert.doesNotMatch(explicitProcessEnv.stderr, /未检测到素材发布 token/);

        const localEnv = await runProbe(runnerPath, workspace, {
            ...baseEnv,
            EXPECTED_UPLOAD_TEST_TOKEN: tokenFileValue,
        });
        assert.equal(localEnv.code, 0, localEnv.stderr);
        assert.match(localEnv.stdout, /token-config-match/);
        assert.doesNotMatch(localEnv.stderr, /未检测到素材发布 token/);

        writeFileSync(path.join(workspace, '.env'), 'ASSET_SERVER_UPLOAD_TOKEN=\n', 'utf8');
        const localEnvWithEmptyBase = await runProbe(runnerPath, workspace, {
            ...baseEnv,
            EXPECTED_UPLOAD_TEST_TOKEN: tokenFileValue,
        });
        assert.equal(localEnvWithEmptyBase.code, 0, localEnvWithEmptyBase.stderr);
        assert.match(localEnvWithEmptyBase.stdout, /token-config-match/);

        writeFileSync(envLocalPath, '# no upload credential configured\n', 'utf8');
        const missingConfig = await runProbe(runnerPath, workspace, {
            ...baseEnv,
            EXPECTED_UPLOAD_TEST_TOKEN: '',
        });
        assert.equal(missingConfig.code, 0, missingConfig.stderr);
        assert.match(missingConfig.stdout, /token-config-match/);
        assert.doesNotMatch(missingConfig.stderr, /未检测到素材发布 token|匿名请求|服务器端配置决定/);
        assert.match(missingConfig.stdout, /没有向上传入口发送请求/);
        const combinedOutput = explicitProcessEnv.stdout + explicitProcessEnv.stderr
            + localEnv.stdout + localEnv.stderr
            + localEnvWithEmptyBase.stdout + localEnvWithEmptyBase.stderr
            + missingConfig.stdout + missingConfig.stderr;
        assert.doesNotMatch(combinedOutput, new RegExp(
            tokenFileValue + '|' + tokenProcessValue + '|' + baseEnvFileValue,
        ));
    } finally {
        rmSync(workspace, { recursive: true, force: true });
    }
});
