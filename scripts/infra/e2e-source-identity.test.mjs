import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { captureSourceIdentity, sourceIdentityMatches, getFrontendSourceHash } from './e2e-source-identity.mjs';

test('后端输入改变或删除即失效，未打包的 UI 改动不会令服务失效', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'source-identity-test-'));
    try {
        fs.writeFileSync(path.join(cwd, 'domain.ts'), 'export const damage = 1;');
        const identity = captureSourceIdentity(['domain.ts'], cwd);
        assert.equal(sourceIdentityMatches(identity), true);
        fs.writeFileSync(path.join(cwd, 'ui.tsx'), 'new display');
        assert.equal(sourceIdentityMatches(identity), true);
        fs.writeFileSync(path.join(cwd, 'domain.ts'), 'export const damage = 2;');
        assert.equal(sourceIdentityMatches(identity), false);
        fs.unlinkSync(path.join(cwd, 'domain.ts'));
        assert.equal(sourceIdentityMatches(identity), false);
        assert.equal(sourceIdentityMatches(null), false);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('前端修改、增加和删除均使 Vite 缓存身份失效，测试文件不触发刷新', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'frontend-identity-test-'));
    fs.mkdirSync(path.join(cwd, 'src'));
    try {
        fs.writeFileSync(path.join(cwd, 'src/tutorial.ts'), 'old tutorial');
        const first = getFrontendSourceHash(cwd);
        fs.writeFileSync(path.join(cwd, 'src/tutorial.test.ts'), 'new test');
        assert.equal(getFrontendSourceHash(cwd), first);
        fs.writeFileSync(path.join(cwd, 'src/tutorial.ts'), 'new tutorial');
        const second = getFrontendSourceHash(cwd);
        assert.notEqual(second, first);
        for (const directory of ['public/locales/zh-CN', 'plugins', 'vite-plugins']) {
            fs.mkdirSync(path.join(cwd, directory), { recursive: true });
            const previous = getFrontendSourceHash(cwd);
            fs.writeFileSync(path.join(cwd, directory, 'input.json'), '{"current":"input"}');
            assert.notEqual(getFrontendSourceHash(cwd), previous, `实际外部输入 ${directory} 必须参与前端缓存身份`);
        }
        fs.writeFileSync(path.join(cwd, 'src/new.css'), 'new style');
        assert.notEqual(getFrontendSourceHash(cwd), second);
        fs.unlinkSync(path.join(cwd, 'src/tutorial.ts'));
        assert.notEqual(getFrontendSourceHash(cwd), first);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});
