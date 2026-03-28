/**
 * SmashUp Interaction 选项 defId 审计
 *
 * 确保所有涉及卡牌/随从/基地的 Interaction 选项都包含 defId/minionDefId/baseDefId，
 * 让 PromptOverlay 能自动切换到卡牌展示模式。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {
    collectOptionObjectLiterals,
    extractSimpleChoiceConfig,
    getChoiceOptionsArg,
    isCreateSimpleChoiceCall,
} from './helpers/simpleChoiceAst';

describe('SmashUp Interaction defId 审计', () => {
    it('所有 createSimpleChoice 的卡牌选项必须包含 defId', () => {
        const violations: string[] = [];
        const abilitiesDir = path.resolve(__dirname, '../abilities');
        const domainDir = path.resolve(__dirname, '../domain');

        const filesToCheck = [
            ...fs.readdirSync(abilitiesDir).filter(f => f.endsWith('.ts')).map(f => path.join(abilitiesDir, f)),
            path.join(domainDir, 'baseAbilities.ts'),
            path.join(domainDir, 'baseAbilities_expansion.ts'),
        ];

        for (const filePath of filesToCheck) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

            // 查找所有 createSimpleChoice 调用
            const visit = (node: ts.Node) => {
                if (ts.isCallExpression(node)) {
                    const expr = node.expression;
                    if (ts.isIdentifier(expr) && expr.text === 'createSimpleChoice') {
                        // 第4个参数是 options 数组
                        const optionsArg = node.arguments[3];
                        if (optionsArg) {
                            checkOptionsArray(optionsArg, filePath, violations);
                        }
                    }
                }
                ts.forEachChild(node, visit);
            };
            visit(sourceFile);
        }

        if (violations.length > 0) {
            console.log('\n=== Interaction defId 缺失清单 ===\n');
            violations.forEach(v => console.log(v));
        }

        expect(violations, '以下 Interaction 选项缺少 defId/minionDefId/baseDefId').toEqual([]);
    });

    it('所有 createSimpleChoice 的 value shorthand 字段都必须引用已定义变量', () => {
        const configPath = path.resolve(__dirname, '../../../../tsconfig.app.json');
        const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
        const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
        const program = ts.createProgram({
            rootNames: parsedConfig.fileNames,
            options: parsedConfig.options,
        });
        const checker = program.getTypeChecker();
        const violations: string[] = [];

        for (const sourceFile of program.getSourceFiles()) {
            const normalizedPath = sourceFile.fileName.replace(/\\/g, '/');
            if (sourceFile.isDeclarationFile) continue;
            if (!normalizedPath.includes('/src/games/smashup/abilities/') && !normalizedPath.includes('/src/games/smashup/domain/')) {
                continue;
            }

            const visit = (node: ts.Node) => {
                if (isCreateSimpleChoiceCall(node)) {
                    const config = extractSimpleChoiceConfig(node);
                    const optionObjects = collectOptionObjectLiterals(sourceFile, getChoiceOptionsArg(node), node);

                    for (const optionObject of optionObjects) {
                        const valueProp = optionObject.properties.find((prop) =>
                            ts.isPropertyAssignment(prop)
                            && (
                                (ts.isIdentifier(prop.name) && prop.name.text === 'value')
                                || (ts.isStringLiteral(prop.name) && prop.name.text === 'value')
                            ),
                        ) as ts.PropertyAssignment | undefined;

                        if (!valueProp || !ts.isObjectLiteralExpression(valueProp.initializer)) continue;

                        for (const valueChild of valueProp.initializer.properties) {
                            if (!ts.isShorthandPropertyAssignment(valueChild)) continue;
                            const symbol = checker.getSymbolAtLocation(valueChild.name);
                            if (symbol) continue;

                            const line = sourceFile.getLineAndCharacterOfPosition(valueChild.name.getStart(sourceFile)).line + 1;
                            violations.push(
                                `${path.basename(sourceFile.fileName)}:${line} [${config.sourceId}] value shorthand "${valueChild.name.text}" 未解析到已定义变量`,
                            );
                        }
                    }
                }
                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        }

        if (violations.length > 0) {
            console.log('\n=== Interaction value shorthand 未定义变量清单 ===\n');
            violations.forEach(v => console.log(v));
        }

        expect(violations, '以下 createSimpleChoice 选项 value shorthand 指向了未定义变量').toEqual([]);
    });
});

function checkOptionsArray(node: ts.Node, filePath: string, violations: string[]) {
    // 简化检查：只检查明显的 { cardUid: ..., value: { ... } } 模式
    // 如果 value 中有 cardUid/minionUid 但没有对应的 defId，报告违规
    const text = node.getText();

    // 检查模式：value: { cardUid: ..., ... } 但没有 defId
    if (/value:\s*\{[^}]*cardUid[^}]*\}/.test(text) && !/defId/.test(text)) {
        // 排除已知的非卡牌选项（如 skip/done/move 等）
        if (!/skip|done|move|cancel/.test(text)) {
            const fileName = path.basename(filePath);
            const line = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
            violations.push(`${fileName}:${line} — 选项包含 cardUid 但缺少 defId`);
        }
    }

    // 检查模式：value: { minionUid: ..., ... } 但没有 minionDefId
    if (/value:\s*\{[^}]*minionUid[^}]*\}/.test(text) && !/minionDefId/.test(text)) {
        if (!/skip|done|move|cancel/.test(text)) {
            const fileName = path.basename(filePath);
            const line = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
            violations.push(`${fileName}:${line} — 选项包含 minionUid 但缺少 minionDefId`);
        }
    }

    // 检查模式：value: { baseIndex: ..., ... } 但没有 baseDefId
    if (/value:\s*\{[^}]*baseIndex[^}]*\}/.test(text) && !/baseDefId/.test(text)) {
        if (!/skip|done|move|cancel/.test(text)) {
            const fileName = path.basename(filePath);
            const line = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
            violations.push(`${fileName}:${line} — 选项包含 baseIndex 但缺少 baseDefId`);
        }
    }
}
