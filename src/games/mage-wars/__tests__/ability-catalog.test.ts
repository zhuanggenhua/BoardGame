import { describe, expect, test } from 'vitest';
import { materializeMageWarsConfigPackage } from '../data/configPackage';
import {
    buildMageWarsConfigAbilityCatalog,
    getMageWarsSpellAbilityDef,
    getMageWarsSpellAbilityId,
    mageWarsAbilityRegistry,
    mageWarsObjectAbilityRegistry,
    summarizeMageWarsAbilityGaps,
} from '../domain/abilityCatalog';
import { MAGE_WARS_OBJECT_ABILITY_EXECUTION_TAG, mageWarsObjectAbilityExecutorRegistry } from '../domain/objectAbilityRuntime';
import {
    MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
    mageWarsSpellAbilityExecutorRegistry,
} from '../domain/spellAbilityExecutors';
import { MAGE_WARS_OBJECT_ABILITY_IDS } from '../domain/ids';

describe('mage-wars ability catalog', () => {
    test('registers every current arena object ability with an executor', () => {
        const objectAbilityIds = Object.values(MAGE_WARS_OBJECT_ABILITY_IDS);

        expect(mageWarsObjectAbilityRegistry.size).toBe(objectAbilityIds.length);

        for (const abilityId of objectAbilityIds) {
            const ability = mageWarsObjectAbilityRegistry.get(abilityId);
            expect(ability).toBeDefined();
            expect(ability).toMatchObject({
                id: abilityId,
                trigger: 'arena-object-ability',
                meta: {
                    abilityId,
                    implementationStatus: 'implemented',
                },
            });
            expect(ability?.meta.sourceKind).toMatch(/^(creature|attached-equipment)$/);
            expect(ability?.meta.sourceSpellCardId).toEqual(expect.any(Number));
            expect(ability?.meta.actionSpeed).toMatch(/^(quick|normal|source-trait)$/);
            expect(ability?.meta.actionCost).toMatch(/^(normal|none)$/);
            expect(ability?.effects[0]).toMatchObject({ type: 'object-ability-runtime' });
            expect(mageWarsObjectAbilityExecutorRegistry.has(abilityId, MAGE_WARS_OBJECT_ABILITY_EXECUTION_TAG)).toBe(true);
        }
    });

    test('registers every apprentice spell as a stable ability id', () => {
        const materialized = materializeMageWarsConfigPackage();
        const spellObjects = materialized.package.objects.filter((object) => object.tags?.includes('apprentice-spell'));

        expect(spellObjects).toHaveLength(91);
        expect(mageWarsAbilityRegistry.size).toBe(91);

        for (const object of spellObjects) {
            const cardId = object.data?.cardId;
            expect(typeof cardId).toBe('number');
            const ability = getMageWarsSpellAbilityDef(cardId as number);
            expect(ability).toMatchObject({
                id: getMageWarsSpellAbilityId(cardId as number),
                name: object.name,
                trigger: 'spell-cast',
                meta: {
                    objectId: object.id,
                    cardId,
                    spellType: object.data?.spellType,
                    sourceContract: object.data?.sourceContract,
                },
            });
        }
    });

    test('keeps preset spell ability catalog and executors aligned for future mage expansion', () => {
        const abilityCatalog = buildMageWarsConfigAbilityCatalog();
        const registeredAbilityIds = Array.from(mageWarsAbilityRegistry.getRegisteredIds()).sort();

        expect(Object.keys(abilityCatalog).sort()).toEqual(registeredAbilityIds);
        for (const abilityId of registeredAbilityIds) {
            expect(mageWarsSpellAbilityExecutorRegistry.has(
                abilityId,
                MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
            )).toBe(true);
        }

        expect(mageWarsAbilityRegistry.getByTag('implementation:needs-code').map((def) => def.id)).toEqual([
            getMageWarsSpellAbilityId(1804),
        ]);
    });

    test('tracks implemented apprentice spell effects separately from code gaps', () => {
        const summary = summarizeMageWarsAbilityGaps();

        expect(summary).toEqual({
            total: 91,
            implemented: 90,
            needsCode: 1,
            bySpellType: {
                '攻击': { total: 10, implemented: 10, needsCode: 0 },
                '结界': { total: 24, implemented: 23, needsCode: 1 },
                '魔物': { total: 1, implemented: 1, needsCode: 0 },
                '生物': { total: 24, implemented: 24, needsCode: 0 },
                '咒语': { total: 18, implemented: 18, needsCode: 0 },
                '装备': { total: 14, implemented: 14, needsCode: 0 },
            },
        });

        const minorHeal = getMageWarsSpellAbilityDef(3402);
        expect(minorHeal?.effects).toEqual([]);
        expect(minorHeal?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        const groupHeal = getMageWarsSpellAbilityDef(3405);
        expect(groupHeal?.effects).toEqual([]);
        expect(groupHeal?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        const fireball = getMageWarsSpellAbilityDef(1700);
        expect(fireball?.effects).toEqual([]);
        expect(fireball?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:攻击',
            'implementation:implemented',
        ]));

        const intermittentJet = getMageWarsSpellAbilityDef(1710);
        expect(intermittentJet?.effects).toEqual([]);
        expect(intermittentJet?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:攻击',
            'implementation:implemented',
        ]));

        const pillarOfLight = getMageWarsSpellAbilityDef(1706);
        expect(pillarOfLight?.effects).toEqual([]);
        expect(pillarOfLight?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:攻击',
            'implementation:implemented',
        ]));

        const dazzlingFlash = getMageWarsSpellAbilityDef(1709);
        expect(dazzlingFlash?.effects).toEqual([]);
        expect(dazzlingFlash?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:攻击',
            'implementation:implemented',
        ]));

        const flameblast = getMageWarsSpellAbilityDef(1702);
        expect(flameblast?.effects).toEqual([]);
        expect(flameblast?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:攻击',
            'implementation:implemented',
        ]));

        const lightningRing = getMageWarsSpellAbilityDef(1704);
        expect(lightningRing?.effects).toEqual([]);
        expect(lightningRing?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:攻击',
            'implementation:implemented',
        ]));

        const lightningBolt = getMageWarsSpellAbilityDef(1705);
        expect(lightningBolt?.effects).toEqual([]);
        expect(lightningBolt?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:攻击',
            'implementation:implemented',
        ]));

        const lifeDrain = getMageWarsSpellAbilityDef(3400);
        expect(lifeDrain?.effects).toEqual([]);
        expect(lifeDrain?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        const explode = getMageWarsSpellAbilityDef(3401);
        expect(explode?.effects).toEqual([]);
        expect(explode?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        const chainLightning = getMageWarsSpellAbilityDef(1703);
        expect(chainLightning?.effects).toEqual([]);
        expect(chainLightning?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:攻击',
            'implementation:implemented',
        ]));

        const jetStream = getMageWarsSpellAbilityDef(1711);
        expect(jetStream?.effects).toEqual([]);
        expect(jetStream?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:攻击',
            'implementation:implemented',
        ]));
        const teleport = getMageWarsSpellAbilityDef(3410);
        expect(teleport?.effects).toEqual([]);
        expect(teleport?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));
        const timberWolf = getMageWarsSpellAbilityDef(2819);
        expect(timberWolf?.effects).toEqual([]);
        expect(timberWolf?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:生物',
            'implementation:implemented',
        ]));
        const skeletonSentry = getMageWarsSpellAbilityDef(2826);
        expect(skeletonSentry?.effects).toEqual([]);
        expect(skeletonSentry?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:生物',
            'implementation:implemented',
        ]));
        const royalArcher = getMageWarsSpellAbilityDef(2816);
        expect(royalArcher?.effects).toEqual([]);
        expect(royalArcher?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:生物',
            'implementation:implemented',
        ]));
        const emeraldTegu = getMageWarsSpellAbilityDef(2808);
        expect(emeraldTegu?.effects).toEqual([]);
        expect(emeraldTegu?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:生物',
            'implementation:implemented',
        ]));

        for (const implementedCreatureCardId of [2800, 2801, 2802, 2803, 2804, 2807, 2809, 2810, 2811, 2812, 2813, 2814, 2824, 2901, 2906, 2907, 2909]) {
            const implementedCreature = getMageWarsSpellAbilityDef(implementedCreatureCardId);
            expect(implementedCreature?.effects).toEqual([]);
            expect(implementedCreature?.tags).toEqual(expect.arrayContaining([
                'apprentice-spell',
                'spell-type:生物',
                'implementation:implemented',
            ]));
        }

        const blueGremlin = getMageWarsSpellAbilityDef(2822);
        expect(blueGremlin?.effects).toEqual([]);
        expect(blueGremlin?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:生物',
            'implementation:implemented',
        ]));

        const thunderiftFalcon = getMageWarsSpellAbilityDef(2820);
        expect(thunderiftFalcon?.effects).toEqual([]);
        expect(thunderiftFalcon?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:生物',
            'implementation:implemented',
        ]));

        const darkfenneBat = getMageWarsSpellAbilityDef(2825);
        expect(darkfenneBat?.effects).toEqual([]);
        expect(darkfenneBat?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:生物',
            'implementation:implemented',
        ]));

        const tanglevine = getMageWarsSpellAbilityDef(2224);
        expect(tanglevine?.effects).toEqual([]);
        expect(tanglevine?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:魔物',
            'implementation:implemented',
        ]));

        const singleHeal = getMageWarsSpellAbilityDef(3408);
        expect(singleHeal?.effects).toEqual([]);
        expect(singleHeal?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        for (const forcePushCardId of [3425, 3523]) {
            const forcePush = getMageWarsSpellAbilityDef(forcePushCardId);
            expect(forcePush?.effects).toEqual([]);
            expect(forcePush?.tags).toEqual(expect.arrayContaining([
                'apprentice-spell',
                'spell-type:咒语',
                'implementation:implemented',
            ]));
        }

        const sleep = getMageWarsSpellAbilityDef(3411);
        expect(sleep?.effects).toEqual([]);
        expect(sleep?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        const chargeOn = getMageWarsSpellAbilityDef(3407);
        expect(chargeOn?.effects).toEqual([]);
        expect(chargeOn?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        const bloodstrike = getMageWarsSpellAbilityDef(3404);
        expect(bloodstrike?.effects).toEqual([]);
        expect(bloodstrike?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        const callOfTheWild = getMageWarsSpellAbilityDef(3417);
        expect(callOfTheWild?.effects).toEqual([]);
        expect(callOfTheWild?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        const rouseTheBeast = getMageWarsSpellAbilityDef(3403);
        expect(rouseTheBeast?.effects).toEqual([]);
        expect(rouseTheBeast?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        for (const dissolveCardId of [3406, 3605]) {
            const dissolve = getMageWarsSpellAbilityDef(dissolveCardId);
            expect(dissolve?.effects).toEqual([]);
            expect(dissolve?.tags).toEqual(expect.arrayContaining([
                'apprentice-spell',
                'spell-type:咒语',
                'implementation:implemented',
            ]));
        }

        for (const dispelCardId of [3419, 3606]) {
            const dispel = getMageWarsSpellAbilityDef(dispelCardId);
            expect(dispel?.effects).toEqual([]);
            expect(dispel?.tags).toEqual(expect.arrayContaining([
                'apprentice-spell',
                'spell-type:咒语',
                'implementation:implemented',
            ]));
        }

        const stealEnchantment = getMageWarsSpellAbilityDef(3409);
        expect(stealEnchantment?.effects).toEqual([]);
        expect(stealEnchantment?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:咒语',
            'implementation:implemented',
        ]));

        for (const implementedEnchantmentCardId of [1800, 1801, 1806, 1808, 1809, 1815, 1816, 1818, 1820, 1825, 1826, 1901, 1904, 1908, 1910, 1914, 1916, 1917]) {
            const implementedEnchantment = getMageWarsSpellAbilityDef(implementedEnchantmentCardId);
            expect(implementedEnchantment?.effects).toEqual([]);
            expect(implementedEnchantment?.tags).toEqual(expect.arrayContaining([
                'apprentice-spell',
                'spell-type:结界',
                'implementation:implemented',
            ]));
        }

        for (const passiveArmorEquipmentCardId of [3702, 3703, 3708, 3709, 3711, 3721]) {
            const passiveArmorEquipment = getMageWarsSpellAbilityDef(passiveArmorEquipmentCardId);
            expect(passiveArmorEquipment?.effects).toEqual([]);
            expect(passiveArmorEquipment?.tags).toEqual(expect.arrayContaining([
                'apprentice-spell',
                'spell-type:装备',
                'implementation:implemented',
            ]));
        }
        for (const weaponEquipmentCardId of [3701, 3704, 3706]) {
            const weaponEquipment = getMageWarsSpellAbilityDef(weaponEquipmentCardId);
            expect(weaponEquipment?.effects).toEqual([]);
            expect(weaponEquipment?.tags).toEqual(expect.arrayContaining([
                'apprentice-spell',
                'spell-type:装备',
                'implementation:implemented',
            ]));
        }
        const offsetBracers = getMageWarsSpellAbilityDef(3715);
        expect(offsetBracers?.effects).toEqual([]);
        expect(offsetBracers?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:装备',
            'implementation:implemented',
        ]));
        const suppressionCloak = getMageWarsSpellAbilityDef(3705);
        expect(suppressionCloak?.effects).toEqual([]);
        expect(suppressionCloak?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:装备',
            'implementation:implemented',
        ]));
        const elementalStaff = getMageWarsSpellAbilityDef(3716);
        expect(elementalStaff?.effects).toEqual([]);
        expect(elementalStaff?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:装备',
            'implementation:implemented',
        ]));
        expect(getMageWarsSpellAbilityDef(3701)?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:装备',
            'implementation:implemented',
        ]));
        expect(getMageWarsSpellAbilityDef(1804)?.tags).toEqual(expect.arrayContaining([
            'apprentice-spell',
            'spell-type:结界',
            'implementation:needs-code',
        ]));
    });

    test('exposes a GameConfig-compatible ability catalog for later validation', () => {
        const abilityCatalog = buildMageWarsConfigAbilityCatalog();
        const ids = Object.keys(abilityCatalog);

        expect(ids).toHaveLength(91);
        expect(abilityCatalog[getMageWarsSpellAbilityId(3402)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3402),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3405)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3405),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3408)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3408),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1710)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1710),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1706)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1706),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1709)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1709),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1702)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1702),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1704)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1704),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1705)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1705),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3400)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3400),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3401)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3401),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1703)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1703),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1711)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1711),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3410)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3410),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(2816)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(2816),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(2808)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(2808),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        for (const implementedCreatureCardId of [2800, 2801, 2802, 2803, 2804, 2807, 2809, 2810, 2811, 2812, 2813, 2814, 2824, 2901, 2906, 2907, 2909]) {
            expect(abilityCatalog[getMageWarsSpellAbilityId(implementedCreatureCardId)]).toEqual({
                abilityId: getMageWarsSpellAbilityId(implementedCreatureCardId),
                implementationStatus: 'implemented',
                allowExtraParams: true,
            });
        }
        expect(abilityCatalog[getMageWarsSpellAbilityId(2819)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(2819),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(2822)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(2822),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(2820)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(2820),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(2825)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(2825),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(2826)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(2826),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(2224)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(2224),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3425)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3425),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3523)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3523),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3411)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3411),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3407)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3407),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3404)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3404),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3417)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3417),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(3403)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3403),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        for (const dissolveCardId of [3406, 3605]) {
            expect(abilityCatalog[getMageWarsSpellAbilityId(dissolveCardId)]).toEqual({
                abilityId: getMageWarsSpellAbilityId(dissolveCardId),
                implementationStatus: 'implemented',
                allowExtraParams: true,
            });
        }
        for (const dispelCardId of [3419, 3606]) {
            expect(abilityCatalog[getMageWarsSpellAbilityId(dispelCardId)]).toEqual({
                abilityId: getMageWarsSpellAbilityId(dispelCardId),
                implementationStatus: 'implemented',
                allowExtraParams: true,
            });
        }
        expect(abilityCatalog[getMageWarsSpellAbilityId(3409)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3409),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        for (const implementedEnchantmentCardId of [1800, 1801, 1806, 1808, 1809, 1813, 1815, 1816, 1818, 1820, 1826, 1910, 1911, 1914, 1916, 1917]) {
            expect(abilityCatalog[getMageWarsSpellAbilityId(implementedEnchantmentCardId)]).toEqual({
                abilityId: getMageWarsSpellAbilityId(implementedEnchantmentCardId),
                implementationStatus: 'implemented',
                allowExtraParams: true,
            });
        }
        for (const passiveArmorEquipmentCardId of [3702, 3703, 3708, 3709, 3711, 3721]) {
            expect(abilityCatalog[getMageWarsSpellAbilityId(passiveArmorEquipmentCardId)]).toEqual({
                abilityId: getMageWarsSpellAbilityId(passiveArmorEquipmentCardId),
                implementationStatus: 'implemented',
                allowExtraParams: true,
            });
        }
        for (const weaponEquipmentCardId of [3701, 3704, 3706]) {
            expect(abilityCatalog[getMageWarsSpellAbilityId(weaponEquipmentCardId)]).toEqual({
                abilityId: getMageWarsSpellAbilityId(weaponEquipmentCardId),
                implementationStatus: 'implemented',
                allowExtraParams: true,
            });
        }
        expect(abilityCatalog[getMageWarsSpellAbilityId(3701)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(3701),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1813)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1813),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1911)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1911),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
        expect(abilityCatalog[getMageWarsSpellAbilityId(1913)]).toEqual({
            abilityId: getMageWarsSpellAbilityId(1913),
            implementationStatus: 'implemented',
            allowExtraParams: true,
        });
    });
});

