import * as ts from 'typescript';

export interface SimpleChoiceConfigInfo {
    sourceId: string;
    targetType?: string;
    autoRefresh?: string;
    responseValidationMode?: string;
    revalidateOnRespond?: boolean;
    hasMulti: boolean;
    hasTargetType: boolean;
    hasAutoRefresh: boolean;
    hasResponseValidationMode: boolean;
    hasRevalidateOnRespond: boolean;
}

function unwrapExpression(expr: ts.Expression | undefined): ts.Expression | undefined {
    let current = expr;
    while (current) {
        if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
            current = current.expression;
            continue;
        }
        return current;
    }
    return current;
}

function getPropertyName(name: ts.PropertyName): string | null {
    if (ts.isIdentifier(name)) return name.text;
    if (ts.isStringLiteral(name)) return name.text;
    if (ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
    return null;
}

function getExpressionName(expr: ts.Expression | undefined): string | undefined {
    const unwrapped = unwrapExpression(expr);
    if (!unwrapped) return undefined;
    if (ts.isIdentifier(unwrapped)) return unwrapped.text;
    if (ts.isPropertyAccessExpression(unwrapped)) return unwrapped.name.text;
    return undefined;
}

function getChoiceConfigArg(node: ts.CallExpression): ts.Expression | undefined {
    const callName = getExpressionName(node.expression);
    if (callName === 'resolveOrPrompt') return node.arguments[2];
    return node.arguments[4];
}

export function getChoiceOptionsArg(node: ts.CallExpression): ts.Expression | undefined {
    const callName = getExpressionName(node.expression);
    if (callName === 'resolveOrPrompt') return node.arguments[1];
    return node.arguments[3];
}

function extractStringLiteral(expr: ts.Expression | undefined): string | undefined {
    const unwrapped = unwrapExpression(expr);
    if (!unwrapped) return undefined;
    if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
        return unwrapped.text;
    }
    return undefined;
}

function extractBooleanLiteral(expr: ts.Expression | undefined): boolean | undefined {
    const unwrapped = unwrapExpression(expr);
    if (!unwrapped) return undefined;
    if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) return false;
    return undefined;
}

function findNearestVariableDeclaration(
    sourceFile: ts.SourceFile,
    referenceNode: ts.Node,
    name: string
): ts.VariableDeclaration | undefined {
    let best: ts.VariableDeclaration | undefined;
    const referencePos = referenceNode.getStart(sourceFile);

    const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
            const start = node.getStart(sourceFile);
            if (start < referencePos && (!best || start > best.getStart(sourceFile))) {
                best = node;
            }
        }
        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return best;
}

function findEnclosingStatement(node: ts.Node): ts.Statement | undefined {
    let current: ts.Node | undefined = node;
    while (current) {
        if (ts.isStatement(current)) return current;
        current = current.parent;
    }
    return undefined;
}

function extractReturnedObjectLiteral(expr: ts.Expression | ts.ConciseBody): ts.ObjectLiteralExpression | undefined {
    const unwrapped = unwrapExpression(expr as ts.Expression);
    if (!unwrapped) return undefined;
    if (ts.isObjectLiteralExpression(unwrapped)) return unwrapped;

    if (ts.isBlock(expr)) {
        for (const statement of expr.statements) {
            if (!ts.isReturnStatement(statement)) continue;
            const returned = extractReturnedObjectLiteral(statement.expression as ts.Expression);
            if (returned) return returned;
        }
    }

    return undefined;
}

function collectPushedOptions(
    sourceFile: ts.SourceFile,
    variableDecl: ts.VariableDeclaration,
    variableName: string,
    callNode: ts.Node,
    seen: Set<number>,
    results: ts.ObjectLiteralExpression[]
): void {
    const declStatement = findEnclosingStatement(variableDecl);
    const callStatement = findEnclosingStatement(callNode);
    if (!declStatement || !callStatement || declStatement.parent !== callStatement.parent) return;
    if (!ts.isBlock(declStatement.parent) && !ts.isSourceFile(declStatement.parent)) return;

    const statements = declStatement.parent.statements;
    const declIndex = statements.indexOf(declStatement);
    const callIndex = statements.indexOf(callStatement);
    if (declIndex === -1 || callIndex === -1 || declIndex >= callIndex) return;

    for (let i = declIndex + 1; i < callIndex; i++) {
        const statement = statements[i];
        if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;
        const expr = statement.expression.expression;
        if (!ts.isPropertyAccessExpression(expr)) continue;
        if (!ts.isIdentifier(expr.expression) || expr.expression.text !== variableName) continue;
        if (expr.name.text !== 'push') continue;

        for (const arg of statement.expression.arguments) {
            collectOptionObjectLiterals(sourceFile, arg, callNode, seen, results);
        }
    }
}

export function isCreateSimpleChoiceCall(node: ts.Node): node is ts.CallExpression {
    if (!ts.isCallExpression(node)) return false;
    const callName = getExpressionName(node.expression);
    return callName === 'createSimpleChoice' || callName === 'resolveOrPrompt';
}

export function extractSimpleChoiceConfig(node: ts.CallExpression): SimpleChoiceConfigInfo {
    const arg5 = getChoiceConfigArg(node);
    if (!arg5) {
        return {
            sourceId: 'unknown',
            hasMulti: false,
            hasTargetType: false,
            hasAutoRefresh: false,
            hasResponseValidationMode: false,
            hasRevalidateOnRespond: false,
        };
    }

    const stringSourceId = extractStringLiteral(arg5);
    if (stringSourceId) {
        return {
            sourceId: stringSourceId,
            hasMulti: false,
            hasTargetType: false,
            hasAutoRefresh: false,
            hasResponseValidationMode: false,
            hasRevalidateOnRespond: false,
        };
    }

    const unwrapped = unwrapExpression(arg5);
    if (!unwrapped || !ts.isObjectLiteralExpression(unwrapped)) {
        return {
            sourceId: 'unknown',
            hasTargetType: false,
            hasAutoRefresh: false,
            hasResponseValidationMode: false,
            hasRevalidateOnRespond: false,
        };
    }

    let sourceId = 'unknown';
    let targetType: string | undefined;
    let autoRefresh: string | undefined;
    let responseValidationMode: string | undefined;
    let revalidateOnRespond: boolean | undefined;
    let hasMulti = false;
    for (const prop of unwrapped.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const name = getPropertyName(prop.name);
        if (name === 'sourceId') sourceId = extractStringLiteral(prop.initializer) ?? sourceId;
        if (name === 'targetType') targetType = extractStringLiteral(prop.initializer);
        if (name === 'autoRefresh') autoRefresh = extractStringLiteral(prop.initializer);
        if (name === 'responseValidationMode') responseValidationMode = extractStringLiteral(prop.initializer);
        if (name === 'revalidateOnRespond') revalidateOnRespond = extractBooleanLiteral(prop.initializer);
        if (name === 'multi') hasMulti = true;
    }

    return {
        sourceId,
        targetType,
        autoRefresh,
        responseValidationMode,
        revalidateOnRespond,
        hasMulti,
        hasTargetType: !!targetType,
        hasAutoRefresh: !!autoRefresh,
        hasResponseValidationMode: !!responseValidationMode,
        hasRevalidateOnRespond: revalidateOnRespond !== undefined,
    };
}

export function collectOptionObjectLiterals(
    sourceFile: ts.SourceFile,
    optionsNode: ts.Node | undefined,
    callNode: ts.Node,
    seen: Set<number> = new Set(),
    results: ts.ObjectLiteralExpression[] = []
): ts.ObjectLiteralExpression[] {
    const expr = unwrapExpression(optionsNode as ts.Expression | undefined);
    if (!expr) return results;

    if (ts.isObjectLiteralExpression(expr)) {
        results.push(expr);
        return results;
    }

    if (ts.isArrayLiteralExpression(expr)) {
        for (const element of expr.elements) {
            if (ts.isSpreadElement(element)) {
                collectOptionObjectLiterals(sourceFile, element.expression, callNode, seen, results);
                continue;
            }
            collectOptionObjectLiterals(sourceFile, element, callNode, seen, results);
        }
        return results;
    }

    if (ts.isIdentifier(expr)) {
        const variableDecl = findNearestVariableDeclaration(sourceFile, callNode, expr.text);
        if (!variableDecl) return results;
        const declStart = variableDecl.getStart(sourceFile);
        if (seen.has(declStart)) return results;
        seen.add(declStart);

        collectOptionObjectLiterals(sourceFile, variableDecl.initializer, callNode, seen, results);
        collectPushedOptions(sourceFile, variableDecl, expr.text, callNode, seen, results);
        return results;
    }

    if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression) && expr.expression.name.text === 'map') {
        const callback = expr.arguments[0];
        if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) {
            return results;
        }
        const returnedObject = extractReturnedObjectLiteral(callback.body);
        if (returnedObject) results.push(returnedObject);
    }

    return results;
}

export function inferDirectTargetTypeFromOptions(
    sourceFile: ts.SourceFile,
    optionsNode: ts.Node | undefined,
    callNode: ts.Node,
    seen: Set<number> = new Set(),
): 'minion' | 'base' | undefined {
    const expr = unwrapExpression(optionsNode as ts.Expression | undefined);
    if (!expr) return undefined;

    if (ts.isIdentifier(expr)) {
        const variableDecl = findNearestVariableDeclaration(sourceFile, callNode, expr.text);
        if (!variableDecl) return undefined;
        const declStart = variableDecl.getStart(sourceFile);
        if (seen.has(declStart)) return undefined;
        seen.add(declStart);
        return inferDirectTargetTypeFromOptions(sourceFile, variableDecl.initializer, callNode, seen);
    }

    if (ts.isCallExpression(expr)) {
        const calleeName = getExpressionName(expr.expression);
        if (calleeName === 'buildMinionTargetOptions') return 'minion';
        if (calleeName === 'buildBaseTargetOptions') return 'base';
    }

    return undefined;
}
