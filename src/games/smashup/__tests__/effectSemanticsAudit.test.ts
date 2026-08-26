import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import ts from 'typescript';
import { getCardDef } from '../data/cards';

const ABILITIES_DIR = resolve(__dirname, '../abilities');
const DOMAIN_DIR = resolve(__dirname, '../domain');
const TESTS_DIR = resolve(__dirname);

const APPROVED_DIRECT_PROTECTION_IMPORTS: Record<string, string> = {};

const APPROVED_RAW_MINION_ATTACH_CONSTRUCTORS: Record<string, string> = {
    'abilityHelpers.ts': '共享 semantic attach gateway 本体，允许集中构造保护感知后的 ONGOING_ATTACHED 事件。',
};

const APPROVED_RAW_POWER_EVENT_CONSTRUCTORS: Record<string, string> = {
    'abilityHelpers.ts': '共享力量/指示物事件 builder 本体，允许集中构造 power/counter 事件。',
};

const APPROVED_RAW_MINION_MOVE_CONSTRUCTORS: Record<string, string> = {
    'abilityHelpers.ts': '共享移动事件 builder 本体，允许集中构造保护感知前的 MINION_MOVED 事件。',
};

const APPROVED_RAW_MINION_DESTROY_CONSTRUCTORS: Record<string, string> = {
    'abilityHelpers.ts': '共享消灭事件 builder 本体，允许集中构造保护感知前的 MINION_DESTROYED 事件。',
};

const APPROVED_RAW_MINION_RETURN_CONSTRUCTORS: Record<string, string> = {
    'abilityHelpers.ts': '共享回手事件 builder 本体，允许集中构造保护感知前的 MINION_RETURNED 事件。',
    'effectDsl.ts': '共享 effect DSL primitive 本体，允许集中构造 return primitive 事件。',
};

const APPROVED_RAW_MINION_CONTROL_CHANGE_CONSTRUCTORS: Record<string, string> = {
    'abilityHelpers.ts': '共享控制权变更 builder 本体，允许集中构造 MINION_CONTROL_CHANGED 事件。',
};

const APPROVED_RAW_ONGOING_DETACH_CONSTRUCTORS: Record<string, string> = {
    'ongoingDetach.ts': '共享 detach gateway 本体，允许集中构造 ONGOING_DETACHED 事件。',
};

const APPROVED_LEGACY_RETURN_GATEWAY_CALL_SITES: Record<string, number> = {
};

const APPROVED_LEGACY_MOVE_GATEWAY_CALL_SITES: Record<string, number> = {
};

const APPROVED_LEGACY_DESTROY_GATEWAY_CALL_SITES: Record<string, number> = {
};

const APPROVED_LEGACY_DECK_BOTTOM_GATEWAY_CALL_SITES: Record<string, number> = {
};

const APPROVED_DIRECT_MOVE_HELPER_CALL_SITES: Record<string, number> = {
    'effectDsl.ts': 1,
};

const APPROVED_DIRECT_DESTROY_HELPER_CALL_SITES: Record<string, number> = {
};

function getTypeScriptFiles(dir: string): string[] {
    return readdirSync(dir)
        .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
        .map((file) => join(dir, file));
}

function getTypeScriptFilesRecursive(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const filePath = join(dir, entry.name);
        if (entry.isDirectory()) return getTypeScriptFilesRecursive(filePath);
        if (entry.isFile() && entry.name.endsWith('.ts')) return [filePath];
        return [];
    });
}

function getAbilityFiles(): string[] {
    return getTypeScriptFiles(ABILITIES_DIR);
}

function getDomainFiles(): string[] {
    return getTypeScriptFiles(DOMAIN_DIR);
}

function getTestFiles(): string[] {
    return getTypeScriptFilesRecursive(TESTS_DIR);
}

function getPropertyNameText(name: ts.PropertyName): string | undefined {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return name.text;
    }
    return undefined;
}

function objectLiteralHasProperty(objectLiteral: ts.ObjectLiteralExpression, propertyName: string): boolean {
    return objectLiteral.properties.some(property => {
        if (ts.isShorthandPropertyAssignment(property)) {
            return property.name.text === propertyName;
        }
        if (!ts.isPropertyAssignment(property)) {
            return false;
        }
        return getPropertyNameText(property.name) === propertyName;
    });
}

function collectStringLiteralPropertyAssignments(
    content: string,
    fileName: string,
    propertyName: string,
): Array<{ value: string; line: number }> {
    const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
    const matches: Array<{ value: string; line: number }> = [];

    const scan = (node: ts.Node): void => {
        if (
            ts.isPropertyAssignment(node)
            && getPropertyNameText(node.name) === propertyName
            && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
        ) {
            const position = sourceFile.getLineAndCharacterOfPosition(node.initializer.getStart(sourceFile));
            matches.push({ value: node.initializer.text, line: position.line + 1 });
        }
        ts.forEachChild(node, scan);
    };

    scan(sourceFile);
    return matches;
}

function countCallsMissingObjectProperty(content: string, fileName: string, calleeName: string, propertyName: string): number {
    const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
    let count = 0;

    const scan = (node: ts.Node): void => {
        if (
            ts.isCallExpression(node)
            && ts.isIdentifier(node.expression)
            && node.expression.text === calleeName
        ) {
            const paramsArg = node.arguments[1];
            if (!paramsArg || !ts.isObjectLiteralExpression(paramsArg) || !objectLiteralHasProperty(paramsArg, propertyName)) {
                count += 1;
            }
        }
        ts.forEachChild(node, scan);
    };

    scan(sourceFile);
    return count;
}

describe('SmashUp effect semantics 审计', () => {
    it('测试里的 buriedCardDefId 字面量必须来自正式卡牌定义，不能用不存在的假牌绕过规则前置条件', () => {
        const offenders: string[] = [];

        for (const filePath of getTestFiles()) {
            const fileName = filePath.split(/[/\\]__tests__[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            for (const literal of collectStringLiteralPropertyAssignments(content, fileName, 'buriedCardDefId')) {
                if (!getCardDef(literal.value)) {
                    offenders.push(`${fileName}:${literal.line} buriedCardDefId='${literal.value}' 未命中正式卡牌定义`);
                }
            }
        }

        expect(
            offenders,
            `发现测试手写了不存在的埋葬牌定义，可能让 onBuriedCardUncovered / canTrigger 误判：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('业务能力文件不得静默新增直连保护 API 的绕路入口', () => {
        const offenders: string[] = [];

        for (const filePath of getAbilityFiles()) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const hasDirectProtectionImport = /import\s*\{[^}]*\bisMinionProtected(?:NonConsumable)?\b[^}]*\}\s*from\s*['"]\.\.\/domain\/ongoingEffects['"]/.test(content);

            if (!hasDirectProtectionImport) {
                if (fileName in APPROVED_DIRECT_PROTECTION_IMPORTS) {
                    offenders.push(`${fileName} 已不再直连保护 API，但仍留在审计例外名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_DIRECT_PROTECTION_IMPORTS)) {
                offenders.push(`${fileName} 新增或保留了未登记的直连保护 API 导入`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的保护语义绕路入口：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('业务实现不得静默新增手写的随从附着事件绕过 semantic attach gateway', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const hasRawMinionAttachConstructor = /type:\s*SU_EVENTS\.ONGOING_ATTACHED[\s\S]{0,260}?targetType:\s*'minion'/.test(content);

            if (!hasRawMinionAttachConstructor) {
                if (fileName in APPROVED_RAW_MINION_ATTACH_CONSTRUCTORS) {
                    offenders.push(`${fileName} 已不再手写随从附着事件，但仍留在审计例外名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_RAW_MINION_ATTACH_CONSTRUCTORS)) {
                offenders.push(`${fileName} 新增或保留了未登记的手写随从附着事件`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 raw minion attach 绕路入口：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('业务实现不得静默新增手写的力量/指示物事件绕过共享 builder', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const hasRawPowerEventConstructor = /type:\s*SU_EVENTS\.(TEMP_POWER_ADDED|PERMANENT_POWER_ADDED|POWER_COUNTER_ADDED|POWER_COUNTER_REMOVED)/.test(content);

            if (!hasRawPowerEventConstructor) {
                if (fileName in APPROVED_RAW_POWER_EVENT_CONSTRUCTORS) {
                    offenders.push(`${fileName} 已不再手写力量/指示物事件，但仍留在审计例外名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_RAW_POWER_EVENT_CONSTRUCTORS)) {
                offenders.push(`${fileName} 新增或保留了未登记的手写力量/指示物事件`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 raw power/counter 绕路入口：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('业务实现不得静默新增手写的移动事件绕过共享 move gateway', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const hasRawMinionMoveConstructor = /type:\s*SU_EVENTS\.MINION_MOVED/.test(content);

            if (!hasRawMinionMoveConstructor) {
                if (fileName in APPROVED_RAW_MINION_MOVE_CONSTRUCTORS) {
                    offenders.push(`${fileName} 已不再手写移动事件，但仍留在审计例外名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_RAW_MINION_MOVE_CONSTRUCTORS)) {
                offenders.push(`${fileName} 新增或保留了未登记的手写移动事件`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 raw move 绕路入口：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('业务实现不得静默新增手写的消灭事件绕过共享 destroy gateway', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const hasRawMinionDestroyConstructor = /type:\s*SU_EVENTS\.MINION_DESTROYED/.test(content);

            if (!hasRawMinionDestroyConstructor) {
                if (fileName in APPROVED_RAW_MINION_DESTROY_CONSTRUCTORS) {
                    offenders.push(`${fileName} 已不再手写消灭事件，但仍留在审计例外名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_RAW_MINION_DESTROY_CONSTRUCTORS)) {
                offenders.push(`${fileName} 新增或保留了未登记的手写消灭事件`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 raw destroy 绕路入口：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('业务实现不得静默新增手写的回手事件绕过共享 return gateway', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const hasRawMinionReturnConstructor = /type:\s*SU_EVENTS\.MINION_RETURNED/.test(content);

            if (!hasRawMinionReturnConstructor) {
                if (fileName in APPROVED_RAW_MINION_RETURN_CONSTRUCTORS) {
                    offenders.push(`${fileName} 已不再手写回手事件，但仍留在审计例外名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_RAW_MINION_RETURN_CONSTRUCTORS)) {
                offenders.push(`${fileName} 新增或保留了未登记的手写回手事件`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 raw return 绕路入口：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('业务实现不得静默新增手写的控制权变更事件绕过共享 control gateway', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const hasRawControlChangeConstructor = /type:\s*SU_EVENTS\.MINION_CONTROL_CHANGED/.test(content);

            if (!hasRawControlChangeConstructor) {
                if (fileName in APPROVED_RAW_MINION_CONTROL_CHANGE_CONSTRUCTORS) {
                    offenders.push(`${fileName} 已不再手写控制权变更事件，但仍留在审计例外名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_RAW_MINION_CONTROL_CHANGE_CONSTRUCTORS)) {
                offenders.push(`${fileName} 新增或保留了未登记的手写控制权变更事件`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 raw control-change 绕路入口：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('业务实现不得静默新增手写的 detach 事件绕过共享 ongoingDetach gateway', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const hasRawOngoingDetachConstructor = /type:\s*SU_EVENTS\.ONGOING_DETACHED/.test(content);

            if (!hasRawOngoingDetachConstructor) {
                if (fileName in APPROVED_RAW_ONGOING_DETACH_CONSTRUCTORS) {
                    offenders.push(`${fileName} 已不再手写 detach 事件，但仍留在审计例外名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_RAW_ONGOING_DETACH_CONSTRUCTORS)) {
                offenders.push(`${fileName} 新增或保留了未登记的手写 detach 事件`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 raw detach 绕路入口：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('业务实现不得静默新增 direct moveMinion helper 绕过共享 move gateway', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            if (fileName === 'abilityHelpers.ts') continue;

            const content = readFileSync(filePath, 'utf-8');
            const directHelperCount = [...content.matchAll(/\bmoveMinion\s*\(/g)].length;

            if (directHelperCount === 0) {
                if (fileName in APPROVED_DIRECT_MOVE_HELPER_CALL_SITES) {
                    offenders.push(`${fileName} 已不再直连 moveMinion helper，但仍留在审计名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_DIRECT_MOVE_HELPER_CALL_SITES)) {
                offenders.push(`${fileName} 新增了 ${directHelperCount} 处未登记的 direct moveMinion helper 调用`);
                continue;
            }

            const approvedCount = APPROVED_DIRECT_MOVE_HELPER_CALL_SITES[fileName];
            if (directHelperCount !== approvedCount) {
                offenders.push(`${fileName} 当前 direct moveMinion helper 数量为 ${directHelperCount}，与登记值 ${approvedCount} 不一致`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 direct moveMinion helper 绕路入口：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('业务实现不得静默新增 direct destroyMinion helper 绕过共享 destroy gateway', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            if (fileName === 'abilityHelpers.ts') continue;

            const content = readFileSync(filePath, 'utf-8');
            const directHelperCount = [...content.matchAll(/\bdestroyMinion\s*\(/g)].length;

            if (directHelperCount === 0) {
                if (fileName in APPROVED_DIRECT_DESTROY_HELPER_CALL_SITES) {
                    offenders.push(`${fileName} 已不再直连 destroyMinion helper，但仍留在审计名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_DIRECT_DESTROY_HELPER_CALL_SITES)) {
                offenders.push(`${fileName} 新增了 ${directHelperCount} 处未登记的 direct destroyMinion helper 调用`);
                continue;
            }

            const approvedCount = APPROVED_DIRECT_DESTROY_HELPER_CALL_SITES[fileName];
            if (directHelperCount !== approvedCount) {
                offenders.push(`${fileName} 当前 direct destroyMinion helper 数量为 ${directHelperCount}，与登记值 ${approvedCount} 不一致`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 direct destroyMinion helper 绕路入口：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('buildValidatedReturnEvents 的 legacy fallback 调用点必须保持显式登记，不能继续新增无来源语义的回手入口', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const legacyFallbackCount = countCallsMissingObjectProperty(
                content,
                fileName,
                'buildValidatedReturnEvents',
                'sourcePlayerId',
            );

            if (legacyFallbackCount === 0) {
                if (fileName in APPROVED_LEGACY_RETURN_GATEWAY_CALL_SITES) {
                    offenders.push(`${fileName} 已不再使用 legacy return fallback，但仍留在审计名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_LEGACY_RETURN_GATEWAY_CALL_SITES)) {
                offenders.push(`${fileName} 新增了 ${legacyFallbackCount} 处未登记的 legacy return fallback 调用`);
                continue;
            }

            const approvedCount = APPROVED_LEGACY_RETURN_GATEWAY_CALL_SITES[fileName];
            if (legacyFallbackCount !== approvedCount) {
                offenders.push(`${fileName} 当前 legacy return fallback 数量为 ${legacyFallbackCount}，与登记值 ${approvedCount} 不一致`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 legacy return fallback：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('buildValidatedMoveEvents 的 legacy fallback 调用点必须保持显式登记，不能继续新增无来源语义的移动入口', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const legacyFallbackCount = countCallsMissingObjectProperty(
                content,
                fileName,
                'buildValidatedMoveEvents',
                'sourcePlayerId',
            );

            if (legacyFallbackCount === 0) {
                if (fileName in APPROVED_LEGACY_MOVE_GATEWAY_CALL_SITES) {
                    offenders.push(`${fileName} 已不再使用 legacy move fallback，但仍留在审计名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_LEGACY_MOVE_GATEWAY_CALL_SITES)) {
                offenders.push(`${fileName} 新增了 ${legacyFallbackCount} 处未登记的 legacy move fallback 调用`);
                continue;
            }

            const approvedCount = APPROVED_LEGACY_MOVE_GATEWAY_CALL_SITES[fileName];
            if (legacyFallbackCount !== approvedCount) {
                offenders.push(`${fileName} 当前 legacy move fallback 数量为 ${legacyFallbackCount}，与登记值 ${approvedCount} 不一致`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 legacy move fallback：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('buildValidatedDestroyEvents 的 legacy fallback 调用点必须保持显式登记，不能继续新增无来源语义的消灭入口', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const legacyFallbackCount = countCallsMissingObjectProperty(
                content,
                fileName,
                'buildValidatedDestroyEvents',
                'sourcePlayerId',
            );

            if (legacyFallbackCount === 0) {
                if (fileName in APPROVED_LEGACY_DESTROY_GATEWAY_CALL_SITES) {
                    offenders.push(`${fileName} 已不再使用 legacy destroy fallback，但仍留在审计名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_LEGACY_DESTROY_GATEWAY_CALL_SITES)) {
                offenders.push(`${fileName} 新增了 ${legacyFallbackCount} 处未登记的 legacy destroy fallback 调用`);
                continue;
            }

            const approvedCount = APPROVED_LEGACY_DESTROY_GATEWAY_CALL_SITES[fileName];
            if (legacyFallbackCount !== approvedCount) {
                offenders.push(`${fileName} 当前 legacy destroy fallback 数量为 ${legacyFallbackCount}，与登记值 ${approvedCount} 不一致`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 legacy destroy fallback：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('buildValidatedCardToDeckBottomEvents 的 legacy fallback 调用点必须保持显式登记，不能继续新增无来源语义的回牌库底入口', () => {
        const offenders: string[] = [];
        const targetFiles = [...getAbilityFiles(), ...getDomainFiles()];

        for (const filePath of targetFiles) {
            const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
            const content = readFileSync(filePath, 'utf-8');
            const legacyFallbackCount = countCallsMissingObjectProperty(
                content,
                fileName,
                'buildValidatedCardToDeckBottomEvents',
                'sourcePlayerId',
            );

            if (legacyFallbackCount === 0) {
                if (fileName in APPROVED_LEGACY_DECK_BOTTOM_GATEWAY_CALL_SITES) {
                    offenders.push(`${fileName} 已不再使用 legacy deck-bottom fallback，但仍留在审计名单里`);
                }
                continue;
            }

            if (!(fileName in APPROVED_LEGACY_DECK_BOTTOM_GATEWAY_CALL_SITES)) {
                offenders.push(`${fileName} 新增了 ${legacyFallbackCount} 处未登记的 legacy deck-bottom fallback 调用`);
                continue;
            }

            const approvedCount = APPROVED_LEGACY_DECK_BOTTOM_GATEWAY_CALL_SITES[fileName];
            if (legacyFallbackCount !== approvedCount) {
                offenders.push(`${fileName} 当前 legacy deck-bottom fallback 数量为 ${legacyFallbackCount}，与登记值 ${approvedCount} 不一致`);
            }
        }

        expect(
            offenders,
            `发现未登记或过期的 legacy deck-bottom fallback：\n${offenders.join('\n')}`,
        ).toEqual([]);
    });
});
