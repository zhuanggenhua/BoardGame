import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const parsedSources = new Map();

function sourceScope(file, text, line, column) {
    text = text.replaceAll('\r\n', '\n');
    const previous = parsedSources.get(file);
    const source = previous?.text === text ? previous.source : ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    if (source !== previous?.source) parsedSources.set(file, { text, source });
    const position = source.getPositionOfLineAndCharacter(line - 1, column - 1);
    let owner = source;
    const visit = node => {
        if (node.getStart(source) > position || node.end < position) return;
        if (ts.isFunctionLike(node) || node.parent === source) owner = node;
        ts.forEachChild(node, visit);
    };
    visit(source);
    const context = [];
    for (let node = owner.parent; node && node !== source; node = node.parent) {
        if (node.name) context.push(node.name.getText(source));
        if (ts.isCallExpression(node)) context.push(node.expression.getText(source) + ':' +
            node.arguments.filter(ts.isStringLiteralLike).map(value => value.text).join(','));
    }
    const printed = ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, owner, source);
    return createHash('sha256').update(JSON.stringify([context, printed, position - owner.getStart(source)])).digest('hex');
}

export function parseTypeDiagnostics(output, root) {
    const diagnostics = [];
    let current;
    for (const line of output.replaceAll('\r\n', '\n').split('\n')) {
        const match = /^(.*?)\((\d+),(\d+)\): error TS(\d+): (.*)$/.exec(line);
        if (match) {
            const code = Number(match[4]);
            if (code < 2000 || code >= 5000 && code < 6000 || /(?:^|\/)tsconfig[^/]*\.json$/.test(match[1].replaceAll('\\', '/'))) {
                throw new Error(`Compiler/configuration failure: ${line}`);
            }
            const file = path.relative(root, path.resolve(root, match[1])).replaceAll('\\', '/');
            const text = fs.readFileSync(path.resolve(root, file), 'utf8');
            const source = text.split(/\r?\n/)[Number(match[2]) - 1]?.trim() ?? '';
            current = { file, code, message: match[5], source,
                scope: sourceScope(file, text, Number(match[2]), Number(match[3])) };
            diagnostics.push(current);
        } else if (/^error TS\d+:/.test(line)) {
            throw new Error(`Compiler/configuration failure: ${line}`);
        } else if (current && line.trim()) current.message += '\n' + line.trim();
    }
    const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/, '');
    return diagnostics.map(item => ({ ...item,
        message: item.message.replaceAll('\\', '/').replaceAll(normalizedRoot + '/', '<root>/') }));
}
export function diagnosticKey(item) {
    return JSON.stringify([item.file, item.code, item.message, item.scope, item.source]);
}
export function countDiagnostics(items) {
    const counts = new Map();
    for (const item of items) {
        const key = diagnosticKey(item);
        counts.set(key, { ...item, count: (counts.get(key)?.count ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => diagnosticKey(a).localeCompare(diagnosticKey(b)));
}
export function compareDiagnostics(current, baseline) {
    const expected = new Map(baseline.map(item => [diagnosticKey(item), item.count]));
    const newDiagnostics = [];
    for (const item of countDiagnostics(current)) {
        const key = diagnosticKey(item), allowed = expected.get(key) ?? 0;
        if (item.count > allowed) newDiagnostics.push({ ...item, count: item.count - allowed });
        expected.set(key, Math.max(0, allowed - item.count));
    }
    return { newDiagnostics, removed: [...expected.values()].reduce((a, b) => a + b, 0) };
}

export function validateCompilerResult(result, diagnostics) {
    if (result.error || result.signal || ![0, 2].includes(result.status)
        || result.status === 2 && diagnostics.length === 0
        || result.status === 0 && diagnostics.length !== 0) throw new Error('Compiler did not finish with a valid diagnostic result');
}
