import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { compareDiagnostics, countDiagnostics, diagnosticKey, parseTypeDiagnostics, validateCompilerResult } from './typecheck-diagnostics.mjs';
import { validateTypecheckBaseline } from './typecheck-baseline-schema.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const compiler = require.resolve('typescript/bin/tsc');
const compilerVersion = require('typescript/package.json').version;
const projects = ['tsconfig.app.json', 'tsconfig.node.json', 'tsconfig.server.json', 'apps/api/tsconfig.json'];

const rawArgs = process.argv.slice(2);
const referenceArg = rawArgs.find(arg => arg.startsWith('--baseline-ref='));
const args = new Set(rawArgs.filter(arg => arg !== referenceArg));
if (args.size > 1) throw new Error('Typecheck modes are mutually exclusive');
for (const arg of args) if (!['--strict', '--write-baseline', '--prune-baseline'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
const baselinePath = path.join(root, 'scripts/infra/typecheck-baseline.json');
const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;
const writing = args.has('--write-baseline');
if (writing && baseline) throw new Error('Initial baseline already exists; writing cannot increase reviewed allowances. Use --prune-baseline to reduce it.');
if (!writing && !args.has('--strict')) validateTypecheckBaseline(baseline, projects, compilerVersion);
// A PR cannot increase allowances just by editing its baseline JSON. Once the
// initial reviewed baseline is committed, compare changes with the trusted base.
if (!writing && !args.has('--strict') && fs.existsSync(path.join(root, '.git'))) {
    const reference = referenceArg?.slice('--baseline-ref='.length) || 'HEAD';
    if (reference.startsWith('-')) throw new Error('Invalid baseline reference');
    const resolved = spawnSync('git', ['rev-parse', '--verify', reference], { cwd: root, encoding: 'utf8' });
    if (resolved.status !== 0) throw new Error(`Cannot resolve trusted typecheck reference: ${reference}`);
    const listing = spawnSync('git', ['ls-tree', resolved.stdout.trim(), '--', 'scripts/infra/typecheck-baseline.json'], { cwd: root, encoding: 'utf8' });
    if (listing.status !== 0) throw new Error('Cannot inspect trusted typecheck baseline');
    if (listing.stdout.trim()) {
        const previous = spawnSync('git', ['show', `${resolved.stdout.trim()}:scripts/infra/typecheck-baseline.json`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        if (previous.status !== 0) throw new Error('Cannot read trusted typecheck baseline');
        const approved = JSON.parse(previous.stdout);
        validateTypecheckBaseline(approved, projects, compilerVersion);
        for (const project of projects) {
            const counts = new Map(approved.projects[project].map(item => [diagnosticKey(item), item.count]));
            if (baseline.projects[project].some(item => item.count > (counts.get(diagnosticKey(item)) ?? 0))) {
                throw new Error(`Baseline allowances cannot increase beyond ${reference}: ${project}`);
            }
        }
    }
}
const updated = { version: 1, compilerVersion, projects: {} };
const logDir = path.join(root, 'node_modules/.cache/typecheck');
fs.mkdirSync(logDir, { recursive: true });
let failed = false;
for (const [index, project] of projects.entries()) {
    const result = spawnSync(process.execPath, [compiler, '--noEmit', '--pretty', 'false', '--project', project], {
        cwd: root, encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    const output = (result.stdout ?? '') + (result.stderr ?? '');
    fs.writeFileSync(path.join(logDir, `project-${index}.log`), output);
    const diagnostics = parseTypeDiagnostics(output, root);
    validateCompilerResult(result, diagnostics);
    updated.projects[project] = countDiagnostics(diagnostics);
    if (args.has('--strict')) {
        if (result.status !== 0) failed = true;
        console.log(`[typecheck:strict] ${project}: ${diagnostics.length} diagnostics; exit ${result.status}`);
        if (output) process.stdout.write(output);
        continue;
    }
    const comparison = compareDiagnostics(diagnostics, baseline?.projects[project] ?? []);
    console.log(`[typecheck] ${project}: ${diagnostics.length} existing, ${comparison.newDiagnostics.length} new groups, ${comparison.removed} removed`);
    if (!writing && comparison.newDiagnostics.length) {
        failed = true;
        for (const item of comparison.newDiagnostics) console.error(`${item.file}: TS${item.code} (${item.count}) ${item.message}`);
    }
    if (!writing && comparison.removed && !args.has('--prune-baseline')) {
        failed = true;
        console.error('Resolved diagnostics must be removed with --prune-baseline; stale allowances cannot pass.');
    }
}
if (!failed && (writing || args.has('--prune-baseline'))) fs.writeFileSync(baselinePath, JSON.stringify(updated, null, 2) + '\n');
process.exitCode = failed ? 1 : 0;
