import { describe, expect, it } from 'vitest';
import type { Command, MatchState } from '../../../engine/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import { reduceEvent } from '../domain/reducer';
import { getMageWarsSpellCardFromConfig } from '../data/configPackage';
import { MAGE_WARS_COMMANDS } from '../domain';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { resolveMageWarsMageEquipmentArmor } from '../domain/damageRules';
import {
    getMageWarsObjectDefenseProfiles,
    getMageWarsObjectAttackProfile,
    isMageWarsElusiveArenaObject,
    isMageWarsFlyingArenaObject,
    isMageWarsLimitedLifeArenaObject,
    isMageWarsSlowArenaObject,
    isMageWarsSwiftArenaObject,
    resolveMageWarsObjectEffectiveArmor,
    resolveMageWarsObjectEffectiveLife,
    resolveMageWarsObjectRegeneration,
} from '../domain/spellRules';
import type { MageWarsCore } from '../domain/types';
import {
    castObjectSpellCommand,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeArenaObject,
    makeVisibleEnchantmentObject,
    PLAYER_ZERO_START_ZONE,
    planCommand,
    runCommand,
    setupState,
    withPlayerInZone,
    withPlayerMage,
    withArenaObject,
    withPreparedPlayerMage,
    validateCommand,
} from './helpers/domainFlowHarness';
import { ARENA_ZONE_IDS, MAGE_IDS, MAGE_WARS_OBJECT_ABILITY_IDS, STATUS_TOKEN_IDS } from '../domain/ids';

describe('mage-wars standard starting spellbook implementation batch', () => {
    it('implements 1900 Mongoose Agility as a revealed elusive enchantment with auditable text', () => {
        const target = makeArenaObject('mongoose-agility-target-0', '0', PLAYER_ZERO_START_ZONE);
        const base = setupState('initiativeQuickcast');
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [1900]),
                target,
            ),
            sys: base.sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(1900, 5, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === 1900);

        expect(cast.success).toBe(true);
        expect(enchantment).toMatchObject({
            revealed: true,
            anchoredToObjectId: target.id,
            rulesText: '本生物获得遁逸特性。',
        });
        expect(isMageWarsElusiveArenaObject(cast.state.core.objects[target.id], cast.state.core)).toBe(true);
    });

    it('implements 1902 Toxic Blood as limited life and preserves attachment ordering', () => {
        const target = makeArenaObject('toxic-blood-target-0', '0', PLAYER_ZERO_START_ZONE, { life: 10 });
        const base = setupState('initiativeQuickcast');
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [1902]),
                target,
            ),
            sys: base.sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(1902, 5, target.id));
        const limitedLifeEnchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === 1902);

        expect(cast.success).toBe(true);
        expect(limitedLifeEnchantment).toMatchObject({
            revealed: true,
            anchoredToObjectId: target.id,
            rulesText: '本生物获得有限生命特性。',
        });
        expect(isMageWarsLimitedLifeArenaObject(cast.state.core, cast.state.core.objects[target.id])).toBe(true);

        const laterLifeBonus = makeVisibleEnchantmentObject(
            'toxic-blood-later-life-bonus',
            '0',
            PLAYER_ZERO_START_ZONE,
            {
                sourceSpellCardId: 1808,
                sourceObjectId: 'spell-card-1808',
                name: '公牛耐力',
                anchoredToObjectId: target.id,
                createdAtSequence: (limitedLifeEnchantment?.createdAtSequence ?? 0) + 1,
            },
        );
        const orderedCore = withArenaObject(cast.state.core, laterLifeBonus);
        expect(resolveMageWarsObjectEffectiveLife(orderedCore, orderedCore.objects[target.id])).toBe(10);
    });

    it('implements 1915 Cheetah Speed as a revealed swift enchantment with auditable text', () => {
        const target = makeArenaObject('cheetah-speed-target-0', '0', PLAYER_ZERO_START_ZONE);
        const base = setupState('initiativeQuickcast');
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [1915]),
                target,
            ),
            sys: base.sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(1915, 5, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === 1915);

        expect(cast.success).toBe(true);
        expect(enchantment).toMatchObject({
            revealed: true,
            anchoredToObjectId: target.id,
            rulesText: '本生物获得迅捷特性。',
        });
        expect(isMageWarsSwiftArenaObject(cast.state.core.objects[target.id], cast.state.core)).toBe(true);
    });

    it('implements 1811 Decoy as a hidden area-or-object enchantment with reveal-and-consume refund', () => {
        const target = makeArenaObject('decoy-target-0', '0', PLAYER_ZERO_START_ZONE);
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('initiativeQuickcast').core, '0', MAGE_IDS.WIZARD_APPRENTICE, [1811]),
                target,
            ),
            sys: setupState('initiativeQuickcast').sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(1811, 2, target.id));
        const decoy = Object.values(cast.state.core.objects).find((object) => object.sourceSpellCardId === 1811);

        expect(getMageWarsSpellCardFromConfig(1811)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(decoy).toMatchObject({
            kind: 'enchantment',
            revealed: false,
            anchoredToObjectId: target.id,
            rulesText: getMageWarsSpellCardFromConfig(1811)?.rulesText,
        });
        expect(cast.state.core.players['0'].mana).toBe(18);

        const revealed = runCommand(cast.state, {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0',
            payload: {
                objectId: decoy!.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.DECOY_REVEAL,
                manaCost: 0,
            },
        });

        expect(revealed.success).toBe(true);
        expect(revealed.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ENCHANTMENT_REVEALED);
        expect(revealed.state.core.objects[decoy!.id]).toBeUndefined();
        expect(revealed.state.core.players['0'].mana).toBe(20);
    });

    it('allows 1811 Decoy to anchor to an empty zone', () => {
        const planning = setupState('initiativeQuickcast');
        const state: MatchState<MageWarsCore> = {
            core: withPreparedPlayerMage(planning.core, '0', MAGE_IDS.WIZARD_APPRENTICE, [1811]),
            sys: planning.sys,
        };
        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 1811,
                manaCost: 2,
                targetZoneId: ARENA_ZONE_IDS.A2,
            },
        });
        expect(cast.success).toBe(true);
        expect(Object.values(cast.state.core.objects)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceSpellCardId: 1811,
                revealed: false,
                anchoredToZoneId: ARENA_ZONE_IDS.A2,
            }),
        ]));
    });

    it('implements 1819 Force Orb as a structured status-proof defense enchantment', () => {
        const target = makeArenaObject('force-orb-target-0', '0', PLAYER_ZERO_START_ZONE);
        const attacker = makeArenaObject('force-orb-attacker-1', '1', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const state: MatchState<MageWarsCore> = {
            core: [target, attacker].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [1819]),
            ),
            sys: setupState('creatureAction').sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(1819, 5, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === 1819);

        expect(getMageWarsSpellCardFromConfig(1819)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(enchantment).toMatchObject({
            revealed: true,
            anchoredToObjectId: target.id,
            combatProfilesSource: 'config',
        });
        expect(getMageWarsObjectDefenseProfiles(target, cast.state.core)).toEqual(expect.arrayContaining([
            expect.objectContaining({ minRoll: 8, usesPerRound: 1, ignoresStatus: true }),
        ]));

        const attack = runCommand({
            core: {
                ...cast.state.core,
                currentPlayerId: '1',
            },
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '1',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(attack.success).toBe(true);
        expect(attack.events.some((event) => event.type === MAGE_WARS_EVENTS.DEFENSE_AVAILABLE)).toBe(true);
    });

    it('implements 1814 Eagle Wings and 1824 Grounding through structured flying grants', () => {
        const wingedTarget = makeArenaObject('eagle-wings-target-0', '0', PLAYER_ZERO_START_ZONE);
        const wingState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [1814]),
                wingedTarget,
            ),
            sys: setupState('creatureAction').sys,
        };
        const wingCast = runCommand(wingState, castObjectSpellCommand(1814, 6, wingedTarget.id));
        const wingedCore = wingCast.state.core;
        const wingedTextIndependentCore = {
            ...wingedCore,
            objects: Object.fromEntries(Object.entries(wingedCore.objects).map(([id, object]) => (
                object.sourceSpellCardId === 1814
                    ? [id, { ...object, attackOrTraitLine: undefined, rulesText: '展示文案已移除。' }]
                    : [id, object]
            ))),
        } as MageWarsCore;

        expect(wingCast.success).toBe(true);
        expect(isMageWarsFlyingArenaObject(wingedTarget, wingedTextIndependentCore)).toBe(true);

        const alreadyFlying = makeArenaObject('grounding-target-0', '0', PLAYER_ZERO_START_ZONE, {
            typeLine: '生物 / 飞行',
        });
        const groundingState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [1824]),
                alreadyFlying,
            ),
            sys: setupState('creatureAction').sys,
        };
        const groundingCast = runCommand(groundingState, castObjectSpellCommand(1824, 5, alreadyFlying.id));
        expect(groundingCast.success).toBe(true);
        expect(isMageWarsFlyingArenaObject(alreadyFlying, groundingCast.state.core)).toBe(false);
    });

    it('implements 1822 Falcon Focus as ranged-only +1 dice from the attachment', () => {
        const archer = makeArenaObject('falcon-focus-archer-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '长弓：完整行动远程 `1-2` 2 骰；利爪：快速近战 2 骰',
        });
        const target = makeArenaObject('falcon-focus-target-1', '1', ARENA_ZONE_IDS.B3, { life: 40 });
        const state: MatchState<MageWarsCore> = {
            core: [archer, target].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.PRIESTESS_APPRENTICE, [1822]),
            ),
            sys: setupState('creatureAction').sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(1822, 3, archer.id));
        const attack = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: archer.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const declared = attack.events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);

        expect(cast.success).toBe(true);
        expect(attack.success).toBe(true);
        expect(declared?.payload).toMatchObject({
            rangedDiceModifier: 1,
            diceResults: [3, 3, 3],
        });
    });

    it('implements 3421 Piercing Strike as +3 pierce on the next melee attack', () => {
        const attacker = makeArenaObject('piercing-strike-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const target = makeArenaObject('piercing-strike-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 40 });
        const state: MatchState<MageWarsCore> = {
            core: [attacker, target].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [3421]),
            ),
            sys: setupState('creatureAction').sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(3421, 2, attacker.id));
        expect(cast.success).toBe(true);
        expect(getMageWarsSpellCardFromConfig(3421)?.requiresCodeSupport).toBe(false);
        expect(cast.state.core.objects[attacker.id].temporaryTraits).toMatchObject({
            nextMeleePierceModifier: 3,
        });

        const attack = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(attack.success).toBe(true);
        expect(attack.events.some((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
            && event.payload.pierceModifier === 3)).toBe(true);
        expect(attack.state.core.objects[attacker.id].temporaryTraits?.nextMeleePierceModifier).toBeUndefined();
    });

    it('implements 3422 Perfect Strike as an unavoidable next melee attack', () => {
        const attacker = makeArenaObject('perfect-strike-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const target = makeArenaObject('perfect-strike-target-1', '1', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰；防御图标 `8+ / 1x`',
        });
        const state: MatchState<MageWarsCore> = {
            core: [attacker, target].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [3422]),
            ),
            sys: setupState('creatureAction').sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(3422, 2, attacker.id));
        expect(cast.success).toBe(true);
        expect(getMageWarsSpellCardFromConfig(3422)?.requiresCodeSupport).toBe(false);
        expect(cast.state.core.objects[attacker.id].temporaryTraits).toMatchObject({
            nextMeleeUnavoidable: true,
        });

        const attack = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(attack.success).toBe(true);
        expect(attack.events.some((event) => event.type === MAGE_WARS_EVENTS.DEFENSE_AVAILABLE)).toBe(false);
        expect(attack.state.core.objects[attacker.id].temporaryTraits?.nextMeleeUnavoidable).toBeUndefined();
    });

    it('implements 3426 Unhindered Movement as temporary elusive', () => {
        const target = makeArenaObject('unhindered-target-0', '0', PLAYER_ZERO_START_ZONE);
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [3426]),
                target,
            ),
            sys: setupState('creatureAction').sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(3426, 3, target.id));
        expect(cast.success).toBe(true);
        expect(getMageWarsSpellCardFromConfig(3426)?.requiresCodeSupport).toBe(false);
        expect(isMageWarsElusiveArenaObject(cast.state.core.objects[target.id], cast.state.core)).toBe(true);
        expect(cast.state.core.objects[target.id].temporaryTraits).toMatchObject({ elusive: true });
    });

    it('implements 3424 Knockdown as a stun token and rejects stable creatures', () => {
        const target = makeArenaObject('knockdown-target-1', '1', PLAYER_ZERO_START_ZONE);
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [3424]),
                target,
            ),
            sys: setupState('creatureAction').sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(3424, 3, target.id));

        expect(getMageWarsSpellCardFromConfig(3424)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(cast.events).toContainEqual(expect.objectContaining({
            type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
            payload: expect.objectContaining({
                targetObjectId: target.id,
                statusTokenId: STATUS_TOKEN_IDS.STUN,
                amount: 1,
                spellCardId: 3424,
            }),
        }));
        expect(cast.state.core.objects[target.id].statusTokens[STATUS_TOKEN_IDS.STUN]).toBe(1);

        const stableTarget = makeArenaObject('knockdown-stable-target-1', '1', PLAYER_ZERO_START_ZONE, {
            typeLine: '生物 / 稳固',
        });
        const stableState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [3424]),
                stableTarget,
            ),
            sys: setupState('creatureAction').sys,
        };
        expect(validateCommand(stableState, castObjectSpellCommand(3424, 3, stableTarget.id))).toBe('targetStable');
    });

    it('implements 3423 Holy Grace healing with paid partial status removal', () => {
        const target = makeArenaObject('holy-grace-target-1', '1', PLAYER_ZERO_START_ZONE, {
            damage: 8,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
                [STATUS_TOKEN_IDS.DAZE]: 2,
            },
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.PRIESTESS_APPRENTICE, [3423]),
                target,
            ),
            sys: setupState('creatureAction').sys,
        };
        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 3423,
                manaCost: 15,
                targetObjectId: target.id,
                statusTokenIds: [STATUS_TOKEN_IDS.STUN, STATUS_TOKEN_IDS.DAZE],
                statusTokenAmounts: {
                    [STATUS_TOKEN_IDS.STUN]: 1,
                    [STATUS_TOKEN_IDS.DAZE]: 1,
                },
            },
        });

        expect(getMageWarsSpellCardFromConfig(3423)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(cast.events).toContainEqual(expect.objectContaining({
            type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
            payload: expect.objectContaining({
                spellCardId: 3423,
                diceResults: Array(12).fill(3),
                healing: 36,
                actualHealing: 8,
            }),
        }));
        expect(cast.events.filter((event) => event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVAL_AVAILABLE))
            .toHaveLength(2);
        expect(cast.state.core.objects[target.id].damage).toBe(0);
        expect(cast.state.core.objects[target.id].statusTokens[STATUS_TOKEN_IDS.STUN]).toBeUndefined();
        expect(cast.state.core.objects[target.id].statusTokens[STATUS_TOKEN_IDS.DAZE]).toBe(1);
        expect(cast.state.core.players['0'].mana).toBe(5);
    });

    it('implements 3418 Toxin Purification with partial toxin removal and explicit enchantment selection', () => {
        const target = makeArenaObject('toxin-purification-target-0', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: {
                [STATUS_TOKEN_IDS.ROT]: 2,
                [STATUS_TOKEN_IDS.WEAK]: 1,
            },
        });
        const selectedToxinEnchantment = makeVisibleEnchantmentObject(
            'toxin-purification-selected-enchantment-0',
            '1',
            PLAYER_ZERO_START_ZONE,
            {
                sourceSpellCardId: 1820,
                sourceObjectId: 'spell-card-1820',
                name: '尸鬼腐化',
                typeLine: '结界 / 诅咒、毒素',
                rulesText: '每个维持阶段，本生物受到2点直接毒素伤害。',
                anchoredToObjectId: target.id,
            },
        );
        const unselectedToxinEnchantment = makeVisibleEnchantmentObject(
            'toxin-purification-unselected-enchantment-0',
            '1',
            PLAYER_ZERO_START_ZONE,
            {
                sourceSpellCardId: 1820,
                sourceObjectId: 'spell-card-1820',
                name: '尸鬼腐化（未选）',
                typeLine: '结界 / 诅咒、毒素',
                rulesText: '每个维持阶段，本生物受到2点直接毒素伤害。',
                anchoredToObjectId: target.id,
            },
        );
        const setup = setupState('creatureAction');
        const prepared = withPreparedPlayerMage(setup.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE, [3418]);
        const state: MatchState<MageWarsCore> = {
            core: {
                ...withArenaObject(
                    withArenaObject(
                        withArenaObject(prepared, target),
                        selectedToxinEnchantment,
                    ),
                    unselectedToxinEnchantment,
                ),
                players: {
                    ...prepared.players,
                    '0': {
                        ...prepared.players['0'],
                        mana: 20,
                    },
                },
            },
            sys: setup.sys,
        };

        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 3418,
                manaCost: 10,
                targetObjectId: target.id,
                statusTokenIds: [STATUS_TOKEN_IDS.ROT, STATUS_TOKEN_IDS.WEAK],
                statusTokenAmounts: {
                    [STATUS_TOKEN_IDS.ROT]: 1,
                    [STATUS_TOKEN_IDS.WEAK]: 1,
                },
                selectedEnchantmentObjectIds: [selectedToxinEnchantment.id],
            },
        });

        expect(getMageWarsSpellCardFromConfig(3418)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(cast.events.filter((event) => event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVAL_AVAILABLE))
            .toHaveLength(2);
        expect(cast.events).toContainEqual(expect.objectContaining({
            type: MAGE_WARS_EVENTS.SPELL_OBJECT_DESTRUCTION_AVAILABLE,
            payload: expect.objectContaining({
                targetObjectId: selectedToxinEnchantment.id,
                destructionKind: 'dispel',
            }),
        }));
        expect(cast.events.some((event) => event.type === MAGE_WARS_EVENTS.SPELL_OBJECT_DESTRUCTION_AVAILABLE
            && event.payload.targetObjectId === unselectedToxinEnchantment.id)).toBe(false);
        expect(cast.state.core.objects[target.id].statusTokens[STATUS_TOKEN_IDS.ROT]).toBe(1);
        expect(cast.state.core.objects[target.id].statusTokens[STATUS_TOKEN_IDS.WEAK]).toBeUndefined();
        expect(cast.state.core.objects[selectedToxinEnchantment.id]).toBeUndefined();
        expect(cast.state.core.objects[unselectedToxinEnchantment.id]).toBeDefined();
        expect(cast.state.core.players['0'].mana).toBe(10);
    });

    it('implements 3412 Enchantment Migration without changing enchantment control', () => {
        const oldTarget = makeArenaObject('enchantment-migration-old-target-0', '0', PLAYER_ZERO_START_ZONE);
        const newTarget = makeArenaObject('enchantment-migration-new-target-1', '1', PLAYER_ZERO_START_ZONE);
        const enchantment = makeVisibleEnchantmentObject(
            'enchantment-migration-source-0',
            '0',
            PLAYER_ZERO_START_ZONE,
            {
                sourceSpellCardId: 1800,
                sourceObjectId: 'spell-card-1800',
                anchoredToObjectId: oldTarget.id,
            },
        );
        const setup = setupState('creatureAction');
        const prepared = withPreparedPlayerMage(setup.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [3412]);
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withArenaObject(
                    withArenaObject(prepared, oldTarget),
                    newTarget,
                ),
                enchantment,
            ),
            sys: setup.sys,
        };

        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 3412,
                manaCost: 1,
                targetObjectId: enchantment.id,
                newTargetObjectId: newTarget.id,
            },
        });

        expect(getMageWarsSpellCardFromConfig(3412)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(cast.events).toContainEqual(expect.objectContaining({
            type: MAGE_WARS_EVENTS.ENCHANTMENT_REATTACHED,
            payload: expect.objectContaining({
                objectId: enchantment.id,
                ownerId: '0',
                targetObjectId: newTarget.id,
            }),
        }));
        expect(cast.state.core.objects[enchantment.id]).toMatchObject({
            ownerId: '0',
            anchoredToObjectId: newTarget.id,
        });
        expect(cast.state.core.objects[enchantment.id].anchoredToObjectId).not.toBe(oldTarget.id);
    });

    it('implements 3500 Mana Drain as bounded dice drain transferred to the caster', () => {
        const state: MatchState<MageWarsCore> = {
            core: withPlayerInZone(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WIZARD_APPRENTICE, [3500], 20),
                '1',
                PLAYER_ZERO_START_ZONE,
            ),
            sys: setupState('creatureAction').sys,
        };
        const targetManaBefore = state.core.players['1'].mana;

        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 3500,
                manaCost: 16,
                targetPlayerId: '1',
            },
        });

        expect(cast.success).toBe(true);
        expect(getMageWarsSpellCardFromConfig(3500)?.requiresCodeSupport).toBe(false);
        expect(cast.state.core.players['1'].mana).toBe(0);
        expect(cast.state.core.players['0'].mana).toBe(4 + targetManaBefore);
        expect(cast.events.some((event) => event.type === MAGE_WARS_EVENTS.MANA_TRANSFERRED
            && event.payload.amount === targetManaBefore)).toBe(true);
    });

    it('implements 3722 Silverwood Longbow through the shared equipment attack chain', () => {
        const spellCardId = 3722;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const castState: MatchState<MageWarsCore> = {
            core: withPlayerInZone(planned.state.core, '1', ARENA_ZONE_IDS.B3),
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        };

        const cast = runCommand(castState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 8,
                targetPlayerId: '0',
            },
        });
        const equipment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === spellCardId);

        expect(getMageWarsSpellCardFromConfig(spellCardId)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(equipment).toMatchObject({
            kind: 'equipment',
            anchoredToPlayerId: '0',
            attackOrTraitLine: '伏特力之箭：完整行动远程 `1-2` 4 骰，穿刺+1',
            combatProfilesSource: 'config',
        });

        const attack = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
            playerId: '0',
            payload: {
                equipmentObjectId: equipment!.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });
        const declared = attack.events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);

        expect(attack.success).toBe(true);
        expect(declared?.payload).toMatchObject({
            attackerObjectId: equipment!.id,
            attackProfileId: 'attack-0',
            attackName: '伏特力之箭',
            targetPlayerId: '1',
            diceResults: [3, 3, 3, 3],
            baseDamage: 12,
            actionCost: 'normal',
        });
        expect(attack.state.core.players['1'].damage).toBe(12);
    });

    it('implements 3712 Guardian Crown through the shared passive armor equipment chain', () => {
        const spellCardId = 3712;
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const cast = runCommand({
            core: planned.state.core,
            sys: { ...planned.state.sys, phase: 'initiativeQuickcast' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 1,
                targetPlayerId: '0',
            },
        });
        const equipment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === spellCardId);

        expect(getMageWarsSpellCardFromConfig(spellCardId)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(equipment).toMatchObject({
            kind: 'equipment',
            name: '天护皇冠',
            anchoredToPlayerId: '0',
            attackOrTraitLine: '护甲+1',
        });
        expect(resolveMageWarsMageEquipmentArmor(cast.state.core, '0')).toBe(1);
    });

    it.each([
        { spellCardId: 2818, manaCost: 24, life: 14, armor: 3, name: '火焰领主阿德拉梅莱克' },
        { spellCardId: 2821, manaCost: 7, life: 5, armor: 0, name: '雪貂伙伴索斯鲁柯' },
    ])('implements $spellCardId $name through the shared creature summon chain', ({ spellCardId, manaCost, life, armor, name }) => {
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(
                planningState.core,
                '0',
                spellCardId === 2818 ? MAGE_IDS.WARLOCK_APPRENTICE : MAGE_IDS.BEASTMASTER_APPRENTICE,
            ),
            sys: planningState.sys,
        }, planCommand([spellCardId]));

        const summon = runCommand({
            core: {
                ...planned.state.core,
                players: {
                    ...planned.state.core.players,
                    '0': {
                        ...planned.state.core.players['0'],
                        mana: Math.max(30, manaCost),
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const object = summon.state.core.objects[`mwobj-0-${spellCardId}-1`];

        expect(getMageWarsSpellCardFromConfig(spellCardId)?.requiresCodeSupport).toBe(false);
        expect(summon.success).toBe(true);
        expect(object).toMatchObject({
            kind: 'creature',
            name,
            sourceSpellCardId: spellCardId,
            life,
            armor,
            combatProfilesSource: 'config',
        });
        expect(getMageWarsObjectAttackProfile(object, 'attack-0')).toBeDefined();
        expect(summon.events.some((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED)).toBe(true);
    });

    it.each([
        { spellCardId: 2806, mageId: MAGE_IDS.BEASTMASTER_APPRENTICE, manaCost: 16, name: '头狼赤爪' },
        { spellCardId: 2817, mageId: MAGE_IDS.PRIESTESS_APPRENTICE, manaCost: 21, name: '闪电天使瓦尔莎拉' },
        { spellCardId: 2910, mageId: MAGE_IDS.WARLOCK_APPRENTICE, manaCost: 16, name: '玛拉寇达' },
    ])('implements $spellCardId $name as a structured creature attack contract', ({ spellCardId, mageId, manaCost, name }) => {
        const planningState = setupState('planning');
        const planned = runCommand({
            core: withPlayerMage(planningState.core, '0', mageId),
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const summon = runCommand({
            core: {
                ...planned.state.core,
                players: {
                    ...planned.state.core.players,
                    '0': {
                        ...planned.state.core.players['0'],
                        mana: Math.max(20, manaCost),
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const object = summon.state.core.objects[`mwobj-0-${spellCardId}-1`];
        const attackProfile = getMageWarsObjectAttackProfile(object, 'attack-0');

        expect(getMageWarsSpellCardFromConfig(spellCardId)?.requiresCodeSupport).toBe(false);
        expect(summon.success).toBe(true);
        expect(object).toMatchObject({
            kind: 'creature',
            name,
            sourceSpellCardId: spellCardId,
            combatProfilesSource: 'config',
        });
        expect(attackProfile).toBeDefined();
        if (spellCardId === 2817) {
            expect(attackProfile?.damageTypes).toEqual(['闪电', 'aether']);
            expect(attackProfile?.statusEffects).toEqual(expect.arrayContaining([
                expect.objectContaining({ statusTokenId: 'daze', minEffectDie: 7 }),
                expect.objectContaining({ statusTokenId: 'stun', minEffectDie: 9 }),
            ]));
        }
        if (spellCardId === 2910) {
            expect(attackProfile?.pierce).toBe(1);
            expect(isMageWarsSlowArenaObject(summon.state.core, object)).toBe(true);
        }
    });

    it('implements 2902 Deathfang Vampire with its own melee vampiric trait', () => {
        const spellCardId = 2902;
        const planningState = setupState('planning');
        const preparedCore = withPlayerMage(planningState.core, '0', MAGE_IDS.WARLOCK_APPRENTICE);
        const planned = runCommand({
            core: {
                ...preparedCore,
                players: {
                    ...preparedCore.players,
                    '0': {
                        ...preparedCore.players['0'],
                        mana: 20,
                        damage: 4,
                    },
                },
            },
            sys: planningState.sys,
        }, planCommand([spellCardId]));
        const summoned = runCommand({
            core: withPlayerInZone(planned.state.core, '1', PLAYER_ZERO_START_ZONE),
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId,
                manaCost: 16,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const vampireId = `mwobj-0-${spellCardId}-1`;
        const vampire = summoned.state.core.objects[vampireId];
        const attacked = runCommand({
            core: {
                ...summoned.state.core,
                objects: {
                    ...summoned.state.core.objects,
                    [vampireId]: { ...vampire, actionReady: true },
                },
            },
            sys: { ...summoned.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: vampireId,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(getMageWarsSpellCardFromConfig(spellCardId)?.requiresCodeSupport).toBe(false);
        expect(summoned.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerObjectId: vampireId,
                    vampiric: true,
                    diceResults: [3, 3, 3, 3, 3],
                    baseDamage: 15,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_VAMPIRIC_HEALING_AVAILABLE,
                payload: expect.objectContaining({
                    spellCardId,
                    healing: 15,
                }),
            }),
        ]));
        expect(attacked.state.core.players['0'].damage).toBe(0);
    });

    it('implements 3413 Banish with upkeep ordering, attached-object transport, and action-readiness preservation', () => {
        const target = makeArenaObject('banish-target-1', '1', PLAYER_ZERO_START_ZONE, {
            actionReady: false,
            life: 8,
        });
        const attached = makeVisibleEnchantmentObject('banish-attached-enchantment-1', '1', PLAYER_ZERO_START_ZONE, {
            anchoredToObjectId: target.id,
        });
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: [target, attached].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.WIZARD_APPRENTICE, [3413]),
            ),
            sys: base.sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(3413, 14, target.id));
        const zoneAfterCast = cast.state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)!;

        expect(getMageWarsSpellCardFromConfig(3413)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(cast.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_BANISHED,
                payload: expect.objectContaining({
                    objectId: target.id,
                    remainingTokens: 3,
                    returnToZoneId: PLAYER_ZERO_START_ZONE,
                }),
            }),
        ]));
        expect(cast.state.core.objects[target.id]).toMatchObject({
            banished: {
                remainingTokens: 3,
                returnToZoneId: PLAYER_ZERO_START_ZONE,
                sourceSpellCardId: 3413,
            },
            actionReady: false,
        });
        expect(zoneAfterCast.objectIds).not.toEqual(expect.arrayContaining([target.id, attached.id]));
        expect(validateCommand({
            ...cast.state,
            core: {
                ...cast.state.core,
                currentPlayerId: '1',
                phaseActorId: '1',
            },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '1',
            payload: { objectId: target.id, toZoneId: ARENA_ZONE_IDS.A2 },
        })).toBe('objectBanished');

        let current = cast.state;
        const upkeepResults = [];
        for (let index = 0; index < 3; index += 1) {
            current = {
                ...current,
                core: { ...current.core, phaseReadyPlayerIds: ['1'], phaseActorId: '0' },
                sys: { ...current.sys, phase: 'channel' },
            };
            const upkeep = runCommand(current, {
                type: FLOW_COMMANDS.ADVANCE_PHASE,
                playerId: '0',
                payload: {},
            });
            expect(upkeep.success).toBe(true);
            expect(upkeep.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: MAGE_WARS_EVENTS.ARENA_OBJECT_BANISH_TICKED,
                    payload: expect.objectContaining({ objectId: target.id }),
                }),
            ]));
            upkeepResults.push(upkeep);
            current = upkeep.state;
        }

        expect(upkeepResults[0].state.core.objects[target.id].banished?.remainingTokens).toBe(2);
        expect(upkeepResults[1].state.core.objects[target.id].banished?.remainingTokens).toBe(1);
        expect(current.core.objects[target.id].banished).toBeUndefined();
        expect(current.core.objects[target.id].actionReady).toBe(false);
        const restoredZone = current.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)!;
        expect(restoredZone.objectIds).toEqual(expect.arrayContaining([target.id, attached.id]));
    });

    it('implements 3416 Battle Fury as one optional quick melee attack after the next non-counterstrike melee attack', () => {
        const attacker = makeArenaObject('battle-fury-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: withPlayerInZone(
                withArenaObject(
                    withPreparedPlayerMage(base.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [3416]),
                    attacker,
                ),
                '1',
                PLAYER_ZERO_START_ZONE,
            ),
            sys: base.sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(3416, 5, attacker.id));
        const attacked = runCommand(cast.state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        });

        expect(getMageWarsSpellCardFromConfig(3416)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.BATTLE_FURY_AVAILABLE,
                payload: expect.objectContaining({ attackerObjectId: attacker.id, roundNumber: 1 }),
            }),
        ]));
        const interaction = getSimpleChoicePrompt(attacked.state, 'mw.battle-fury.choice');
        expect(interaction).toBeDefined();
        const promptOptions = getPromptOptions(attacked.state);
        expect(promptOptions).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'pass' }),
            expect.objectContaining({ value: expect.objectContaining({ action: 'attack' }) }),
        ]));
        const attackOption = promptOptions.find((option) => (
            (option.value as { action?: string } | undefined)?.action === 'attack'
        ));
        expect(attackOption).toBeDefined();
        const extra = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: interaction!.id,
                optionId: attackOption!.id,
            },
        } as Command);

        expect(extra.success).toBe(true);
        expect(extra.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.BATTLE_FURY_CONSUMED,
                payload: expect.objectContaining({ attackerObjectId: attacker.id }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({ attackerObjectId: attacker.id }),
            }),
        ]));
        expect(extra.state.core.objects[attacker.id].temporaryTraits?.battleFuryRoundNumber).toBeUndefined();
    });

    it('implements 2903 Mountain Gorilla through the generic creature summon and configured combat profile', () => {
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: withPreparedPlayerMage(base.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [2903]),
            sys: base.sys,
        };

        const summoned = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 2903,
                manaCost: 16,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const gorilla = summoned.state.core.objects['mwobj-0-2903-1'];

        expect(getMageWarsSpellCardFromConfig(2903)?.requiresCodeSupport).toBe(false);
        expect(summoned.success).toBe(true);
        expect(gorilla).toMatchObject({
            kind: 'creature',
            name: '高山猩猩',
            life: 16,
            armor: 2,
            combatProfilesSource: 'config',
        });
        expect(getMageWarsObjectAttackProfile(gorilla, 'attack-0')).toMatchObject({
            actionKind: 'quick',
            rangeKind: 'melee',
            diceCount: 4,
        });
    });

    it('implements 2206 and 2207 as same-zone animal area grants', () => {
        const animal = makeArenaObject('area-grant-animal-0', '0', PLAYER_ZERO_START_ZONE, {
            typeLine: '生物 / 动物',
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const target = makeArenaObject('area-grant-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 40 });
        const base = setupState('deployment');
        const pierceState: MatchState<MageWarsCore> = {
            core: [animal, target].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [2206]),
            ),
            sys: base.sys,
        };

        const pierceCast = runCommand(pierceState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 2206, manaCost: 7, targetZoneId: PLAYER_ZERO_START_ZONE },
        });
        const pierceAttack = runCommand({
            ...pierceCast.state,
            sys: { ...pierceCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: animal.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const pierceDeclared = pierceAttack.events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        const pierceSource = Object.values(pierceCast.state.core.objects).find((object) => object.sourceSpellCardId === 2206);

        expect(pierceCast.success).toBe(true);
        expect(pierceSource).toMatchObject({ kind: 'conjuration', anchoredToZoneId: PLAYER_ZERO_START_ZONE });
        expect(pierceDeclared?.payload).toMatchObject({ pierceModifier: 1 });

        const movingAnimal = makeArenaObject('area-charge-animal-0', '0', ARENA_ZONE_IDS.A2, {
            typeLine: '生物 / 动物',
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const chargeTarget = makeArenaObject('area-charge-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 40 });
        const chargeState: MatchState<MageWarsCore> = {
            core: [movingAnimal, chargeTarget].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [2207]),
            ),
            sys: base.sys,
        };
        const chargeCast = runCommand(chargeState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 2207, manaCost: 7, targetZoneId: PLAYER_ZERO_START_ZONE },
        });
        const moved = runCommand({
            ...chargeCast.state,
            sys: { ...chargeCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: movingAnimal.id, toZoneId: PLAYER_ZERO_START_ZONE },
        });
        const chargeAttack = runCommand(moved.state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: movingAnimal.id,
                attackProfileId: 'attack-0',
                targetObjectId: chargeTarget.id,
            },
        });
        const chargeDeclared = chargeAttack.events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);

        expect(getMageWarsSpellCardFromConfig(2206)?.requiresCodeSupport).toBe(false);
        expect(getMageWarsSpellCardFromConfig(2207)?.requiresCodeSupport).toBe(false);
        expect(chargeCast.success).toBe(true);
        expect(moved.success).toBe(true);
        expect(chargeAttack.success).toBe(true);
        expect(chargeDeclared?.payload).toMatchObject({ chargeDiceModifier: 1 });
    });

    it('implements 2221 and 2222 channeling grants through the formal channel phase', () => {
        const cases = [
            { spellCardId: 2221, mageId: MAGE_IDS.WARLOCK_APPRENTICE },
            { spellCardId: 2222, mageId: MAGE_IDS.BEASTMASTER_APPRENTICE },
        ] as const;

        for (const entry of cases) {
            const base = setupState('deployment');
            const cast = runCommand({
                core: withPreparedPlayerMage(base.core, '0', entry.mageId, [entry.spellCardId]),
                sys: base.sys,
            }, {
                type: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '0',
                payload: {
                    spellCardId: entry.spellCardId,
                    manaCost: 5,
                    targetZoneId: PLAYER_ZERO_START_ZONE,
                },
            });
            const manaBeforeChannel = cast.state.core.players['0'].mana;
            const baseChanneling = cast.state.core.players['0'].channeling;
            const channel = runCommand({
                core: { ...cast.state.core, phaseReadyPlayerIds: [] },
                sys: { ...cast.state.sys, phase: 'reset' },
            }, {
                type: FLOW_COMMANDS.ADVANCE_PHASE,
                playerId: '0',
                payload: {},
            });
            const manaEvent = channel.events.find((event) => (
                event.type === MAGE_WARS_EVENTS.MANA_CHANNELED
                && event.payload.playerId === '0'
            ));

            expect(getMageWarsSpellCardFromConfig(entry.spellCardId)?.requiresCodeSupport).toBe(false);
            expect(cast.success).toBe(true);
            expect(channel.success).toBe(true);
            expect(manaEvent?.payload).toMatchObject({ amount: baseChanneling + 1 });
            expect(channel.state.core.players['0'].mana).toBe(manaBeforeChannel + baseChanneling + 1);
        }
    });

    it('implements 2223 Mana Siphon as a zone placement that follows the selected mage', () => {
        const base = setupState('deployment');
        const preparedCore = withPreparedPlayerMage(base.core, '0', MAGE_IDS.WIZARD_APPRENTICE, [2223]);
        const state: MatchState<MageWarsCore> = {
            core: withPlayerInZone(
                {
                    ...preparedCore,
                    players: {
                        ...preparedCore.players,
                        '0': { ...preparedCore.players['0'], mana: 20 },
                    },
                },
                '1',
                ARENA_ZONE_IDS.B2,
            ),
            sys: base.sys,
        };
        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 2223,
                manaCost: 12,
                targetPlayerId: '1',
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const siphon = Object.values(cast.state.core.objects).find((object) => object.sourceSpellCardId === 2223);

        expect(getMageWarsSpellCardFromConfig(2223)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(siphon).toMatchObject({
            kind: 'conjuration',
            anchoredToZoneId: PLAYER_ZERO_START_ZONE,
            anchoredToPlayerId: '1',
            rulesText: '当法力虹吸进场时，选择距离本法术最多2格区域之内并在视线中的一名法师。只要法力虹吸在场，该法师获得聚魔-2，并且与被选择法师所在竞技场的位置无关。',
        });

        const channel = runCommand({
            core: { ...cast.state.core, phaseReadyPlayerIds: [] },
            sys: { ...cast.state.sys, phase: 'reset' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(channel.state.core.players['0'].mana).toBe(18);
        expect(channel.state.core.players['1'].mana).toBe(18);

        const movedTarget = runCommand({
            core: {
                ...channel.state.core,
                currentPlayerId: '1',
                phaseActorId: '1',
            },
            sys: { ...channel.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_MAGE,
            playerId: '1',
            payload: { toZoneId: ARENA_ZONE_IDS.B3 },
        });
        const nextChannel = runCommand({
            core: {
                ...movedTarget.state.core,
                currentPlayerId: '0',
                phaseActorId: '0',
                phaseReadyPlayerIds: [],
            },
            sys: { ...movedTarget.state.sys, phase: 'reset' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(movedTarget.success).toBe(true);
        expect(nextChannel.state.core.players['1'].mana).toBe(26);
    });

    it('implements 3726 Moloch\'s Torment with controlled-curse upkeep payment and optional skip', () => {
        const target = makeArenaObject('moloch-torment-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 8 });
        const curse = makeVisibleEnchantmentObject(
            'moloch-torment-curse-1',
            '0',
            PLAYER_ZERO_START_ZONE,
            { anchoredToObjectId: target.id },
        );
        const base = setupState('initiativeQuickcast');
        const state: MatchState<MageWarsCore> = {
            core: [target, curse].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [3726]),
            ),
            sys: base.sys,
        };

        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 3726,
                manaCost: 3,
                targetPlayerId: '0',
            },
        });
        const equipment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === 3726);

        expect(getMageWarsSpellCardFromConfig(3726)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(equipment).toMatchObject({
            kind: 'equipment',
            anchoredToPlayerId: '0',
            rulesText: '限定邪术师。在维持阶段中，你可以为每个至少附属有一个你控制的诅咒的生物支付1点法力，以对该生物造成1点直接伤害。',
        });

        const upkeep = runCommand({
            core: {
                ...cast.state.core,
                phaseReadyPlayerIds: ['1'],
                phaseActorId: '0',
            },
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const interaction = getSimpleChoicePrompt(
            upkeep.state,
            'mw.upkeep-equipment-direct-damage.choice',
        );
        const payOption = getPromptOptions(upkeep.state).find((option) => (
            (option.value as { action?: string } | undefined)?.action === 'pay'
        ));
        expect(upkeep.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.UPKEEP_EQUIPMENT_DIRECT_DAMAGE_AVAILABLE,
                payload: expect.objectContaining({
                    sourceObjectId: equipment?.id,
                    sourceSpellCardId: 3726,
                    targetObjectId: target.id,
                    playerId: '0',
                    amount: 1,
                    damageType: 'aether',
                }),
            }),
        ]));
        expect(payOption).toBeDefined();

        const paid = runCommand(upkeep.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: interaction.id,
                optionId: payOption!.id,
            },
        } as Command);
        expect(paid.success).toBe(true);
        expect(paid.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MANA_SPENT,
                payload: expect.objectContaining({ playerId: '0', amount: 1, spellCardId: 3726 }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 1,
                    sourceAbilityId: 'mw.spell.3726.upkeep',
                }),
            }),
        ]));
        expect(paid.state.core.players['0'].mana).toBe(cast.state.core.players['0'].mana - 1);
        expect(paid.state.core.objects[target.id].damage).toBe(1);

        const skipped = runCommand({
            core: {
                ...cast.state.core,
                players: {
                    ...cast.state.core.players,
                    '0': { ...cast.state.core.players['0'], mana: 0 },
                },
                phaseReadyPlayerIds: ['1'],
                phaseActorId: '0',
            },
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        expect(skipped.success).toBe(true);
        expect(skipped.events.some((event) => event.type === 'DAMAGE_DEALT')).toBe(false);
        expect(skipped.state.core.objects[target.id].damage).toBe(0);
    });

    it('implements 2208 Poison Cloud with upkeep toxin damage and one movement action per turn', () => {
        const base = setupState('deployment');
        const target = makeArenaObject('poison-cloud-target-1', '1', PLAYER_ZERO_START_ZONE, {
            typeLine: '生物 / 迅捷',
            life: 8,
            actionReady: true,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.WIZARD_APPRENTICE, [2208]),
                target,
            ),
            sys: base.sys,
        };

        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 2208,
                manaCost: 8,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const cloud = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === 2208);

        expect(getMageWarsSpellCardFromConfig(2208)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(cloud).toMatchObject({
            kind: 'conjuration',
            anchoredToZoneId: PLAYER_ZERO_START_ZONE,
            rulesText: '每个维持阶段，所有位于毒气云雾所在区域的活体生物受到2点直接毒素伤害。如果一个活体生物进入本区域，或在本区域开始它的行动阶段，则它回合不可以执行多于一次的移动行动。',
        });

        const upkeep = runCommand({
            core: {
                ...cast.state.core,
                phaseReadyPlayerIds: ['1'],
                phaseActorId: '0',
            },
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const upkeepDamageEvent = upkeep.events.find((event) => event.type === 'DAMAGE_DEALT');

        expect(upkeep.success).toBe(true);
        expect(upkeep.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.UPKEEP_AREA_CONJURATION_DIRECT_DAMAGE_AVAILABLE,
                payload: expect.objectContaining({
                    sourceObjectId: cloud?.id,
                    sourceSpellCardId: 2208,
                    targetObjectId: target.id,
                    amount: 2,
                    damageType: '毒素',
                }),
            }),
        ]));
        expect(upkeepDamageEvent).toMatchObject({
            payload: expect.objectContaining({
                targetId: target.id,
                actualDamage: 2,
                sourceAbilityId: 'mw.spell.2208.upkeep',
            }),
        });

        const movedOut = runCommand({
            core: {
                ...cast.state.core,
                currentPlayerId: '1',
                phaseActorId: '1',
            },
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '1',
            payload: {
                objectId: target.id,
                toZoneId: ARENA_ZONE_IDS.A2,
            },
        });

        expect(movedOut.success).toBe(true);
        expect(movedOut.state.core.objects[target.id]).toMatchObject({
            movementActionsUsedThisTurn: 1,
            movementActionsLimitThisTurn: 1,
        });
        expect(validateCommand(movedOut.state, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '1',
            payload: {
                objectId: target.id,
                toZoneId: PLAYER_ZERO_START_ZONE,
            },
        })).toBe('movementActionLimitReached');
    });

    it('implements 2303 Morktali as a same-zone friendly regeneration aura', () => {
        const target = makeArenaObject('morktali-aura-target-0', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'creature',
            typeLine: '生物 / 植物',
            life: 10,
            damage: 3,
            armor: 0,
        });
        const base = setupState('deployment');
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [2303]),
                target,
            ),
            sys: base.sys,
        };
        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 2303,
                manaCost: 8,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const tree = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === 2303);

        expect(getMageWarsSpellCardFromConfig(2303)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(tree).toMatchObject({
            kind: 'conjuration',
            life: 8,
            armor: 2,
            rulesText: '重生2·活体·传奇；火焰+2·水流免疫。所有位于生命巨树默克塔利所在区域的友方活体生物获得重生2特性。',
        });
        expect(resolveMageWarsObjectRegeneration(cast.state.core, target)).toMatchObject({
            value: 2,
            sourceObjectIds: [tree?.id],
        });
    });

    it('implements 2219 Binsara Hand as a once-per-round armor or healing ability', () => {
        const base = setupState('deployment');
        const target = makeArenaObject('binsara-target-0', '0', PLAYER_ZERO_START_ZONE, {
            damage: 2,
            armor: 2,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE, [2219]),
                target,
            ),
            sys: base.sys,
        };

        const cast = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 2219,
                manaCost: 5,
                targetZoneId: PLAYER_ZERO_START_ZONE,
            },
        });
        const hand = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === 2219);

        expect(getMageWarsSpellCardFromConfig(2219)?.requiresCodeSupport).toBe(false);
        expect(cast.success).toBe(true);
        expect(hand).toMatchObject({
            kind: 'conjuration',
            anchoredToZoneId: PLAYER_ZERO_START_ZONE,
            rulesText: '每回合一次，在任意友方生物的行动阶段之前或之后，你可以以一个活体生物为目标，使其获得护甲+1特性直到本回合结束，或者你可以为其治疗1点伤害。使用一枚就绪标记来记录本能力。',
        });

        const armorCommand = {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0' as const,
            payload: {
                objectId: hand!.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BINSARA_HAND,
                manaCost: 0,
                targetObjectId: target.id,
                mode: 'armor-bonus' as const,
            },
        };
        const armored = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, armorCommand);

        expect(armored.success).toBe(true);
        expect(armored.state.core.players['0'].mana).toBe(cast.state.core.players['0'].mana);
        expect(armored.state.core.players['0'].actionReady).toBe(cast.state.core.players['0'].actionReady);
        expect(armored.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
                payload: expect.objectContaining({
                    objectId: hand!.id,
                    abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BINSARA_HAND,
                    mode: 'armor-bonus',
                    actionCost: 'none',
                    roundNumber: cast.state.core.turnNumber,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED,
                payload: expect.objectContaining({
                    objectId: target.id,
                    armorModifier: 1,
                    armorModifierUntilRoundNumber: cast.state.core.turnNumber,
                }),
            }),
        ]));
        expect(armored.state.core.objects[target.id].temporaryTraits).toMatchObject({
            armorModifier: 1,
            armorModifierUntilRoundNumber: cast.state.core.turnNumber,
        });
        expect(resolveMageWarsObjectEffectiveArmor(armored.state.core, armored.state.core.objects[target.id]))
            .toBe(3);
        expect(armored.state.core.objects[hand!.id].abilityUseRoundNumbers).toMatchObject({
            [MAGE_WARS_OBJECT_ABILITY_IDS.BINSARA_HAND]: cast.state.core.turnNumber,
        });

        expect(validateCommand(armored.state, {
            ...armorCommand,
            payload: { ...armorCommand.payload, mode: 'heal' },
        })).toBe('objectAbilityAlreadyUsedThisRound');

        const nextRound = reduceEvent(
            reduceEvent(armored.state.core, {
                type: MAGE_WARS_EVENTS.TURN_ADVANCED,
                payload: { fromPlayerId: '0', toPlayerId: '0', turnNumber: 2 },
                sourceCommandType: 'test',
                timestamp: 0,
            }),
            {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED,
                payload: {
                    ownerId: target.ownerId,
                    objectId: target.id,
                    traitIds: ['armor'],
                    sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BINSARA_HAND,
                },
                sourceCommandType: 'test',
                timestamp: 0,
            },
        );
        expect(nextRound.objects[target.id].temporaryTraits).toBeUndefined();
        expect(resolveMageWarsObjectEffectiveArmor(nextRound, nextRound.objects[target.id])).toBe(2);

        const healingTarget = {
            ...target,
            id: 'binsara-heal-target-0',
            damage: 2,
        };
        const healingState: MatchState<MageWarsCore> = {
            core: {
                ...nextRound,
                objects: {
                    ...nextRound.objects,
                    [healingTarget.id]: healingTarget,
                },
                arena: nextRound.arena.map((zone) => zone.id === healingTarget.zoneId
                    ? { ...zone, objectIds: [...zone.objectIds, healingTarget.id] }
                    : zone),
            },
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        };
        const healed = runCommand(healingState, {
            ...armorCommand,
            payload: {
                ...armorCommand.payload,
                targetObjectId: healingTarget.id,
                mode: 'heal',
            },
        });

        expect(healed.success).toBe(true);
        expect(healed.events).toContainEqual(expect.objectContaining({
            type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
            payload: expect.objectContaining({
                spellCardId: 2219,
                sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BINSARA_HAND,
                diceResults: [1],
                healing: 1,
                actualHealing: 1,
            }),
        }));
        expect(healed.state.core.objects[healingTarget.id].damage).toBe(1);
    });

    it('rejects Binsara Hand outside the creature action window, at distance, or on nonliving targets', () => {
        const base = setupState('creatureAction');
        const hand = makeArenaObject('binsara-hand-source-0', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'conjuration',
            sourceSpellCardId: 2219,
            sourceObjectId: 'spell-card-2219',
            name: '宾莎拉之手',
            typeLine: '魔物 / 神殿',
            anchoredToZoneId: PLAYER_ZERO_START_ZONE,
            actionReady: false,
        });
        const distant = makeArenaObject('binsara-distant-target-0', '0', ARENA_ZONE_IDS.C3);
        const nonliving = makeArenaObject('binsara-nonliving-target-0', '0', PLAYER_ZERO_START_ZONE, {
            typeLine: '生物 / 非活体',
        });
        const state = [hand, distant, nonliving].reduce(
            (core, object) => withArenaObject(core, object),
            withPlayerMage(base.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE),
        );
        const command = {
            type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
            playerId: '0' as const,
            payload: {
                objectId: hand.id,
                abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BINSARA_HAND,
                manaCost: 0,
                targetObjectId: distant.id,
                mode: 'armor-bonus' as const,
            },
        };

        expect(validateCommand({ core: state, sys: base.sys }, command)).toBe('targetOutOfRange');
        expect(validateCommand({ core: state, sys: { ...base.sys, phase: 'planning' } }, command)).toBe('wrongPhase');
        expect(validateCommand({ core: state, sys: base.sys }, {
            ...command,
            payload: { ...command.payload, targetObjectId: nonliving.id },
        })).toBe('invalidTargetObject');
    });
});
