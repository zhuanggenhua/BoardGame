/**
 * SmashUp - Interaction 选项展示模式审计
 *
 * 审计目标：确保所有涉及卡牌/随从/基地的 Interaction 选项都包含必要的 defId 字段，
 * 以便 PromptOverlay 能正确切换到卡牌展示模式。
 */

import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import {
    collectOptionObjectLiterals,
    extractSimpleChoiceConfig,
    getChoiceOptionsArg,
    isCreateSimpleChoiceCall,
} from './helpers/simpleChoiceAst';

interface OptionValueIssue {
    file: string;
    line: number;
    sourceId: string;
    issue: string;
}

const BUTTON_OPTION_IDS = new Set(['skip', 'done', 'confirm', 'cancel', 'yes', 'no', 'apply', 'stop']);
const BUTTON_LABEL_HINTS = ['跳过', '取消', '确认', '完成', '留在原地', '不触发', '不返回', '不移动', '不消灭', '放置'];

function extractObjectValueProps(optionNode: ts.ObjectLiteralExpression): Set<string> {
    const valueProp = optionNode.properties.find(
        prop => ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'value'
    ) as ts.PropertyAssignment | undefined;

    if (!valueProp || !ts.isObjectLiteralExpression(valueProp.initializer)) return new Set<string>();

    const valueProps = new Set<string>();
    for (const prop of valueProp.initializer.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            valueProps.add(prop.name.text);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
            valueProps.add(prop.name.text);
        }
    }
    return valueProps;
}

function hasNestedValueDisplayMode(optionNode: ts.ObjectLiteralExpression): boolean {
    const valueProp = optionNode.properties.find(
        prop => ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'value'
    ) as ts.PropertyAssignment | undefined;

    if (!valueProp || !ts.isObjectLiteralExpression(valueProp.initializer)) return false;

    return valueProp.initializer.properties.some(prop =>
        (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'displayMode')
        || (ts.isShorthandPropertyAssignment(prop) && prop.name.text === 'displayMode')
    );
}

function analyzeOptionObject(
    optionNode: ts.ObjectLiteralExpression,
    sourceId: string,
    filePath: string,
    issues: OptionValueIssue[]
): void {
    const valueProps = extractObjectValueProps(optionNode);
    if (valueProps.size === 0) return;

    const line = ts.getLineAndCharacterOfPosition(optionNode.getSourceFile(), optionNode.getStart()).line + 1;

    if (valueProps.has('cardUid') && !valueProps.has('defId')) {
        issues.push({
            file: filePath,
            line,
            sourceId,
            issue: 'value 包含 cardUid 但缺少 defId 字段',
        });
    }

    if (valueProps.has('minionUid') && !valueProps.has('minionDefId')) {
        issues.push({
            file: filePath,
            line,
            sourceId,
            issue: 'value 包含 minionUid 但缺少 minionDefId 字段',
        });
    }
}

function analyzeButtonDisplayMode(
    optionNode: ts.ObjectLiteralExpression,
    sourceId: string,
    filePath: string,
    issues: OptionValueIssue[],
): void {
    const props = new Map<string, ts.Expression>();
    for (const prop of optionNode.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const name = ts.isIdentifier(prop.name)
            ? prop.name.text
            : ts.isStringLiteralLike(prop.name)
                ? prop.name.text
                : undefined;
        if (!name) continue;
        props.set(name, prop.initializer);
    }

    const idInit = props.get('id');
    const labelInit = props.get('label');
    const id = idInit && ts.isStringLiteralLike(idInit) ? idInit.text : undefined;
    const label = labelInit && ts.isStringLiteralLike(labelInit) ? labelInit.text : undefined;
    const hasDisplayMode = props.has('displayMode');
    const valueProps = extractObjectValueProps(optionNode);
    const hasCardishValue = ['cardUid', 'minionUid', 'baseIndex', 'defId', 'minionDefId', 'baseDefId']
        .some(prop => valueProps.has(prop));
    const looksLikeButton = !!(
        (id && BUTTON_OPTION_IDS.has(id))
        || (label && BUTTON_LABEL_HINTS.some(hint => label.includes(hint)))
    );

    if (!looksLikeButton || hasDisplayMode || hasCardishValue) return;

    const line = ts.getLineAndCharacterOfPosition(optionNode.getSourceFile(), optionNode.getStart()).line + 1;
    issues.push({
        file: filePath,
        line,
        sourceId,
        issue: '按钮语义选项缺少 displayMode: \'button\' 声明',
    });
}

function analyzeValueDisplayModeLeak(
    optionNode: ts.ObjectLiteralExpression,
    sourceId: string,
    filePath: string,
    issues: OptionValueIssue[],
): void {
    if (!hasNestedValueDisplayMode(optionNode)) return;
    const line = ts.getLineAndCharacterOfPosition(optionNode.getSourceFile(), optionNode.getStart()).line + 1;
    issues.push({
        file: filePath,
        line,
        sourceId,
        issue: 'displayMode 不应写入 value 对象，应写在选项顶层',
    });
}

function extractTopLevelStringProp(optionNode: ts.ObjectLiteralExpression, propName: string): string | undefined {
    const init = getObjectPropMap(optionNode).get(propName);
    if (!init) return undefined;
    if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return init.text;
    if (ts.isAsExpression(init)) {
        const expr = init.expression;
        if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    }
    return undefined;
}

function getObjectPropMap(optionNode: ts.ObjectLiteralExpression): Map<string, ts.Expression> {
    const props = new Map<string, ts.Expression>();
    for (const prop of optionNode.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const name = ts.isIdentifier(prop.name)
            ? prop.name.text
            : ts.isStringLiteralLike(prop.name)
                ? prop.name.text
                : undefined;
        if (!name) continue;
        props.set(name, prop.initializer);
    }
    return props;
}

function analyzeCardDisplayMode(
    optionNode: ts.ObjectLiteralExpression,
    sourceId: string,
    filePath: string,
    issues: OptionValueIssue[],
): void {
    const valueProps = extractObjectValueProps(optionNode);
    const currentDisplayMode = extractTopLevelStringProp(optionNode, 'displayMode');
    if (currentDisplayMode === 'button') return;

    const id = extractTopLevelStringProp(optionNode, 'id');
    const label = extractTopLevelStringProp(optionNode, 'label');
    const looksLikeButton = !!(
        (id && BUTTON_OPTION_IDS.has(id))
        || (label && BUTTON_LABEL_HINTS.some(hint => label.includes(hint)))
    );
    if (looksLikeButton) return;

    const hasControlPayload = ['count', 'amount', 'budget', 'action'].some(prop => valueProps.has(prop));
    if (hasControlPayload) return;

    const hasEntityCardValue = valueProps.has('cardUid')
        || valueProps.has('minionUid')
        || valueProps.has('baseDefId')
        || valueProps.has('minionDefId');
    const hasBaseChoiceValue = valueProps.has('baseIndex') && !valueProps.has('count') && !valueProps.has('amount');
    if (!hasEntityCardValue && !hasBaseChoiceValue) return;
    if (currentDisplayMode === 'card') return;

    const line = ts.getLineAndCharacterOfPosition(optionNode.getSourceFile(), optionNode.getStart()).line + 1;
    issues.push({
        file: filePath,
        line,
        sourceId,
        issue: '实体卡牌/基地选项缺少 displayMode: \'card\' 声明',
    });
}

function analyzeRenderableDefForCardMode(
    optionNode: ts.ObjectLiteralExpression,
    sourceId: string,
    filePath: string,
    issues: OptionValueIssue[],
): void {
    const currentDisplayMode = extractTopLevelStringProp(optionNode, 'displayMode');
    if (currentDisplayMode !== 'card') return;

    const valueProps = extractObjectValueProps(optionNode);
    const hasRenderableDef = valueProps.has('defId') || valueProps.has('minionDefId') || valueProps.has('baseDefId');
    if (hasRenderableDef) return;

    const line = ts.getLineAndCharacterOfPosition(optionNode.getSourceFile(), optionNode.getStart()).line + 1;
    issues.push({
        file: filePath,
        line,
        sourceId,
        issue: 'card displayMode 选项缺少可渲染的 defId/baseDefId/minionDefId',
    });
}

function looksLikePromptOption(optionNode: ts.ObjectLiteralExpression): boolean {
    const props = getObjectPropMap(optionNode);
    if (!props.has('id') || !props.has('value')) return false;
    return props.has('label') || props.has('_source') || props.has('displayMode') || props.has('disabled');
}

function inferOptionSourceId(optionNode: ts.ObjectLiteralExpression): string {
    let current: ts.Node | undefined = optionNode;
    while (current) {
        if (ts.isCallExpression(current) && isCreateSimpleChoiceCall(current)) {
            return extractSimpleChoiceConfig(current).sourceId;
        }
        current = current.parent;
    }

    current = optionNode.parent;
    while (current) {
        if (ts.isFunctionLike(current) && current.body) {
            const sourceIds = new Set<string>();
            const collect = (node: ts.Node) => {
                if (ts.isCallExpression(node) && isCreateSimpleChoiceCall(node)) {
                    sourceIds.add(extractSimpleChoiceConfig(node).sourceId);
                }
                ts.forEachChild(node, collect);
            };
            collect(current.body);
            if (sourceIds.size === 1) return Array.from(sourceIds)[0];
        }
        current = current.parent;
    }

    return 'dynamic_option';
}

function collectAllPromptOptionNodes(sourceFile: ts.SourceFile): Array<{ sourceId: string; node: ts.ObjectLiteralExpression }> {
    const nodes = new Map<number, { sourceId: string; node: ts.ObjectLiteralExpression }>();

    const visit = (node: ts.Node) => {
        if (isCreateSimpleChoiceCall(node)) {
            const config = extractSimpleChoiceConfig(node);
            const optionNodes = collectOptionObjectLiterals(sourceFile, getChoiceOptionsArg(node), node);
            for (const optionNode of optionNodes) {
                nodes.set(optionNode.getStart(), { sourceId: config.sourceId, node: optionNode });
            }
        }

        if (ts.isObjectLiteralExpression(node) && looksLikePromptOption(node)) {
            const start = node.getStart();
            if (!nodes.has(start)) {
                nodes.set(start, { sourceId: inferOptionSourceId(node), node });
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return Array.from(nodes.values());
}

function analyzeSimpleChoiceOptions(sourceFile: ts.SourceFile, filePath: string): OptionValueIssue[] {
    const issues: OptionValueIssue[] = [];
    for (const { sourceId, node } of collectAllPromptOptionNodes(sourceFile)) {
        analyzeOptionObject(node, sourceId, filePath, issues);
    }
    return issues;
}

function getFilesToScan(): string[] {
    const abilitiesDir = resolve(__dirname, '../abilities');
    const baseAbilityFiles = [
        resolve(__dirname, '../domain/baseAbilities.ts'),
        resolve(__dirname, '../domain/baseAbilities_expansion.ts'),
    ];

    const abilityFiles = readdirSync(abilitiesDir)
        .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
        .map(file => join(abilitiesDir, file));

    return [...abilityFiles, ...baseAbilityFiles];
}

function dedupeIssues(issues: OptionValueIssue[]): OptionValueIssue[] {
    const seen = new Set<string>();
    return issues.filter(issue => {
        const key = `${issue.file}:${issue.line}:${issue.sourceId}:${issue.issue}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

describe('SmashUp Interaction 选项展示模式审计', () => {
    it('所有卡牌选项都包含 defId 字段', () => {
        const allIssues: OptionValueIssue[] = [];

        for (const filePath of getFilesToScan()) {
            const content = readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
            const issues = analyzeSimpleChoiceOptions(sourceFile, filePath);
            allIssues.push(...issues);
        }

        const dedupedIssues = dedupeIssues(allIssues);

        if (dedupedIssues.length > 0) {
            const report = dedupedIssues.map(issue =>
                `${issue.file}:${issue.line} [${issue.sourceId}] ${issue.issue}`
            ).join('\n');
            expect.fail(`发现 ${dedupedIssues.length} 个选项缺少必要的 defId 字段：\n${report}`);
        }

        expect(dedupedIssues).toEqual([]);
    });

    it('按钮语义选项必须显式声明 button displayMode', () => {
        const allIssues: OptionValueIssue[] = [];

        for (const filePath of getFilesToScan()) {
            const content = readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
            for (const { sourceId, node } of collectAllPromptOptionNodes(sourceFile)) {
                analyzeButtonDisplayMode(node, sourceId, filePath, allIssues);
            };
        }

        const dedupedIssues = dedupeIssues(allIssues);

        if (dedupedIssues.length > 0) {
            const report = dedupedIssues.map(issue =>
                `${issue.file}:${issue.line} [${issue.sourceId}] ${issue.issue}`
            ).join('\n');
            expect.fail(`发现 ${dedupedIssues.length} 个按钮语义选项未声明 displayMode：\n${report}`);
        }

        expect(dedupedIssues).toEqual([]);
    });

    it('实体卡牌/基地选项必须显式声明 card displayMode', () => {
        const allIssues: OptionValueIssue[] = [];

        for (const filePath of getFilesToScan()) {
            const content = readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
            for (const { sourceId, node } of collectAllPromptOptionNodes(sourceFile)) {
                analyzeCardDisplayMode(node, sourceId, filePath, allIssues);
            }
        }

        const dedupedIssues = dedupeIssues(allIssues);

        if (dedupedIssues.length > 0) {
            const report = dedupedIssues.map(issue =>
                `${issue.file}:${issue.line} [${issue.sourceId}] ${issue.issue}`
            ).join('\n');
            expect.fail(`发现 ${dedupedIssues.length} 个实体卡牌选项未声明 card displayMode：\n${report}`);
        }

        expect(dedupedIssues).toEqual([]);
    });

    it('显式 card displayMode 的选项必须提供可渲染 defId', () => {
        const allIssues: OptionValueIssue[] = [];

        for (const filePath of getFilesToScan()) {
            const content = readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
            for (const { sourceId, node } of collectAllPromptOptionNodes(sourceFile)) {
                analyzeRenderableDefForCardMode(node, sourceId, filePath, allIssues);
            }
        }

        const dedupedIssues = dedupeIssues(allIssues);

        if (dedupedIssues.length > 0) {
            const report = dedupedIssues.map(issue =>
                `${issue.file}:${issue.line} [${issue.sourceId}] ${issue.issue}`
            ).join('\n');
            expect.fail(`发现 ${dedupedIssues.length} 个 card displayMode 选项缺少可渲染 defId：\n${report}`);
        }

        expect(dedupedIssues).toEqual([]);
    });

    it('displayMode 只能声明在选项顶层，不能写入 value', () => {
        const allIssues: OptionValueIssue[] = [];

        for (const filePath of getFilesToScan()) {
            const content = readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
            for (const { sourceId, node } of collectAllPromptOptionNodes(sourceFile)) {
                analyzeValueDisplayModeLeak(node, sourceId, filePath, allIssues);
            };
        }

        const dedupedIssues = dedupeIssues(allIssues);

        if (dedupedIssues.length > 0) {
            const report = dedupedIssues.map(issue =>
                `${issue.file}:${issue.line} [${issue.sourceId}] ${issue.issue}`
            ).join('\n');
            expect.fail(`发现 ${dedupedIssues.length} 个选项把 displayMode 写进了 value：\n${report}`);
        }

        expect(dedupedIssues).toEqual([]);
    });
});
