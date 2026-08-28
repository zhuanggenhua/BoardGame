import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import { registerChoiceEffectHandler } from '../choiceEffects';
import { registerChoiceResolvedEventHandler } from '../choiceResolvedEvents';
import { ARTIFICER_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../ids';
import { RESOURCE_IDS } from '../resources';
import { getActiveDice, getFaceCounts, getOpponents, getPendingBonusSettlementDice, getPlayerDieFace, getTokenStackLimit } from '../rules';
import { MAX_HEALTH, type DiceThroneCore, type DieFace } from '../types';
import { updatePendingAttackSettlementStage } from '../utils';
import type {
    BonusDieRolledEvent,
    ChoiceRequestedEvent,
    DiceThroneEvent,
    HealAppliedEvent,
    InteractionRequestedEvent,
    StatusAppliedEvent,
    StatusRemovedEvent,
    TokenGrantedEvent,
    TokenLimitChangedEvent,
    TokenUsedEvent,
} from '../events';
import { registerCustomActionHandler, createDisplayOnlySettlement, type CustomActionContext } from '../effects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import {
    ADVANCED_ARTIFICER_BOT_LIMIT as ADVANCED_ROBOT_LIMIT,
    ARTIFICER_BOT_IDS as ARTIFICER_ROBOT_IDS,
    buildArtificerBotStatePatch,
    getArtificerBotState,
    getRemainingArtificerBotActivations,
    isArtificerBotBuilt,
    isArtificerBotUpgraded,
    type ArtificerBotTokenId as ArtificerRobotTokenId,
} from '../artificerBots';

const ARC_SHIELD_PREVENT_2_CHOICE_ID = 'artificer-arc-shield-prevent-2';
const ARC_SHIELD_PREVENT_3_CHOICE_ID = 'artificer-arc-shield-prevent-3';
const WRENCH_STRIKE_ROLL_CHOICE_ID = 'artificer-wrench-strike-roll';
const WRENCH_STRIKE_SPEND_WRENCH_CHOICE_ID = 'artificer-wrench-strike-spend-wrench';
const WRENCH_STRIKE_SPEND_GEAR_CHOICE_ID = 'artificer-wrench-strike-spend-gear';
const WRENCH_STRIKE_SPEND_ELECTRICITY_CHOICE_ID = 'artificer-wrench-strike-spend-electricity';
const ARTIFICER_HEAL_BOT_SETTLEMENT_ID = 'artificer-heal-bot-use';
const ARTIFICER_WRENCH_STRIKE_SETTLEMENT_ID = 'artificer-wrench-strike-branch';
const ARTIFICER_PERFECTLY_CALIBRATED_SETTLEMENT_ID = 'artificer-perfectly-calibrated-roll';
const BUILD_FROM_SCRATCH_CHOICE_ID = 'artificer-build-from-scratch-resolve';
const ACTIVATE_BOT_CHOICE_ID = 'artificer-activate-bot-resolve';
const SYNTH_INFLICT_NANOBOMB_SELECTED_ACTION_ID = 'artificer-synth-inflict-nanobomb-selected';

const BUILD_ADVANCED_NANOBOT = 1;
const BUILD_ADVANCED_SHOCK_BOT = 2;
const BUILD_ADVANCED_HEAL_BOT = 3;
const UPGRADE_NANOBOT = 4;
const UPGRADE_SHOCK_BOT = 5;
const UPGRADE_HEAL_BOT = 6;
const ACTIVATE_BOT_CODE_BY_TOKEN_ID: Record<ArtificerRobotTokenId, number> = {
    [TOKEN_IDS.NANOBOT]: 1,
    [TOKEN_IDS.SHOCK_BOT]: 2,
    [TOKEN_IDS.HEAL_BOT]: 3,
};
const ACTIVATE_BOT_TOKEN_ID_BY_CODE: Record<number, ArtificerRobotTokenId | undefined> = {
    1: TOKEN_IDS.NANOBOT,
    2: TOKEN_IDS.SHOCK_BOT,
    3: TOKEN_IDS.HEAL_BOT,
};
const ACTIVATE_BOT_MASK_BY_TOKEN_ID: Record<ArtificerRobotTokenId, number> = {
    [TOKEN_IDS.NANOBOT]: 1,
    [TOKEN_IDS.SHOCK_BOT]: 2,
    [TOKEN_IDS.HEAL_BOT]: 4,
};
const ACTIVATE_BOT_FREE_LABEL_KEY_BY_TOKEN_ID: Record<ArtificerRobotTokenId, string> = {
    [TOKEN_IDS.NANOBOT]: 'choices.artificerBotActivation.activateNanobotFree',
    [TOKEN_IDS.SHOCK_BOT]: 'choices.artificerBotActivation.activateShockBotFree',
    [TOKEN_IDS.HEAL_BOT]: 'choices.artificerBotActivation.activateHealBotFree',
};
function isWrenchStrikeAbilityId(sourceAbilityId?: string): boolean {
    return typeof sourceAbilityId === 'string'
        && (sourceAbilityId === 'wrench-strike' || sourceAbilityId.startsWith('wrench-strike-'));
}

function isBuildFromScratchAbilityId(sourceAbilityId?: string): boolean {
    return sourceAbilityId === 'eureka-2-build-from-scratch';
}

const NANOBOMB_DAMAGE_BY_STACKS: Record<number, number> = {
    1: 1,
    2: 3,
    3: 5,
};

function getNanobombDamage(stacks: number): number {
    return NANOBOMB_DAMAGE_BY_STACKS[Math.min(Math.max(1, stacks), 3)] ?? 0;
}

function buildNanobombApplyEvents(
    state: DiceThroneCore,
    targetId: string,
    stacksToAdd: number,
    sourceAbilityId: string,
    timestamp: number,
): DiceThroneEvent[] {
    if (stacksToAdd <= 0) return [];
    const target = state.players[targetId];
    if (!target) return [];

    const currentStacks = target.statusEffects[STATUS_IDS.NANOBOMB] ?? 0;
    const def = state.tokenDefinitions.find(entry => entry.id === STATUS_IDS.NANOBOMB);
    const maxStacks = def?.stackLimit ?? 3;
    const newTotal = Math.min(currentStacks + stacksToAdd, maxStacks);
    const appliedStacks = Math.max(0, newTotal - currentStacks);
    if (appliedStacks <= 0) return [];

    return [{
        type: 'STATUS_APPLIED',
        payload: {
            targetId,
            statusId: STATUS_IDS.NANOBOMB,
            stacks: appliedStacks,
            newTotal,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as StatusAppliedEvent];
}

function countOwnedRobotTypes(state: DiceThroneCore, playerId: string): number {
    const player = state.players[playerId];
    if (!player) return 0;

    return ARTIFICER_ROBOT_IDS.reduce((count, tokenId) => (
        count + (isArtificerBotBuilt(state, playerId, tokenId) ? 1 : 0)
    ), 0);
}

function encodeActivateBotChoiceValue(
    selectedCode: number,
    remainingAfter: number,
    usedMaskAfter: number,
): number {
    return (usedMaskAfter * 100) + (remainingAfter * 10) + selectedCode;
}

function decodeActivateBotChoiceValue(value: number): {
    selectedCode: number;
    selectedTokenId?: ArtificerRobotTokenId;
    remainingAfter: number;
    usedMaskAfter: number;
} {
    const normalized = Math.max(0, Math.trunc(value));
    const selectedCode = normalized % 10;
    const remainingAfter = Math.floor(normalized / 10) % 10;
    const usedMaskAfter = Math.floor(normalized / 100);
    return {
        selectedCode,
        selectedTokenId: ACTIVATE_BOT_TOKEN_ID_BY_CODE[selectedCode],
        remainingAfter,
        usedMaskAfter,
    };
}

function buildArtificerBotActivationOptions(
    state: DiceThroneCore,
    playerId: string,
    remainingActivations: number,
    usedMask: number,
    allowSkip: boolean,
): ChoiceRequestedEvent['payload']['options'] {
    const player = state.players[playerId];
    if (!player || remainingActivations <= 0) return [];

    const options: ChoiceRequestedEvent['payload']['options'] = [];
    for (const tokenId of ARTIFICER_ROBOT_IDS) {
        const tokenMask = ACTIVATE_BOT_MASK_BY_TOKEN_ID[tokenId];
        if ((usedMask & tokenMask) !== 0) continue;
        if (!isArtificerBotBuilt(state, playerId, tokenId)) continue;
        if (getRemainingArtificerBotActivations(state, playerId, tokenId) <= 0) continue;

        options.push({
            customId: ACTIVATE_BOT_CHOICE_ID,
            value: encodeActivateBotChoiceValue(
                ACTIVATE_BOT_CODE_BY_TOKEN_ID[tokenId],
                remainingActivations - 1,
                usedMask | tokenMask,
            ),
            labelKey: ACTIVATE_BOT_FREE_LABEL_KEY_BY_TOKEN_ID[tokenId],
            labelParams: undefined,
        });
    }

    if (allowSkip && options.length > 0) {
        options.push({
            customId: ACTIVATE_BOT_CHOICE_ID,
            value: encodeActivateBotChoiceValue(0, 0, usedMask),
            labelKey: 'choices.artificerBotActivation.skip',
        });
    }

    return options;
}

function buildArtificerBotActivationChoiceRequest(
    state: DiceThroneCore,
    playerId: string,
    sourceAbilityId: string,
    remainingActivations: number,
    usedMask: number,
    timestamp: number,
): ChoiceRequestedEvent | undefined {
    const allowSkip = true;
    const options = buildArtificerBotActivationOptions(
        state,
        playerId,
        remainingActivations,
        usedMask,
        allowSkip,
    );
    if (options.length <= 0) return undefined;

    return {
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId,
            sourceAbilityId,
            titleKey: remainingActivations > 1
                ? 'choices.artificerBotActivation.titleMultiple'
                : 'choices.artificerBotActivation.titleSingle',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent;
}

function handleNanobotDetonate({ state, attackerId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];

    // 进攻投掷阶段触发时，当前攻击目标身上的纳米爆弹属于这次攻击的攻击修正；
    // 只有其他玩家身上的纳米爆弹才是独立的附属伤害。维护阶段没有当前攻击，
    // 因此所有目标都继续按直接伤害处理。
    const currentAttackTargetId = state.pendingAttack?.attackerId === attackerId
        ? state.pendingAttack.defenderId
        : undefined;

    if (attackerId && sourceAbilityId === 'artificer-workshop') {
        const botStatePatch = buildArtificerBotStatePatch(state, attackerId, TOKEN_IDS.NANOBOT, {
            built: true,
            activationsUsedThisTurn: (getArtificerBotState(state, attackerId, TOKEN_IDS.NANOBOT).activationsUsedThisTurn ?? 0) + 1,
        });
        if (botStatePatch) {
            events.push({
                type: 'ARTIFICER_BOT_STATE_UPDATED',
                payload: { playerId: attackerId, patch: botStatePatch },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            } as DiceThroneEvent);
        }
    }

    for (const [targetId, player] of Object.entries(state.players)) {
        const stacks = player.statusEffects[STATUS_IDS.NANOBOMB] ?? 0;
        if (stacks <= 0) continue;

        const damage = getNanobombDamage(stacks);
        if (targetId === currentAttackTargetId) {
            // 不填写 sourceCardId：这是状态效果带来的攻击修正，不是攻击修正卡牌本体。
            // 这样只累加 pendingAttack.bonusDamage，不污染攻击修正卡专用字段。
            events.push({
                type: 'BONUS_DAMAGE_ADDED',
                payload: {
                    playerId: attackerId,
                    amount: damage,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            } as DiceThroneEvent);
            events.push({
                type: 'STATUS_REMOVED',
                payload: {
                    targetId,
                    statusId: STATUS_IDS.NANOBOMB,
                    stacks,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 0.001,
            } as StatusRemovedEvent);
            continue;
        }

        const calc = createDamageCalculation({
            source: { playerId: 'system', abilityId: 'artificer-nanobot-detonate' },
            target: { playerId: targetId },
            baseDamage: damage,
            damageScope: 'direct',
            state,
            autoCollectTokens: false,
            autoCollectStatus: false,
            autoCollectShields: false,
            timestamp,
        });
        events.push(...calc.toEvents({ includeSideEffects: true }).map(event => (event.type === 'DAMAGE_DEALT'
            ? {
                ...event,
                payload: {
                    ...event.payload,
                    sourceAbilityId: 'artificer-nanobot-detonate',
                    damageScope: 'direct',
                    unblockable: true,
                },
            } as DiceThroneEvent
            : event)));
        events.push({
            type: 'STATUS_REMOVED',
            payload: {
                targetId,
                statusId: STATUS_IDS.NANOBOMB,
                stacks,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 0.001,
        } as StatusRemovedEvent);
    }

    return events;
}

function handleSynthInflictNanobomb({ attackerId, targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const opponentIds = getOpponents(state, attackerId);
    if (opponentIds.length === 0) return [];

    if (opponentIds.length > 1) {
        return [{
            type: 'INTERACTION_REQUESTED',
            payload: {
                interaction: {
                    id: `${sourceAbilityId}-${timestamp}`,
                    playerId: attackerId,
                    sourceCardId: sourceAbilityId,
                    type: 'selectPlayer',
                    titleKey: 'interaction.selectPlayer',
                    selectCount: 1,
                    selected: [],
                    targetPlayerIds: opponentIds,
                    resolveCustomActionId: SYNTH_INFLICT_NANOBOMB_SELECTED_ACTION_ID,
                },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as InteractionRequestedEvent];
    }

    const resolvedTargetId = opponentIds.includes(targetId) ? targetId : opponentIds[0];
    if (!resolvedTargetId) return [];

    return buildNanobombApplyEvents(state, resolvedTargetId, 1, sourceAbilityId, timestamp);
}

function handleSynthInflictNanobombSelected({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return buildNanobombApplyEvents(state, targetId, 1, sourceAbilityId, timestamp);
}

function buildRobotUse(tokenId: string) {
    return ({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] => {
        const player = state.players[attackerId];
        if (!player) return [];

        const robotId = tokenId as ArtificerRobotTokenId;
        if (isArtificerBotBuilt(state, attackerId, robotId)) return [];

        const current = player.tokens[tokenId] ?? 0;
        const limit = getTokenStackLimit(state, attackerId, tokenId);
        const newTotal = Math.min(current + 1, limit);
        const amount = Math.max(0, newTotal - current);
        if (amount <= 0) return [];

        const events: DiceThroneEvent[] = [{
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: attackerId,
                tokenId,
                amount,
                newTotal,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as TokenGrantedEvent];
        const artificerBotState = buildArtificerBotStatePatch(state, attackerId, robotId, {
            built: true,
            upgraded: false,
            activationsUsedThisTurn: 0,
        });
        if (artificerBotState) {
            events.push({
                type: 'ARTIFICER_BOT_STATE_UPDATED',
                payload: { patch: artificerBotState, playerId: attackerId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 0.0001,
            } as DiceThroneEvent);
        }
        return events;
    };
}

function upgradeRobot(tokenId: string) {
    return ({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] => {
        const player = state.players[attackerId];
        if (!player) return [];

        const robotId = tokenId as ArtificerRobotTokenId;
        if (!isArtificerBotBuilt(state, attackerId, robotId) || isArtificerBotUpgraded(state, attackerId, robotId)) return [];

        const currentLimit = getTokenStackLimit(state, attackerId, tokenId);

        const events: DiceThroneEvent[] = [{
            type: 'TOKEN_LIMIT_CHANGED',
            payload: {
                playerId: attackerId,
                tokenId,
                delta: ADVANCED_ROBOT_LIMIT - currentLimit,
                newLimit: ADVANCED_ROBOT_LIMIT,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as TokenLimitChangedEvent];

        const artificerBotState = buildArtificerBotStatePatch(state, attackerId, robotId, {
            built: true,
            upgraded: true,
            activationsUsedThisTurn: 0,
        });
        if (artificerBotState) {
            events.push({
                type: 'ARTIFICER_BOT_STATE_UPDATED',
                payload: { patch: artificerBotState, playerId: attackerId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 0.001,
            } as DiceThroneEvent);
        }

        return events;
    };
}

function buildBuildFromScratchState(
    state: DiceThroneCore,
    playerId: string,
    tokenId: string,
    mode: 'build' | 'upgrade',
): Partial<DiceThroneCore> | undefined {
    const player = state.players[playerId];
    if (!player) return undefined;

    const current = player.tokens[tokenId] ?? 0;
    const currentLimit = getTokenStackLimit(state, playerId, tokenId);

    if (mode === 'build') {
        if (isArtificerBotBuilt(state, playerId, tokenId as ArtificerRobotTokenId)) return undefined;
    } else if (!isArtificerBotBuilt(state, playerId, tokenId as ArtificerRobotTokenId) || currentLimit >= ADVANCED_ROBOT_LIMIT) {
        return undefined;
    }

    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: {
                    ...player.tokens,
                    [tokenId]: Math.max(1, current),
                },
                tokenStackLimits: {
                    ...player.tokenStackLimits,
                    [tokenId]: ADVANCED_ROBOT_LIMIT,
                },
                artificerBotState: {
                    ...player.artificerBotState,
                    [tokenId]: {
                        ...getArtificerBotState(state, playerId, tokenId as ArtificerRobotTokenId),
                        built: true,
                        upgraded: true,
                        activationsUsedThisTurn: 0,
                    },
                },
            },
        },
    };
}

function buildFromScratchOptions(state: DiceThroneCore, playerId: string): ChoiceRequestedEvent['payload']['options'] {
    const player = state.players[playerId];
    if (!player) return [];

    const options: ChoiceRequestedEvent['payload']['options'] = [];
    const addOption = (
        tokenId: string,
        labelKey: string,
        value: number,
        mode: 'build' | 'upgrade',
    ) => {
        const robotId = tokenId as ArtificerRobotTokenId;
        const built = isArtificerBotBuilt(state, playerId, robotId);
        const upgraded = isArtificerBotUpgraded(state, playerId, robotId);
        const isLegal = mode === 'build' ? !built : built && !upgraded;
        if (!isLegal) return;
        options.push({
            customId: BUILD_FROM_SCRATCH_CHOICE_ID,
            value,
            labelKey,
        });
    };

    addOption(TOKEN_IDS.NANOBOT, 'choices.artificerBuildFromScratch.buildNanobotAdvanced', BUILD_ADVANCED_NANOBOT, 'build');
    addOption(TOKEN_IDS.SHOCK_BOT, 'choices.artificerBuildFromScratch.buildShockBotAdvanced', BUILD_ADVANCED_SHOCK_BOT, 'build');
    addOption(TOKEN_IDS.HEAL_BOT, 'choices.artificerBuildFromScratch.buildHealBotAdvanced', BUILD_ADVANCED_HEAL_BOT, 'build');
    addOption(TOKEN_IDS.NANOBOT, 'choices.artificerBuildFromScratch.upgradeNanobotAdvanced', UPGRADE_NANOBOT, 'upgrade');
    addOption(TOKEN_IDS.SHOCK_BOT, 'choices.artificerBuildFromScratch.upgradeShockBotAdvanced', UPGRADE_SHOCK_BOT, 'upgrade');
    addOption(TOKEN_IDS.HEAL_BOT, 'choices.artificerBuildFromScratch.upgradeHealBotAdvanced', UPGRADE_HEAL_BOT, 'upgrade');

    return options;
}

function handleHealBotUse({ targetId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const player = state.players[targetId];
    if (!player) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, targetId, value) ?? ARTIFICER_DICE_FACE_IDS.WRENCH;
    const healAmount = face === ARTIFICER_DICE_FACE_IDS.WRENCH ? 1 : 2;
    return [
        {
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: targetId,
                targetPlayerId: targetId,
                effectKey: 'bonusDie.effect.artificerHealBot',
                effectParams: { value, heal: healAmount, healAmount },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as BonusDieRolledEvent,
        createDisplayOnlySettlement(
            'artificer-heal-bot-use',
            targetId,
            targetId,
            [{
                index: 0,
                value,
                face: face as DieFace,
                effectKey: 'bonusDie.effect.artificerHealBot',
                effectParams: { value, heal: healAmount, healAmount },
            }],
            timestamp + 0.001,
            {
                customResolutionId: ARTIFICER_HEAL_BOT_SETTLEMENT_ID,
                continuation: { kind: 'complete' },
            },
        ),
    ];
}

function applyArcShieldPrevent(
    state: DiceThroneCore,
    playerId: string,
    sourceAbilityId: string | undefined,
    amount: number,
): Partial<DiceThroneCore> | undefined {
    const player = state.players[playerId];
    if (!player || amount <= 0) return undefined;

    if (state.pendingDamage && state.pendingDamage.targetPlayerId === playerId) {
        const nextDamage = Math.max(0, state.pendingDamage.currentDamage - amount);
        return {
            pendingDamage: {
                ...state.pendingDamage,
                currentDamage: nextDamage,
                isFullyEvaded: nextDamage <= 0 ? true : state.pendingDamage.isFullyEvaded,
            },
        };
    }

    return {
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                damageShields: [
                    ...player.damageShields,
                    {
                        value: amount,
                        sourceId: sourceAbilityId,
                        preventStatus: false,
                    },
                ],
            },
        },
    };
}

function handleArcShield({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[attackerId];
    if (!player) return [];

    const synth = player.tokens[TOKEN_IDS.SYNTH] ?? 0;
    if (synth <= 0) {
        return [{
            type: 'PREVENT_DAMAGE',
            payload: {
                targetId: attackerId,
                amount: 2,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DiceThroneEvent];
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId: sourceAbilityId ?? 'upgrade-artificer-shock-bot-2',
            titleKey: 'choices.artificerArcShield.title',
            options: [
                {
                    customId: ARC_SHIELD_PREVENT_2_CHOICE_ID,
                    value: 2,
                    labelKey: 'choices.artificerArcShield.prevent2',
                },
                {
                    customId: ARC_SHIELD_PREVENT_3_CHOICE_ID,
                    value: 3,
                    labelKey: 'choices.artificerArcShield.prevent3SpendSynth',
                },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function buildWrenchStrikeBonusEvents(
    state: DiceThroneCore,
    attackerId: string,
    sourceAbilityId: string | undefined,
    face: string,
    timestamp: number,
    value: number,
    presentationKind: 'roll' | 'choice' = 'roll',
): DiceThroneEvent[] {
    const faceToEffectKey: Record<string, string> = {
        [ARTIFICER_DICE_FACE_IDS.WRENCH]: 'bonusDie.effect.artificerWrenchStrikeWrench',
        [ARTIFICER_DICE_FACE_IDS.GEAR]: 'bonusDie.effect.artificerWrenchStrikeGear',
        [ARTIFICER_DICE_FACE_IDS.ELECTRICITY]: 'bonusDie.effect.artificerWrenchStrikeElectricity',
    };
    const events: DiceThroneEvent[] = [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: attackerId,
            targetPlayerId: state.pendingAttack?.defenderId ?? attackerId,
            effectKey: faceToEffectKey[face] ?? 'bonusDie.effect.artificerWrenchStrikeWrench',
            presentationKind,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent];

    events.push(createDisplayOnlySettlement(
        sourceAbilityId ?? ARTIFICER_WRENCH_STRIKE_SETTLEMENT_ID,
        attackerId,
        state.pendingAttack?.defenderId ?? attackerId,
        [{ index: 0, value, face: face as DieFace, effectKey: faceToEffectKey[face] ?? 'bonusDie.effect.artificerWrenchStrikeWrench', presentationKind }],
        timestamp + 0.001,
        {
            customResolutionId: ARTIFICER_WRENCH_STRIKE_SETTLEMENT_ID,
            continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
        },
    ));
    return events;
}

function handleWrenchStrikeBranch({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[attackerId];
    if (!player || !sourceAbilityId || !state.pendingAttack || !random) return [];

    const followUpChoice = state.pendingAttack.followUpChoiceBySourceAbilityId?.[sourceAbilityId];
    if (followUpChoice === WRENCH_STRIKE_ROLL_CHOICE_ID) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? ARTIFICER_DICE_FACE_IDS.WRENCH;
        return buildWrenchStrikeBonusEvents(state, attackerId, sourceAbilityId, face, timestamp, value);
    }

    if (followUpChoice === WRENCH_STRIKE_SPEND_WRENCH_CHOICE_ID) {
        return buildWrenchStrikeBonusEvents(state, attackerId, sourceAbilityId, ARTIFICER_DICE_FACE_IDS.WRENCH, timestamp, 1, 'choice');
    }
    if (followUpChoice === WRENCH_STRIKE_SPEND_GEAR_CHOICE_ID) {
        return buildWrenchStrikeBonusEvents(state, attackerId, sourceAbilityId, ARTIFICER_DICE_FACE_IDS.GEAR, timestamp, 4, 'choice');
    }
    if (followUpChoice === WRENCH_STRIKE_SPEND_ELECTRICITY_CHOICE_ID) {
        return buildWrenchStrikeBonusEvents(state, attackerId, sourceAbilityId, ARTIFICER_DICE_FACE_IDS.ELECTRICITY, timestamp, 6, 'choice');
    }

    const synth = player.tokens[TOKEN_IDS.SYNTH] ?? 0;
    if (synth <= 0) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? ARTIFICER_DICE_FACE_IDS.WRENCH;
        return buildWrenchStrikeBonusEvents(state, attackerId, sourceAbilityId, face, timestamp, value);
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.artificerWrenchStrike.title',
            options: [
                {
                    customId: WRENCH_STRIKE_ROLL_CHOICE_ID,
                    value: 0,
                    labelKey: 'choices.artificerWrenchStrike.roll',
                },
                {
                    customId: WRENCH_STRIKE_SPEND_WRENCH_CHOICE_ID,
                    tokenId: TOKEN_IDS.SYNTH,
                    value: -1,
                    labelKey: 'choices.artificerWrenchStrike.spendWrench',
                },
                {
                    customId: WRENCH_STRIKE_SPEND_GEAR_CHOICE_ID,
                    tokenId: TOKEN_IDS.SYNTH,
                    value: -1,
                    labelKey: 'choices.artificerWrenchStrike.spendGear',
                },
                {
                    customId: WRENCH_STRIKE_SPEND_ELECTRICITY_CHOICE_ID,
                    tokenId: TOKEN_IDS.SYNTH,
                    value: -1,
                    labelKey: 'choices.artificerWrenchStrike.spendElectricity',
                },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function handlePerfectlyCalibratedRoll({ attackerId, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];
    const player = state.players[attackerId];
    if (!player) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? ARTIFICER_DICE_FACE_IDS.WRENCH;
    const synthGain = Math.ceil(value / 2);
    return [
        {
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: attackerId,
                effectKey: 'bonusDie.effect.artificerPerfectlyCalibrated',
                effectParams: { value, synth: synthGain, synthGain },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as BonusDieRolledEvent,
        createDisplayOnlySettlement(
            sourceAbilityId,
            attackerId,
            attackerId,
            [{
                index: 0,
                value,
                face: face as DieFace,
                effectKey: 'bonusDie.effect.artificerPerfectlyCalibrated',
                effectParams: { value, synth: synthGain, synthGain },
            }],
            timestamp + 0.001,
            {
                customResolutionId: ARTIFICER_PERFECTLY_CALIBRATED_SETTLEMENT_ID,
                continuation: { kind: 'complete' },
            },
        ),
    ];
}

function handleBuildFromScratchChoice({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    if (!sourceAbilityId || !isBuildFromScratchAbilityId(sourceAbilityId)) return [];

    const options = buildFromScratchOptions(state, attackerId);
    if (options.length <= 0) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.artificerBuildFromScratch.title',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function handleMechanicalArmy({ attackerId, targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const robotTypes = countOwnedRobotTypes(state, attackerId);
    const pending = state.pendingAttack;
    const attackDamageContext = pending
        && pending.attackerId === attackerId
        && pending.defenderId === targetId
        && pending.sourceAbilityId === sourceAbilityId
        ? { attackerId, defenderId: targetId, isUltimate: pending.isUltimate }
        : undefined;
    const calc = createDamageCalculation({
        source: { playerId: attackerId, abilityId: sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: 5 + robotTypes,
        damageScope: 'attack',
        attackDamageContext,
        state,
        timestamp,
    });

    return calc.toEvents({ includeSideEffects: true }).map(event => (event.type === 'DAMAGE_DEALT'
        ? {
            ...event,
            payload: {
                ...event.payload,
                amount: 5 + robotTypes,
                actualDamage: Math.min(5 + robotTypes, state.players[targetId]?.resources[RESOURCE_IDS.HP] ?? (5 + robotTypes)),
                sourceAbilityId,
                damageScope: 'attack',
            },
        }
        : event));
}

function handleArtificerActivateBots({ attackerId, sourceAbilityId, state, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    if (!sourceAbilityId) return [];

    const rawMaxActivations = Number((action as { params?: { maxActivations?: unknown } }).params?.maxActivations ?? 1);
    const maxActivations = Number.isFinite(rawMaxActivations)
        ? Math.max(1, Math.min(2, Math.trunc(rawMaxActivations)))
        : 1;
    const request = buildArtificerBotActivationChoiceRequest(
        state,
        attackerId,
        sourceAbilityId,
        maxActivations,
        0,
        timestamp,
    );
    return request ? [request] : [];
}

function handleTinkerDefense({ attackerId, ctx, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const originalAttackerId = ctx.defenderId;
    if (!originalAttackerId) return [];

    const faceCounts = getFaceCounts(getActiveDice(state));
    const gearCount = faceCounts[ARTIFICER_DICE_FACE_IDS.GEAR] ?? 0;
    const electricityCount = faceCounts[ARTIFICER_DICE_FACE_IDS.ELECTRICITY] ?? 0;
    const currentSynth = state.players[attackerId]?.tokens[TOKEN_IDS.SYNTH] ?? 0;
    const maxSynth = getTokenStackLimit(state, attackerId, TOKEN_IDS.SYNTH);
    const newTotal = Math.min(currentSynth + gearCount, maxSynth);
    const events: DiceThroneEvent[] = [];

    if (newTotal > currentSynth) {
        events.push({
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: attackerId,
                tokenId: TOKEN_IDS.SYNTH,
                amount: newTotal - currentSynth,
                newTotal,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as TokenGrantedEvent);
    }

    if (electricityCount > 0) {
        events.push(...buildNanobombApplyEvents(
            state,
            originalAttackerId,
            1,
            sourceAbilityId,
            timestamp + (events.length > 0 ? 0.001 : 0),
        ));
    }

    return events;
}

function handleTinker2Defense({ attackerId, ctx, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const originalAttackerId = ctx.defenderId;
    if (!originalAttackerId) return [];

    const faceCounts = getFaceCounts(getActiveDice(state));
    const wrenchCount = faceCounts[ARTIFICER_DICE_FACE_IDS.WRENCH] ?? 0;
    const gearCount = faceCounts[ARTIFICER_DICE_FACE_IDS.GEAR] ?? 0;
    const electricityCount = faceCounts[ARTIFICER_DICE_FACE_IDS.ELECTRICITY] ?? 0;
    const events: DiceThroneEvent[] = [];
    let nextTimestamp = timestamp;

    if (wrenchCount >= 2) {
        const calc = createDamageCalculation({
            source: { playerId: attackerId, abilityId: sourceAbilityId },
            target: { playerId: originalAttackerId },
            baseDamage: 1,
            damageScope: 'direct',
            state,
            timestamp: nextTimestamp,
        });
        events.push(...calc.toEvents({ includeSideEffects: true }).map(event => (event.type === 'DAMAGE_DEALT'
            ? {
                ...event,
                payload: {
                    ...event.payload,
                    sourceAbilityId,
                    damageScope: 'direct',
                },
            }
            : event)));
        nextTimestamp += 0.001;
    }

    if (gearCount > 0) {
        const currentSynth = state.players[attackerId]?.tokens[TOKEN_IDS.SYNTH] ?? 0;
        const maxSynth = getTokenStackLimit(state, attackerId, TOKEN_IDS.SYNTH);
        const newTotal = Math.min(currentSynth + gearCount, maxSynth);
        const grantedAmount = Math.max(0, newTotal - currentSynth);
        if (grantedAmount > 0) {
            events.push({
                type: 'TOKEN_GRANTED',
                payload: {
                    targetId: attackerId,
                    tokenId: TOKEN_IDS.SYNTH,
                    amount: grantedAmount,
                    newTotal,
                    sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: nextTimestamp,
            } as TokenGrantedEvent);
            nextTimestamp += 0.001;
        }
    }

    if (electricityCount > 0) {
        events.push(...buildNanobombApplyEvents(state, originalAttackerId, electricityCount, sourceAbilityId, nextTimestamp));
    }
    return events;
}

registerChoiceResolvedEventHandler(ACTIVATE_BOT_CHOICE_ID, ({
    state,
    playerId,
    sourceAbilityId,
    value,
    timestamp,
    random,
}) => {
    if (!sourceAbilityId || typeof value !== 'number' || !Number.isFinite(value)) return [];

    const {
        selectedTokenId,
        remainingAfter,
        usedMaskAfter,
    } = decodeActivateBotChoiceValue(value);
    if (!selectedTokenId) return [];
    if (
        !isArtificerBotBuilt(state, playerId, selectedTokenId)
        || getRemainingArtificerBotActivations(state, playerId, selectedTokenId) <= 0
    ) {
        return [];
    }

    const nextState = state;
    const isShockBot = selectedTokenId === TOKEN_IDS.SHOCK_BOT;
    const events: DiceThroneEvent[] = [{
        type: 'TOKEN_USED',
        payload: {
            playerId,
            tokenId: selectedTokenId,
            amount: 1,
            effectType: isShockBot ? 'damageBoost' : 'botActivation',
            ...(isShockBot ? { damageModifier: 3, appliesToCurrentAttack: true } : {}),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenUsedEvent];
    let nextTimestamp = timestamp;

    if (selectedTokenId === TOKEN_IDS.NANOBOT) {
        events.push(...handleNanobotDetonate({
            state: nextState,
            attackerId: playerId,
            targetId: nextState.pendingAttack?.defenderId ?? playerId,
            sourceAbilityId,
            timestamp: nextTimestamp,
            random,
            action: { type: 'custom', target: 'self', customActionId: 'artificer-nanobot-detonate' },
            ctx: {
                attackerId: playerId,
                defenderId: nextState.pendingAttack?.defenderId ?? playerId,
                sourceAbilityId,
                state: nextState,
                damageDealt: nextState.pendingAttack?.resolvedDamage ?? 0,
                timestamp: nextTimestamp,
            },
        }));
        nextTimestamp += 0.01;
    } else if (selectedTokenId === TOKEN_IDS.HEAL_BOT) {
        events.push(...handleHealBotUse({
            state: nextState,
            attackerId: playerId,
            targetId: playerId,
            sourceAbilityId,
            timestamp: nextTimestamp,
            random,
            action: { type: 'custom', target: 'self', customActionId: 'artificer-heal-bot-use' },
            ctx: {
                attackerId: playerId,
                defenderId: nextState.pendingAttack?.defenderId ?? playerId,
                sourceAbilityId,
                state: nextState,
                damageDealt: nextState.pendingAttack?.resolvedDamage ?? 0,
                timestamp: nextTimestamp,
            },
        }));
        nextTimestamp += 0.01;
    }

    if (remainingAfter > 0) {
        const nextRequest = buildArtificerBotActivationChoiceRequest(
            nextState,
            playerId,
            sourceAbilityId,
            remainingAfter,
            usedMaskAfter,
            nextTimestamp,
        );
        if (nextRequest) {
            events.push(nextRequest);
        }
    }

    return events;
});

registerChoiceEffectHandler(ARC_SHIELD_PREVENT_2_CHOICE_ID, ({ state, playerId, sourceAbilityId, value }) => {
    if (sourceAbilityId !== 'upgrade-artificer-shock-bot-2') return undefined;
    return applyArcShieldPrevent(state, playerId, sourceAbilityId, value ?? 2);
});

registerChoiceEffectHandler(ARC_SHIELD_PREVENT_3_CHOICE_ID, ({ state, playerId, sourceAbilityId, value }) => {
    if (sourceAbilityId !== 'upgrade-artificer-shock-bot-2') return undefined;

    const player = state.players[playerId];
    const synth = player?.tokens[TOKEN_IDS.SYNTH] ?? 0;
    if (!player || synth <= 0) return undefined;

    const prevented = applyArcShieldPrevent(state, playerId, sourceAbilityId, value ?? 3);
    if (!prevented) return undefined;

    const nextPlayers = prevented.players ?? state.players;
    const nextPlayer = nextPlayers[playerId] ?? player;
    return {
        ...prevented,
        players: {
            ...nextPlayers,
            [playerId]: {
                ...nextPlayer,
                tokens: {
                    ...nextPlayer.tokens,
                    [TOKEN_IDS.SYNTH]: synth - 1,
                },
            },
        },
    };
});

const WRENCH_STRIKE_CHOICE_IDS = new Set([
    WRENCH_STRIKE_ROLL_CHOICE_ID,
    WRENCH_STRIKE_SPEND_WRENCH_CHOICE_ID,
    WRENCH_STRIKE_SPEND_GEAR_CHOICE_ID,
    WRENCH_STRIKE_SPEND_ELECTRICITY_CHOICE_ID,
]);

for (const choiceId of WRENCH_STRIKE_CHOICE_IDS) {
    registerChoiceEffectHandler(choiceId, ({ state, sourceAbilityId }) => {
        if (!isWrenchStrikeAbilityId(sourceAbilityId) || !state.pendingAttack) return undefined;
        return {
            pendingAttack: {
                ...state.pendingAttack,
                preDefenseResolved: false,
                followUpChoiceBySourceAbilityId: {
                    ...(state.pendingAttack.followUpChoiceBySourceAbilityId ?? {}),
                    [sourceAbilityId]: choiceId,
                },
            },
        };
    });
}

registerChoiceEffectHandler(BUILD_FROM_SCRATCH_CHOICE_ID, ({ state, playerId, sourceAbilityId, value }) => {
    if (!isBuildFromScratchAbilityId(sourceAbilityId)) return undefined;

    let players: DiceThroneCore['players'] | undefined;
    switch (value) {
        case BUILD_ADVANCED_NANOBOT:
            players = buildBuildFromScratchState(state, playerId, TOKEN_IDS.NANOBOT, 'build').players;
            break;
        case BUILD_ADVANCED_SHOCK_BOT:
            players = buildBuildFromScratchState(state, playerId, TOKEN_IDS.SHOCK_BOT, 'build').players;
            break;
        case BUILD_ADVANCED_HEAL_BOT:
            players = buildBuildFromScratchState(state, playerId, TOKEN_IDS.HEAL_BOT, 'build').players;
            break;
        case UPGRADE_NANOBOT:
            players = buildBuildFromScratchState(state, playerId, TOKEN_IDS.NANOBOT, 'upgrade').players;
            break;
        case UPGRADE_SHOCK_BOT:
            players = buildBuildFromScratchState(state, playerId, TOKEN_IDS.SHOCK_BOT, 'upgrade').players;
            break;
        case UPGRADE_HEAL_BOT:
            players = buildBuildFromScratchState(state, playerId, TOKEN_IDS.HEAL_BOT, 'upgrade').players;
            break;
        default:
            return undefined;
    }

    return {
        players,
        pendingAttack: state.pendingAttack?.sourceAbilityId === sourceAbilityId
            ? {
                ...updatePendingAttackSettlementStage(state.pendingAttack, 'readyToResolve')!,
                postDamageFollowUpResolved: true,
            }
            : state.pendingAttack,
    };
});

export function registerArtificerCustomActions(): void {
    registerBonusDiceSettlementHandler(ARTIFICER_HEAL_BOT_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        if (!die) return { totalDamage: 0, followupEvents: [] };
        const healAmount = die.face === ARTIFICER_DICE_FACE_IDS.WRENCH ? 1 : 2;
        const currentHp = state.players[settlement.attackerId]?.resources[RESOURCE_IDS.HP] ?? 0;
        return {
            totalDamage: 0,
            followupEvents: [{
                type: 'HEAL_APPLIED',
                payload: {
                    targetId: settlement.attackerId,
                    amount: Math.max(0, Math.min(healAmount, MAX_HEALTH - currentHp)),
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as HealAppliedEvent],
        };
    });
    registerBonusDiceSettlementHandler(ARTIFICER_WRENCH_STRIKE_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        if (!die) return { totalDamage: 0, followupEvents: [] };
        if (die.face === ARTIFICER_DICE_FACE_IDS.WRENCH || die.face === ARTIFICER_DICE_FACE_IDS.GEAR) {
            return {
                totalDamage: 0,
                followupEvents: [{
                    type: 'BONUS_DAMAGE_ADDED',
                    payload: {
                        playerId: settlement.attackerId,
                        amount: die.face === ARTIFICER_DICE_FACE_IDS.WRENCH ? 1 : 2,
                        sourceCardId: settlement.sourceAbilityId,
                    },
                    sourceCommandType: 'BONUS_DICE_SETTLED',
                    timestamp,
                } as DiceThroneEvent],
            };
        }
        const currentSynth = state.players[settlement.attackerId]?.tokens[TOKEN_IDS.SYNTH] ?? 0;
        const maxSynth = getTokenStackLimit(state, settlement.attackerId, TOKEN_IDS.SYNTH);
        const newTotal = Math.min(currentSynth + 1, maxSynth);
        return {
            totalDamage: 0,
            followupEvents: [{
                type: 'TOKEN_GRANTED',
                payload: {
                    targetId: settlement.attackerId,
                    tokenId: TOKEN_IDS.SYNTH,
                    amount: Math.max(0, newTotal - currentSynth),
                    newTotal,
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as TokenGrantedEvent],
        };
    });
    registerBonusDiceSettlementHandler(ARTIFICER_PERFECTLY_CALIBRATED_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        if (!die) return { totalDamage: 0, followupEvents: [] };
        const currentSynth = state.players[settlement.attackerId]?.tokens[TOKEN_IDS.SYNTH] ?? 0;
        const maxSynth = getTokenStackLimit(state, settlement.attackerId, TOKEN_IDS.SYNTH);
        const newTotal = Math.min(currentSynth + Math.ceil(die.value / 2), maxSynth);
        return {
            totalDamage: 0,
            followupEvents: [{
                type: 'TOKEN_GRANTED',
                payload: {
                    targetId: settlement.attackerId,
                    tokenId: TOKEN_IDS.SYNTH,
                    amount: Math.max(0, newTotal - currentSynth),
                    newTotal,
                    sourceAbilityId: settlement.sourceAbilityId,
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as TokenGrantedEvent],
        };
    });

    registerCustomActionHandler('artificer-activate-bots', handleArtificerActivateBots, {
        categories: ['choice', 'damage', 'defense', 'dice', 'status', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('artificer-nanobot-detonate', handleNanobotDetonate, { categories: ['damage', 'status', 'token'] });
    registerCustomActionHandler('artificer-synth-inflict-nanobomb', handleSynthInflictNanobomb, {
        categories: ['status', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler(SYNTH_INFLICT_NANOBOMB_SELECTED_ACTION_ID, handleSynthInflictNanobombSelected, {
        categories: ['status', 'token'],
    });
    registerCustomActionHandler('artificer-arc-shield', handleArcShield, { categories: ['defense', 'token'] });
    registerCustomActionHandler('artificer-wrench-strike-branch', handleWrenchStrikeBranch, { categories: ['dice', 'damage', 'token'] });
    registerCustomActionHandler('artificer-mechanical-army', handleMechanicalArmy, {
        categories: ['damage'],
        estimateDamage: (rawState, playerId) => countOwnedRobotTypes(rawState as DiceThroneCore, playerId) + 5,
    });
    registerCustomActionHandler('artificer-tinker-defense', handleTinkerDefense, {
        categories: ['defense', 'status', 'token'],
        phases: ['defensiveRoll'],
    });
    registerCustomActionHandler('artificer-tinker-2-defense', handleTinker2Defense, {
        categories: ['damage', 'defense', 'status', 'token'],
        phases: ['defensiveRoll'],
    });
    registerCustomActionHandler('artificer-build-from-scratch-choice', handleBuildFromScratchChoice, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('artificer-heal-bot-use', handleHealBotUse, { categories: ['dice', 'defense', 'token'] });
    registerCustomActionHandler('artificer-perfectly-calibrated-roll', handlePerfectlyCalibratedRoll, { categories: ['dice', 'token'] });
    registerCustomActionHandler('artificer-build-nanobot', buildRobotUse(TOKEN_IDS.NANOBOT), { categories: ['token'] });
    registerCustomActionHandler('artificer-build-shock-bot', buildRobotUse(TOKEN_IDS.SHOCK_BOT), { categories: ['token'] });
    registerCustomActionHandler('artificer-build-heal-bot', buildRobotUse(TOKEN_IDS.HEAL_BOT), { categories: ['token'] });
    registerCustomActionHandler('artificer-upgrade-nanobot', upgradeRobot(TOKEN_IDS.NANOBOT), { categories: ['token'] });
    registerCustomActionHandler('artificer-upgrade-shock-bot', upgradeRobot(TOKEN_IDS.SHOCK_BOT), { categories: ['token'] });
    registerCustomActionHandler('artificer-upgrade-heal-bot', upgradeRobot(TOKEN_IDS.HEAL_BOT), { categories: ['token'] });
}
