/**
 * 变体技能槽位匹配测试
 *
 * 覆盖以下修复：
 * 1. buildVariantToBaseIdMap — 从 AbilityDef[] 构建 variantId → baseAbilityId 反向查找表
 * 2. getAbilitySlotId — 支持非前缀变体 ID（如 deadeye-shot-2、focus、blazing-soul）
 * 3. hasDivergentVariants — 分歧型变体判断（effect 类型不同 → 需要玩家选择）
 *
 * 背景：
 * 原来 getAbilitySlotId 用 id.startsWith(`${baseId}-`) 匹配，
 * 导致 deadeye-shot-2、focus、blazing-soul 等非前缀变体 ID 无法匹配到槽位，
 * 技能完全不可选。修复后通过反向查找表精确匹配。
 *
 * 注意：CHARACTER_DATA_MAP[heroId].abilities 只含 Level 1 基础技能。
 * 升级技能（如 COVERT_FIRE_2）是运行时替换注入到 player.abilities 的独立 AbilityDef，
 * 测试中需直接 import 升级技能定义来构建查找表。
 */

import { describe, it, expect } from 'vitest';
import { buildVariantToBaseIdMap, getAbilitySlotId, ABILITY_SLOT_MAP } from '../ui/AbilityOverlays';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import type { AbilityDef } from '../domain/combat/types';
import type { SelectableCharacterId } from '../domain/types';

// 升级技能定义（运行时替换，不在 CHARACTER_DATA_MAP 中）
import { COVERT_FIRE_2, ECLIPSE_2, COVERING_FIRE_2, BLINDING_SHOT_2 } from '../heroes/moon_elf/abilities';
import { BURNING_SOUL_2, HOT_STREAK_2, METEOR_2 } from '../heroes/pyromancer/abilities';
import { PICKPOCKET_2, KIDNEY_SHOT_2 } from '../heroes/shadow_thief/abilities';
import {
    RIGHTEOUS_COMBAT_2,
    RIGHTEOUS_COMBAT_3,
    BLESSING_OF_MIGHT_2,
    RIGHTEOUS_PRAYER_2,
    VENGEANCE_2,
} from '../heroes/paladin/abilities';

// ============================================================================
// 1. buildVariantToBaseIdMap 单元测试
// ============================================================================

describe('buildVariantToBaseIdMap', () => {
    it('基础 ID 映射到自身', () => {
        const abilities: AbilityDef[] = [
            { id: 'covert-fire', type: 'offensive', effects: [] } as unknown as AbilityDef,
        ];
        const map = buildVariantToBaseIdMap(abilities);
        expect(map.get('covert-fire')).toBe('covert-fire');
    });

    it('变体 ID 映射到父技能 base ID', () => {
        const abilities: AbilityDef[] = [
            {
                id: 'covert-fire',
                type: 'offensive',
                effects: [],
                variants: [
                    { id: 'deadeye-shot-2', trigger: { type: 'diceSet', faces: {} }, effects: [], priority: 1 },
                    { id: 'focus', trigger: { type: 'diceSet', faces: {} }, effects: [], priority: 0 },
                ],
            } as unknown as AbilityDef,
        ];
        const map = buildVariantToBaseIdMap(abilities);
        expect(map.get('deadeye-shot-2')).toBe('covert-fire');
        expect(map.get('focus')).toBe('covert-fire');
    });

    it('多个技能各自独立映射', () => {
        const abilities: AbilityDef[] = [
            {
                id: 'soul-burn',
                type: 'offensive',
                effects: [],
                variants: [
                    { id: 'soul-burn-2', trigger: { type: 'diceSet', faces: {} }, effects: [], priority: 0 },
                    { id: 'blazing-soul', trigger: { type: 'diceSet', faces: {} }, effects: [], priority: 1 },
                ],
            } as unknown as AbilityDef,
            {
                id: 'fiery-combo',
                type: 'offensive',
                effects: [],
                variants: [
                    { id: 'fiery-combo-2', trigger: { type: 'smallStraight' }, effects: [], priority: 0 },
                    { id: 'incinerate', trigger: { type: 'diceSet', faces: {} }, effects: [], priority: 1 },
                ],
            } as unknown as AbilityDef,
        ];
        const map = buildVariantToBaseIdMap(abilities);
        expect(map.get('blazing-soul')).toBe('soul-burn');
        expect(map.get('soul-burn-2')).toBe('soul-burn');
        expect(map.get('incinerate')).toBe('fiery-combo');
        expect(map.get('fiery-combo-2')).toBe('fiery-combo');
    });

    it('无变体的技能只映射自身', () => {
        const abilities: AbilityDef[] = [
            { id: 'fireball', type: 'offensive', effects: [] } as unknown as AbilityDef,
        ];
        const map = buildVariantToBaseIdMap(abilities);
        expect(map.get('fireball')).toBe('fireball');
        expect(map.size).toBe(1);
    });
});

// ============================================================================
// 2. getAbilitySlotId 单元测试
// ============================================================================

describe('getAbilitySlotId', () => {
    describe('无查找表时降级到 startsWith 匹配', () => {
        it('base ID 直接匹配', () => {
            expect(getAbilitySlotId('covert-fire')).toBe('chi');
            expect(getAbilitySlotId('soul-burn')).toBe('chi');
            expect(getAbilitySlotId('longbow')).toBe('fist');
        });

        it('前缀变体 ID 匹配（如 longbow-3）', () => {
            expect(getAbilitySlotId('longbow-3')).toBe('fist');
            expect(getAbilitySlotId('longbow-4')).toBe('fist');
            expect(getAbilitySlotId('fireball-3')).toBe('fist');
        });

        it('非前缀变体 ID 无法匹配（已知限制）', () => {
            // 无查找表时，deadeye-shot-2 不以任何 base ID 为前缀，返回 null
            expect(getAbilitySlotId('deadeye-shot-2')).toBeNull();
            expect(getAbilitySlotId('blazing-soul')).toBeNull();
            expect(getAbilitySlotId('focus')).toBeNull();
        });
    });

    describe('有查找表时精确匹配', () => {
        // 月精灵升级技能：COVERT_FIRE_2 含 deadeye-shot-2 / focus
        it('月精灵：deadeye-shot-2 → chi 槽', () => {
            const map = buildVariantToBaseIdMap([COVERT_FIRE_2]);
            expect(getAbilitySlotId('deadeye-shot-2', map)).toBe('chi');
        });

        it('月精灵：focus → chi 槽', () => {
            const map = buildVariantToBaseIdMap([COVERT_FIRE_2]);
            expect(getAbilitySlotId('focus', map)).toBe('chi');
        });

        // ECLIPSE_2 含 dark-moon
        it('月精灵：dark-moon → lotus 槽', () => {
            const map = buildVariantToBaseIdMap([ECLIPSE_2]);
            expect(getAbilitySlotId('dark-moon', map)).toBe('lotus');
        });

        // COVERING_FIRE_2 含 silencing-trace
        it('月精灵：silencing-trace → combo 槽', () => {
            const map = buildVariantToBaseIdMap([COVERING_FIRE_2]);
            expect(getAbilitySlotId('silencing-trace', map)).toBe('combo');
        });

        // BLINDING_SHOT_2 含 moons-blessing
        it('月精灵：moons-blessing → calm 槽', () => {
            const map = buildVariantToBaseIdMap([BLINDING_SHOT_2]);
            expect(getAbilitySlotId('moons-blessing', map)).toBe('calm');
        });

        // 火法师升级技能：BURNING_SOUL_2 含 blazing-soul
        it('火法师：blazing-soul → chi 槽', () => {
            const map = buildVariantToBaseIdMap([BURNING_SOUL_2]);
            expect(getAbilitySlotId('blazing-soul', map)).toBe('chi');
        });

        // HOT_STREAK_2 含 incinerate
        it('火法师：incinerate → sky 槽', () => {
            const map = buildVariantToBaseIdMap([HOT_STREAK_2]);
            expect(getAbilitySlotId('incinerate', map)).toBe('sky');
        });

        // METEOR_2 含 meteor-shower
        it('火法师：meteor-shower → lotus 槽', () => {
            const map = buildVariantToBaseIdMap([METEOR_2]);
            expect(getAbilitySlotId('meteor-shower', map)).toBe('lotus');
        });

        // 暗影盗贼升级技能：PICKPOCKET_2 含 shadow-assault
        it('暗影盗贼：shadow-assault → chi 槽', () => {
            const map = buildVariantToBaseIdMap([PICKPOCKET_2]);
            expect(getAbilitySlotId('shadow-assault', map)).toBe('chi');
        });

        // KIDNEY_SHOT_2 含 piercing-attack
        it('暗影盗贼：piercing-attack → lightning 槽', () => {
            const map = buildVariantToBaseIdMap([KIDNEY_SHOT_2]);
            expect(getAbilitySlotId('piercing-attack', map)).toBe('lightning');
        });

        // 圣骑士升级技能：RIGHTEOUS_COMBAT_2 无变体（已修正数据录入错误）
        // RIGHTEOUS_COMBAT_3 含 righteous-combat-3-tenacity
        it('圣骑士：righteous-combat-3-tenacity → combo 槽', () => {
            const map = buildVariantToBaseIdMap([RIGHTEOUS_COMBAT_3]);
            expect(getAbilitySlotId('righteous-combat-3-tenacity', map)).toBe('combo');
        });

        // BLESSING_OF_MIGHT_2 含 blessing-of-might-2-stance
        it('圣骑士：blessing-of-might-2-stance → lightning 槽', () => {
            const map = buildVariantToBaseIdMap([BLESSING_OF_MIGHT_2]);
            expect(getAbilitySlotId('blessing-of-might-2-stance', map)).toBe('lightning');
        });

        // RIGHTEOUS_PRAYER_2 含 righteous-prayer-2-prosperity
        it('圣骑士：righteous-prayer-2-prosperity → lotus 槽', () => {
            const map = buildVariantToBaseIdMap([RIGHTEOUS_PRAYER_2]);
            expect(getAbilitySlotId('righteous-prayer-2-prosperity', map)).toBe('lotus');
        });

        // VENGEANCE_2 含 vengeance-2-mix
        it('圣骑士：vengeance-2-mix → chi 槽', () => {
            const map = buildVariantToBaseIdMap([VENGEANCE_2]);
            expect(getAbilitySlotId('vengeance-2-mix', map)).toBe('chi');
        });
    });

    describe('查找表不含该 ID 时降级到 startsWith', () => {
        it('查找表中不存在的 ID 仍能通过 startsWith 匹配', () => {
            const emptyMap = new Map<string, string>();
            // longbow-3 通过 startsWith('longbow-') 匹配
            expect(getAbilitySlotId('longbow-3', emptyMap)).toBe('fist');
        });
    });
});

// ============================================================================
// 3. 全英雄变体 ID 覆盖性测试
// ============================================================================

describe('全英雄变体 ID 槽位覆盖性', () => {
    const HEROES: SelectableCharacterId[] = [
        'monk', 'barbarian', 'paladin', 'pyromancer', 'moon_elf', 'shadow_thief',
    ];

    // 每个英雄的所有升级技能（运行时替换，不在 CHARACTER_DATA_MAP 中）
    const UPGRADE_ABILITIES: Record<string, AbilityDef[]> = {
        moon_elf: [COVERT_FIRE_2, ECLIPSE_2, COVERING_FIRE_2, BLINDING_SHOT_2],
        pyromancer: [BURNING_SOUL_2, HOT_STREAK_2, METEOR_2],
        shadow_thief: [PICKPOCKET_2, KIDNEY_SHOT_2],
        paladin: [RIGHTEOUS_COMBAT_2, RIGHTEOUS_COMBAT_3, BLESSING_OF_MIGHT_2, RIGHTEOUS_PRAYER_2, VENGEANCE_2],
        monk: [],
        barbarian: [],
    };

    it('所有英雄的所有变体 ID（含升级技能）都能通过查找表找到对应槽位', () => {
        const missing: string[] = [];

        for (const heroId of HEROES) {
            const baseAbilities = CHARACTER_DATA_MAP[heroId].abilities as AbilityDef[];
            const upgradeAbilities = UPGRADE_ABILITIES[heroId] ?? [];
            const allAbilities = [...baseAbilities, ...upgradeAbilities];
            const map = buildVariantToBaseIdMap(allAbilities);

            for (const ability of allAbilities) {
                if (!ability.variants?.length) continue;
                for (const variant of ability.variants) {
                    const slotId = getAbilitySlotId(variant.id, map);
                    if (!slotId) {
                        missing.push(`${heroId}: variant "${variant.id}" (parent: "${ability.id}") → no slot`);
                    }
                }
            }
        }

        expect(missing).toEqual([]);
    });

    it('所有英雄的 base ability ID（含升级技能）都能找到对应槽位', () => {
        // 防御技能（defensive）不在 ABILITY_SLOT_MAP 中，排除
        const missing: string[] = [];

        for (const heroId of HEROES) {
            const baseAbilities = CHARACTER_DATA_MAP[heroId].abilities as AbilityDef[];
            const upgradeAbilities = UPGRADE_ABILITIES[heroId] ?? [];
            const allAbilities = [...baseAbilities, ...upgradeAbilities];
            const map = buildVariantToBaseIdMap(allAbilities);

            for (const ability of allAbilities) {
                if (ability.type === 'defensive') continue;
                const slotId = getAbilitySlotId(ability.id, map);
                if (!slotId) {
                    missing.push(`${heroId}: ability "${ability.id}" → no slot`);
                }
            }
        }

        expect(missing).toEqual([]);
    });
});

// ============================================================================
// 4. ABILITY_SLOT_MAP 完整性测试
// ============================================================================

describe('ABILITY_SLOT_MAP 完整性', () => {
    it('每个槽位都有 labelKey 和非空 ids 数组', () => {
        for (const [slotId, mapping] of Object.entries(ABILITY_SLOT_MAP)) {
            expect(mapping.labelKey, `${slotId} 缺少 labelKey`).toBeTruthy();
            expect(mapping.ids.length, `${slotId} ids 为空`).toBeGreaterThan(0);
        }
    });

    it('ids 数组中没有重复的 base ID', () => {
        const allIds: string[] = [];
        for (const mapping of Object.values(ABILITY_SLOT_MAP)) {
            allIds.push(...mapping.ids);
        }
        const unique = new Set(allIds);
        expect(unique.size).toBe(allIds.length);
    });
});
