import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearPowerModifierRegistry, getModifierExceptionAuditSnapshot } from '../domain/ongoingModifiers';

const ABILITIES_DIR = resolve(__dirname, '../abilities');

const APPROVED_LEGACY_SELF_MANAGED_POWER_MODIFIERS: readonly string[] = [];

function getAbilityFiles(): string[] {
    return readdirSync(ABILITIES_DIR)
        .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
        .map((file) => join(ABILITIES_DIR, file));
}

beforeAll(() => {
    clearPowerModifierRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('SmashUp ongoing modifier legacy 例外审计', () => {
    it('业务持续修正里的 selfManaged 例外必须显式登记审计标签', () => {
        let selfManagedCount = 0;
        let taggedCount = 0;

        for (const filePath of getAbilityFiles()) {
            const content = readFileSync(filePath, 'utf-8');
            selfManagedCount += (content.match(/podStrategy:\s*'selfManaged'/g) ?? []).length;
            taggedCount += (content.match(/exceptionAuditTag:\s*'legacySelfManaged'/g) ?? []).length;
        }

        expect(taggedCount).toBe(selfManagedCount);
    });

    it('legacy selfManaged 持续修正例外名单必须保持显式且受审计', () => {
        const snapshot = getModifierExceptionAuditSnapshot();

        expect(snapshot.powerModifierIds).toEqual([...APPROVED_LEGACY_SELF_MANAGED_POWER_MODIFIERS]);
        expect(snapshot.breakpointModifierIds).toEqual([]);
        expect(snapshot.basePowerModifierIds).toEqual([]);
    });
});
