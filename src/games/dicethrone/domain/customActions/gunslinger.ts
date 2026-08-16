import { createBonusDiceWithReroll, createDisplayOnlySettlement, registerCustomActionHandler, resolveEffectsToEvents, type CustomActionContext } from '../effects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { registerChoiceResolvedEventHandler } from '../choiceResolvedEvents';
import { GUNSLINGER_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../ids';
import { getActiveDice, getMaxDuplicateValueCount, getOpponents, getPendingBonusSettlementDice, getPlayerDiceDefinitionId, getPlayerDieFace, getSeatingOrder, getSelectedCombatOpponentId, getTokenStackLimit } from '../rules';
import { RESOURCE_IDS } from '../resources';
import { CP_MAX } from '../types';
import type { PendingInteraction } from '../core-types';
import type { AbilityDef, AbilityVariantDef } from '../combat';
import type {
    BonusDamageAddedEvent,
    CpChangedEvent,
    DamageDealtEvent,
    DamageShieldGrantedEvent,
    DiceThroneEvent,
    InteractionRequestedEvent,
    StatusAppliedEvent,
} from '../events';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import { createCompareRollContext } from '../rollContext';

const GUNSLINGER_LOADED_SETTLEMENT_ID = 'gunslinger-loaded-use';
const GUNSLINGER_EAT_MY_LEAD_SETTLEMENT_ID = 'gunslinger-eat-my-lead';
const GUNSLINGER_HIGH_NOON_SETTLEMENT_ID = 'gunslinger-high-noon';

const getRequiredPlayerDiceDefinitionId = (
    state: CustomActionContext['state'],
    playerId: string,
    sourceAbilityId: string,
): string => {
    const definitionId = getPlayerDiceDefinitionId(state, playerId);
    if (!definitionId) {
        throw new Error(`[DiceThrone] ${sourceAbilityId} 对掷骰缺少玩家骰子定义：playerId=${playerId}`);
    }
    return definitionId;
};

function createLoadedChoiceContext(
    state: CustomActionContext['state'],
    attackerId: string,
    sourceAbilityId: string,
    timestamp: number,
    random: CustomActionContext['random'],
): CustomActionContext {
    const opponentId = getSelectedCombatOpponentId(state, attackerId, state.turnPhase)
        ?? state.pendingAttack?.defenderId
        ?? attackerId;
    return {
        ctx: {
            attackerId,
            defenderId: opponentId,
            sourceAbilityId,
            state,
            damageDealt: 0,
            timestamp,
        },
        targetId: opponentId,
        attackerId,
        sourceAbilityId,
        state,
        timestamp,
        random,
        action: { type: 'custom', target: 'self', customActionId: 'gunslinger-loaded-use' },
    };
}

const abilityMatchesId = (ability: AbilityDef, abilityId: string): boolean =>
    ability.id === abilityId || ability.variants?.some((variant: AbilityVariantDef) => variant.id === abilityId) === true;

const getLoadedRerollCount = (ability: AbilityDef | AbilityVariantDef | undefined, scope: 'sourceAbility' | 'allTokenUses'): number => {
    const hook = ability?.tokenBonusDieReroll;
    const isMatchingHook = hook?.tokenId === TOKEN_IDS.LOADED
        && hook.maxRerollCount > 0
        && (hook.scope ?? 'sourceAbility') === scope;
    return isMatchingHook ? hook.maxRerollCount : 0;
};

const getSourceAbilityLoadedRerollCount = (
    state: CustomActionContext['state'],
    attackerId: string,
    sourceAbilityId: string,
): number => {
    const ability = state.players[attackerId]?.abilities.find(def => abilityMatchesId(def, sourceAbilityId));
    const variant = ability?.variants?.find(def => def.id === sourceAbilityId);
    return Math.max(
        getLoadedRerollCount(variant, 'sourceAbility'),
        getLoadedRerollCount(ability, 'sourceAbility'),
    );
};

const getGlobalLoadedRerollCount = (state: CustomActionContext['state'], attackerId: string): number =>
    Math.max(
        0,
        ...((state.players[attackerId]?.abilities ?? []).map(ability => getLoadedRerollCount(ability, 'allTokenUses'))),
    );

function handleLoadedUse({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const loadedBoost = state.pendingAttack?.loadedBonusDieBoost;
    const opponentId = getSelectedCombatOpponentId(state, attackerId, state.turnPhase)
        ?? state.pendingAttack?.defenderId
        ?? attackerId;
    const maxRerollCount = Math.max(
        getSourceAbilityLoadedRerollCount(state, attackerId, sourceAbilityId),
        getGlobalLoadedRerollCount(state, attackerId),
        loadedBoost?.allowReroll ? 1 : 0,
    );
    if (maxRerollCount > 0) {
        return createBonusDiceWithReroll(
            createLoadedChoiceContext(state, attackerId, sourceAbilityId, timestamp, random),
            {
                diceCount: 1,
                rerollCostTokenId: TOKEN_IDS.LOADED,
                rerollCostAmount: 0,
                maxRerollCount,
                dieEffectKey: 'bonusDie.effect.gunslingerLoadedDie',
                rerollEffectKey: 'bonusDie.effect.gunslingerLoadedReroll',
                showTotal: false,
                resolutionMode: 'attackBonus',
                attackBonusScale: 'halfUp',
                postSettleBonusDamageAdds: loadedBoost?.postSettleBonusDamageAdds,
                effectParamsBuilder: ({ value, index }) => ({
                    value,
                    index,
                    bonusDamage: Math.ceil(value / 2),
                }),
                // Loaded 是攻击掷骰结束后的加成。确认后必须回到同一攻击，
                // 由父流程继续处理余下 Token 选择和防御阶段。
                continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
            },
            () => [],
        );
    }

    const roll = random.d(6);
    const face = getPlayerDieFace(state, attackerId, roll) ?? '';
    const bonusDamage = Math.ceil(roll / 2);

    return [
        {
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value: roll,
                face,
                playerId: attackerId,
                targetPlayerId: opponentId,
                effectKey: 'bonusDie.effect.gunslingerLoadedDie',
                effectParams: { value: roll, index: 0, bonusDamage },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DiceThroneEvent,
        createDisplayOnlySettlement(
            sourceAbilityId,
            attackerId,
            opponentId,
            [{
                index: 0,
                value: roll,
                face,
                effectKey: 'bonusDie.effect.gunslingerLoadedDie',
                effectParams: { value: roll, index: 0, bonusDamage },
            }],
            timestamp + 1,
            {
                customResolutionId: GUNSLINGER_LOADED_SETTLEMENT_ID,
                continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
            },
        ),
    ];
}

function handleShowdownBonus({ attackerId, targetId, sourceAbilityId, state, timestamp, random, action }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const attackerRoll = random.d(6);
    const defenderRoll = random.d(6);
    const selectedDefenderId = getSelectedCombatOpponentId(
        state,
        attackerId,
        state.turnPhase,
    ) ?? state.pendingAttack?.defenderId;
    const explicitOpponentId = targetId !== attackerId && getOpponents(state, attackerId).includes(targetId)
        ? targetId
        : undefined;
    const resolvedDefenderId = selectedDefenderId ?? explicitOpponentId;
    if (!resolvedDefenderId) {
        throw new Error(`[DiceThrone] ${sourceAbilityId} 枪战决斗缺少目标对手：attackerId=${attackerId}`);
    }

    const amount = typeof action.params?.bonusDamageOnWin === 'number'
        ? action.params.bonusDamageOnWin
        : 2;
    const attackerFace = getPlayerDieFace(state, attackerId, attackerRoll);
    const defenderFace = getPlayerDieFace(state, resolvedDefenderId, defenderRoll);
    const attackerDiceDefinitionId = getRequiredPlayerDiceDefinitionId(state, attackerId, sourceAbilityId);
    const defenderDiceDefinitionId = getRequiredPlayerDiceDefinitionId(state, resolvedDefenderId, sourceAbilityId);

    return [{
        type: 'COMPARE_ROLL_REQUESTED',
        payload: {
            context: createCompareRollContext(state, {
                id: `compare:gunslingerShowdown:${sourceAbilityId}:${timestamp}`,
                ownerPlayerId: attackerId,
                targetPlayerId: resolvedDefenderId,
                sourceAbilityId,
                dice: [
                    {
                        id: 0,
                        definitionId: attackerDiceDefinitionId,
                        value: attackerRoll,
                        symbol: attackerFace,
                        symbols: attackerFace ? [attackerFace] : [],
                        isKept: false,
                        ownerId: attackerId,
                    },
                    {
                        id: 1,
                        definitionId: defenderDiceDefinitionId,
                        value: defenderRoll,
                        symbol: defenderFace,
                        symbols: defenderFace ? [defenderFace] : [],
                        isKept: false,
                        ownerId: resolvedDefenderId,
                    },
                ],
                metadata: {
                    compareKind: 'gunslingerShowdown',
                    bonusDamageOnWin: amount,
                    contestants: [
                    {
                        dieId: 0,
                        playerId: attackerId,
                        labelKey: 'compareRoll.gunslingerShowdown.attacker',
                        characterId: state.players[attackerId]?.characterId,
                    },
                    {
                        dieId: 1,
                        playerId: resolvedDefenderId,
                        labelKey: 'compareRoll.gunslingerShowdown.defender',
                        characterId: state.players[resolvedDefenderId]?.characterId,
                    },
                ],
                },
            }),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DiceThroneEvent];
}

function handleDuelResolve({ sourceAbilityId, state, timestamp, random, action }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const currentRollDice = state.currentRollContext?.dice ?? getActiveDice(state);
    const defenderRoll = currentRollDice.find(die => die.ownerId === state.pendingAttack?.defenderId)?.value
        ?? currentRollDice[0]?.value
        ?? random.d(6);
    const attackerRoll = currentRollDice.find(die => die.ownerId === state.pendingAttack?.attackerId && die.id !== 0)?.value
        ?? random.d(6);
    const originalAttackerId = state.pendingAttack?.attackerId;
    const originalDefenderId = state.pendingAttack?.defenderId;
    if (!originalAttackerId || !originalDefenderId) return [];

    const winOnTie = action.params?.winOnTie === true;
    const defenderFace = getPlayerDieFace(state, originalDefenderId, defenderRoll);
    const attackerFace = getPlayerDieFace(state, originalAttackerId, attackerRoll);
    const defenderDiceDefinitionId = getRequiredPlayerDiceDefinitionId(state, originalDefenderId, sourceAbilityId);
    const attackerDiceDefinitionId = getRequiredPlayerDiceDefinitionId(state, originalAttackerId, sourceAbilityId);

    return [{
        type: 'COMPARE_ROLL_REQUESTED',
        payload: {
            context: createCompareRollContext(state, {
                id: `compare:gunslingerDuel:${sourceAbilityId}:${timestamp}`,
                ownerPlayerId: originalDefenderId,
                targetPlayerId: originalAttackerId,
                sourceAbilityId,
                dice: [
                    {
                        id: 0,
                        definitionId: defenderDiceDefinitionId,
                        value: defenderRoll,
                        symbol: defenderFace,
                        symbols: defenderFace ? [defenderFace] : [],
                        isKept: false,
                        ownerId: originalDefenderId,
                    },
                    {
                        id: 1,
                        definitionId: attackerDiceDefinitionId,
                        value: attackerRoll,
                        symbol: attackerFace,
                        symbols: attackerFace ? [attackerFace] : [],
                        isKept: false,
                        ownerId: originalAttackerId,
                    },
                ],
                metadata: {
                    compareKind: 'gunslingerDuel',
                    winOnTie,
                    contestants: [
                    {
                        dieId: 0,
                        playerId: originalDefenderId,
                        labelKey: 'compareRoll.gunslingerDuel.defender',
                        characterId: state.players[originalDefenderId]?.characterId,
                    },
                    {
                        dieId: 1,
                        playerId: originalAttackerId,
                        labelKey: 'compareRoll.gunslingerDuel.attacker',
                        characterId: state.players[originalAttackerId]?.characterId,
                    },
                ],
                },
            }),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DiceThroneEvent];
}

function handleWildWest({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const pendingAttack = state.pendingAttack;
    if (!pendingAttack || pendingAttack.attackerId !== attackerId) {
        return [];
    }

    const existingBoost = pendingAttack.loadedBonusDieBoost;
    const nextBoost = {
        allowReroll: true,
        postSettleBonusDamageAdds: [
            ...(existingBoost?.postSettleBonusDamageAdds ?? []),
            { amount: 1, sourceCardId: sourceAbilityId },
        ],
    };

    return [{
        type: 'PENDING_ATTACK_UPDATED',
        payload: {
            attackerId,
            patch: { loadedBonusDieBoost: nextBoost },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DiceThroneEvent];
}

function handleEatMyLead({ attackerId, sourceAbilityId, state, timestamp, random, ctx }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const opponentId = ctx.defenderId ?? state.pendingAttack?.defenderId ?? attackerId;

    const dice = Array.from({ length: 5 }, (_, index) => {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        return {
            index,
            value,
            face,
            effectKey: 'bonusDie.effect.gunslingerEatMyLeadDie',
            effectParams: { value, index },
        };
    });

    const bulletCount = dice.filter(die => die.face === GUNSLINGER_DICE_FACE_IDS.BULLET).length;
    const bonusDamage = bulletCount;
    const events: DiceThroneEvent[] = [];

    for (const die of dice) {
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value: die.value,
                face: die.face,
                playerId: attackerId,
                targetPlayerId: opponentId,
                effectKey: die.effectKey,
                effectParams: { value: die.value, index: die.index },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + die.index,
        } as DiceThroneEvent);
    }

    events.push(createDisplayOnlySettlement(
        sourceAbilityId,
        attackerId,
        opponentId,
        dice,
        timestamp + 10,
        {
            customResolutionId: GUNSLINGER_EAT_MY_LEAD_SETTLEMENT_ID,
            summaryEffectKey: bonusDamage > 4
                ? 'bonusDie.effect.gunslingerEatMyLead.resultKnockdown'
                : 'bonusDie.effect.gunslingerEatMyLead.result',
            summaryEffectParams: { bulletCount, bonusDamage },
            continuation: { kind: 'attack', settlementStage: 'readyToResolve', markBonusDiceResolved: true },
        },
    ));

    return events;
}

function createKnockdownEvent(
    state: CustomActionContext['state'],
    targetId: string,
    sourceAbilityId: string,
    timestamp: number,
): StatusAppliedEvent {
    const currentStacks = state.players[targetId]?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
    return {
        type: 'STATUS_APPLIED',
        payload: {
            targetId,
            statusId: STATUS_IDS.KNOCKDOWN,
            stacks: 1,
            newTotal: Math.min(currentStacks + 1, 1),
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as StatusAppliedEvent;
}

function createBountyEvent(
    state: CustomActionContext['state'],
    targetId: string,
    sourceAbilityId: string,
    timestamp: number,
): DiceThroneEvent {
    const currentBounty = state.players[targetId]?.tokens[TOKEN_IDS.BOUNTY] ?? 0;
    const newBountyTotal = Math.min(currentBounty + 1, getTokenStackLimit(state, targetId, TOKEN_IDS.BOUNTY));
    return {
        type: 'TOKEN_GRANTED',
        payload: {
            targetId,
            tokenId: TOKEN_IDS.BOUNTY,
            amount: Math.max(0, newBountyTotal - currentBounty),
            newTotal: newBountyTotal,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DiceThroneEvent;
}

function createBountyAttackRewardEvent(
    state: CustomActionContext['state'],
    targetId: string,
    sourceAbilityId: string,
    timestamp: number,
): CpChangedEvent | null {
    const pendingAttack = state.pendingAttack;
    if (!pendingAttack || pendingAttack.attackerId === targetId) {
        return null;
    }

    const currentCp = state.players[pendingAttack.attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const newValue = Math.min(currentCp + 1, CP_MAX);
    if (newValue === currentCp) return null;

    return {
        type: 'CP_CHANGED',
        payload: {
            playerId: pendingAttack.attackerId,
            delta: 1,
            newValue,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
}

function createSingleOpponentInteraction(
    state: CustomActionContext['state'],
    attackerId: string,
    sourceAbilityId: string,
    timestamp: number,
    resolveCustomActionId: string,
): InteractionRequestedEvent | null {
    const opponentIds = getOpponents(state, attackerId);
    if (opponentIds.length <= 1) {
        return null;
    }

    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectPlayer',
        titleKey: 'interaction.selectPlayer',
        selectCount: 1,
        selected: [],
        targetPlayerIds: opponentIds,
        resolveCustomActionId,
    };

    return {
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent;
}

function createSinglePlayerInteraction(
    state: CustomActionContext['state'],
    attackerId: string,
    sourceAbilityId: string,
    timestamp: number,
    resolveCustomActionId: string,
    targetPlayerIds: string[],
    titleKey = 'interaction.selectPlayer',
): InteractionRequestedEvent | null {
    if (targetPlayerIds.length <= 1) {
        return null;
    }

    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectPlayer',
        titleKey,
        selectCount: 1,
        selected: [],
        targetPlayerIds,
        resolveCustomActionId,
    };

    return {
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent;
}

function getWantedTargetPlayerIds(state: CustomActionContext['state'], attackerId: string): string[] {
    const opponentIds = getOpponents(state, attackerId);
    if (Object.keys(state.players).length <= 2 && opponentIds.length === 1) {
        return opponentIds;
    }
    return getSeatingOrder(state);
}

function getHighNoonTargetPlayerIds(state: CustomActionContext['state'], attackerId: string): string[] {
    const opponentIds = getOpponents(state, attackerId);
    if (Object.keys(state.players).length <= 2 && opponentIds.length === 1) {
        return opponentIds;
    }
    return getSeatingOrder(state);
}

function hasFourOfAKind(state: CustomActionContext['state']): boolean {
    return getMaxDuplicateValueCount(getActiveDice(state)) >= 4;
}

function createUnblockableDamageEvent(
    state: CustomActionContext['state'],
    targetId: string,
    amount: number,
    sourceAbilityId: string,
    timestamp: number,
): DamageDealtEvent {
    const hp = state.players[targetId]?.resources[RESOURCE_IDS.HP] ?? 0;
    return {
        type: 'DAMAGE_DEALT',
        payload: {
            targetId,
            amount,
            actualDamage: Math.min(amount, hp),
            sourceAbilityId,
            unblockable: true,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent;
}

function resolveSingleOpponentCard(
    ctx: CustomActionContext,
    resolveCustomActionId: string,
    resolveDirect: (targetId: string, context: CustomActionContext) => DiceThroneEvent[],
): DiceThroneEvent[] {
    const interactionEvent = createSingleOpponentInteraction(
        ctx.state,
        ctx.attackerId,
        ctx.sourceAbilityId,
        ctx.timestamp,
        resolveCustomActionId,
    );
    if (interactionEvent) {
        return [interactionEvent];
    }

    const targetId = getOpponents(ctx.state, ctx.attackerId)[0];
    if (!targetId) {
        return [];
    }
    return resolveDirect(targetId, ctx);
}

function handleMarkTheTarget(ctx: CustomActionContext): DiceThroneEvent[] {
    return resolveSingleOpponentCard(ctx, 'gunslinger-card-mark-the-target-resolve', (targetId, { state, sourceAbilityId, timestamp }) => ([
        createBountyEvent(state, targetId, sourceAbilityId, timestamp),
    ]));
}

function handleMarkTheTargetResolve({ targetId, state, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const rewardEvent = createBountyAttackRewardEvent(state, targetId, sourceAbilityId, timestamp + 0.01);
    return [
        createBountyEvent(state, targetId, sourceAbilityId, timestamp),
        ...(rewardEvent ? [rewardEvent] : []),
    ];
}

function handleWanted(ctx: CustomActionContext): DiceThroneEvent[] {
    const targetPlayerIds = getWantedTargetPlayerIds(ctx.state, ctx.attackerId);
    const interactionEvent = createSinglePlayerInteraction(
        ctx.state,
        ctx.attackerId,
        ctx.sourceAbilityId,
        ctx.timestamp,
        'gunslinger-card-wanted-resolve',
        targetPlayerIds,
    );
    if (interactionEvent) {
        return [interactionEvent];
    }

    const targetId = targetPlayerIds[0];
    if (!targetId) {
        return [];
    }
    return [createBountyEvent(ctx.state, targetId, ctx.sourceAbilityId, ctx.timestamp)];
}

function handleWantedResolve({ targetId, state, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createBountyEvent(state, targetId, sourceAbilityId, timestamp)];
}

function handlePistolWhip(ctx: CustomActionContext): DiceThroneEvent[] {
    return resolveSingleOpponentCard(ctx, 'gunslinger-card-pistol-whip-resolve', (targetId, context) => (
        handlePistolWhipResolve({ ...context, targetId, ctx: { ...context.ctx, defenderId: targetId } })
    ));
}

function handlePistolWhipResolve({ attackerId, targetId, state, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return resolveEffectsToEvents([
        {
            description: '对手获得击倒。',
            action: { type: 'grantStatus', target: 'opponent', statusId: STATUS_IDS.KNOCKDOWN, value: 1 },
            timing: 'immediate',
        },
        {
            description: '造成 1 点不可防御伤害。',
            action: { type: 'damage', target: 'opponent', value: 1, unblockable: true, damageScope: 'direct' },
            timing: 'immediate',
        },
    ], 'immediate', {
        attackerId,
        defenderId: targetId,
        sourceAbilityId,
        state,
        damageDealt: 0,
        timestamp,
    });
}

function handleHighNoon(ctx: CustomActionContext): DiceThroneEvent[] {
    const targetPlayerIds = getHighNoonTargetPlayerIds(ctx.state, ctx.attackerId);
    const interactionEvent = createSinglePlayerInteraction(
        ctx.state,
        ctx.attackerId,
        ctx.sourceAbilityId,
        ctx.timestamp,
        'gunslinger-card-high-noon-resolve',
        targetPlayerIds,
    );
    if (interactionEvent) {
        return [interactionEvent];
    }

    const targetId = targetPlayerIds[0];
    if (!targetId) {
        return [];
    }
    return handleHighNoonResolve({ ...ctx, targetId, ctx: { ...ctx.ctx, defenderId: targetId } });
}

function handleHighNoonResolve({ attackerId, targetId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) {
        return [];
    }

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? GUNSLINGER_DICE_FACE_IDS.BULLET;
    const effectKeyMap: Record<string, string> = {
        [GUNSLINGER_DICE_FACE_IDS.BULLET]: 'bonusDie.effect.gunslingerHighNoonBullet',
        [GUNSLINGER_DICE_FACE_IDS.DASH]: 'bonusDie.effect.gunslingerHighNoonDash',
        [GUNSLINGER_DICE_FACE_IDS.BULLSEYE]: 'bonusDie.effect.gunslingerHighNoonBullseye',
    };
    const effectKey = effectKeyMap[face] ?? 'bonusDie.effect.default';

    const events: DiceThroneEvent[] = [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: attackerId,
            targetPlayerId: targetId,
            effectKey,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DiceThroneEvent];

    events.push(createDisplayOnlySettlement(
        sourceAbilityId,
        attackerId,
        targetId,
        [{ index: 0, value, face, effectKey }],
        timestamp + 1,
        { customResolutionId: GUNSLINGER_HIGH_NOON_SETTLEMENT_ID, continuation: { kind: 'complete' } },
    ));
    return events;
}

function handleTheLaw({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const opponentIds = getOpponents(state, attackerId);
    const targetPlayerIds = getSeatingOrder(state);

    if (opponentIds.length <= 1) {
        const targetId = opponentIds[0];
        if (!targetId) return [];

        const currentBounty = state.players[targetId]?.tokens[TOKEN_IDS.BOUNTY] ?? 0;
        const newBountyTotal = Math.min(currentBounty + 1, getTokenStackLimit(state, targetId, TOKEN_IDS.BOUNTY));
        return [
            {
                type: 'TOKEN_GRANTED',
                payload: {
                    targetId,
                    tokenId: TOKEN_IDS.BOUNTY,
                    amount: Math.max(0, newBountyTotal - currentBounty),
                    newTotal: newBountyTotal,
                    sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            } as DiceThroneEvent,
            createKnockdownEvent(state, targetId, sourceAbilityId, timestamp + 1),
        ];
    }

    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectPlayer',
        titleKey: 'interaction.gunslingerTheLaw',
        selectCount: 2,
        selected: [],
        targetPlayerIds,
        tokenGrantConfig: { tokenId: TOKEN_IDS.BOUNTY, amount: 1 },
        statusGrantConfig: { statusId: STATUS_IDS.KNOCKDOWN, amount: 1 },
    };

    return [{
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent];
}

function handleRevolver2FourKindKnockdown({ ctx, state, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const defenderId = ctx.defenderId;
    if (!defenderId) return [];
    if (!hasFourOfAKind(state)) return [];
    return [createKnockdownEvent(state, defenderId, sourceAbilityId, timestamp)];
}

export function registerGunslingerCustomActions(): void {
    registerBonusDiceSettlementHandler(GUNSLINGER_LOADED_SETTLEMENT_ID, ({ settlement, timestamp }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        return {
            totalDamage: 0,
            followupEvents: die
                ? [{
                    type: 'BONUS_DAMAGE_ADDED',
                    payload: {
                        playerId: settlement.attackerId,
                        amount: Math.ceil(die.value / 2),
                    },
                    sourceCommandType: 'BONUS_DICE_SETTLED',
                    timestamp,
                } as BonusDamageAddedEvent]
                : [],
        };
    });
    registerBonusDiceSettlementHandler(GUNSLINGER_EAT_MY_LEAD_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const bulletCount = getPendingBonusSettlementDice(settlement)
            .filter(die => die.face === GUNSLINGER_DICE_FACE_IDS.BULLET).length;
        const followupEvents: DiceThroneEvent[] = [];
        if (bulletCount > 0) {
            followupEvents.push({
                type: 'BONUS_DAMAGE_ADDED',
                payload: {
                    playerId: settlement.attackerId,
                    amount: bulletCount,
                    sourceCardId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as BonusDamageAddedEvent);
        }
        if (bulletCount > 4 && settlement.targetId !== settlement.attackerId) {
            followupEvents.push(createKnockdownEvent(state, settlement.targetId, settlement.sourceAbilityId, timestamp + 1));
        }
        return { totalDamage: 0, followupEvents };
    });
    registerBonusDiceSettlementHandler(GUNSLINGER_HIGH_NOON_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        if (!die) return { totalDamage: 0, followupEvents: [] };
        if (die.face === GUNSLINGER_DICE_FACE_IDS.BULLET) {
            return {
                totalDamage: 0,
                followupEvents: [createUnblockableDamageEvent(state, settlement.targetId, 2, settlement.sourceAbilityId, timestamp)],
            };
        }
        if (die.face === GUNSLINGER_DICE_FACE_IDS.DASH) {
            return {
                totalDamage: 0,
                followupEvents: [createKnockdownEvent(state, settlement.targetId, settlement.sourceAbilityId, timestamp)],
            };
        }
        return {
            totalDamage: 0,
            followupEvents: [createBountyEvent(state, settlement.targetId, settlement.sourceAbilityId, timestamp)],
        };
    });

    registerCustomActionHandler('gunslinger-loaded-use', handleLoadedUse, {
        categories: ['token', 'dice'],
    });
    registerCustomActionHandler('gunslinger-showdown-bonus', handleShowdownBonus, {
        categories: ['dice'],
    });
    registerCustomActionHandler('gunslinger-duel-resolve', handleDuelResolve, {
        categories: ['choice', 'damage', 'defense'],
        phases: ['defensiveRoll'],
    });
    registerCustomActionHandler('gunslinger-card-wild-west', handleWildWest, {
        categories: ['card', 'dice', 'token'],
    });
    registerCustomActionHandler('gunslinger-card-eat-my-lead', handleEatMyLead, {
        categories: ['card', 'dice', 'status'],
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('gunslinger-card-pistol-whip', handlePistolWhip, {
        categories: ['card', 'status', 'damage'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('gunslinger-card-pistol-whip-resolve', handlePistolWhipResolve, {
        categories: ['card', 'status', 'damage'],
    });
    registerCustomActionHandler('gunslinger-card-mark-the-target', handleMarkTheTarget, {
        categories: ['card', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('gunslinger-card-mark-the-target-resolve', handleMarkTheTargetResolve, {
        categories: ['card', 'token', 'resource'],
    });
    registerCustomActionHandler('gunslinger-card-wanted', handleWanted, {
        categories: ['card', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('gunslinger-card-wanted-resolve', handleWantedResolve, {
        categories: ['card', 'token'],
    });
    registerCustomActionHandler('gunslinger-card-high-noon', handleHighNoon, {
        categories: ['card', 'token', 'status', 'damage', 'dice'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('gunslinger-card-high-noon-resolve', handleHighNoonResolve, {
        categories: ['card', 'token', 'status', 'damage', 'dice'],
    });
    registerCustomActionHandler('gunslinger-card-the-law', handleTheLaw, {
        categories: ['card', 'token', 'status'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('gunslinger-revolver-2-four-kind', handleRevolver2FourKindKnockdown, {
        categories: ['status'],
    });

    registerChoiceResolvedEventHandler('gunslinger-duel-deal-3', ({ state, playerId, sourceAbilityId, timestamp }) => {
        const originalAttackerId = state.pendingAttack?.attackerId;
        if (!originalAttackerId) return [];

        const damageCalc = createDamageCalculation({
            source: { playerId, abilityId: sourceAbilityId },
            target: { playerId: originalAttackerId },
            baseDamage: 3,
            state,
            damageScope: 'direct',
            timestamp,
        });
        return damageCalc.toEvents().map(event => event.type === 'DAMAGE_DEALT'
            ? {
                ...event,
                payload: {
                    ...event.payload,
                    damageScope: 'direct',
                    unblockable: true,
                },
            }
            : event) as DiceThroneEvent[];
    });

    registerChoiceResolvedEventHandler('gunslinger-duel-lose', ({ state, playerId, sourceAbilityId, timestamp }) => {
        const originalAttackerId = state.pendingAttack?.attackerId;
        if (!originalAttackerId) return [];

        const damageCalc = createDamageCalculation({
            source: { playerId, abilityId: sourceAbilityId },
            target: { playerId: originalAttackerId },
            baseDamage: 1,
            state,
            damageScope: 'direct',
            timestamp,
        });
        return damageCalc.toEvents().map(event => event.type === 'DAMAGE_DEALT'
            ? {
                ...event,
                payload: {
                    ...event.payload,
                    damageScope: 'direct',
                    unblockable: true,
                },
            }
            : event) as DiceThroneEvent[];
    });

    registerChoiceResolvedEventHandler('gunslinger-duel-prevent-half', ({ playerId, sourceAbilityId, timestamp }) => ([{
        type: 'DAMAGE_SHIELD_GRANTED',
        payload: {
            targetId: playerId,
            value: 0,
            reductionPercent: 50,
            sourceId: sourceAbilityId ?? 'duel',
            preventStatus: false,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageShieldGrantedEvent]));

    registerChoiceResolvedEventHandler('use-loaded', ({ state, playerId, sourceAbilityId, timestamp, random }) => (
        handleLoadedUse(createLoadedChoiceContext(state, playerId, sourceAbilityId ?? state.pendingAttack?.sourceAbilityId ?? 'token-use', timestamp, random))
    ));
}
