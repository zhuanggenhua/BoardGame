import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

function getSmashUpSourceFiles(): string[] {
    const repoRoot = path.resolve(__dirname, '../../..');
    const abilitiesDir = path.join(repoRoot, 'games', 'smashup', 'abilities');
    const domainDir = path.join(repoRoot, 'games', 'smashup', 'domain');

    return [
        ...fs.readdirSync(abilitiesDir)
            .filter((entry) => entry.endsWith('.ts'))
            .map((entry) => path.join(abilitiesDir, entry)),
        ...fs.readdirSync(domainDir)
            .filter((entry) => entry.endsWith('.ts'))
            .map((entry) => path.join(domainDir, entry)),
    ];
}

function getPropertyNameText(name: ts.PropertyName): string | undefined {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
        return name.text;
    }
    return undefined;
}

function addBindingNames(name: ts.BindingName, target: Set<string>) {
    if (ts.isIdentifier(name)) {
        target.add(name.text);
        return;
    }
    for (const element of name.elements) {
        if (ts.isOmittedExpression(element)) continue;
        addBindingNames(element.name, target);
    }
}

function collectFunctionScopeNames(node: ts.ArrowFunction | ts.FunctionExpression): Set<string> {
    const names = new Set<string>();
    for (const parameter of node.parameters) {
        addBindingNames(parameter.name, names);
    }

    if (!ts.isBlock(node.body)) {
        return names;
    }

    const visit = (current: ts.Node) => {
        if (ts.isVariableDeclaration(current)) {
            addBindingNames(current.name, names);
        } else if (ts.isFunctionDeclaration(current) && current.name) {
            names.add(current.name.text);
        } else if (ts.isCatchClause(current) && current.variableDeclaration) {
            addBindingNames(current.variableDeclaration.name, names);
        }
        ts.forEachChild(current, visit);
    };

    visit(node.body);
    return names;
}

describe('SmashUp runtime prompt random seam 审计', () => {
    it('onResolve 不得继续裸调 buildStandardDrawEvents(..., random, ...)', () => {
        const violations: string[] = [];

        for (const filePath of getSmashUpSourceFiles()) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

            const visit = (node: ts.Node) => {
                if (
                    ts.isPropertyAssignment(node)
                    && getPropertyNameText(node.name) === 'onResolve'
                    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
                ) {
                    const functionNode = node.initializer;
                    const inspect = (current: ts.Node) => {
                        if (
                            ts.isCallExpression(current)
                            && ts.isIdentifier(current.expression)
                            && current.expression.text === 'buildStandardDrawEvents'
                            && current.arguments.length >= 5
                            && ts.isIdentifier(current.arguments[3])
                            && current.arguments[3].text === 'random'
                        ) {
                            const { line } = sourceFile.getLineAndCharacterOfPosition(current.getStart(sourceFile));
                            violations.push(
                                `${path.relative(path.resolve(__dirname, '../../..'), filePath).replace(/\\/g, '/')}:${line + 1} ` +
                                'onResolve 中请改用 buildStandardDrawEventsFromRuntimeContext(...)，不要继续手传 random',
                            );
                        }
                        ts.forEachChild(current, inspect);
                    };

                    inspect(functionNode.body);
                }
                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        }

        expect(violations).toEqual([]);
    });

    it('onResolve 若只通过 runtime draw helper 抽牌，不得再手工解构 random', () => {
        const violations: string[] = [];

        for (const filePath of getSmashUpSourceFiles()) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

            const visit = (node: ts.Node) => {
                if (
                    ts.isPropertyAssignment(node)
                    && getPropertyNameText(node.name) === 'onResolve'
                    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
                ) {
                    const functionNode = node.initializer;
                    const usesRuntimeDrawHelper = (() => {
                        let found = false;
                        const inspect = (current: ts.Node) => {
                            if (
                                ts.isCallExpression(current)
                                && ts.isIdentifier(current.expression)
                                && current.expression.text === 'buildStandardDrawEventsFromRuntimeContext'
                            ) {
                                found = true;
                                return;
                            }
                            ts.forEachChild(current, inspect);
                        };
                        inspect(functionNode.body);
                        return found;
                    })();

                    const firstParam = functionNode.parameters[0];
                    const destructuresRandom = Boolean(
                        usesRuntimeDrawHelper
                        && firstParam
                        && ts.isObjectBindingPattern(firstParam.name)
                        && firstParam.name.elements.some((element) => ts.isIdentifier(element.name) && element.name.text === 'random'),
                    );

                    if (destructuresRandom) {
                        const { line } = sourceFile.getLineAndCharacterOfPosition(firstParam.getStart(sourceFile));
                        violations.push(
                            `${path.relative(path.resolve(__dirname, '../../..'), filePath).replace(/\\/g, '/')}:${line + 1} ` +
                            'onResolve 已改走 buildStandardDrawEventsFromRuntimeContext(...) 时，请改为 onResolve(args) 风格，避免继续手工解构 random',
                        );
                    }
                }
                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        }

        expect(violations).toEqual([]);
    });

    it('onResolve 里若直接使用 random，当前函数作用域必须显式可见', () => {
        const violations: string[] = [];

        for (const filePath of getSmashUpSourceFiles()) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

            const visit = (node: ts.Node) => {
                if (
                    ts.isPropertyAssignment(node)
                    && getPropertyNameText(node.name) === 'onResolve'
                    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
                ) {
                    const functionNode = node.initializer;
                    const scopeNames = collectFunctionScopeNames(functionNode);

                    const inspect = (current: ts.Node) => {
                        if (
                            ts.isIdentifier(current)
                            && current.text === 'random'
                            && !scopeNames.has('random')
                        ) {
                            const parent = current.parent;
                            const isDeclarationSite =
                                ts.isBindingElement(parent)
                                || ts.isVariableDeclaration(parent)
                                || ts.isParameter(parent)
                                || (ts.isPropertyAssignment(parent) && parent.name === current)
                                || (ts.isPropertyAccessExpression(parent) && parent.name === current);
                            if (!isDeclarationSite) {
                                const { line } = sourceFile.getLineAndCharacterOfPosition(current.getStart(sourceFile));
                                violations.push(
                                    `${path.relative(path.resolve(__dirname, '../../..'), filePath).replace(/\\/g, '/')}:${line + 1} ` +
                                    'onResolve 中使用了裸 random，但当前回调没有把它纳入作用域',
                                );
                            }
                        }
                        ts.forEachChild(current, inspect);
                    };

                    inspect(functionNode.body);
                }
                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        }

        expect(violations).toEqual([]);
    });
});
