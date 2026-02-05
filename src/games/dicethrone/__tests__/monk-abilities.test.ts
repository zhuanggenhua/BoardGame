
import { describe, it, expect } from 'vitest';
import { MONK_ABILITIES } from '../monk/abilities';

describe('Monk abilities 定义校验', () => {
    it('基础技能 ID 不重复且包含必要字段', () => {
        const ids = MONK_ABILITIES.map(ability => ability.id);
        expect(new Set(ids).size).toBe(ids.length);

        for (const ability of MONK_ABILITIES) {
            expect(typeof ability.name).toBe('string');
            expect(typeof ability.description).toBe('string');
            expect(['offensive', 'defensive']).toContain(ability.type);
        }
    });

    it('变体/触发配置完整', () => {
        for (const ability of MONK_ABILITIES) {
            if (ability.variants?.length) {
                for (const variant of ability.variants) {
                    expect(typeof variant.id).toBe('string');
                    expect(variant.trigger).toBeDefined();
                    expect(Array.isArray(variant.effects)).toBe(true);
                    expect(variant.effects?.length ?? 0).toBeGreaterThan(0);
                }
            } else {
                expect(ability.trigger).toBeDefined();
                expect(Array.isArray(ability.effects)).toBe(true);
                expect(ability.effects?.length ?? 0).toBeGreaterThan(0);
            }
        }
    });

    it('关键技能配置正确', () => {
        const transcendence = MONK_ABILITIES.find(ability => ability.id === 'transcendence');
        expect(transcendence?.type).toBe('offensive');
        expect(transcendence?.tags).toContain('ultimate');

        const meditation = MONK_ABILITIES.find(ability => ability.id === 'meditation');
        expect(meditation?.type).toBe('defensive');
        expect(meditation?.trigger?.type).toBe('phase');
        expect(meditation?.trigger && 'phaseId' in meditation.trigger ? meditation.trigger.phaseId : undefined).toBe('defensiveRoll');
    });
});
