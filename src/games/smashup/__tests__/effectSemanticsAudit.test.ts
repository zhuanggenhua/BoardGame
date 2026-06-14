import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const ABILITIES_DIR = resolve(__dirname, '../abilities');
const DOMAIN_DIR = resolve(__dirname, '../domain');

const APPROVED_DIRECT_PROTECTION_IMPORTS: Record<string, string> = {
    'elder_things.ts': '仍在 protection checker 内表达“不可消耗的消灭保护”，尚未迁到统一 selector/gateway。',
    'kaiju.ts': '仍在保护注册与高风险摧毁前置过滤里直接复用 legacy seam，待后续继续收口。',
    'killer_plants.ts': '仍在 protection checker 内表达 entangled/deep roots 这类持续保护语义，尚未迁到统一 selector/gateway。',
};

const APPROVED_RAW_MINION_ATTACH_CONSTRUCTORS: Record<string, string> = {
    'abilityHelpers.ts': '共享 semantic attach gateway 本体，允许集中构造保护感知后的 ONGOING_ATTACHED 事件。',
};

const APPROVED_RAW_POWER_EVENT_CONSTRUCTORS: Record<string, string> = {
    'abilityHelpers.ts': '共享力量/指示物事件 builder 本体，允许集中构造 power/counter 事件。',
};

function getTypeScriptFiles(dir: string): string[] {
    return readdirSync(dir)
        .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
        .map((file) => join(dir, file));
}

function getAbilityFiles(): string[] {
    return getTypeScriptFiles(ABILITIES_DIR);
}

function getDomainFiles(): string[] {
    return getTypeScriptFiles(DOMAIN_DIR);
}

describe('SmashUp effect semantics 审计', () => {
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
});
