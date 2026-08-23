import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, relative } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const gamesRoot = resolve(repoRoot, 'src/games');

type SourceFileSnapshot = {
    absolutePath: string;
    relativePath: string;
    source: string;
    lines: string[];
};

function collectFormalGameSources(dir = gamesRoot): SourceFileSnapshot[] {
    const entries = readdirSync(dir);
    const files: SourceFileSnapshot[] = [];

    for (const entry of entries) {
        const absolutePath = resolve(dir, entry);
        const stats = statSync(absolutePath);
        if (stats.isDirectory()) {
            if (entry === '__tests__') continue;
            files.push(...collectFormalGameSources(absolutePath));
            continue;
        }

        if (!/\.(ts|tsx)$/.test(entry)) continue;
        if (/\.test\.(ts|tsx)$/.test(entry)) continue;
        if (entry.includes('debug-config')) continue;

        const source = readFileSync(absolutePath, 'utf-8');
        files.push({
            absolutePath,
            relativePath: relative(repoRoot, absolutePath).replace(/\\/g, '/'),
            source,
            lines: source.split(/\r?\n/),
        });
    }

    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function objectLiteralHasProperty(
    node: ts.ObjectLiteralExpression,
    propertyName: string,
    sourceFile: ts.SourceFile,
): boolean {
    return node.properties.some((property) => {
        if (ts.isShorthandPropertyAssignment(property)) {
            return property.name.text === propertyName;
        }
        if (ts.isPropertyAssignment(property)) {
            const name = property.name;
            if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
                return name.text === propertyName;
            }
        }
        if (ts.isSpreadAssignment(property)) {
            return property.getText(sourceFile).includes(propertyName);
        }
        return false;
    });
}

function collectResponsePayloadsWithOptionIdsAndMergedValue(): string[] {
    const violations: string[] = [];

    for (const file of collectFormalGameSources()) {
        const sourceFile = ts.createSourceFile(
            file.relativePath,
            file.source,
            ts.ScriptTarget.Latest,
            true,
            file.relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );

        const visit = (node: ts.Node): void => {
            if (ts.isObjectLiteralExpression(node)) {
                const hasOptionIds = objectLiteralHasProperty(node, 'optionIds', sourceFile);
                const hasMergedValue = objectLiteralHasProperty(node, 'mergedValue', sourceFile);
                if (hasOptionIds && hasMergedValue) {
                    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
                    violations.push(`${file.relativePath}:${line + 1} ${file.lines[line]?.trim() ?? ''}`);
                }
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
    }

    return violations;
}

const reviewedSingleValueCollapseSites = new Set([
    // 图书管理员 POD：此交互文案和配置都是选择一张疯狂卡，不是 multi。
    'src/games/smashup/abilities/miskatonic.ts const selected = (Array.isArray(value) ? value[0] : value) as { cardUid?: string } | undefined;',
    // Munchkin Mages 弃牌成本 helper：创建处固定 multi min=1/max=1，数组只来自旧 simple-choice 兼容返回。
    'src/games/smashup/abilities/munchkin_mages.ts const choice = (Array.isArray(value) ? value[0] : value) as HandCardChoice | undefined;',
]);

function collectUnreviewedArrayValueFirstItemConsumers(): string[] {
    const pattern = /Array\.isArray\(value\)\s*\?\s*value\s*\[\s*0\s*\]\s*:\s*value/;
    const violations: string[] = [];

    for (const file of collectFormalGameSources()) {
        file.lines.forEach((line, index) => {
            if (!pattern.test(line)) return;
            const key = `${file.relativePath} ${line.trim()}`;
            if (reviewedSingleValueCollapseSites.has(key)) return;
            violations.push(`${file.relativePath}:${index + 1} ${line.trim()}`);
        });
    }

    return violations;
}

function collectPromptOverlaySkipToggleSites(): string[] {
    const promptOverlayPath = resolve(gamesRoot, 'smashup/ui/PromptOverlay.tsx');
    const source = readFileSync(promptOverlayPath, 'utf-8');
    const lines = source.split(/\r?\n/);

    return lines
        .map((line, index) => ({ line: line.trim(), index }))
        .filter(({ line }) => line.includes('handleAction(skipOption.id'))
        .map(({ line, index }) => `src/games/smashup/ui/PromptOverlay.tsx:${index + 1} ${line}`);
}

describe('老游戏多选 / 多目标意图合同静态审计', () => {
    it('正式代码不得在同一个响应 payload 中同时提交 optionIds 和 mergedValue', () => {
        expect(collectResponsePayloadsWithOptionIdsAndMergedValue()).toEqual([]);
    });

    it('数组 value 只取第一个的旧兼容点必须显式复核为单选语义', () => {
        expect(collectUnreviewedArrayValueFirstItemConsumers()).toEqual([]);
    });

    it('Smash Up multi prompt 的跳过控制项不得复用普通选项 toggle 路径', () => {
        expect(collectPromptOverlaySkipToggleSites()).toEqual([]);
    });
});
