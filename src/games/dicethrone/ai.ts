import type { Command, MatchState, PlayerId } from '../../engine/types';
import { createAiLegalActionId } from '../../engine/ai';
import {
    createActionKindScorer,
    createScoredLocalAiPolicy,
} from '../../engine/ai';
import type {
    AiDecisionContext,
    AiLegalAction,
    GameAiRuntime,
    LocalAiActionScorer,
} from '../../engine/ai';
import type { InteractionDescriptor as EngineInteractionDescriptor, MultistepChoiceData, PromptMultiConfig } from '../../engine/systems/InteractionSystem';
import { DiceThroneDomain } from './domain';
import {
    DICETHRONE_COMMANDS,
    RESOURCE_IDS,
    STATUS_IDS,
    canAdvancePhase,
    canSellCard,
    canUndoSell,
    checkPlayCard,
    checkPlayUpgradeCard,
    getActiveDice,
    getAvailableAbilityIds,
    getDefensiveAbilityIds,
    getNextPhase,
    isCardPlayableInResponseWindow,
} from './domain';
import { DICETHRONE_CHARACTER_CATALOG } from './domain/types';
import { findPlayerAbility, getPlayerAbilityBaseDamage } from './domain/abilityLookup';
import { getPlayerPassiveAbilities, isPassiveActionUsable } from './domain/passiveAbility';
import { hasDebuffs, hasPurifyToken, getUsableTokensForTiming } from './domain/tokenResponse';
import type {
    AbilityCard,
    DiceThroneCore,
    DtResponseWindowType,
    PendingBonusDiceSettlement,
    PendingDamage,
    TurnPhase,
} from './domain/types';

type DiceThroneState = MatchState<DiceThroneCore>;

type DiceInteractionData = MultistepChoiceData<unknown, unknown> & {
    meta?: {
        dtType?: 'modifyDie' | 'selectDie';
        dieModifyConfig?: {
            mode?: 'set' | 'adjust' | 'copy' | 'any';
            targetValue?: number;
        };
        diceOwnerId?: PlayerId;
        targetOpponentDice?: boolean;
    };
};

const createCommand = (playerId: PlayerId, type: string, payload: unknown = {}): Command => ({
    type,
    playerId,
    payload,
    timestamp: 0,
});

const isCommandValid = (state: DiceThroneState, playerId: PlayerId, type: string, payload: unknown = {}): boolean => {
    const result = DiceThroneDomain.validate(state, createCommand(playerId, type, payload) as never);
    return result.valid;
};

const appendAction = (
    actions: AiLegalAction[],
    state: DiceThroneState,
    playerId: PlayerId,
    action: AiLegalAction,
): void => {
    if (action.commands.length === 0) return;
    const commandSpecs = action.commands.map((command) => ({
        type: command.type,
        payload: command.payload,
    }));
    const isValid = commandSpecs.every((command) => isCommandValid(state, playerId, command.type, command.payload));
    if (!isValid) return;
    actions.push(action);
};

const buildSimpleChoicePayload = (
    optionIds: string[],
    multi: PromptMultiConfig | undefined,
): { optionId?: string; optionIds?: string[] } => {
    if (optionIds.length <= 1 && !multi) {
        return { optionId: optionIds[0] };
    }
    if (optionIds.length <= 1 && (multi?.min ?? 0) <= 1) {
        return { optionId: optionIds[0] };
    }
    return { optionIds };
};

const buildInteractionActions = (
    state: DiceThroneState,
    playerId: PlayerId,
): AiLegalAction[] | null => {
    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current || current.playerId !== playerId) return null;

    if (current.kind === 'simple-choice') {
        const data = current.data as {
            options?: Array<{ id?: string; label?: string; disabled?: boolean }>;
            multi?: PromptMultiConfig;
        };
        const availableOptions = (data.options ?? []).filter((option): option is { id: string; label?: string } => {
            return typeof option?.id === 'string' && option.disabled !== true;
        });
        const minCount = Math.max(1, data.multi?.min ?? 1);
        return availableOptions.map((option, index) => {
            const selectedIds = availableOptions.slice(0, minCount).map((item) => item.id);
            const payload = buildSimpleChoicePayload(
                minCount > 1 ? selectedIds : [option.id],
                data.multi,
            );
            return {
                actionId: createAiLegalActionId('interaction', current.id, option.id),
                kind: 'interaction-choice',
                label: option.label ?? `选择 ${index + 1}`,
                commands: [{
                    type: 'SYS_INTERACTION_RESPOND',
                    payload,
                }],
                metadata: {
                    interactionId: current.id,
                    optionId: option.id,
                },
            };
        });
    }

    if (current.kind !== 'multistep-choice') {
        return null;
    }

    const data = current.data as DiceInteractionData;
    const meta = data.meta;
    const activeDice = getActiveDice(state.core);
    const interactionId = current.id;

    if (meta?.dtType === 'selectDie') {
        return activeDice.map((die) => ({
            actionId: createAiLegalActionId('interaction', interactionId, 'reroll', die.id),
            kind: 'interaction-multistep',
            label: `重掷骰子 ${die.id}`,
            commands: [
                { type: 'REROLL_DIE', payload: { dieId: die.id } },
                { type: 'SYS_INTERACTION_CONFIRM', payload: { interactionId } },
            ],
            metadata: {
                interactionId,
                dieId: die.id,
            },
        }));
    }

    if (meta?.dtType === 'modifyDie') {
        const targetValue = meta.dieModifyConfig?.targetValue ?? 6;
        const mode = meta.dieModifyConfig?.mode;
        return activeDice.map((die) => {
            const newValue = mode === 'adjust'
                ? Math.min(6, Math.max(1, die.value + 1))
                : mode === 'copy'
                    ? activeDice[0]?.value ?? die.value
                    : targetValue;
            return {
                actionId: createAiLegalActionId('interaction', interactionId, 'modify', die.id, newValue),
                kind: 'interaction-multistep',
                label: `修改骰子 ${die.id}`,
                commands: [
                    { type: 'MODIFY_DIE', payload: { dieId: die.id, newValue } },
                    { type: 'SYS_INTERACTION_CONFIRM', payload: { interactionId } },
                ],
                metadata: {
                    interactionId,
                    dieId: die.id,
                    newValue,
                    mode,
                },
            };
        });
    }

    return null;
};

const buildSetupActions = (state: DiceThroneState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];

    for (const character of DICETHRONE_CHARACTER_CATALOG) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('setup', 'select-character', character.id),
            kind: 'setup-select-character',
            label: `选择角色 ${character.id}`,
            commands: [{
                type: 'SELECT_CHARACTER',
                payload: { characterId: character.id },
            }],
            metadata: { characterId: character.id },
        });
    }

    appendAction(actions, state, playerId, {
        actionId: createAiLegalActionId('setup', 'player-ready'),
        kind: 'setup-ready',
        label: '准备完成',
        commands: [{ type: 'PLAYER_READY', payload: {} }],
    });

    appendAction(actions, state, playerId, {
        actionId: createAiLegalActionId('setup', 'host-start'),
        kind: 'setup-host-start',
        label: '开始对局',
        commands: [{ type: 'HOST_START_GAME', payload: {} }],
    });

    return actions;
};

const buildResponseActions = (state: DiceThroneState, playerId: PlayerId, phase: TurnPhase): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const responseWindow = state.sys.responseWindow?.current;
    const player = state.core.players[playerId];
    if (!responseWindow || !player) return actions;

    const windowType = responseWindow.windowType as DtResponseWindowType | undefined;
    const pendingDamage = state.core.pendingDamage as PendingDamage | undefined;

    appendAction(actions, state, playerId, {
        actionId: createAiLegalActionId('response', 'pass'),
        kind: 'response-pass',
        label: '跳过响应',
        commands: [{ type: 'RESPONSE_PASS', payload: {} }],
    });

    if (pendingDamage && pendingDamage.responderId === playerId) {
        const tokenTiming = pendingDamage.responseType;
        const usableTokens = tokenTiming
            ? getUsableTokensForTiming(state.core, playerId, tokenTiming)
            : [];
        for (const token of usableTokens) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('response', 'token', token.id),
                kind: 'token-response',
                label: `使用 ${token.id}`,
                commands: [{
                    type: 'USE_TOKEN',
                    payload: { tokenId: token.id, amount: 1 },
                }],
                metadata: { tokenId: token.id },
            });
        }

        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('response', 'skip-token'),
            kind: 'skip-token-response',
            label: '跳过 Token 响应',
            commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: {} }],
        });
    }

    for (const card of player.hand) {
        if (!isCardPlayableInResponseWindow(state.core, playerId, card, windowType ?? 'afterCardPlayed', phase)) {
            continue;
        }
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('response', 'play-card', card.id),
            kind: 'response-play-card',
            label: `打出 ${card.id}`,
            commands: [{
                type: 'PLAY_CARD',
                payload: { cardId: card.id },
            }],
            metadata: { cardId: card.id },
        });
    }

    return actions;
};

const buildBonusDiceActions = (state: DiceThroneState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const settlement = state.core.pendingBonusDiceSettlement as PendingBonusDiceSettlement | undefined;
    if (!settlement || settlement.attackerId !== playerId) return actions;

    for (const die of settlement.dice) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('bonus-die', 'reroll', die.index),
            kind: 'bonus-die-reroll',
            label: `重掷奖励骰 ${die.index}`,
            commands: [{
                type: 'REROLL_BONUS_DIE',
                payload: { dieIndex: die.index },
            }],
            metadata: { dieIndex: die.index },
        });
    }

    appendAction(actions, state, playerId, {
        actionId: createAiLegalActionId('bonus-die', 'skip'),
        kind: 'skip-bonus-dice-reroll',
        label: '确认奖励骰',
        commands: [{ type: 'SKIP_BONUS_DICE_REROLL', payload: {} }],
    });

    return actions;
};

const buildPurifyActions = (state: DiceThroneState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];
    if (!player || !hasPurifyToken(state.core, playerId) || !hasDebuffs(state.core, playerId)) {
        return actions;
    }

    const removableDebuffs = (state.core.tokenDefinitions ?? [])
        .filter((definition) => definition.category === 'debuff' && definition.passiveTrigger?.removable)
        .map((definition) => definition.id)
        .filter((statusId) => (player.statusEffects[statusId] ?? 0) > 0);

    for (const statusId of removableDebuffs) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('purify', statusId),
            kind: 'use-purify',
            label: `净化 ${statusId}`,
            commands: [{
                type: 'USE_PURIFY',
                payload: { statusId },
            }],
            metadata: { statusId },
        });
    }

    return actions;
};

const buildPassiveActions = (state: DiceThroneState, playerId: PlayerId, phase: TurnPhase): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const passiveAbilities = getPlayerPassiveAbilities(state.core, playerId);
    const activeDice = getActiveDice(state.core);

    for (const passive of passiveAbilities) {
        passive.actions.forEach((passiveAction, actionIndex) => {
            if (!isPassiveActionUsable(state.core, playerId, passive.id, actionIndex, phase)) {
                return;
            }

            if (passiveAction.type === 'rerollDie') {
                activeDice
                    .filter((die) => !die.isKept)
                    .forEach((die) => {
                        appendAction(actions, state, playerId, {
                            actionId: createAiLegalActionId('passive', passive.id, actionIndex, die.id),
                            kind: 'use-passive-ability',
                            label: `使用被动 ${passive.id}`,
                            commands: [{
                                type: 'USE_PASSIVE_ABILITY',
                                payload: {
                                    passiveId: passive.id,
                                    actionIndex,
                                    targetDieId: die.id,
                                },
                            }],
                            metadata: {
                                passiveId: passive.id,
                                actionIndex,
                                targetDieId: die.id,
                            },
                        });
                    });
                return;
            }

            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('passive', passive.id, actionIndex),
                kind: 'use-passive-ability',
                label: `使用被动 ${passive.id}`,
                commands: [{
                    type: 'USE_PASSIVE_ABILITY',
                    payload: {
                        passiveId: passive.id,
                        actionIndex,
                    },
                }],
                metadata: {
                    passiveId: passive.id,
                    actionIndex,
                },
            });
        });
    }

    return actions;
};

const buildPhaseActions = (state: DiceThroneState, playerId: PlayerId, phase: TurnPhase): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const player = state.core.players[playerId];
    if (!player) return actions;

    if (phase === 'discard') {
        for (const card of player.hand) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('discard', card.id),
                kind: 'discard-card',
                label: `弃置 ${card.id}`,
                commands: [{
                    type: 'DISCARD_CARD',
                    payload: { cardId: card.id },
                }],
                metadata: { cardId: card.id },
            });
        }
    }

    if ((phase === 'offensiveRoll' || phase === 'defensiveRoll') && state.core.rollCount === 0) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('roll', 'dice'),
            kind: 'roll-dice',
            label: '掷骰',
            commands: [{ type: 'ROLL_DICE', payload: {} }],
        });
    }

    if (phase === 'offensiveRoll' || phase === 'defensiveRoll') {
        const abilityIds = phase === 'defensiveRoll'
            ? getDefensiveAbilityIds(state.core, playerId)
            : getAvailableAbilityIds(state.core, playerId, phase);
        for (const abilityId of abilityIds) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('ability', abilityId),
                kind: 'select-ability',
                label: `选择技能 ${abilityId}`,
                commands: [{
                    type: 'SELECT_ABILITY',
                    payload: { abilityId },
                }],
                metadata: { abilityId },
            });
        }

        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('roll', 'confirm'),
            kind: 'confirm-roll',
            label: '确认骰面',
            commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
        });
    }

    if (phase === 'main1' || phase === 'main2') {
        for (const card of player.hand) {
            if (card.type === 'upgrade') {
                const targetAbilityId = card.effects?.find((effect) => effect.action?.type === 'replaceAbility')?.action?.targetAbilityId;
                if (!targetAbilityId) continue;
                const check = checkPlayUpgradeCard(state.core, playerId, card, targetAbilityId, phase);
                if (!check.ok) continue;
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('play-upgrade', card.id, targetAbilityId),
                    kind: 'play-upgrade-card',
                    label: `升级 ${card.id}`,
                    commands: [{
                        type: 'PLAY_UPGRADE_CARD',
                        payload: { cardId: card.id, targetAbilityId },
                    }],
                    metadata: { cardId: card.id, targetAbilityId },
                });
                continue;
            }

            const check = checkPlayCard(state.core, playerId, card, phase);
            if (!check.ok) continue;
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('play-card', card.id),
                kind: 'play-card',
                label: `打出 ${card.id}`,
                commands: [{
                    type: 'PLAY_CARD',
                    payload: { cardId: card.id },
                }],
                metadata: { cardId: card.id },
            });
        }

        if (canSellCard(state.core, playerId)) {
            for (const card of player.hand) {
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('sell-card', card.id),
                    kind: 'sell-card',
                    label: `卖出 ${card.id}`,
                    commands: [{
                        type: 'SELL_CARD',
                        payload: { cardId: card.id },
                    }],
                    metadata: { cardId: card.id },
                });
            }
        }

        if (canUndoSell(state.core, playerId)) {
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('undo-sell'),
                kind: 'undo-sell-card',
                label: '撤销卖牌',
                commands: [{ type: 'UNDO_SELL_CARD', payload: {} }],
            });
        }
    }

    if ((phase === 'upkeep' || phase === 'income' || phase === 'main1')
        && (state.core.players[playerId]?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0) > 0
        && (state.core.players[playerId]?.resources[RESOURCE_IDS.CP] ?? 0) >= 2
    ) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('status', 'remove-knockdown'),
            kind: 'pay-remove-knockdown',
            label: '花费 2CP 移除击倒',
            commands: [{
                type: DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN,
                payload: {},
            }],
        });
    }

    if (canAdvancePhase(state.core, phase)) {
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('phase', 'advance', phase, getNextPhase(state.core, phase)),
            kind: 'advance-phase',
            label: `推进到 ${getNextPhase(state.core, phase)}`,
            commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
            metadata: { phase, nextPhase: getNextPhase(state.core, phase) },
        });
    }

    return actions;
};

export function buildDiceThroneAiLegalActions(args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = args.state as DiceThroneState;
    const player = state.core.players[args.playerId];
    if (!player) return [];

    const phase = (state.sys.phase ?? state.sys.flow?.phase ?? 'setup') as TurnPhase;

    const interactionActions = buildInteractionActions(state, args.playerId);
    if (interactionActions && interactionActions.length > 0) {
        return interactionActions.filter((action) =>
            action.commands.every((command) => isCommandValid(state, args.playerId, command.type, command.payload)),
        );
    }

    if (phase === 'setup') {
        return buildSetupActions(state, args.playerId);
    }

    const bonusDiceActions = buildBonusDiceActions(state, args.playerId);
    if (bonusDiceActions.length > 0) {
        return bonusDiceActions;
    }

    if (state.sys.responseWindow?.current) {
        return buildResponseActions(state, args.playerId, phase);
    }

    return [
        ...buildPurifyActions(state, args.playerId),
        ...buildPassiveActions(state, args.playerId, phase),
        ...buildPhaseActions(state, args.playerId, phase),
    ];
}

const getContextPhase = (context: AiDecisionContext): TurnPhase => {
    const state = context.visibleState as DiceThroneState;
    return (state.sys.phase ?? state.sys.flow?.phase ?? 'setup') as TurnPhase;
};

const findPlayerHandCard = (
    state: DiceThroneState,
    playerId: PlayerId,
    cardId: string,
): AbilityCard | null => {
    return state.core.players[playerId]?.hand.find((card) => card.id === cardId) ?? null;
};

const diceThroneKindScorer = createActionKindScorer('kind-weight', {
    'interaction-choice': 240,
    'interaction-multistep': 240,
    'use-purify': 210,
    'pay-remove-knockdown': 195,
    'token-response': 160,
    'response-play-card': 150,
    'use-passive-ability': 135,
    'select-ability': 220,
    'roll-dice': 170,
    'confirm-roll': 120,
    'bonus-die-reroll': 105,
    'skip-bonus-dice-reroll': 15,
    'setup-select-character': 180,
    'setup-ready': 160,
    'setup-host-start': 150,
    'play-upgrade-card': 200,
    'play-card': 120,
    'sell-card': 30,
    'undo-sell-card': -40,
    'discard-card': 0,
    'skip-token-response': 30,
    'response-pass': 20,
    'advance-phase': 10,
});

const setupCharacterScorer: LocalAiActionScorer = {
    id: 'setup-character-preference',
    score(_context, action) {
        if (action.kind !== 'setup-select-character') return null;
        const characterId = typeof action.metadata?.characterId === 'string'
            ? action.metadata.characterId
            : null;
        if (characterId === 'monk') {
            return {
                score: 80,
                reason: '优先使用当前本地 AI 覆盖最完整的武僧样板',
            };
        }
        return 10;
    },
};

const abilityValueScorer: LocalAiActionScorer = {
    id: 'ability-value',
    score(context, action) {
        if (action.kind !== 'select-ability') return null;
        const abilityId = typeof action.metadata?.abilityId === 'string'
            ? action.metadata.abilityId
            : null;
        if (!abilityId) return null;

        const state = context.visibleState as DiceThroneState;
        const match = findPlayerAbility(state.core, context.playerId, abilityId);
        if (!match) return null;

        const phase = getContextPhase(context);
        const baseDamage = getPlayerAbilityBaseDamage(state.core, context.playerId, abilityId);
        let score = baseDamage * 25;

        if (match.ability.type === 'offensive' && phase === 'offensiveRoll') {
            score += 90;
        }
        if ((match.ability.type === 'defensive' || match.ability.tags?.includes('defensive')) && phase === 'defensiveRoll') {
            score += 110;
        }
        if (match.ability.tags?.includes('ultimate')) {
            score += 45;
        }

        return {
            score,
            reason: `能力 ${abilityId} 的基础收益更高`,
        };
    },
};

const cardValueScorer: LocalAiActionScorer = {
    id: 'card-value',
    score(context, action) {
        const cardId = typeof action.metadata?.cardId === 'string'
            ? action.metadata.cardId
            : null;
        if (!cardId) return null;

        const state = context.visibleState as DiceThroneState;
        const card = findPlayerHandCard(state, context.playerId, cardId);
        if (!card) return null;

        if (action.kind === 'play-upgrade-card') {
            return {
                score: 70 + card.cpCost * 18,
                reason: `优先打出升级牌 ${cardId}`,
            };
        }

        if (action.kind === 'play-card') {
            return {
                score: 35 + card.cpCost * 10 + (card.isAttackModifier ? 30 : 0),
                reason: card.isAttackModifier ? `攻击修正牌 ${cardId} 具有即时收益` : `行动牌 ${cardId} 可带来额外收益`,
            };
        }

        if (action.kind === 'sell-card') {
            return {
                score: 10 + card.cpCost * 8,
                reason: `卖牌 ${cardId} 可换取 CP`,
            };
        }

        if (action.kind === 'discard-card') {
            return {
                score: card.cpCost * 20 + (card.type === 'action' ? 10 : 0),
                reason: `优先弃掉费用更高的手牌 ${cardId}`,
            };
        }

        return null;
    },
};

const interactionValueScorer: LocalAiActionScorer = {
    id: 'interaction-value',
    score(context, action) {
        const state = context.visibleState as DiceThroneState;

        if (action.kind === 'interaction-multistep') {
            const newValue = typeof action.metadata?.newValue === 'number'
                ? action.metadata.newValue
                : null;
            if (newValue !== null) {
                return {
                    score: newValue * 18,
                    reason: `优先把骰子调整到更高点数 ${newValue}`,
                };
            }

            const dieId = typeof action.metadata?.dieId === 'number'
                ? action.metadata.dieId
                : null;
            if (dieId !== null) {
                const die = state.core.dice.find((item) => item.id === dieId);
                if (die) {
                    return {
                        score: (7 - die.value) * 12,
                        reason: `优先重掷较低点数的骰子 ${die.value}`,
                    };
                }
            }
        }

        if (action.kind === 'interaction-choice') {
            const optionId = typeof action.metadata?.optionId === 'string'
                ? action.metadata.optionId
                : '';
            if (optionId.includes('confirm') || optionId.includes('accept')) {
                return {
                    score: 20,
                    reason: '确认类交互通常代表当前方案已经可执行',
                };
            }
            return {
                score: 5,
                reason: '普通交互选项保留轻微优先级',
            };
        }

        return null;
    },
};

const bonusDieScorer: LocalAiActionScorer = {
    id: 'bonus-die',
    score(context, action) {
        const state = context.visibleState as DiceThroneState;
        const settlement = state.core.pendingBonusDiceSettlement as PendingBonusDiceSettlement | undefined;
        if (!settlement) return null;

        if (action.kind === 'bonus-die-reroll') {
            const dieIndex = typeof action.metadata?.dieIndex === 'number'
                ? action.metadata.dieIndex
                : null;
            const die = dieIndex !== null
                ? settlement.dice.find((item) => item.index === dieIndex)
                : null;
            if (!die) return null;
            return {
                score: (4 - die.value) * 35,
                reason: `优先重掷较低的奖励骰 ${die.value}`,
            };
        }

        if (action.kind === 'skip-bonus-dice-reroll') {
            return {
                score: 15,
                reason: '当前奖励骰已足够，直接确认',
            };
        }

        return null;
    },
};

const statusScorer: LocalAiActionScorer = {
    id: 'status-priority',
    score(context, action) {
        const state = context.visibleState as DiceThroneState;
        const player = state.core.players[context.playerId];
        if (!player) return null;

        if (action.kind === 'use-purify') {
            const statusId = typeof action.metadata?.statusId === 'string'
                ? action.metadata.statusId
                : null;
            const stacks = statusId ? (player.statusEffects[statusId] ?? 0) : 0;
            return {
                score: 90 + stacks * 20,
                reason: `优先净化减益 ${statusId ?? ''}`,
            };
        }

        if (action.kind === 'pay-remove-knockdown') {
            return {
                score: 110,
                reason: '优先解除击倒以恢复行动能力',
            };
        }

        return null;
    },
};

const phaseTempoScorer: LocalAiActionScorer = {
    id: 'phase-tempo',
    score(context, action) {
        const phase = getContextPhase(context);

        if (action.kind === 'advance-phase') {
            if (phase === 'main1' || phase === 'main2') {
                return {
                    score: -20,
                    reason: '主阶段仍优先尝试创造收益，而不是过早结束阶段',
                };
            }
            return 5;
        }

        if (action.kind === 'confirm-roll' && phase === 'offensiveRoll') {
            return {
                score: 20,
                reason: '无更优能力时尽快确认当前骰面',
            };
        }

        return null;
    },
};

const diceThroneLocalPolicyScorers: LocalAiActionScorer[] = [
    diceThroneKindScorer,
    setupCharacterScorer,
    abilityValueScorer,
    cardValueScorer,
    interactionValueScorer,
    bonusDieScorer,
    statusScorer,
    phaseTempoScorer,
];

const defaultLocalPolicy = createScoredLocalAiPolicy({
    id: 'baseline',
    scorers: diceThroneLocalPolicyScorers,
});

export const diceThroneAiRuntime: GameAiRuntime = {
    gameId: 'dicethrone',
    buildLegalActions: buildDiceThroneAiLegalActions,
    localPolicies: {
        baseline: defaultLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
