import { describe, expect, it } from 'vitest';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import {
    buildAiLegalActionsFromInteractionDecision,
    type AiDecisionDescriptor,
} from '../../../engine/ai/decisionSemantics';
import { MAGE_WARS_COMMANDS } from '../domain';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { resolveMageWarsObjectAttackEvents } from '../domain/execute';
import {
    isMageWarsElusiveArenaObject,
    isMageWarsLimitedLifeArenaObject,
    isMageWarsSwiftArenaObject,
    resolveMageWarsObjectEffectiveLife,
} from '../domain/spellRules';
import {
    ARENA_ZONE_IDS,
    MAGE_IDS,
    STATUS_TOKEN_IDS,
} from '../domain/ids';
import type { MageWarsCore } from '../domain/types';
import {
    castObjectSpellCommand,
    fixedRandom,
    getPromptInteractionId,
    getPromptOptions,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeArenaObject,
    makeVisibleEnchantmentObject,
    PLAYER_ZERO_START_ZONE,
    runCommand,
    setupState,
    validateCommand,
    withArenaObject,
    withArenaObjectDisplayText,
    withPreparedPlayerMage,
} from './helpers/domainFlowHarness';

describe('mage-wars object enchantments', () => {
    it('casts visible object enchantments as attached revealed objects and applies their continuous traits', () => {
        const agonyId = 1800;
        const bearStrengthId = 1914;
        const regrowthId = 1916;
        const rhinoHideId = 1917;
        const bullEnduranceId = 1808;
        const enfeebleId = 1816;

        const buffedCat = makeArenaObject('bear-strength-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const meleeTarget = makeArenaObject('bear-strength-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 30 });
        const bearState: MatchState<MageWarsCore> = {
            core: [buffedCat, meleeTarget].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [bearStrengthId]),
            ),
            sys: setupState('creatureAction').sys,
        };
        const bearCast = runCommand(bearState, castObjectSpellCommand(bearStrengthId, 5, buffedCat.id));
        const bearEnchantment = Object.values(bearCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === bearStrengthId);

        expect(bearCast.success).toBe(true);
        expect(bearEnchantment).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: buffedCat.id,
            zoneId: PLAYER_ZERO_START_ZONE,
        });
        const bearCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            bearCast.state.core,
            bearEnchantment!.id,
            '展示文案改写后不包含任何近战加成。',
        );

        const bearAttack = runCommand({
            core: bearCoreWithEditedEnchantmentText,
            sys: { ...bearCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: buffedCat.id,
                attackProfileId: 'attack-0',
                targetObjectId: meleeTarget.id,
            },
        });
        const bearAttackEvent = bearAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));
        expect(bearAttack.success).toBe(true);
        expect(bearAttackEvent?.payload).toMatchObject({
            meleeDiceModifier: 2,
            diceResults: [3, 3, 3, 3],
        });

        const agonizedAttacker = makeArenaObject('agony-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 4 骰',
        });
        const agonyTarget = makeArenaObject('agony-target-1', '1', PLAYER_ZERO_START_ZONE, { life: 20 });
        const agonyState: MatchState<MageWarsCore> = {
            core: [agonizedAttacker, agonyTarget].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [agonyId]),
            ),
            sys: setupState('creatureAction').sys,
        };
        const agonyCast = runCommand(agonyState, castObjectSpellCommand(agonyId, 5, agonizedAttacker.id));
        const agonyEnchantment = Object.values(agonyCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === agonyId);
        const agonyCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            agonyCast.state.core,
            agonyEnchantment!.id,
            '展示文案改写后不包含任何攻击骰减少。',
        );

        const agonizedAttack = runCommand({
            core: agonyCoreWithEditedEnchantmentText,
            sys: { ...agonyCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: agonizedAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: agonyTarget.id,
            },
        });
        const agonizedAttackEvent = agonizedAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));
        expect(agonyCast.success).toBe(true);
        expect(agonizedAttackEvent?.payload).toMatchObject({
            attackDiceModifier: -2,
            attackDiceModifierSourceObjectIds: [agonyEnchantment!.id],
            diceResults: [3, 3],
            baseDamage: 6,
        });

        const woundedCat = makeArenaObject('regrowth-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            damage: 3,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const regrowthState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [regrowthId]),
                woundedCat,
            ),
            sys: setupState('creatureAction').sys,
        };
        const regrowthCast = runCommand(regrowthState, castObjectSpellCommand(regrowthId, 5, woundedCat.id));
        const regrowthEnchantment = Object.values(regrowthCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === regrowthId);
        const regrowthCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            regrowthCast.state.core,
            regrowthEnchantment!.id,
            '展示文案改写后不包含任何重生特性。',
        );
        const upkeep = runCommand({
            core: regrowthCoreWithEditedEnchantmentText,
            sys: { ...regrowthCast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const regenerationEvent = upkeep.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_REGENERATED
            && event.payload.objectId === woundedCat.id
        ));
        expect(regrowthCast.success).toBe(true);
        expect(regrowthEnchantment).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: woundedCat.id,
        });
        expect(regenerationEvent?.payload).toMatchObject({
            regeneration: 2,
            actualHealing: 2,
        });
        expect(regenerationEvent?.payload.sourceObjectIds).toEqual(expect.arrayContaining([regrowthEnchantment?.id]));
        expect(upkeep.state.core.objects[woundedCat.id].damage).toBe(1);

        const armoredTarget = makeArenaObject('rhino-hide-target-1', '1', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '拳击：快速近战 2 骰',
            armor: 0,
            life: 20,
        });
        const armorAttacker = makeArenaObject('rhino-hide-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const rhinoState: MatchState<MageWarsCore> = {
            core: [armoredTarget, armorAttacker].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [rhinoHideId]),
            ),
            sys: setupState('creatureAction').sys,
        };
        const rhinoCast = runCommand(rhinoState, castObjectSpellCommand(rhinoHideId, 4, armoredTarget.id));
        const rhinoEnchantment = Object.values(rhinoCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === rhinoHideId);
        const rhinoCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            rhinoCast.state.core,
            rhinoEnchantment!.id,
            '展示文案改写后不包含任何护甲加成。',
        );
        const armoredAttack = runCommand({
            core: rhinoCoreWithEditedEnchantmentText,
            sys: { ...rhinoCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: armorAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: armoredTarget.id,
            },
        });
        const armoredDamageEvent = armoredAttack.events.find((event) => event.type === 'DAMAGE_DEALT');
        expect(rhinoCast.success).toBe(true);
        expect(armoredDamageEvent?.payload).toMatchObject({
            targetId: armoredTarget.id,
            actualDamage: 4,
        });
        expect(armoredAttack.state.core.objects[armoredTarget.id].damage).toBe(4);

        const enduranceTarget = makeArenaObject('bull-endurance-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 4,
            damage: 1,
            attackOrTraitLine: '拳击：快速近战 2 骰',
        });
        const enduranceAttacker = makeArenaObject('bull-endurance-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const enduranceState: MatchState<MageWarsCore> = {
            core: [enduranceTarget, enduranceAttacker].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.PRIESTESS_APPRENTICE, [bullEnduranceId]),
            ),
            sys: setupState('creatureAction').sys,
        };
        const enduranceCast = runCommand(enduranceState, castObjectSpellCommand(bullEnduranceId, 5, enduranceTarget.id));
        const enduranceEnchantment = Object.values(enduranceCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === bullEnduranceId);
        const enduranceCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            enduranceCast.state.core,
            enduranceEnchantment!.id,
            '展示文案改写后不包含任何生命加成。',
        );
        const enduranceAttack = runCommand({
            core: enduranceCoreWithEditedEnchantmentText,
            sys: { ...enduranceCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: enduranceAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: enduranceTarget.id,
            },
        });
        expect(enduranceCast.success).toBe(true);
        expect(enduranceAttack.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(enduranceAttack.state.core.objects[enduranceTarget.id].damage).toBe(7);

        const swiftTarget = makeArenaObject('enfeebled-swift-cat-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰；迅捷',
        });
        const enfeebleState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [enfeebleId]),
                swiftTarget,
            ),
            sys: setupState('creatureAction').sys,
        };
        const enfeebleCast = runCommand(enfeebleState, castObjectSpellCommand(enfeebleId, 6, swiftTarget.id));
        const enfeebleEnchantment = Object.values(enfeebleCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === enfeebleId);
        const enfeebleCoreWithEditedEnchantmentText = withArenaObjectDisplayText(
            enfeebleCast.state.core,
            enfeebleEnchantment!.id,
            '展示文案改写后不包含任何迟缓特性。',
        );
        const slowedMove = runCommand({
            core: enfeebleCoreWithEditedEnchantmentText,
            sys: { ...enfeebleCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: swiftTarget.id, toZoneId: ARENA_ZONE_IDS.A2 },
        });
        const slowedMoveEvent = slowedMove.events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED);
        expect(enfeebleCast.success).toBe(true);
        expect(slowedMoveEvent?.payload).not.toMatchObject({ actionCost: 'none' });
        expect(slowedMove.state.core.objects[swiftTarget.id]).toMatchObject({
            zoneId: ARENA_ZONE_IDS.A2,
            actionReady: false,
        });
    });

    it('applies 1807 direct damage after normal movement, including free swift movement, but excludes teleport movement', () => {
        const normalTarget = makeArenaObject('agony-chain-normal-target-0', '0', PLAYER_ZERO_START_ZONE, {
            life: 10,
            attackOrTraitLine: '利爪：快速近战 2 骰；迅捷',
        });
        const normalState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [1807]),
                normalTarget,
            ),
            sys: setupState('creatureAction').sys,
        };
        const normalCast = runCommand(normalState, castObjectSpellCommand(1807, 3, normalTarget.id));
        const normalMove = runCommand({
            core: normalCast.state.core,
            sys: { ...normalCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: normalTarget.id, toZoneId: ARENA_ZONE_IDS.A2 },
        });
        const normalDamage = normalMove.events.find((event) => (
            event.type === 'DAMAGE_DEALT'
            && event.payload.targetId === normalTarget.id
        ));

        expect(normalCast.success).toBe(true);
        expect(normalMove.events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED)?.payload)
            .toMatchObject({ actionCost: 'none', movementMode: 'normal' });
        const normalEnchantment = Object.values(normalMove.state.core.objects)
            .find((object) => object.sourceSpellCardId === 1807);
        expect(normalEnchantment).toMatchObject({
            revealed: true,
            anchoredToObjectId: normalTarget.id,
            zoneId: ARENA_ZONE_IDS.A2,
        });
        expect(normalDamage?.payload).toMatchObject({
            amount: 1,
            actualDamage: 1,
            sourceAbilityId: 'mw.spell.1807.movement',
        });
        expect(normalMove.state.core.objects[normalTarget.id].damage).toBe(1);

        const teleportTarget = makeArenaObject('agony-chain-teleport-target-0', '0', PLAYER_ZERO_START_ZONE, {
            life: 10,
            temporaryTraits: { teleportMovement: true },
        });
        const teleportState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [1807]),
                teleportTarget,
            ),
            sys: setupState('creatureAction').sys,
        };
        const teleportCast = runCommand(teleportState, castObjectSpellCommand(1807, 3, teleportTarget.id));
        const teleportMove = runCommand({
            core: teleportCast.state.core,
            sys: { ...teleportCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: teleportTarget.id, toZoneId: ARENA_ZONE_IDS.A2 },
        });

        expect(teleportCast.success).toBe(true);
        expect(teleportMove.events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED)?.payload)
            .toMatchObject({ movementMode: 'teleport' });
        expect(teleportMove.events.some((event) => (
            event.type === 'DAMAGE_DEALT'
            && event.payload.targetId === teleportTarget.id
        ))).toBe(false);
        expect(teleportMove.state.core.objects[teleportTarget.id].damage).toBe(0);
    });

    it('uses structured death mark for each creature first attack per round', () => {
        const deathMarkSpellId = 1826;
        const target = makeArenaObject('death-mark-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 50,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const firstAttacker = makeArenaObject('death-mark-attacker-a-0', '0', PLAYER_ZERO_START_ZONE);
        const secondAttacker = makeArenaObject('death-mark-attacker-b-0', '0', PLAYER_ZERO_START_ZONE);
        const baseCore = withPreparedPlayerMage(
            setupState('creatureAction').core,
            '0',
            MAGE_IDS.WARLOCK_APPRENTICE,
            [deathMarkSpellId],
        );
        const state: MatchState<MageWarsCore> = {
            core: [target, firstAttacker, secondAttacker].reduce(
                (core, object) => withArenaObject(core, object),
                baseCore,
            ),
            sys: setupState('creatureAction').sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(deathMarkSpellId, 4, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === deathMarkSpellId);
        const coreWithoutDisplayText = withArenaObjectDisplayText(
            cast.state.core,
            enchantment!.id,
            '展示文案改写后不包含任何首攻加骰。',
        );

        const firstAttack = runCommand({
            core: coreWithoutDisplayText,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: firstAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const firstAttackEvent = firstAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        const secondAttack = runCommand({
            core: firstAttack.state.core,
            sys: { ...firstAttack.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: secondAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const secondAttackEvent = secondAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        const repeatAttackCore = withArenaObject(secondAttack.state.core, {
            ...secondAttack.state.core.objects[firstAttacker.id],
            actionReady: true,
        });
        const repeatAttack = runCommand({
            core: repeatAttackCore,
            sys: { ...secondAttack.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: firstAttacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });
        const repeatAttackEvent = repeatAttack.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(cast.success).toBe(true);
        expect(firstAttack.success).toBe(true);
        expect(secondAttack.success).toBe(true);
        expect(repeatAttack.success).toBe(true);
        expect(firstAttackEvent).toMatchObject({
            payload: {
                diceResults: [3, 3, 3],
                deathMarkDiceModifier: 1,
                deathMarkSourceObjectIds: [enchantment!.id],
            },
        });
        expect(secondAttackEvent).toMatchObject({
            payload: {
                diceResults: [3, 3, 3],
                deathMarkDiceModifier: 1,
            },
        });
        expect(repeatAttackEvent?.payload.diceResults).toEqual([3, 3]);
        expect(repeatAttackEvent?.payload).not.toHaveProperty('deathMarkDiceModifier');
        expect(repeatAttack.state.core.objects[enchantment!.id]).toMatchObject({
            deathMarkRoundNumber: repeatAttack.state.core.turnNumber,
            deathMarkAttackerObjectIdsThisRound: [firstAttacker.id, secondAttacker.id],
        });

        const multiStrikeTarget = makeArenaObject('death-mark-multi-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 100,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const multiStrikeAttacker = makeArenaObject('death-mark-multi-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '猛力噬咬：快速近战 4 骰，反击；三重噬咬：完整行动近战 3 骰，三连击；重生2；迟缓',
        });
        const multiStrikeState: MatchState<MageWarsCore> = {
            core: [multiStrikeTarget, multiStrikeAttacker].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(
                    setupState('creatureAction').core,
                    '0',
                    MAGE_IDS.WARLOCK_APPRENTICE,
                    [deathMarkSpellId],
                ),
            ),
            sys: setupState('creatureAction').sys,
        };
        const multiStrikeCast = runCommand(
            multiStrikeState,
            castObjectSpellCommand(deathMarkSpellId, 4, multiStrikeTarget.id),
        );
        const multiStrikeEnchantment = Object.values(multiStrikeCast.state.core.objects)
            .find((object) => object.sourceSpellCardId === deathMarkSpellId);
        const multiStrikeAttack = runCommand({
            core: multiStrikeCast.state.core,
            sys: { ...multiStrikeCast.state.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: multiStrikeAttacker.id,
                attackProfileId: 'attack-1',
                targetObjectId: multiStrikeTarget.id,
            },
        });
        const multiStrikeAttackEvents = multiStrikeAttack.events.filter((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED
        ));

        expect(multiStrikeCast.success).toBe(true);
        expect(multiStrikeAttack.success).toBe(true);
        expect(multiStrikeAttackEvents).toHaveLength(3);
        expect(multiStrikeAttackEvents).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    diceResults: [3, 3, 3, 3],
                    strikeIndex: 0,
                    strikeCount: 3,
                    deathMarkDiceModifier: 1,
                    deathMarkSourceObjectIds: [multiStrikeEnchantment!.id],
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    diceResults: [3, 3, 3, 3],
                    strikeIndex: 1,
                    strikeCount: 3,
                    deathMarkDiceModifier: 1,
                    deathMarkSourceObjectIds: [multiStrikeEnchantment!.id],
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    diceResults: [3, 3, 3, 3],
                    strikeIndex: 2,
                    strikeCount: 3,
                    deathMarkDiceModifier: 1,
                    deathMarkSourceObjectIds: [multiStrikeEnchantment!.id],
                }),
            }),
        ]);
        expect(multiStrikeAttack.state.core.objects[multiStrikeEnchantment!.id]).toMatchObject({
            deathMarkRoundNumber: multiStrikeAttack.state.core.turnNumber,
            deathMarkAttackerObjectIdsThisRound: [multiStrikeAttacker.id],
        });
    });

    it('resolves structured toxic upkeep damage and stops after the enchantment is removed', () => {
        const toxicUpkeepSpellId = 1820;
        const dispelSpellId = 3606;
        const target = makeArenaObject('toxic-upkeep-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            damage: 3,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [toxicUpkeepSpellId]),
                target,
            ),
            sys: setupState('creatureAction').sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(toxicUpkeepSpellId, 6, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === toxicUpkeepSpellId);
        const coreWithoutDisplayText = withArenaObjectDisplayText(
            cast.state.core,
            enchantment!.id,
            '展示文案改写后不包含任何维持伤害。',
        );
        const upkeep = runCommand({
            core: coreWithoutDisplayText,
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const damageEvent = upkeep.events.find((event) => (
            event.type === 'DAMAGE_DEALT'
            && event.payload.targetId === target.id
            && event.payload.sourceAbilityId === 'mw.spell.1820.upkeep'
        ));

        expect(cast.success).toBe(true);
        expect(enchantment).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: target.id,
        });
        expect(damageEvent?.payload).toMatchObject({
            amount: 2,
            actualDamage: 2,
        });
        expect(upkeep.state.core.objects[target.id].damage).toBe(5);

        const dispelCore = withPreparedPlayerMage(
            coreWithoutDisplayText,
            '0',
            MAGE_IDS.WARLOCK_APPRENTICE,
            [dispelSpellId],
        );
        const dispelled = runCommand({
            core: dispelCore,
            sys: { ...cast.state.sys, phase: 'creatureAction' },
        }, castObjectSpellCommand(dispelSpellId, 6, enchantment!.id));
        const laterUpkeep = runCommand({
            core: dispelled.state.core,
            sys: { ...dispelled.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(dispelled.success).toBe(true);
        expect(dispelled.state.core.objects[enchantment!.id]).toBeUndefined();
        expect(laterUpkeep.events).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    sourceAbilityId: 'mw.spell.1820.upkeep',
                }),
            }),
        ]));
    });

    it('offers Essence Drain upkeep payment to the creature controller and preserves the source when paid', () => {
        const essenceDrainSpellId = 1815;
        const target = makeArenaObject('essence-drain-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WIZARD_APPRENTICE, [essenceDrainSpellId]),
                target,
            ),
            sys: setupState('creatureAction').sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(essenceDrainSpellId, 6, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === essenceDrainSpellId);
        const upkeep = runCommand({
            core: withArenaObjectDisplayText(cast.state.core, enchantment!.id, '展示文案已移除。'),
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const interaction = getSimpleChoicePrompt(upkeep.state, 'mw.upkeep-cost.choice');
        const paid = runCommand(upkeep.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: interaction.id,
                optionId: 'pay',
            },
        } as Command);

        expect(cast.success).toBe(true);
        expect(upkeep.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.UPKEEP_COST_AVAILABLE);
        expect(interaction).toMatchObject({
            playerId: '1',
            data: {
                sourceId: 'mw.upkeep-cost.choice',
                options: expect.arrayContaining([
                    expect.objectContaining({ id: 'pay' }),
                    expect.objectContaining({ id: 'destroy' }),
                ]),
            },
        });
        expect(interaction?.data.choiceRequest).toMatchObject({
            sourceId: 'mw.upkeep-cost.choice',
            metadata: expect.objectContaining({
                opportunityId: interaction.id,
                mageWarsTimingOpportunity: 'mage-wars.upkeep-cost',
                sourceAbilityId: `mw.spell.${essenceDrainSpellId}.upkeep`,
                targetObjectId: target.id,
                amount: 2,
            }),
        });
        expect(interaction?.data.ai).toMatchObject({ status: 'semantic' });
        expect((interaction?.data.ai?.decisions?.[0] as AiDecisionDescriptor | undefined)?.metadata)
            .toMatchObject({
                opportunityId: interaction.id,
                mageWarsTimingOpportunity: 'mage-wars.upkeep-cost',
            });
        const aiActions = buildAiLegalActionsFromInteractionDecision(
            interaction.data.ai!.decisions![0] as AiDecisionDescriptor,
        );
        expect(aiActions.map((action) => (action.commands[0]?.payload as { optionId?: string }).optionId))
            .toEqual(expect.arrayContaining(['pay', 'destroy']));
        expect(paid.success).toBe(true);
        expect(paid.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MANA_SPENT,
                payload: expect.objectContaining({
                    playerId: '1',
                    amount: 2,
                    spellCardId: essenceDrainSpellId,
                    targetObjectId: target.id,
                }),
            }),
        ]));
        expect(paid.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_DRAINED);
        expect(paid.state.core.players['1'].mana).toBe(8);
        expect(paid.state.core.objects[enchantment!.id]).toBeDefined();
    });

    it('forces Essence Drain destruction when the creature controller cannot pay', () => {
        const essenceDrainSpellId = 1815;
        const target = makeArenaObject('essence-drain-insufficient-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage({
                    ...base.core,
                    players: {
                        ...base.core.players,
                        '1': { ...base.core.players['1'], mana: 1 },
                    },
                }, '0', MAGE_IDS.WIZARD_APPRENTICE, [essenceDrainSpellId]),
                target,
            ),
            sys: base.sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(essenceDrainSpellId, 6, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === essenceDrainSpellId);
        const upkeep = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(upkeep.success).toBe(true);
        expect(upkeep.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.UPKEEP_COST_AVAILABLE);
        expect(upkeep.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE);
        expect(upkeep.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(upkeep.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(upkeep.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE,
                payload: expect.objectContaining({
                    sourceObjectId: enchantment!.id,
                    sourceAbilityId: `mw.spell.${essenceDrainSpellId}.upkeep`,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: enchantment!.id,
                    sourceAbilityId: `mw.spell.${essenceDrainSpellId}.upkeep`,
                }),
            }),
        ]));
        const consumeAvailableIndex = upkeep.events.findIndex((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE
            && event.payload.sourceObjectId === enchantment!.id
        ));
        const sourceDefeatedIndex = upkeep.events.findIndex((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED
            && event.payload.objectId === enchantment!.id
        ));
        expect(consumeAvailableIndex).toBeGreaterThanOrEqual(0);
        expect(sourceDefeatedIndex).toBeGreaterThanOrEqual(0);
        expect(consumeAvailableIndex).toBeLessThan(sourceDefeatedIndex);
        expect(upkeep.state.core.players['1'].mana).toBe(1);
        expect(upkeep.state.core.objects[enchantment!.id]).toBeUndefined();
    });

    it('ignores a stale Essence Drain upkeep response after the source was removed', () => {
        const essenceDrainSpellId = 1815;
        const target = makeArenaObject('essence-drain-stale-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.WIZARD_APPRENTICE, [essenceDrainSpellId]),
                target,
            ),
            sys: base.sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(essenceDrainSpellId, 6, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === essenceDrainSpellId);
        const upkeep = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const staleState: MatchState<MageWarsCore> = {
            ...upkeep.state,
            core: {
                ...upkeep.state.core,
                objects: Object.fromEntries(
                    Object.entries(upkeep.state.core.objects)
                        .filter(([objectId]) => objectId !== enchantment!.id),
                ),
            },
        };
        const responded = runCommand(staleState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: getPromptInteractionId(upkeep.state, 'mw.upkeep-cost.choice'),
                optionId: 'pay',
            },
        } as Command);

        expect(responded.success).toBe(true);
        expect(responded.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.MANA_SPENT);
        expect(responded.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(responded.state.core.players['1'].mana).toBe(10);
    });

    it('offers Death Link upkeep healing transfer to the enchantment controller', () => {
        const deathLinkSpellId = 1801;
        const target = makeArenaObject('death-link-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            damage: 1,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const base = setupState('creatureAction');
        const preparedCore = withPreparedPlayerMage(
            base.core,
            '0',
            MAGE_IDS.WARLOCK_APPRENTICE,
            [deathLinkSpellId],
        );
        const damagedMageCore: MageWarsCore = {
            ...preparedCore,
            players: {
                ...preparedCore.players,
                '0': { ...preparedCore.players['0'], damage: 3 },
            },
        };
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(damagedMageCore, target),
            sys: base.sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(deathLinkSpellId, 8, target.id));
        const enchantment = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === deathLinkSpellId);
        const upkeep = runCommand({
            core: withArenaObjectDisplayText(cast.state.core, enchantment!.id, '展示文案已移除。'),
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        const interaction = getSimpleChoicePrompt(upkeep.state, 'mw.upkeep-heal-transfer.choice');
        const healed = runCommand(upkeep.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: interaction.id,
                optionId: 'heal-2',
            },
        } as Command);

        expect(cast.success).toBe(true);
        expect(upkeep.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.UPKEEP_HEAL_TRANSFER_AVAILABLE);
        expect(interaction).toMatchObject({
            playerId: '0',
            data: {
                sourceId: 'mw.upkeep-heal-transfer.choice',
                options: expect.arrayContaining([
                    expect.objectContaining({ id: 'heal-1' }),
                    expect.objectContaining({ id: 'heal-2' }),
                    expect.objectContaining({ id: 'skip' }),
                ]),
            },
        });
        expect(interaction?.data.choiceRequest).toMatchObject({
            sourceId: 'mw.upkeep-heal-transfer.choice',
            metadata: expect.objectContaining({
                opportunityId: interaction.id,
                mageWarsTimingOpportunity: 'mage-wars.upkeep-heal-transfer',
                sourceAbilityId: `mw.spell.${deathLinkSpellId}.upkeep`,
                sourceObjectId: enchantment!.id,
                targetObjectId: target.id,
                maxHealing: 2,
                availableHealing: 2,
            }),
        });
        expect(interaction?.data.ai).toMatchObject({ status: 'semantic' });
        const aiActions = buildAiLegalActionsFromInteractionDecision(
            interaction.data.ai!.decisions![0] as AiDecisionDescriptor,
        );
        expect(aiActions.map((action) => (action.commands[0]?.payload as { optionId?: string }).optionId))
            .toEqual(expect.arrayContaining(['heal-1', 'heal-2', 'skip']));
        expect(healed.success).toBe(true);
        expect(healed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: expect.objectContaining({
                    playerId: '0',
                    spellCardId: deathLinkSpellId,
                    targetPlayerId: '0',
                    healing: 2,
                    actualHealing: 2,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.UPKEEP_HEAL_TRANSFER_DAMAGE_AVAILABLE,
                payload: expect.objectContaining({
                    playerId: '0',
                    sourceObjectId: enchantment!.id,
                    sourceSpellCardId: deathLinkSpellId,
                    targetObjectId: target.id,
                    amount: 2,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    actualDamage: 2,
                    sourceAbilityId: `mw.spell.${deathLinkSpellId}.upkeep`,
                }),
            }),
        ]));
        expect(healed.state.core.players['0'].damage).toBe(1);
        expect(healed.state.core.objects[target.id].damage).toBe(3);
    });

    it('does not create a Death Link upkeep choice when the controller mage has no damage', () => {
        const deathLinkSpellId = 1801;
        const target = makeArenaObject('death-link-full-mage-target-1', '1', ARENA_ZONE_IDS.A2, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(base.core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [deathLinkSpellId]),
                target,
            ),
            sys: base.sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(deathLinkSpellId, 8, target.id));
        const upkeep = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(cast.success).toBe(true);
        expect(upkeep.success).toBe(true);
        expect(upkeep.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.UPKEEP_HEAL_TRANSFER_AVAILABLE);
        expect(getPromptSourceId(upkeep.state)).not.toBe('mw.upkeep-heal-transfer.choice');
    });

    it('does not resolve structured toxic upkeep damage against toxin-immune creatures', () => {
        const toxicUpkeepSpellId = 1820;
        const target = makeArenaObject('toxic-upkeep-immune-target-1', '1', ARENA_ZONE_IDS.A2, {
            typeLine: '生物；活体；毒素免疫',
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.WARLOCK_APPRENTICE, [toxicUpkeepSpellId]),
                target,
            ),
            sys: setupState('creatureAction').sys,
        };
        const cast = runCommand(state, castObjectSpellCommand(toxicUpkeepSpellId, 6, target.id));
        const upkeep = runCommand({
            core: cast.state.core,
            sys: { ...cast.state.sys, phase: 'channel' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(cast.success).toBe(true);
        expect(upkeep.events).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({ targetId: target.id }),
            }),
        ]));
        expect(upkeep.state.core.objects[target.id].damage).toBe(0);
    });

    it('casts Force Grip from structured semantics and clears restraint when dispelled', () => {
        const forceGripSpellId = 1908;
        const forcePushSpellId = 3425;
        const teleportSpellId = 3410;
        const dispelSpellId = 3606;
        const base = setupState('creatureAction');
        const target = makeArenaObject('force-grip-target-1', '1', ARENA_ZONE_IDS.A2, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const uncontainableTarget = makeArenaObject('force-grip-uncontainable-1', '1', ARENA_ZONE_IDS.A2, {
            attackOrTraitLine: '利爪：快速近战 2 骰；不羁',
        });
        const preparedCore = withPreparedPlayerMage(
            withArenaObject(withArenaObject(base.core, target), uncontainableTarget),
            '0',
            MAGE_IDS.WIZARD_APPRENTICE,
            [forceGripSpellId],
        );
        const state: MatchState<MageWarsCore> = { core: preparedCore, sys: base.sys };

        expect(validateCommand(state, castObjectSpellCommand(forceGripSpellId, 4, uncontainableTarget.id)))
            .toBe('invalidTargetObject');
        const cast = runCommand(state, castObjectSpellCommand(forceGripSpellId, 4, target.id));
        const enchantment = Object.values(cast.state.core.objects).find((object) => (
            object.sourceSpellCardId === forceGripSpellId && object.anchoredToObjectId === target.id
        ));
        const coreWithoutDisplayText = withArenaObjectDisplayText(cast.state.core, enchantment!.id, '');

        expect(cast.success).toBe(true);
        expect(cast.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_RESTRAINED,
                payload: expect.objectContaining({
                    objectId: target.id,
                    restrainedByObjectId: enchantment!.id,
                    spellCardId: forceGripSpellId,
                }),
            }),
        ]));
        expect(coreWithoutDisplayText.objects[enchantment!.id]).toMatchObject({
            attackOrTraitLine: undefined,
            rulesText: '',
        });
        expect(coreWithoutDisplayText.objects[target.id]).toMatchObject({
            restrainedByObjectId: enchantment!.id,
        });

        expect(validateCommand({
            core: {
                ...coreWithoutDisplayText,
                currentPlayerId: '1',
            },
            sys: { ...base.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '1',
            payload: { objectId: target.id, toZoneId: ARENA_ZONE_IDS.A3 },
        })).toBe('objectCrippled');

        const forcePushCore = withPreparedPlayerMage(coreWithoutDisplayText, '0', MAGE_IDS.WARLOCK_APPRENTICE, [forcePushSpellId]);
        expect(validateCommand({
            core: forcePushCore,
            sys: { ...base.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: forcePushSpellId,
                manaCost: 3,
                targetObjectId: target.id,
                pushToZoneId: ARENA_ZONE_IDS.A3,
            },
        })).toBe('targetUnmovable');

        const teleportCore = withPreparedPlayerMage(coreWithoutDisplayText, '0', MAGE_IDS.WIZARD_APPRENTICE, [teleportSpellId]);
        expect(validateCommand({
            core: teleportCore,
            sys: { ...base.sys, phase: 'creatureAction' },
        }, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: teleportSpellId,
                manaCost: 3,
                targetObjectId: target.id,
                targetZoneId: ARENA_ZONE_IDS.A3,
            },
        })).toBe('targetUnmovable');

        const dispelCore = withPreparedPlayerMage(coreWithoutDisplayText, '0', MAGE_IDS.WIZARD_APPRENTICE, [dispelSpellId]);
        const dispelled = runCommand({
            core: dispelCore,
            sys: { ...base.sys, phase: 'creatureAction' },
        }, castObjectSpellCommand(dispelSpellId, 4, enchantment!.id));

        expect(dispelled.success).toBe(true);
        expect(dispelled.state.core.objects[enchantment!.id]).toBeUndefined();
        expect(dispelled.state.core.objects[target.id]?.restrainedByObjectId).toBeUndefined();
    });

    it('uses a configured attached enchantment defense profile in the defense choice window', () => {
        const reflectionId = 1809;
        const target = makeArenaObject('reflection-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const attacker = makeArenaObject('reflection-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const baseState = setupState('creatureAction');
        const preparedCore = withPreparedPlayerMage(
            baseState.core,
            '0',
            MAGE_IDS.BEASTMASTER_APPRENTICE,
            [reflectionId],
        );
        const cast = runCommand({
            core: withArenaObject(preparedCore, target),
            sys: baseState.sys,
        }, castObjectSpellCommand(reflectionId, 7, target.id));
        const attachedReflection = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === reflectionId);
        const coreWithEditedReflectionText = withArenaObjectDisplayText(
            cast.state.core,
            attachedReflection!.id,
            '展示文案改写后不包含防御图标。',
        );

        const attacked = runCommand({
            core: withArenaObject(coreWithEditedReflectionText, attacker),
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

        expect(cast.success).toBe(true);
        expect(attachedReflection).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: target.id,
            combatProfilesSource: 'config',
        });
        expect(attacked.success).toBe(true);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        expect(getSimpleChoicePrompt(attacked.state, 'mw.defense.choice').data).toMatchObject({
            sourceId: 'mw.defense.choice',
            options: expect.arrayContaining([
                expect.objectContaining({
                    id: 'defend-defense-0',
                    value: expect.objectContaining({
                        defenseProfileId: 'defense-0',
                    }),
                }),
            ]),
        });
    });

    it('forces configured Block to evade and consume itself without a defense roll', () => {
        const blockId = 1806;
        const target = makeArenaObject('block-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const attacker = makeArenaObject('block-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const baseState = setupState('creatureAction');
        const cast = runCommand({
            core: withArenaObject(
                withPreparedPlayerMage(baseState.core, '0', MAGE_IDS.WIZARD_APPRENTICE, [blockId]),
                target,
            ),
            sys: baseState.sys,
        }, castObjectSpellCommand(blockId, 4, target.id));
        const attachedBlock = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === blockId);
        const coreWithEditedBlockText = withArenaObjectDisplayText(
            cast.state.core,
            attachedBlock!.id,
            '展示文案改写后不包含自动回避规则。',
        );
        const attacked = runCommand({
            core: withArenaObject(coreWithEditedBlockText, attacker),
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
        const defenseAvailable = attacked.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.DEFENSE_AVAILABLE
        ));
        const defended = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: getPromptInteractionId(attacked.state, 'mw.defense.choice'),
                optionId: 'defend-defense-0',
            },
        } as Command);

        expect(cast.success).toBe(true);
        expect(attachedBlock).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: target.id,
            combatProfilesSource: 'config',
        });
        expect(attacked.success).toBe(true);
        expect(defenseAvailable).toMatchObject({
            type: MAGE_WARS_EVENTS.DEFENSE_AVAILABLE,
            payload: {
                defenseProfileIds: ['defense-0'],
                requiredDefenseProfileId: 'defense-0',
            },
        });
        expect(getPromptOptions(attacked.state)).toEqual([
            expect.objectContaining({ id: 'defend-defense-0' }),
        ]);
        expect(defended.success).toBe(true);
        expect(defended.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ATTACK_MISSED);
        expect(defended.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(defended.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED);
        expect(defended.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        expect(defended.state.core.objects[attachedBlock!.id]).toBeUndefined();
        expect(defended.state.core.objects[target.id].damage).toBe(0);
    });

    it('destroys Block against an unavoidable attack and continues the attack', () => {
        const blockId = 1806;
        const target = makeArenaObject('unavoidable-block-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const attacker = makeArenaObject('unavoidable-block-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '斩首刃：快速近战 4 骰，无法回避',
        });
        const baseState = setupState('creatureAction');
        const cast = runCommand({
            core: withArenaObject(
                withPreparedPlayerMage(baseState.core, '0', MAGE_IDS.WIZARD_APPRENTICE, [blockId]),
                target,
            ),
            sys: baseState.sys,
        }, castObjectSpellCommand(blockId, 4, target.id));
        const attachedBlock = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === blockId);
        const attacked = runCommand({
            core: withArenaObject(cast.state.core, attacker),
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
        const rawAttackEvents = resolveMageWarsObjectAttackEvents({
            state: {
                core: withArenaObject(cast.state.core, attacker),
                sys: { ...cast.state.sys, phase: 'creatureAction' },
            },
            sourceCommandType: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            timestamp: 0,
            random: fixedRandom,
            attackerObjectId: attacker.id,
            attackProfileId: 'attack-0',
            targetObjectId: target.id,
        });
        const rawAttackEventTypes = rawAttackEvents.map((event) => event.type);

        expect(cast.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(rawAttackEventTypes).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE);
        expect(rawAttackEventTypes).not.toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(attacked.events.map((event) => event.type)).not.toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED);
        expect(attacked.state.core.objects[attachedBlock!.id]).toBeUndefined();
        expect(attacked.state.core.objects[target.id].damage).toBe(12);
    });

    it('keeps Force Blade defense available through stun while retaining daze dice penalties', () => {
        const forceBladeId = 1818;
        const target = makeArenaObject('force-blade-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
                [STATUS_TOKEN_IDS.DAZE]: 1,
            },
        });
        const attacker = makeArenaObject('force-blade-attacker-0', '0', PLAYER_ZERO_START_ZONE);
        const baseState = setupState('creatureAction');
        const preparedCore = withPreparedPlayerMage(
            baseState.core,
            '0',
            MAGE_IDS.WIZARD_APPRENTICE,
            [forceBladeId],
        );
        const cast = runCommand({
            core: withArenaObject(preparedCore, target),
            sys: baseState.sys,
        }, castObjectSpellCommand(forceBladeId, 5, target.id));
        const attacked = runCommand({
            core: withArenaObject(cast.state.core, attacker),
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
        const rawNineRandom: RandomFn = {
            ...fixedRandom,
            d: (sides: number) => (sides === 12 ? 9 : fixedRandom.d(sides)),
        };
        const defended = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: {
                interactionId: getPromptInteractionId(attacked.state, 'mw.defense.choice'),
                optionId: 'defend-defense-0',
            },
        } as Command, rawNineRandom);
        const defenseRoll = defended.events.find((event) => (
            event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED
        ));

        expect(cast.success).toBe(true);
        expect(attacked.success).toBe(true);
        expect(attacked.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.DEFENSE_AVAILABLE);
        expect(defended.success).toBe(true);
        expect(defenseRoll).toMatchObject({
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED,
            payload: {
                defenderObjectId: target.id,
                defenseProfileId: 'defense-0',
                defenseMinRoll: 8,
                rawEffectDieResult: 9,
                defenseDieModifier: -2,
                modifiedEffectDieResult: 7,
                success: false,
            },
        });
    });

    it('rejects visible object enchantments when the printed target rule is not met', () => {
        const bearStrengthId = 1914;
        const skeleton = makeArenaObject('bear-strength-skeleton-1', '1', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2826,
            sourceObjectId: 'spell-card-2826',
            name: '骷髅哨兵',
            attackOrTraitLine: '短剑：快速近战 4 骰；非活体',
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(setupState('creatureAction').core, '0', MAGE_IDS.BEASTMASTER_APPRENTICE, [bearStrengthId]),
                skeleton,
            ),
            sys: setupState('creatureAction').sys,
        };

        expect(validateCommand(state, castObjectSpellCommand(bearStrengthId, 5, skeleton.id)))
            .toBe('invalidTargetObject');
        expect(validateCommand(state, castObjectSpellCommand(bearStrengthId, 4, makeArenaObject('missing', '1', PLAYER_ZERO_START_ZONE).id)))
            .toBe('invalidTargetObject');
    });

    it('casts the configured swift, elusive, and limited-life enchantments through the real spell entry', () => {
        const cases = [
            { spellCardId: 1900, mageId: MAGE_IDS.BEASTMASTER_APPRENTICE, timestamp: 1 },
            { spellCardId: 1902, mageId: MAGE_IDS.WARLOCK_APPRENTICE, timestamp: 2 },
            { spellCardId: 1915, mageId: MAGE_IDS.BEASTMASTER_APPRENTICE, timestamp: 3 },
        ] as const;

        for (const testCase of cases) {
            const target = makeArenaObject(`configured-entry-target-${testCase.spellCardId}`, '0', PLAYER_ZERO_START_ZONE, {
                attackOrTraitLine: '利爪：快速近战 2 骰',
            });
            const state: MatchState<MageWarsCore> = {
                core: withArenaObject(
                    withPreparedPlayerMage(
                        setupState('creatureAction').core,
                        '0',
                        testCase.mageId,
                        [testCase.spellCardId],
                    ),
                    target,
                ),
                sys: setupState('creatureAction').sys,
            };

            const cast = runCommand(state, {
                ...castObjectSpellCommand(testCase.spellCardId, 5, target.id),
                timestamp: testCase.timestamp,
            });
            const enchantment = Object.values(cast.state.core.objects)
                .find((object) => object.sourceSpellCardId === testCase.spellCardId);

            expect(cast.success).toBe(true);
            expect(enchantment).toMatchObject({
                kind: 'enchantment',
                revealed: true,
                anchoredToObjectId: target.id,
                createdAtTimestamp: testCase.timestamp,
            });
        }
    });

    it('triggers teleport trap when an enemy creature enters the trapped zone', () => {
        const target = makeArenaObject('teleport-trap-target-1', '1', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const initialState: MatchState<MageWarsCore> = {
            core: {
                ...withArenaObject(
                    withPreparedPlayerMage(
                        setupState('creatureAction').core,
                        '0',
                        MAGE_IDS.WIZARD_APPRENTICE,
                        [1907],
                    ),
                    target,
                ),
                phaseActorId: '0',
            },
            sys: setupState('creatureAction').sys,
        };
        const trapped = runCommand(initialState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            timestamp: 1,
            payload: {
                spellCardId: 1907,
                manaCost: 4,
                targetZoneId: ARENA_ZONE_IDS.A2,
            },
        });

        expect(trapped.success).toBe(true);
        const trap = Object.values(trapped.state.core.objects)
            .find((object) => object.sourceSpellCardId === 1907);
        expect(trap).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToZoneId: ARENA_ZONE_IDS.A2,
        });

        const movingState: MatchState<MageWarsCore> = {
            ...trapped.state,
            core: {
                ...trapped.state.core,
                phaseActorId: '1',
            },
        };
        const entered = runCommand(movingState, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '1',
            timestamp: 2,
            payload: {
                objectId: target.id,
                toZoneId: ARENA_ZONE_IDS.A2,
            },
        });

        expect(entered.success).toBe(true);
        const prompt = getSimpleChoicePrompt(entered.state, 'mw.teleport-trap.choice');
        const destinationOption = getPromptOptions(entered.state)
            .find((option) => option.id === 'zone-a1');
        expect(destinationOption).toBeDefined();

        const resolved = runCommand(entered.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: prompt.id,
                optionId: destinationOption!.id,
            },
        });

        expect(resolved.success).toBe(true);
        expect(resolved.state.core.objects[target.id]?.zoneId).toBe(ARENA_ZONE_IDS.A1);
        expect(resolved.state.core.objects[trap!.id]).toBeUndefined();
        expect(resolved.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED,
            MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
        ]));
    });

    it('triggers Inferno Trap attack and destroys the trap when an enemy creature enters', () => {
        const target = makeArenaObject('inferno-trap-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const initialState: MatchState<MageWarsCore> = {
            core: {
                ...withArenaObject(
                    withPreparedPlayerMage(
                        setupState('creatureAction').core,
                        '0',
                        MAGE_IDS.WARLOCK_APPRENTICE,
                        [1823],
                    ),
                    target,
                ),
                phaseActorId: '0',
            },
            sys: setupState('creatureAction').sys,
        };
        const trapped = runCommand(initialState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            timestamp: 1,
            payload: {
                spellCardId: 1823,
                manaCost: 4,
                targetZoneId: ARENA_ZONE_IDS.A2,
            },
        });
        const trap = Object.values(trapped.state.core.objects)
            .find((object) => object.sourceSpellCardId === 1823);

        const entered = runCommand({
            ...trapped.state,
            core: {
                ...trapped.state.core,
                phaseActorId: '1',
            },
        }, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '1',
            timestamp: 2,
            payload: {
                objectId: target.id,
                toZoneId: ARENA_ZONE_IDS.A2,
            },
        });

        expect(trapped.success).toBe(true);
        expect(entered.success).toBe(true);
        expect(entered.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
                payload: expect.objectContaining({
                    spellCardId: 1823,
                    targetObjectId: target.id,
                    diceResults: [3, 3, 3, 3],
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: target.id,
                    sourceAbilityId: 'mw.spell.1823',
                    actualDamage: 12,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: expect.objectContaining({
                    objectId: trap?.id,
                    sourceAbilityId: 'mw.spell.1823.inferno-trap',
                    spellCardId: 1823,
                }),
            }),
        ]));
        expect(entered.state.core.objects[trap!.id]).toBeUndefined();
        expect(entered.state.core.objects[target.id]?.damage).toBe(12);
    });

    it('consumes configured swift/elusive grants and applies limited life in effect order', () => {
        const target = makeArenaObject('configured-grant-target-0', '0', PLAYER_ZERO_START_ZONE, {
            life: 10,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const makeConfiguredEnchantment = (
            objectId: string,
            sourceSpellCardId: number,
            createdAtSequence: number,
            createdAtTimestamp: number,
        ) => makeVisibleEnchantmentObject(objectId, '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId,
            sourceObjectId: `spell-card-${sourceSpellCardId}`,
            anchoredToObjectId: target.id,
            createdAtSequence,
            createdAtTimestamp,
        });
        const configuredEnchantments = [
            makeConfiguredEnchantment('configured-bull-early', 1808, 1, 1),
            makeConfiguredEnchantment('configured-limited-life', 1902, 2, 2),
            makeConfiguredEnchantment('configured-bull-late', 1808, 3, 3),
            makeConfiguredEnchantment('configured-swift', 1915, 4, 4),
            makeConfiguredEnchantment('configured-elusive', 1900, 5, 5),
        ];
        const core = [target, ...configuredEnchantments].reduce(
            (nextCore, object) => withArenaObject(nextCore, object),
            setupState('creatureAction').core,
        );

        expect(resolveMageWarsObjectEffectiveLife(core, target)).toBe(14);
        expect(isMageWarsLimitedLifeArenaObject(core, target)).toBe(true);
        expect(isMageWarsSwiftArenaObject(target, core)).toBe(true);
        expect(isMageWarsElusiveArenaObject(target, core)).toBe(true);

        const limitedFirstTarget = makeArenaObject('configured-limited-first-target-0', '0', PLAYER_ZERO_START_ZONE, {
            life: 10,
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const limitedFirstCore = [
            limitedFirstTarget,
            makeVisibleEnchantmentObject('configured-limited-first', '0', PLAYER_ZERO_START_ZONE, {
                sourceSpellCardId: 1902,
                sourceObjectId: 'spell-card-1902',
                anchoredToObjectId: limitedFirstTarget.id,
                createdAtSequence: 1,
                createdAtTimestamp: 1,
            }),
            makeVisibleEnchantmentObject('configured-life-after-limited', '0', PLAYER_ZERO_START_ZONE, {
                sourceSpellCardId: 1808,
                sourceObjectId: 'spell-card-1808',
                anchoredToObjectId: limitedFirstTarget.id,
                createdAtSequence: 2,
                createdAtTimestamp: 2,
            }),
        ].reduce(
            (nextCore, object) => withArenaObject(nextCore, object),
            setupState('creatureAction').core,
        );

        expect(resolveMageWarsObjectEffectiveLife(limitedFirstCore, limitedFirstTarget)).toBe(10);
    });

    it('applies Lightning Ring damage barrier from an attached creature enchantment', () => {
        const attacker = makeArenaObject('lightning-ring-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰',
        });
        const target = makeArenaObject('lightning-ring-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
        });
        const state: MatchState<MageWarsCore> = {
            core: [attacker, target].reduce(
                (core, object) => withArenaObject(core, object),
                withPreparedPlayerMage(
                    setupState('creatureAction').core,
                    '0',
                    MAGE_IDS.WIZARD_APPRENTICE,
                    [1810],
                ),
            ),
            sys: setupState('creatureAction').sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(1810, 6, target.id));
        const ring = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === 1810);
        const attack = runCommand(cast.state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: attacker.id,
                attackProfileId: 'attack-0',
                targetObjectId: target.id,
            },
        });

        expect(cast.success).toBe(true);
        expect(ring).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: target.id,
            combatTraitsSource: 'config',
        });
        expect(attack.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED,
                payload: expect.objectContaining({
                    sourceObjectId: ring?.id,
                    sourceSpellCardId: 1810,
                    attackerObjectId: attacker.id,
                    diceResults: [3, 3],
                    damageTypes: ['闪电'],
                    unavoidable: true,
                    lethal: false,
                }),
            }),
            expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({
                    targetId: attacker.id,
                    sourceAbilityId: 'mw.spell.1810.damage-barrier',
                    actualDamage: 3,
                }),
            }),
        ]));
        expect(attack.state.core.objects[attacker.id]?.damage).toBe(3);
    });

    it('adds Mana Fusion channeling to a configured spawn point during channel phase', () => {
        const spawnPoint = makeArenaObject('mana-fusion-spawn-point-0', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'conjuration',
            sourceSpellCardId: 2218,
            sourceObjectId: 'spell-card-2218',
            name: '召唤点',
            typeLine: '魔物 / 生成点',
            spellcastingSource: {
                abilityId: 'mw.source.2218.spawn-point',
                kind: 'spawn-point',
                phase: 'deployment',
                allowedSpellTypes: ['生物'],
                channeling: 4,
            },
            mana: 0,
        });
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withPreparedPlayerMage(
                    setupState('creatureAction').core,
                    '0',
                    MAGE_IDS.WIZARD_APPRENTICE,
                    [1821],
                ),
                spawnPoint,
            ),
            sys: setupState('creatureAction').sys,
        };

        const cast = runCommand(state, castObjectSpellCommand(1821, 4, spawnPoint.id));
        const fusion = Object.values(cast.state.core.objects)
            .find((object) => object.sourceSpellCardId === 1821);
        const channel = runCommand({
            ...cast.state,
            sys: { ...cast.state.sys, phase: 'reset' },
        }, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(cast.success).toBe(true);
        expect(fusion).toMatchObject({
            kind: 'enchantment',
            revealed: true,
            anchoredToObjectId: spawnPoint.id,
        });
        expect(channel.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.OBJECT_MANA_CHANNELED,
                payload: expect.objectContaining({
                    objectId: spawnPoint.id,
                    amount: 5,
                }),
            }),
        ]));
        expect(channel.state.core.objects[spawnPoint.id]?.mana).toBe(5);
    });
});
