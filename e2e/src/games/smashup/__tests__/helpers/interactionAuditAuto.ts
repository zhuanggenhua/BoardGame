import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import type {
    AuditableInteractionSource,
    HandlerChainLink,
} from '../../../../engine/testing/interactionCompletenessAudit';

export interface InteractionAuditExtractionWarning {
    file: string;
    line: number;
    detail: string;
}

export interface InteractionAuditAutoResult {
    sources: AuditableInteractionSource[];
    chains: HandlerChainLink[];
    warnings: InteractionAuditExtractionWarning[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SMASHUP_DIR = path.resolve(__dirname, '..', '..');
const EXCLUDED_DIRS = new Set(['__tests__', 'data']);
const HELPER_SOURCE_ARG_INDEX = new Map<string, number>([
    // pirates.ts: buildMoveToBaseInteraction(..., interactionIdPrefix, sourceId, ...)
    ['buildMoveToBaseInteraction', 5],
]);

function listImplementationTsFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name)) continue;
            files.push(...listImplementationTsFiles(fullPath));
            continue;
        }
        if (entry.isFile() && entry.name.endsWith('.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

function getCallIdentifierName(call: ts.CallExpression): string | null {
    const expr = call.expression;
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) return expr.name.text;
    return null;
}

function extractStringLiteral(expr: ts.Expression | undefined): string | null {
    if (!expr) return null;
    if (ts.isStringLiteral(expr)) return expr.text;
    if (ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    return null;
}

function getPropertyName(name: ts.PropertyName): string | null {
    if (ts.isIdentifier(name)) return name.text;
    if (ts.isStringLiteral(name)) return name.text;
    if (ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
    return null;
}

function extractSourceIdFromConfigObject(expr: ts.Expression | undefined): string | null {
    if (!expr || !ts.isObjectLiteralExpression(expr)) return null;
    for (const prop of expr.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const name = getPropertyName(prop.name);
        if (name !== 'sourceId') continue;
        return extractStringLiteral(prop.initializer);
    }
    return null;
}

function pushWarning(
    warnings: InteractionAuditExtractionWarning[],
    sourceFile: ts.SourceFile,
    node: ts.Node,
    detail: string
): void {
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    warnings.push({
        file: path.relative(SMASHUP_DIR, sourceFile.fileName).replace(/\\/g, '/'),
        line: pos.line + 1,
        detail,
    });
}

function collectChoiceSourceIds(
    root: ts.Node,
    sourceFile: ts.SourceFile,
    warnings: InteractionAuditExtractionWarning[]
): string[] {
    const ids = new Set<string>();

    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && getCallIdentifierName(node) === 'createSimpleChoice') {
            const sourceArg = node.arguments[4];
            const sourceId =
                extractStringLiteral(sourceArg)
                ?? extractSourceIdFromConfigObject(sourceArg);
            if (sourceId) {
                ids.add(sourceId);
            } else {
                // 允许 helper 通过形参传递 sourceId（由调用点静态提取）
                if (sourceArg && ts.isIdentifier(sourceArg) && sourceArg.text === 'sourceId') {
                    ts.forEachChild(node, visit);
                    return;
                }
                pushWarning(
                    warnings,
                    sourceFile,
                    node,
                    'createSimpleChoice 的第5参数(sourceId)不是字符串字面量，无法自动审计'
                );
            }
        }
        ts.forEachChild(node, visit);
    };

    visit(root);
    return Array.from(ids);
}

function collectHelperProducedSourceIds(root: ts.Node): string[] {
    const ids = new Set<string>();

    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
            const callName = getCallIdentifierName(node);
            if (callName && HELPER_SOURCE_ARG_INDEX.has(callName)) {
                const argIndex = HELPER_SOURCE_ARG_INDEX.get(callName)!;
                const sourceId = extractStringLiteral(node.arguments[argIndex]);
                if (sourceId) {
                    ids.add(sourceId);
                }
            }
            if (callName === 'resolveOrPrompt') {
                const sourceId = extractSourceIdFromConfigObject(node.arguments[2]);
                if (sourceId) {
                    ids.add(sourceId);
                }
            }
        }
        ts.forEachChild(node, visit);
    };

    visit(root);
    return Array.from(ids);
}

function collectGrantExtraReasons(root: ts.Node): string[] {
    const reasons = new Set<string>();
    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
            const callName = getCallIdentifierName(node);
            if (callName === 'grantExtraMinion' || callName === 'grantExtraAction') {
                const reason = extractStringLiteral(node.arguments[1]);
                if (reason) reasons.add(reason);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(root);
    return Array.from(reasons);
}

export function collectSmashupInteractionAuditAuto(): InteractionAuditAutoResult {
    const files = listImplementationTsFiles(SMASHUP_DIR);
    const warnings: InteractionAuditExtractionWarning[] = [];

    const allSourceIds = new Set<string>();
    const chainMap = new Map<string, Set<string>>();
    const handlerIds = new Set<string>();
    const extraReasonIds = new Set<string>();

    for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

        // 1) 全局提取 createSimpleChoice sourceId（作为审计输入源）
        for (const sourceId of collectChoiceSourceIds(sourceFile, sourceFile, warnings)) {
            allSourceIds.add(sourceId);
        }
        // 1.1) helper 调用中传入的静态 sourceId
        for (const sourceId of collectHelperProducedSourceIds(sourceFile)) {
            allSourceIds.add(sourceId);
        }
        // 1.2) grantExtra* 的 reason（部分交互由系统根据 reason 生成 sourceId）
        for (const reason of collectGrantExtraReasons(sourceFile)) {
            extraReasonIds.add(reason);
            extraReasonIds.add(`${reason}_search`);
        }

        // 2) 提取 handler 链：registerInteractionHandler(sourceId, handlerFn)
        const visit = (node: ts.Node) => {
            if (!ts.isCallExpression(node) || getCallIdentifierName(node) !== 'registerInteractionHandler') {
                ts.forEachChild(node, visit);
                return;
            }

            const sourceId = extractStringLiteral(node.arguments[0]);
            const handlerExpr = node.arguments[1];

            if (!sourceId) {
                pushWarning(warnings, sourceFile, node, 'registerInteractionHandler 第1参数不是字符串字面量');
                ts.forEachChild(node, visit);
                return;
            }

            if (!handlerExpr) {
                pushWarning(warnings, sourceFile, node, `handler="${sourceId}" 缺少第2参数`);
                ts.forEachChild(node, visit);
                return;
            }

            // 记录所有显式注册的 handler，用于补齐 grantExtra* reason 推导出的隐式 sourceId
            handlerIds.add(sourceId);

            const producedIds = [
                ...collectChoiceSourceIds(handlerExpr, sourceFile, warnings),
                ...collectHelperProducedSourceIds(handlerExpr),
            ];
            if (!chainMap.has(sourceId)) {
                chainMap.set(sourceId, new Set<string>());
            }
            const nextSet = chainMap.get(sourceId)!;
            for (const nextId of producedIds) {
                nextSet.add(nextId);
            }

            ts.forEachChild(node, visit);
        };

        ts.forEachChild(sourceFile, visit);
    }

    // 仅将“存在 handler 的隐式 sourceId”纳入审计源，避免无意义噪音
    for (const implicitId of extraReasonIds) {
        if (handlerIds.has(implicitId)) {
            allSourceIds.add(implicitId);
        }
    }

    const sources: AuditableInteractionSource[] = Array.from(allSourceIds)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => ({ id, name: id, interactionSourceIds: [id] }));

    const chains: HandlerChainLink[] = Array.from(chainMap.entries())
        .map(([sourceId, ids]) => ({
            sourceId,
            producesSourceIds: Array.from(ids).sort((a, b) => a.localeCompare(b)),
        }))
        .filter((item) => item.producesSourceIds.length > 0)
        .sort((a, b) => a.sourceId.localeCompare(b.sourceId));

    return { sources, chains, warnings };
}
