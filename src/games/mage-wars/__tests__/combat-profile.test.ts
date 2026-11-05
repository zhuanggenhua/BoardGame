import { describe, expect, test } from 'vitest';
import { getMageWarsCombatTraitsFromConfig, getMageWarsSpellCardFromConfig } from '../data/configPackage';
import { ARENA_ZONE_IDS } from '../domain/ids';
import type { MageWarsArenaObjectState, MageWarsCore } from '../domain/types';
import { getMageWarsObjectAttackProfile } from '../domain/spellRules';
import {
    getMageWarsObjectAttackProfiles,
    getMageWarsObjectDefenseProfiles,
    resolveMageWarsAttackLineStatusTokenEffects,
    resolveMageWarsAttackLineManaDrain,
    isMageWarsObjectAttackTargetAllowed,
    parseMageWarsObjectAttackProfiles,
    parseMageWarsObjectDefenseProfiles,
    resolveMageWarsObjectAttackStatusTokenEffects,
    resolveMageWarsObjectAttackManaDrain,
    resolveMageWarsObjectBloodthirstDiceModifier,
    resolveMageWarsObjectMeleeAttackManaTaxSources,
    resolveMageWarsDamageBarrierSource,
} from '../domain/spellRules';

describe('mage-wars structured combat profiles', () => {
    test('exposes configured defense profiles for visible enchantments without display text', () => {
        expect(getMageWarsObjectDefenseProfiles({
            sourceSpellCardId: 1809,
            attackOrTraitLine: undefined,
            combatProfilesSource: 'config',
        })).toEqual([{
            id: 'defense-0',
            index: 0,
            minRoll: 7,
            usesPerRound: 1,
            line: '',
        }]);
        expect(getMageWarsObjectDefenseProfiles({
            sourceSpellCardId: 1818,
            attackOrTraitLine: undefined,
            combatProfilesSource: 'config',
        })).toEqual([{
            id: 'defense-0',
            index: 0,
            minRoll: 8,
            usesPerRound: 1,
            ignoresStatus: true,
            line: '',
        }]);
    });

    test('exposes Inferno Whip reach and burn thresholds from structured config', () => {
        const source = {
            sourceSpellCardId: 3701,
            attackOrTraitLine: undefined,
            combatProfilesSource: 'config' as const,
        };
        const profile = getMageWarsObjectAttackProfile(source, 'attack-0');

        expect(profile).toMatchObject({
            id: 'attack-0',
            attackName: '炽热鞭笞',
            actionKind: 'quick',
            rangeKind: 'melee',
            diceCount: 4,
            damageTypes: ['火焰'],
            reach: true,
        });
        expect(resolveMageWarsObjectAttackStatusTokenEffects(source, 'attack-0', 8)).toEqual([
            { statusTokenId: 'burn', amount: 1 },
        ]);
        expect(resolveMageWarsObjectAttackStatusTokenEffects(source, 'attack-0', 11)).toEqual([
            { statusTokenId: 'burn', amount: 2 },
        ]);
    });

    test('uses reach only to permit same-zone flying targets for melee attacks', () => {
        const ordinaryMelee = getMageWarsObjectAttackProfile({
            sourceSpellCardId: 3704,
            attackOrTraitLine: undefined,
            combatProfilesSource: 'config',
        }, 'attack-0');
        const reachMelee = getMageWarsObjectAttackProfile({
            sourceSpellCardId: 3701,
            attackOrTraitLine: undefined,
            combatProfilesSource: 'config',
        }, 'attack-0');
        const nonFlyingAttacker = {
            kind: 'creature',
            typeLine: '生物',
            statusTokens: {},
        } as MageWarsArenaObjectState;
        const flyingTarget = {
            kind: 'creature',
            typeLine: '生物 / 飞行',
            statusTokens: {},
        } as MageWarsArenaObjectState;

        expect(isMageWarsObjectAttackTargetAllowed(nonFlyingAttacker, ordinaryMelee!, flyingTarget)).toBe(false);
        expect(isMageWarsObjectAttackTargetAllowed(nonFlyingAttacker, reachMelee!, flyingTarget)).toBe(true);
    });

    test('namespaces duplicate defense ids across the base object and multiple attached enchantments', () => {
        const target: MageWarsArenaObjectState = {
            id: 'defense-profile-target',
            kind: 'creature',
            ownerId: '0',
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-card-2906',
            name: '野性山猫',
            zoneId: ARENA_ZONE_IDS.A1,
            life: 4,
            damage: 0,
            armor: 0,
            actionReady: true,
            guarding: false,
            statusTokens: {},
            attackOrTraitLine: '利爪：快速近战 2 骰；防御图标 `8+ / 1x',
        };
        const attachedEnchantment = (
            id: string,
            sourceSpellCardId: number,
        ): MageWarsArenaObjectState => ({
            id,
            kind: 'enchantment',
            ownerId: '0',
            sourceSpellCardId,
            sourceObjectId: `spell-card-${sourceSpellCardId}`,
            combatProfilesSource: 'config',
            name: sourceSpellCardId === 1809 ? '灵蛇反射' : '原力法剑',
            zoneId: ARENA_ZONE_IDS.A1,
            life: 1,
            damage: 0,
            armor: 0,
            actionReady: false,
            guarding: false,
            statusTokens: {},
            revealed: true,
            anchoredToObjectId: target.id,
        });
        const core = {
            objects: {
                [target.id]: target,
                'attached-reflection': attachedEnchantment('attached-reflection', 1809),
                'attached-force-blade': attachedEnchantment('attached-force-blade', 1818),
            },
        } as unknown as MageWarsCore;

        const profiles = getMageWarsObjectDefenseProfiles(target, core);

        expect(profiles.map((profile) => profile.id)).toEqual([
            'defense-0',
            'enchantment-attached-reflection-defense-0',
            'enchantment-attached-force-blade-defense-0',
        ]);
        expect(profiles.map(({ id: _id, index: _index, line: _line, sourceObjectId: _sourceObjectId, ...profile }) => profile)).toEqual([
            { minRoll: 8, usesPerRound: 1 },
            { minRoll: 7, usesPerRound: 1 },
            { minRoll: 8, usesPerRound: 1, ignoresStatus: true },
        ]);
    });

    test('exposes Goran card-level bloodthirst traits from config', () => {
        expect(getMageWarsSpellCardFromConfig(2804)?.combatTraits).toEqual({
            bloodthirst: {
                amount: 1,
                sameZoneMageAmount: 1,
            },
        });
        expect(getMageWarsCombatTraitsFromConfig(2804)).toEqual({
            bloodthirst: {
                amount: 1,
                sameZoneMageAmount: 1,
            },
        });
    });

    test('exposes Suppression Cloak incoming melee mana tax from config', () => {
        expect(getMageWarsSpellCardFromConfig(3705)?.combatTraits).toEqual({
            meleeAttackManaTax: {
                amount: 2,
                oncePerAttackerPerRound: true,
                excludeCounterstrike: true,
            },
        });
        expect(getMageWarsCombatTraitsFromConfig(3705)).toEqual({
            meleeAttackManaTax: {
                amount: 2,
                oncePerAttackerPerRound: true,
                excludeCounterstrike: true,
            },
        });
    });

    test('limits Suppression Cloak to creature melee attacks and excludes counterstrikes', () => {
        const cloak: MageWarsArenaObjectState = {
            id: 'suppression-cloak-source',
            kind: 'equipment',
            ownerId: '1',
            sourceSpellCardId: 3705,
            sourceObjectId: 'spell-card-3705',
            combatTraitsSource: 'config',
            name: '抑制斗篷',
            zoneId: ARENA_ZONE_IDS.A1,
            life: 1,
            damage: 0,
            armor: 0,
            actionReady: false,
            guarding: false,
            statusTokens: {},
            anchoredToPlayerId: '1',
        };
        const creature = { id: 'creature-attacker', kind: 'creature' } as MageWarsArenaObjectState;
        const equipment = { id: 'equipment-attacker', kind: 'equipment' } as MageWarsArenaObjectState;
        const core = {
            turnNumber: 4,
            players: { '1': { id: '1' } },
            objects: { [cloak.id]: cloak },
        } as unknown as MageWarsCore;

        expect(resolveMageWarsObjectMeleeAttackManaTaxSources(
            core,
            creature,
            '1',
            { rangeKind: 'melee' },
        )).toEqual([{ objectId: cloak.id, sourceSpellCardId: 3705, value: 2 }]);
        expect(resolveMageWarsObjectMeleeAttackManaTaxSources(
            core,
            creature,
            '1',
            { rangeKind: 'ranged' },
        )).toEqual([]);
        expect(resolveMageWarsObjectMeleeAttackManaTaxSources(
            core,
            equipment,
            '1',
            { rangeKind: 'melee' },
        )).toEqual([]);
        expect(resolveMageWarsObjectMeleeAttackManaTaxSources(
            core,
            creature,
            '1',
            { rangeKind: 'melee' },
            true,
        )).toEqual([]);
    });

    test('resolves Demon Cuirass barrier from attached equipment without display text', () => {
        const cuirass: MageWarsArenaObjectState = {
            id: 'demon-cuirass-source',
            kind: 'equipment',
            ownerId: '1',
            sourceSpellCardId: 3700,
            sourceObjectId: 'spell-card-3700',
            combatTraitsSource: 'config',
            name: '恶魔胸甲',
            zoneId: ARENA_ZONE_IDS.A1,
            life: 1,
            damage: 0,
            armor: 0,
            actionReady: false,
            guarding: false,
            statusTokens: {},
            anchoredToPlayerId: '1',
        };
        const core = {
            turnNumber: 4,
            players: { '1': { id: '1' } },
            objects: { [cuirass.id]: cuirass },
        } as unknown as MageWarsCore;

        expect(resolveMageWarsDamageBarrierSource(core, '1', 'attacker-1')).toEqual({
            objectId: cuirass.id,
            sourceSpellCardId: 3700,
            diceCount: 1,
            damageTypes: ['aether'],
            unavoidable: true,
            lethal: true,
            oncePerAttackerPerRound: true,
        });
        expect(resolveMageWarsDamageBarrierSource({
            ...core,
            objects: {
                [cuirass.id]: {
                    ...cuirass,
                    damageBarrierRoundNumber: 4,
                    damageBarrierAttackerIdsThisRound: ['attacker-1'],
                },
            },
        }, '1', 'attacker-1')).toBeUndefined();
        expect(resolveMageWarsDamageBarrierSource({
            ...core,
            objects: {},
        }, '1', 'attacker-1')).toBeUndefined();
    });

    test('resolves configured bloodthirst without attack or rules display text', () => {
        const source = {
            sourceSpellCardId: 2804,
            attackOrTraitLine: undefined,
            combatProfilesSource: 'config' as const,
        };
        const object = {
            ownerId: '0',
            sourceSpellCardId: 2804,
            combatProfilesSource: 'config' as const,
            zoneId: ARENA_ZONE_IDS.A1,
            attackOrTraitLine: undefined,
            rulesText: undefined,
        } as MageWarsArenaObjectState;
        const sameZoneCore = {
            players: {
                '0': { mageZoneId: ARENA_ZONE_IDS.A1 },
            },
        } as unknown as MageWarsCore;
        const differentZoneCore = {
            players: {
                '0': { mageZoneId: ARENA_ZONE_IDS.B1 },
            },
        } as unknown as MageWarsCore;
        const target = {
            kind: 'creature' as const,
            damage: 1,
        };
        const attackProfile = getMageWarsObjectAttackProfile(source, 'attack-1');
        const misleadingConfiguredObject = {
            ...object,
            attackOrTraitLine: '嗜血+9',
            rulesText: '同区额外获得嗜血+9。',
        };
        const legacyTextObject = {
            ...object,
            combatProfilesSource: undefined,
            attackOrTraitLine: '嗜血+1',
            rulesText: '当狼人宠物戈伦与其控制方法师位于同一格区域时，其额外获得嗜血+1特性。',
        };

        expect(attackProfile).toBeDefined();
        expect(resolveMageWarsObjectBloodthirstDiceModifier(
            sameZoneCore,
            object,
            attackProfile!,
            target,
            0,
        )).toBe(2);
        expect(resolveMageWarsObjectBloodthirstDiceModifier(
            differentZoneCore,
            object,
            attackProfile!,
            target,
            0,
        )).toBe(1);
        expect(resolveMageWarsObjectBloodthirstDiceModifier(
            sameZoneCore,
            object,
            attackProfile!,
            target,
            1,
        )).toBe(0);
        expect(resolveMageWarsObjectBloodthirstDiceModifier(
            sameZoneCore,
            misleadingConfiguredObject,
            attackProfile!,
            target,
            0,
        )).toBe(2);
        expect(resolveMageWarsObjectBloodthirstDiceModifier(
            sameZoneCore,
            legacyTextObject,
            attackProfile!,
            target,
            0,
        )).toBe(2);
    });

    test('resolves a configured attack from source card id without display text', () => {
        expect(getMageWarsObjectAttackProfile({
            sourceSpellCardId: 2800,
            attackOrTraitLine: undefined,
            combatProfilesSource: 'config',
        }, 'attack-0')).toMatchObject({
            id: 'attack-0',
            attackName: '狱火剑',
            actionKind: 'quick',
            rangeKind: 'melee',
            diceCount: 4,
            pierce: 2,
            strikeCount: 1,
            damageTypes: [],
        });
    });

    test('keeps every configured base profile equivalent to the card field contract parser', () => {
        const configuredCards = [
            2800, 2801, 2802, 2803, 2804, 2807, 2808, 2809, 2810, 2811, 2812, 2813,
            2814, 2816, 2819, 2820, 2822, 2824, 2825, 2826, 2901, 2904, 2906, 2907, 2909, 3701, 3704, 3706,
        ];

        for (const cardId of configuredCards) {
            const card = getMageWarsSpellCardFromConfig(cardId);
            expect(card?.combatProfiles, `missing combat profiles for ${cardId}`).toBeDefined();
            const source = {
                sourceSpellCardId: cardId,
                attackOrTraitLine: card?.attackOrTraitLine,
                combatProfilesSource: 'config' as const,
            };
            const configuredAttacks = getMageWarsObjectAttackProfiles(source);
            const parsedAttacks = parseMageWarsObjectAttackProfiles(card?.attackOrTraitLine);
            expect(configuredAttacks.map(({ line: _line, statusEffects: _statusEffects, manaDrain: _manaDrain, ...profile }) => profile)).toEqual(
                parsedAttacks.map(({ line: _line, ...profile }) => profile),
            );

            const configuredDefenses = getMageWarsObjectDefenseProfiles(source);
            const parsedDefenses = parseMageWarsObjectDefenseProfiles(card?.attackOrTraitLine);
            expect(configuredDefenses.map(({ line: _line, ...profile }) => profile)).toEqual(
                parsedDefenses.map(({ line: _line, ...profile }) => profile),
            );
        }
    });

    test('resolves configured cards without using their display attack text', () => {
        const configuredCards = [
            2800, 2801, 2802, 2803, 2804, 2807, 2808, 2809, 2810, 2811, 2812, 2813,
            2814, 2816, 2819, 2820, 2822, 2824, 2825, 2826, 2901, 2904, 2906, 2907, 2909, 3701, 3704, 3706,
        ];

        for (const cardId of configuredCards) {
            const card = getMageWarsSpellCardFromConfig(cardId);
            const withDisplayText = {
                sourceSpellCardId: cardId,
                attackOrTraitLine: card?.attackOrTraitLine,
                combatProfilesSource: 'config' as const,
            };
            const withoutDisplayText = {
                sourceSpellCardId: cardId,
                attackOrTraitLine: undefined,
                combatProfilesSource: 'config' as const,
            };

            expect(getMageWarsObjectAttackProfiles(withoutDisplayText).map(({ line: _line, ...profile }) => profile))
                .toEqual(getMageWarsObjectAttackProfiles(withDisplayText).map(({ line: _line, ...profile }) => profile));
            expect(getMageWarsObjectDefenseProfiles(withoutDisplayText).map(({ line: _line, ...profile }) => profile))
                .toEqual(getMageWarsObjectDefenseProfiles(withDisplayText).map(({ line: _line, ...profile }) => profile));
        }
    });

    test('resolves a configured single-threshold burn effect without display text', () => {
        const source = {
            sourceSpellCardId: 2801,
            attackOrTraitLine: undefined,
            combatProfilesSource: 'config' as const,
        };

        expect(resolveMageWarsObjectAttackStatusTokenEffects(source, 'attack-0', 8)).toEqual([
            { statusTokenId: 'burn', amount: 1 },
        ]);
        expect(resolveMageWarsObjectAttackStatusTokenEffects(source, 'attack-0', 7)).toEqual([]);
    });

    test('keeps multi-threshold and multi-status effects equivalent to the card field contract', () => {
        const cases = [
            { cardId: 2803, attackProfileId: 'attack-0', die: 10 },
            { cardId: 2803, attackProfileId: 'attack-1', die: 11 },
            { cardId: 2808, attackProfileId: 'attack-0', die: 8 },
            { cardId: 2809, attackProfileId: 'attack-0', die: 7 },
            { cardId: 2810, attackProfileId: 'attack-0', die: 10 },
            { cardId: 2825, attackProfileId: 'attack-0', die: 9 },
            { cardId: 3706, attackProfileId: 'attack-0', die: 5 },
            { cardId: 3706, attackProfileId: 'attack-0', die: 11 },
        ];

        for (const testCase of cases) {
            const card = getMageWarsSpellCardFromConfig(testCase.cardId);
            const source = {
                sourceSpellCardId: testCase.cardId,
                attackOrTraitLine: undefined,
                combatProfilesSource: 'config' as const,
            };
            const displayProfile = parseMageWarsObjectAttackProfiles(card?.attackOrTraitLine)
                .find((profile) => profile.id === testCase.attackProfileId);

            expect(resolveMageWarsObjectAttackStatusTokenEffects(
                source,
                testCase.attackProfileId,
                testCase.die,
            )).toEqual(resolveMageWarsAttackLineStatusTokenEffects(displayProfile?.line, testCase.die));
        }
    });

    test('resolves configured mana drain per attack profile without display text', () => {
        const source = (cardId: number) => ({
            sourceSpellCardId: cardId,
            attackOrTraitLine: undefined,
            combatProfilesSource: 'config' as const,
        });

        expect(resolveMageWarsObjectAttackManaDrain(source(2807), 'attack-0')).toBe(1);
        expect(resolveMageWarsObjectAttackManaDrain(source(2807), 'attack-1')).toBe(2);
        expect(resolveMageWarsObjectAttackManaDrain(source(3704), 'attack-0')).toBe(1);
        expect(resolveMageWarsObjectAttackManaDrain(source(3704), 'attack-1')).toBe(1);
    });

    test('keeps configured mana drain equivalent to the card field contract and text-independent', () => {
        for (const cardId of [2807, 3704]) {
            const card = getMageWarsSpellCardFromConfig(cardId);
            const displaySource = {
                sourceSpellCardId: cardId,
                attackOrTraitLine: card?.attackOrTraitLine,
                combatProfilesSource: 'config' as const,
            };
            const hiddenSource = {
                sourceSpellCardId: cardId,
                attackOrTraitLine: undefined,
                combatProfilesSource: 'config' as const,
            };
            const configuredAttacks = getMageWarsObjectAttackProfiles(displaySource);
            const parsedAttacks = parseMageWarsObjectAttackProfiles(card?.attackOrTraitLine);

            for (const profile of configuredAttacks) {
                const parsedProfile = parsedAttacks.find((candidate) => candidate.id === profile.id);
                expect(resolveMageWarsObjectAttackManaDrain(displaySource, profile.id))
                    .toBe(resolveMageWarsAttackLineManaDrain(parsedProfile?.line));
                expect(resolveMageWarsObjectAttackManaDrain(hiddenSource, profile.id))
                    .toBe(resolveMageWarsObjectAttackManaDrain(displaySource, profile.id));
            }
        }
    });
});
