import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadGameConfigPackageFromText } from '../../../game-config';
import {
    APPRENTICE_MAGE_ORDER,
    APPRENTICE_MAGE_SETUP,
    APPRENTICE_SPELLBOOKS,
    getApprenticeSpellbookCount,
} from '../domain/data/apprenticeSpellbooks';
import {
    STANDARD_STARTING_MAGE_ORDER,
    STANDARD_STARTING_SPELLBOOKS,
    getStandardStartingSpellbookCount,
} from '../domain/data/standardStartingSpellbooks';
import {
    MAGE_WARS_CONFIG_PACKAGE,
    MAGE_WARS_CONFIG_SOURCE_ID,
    buildMageWarsConfigReviewTable,
    getApprenticeArenaZonesFromConfig,
    getApprenticeStartingDeploymentFromConfig,
    getApprenticeStartingZoneIdFromConfig,
    getFormalArenaZonesFromConfig,
    getFormalStartingDeploymentFromConfig,
    getFormalStartingZoneIdFromConfig,
    getPresetMageOrderFromConfig,
    getPresetMageSetupFromConfig,
    getPresetSpellbookCardIdsFromConfig,
    getPresetSpellbookCountFromConfig,
    getPresetSpellbookEntriesFromConfig,
    hasPresetSpellbookCardInConfig,
    materializeMageWarsConfigPackage,
    requireMageWarsCombatProfilesFromConfig,
    requireMageWarsSpellCardFromConfig,
    requireMageWarsStatusTokenFromConfig,
} from '../data/configPackage';
import { ARENA_ZONE_IDS, STATUS_TOKEN_IDS } from '../domain/ids';
import { isMageWarsImplementedVisibleEnchantmentSpell } from '../domain/spellRules';

const configPath = path.join(process.cwd(), MAGE_WARS_CONFIG_SOURCE_ID);

describe('mage-wars config package', () => {
    test('loads as strict JSON and materializes one-source review rows', () => {
        const text = readFileSync(configPath, 'utf8');
        const materialized = loadGameConfigPackageFromText(text, {
            sourceId: MAGE_WARS_CONFIG_SOURCE_ID,
        });
        const reviewTable = buildMageWarsConfigReviewTable();

        expect(materialized.package.gameId).toBe('mage-wars');
        expect(materialized.package.packageVersion).toBe(MAGE_WARS_CONFIG_PACKAGE.packageVersion);
        expect(materialized.package.metadata?.description).toContain('4x3 标准竞技场');
        expect(materialized.package.metadata?.description).not.toContain('2x3 竞技场');
        expect(reviewTable.source?.sourceId).toBe(MAGE_WARS_CONFIG_SOURCE_ID);
        expect(reviewTable.rows).toHaveLength(materialized.package.objects.length);
    });

    test('covers preset mage resources, spell cards, standard zones, legacy zones, dice, and tokens', () => {
        const materialized = materializeMageWarsConfigPackage();
        const objects = materialized.package.objects;
        const byType = (objectType: string) => objects.filter((object) => object.objectType === objectType);

        expect(byType('mage')).toHaveLength(4);
        expect(byType('card')).toHaveLength(157);
        expect(byType('card').filter((object) => object.tags?.includes('standard-starting-spell'))).toHaveLength(153);
        expect(byType('card').filter((object) => object.tags?.includes('apprentice-spell'))).toHaveLength(91);
        expect(byType('board-zone')).toHaveLength(18);
        expect(byType('board-zone').filter((object) => object.tags?.includes('apprentice-2x3'))).toHaveLength(6);
        expect(byType('board-zone').filter((object) => object.tags?.includes('formal-4x3'))).toHaveLength(12);
        expect(byType('die')).toHaveLength(2);
        expect(byType('token')).toHaveLength(20);
        expect(materialized.assetsById.get('weak-token')).toMatchObject({
            kind: 'status-token',
            path: 'mage-wars/tokens/status/weak-token',
        });
        expect(materialized.assetsById.get('cripple-token')).toMatchObject({
            kind: 'status-token',
            path: 'mage-wars/tokens/status/cripple-token',
        });
        expect(materialized.objectsById.get('token-weak-token')?.assetRefs).toContain('weak-token');
        expect(materialized.objectsById.get('token-cripple-token')?.assetRefs).toContain('cripple-token');
    });

    test('loads Beast Staff ability fields from structured configuration', () => {
        const card = requireMageWarsSpellCardFromConfig(3710);

        expect(card).toMatchObject({
            requiresCodeSupport: false,
            combatProfiles: {
                attacks: [expect.objectContaining({
                    id: 'attack-0',
                    action: 'quick',
                    rangeKind: 'melee',
                    diceCount: 4,
                })],
            },
            combatTraits: {
                beastStaff: {
                    abilityId: 'mw.equipment.3710.beast-staff',
                    requiredMageId: 'beastmaster_apprentice',
                    manaCost: 2,
                    oncePerRound: true,
                    actionSpeed: 'quick',
                    range: { min: 0, max: 1 },
                    meleeDiceModifier: 2,
                    healingDiceCount: 2,
                },
            },
        });
    });

    test('loads Elemental Staff as an implemented binding equipment', () => {
        expect(requireMageWarsSpellCardFromConfig(3716)).toMatchObject({
            spellType: '装备',
            requiresCodeSupport: false,
            spellActionSpeed: 'quick',
            tags: expect.arrayContaining(['standard-starting-spell', 'apprentice-spell', '装备']),
        });
    });

    test('keeps preset mage stats aligned with the existing setup source', () => {
        const materialized = materializeMageWarsConfigPackage();

        for (const mageId of APPRENTICE_MAGE_ORDER) {
            const setup = APPRENTICE_MAGE_SETUP[mageId];
            const object = materialized.objectsById.get(`mage-${mageId}`);

            expect(object?.name).toBe(setup.displayName);
            expect(object?.stats).toMatchObject({
                startingLife: setup.startingLife,
                startingMana: setup.startingMana,
                channeling: setup.channeling,
                baseMeleeDice: setup.baseMeleeDice,
            });
        }
    });

    test('keeps configured legacy apprentice spellbooks aligned with the existing TypeScript source', () => {
        const materialized = materializeMageWarsConfigPackage();

        for (const mageId of APPRENTICE_MAGE_ORDER) {
            const deck = materialized.decksById.get(`spellbook-${mageId}`);
            const sourceEntries = APPRENTICE_SPELLBOOKS[mageId];

            expect(deck).toBeDefined();
            expect(deck?.entries.reduce((total, entry) => total + entry.count, 0)).toBe(getApprenticeSpellbookCount(mageId));
            expect(deck?.entries).toHaveLength(sourceEntries.length);

            sourceEntries.forEach((sourceEntry, index) => {
                const entry = deck?.entries[index];
                expect(entry).toEqual({
                    objectId: `spell-${sourceEntry.workshopCardIds[0]}`,
                    count: sourceEntry.quantity,
                });
                expect(materialized.objectsById.has(entry!.objectId)).toBe(true);
            });
        }
    });

    test('keeps configured standard starting spellbooks aligned with the page-40 TypeScript source', () => {
        const materialized = materializeMageWarsConfigPackage();

        for (const mageId of STANDARD_STARTING_MAGE_ORDER) {
            const deck = materialized.decksById.get(`spellbook-${mageId}_standard_starting`);
            const sourceEntries = STANDARD_STARTING_SPELLBOOKS[mageId];

            expect(deck).toBeDefined();
            expect(deck?.data?.spellbookKind).toBe('standard-starting');
            expect(deck?.entries.reduce((total, entry) => total + entry.count, 0)).toBe(getStandardStartingSpellbookCount(mageId));
            expect(deck?.entries).toHaveLength(sourceEntries.length);

            sourceEntries.forEach((sourceEntry, index) => {
                const entry = deck?.entries[index];
                expect(entry).toEqual({
                    objectId: `spell-${sourceEntry.workshopCardIds[0]}`,
                    count: sourceEntry.quantity,
                });
                expect(materialized.objectsById.has(entry!.objectId)).toBe(true);
            });
        }

        expect(materialized.decksById.get('spellbook-beastmaster_apprentice_standard_starting')?.entries)
            .toContainEqual({ objectId: 'spell-25700', count: 2 });
        expect(materialized.decksById.get('spellbook-warlock_apprentice_standard_starting')?.entries)
            .toContainEqual({ objectId: 'spell-2500', count: 2 });
        expect(materialized.decksById.get('spellbook-beastmaster_apprentice_standard_starting')?.entries)
            .not.toContainEqual({ objectId: 'spell-3407', count: 1 });
    });

    test('exposes runtime-safe preset setup and standard starting spellbook queries from the config package', () => {
        expect(getPresetMageOrderFromConfig()).toEqual(STANDARD_STARTING_MAGE_ORDER);

        for (const mageId of STANDARD_STARTING_MAGE_ORDER) {
            const sourceSetup = APPRENTICE_MAGE_SETUP[mageId];
            expect(getPresetMageSetupFromConfig(mageId)).toEqual({
                mageId,
                displayName: sourceSetup.displayName,
                startingLife: sourceSetup.startingLife,
                startingMana: sourceSetup.startingMana,
                channeling: sourceSetup.channeling,
                baseMeleeDice: sourceSetup.baseMeleeDice,
            });

            const configuredEntries = getPresetSpellbookEntriesFromConfig(mageId);
            const sourceEntries = STANDARD_STARTING_SPELLBOOKS[mageId];
            expect(configuredEntries).toHaveLength(sourceEntries.length);
            expect(getPresetSpellbookCountFromConfig(mageId)).toBe(getStandardStartingSpellbookCount(mageId));
            expect(getPresetSpellbookCardIdsFromConfig(mageId)).toHaveLength(getStandardStartingSpellbookCount(mageId));

            for (const sourceEntry of sourceEntries) {
                expect(hasPresetSpellbookCardInConfig(mageId, sourceEntry.workshopCardIds[0])).toBe(true);
            }
        }

        expect(hasPresetSpellbookCardInConfig(STANDARD_STARTING_MAGE_ORDER[0], 25700)).toBe(true);
        expect(hasPresetSpellbookCardInConfig(STANDARD_STARTING_MAGE_ORDER[2], 2500)).toBe(true);
        expect(hasPresetSpellbookCardInConfig(STANDARD_STARTING_MAGE_ORDER[0], 3407)).toBe(false);
        expect(hasPresetSpellbookCardInConfig(STANDARD_STARTING_MAGE_ORDER[0], 999999)).toBe(false);
    });

    test('keeps legacy tutorial two-player diagonal deployment query separate from formal runtime setup', () => {
        const deployment = getApprenticeStartingDeploymentFromConfig();

        expect(deployment).toEqual([
            {
                seatIndex: 0,
                objectId: `mage-${APPRENTICE_MAGE_ORDER[0]}`,
                owner: 'seat-0',
                locationObjectId: 'zone-a1',
                zoneId: ARENA_ZONE_IDS.A1,
                defaultMageId: APPRENTICE_MAGE_ORDER[0],
            },
            {
                seatIndex: 1,
                objectId: `mage-${APPRENTICE_MAGE_ORDER[1]}`,
                owner: 'seat-1',
                locationObjectId: 'zone-b3',
                zoneId: ARENA_ZONE_IDS.B3,
                defaultMageId: APPRENTICE_MAGE_ORDER[1],
            },
        ]);
        expect(new Set(deployment.map((entry) => entry.seatIndex)).size).toBe(2);
        expect(getApprenticeStartingZoneIdFromConfig(0)).toBe(ARENA_ZONE_IDS.A1);
        expect(getApprenticeStartingZoneIdFromConfig(1)).toBe(ARENA_ZONE_IDS.B3);
    });

    test('keeps legacy tutorial arena zone layout as 2 columns by 3 rows', () => {
        expect(getApprenticeArenaZonesFromConfig()).toEqual([
            {
                objectId: 'zone-a1',
                name: '学徒竞技场 A1',
                zoneId: ARENA_ZONE_IDS.A1,
                rowIndex: 0,
                colIndex: 0,
            },
            {
                objectId: 'zone-b1',
                name: '学徒竞技场 B1',
                zoneId: ARENA_ZONE_IDS.B1,
                rowIndex: 0,
                colIndex: 1,
            },
            {
                objectId: 'zone-a2',
                name: '学徒竞技场 A2',
                zoneId: ARENA_ZONE_IDS.A2,
                rowIndex: 1,
                colIndex: 0,
            },
            {
                objectId: 'zone-b2',
                name: '学徒竞技场 B2',
                zoneId: ARENA_ZONE_IDS.B2,
                rowIndex: 1,
                colIndex: 1,
            },
            {
                objectId: 'zone-a3',
                name: '学徒竞技场 A3',
                zoneId: ARENA_ZONE_IDS.A3,
                rowIndex: 2,
                colIndex: 0,
            },
            {
                objectId: 'zone-b3',
                name: '学徒竞技场 B3',
                zoneId: ARENA_ZONE_IDS.B3,
                rowIndex: 2,
                colIndex: 1,
            },
        ]);
    });

    test('exposes formal runtime setup and diagonal standard arena deployment from the config package', () => {
        expect(MAGE_WARS_CONFIG_PACKAGE.setup?.data).not.toHaveProperty('arenaMode');

        const deployment = getFormalStartingDeploymentFromConfig();
        expect(deployment).toEqual([
            {
                seatIndex: 0,
                objectId: `mage-${APPRENTICE_MAGE_ORDER[0]}`,
                owner: 'seat-0',
                locationObjectId: 'formal-zone-a3',
                zoneId: ARENA_ZONE_IDS.A3,
                defaultMageId: APPRENTICE_MAGE_ORDER[0],
            },
            {
                seatIndex: 1,
                objectId: `mage-${APPRENTICE_MAGE_ORDER[1]}`,
                owner: 'seat-1',
                locationObjectId: 'formal-zone-d1',
                zoneId: ARENA_ZONE_IDS.D1,
                defaultMageId: APPRENTICE_MAGE_ORDER[1],
            },
        ]);
        expect(getFormalStartingZoneIdFromConfig(0)).toBe(ARENA_ZONE_IDS.A3);
        expect(getFormalStartingZoneIdFromConfig(1)).toBe(ARENA_ZONE_IDS.D1);
        expect(getFormalArenaZonesFromConfig().map((zone) => zone.zoneId)).toEqual([
            ARENA_ZONE_IDS.A1,
            ARENA_ZONE_IDS.B1,
            ARENA_ZONE_IDS.C1,
            ARENA_ZONE_IDS.D1,
            ARENA_ZONE_IDS.A2,
            ARENA_ZONE_IDS.B2,
            ARENA_ZONE_IDS.C2,
            ARENA_ZONE_IDS.D2,
            ARENA_ZONE_IDS.A3,
            ARENA_ZONE_IDS.B3,
            ARENA_ZONE_IDS.C3,
            ARENA_ZONE_IDS.D3,
        ]);
    });

    test('maps landed standard starting spell cards to official atlas frames and keeps missing atlas explicit', () => {
        const materialized = materializeMageWarsConfigPackage();
        const missingRuntimeAtlasCardIds = [2303, 3800, 3801, 3802, 3803];
        const standardSpellObjects = materialized.package.objects
            .filter((object) => object.tags?.includes('standard-starting-spell'));
        const missingAtlasObjects: number[] = [];

        expect(standardSpellObjects).toHaveLength(153);
        for (const object of standardSpellObjects) {
            const cardId = object.data?.cardId;
            expect(typeof cardId).toBe('number');

            if (object.data?.assetStatus === 'blocked-missing-runtime-atlas') {
                missingAtlasObjects.push(cardId as number);
                expect(object.assetRefs ?? []).not.toContain(`spell-card-${cardId}-frame`);
                continue;
            }

            expect(object.assetRefs).toContain(`spell-card-${cardId}-frame`);
            const frameAsset = materialized.assetsById.get(`spell-card-${cardId}-frame`);
            expect(frameAsset?.kind).toBe('atlas-frame');
            expect(frameAsset?.path).not.toContain('temp/mage-wars');
        }

        expect(missingAtlasObjects.sort((left, right) => left - right)).toEqual(missingRuntimeAtlasCardIds);

        const legacySpellObjects = materialized.package.objects.filter((object) => object.tags?.includes('apprentice-spell'));

        expect(legacySpellObjects).toHaveLength(91);
        for (const object of legacySpellObjects) {
            const cardId = object.data?.cardId;
            expect(typeof cardId).toBe('number');
            expect(object.assetRefs).toContain(`spell-card-${cardId}-frame`);
            const frameAsset = materialized.assetsById.get(`spell-card-${cardId}-frame`);
            expect(frameAsset?.kind).toBe('atlas-frame');
            expect(frameAsset?.path).toBe(`atlas://public/assets/atlas-configs/mage-wars/apprentice-spell-atlases.json#${cardId}`);
            expect(frameAsset?.path).not.toContain('temp/mage-wars');
        }
    });

    test('maps first-batch spellcasting source cards to existing official atlas frames', () => {
        const materialized = materializeMageWarsConfigPackage();

        for (const [cardId, name] of [[2218, '巢穴'], [2908, '乌鸦魔宠胡金']] as const) {
            const object = materialized.objectsById.get(`spell-${cardId}`);
            expect(object?.name).toBe(name);
            expect(object?.assetRefs).toContain(`spell-card-${cardId}-frame`);
            expect(materialized.assetsById.get(`spell-card-${cardId}-frame`)).toMatchObject({
                kind: 'atlas-frame',
                path: `atlas://public/assets/atlas-configs/mage-wars/apprentice-spell-atlases.json#${cardId}`,
            });
        }

        expect(materialized.objectsById.get('spell-2905')?.assetRefs).toBeUndefined();
        expect(materialized.objectsById.get('spell-3017')?.assetRefs).toBeUndefined();
    });

    test('keeps legacy action-speed contract and validates landed standard spell speeds', () => {
        const materialized = materializeMageWarsConfigPackage();
        const speedByCardId = new Map(
            materialized.package.objects
                .filter((object) => object.objectType === 'card' && object.tags?.includes('apprentice-spell') === true)
                .map((object) => [object.data?.cardId, object.data?.spellActionSpeed]),
        );
        const standardSpeedEntries = materialized.package.objects
            .filter((object) => object.objectType === 'card' && object.tags?.includes('standard-starting-spell') === true)
            .map((object) => [object.data?.cardId, object.data?.spellActionSpeed] as const)
            .filter(([, speed]) => speed !== undefined);
        const standardSpellCardIds = [
            1701, 1703, 1704, 1709,
            2800, 2801, 2802, 2803, 2804, 2807, 2808, 2809, 2810, 2811, 2812,
            2813, 2814, 2816, 2819, 2820, 2822, 2824, 2825, 2826,
            2901, 2906, 2907, 2909,
            3405, 3409,
        ];

        expect(speedByCardId.size).toBe(91);
        expect([...speedByCardId.values()].every((speed) => speed === 'quick' || speed === 'standard')).toBe(true);
        expect([...speedByCardId.values()].filter((speed) => speed === 'quick')).toHaveLength(61);
        expect([...speedByCardId.entries()]
            .filter(([, speed]) => speed === 'standard')
            .map(([spellCardId]) => spellCardId)
            .sort((left, right) => Number(left) - Number(right))).toEqual(standardSpellCardIds);
        expect(requireMageWarsSpellCardFromConfig(1710).spellActionSpeed).toBe('quick');
        expect(requireMageWarsSpellCardFromConfig(1806).spellActionSpeed).toBe('quick');
        expect(requireMageWarsSpellCardFromConfig(2224).spellActionSpeed).toBe('quick');
        expect(requireMageWarsSpellCardFromConfig(2800).spellActionSpeed).toBe('standard');
        expect(requireMageWarsSpellCardFromConfig(3400).spellActionSpeed).toBe('quick');
        expect(requireMageWarsSpellCardFromConfig(3402).spellActionSpeed).toBe('quick');
        expect(requireMageWarsSpellCardFromConfig(3405).spellActionSpeed).toBe('standard');
        expect(requireMageWarsSpellCardFromConfig(3408).spellActionSpeed).toBe('quick');
        expect(requireMageWarsSpellCardFromConfig(3409).spellActionSpeed).toBe('standard');
        expect(requireMageWarsSpellCardFromConfig(3605).spellActionSpeed).toBe('quick');
        expect(requireMageWarsSpellCardFromConfig(3700).spellActionSpeed).toBe('quick');
        expect(standardSpeedEntries.length).toBeGreaterThan(0);
        expect(standardSpeedEntries.every(([, speed]) => speed === 'quick' || speed === 'standard')).toBe(true);
        expect(requireMageWarsSpellCardFromConfig(2500).spellActionSpeed).toBe('quick');
        expect(requireMageWarsSpellCardFromConfig(25700).spellActionSpeed).toBe('quick');
        expect(requireMageWarsSpellCardFromConfig(2500).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(25700).requiresCodeSupport).toBe(false);
    });

    test('exposes machine-readable semantics for implemented visible object enchantments', () => {
        const visibleObjectEnchantmentSemantics = {
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: undefined,
            unsupportedRules: undefined,
        };

        expect(requireMageWarsSpellCardFromConfig(1806).combatProfiles).toEqual({
            attacks: [],
            defenses: [{
                id: 'defense-0',
                minRoll: 1,
                usesPerRound: 1,
                resolution: 'automatic-evade',
                consumesSource: true,
            }],
        });
        expect(requireMageWarsSpellCardFromConfig(1806).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(1806).semantics).toEqual(visibleObjectEnchantmentSemantics);
        expect(requireMageWarsSpellCardFromConfig(1809).semantics).toEqual(visibleObjectEnchantmentSemantics);
        expect(requireMageWarsSpellCardFromConfig(1818).semantics).toEqual(visibleObjectEnchantmentSemantics);
        expect(isMageWarsImplementedVisibleEnchantmentSpell({
            ...requireMageWarsSpellCardFromConfig(1806),
            spellCardId: 999001,
        })).toBe(true);
        expect(requireMageWarsSpellCardFromConfig(1808).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: [
                { stat: 'life', operation: 'add', value: 4 },
            ],
            grants: undefined,
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1816).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: [
                { trait: 'slow', value: undefined },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1903).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: [
                { trait: 'counterstrike', value: undefined },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1903).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(1908).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: [
                { trait: 'restrained', value: undefined },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1908).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(1820).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: undefined,
            upkeepEffects: [
                { kind: 'direct-damage', amount: 2, damageType: '毒素' },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1820).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(1815).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: undefined,
            upkeepEffects: [
                { kind: 'mana-cost', amount: 2 },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1815).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(1801).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: undefined,
            upkeepEffects: [
                { kind: 'heal-controller-mage-transfer-damage', maxHealing: 2 },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1801).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(1826).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: [
                { trait: 'death-mark', value: 1 },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1826).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(1910).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: [
                { trait: 'vampiric', value: undefined },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1910).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(1912).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: [
                { trait: 'mental-calm', value: 2 },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1912).requiresCodeSupport).toBe(false);
        for (const aegisSpellCardId of [1813, 1911]) {
            expect(requireMageWarsSpellCardFromConfig(aegisSpellCardId).semantics).toEqual({
                abilityKind: 'visible-object-enchantment',
                attachment: {
                    kind: 'enchantment',
                    visibility: 'revealed',
                    anchor: 'object',
                },
                continuousModifiers: undefined,
                grants: [
                    { trait: 'aegis', value: 1 },
                ],
                unsupportedRules: undefined,
            });
            expect(requireMageWarsSpellCardFromConfig(aegisSpellCardId).requiresCodeSupport).toBe(false);
        }
        expect(requireMageWarsSpellCardFromConfig(1913).semantics).toEqual({
            abilityKind: 'visible-area-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'zone',
            },
            continuousModifiers: undefined,
            grants: [
                { trait: 'aegis', value: 1 },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1913).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(1914).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: [
                { stat: 'meleeDice', operation: 'add', value: 2 },
            ],
            grants: undefined,
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1916).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: undefined,
            grants: [
                { trait: 'regeneration', value: 2 },
            ],
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(1917).semantics).toEqual({
            abilityKind: 'visible-object-enchantment',
            attachment: {
                kind: 'enchantment',
                visibility: 'revealed',
                anchor: 'object',
            },
            continuousModifiers: [
                { stat: 'armor', operation: 'add', value: 2 },
            ],
            grants: undefined,
            unsupportedRules: undefined,
        });
        expect(requireMageWarsSpellCardFromConfig(3715).combatProfiles).toEqual({
            attacks: [],
            defenses: [{
                id: 'defense-0',
                minRoll: 7,
                usesPerRound: 1,
            }],
        });
        expect(requireMageWarsSpellCardFromConfig(3715).requiresCodeSupport).toBe(false);
        expect(requireMageWarsSpellCardFromConfig(3705).combatTraits).toEqual({
            meleeAttackManaTax: {
                amount: 2,
                oncePerAttackerPerRound: true,
                excludeCounterstrike: true,
            },
        });
        expect(requireMageWarsSpellCardFromConfig(3705).requiresCodeSupport).toBe(false);
    });

    test('exposes Demon Cuirass damage barrier from structured config', () => {
        expect(requireMageWarsSpellCardFromConfig(3700).combatTraits).toEqual({
            damageBarrier: {
                diceCount: 1,
                damageTypes: ['aether'],
                unavoidable: true,
                lethal: true,
                oncePerAttackerPerRound: true,
            },
        });
        expect(requireMageWarsSpellCardFromConfig(3700).requiresCodeSupport).toBe(false);
    });

    test('exposes a structured base attack profile for configured creatures', () => {
        expect(requireMageWarsCombatProfilesFromConfig(2800)).toEqual({
            attacks: [{
                id: 'attack-0',
                name: '狱火剑',
                action: 'quick',
                rangeKind: 'melee',
                diceCount: 4,
                pierce: 2,
                strikeCount: 1,
                damageTypes: [],
            }],
            defenses: [],
        });
    });

    test('exposes rule-book status token removal costs without creating a direct removal action', () => {
        const materialized = materializeMageWarsConfigPackage();

        expect(requireMageWarsStatusTokenFromConfig(STATUS_TOKEN_IDS.BURN)).toMatchObject({
            objectId: 'token-burn-token',
            statusTokenId: STATUS_TOKEN_IDS.BURN,
            removalCost: 2,
            removalCostRule: 'fixed',
            sameNameRemovalRule: 'pay-all-copies',
            upkeepRule: 'roll-one-attack-die-per-token-and-remove-token-on-blank',
        });
        expect(requireMageWarsStatusTokenFromConfig(STATUS_TOKEN_IDS.DAZE)).toMatchObject({
            removalCost: 2,
            removalCostRule: 'fixed',
            automaticRemovalTiming: 'creature-action-end-remove-all',
            defenseDiePenaltyPerToken: -2,
        });
        expect(requireMageWarsStatusTokenFromConfig(STATUS_TOKEN_IDS.ROT)).toMatchObject({
            removalCost: 2,
            removalCostRule: 'fixed',
            statusType: 'toxin',
            upkeepRule: 'deal-1-direct-damage',
        });
        expect(requireMageWarsStatusTokenFromConfig(STATUS_TOKEN_IDS.WEAK)).toMatchObject({
            removalCost: 2,
            removalCostRule: 'fixed',
            statusType: 'toxin',
        });
        expect(requireMageWarsStatusTokenFromConfig(STATUS_TOKEN_IDS.CRIPPLE)).toMatchObject({
            removalCost: 4,
            removalCostRule: 'fixed',
            statusType: 'toxin',
            escapeCheckMin: 7,
            escapeCheckTiming: 'creature-action-end',
            restrainedDefenseDiePenalty: -2,
        });
        expect(requireMageWarsStatusTokenFromConfig(STATUS_TOKEN_IDS.SLEEP)).toMatchObject({
            removalCost: undefined,
            removalCostRule: 'target-creature-level',
            automaticReplacementRule: 'replace-with-daze-when-damaged',
        });
        expect(requireMageWarsStatusTokenFromConfig(STATUS_TOKEN_IDS.STUN)).toMatchObject({
            removalCost: 4,
            removalCostRule: 'fixed',
            automaticRemovalTiming: 'creature-action-end-remove-all',
            paralyzeRule: 'cannot-act-counterstrike-or-defend',
        });

        expect(materialized.objectsById.get('token-guard-token')?.data).toEqual({
            statusMarkerRole: 'guard-marker',
            removalCostRule: 'none',
        });
        expect(materialized.objectsById.get('token-guard-token')?.data?.statusTokenId).toBeUndefined();
        expect(materialized.objectsById.get('token-guard-token')?.data?.removalCost).toBeUndefined();
    });
});
