import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SINGLE_EVENT_HELPERS = new Set([
    'buildAbilityFeedback',
    'grantContextualExtraAction',
    'grantContextualExtraMinion',
    'grantExtraAction',
    'grantExtraMinion',
    'recoverCardsFromDiscard',
]);

const SCAN_DIRS = [
    path.join(process.cwd(), 'src/games/smashup/abilities'),
    path.join(process.cwd(), 'src/games/smashup/domain'),
];

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '__tests__') return [];
            return listSourceFiles(fullPath);
        }
        return entry.isFile() && entry.name.endsWith('.ts') ? [fullPath] : [];
    });
}

function getCalleeName(expression: ts.Expression): string | undefined {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    return undefined;
}

function unwrapExpression(node: ts.Expression): ts.Expression {
    let current = node;
    while (
        ts.isParenthesizedExpression(current)
        || ts.isAsExpression(current)
        || ts.isTypeAssertionExpression(current)
        || ts.isNonNullExpression(current)
    ) {
        current = current.expression;
    }
    return current;
}

function containsBareSingleEventHelper(node: ts.Expression): boolean {
    const expression = unwrapExpression(node);
    if (ts.isArrayLiteralExpression(expression)) return false;
    if (ts.isCallExpression(expression)) {
        return SINGLE_EVENT_HELPERS.has(getCalleeName(expression.expression) ?? '');
    }
    if (ts.isConditionalExpression(expression)) {
        return containsBareSingleEventHelper(expression.whenTrue)
            || containsBareSingleEventHelper(expression.whenFalse);
    }
    if (ts.isBinaryExpression(expression)) {
        return containsBareSingleEventHelper(expression.left)
            || containsBareSingleEventHelper(expression.right);
    }
    return false;
}

function lineOf(sourceFile: ts.SourceFile, position: number): number {
    return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

describe('SmashUp ability event shape contract', () => {
    it('返回单个事件的 helper 不能直接用于数组展开', () => {
        const violations: string[] = [];
        for (const file of SCAN_DIRS.flatMap(listSourceFiles)) {
            const text = readFileSync(file, 'utf8');
            const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

            const visit = (node: ts.Node): void => {
                if (ts.isSpreadElement(node) && containsBareSingleEventHelper(node.expression)) {
                    violations.push(`${path.relative(process.cwd(), file)}:${lineOf(sourceFile, node.getStart(sourceFile))}`);
                }
                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        }

        expect(violations).toEqual([]);
    });
});
