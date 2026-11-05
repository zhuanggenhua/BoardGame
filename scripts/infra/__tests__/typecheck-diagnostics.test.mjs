import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { compareDiagnostics, countDiagnostics, parseTypeDiagnostics, validateCompilerResult } from '../typecheck-diagnostics.mjs';
import { validateTypecheckBaseline } from '../typecheck-baseline-schema.mjs';
import { isTypecheckInfrastructureFile } from '../typecheck-inputs.mjs';

test('real compiler errors remain fatal when absent from the reviewed baseline', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardgame-typecheck-'));
    try {
        fs.writeFileSync(path.join(root, 'a.ts'), 'export const value: number = "wrong";\n');
        const compiler = createRequire(import.meta.url).resolve('typescript/bin/tsc');
        const result = spawnSync(process.execPath, [compiler, '--noEmit', '--skipLibCheck', '--pretty', 'false', 'a.ts'], { cwd: root, encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        const diagnostics = parseTypeDiagnostics(result.stdout, root);
        assert.equal(diagnostics[0].code, 2322);
        assert.equal(compareDiagnostics(diagnostics, []).newDiagnostics.length, 1);
        const baseline = countDiagnostics(diagnostics);
        assert.deepEqual(compareDiagnostics(diagnostics, baseline), { newDiagnostics: [], removed: 0 });
        assert.equal(compareDiagnostics([...diagnostics, ...diagnostics], baseline).newDiagnostics[0].count, 1);
        assert.equal(compareDiagnostics([{ ...diagnostics[0], source: 'a different failing statement' }], baseline).newDiagnostics.length, 1);
        assert.equal(compareDiagnostics([], baseline).removed, 1);
    } finally {
        assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'boardgame-typecheck-'));
        fs.rmSync(root, { recursive: true });
    }
});

test('configuration errors cannot be waived as old source diagnostics', () => {
    assert.throws(() => parseTypeDiagnostics('error TS18003: No inputs were found', process.cwd()), /Compiler\/configuration failure/);
});

test('scoped allowances distinguish equal statements and survive LF/CRLF checkout', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardgame-typecheck-'));
    try {
        const text = 'function a() {\n  return "bad";\n}\nfunction b() {\n  return "bad";\n}\n';
        const output = 'a.ts(2,3): error TS2322: bad type\na.ts(5,3): error TS2322: bad type';
        fs.writeFileSync(path.join(root, 'a.ts'), text);
        const lf = parseTypeDiagnostics(output, root);
        fs.writeFileSync(path.join(root, 'a.ts'), text.replaceAll('\n', '\r\n'));
        const crlf = parseTypeDiagnostics(output, root);
        assert.deepEqual(crlf, lf);
        assert.notEqual(lf[0].scope, lf[1].scope);
        validateTypecheckBaseline({ version: 1, compilerVersion: '5', projects: { app: countDiagnostics(lf) } }, ['app'], '5');
    } finally { fs.rmSync(root, { recursive: true }); }
});

test('malformed, unbounded and cross-project allowances are rejected', () => {
    const entry = { file: 'src/a.ts', code: 2322, message: 'bad type', source: 'const a = x', scope: 'a'.repeat(64), count: 1 };
    const create = value => ({ version: 1, compilerVersion: '5', projects: { app: [value] } });
    validateTypecheckBaseline(create(entry), ['app'], '5');
    for (const count of [Infinity, -1, '100', 0]) assert.throws(() => validateTypecheckBaseline(create({ ...entry, count }), ['app'], '5'));
    assert.throws(() => validateTypecheckBaseline(create(entry), ['app', 'server'], '5'));
    assert.throws(() => validateTypecheckBaseline(create(entry), ['app'], '6'));
});

test('compiler crashes, termination and positioned configuration errors cannot become allowances', () => {
    assert.throws(() => validateCompilerResult({ status: null, signal: 'SIGTERM' }, []));
    assert.throws(() => validateCompilerResult({ status: 1 }, []));
    assert.throws(() => parseTypeDiagnostics('tsconfig.app.json(3,5): error TS5023: Unknown compiler option', process.cwd()), /configuration/);
});

test('all gate infrastructure changes trigger CI verification', () => {
    for (const file of ['typecheck-projects.mjs', 'typecheck-diagnostics.mjs', 'typecheck-baseline-schema.mjs',
        'typecheck-inputs.mjs', 'typecheck-baseline.json']) assert.equal(isTypecheckInfrastructureFile('scripts/infra/' + file), true);
    assert.equal(isTypecheckInfrastructureFile('scripts/infra/__tests__/typecheck-runner.test.mjs'), true);
});
