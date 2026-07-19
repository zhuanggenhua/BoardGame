import {
    resolveQidahenGaoDiDispatchChoice,
    resolveQidahenInternalDispatchInteractionChoice,
} from './actionWindowDispatch';
import {
    resolveQidahenDiplomacyInteractionChoice,
    resolveQidahenDriveTigerConsentInteractionChoice,
    resolveQidahenGrantPardonInteractionChoice,
    resolveQidahenKhanEdictInteractionChoice,
    resolveQidahenMaShiTradeInteractionChoice,
    resolveQidahenRecruitInteractionChoice,
} from './actionWindowChoices';
import {
    resolveQidahenPendingActionFromPayload,
    resolveQidahenPostBattleInteractionChoice,
} from './pendingBattleFlow';
import { pendingBattleHasDefenderArtillery } from './pendingBattleCombatSupport';
import {
    resolveQidahenScenarioChoiceResolvedEvent,
} from './scenarioChoiceState';
import {
    resolveQidahenScenarioVoteCastEvent,
} from './scenarioVoteState';
import { resolveQidahenFactionSelectedEvent } from './factionSelectionState';
import {
    resolveQidahenSunYuanhuaTechResolvedEvent,
} from './armamentUpgradeResolution';
import {
    getFactionIdByPlayerId,
} from './factionTurnAccessors';
import {
    resolveQidahenFortificationMaintenanceInteractionChoice,
} from './fortificationMaintenance';
import {
    resolveQidahenEventCharacterTargetChoice,
    resolveQidahenEventOpponentHandChoice,
} from './eventCharacterTargetSelection';
import {
    executeQidahenSelectedAction,
} from './selectedActionExecution';
import type { QidahenCore, QidahenEvent } from './types';
import {
    buildQidahenPincerAdvanceSelection,
    QIDAHEN_PINCER_ADVANCE_CARD_DEF_ID,
    resolveQidahenPincerAdvanceSelection,
    toggleQidahenPincerAdvanceChoice,
} from './pincerAdvanceSelection';
import {
    buildQidahenInfantryCavalryCombinedSelection,
    QIDAHEN_INFANTRY_CAVALRY_COMBINED_CARD_DEF_ID,
    resolveQidahenInfantryCavalryCombinedSelection,
} from './infantryCavalryCombinedSelection';
import {
    buildQidahenInstigateDefectionSelection,
    QIDAHEN_INSTIGATE_DEFECTION_ALT_CARD_DEF_ID,
    resolveQidahenInstigateDefectionSelection,
} from './instigateDefectionSelection';
import {
    buildQidahenWuzhenChaohaSelection,
    QIDAHEN_WUZHEN_CHAOHA_CARD_DEF_ID,
    resolveQidahenWuzhenChaohaSelection,
    setQidahenWuzhenChaohaArtilleryTechCount,
} from './wuzhenChaohaSelection';
import {
    resolveQidahenDefeatInDetailPlayed,
} from './defeatInDetail';
import {
    playQidahenRaidAndAmbush,
    QIDAHEN_RAID_AND_AMBUSH_CARD_DEF_ID,
} from './raidAndAmbushSelection';
import {
    playQidahenFeignedRetreat,
    QIDAHEN_FEIGNED_RETREAT_CARD_DEF_ID,
} from './feignedRetreatSelection';

const WUZHEN_CHAOHA_CARD_DEF_ID = 'qidahen-atlas05-1644-wuzhen-chaoha';
const ARROWS_LIKE_RAIN_CARD_DEF_ID = 'qidahen-atlas05-1615-arrows-like-rain';
const CAVALRY_CHARGE_CARD_DEF_ID = 'qidahen-atlas05-1618-cavalry-charge';
const RAID_GRAIN_CARD_DEF_ID = 'qidahen-atlas05-1612-raid-grain';
const WAR_CHARIOT_FORMATION_CARD_DEF_ID = 'qidahen-atlas05-1645-war-chariot-formation';
const JIRINAI_INFANTRY_CARD_DEF_ID = 'qidahen-atlas05-1640-jirinai-infantry';
const BAYARA_CARD_DEF_ID = 'qidahen-atlas05-1602-bayara';
const MOUNTED_INFANTRY_CARD_DEF_ID = 'qidahen-atlas05-1620-mounted-infantry';
const CHAIN_CANNON_FORMATION_CARD_DEF_ID = 'qidahen-atlas05-1638-chain-cannon-formation';
const STEADFAST_DEFENSE_CARD_DEF_ID = 'qidahen-atlas05-1635-steadfast-defense';
const CHEVAL_DE_FRISE_CARD_DEF_ID = 'qidahen-atlas05-1636-cheval-de-frise';
const INSTIGATE_DEFECT_ARTILLERY_CARD_DEF_IDS = new Set([
    'qidahen-atlas05-1604-instigate-defection-insider',
    'qidahen-atlas05-1611-instigate-defection',
]);

const resolveQidahenTacticCardPlayedEvent = (
    state: QidahenCore,
    event: Extract<QidahenEvent, { type: 'TACTIC_CARD_PLAYED' }>,
): QidahenCore => {
    const pendingTargetAction = state.pendingTargetAction;
    if (!pendingTargetAction) {
        return state;
    }
    const playedCard = state.handCards.find((card) => (
        card.id === event.payload.cardId
        && card.cardKind === 'tactic'
        && card.status !== 'disabled'
    ));
    if (!playedCard) {
        return state;
    }
    const playedCardSide = playedCard.faction === pendingTargetAction.attackerFactionId
        ? 'attacker'
        : playedCard.faction === pendingTargetAction.defenderFactionId
            ? 'defender'
            : null;
    if (!playedCardSide) {
        return state;
    }
    if (
        state.feignedRetreatSelection
        && playedCard.cardDefId === QIDAHEN_FEIGNED_RETREAT_CARD_DEF_ID
    ) {
        return playQidahenFeignedRetreat(state, playedCard.id, event.timestamp);
    }
    if (
        state.raidAndAmbushSelection?.phase === 'offer'
        && playedCard.cardDefId === QIDAHEN_RAID_AND_AMBUSH_CARD_DEF_ID
    ) {
        return playQidahenRaidAndAmbush(state, playedCard.id, event.timestamp);
    }
    if (playedCard.cardDefId === QIDAHEN_PINCER_ADVANCE_CARD_DEF_ID) {
        const selection = buildQidahenPincerAdvanceSelection(state, playedCard.id);
        return selection
            ? {
                ...state,
                pincerAdvanceSelection: selection,
                lastSeasonSummary: {
                    id: `summary-${event.timestamp}`,
                    title: '分进合击',
                    lines: [
                        `选择最多 ${selection.maxTroops} 个未参战部队进入 ${selection.targetRegionName} 野战。`,
                        '只有确认增援后才会消耗此战术牌。',
                    ],
                },
            }
            : state;
    }
    if (playedCard.cardDefId === QIDAHEN_INFANTRY_CAVALRY_COMBINED_CARD_DEF_ID) {
        const selection = buildQidahenInfantryCavalryCombinedSelection(state, playedCard.id);
        return selection
            ? {
                ...state,
                infantryCavalryCombinedSelection: selection,
                lastSeasonSummary: {
                    id: `summary-${event.timestamp}`,
                    title: '步骑联合',
                    lines: [
                        `选择让 ${selection.cavalryCount} 个骑兵撤回原来源，或转入步兵阶段与 ${selection.infantryCount} 个步兵共同攻击。`,
                        '确认选择后才会消耗此战术牌。',
                    ],
                },
            }
            : state;
    }
    if (playedCard.cardDefId === QIDAHEN_INSTIGATE_DEFECTION_ALT_CARD_DEF_ID) {
        const selection = buildQidahenInstigateDefectionSelection(state, playedCard.id);
        return selection
            ? {
                ...state,
                instigateDefectionSelection: selection,
                lastSeasonSummary: {
                    id: `summary-${event.timestamp}`,
                    title: '策反',
                    lines: [
                        `选择 ${selection.targetRegionName} 中实际参战的 1 个敌方次级部队。`,
                        '点击目标兵牌后才会消耗此战术牌。',
                    ],
                },
            }
            : state;
    }
    if (playedCard.cardDefId === QIDAHEN_WUZHEN_CHAOHA_CARD_DEF_ID) {
        const selection = buildQidahenWuzhenChaohaSelection(state, playedCard.id);
        return selection
            ? {
                ...state,
                wuzhenChaohaSelection: selection,
                lastSeasonSummary: {
                    id: `summary-${event.timestamp}`,
                    title: '乌真超哈',
                    lines: [
                        `选择 ${selection.targetRegionName} 本次实际参战的 1 个步兵部队。`,
                        '可先选择销毁《火炮技术》的数量；点击目标兵牌后才会消耗此战术牌。',
                    ],
                },
            }
            : state;
    }
    const attackerName = state.factions[pendingTargetAction.attackerFactionId]?.name ?? '攻方';
    const playedFactionName = state.factions[playedCard.faction]?.name ?? attackerName;
    const targetName = pendingTargetAction.targetRegionName;
    const tacticLine = `${playedFactionName} 打出战术牌「${playedCard.label}」，用于 ${targetName} 战斗。`;
    const tacticRulesLine = playedCard.rulesSummary
        ? `效果摘要：${playedCard.rulesSummary}`
        : null;
    const isWuzhenChaoha = playedCard.cardDefId === WUZHEN_CHAOHA_CARD_DEF_ID;
    const isArrowsLikeRain = playedCard.cardDefId === ARROWS_LIKE_RAIN_CARD_DEF_ID
        && pendingTargetAction.battleMode === 'field';
    const isRaidGrain = playedCard.cardDefId === RAID_GRAIN_CARD_DEF_ID
        && playedCardSide === 'attacker';
    const isCavalryCharge = playedCard.cardDefId === CAVALRY_CHARGE_CARD_DEF_ID;
    const isWarChariotFormation = playedCard.cardDefId === WAR_CHARIOT_FORMATION_CARD_DEF_ID;
    const isBayaraAttack = playedCard.cardDefId === BAYARA_CARD_DEF_ID
        && playedCardSide === 'attacker';
    const isBayaraDefense = playedCard.cardDefId === BAYARA_CARD_DEF_ID
        && playedCardSide === 'defender';
    const isChainCannonFormation = playedCard.cardDefId === CHAIN_CANNON_FORMATION_CARD_DEF_ID
        && pendingTargetAction.battleMode === 'field';
    const isMountedInfantry = playedCard.cardDefId === MOUNTED_INFANTRY_CARD_DEF_ID
        && playedCardSide === 'attacker';
    const isInstigateDefectArtillery = playedCard.cardDefId != null
        && INSTIGATE_DEFECT_ARTILLERY_CARD_DEF_IDS.has(playedCard.cardDefId)
        && pendingBattleHasDefenderArtillery(state, pendingTargetAction);
    const isJirinaiInfantryAttackingMing = playedCard.cardDefId === JIRINAI_INFANTRY_CARD_DEF_ID
        && pendingTargetAction.battleMode === 'field'
        && playedCardSide === 'attacker'
        && pendingTargetAction.defenderFactionId === 'ming';
    const isJirinaiInfantryDefendingMing = playedCard.cardDefId === JIRINAI_INFANTRY_CARD_DEF_ID
        && pendingTargetAction.battleMode === 'field'
        && playedCardSide === 'defender'
        && pendingTargetAction.defenderFactionId === 'ming';
    const isSteadfastDefense = playedCard.cardDefId === STEADFAST_DEFENSE_CARD_DEF_ID
        && pendingTargetAction.battleMode === 'city'
        && playedCardSide === 'defender';
    const isChevalDeFrise = playedCard.cardDefId === CHEVAL_DE_FRISE_CARD_DEF_ID
        && pendingTargetAction.battleMode === 'field'
        && playedCardSide === 'defender';
    if (playedCardSide === 'defender' && !isBayaraDefense && !isJirinaiInfantryDefendingMing && !isSteadfastDefense && !isChevalDeFrise) {
        return state;
    }
    const tacticEffectLine = isWuzhenChaoha
        ? '鸟真超哈：本次野战中攻方步兵骰子等级 +1。'
        : isArrowsLikeRain
            ? '箭如雨下：本次野战中攻方步兵先结算，并使对手拒马无效。'
            : isRaidGrain
                ? '打草惊蛇：本次骑兵劫掠中劫掠部队不受守方反击伤害。'
                : isCavalryCharge
                    ? '骑兵冲锋：本次野战中攻方每个骑兵部队额外掷 2 颗骰。'
                    : isWarChariotFormation
                        ? '战车阵：本次战斗中攻方步兵防御等级 +1。'
                        : isBayaraAttack
                            ? '巴雅喇：本次进攻中守方所有部队防御等级 -1。'
                            : isBayaraDefense
                                ? '巴雅喇：本次防守中己方步兵防御等级 +1。'
                                 : isChainCannonFormation
                                     ? '链炮阵：本次野战中攻方承受损伤时炮兵单位先承受；每个炮兵的防御等级为 4，受损炮兵立即移除。'
                                    : isMountedInfantry
                                        ? '骑马步兵：本次战斗中攻方附兵视为步兵，按步兵阶段、等级、防御与战术结算。'
                                        : isInstigateDefectArtillery
                                            ? `${playedCard.label}：本次战斗中 1 个敌方炮兵临时改为攻方阵营并立即参战。`
                                        : isJirinaiInfantryAttackingMing
                                            ? '机里耐步兵：本次野战中进攻明军的攻方每个步兵部队额外掷 1 颗骰。'
                                            : isJirinaiInfantryDefendingMing
                                                ? '机里耐步兵：本次野战中防守明军步兵先结算。'
                                                : isSteadfastDefense
                                                    ? '坚守不屈：本次城战中攻城方掷骰结果减半。'
                                                    : isChevalDeFrise
                                                        ? '拒马：本次野战中取消先于本牌发动的对手箭如雨下，并使骑兵火器和连环火铳等先结算/跨阶段修正失效；同一时点发动时双方均生效。'
                                                        : null;
    const tacticLines = [tacticLine, tacticRulesLine, tacticEffectLine].filter((line): line is string => !!line);
    const tacticLogText = tacticLines.join(' ');
    const tacticModifiers = [
        ...(pendingTargetAction.tacticModifiers ?? []),
        ...(isWuzhenChaoha
            ? [{
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'attacker' as const,
                troopKind: 'infantry' as const,
                levelBonus: 1,
            }]
            : []),
        ...(isArrowsLikeRain
            ? [{
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                playedAt: event.timestamp,
                label: playedCard.label,
                side: 'attacker' as const,
                troopKind: 'infantry' as const,
                levelBonus: 0,
                priorityRoll: true,
                cancelEnemyTacticSourceCardDefIds: [CHEVAL_DE_FRISE_CARD_DEF_ID],
            }]
            : []),
        ...(isCavalryCharge
            ? [{
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'attacker' as const,
                troopKind: 'cavalry' as const,
                levelBonus: 0,
                diceCountBonus: 2,
            }]
            : []),
        ...(isRaidGrain
            ? [{
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'attacker' as const,
                troopKind: 'cavalry' as const,
                levelBonus: 0,
                cavalryPlunderCounterDamageDisabled: true,
            }]
            : []),
        ...(isWarChariotFormation
            ? [{
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'attacker' as const,
                troopKind: 'infantry' as const,
                levelBonus: 1,
            }]
            : []),
        ...(isBayaraAttack
            ? (['infantry', 'cavalry', 'artillery'] as const).map((troopKind) => ({
                id: `tactic-${event.timestamp}-${playedCard.id}-${troopKind}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'defender' as const,
                troopKind,
                levelBonus: -1,
            }))
            : []),
        ...(isBayaraDefense
            ? [{
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'defender' as const,
                troopKind: 'infantry' as const,
                levelBonus: 1,
            }]
            : []),
        ...(isChainCannonFormation
            ? [({
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'attacker' as const,
                troopKind: 'artillery' as const,
                levelBonus: 0,
                levelOverride: 4,
                casualtyPriority: 'artillery-first' as const,
            })]
            : []),
        ...(isMountedInfantry
            ? [({
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'attacker' as const,
                troopKind: 'infantry' as const,
                levelBonus: 0,
                targetTroopClass: 'auxiliary' as const,
                treatAsTroopKind: 'infantry' as const,
            })]
            : []),
        ...(isInstigateDefectArtillery
            ? [({
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'attacker' as const,
                troopKind: 'artillery' as const,
                levelBonus: 0,
                convertEnemyTroopCount: 1,
            })]
            : []),
        ...(isJirinaiInfantryAttackingMing
            ? [{
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'attacker' as const,
                troopKind: 'infantry' as const,
                levelBonus: 0,
                diceCountBonus: 1,
            }]
            : []),
        ...(isJirinaiInfantryDefendingMing
            ? [{
                id: `tactic-${event.timestamp}-${playedCard.id}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'defender' as const,
                troopKind: 'infantry' as const,
                levelBonus: 0,
                priorityRoll: true,
            }]
            : []),
        ...(isSteadfastDefense
            ? (['artillery', 'cavalry', 'infantry'] as const).map((troopKind) => ({
                id: `tactic-${event.timestamp}-${playedCard.id}-${troopKind}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                label: playedCard.label,
                side: 'attacker' as const,
                troopKind,
                levelBonus: 0,
                rollValueDivisor: 2,
            }))
            : []),
        ...(isChevalDeFrise
            ? ([
                {
                    troopKind: 'infantry',
                    cancelEnemyPrioritySourceCardDefIds: [
                        'qidahen-atlas05-1646-linked-muskets',
                    ],
                },
                {
                    troopKind: 'cavalry',
                    cancelEnemyPrioritySourceCardDefIds: ['qidahen-atlas05-1639-cavalry-firearm'],
                    cancelEnemyRollAsPhaseSourceCardDefIds: ['qidahen-atlas05-1639-cavalry-firearm'],
                },
            ] as const).map((config) => ({
                id: `tactic-${event.timestamp}-${playedCard.id}-${config.troopKind}`,
                sourceCardDefId: playedCard.cardDefId ?? null,
                playedAt: event.timestamp,
                label: playedCard.label,
                side: 'defender' as const,
                troopKind: config.troopKind,
                levelBonus: 0,
                cancelEnemyTacticSourceCardDefIds: [ARROWS_LIKE_RAIN_CARD_DEF_ID],
                cancelEnemyPrioritySourceCardDefIds: config.cancelEnemyPrioritySourceCardDefIds,
                cancelEnemyRollAsPhaseSourceCardDefIds: config.cancelEnemyRollAsPhaseSourceCardDefIds,
            }))
            : []),
    ];
    return {
        ...state,
        raidAndAmbushSelection: state.raidAndAmbushSelection?.phase === 'follow-up'
            ? null
            : state.raidAndAmbushSelection,
        pendingTargetAction: isWuzhenChaoha || isArrowsLikeRain || isRaidGrain || isCavalryCharge || isWarChariotFormation || isBayaraAttack || isBayaraDefense || isChainCannonFormation || isMountedInfantry || isInstigateDefectArtillery || isJirinaiInfantryAttackingMing || isJirinaiInfantryDefendingMing || isSteadfastDefense || isChevalDeFrise
            ? {
                ...pendingTargetAction,
                tacticModifiers,
                restriction: [
                    pendingTargetAction.restriction,
                    isWuzhenChaoha ? '鸟真超哈：攻方步兵骰子等级 +1' : null,
                    isArrowsLikeRain ? '箭如雨下：攻方步兵先结算' : null,
                    isRaidGrain ? '打草惊蛇：骑兵劫掠不受反击伤害' : null,
                    isCavalryCharge ? '骑兵冲锋：攻方骑兵每部队额外掷 2 骰' : null,
                    isWarChariotFormation ? '战车阵：攻方步兵防御等级 +1' : null,
                    isBayaraAttack ? '巴雅喇：守方所有部队防御等级 -1' : null,
                    isBayaraDefense ? '巴雅喇：防守方步兵防御等级 +1' : null,
                    isChainCannonFormation ? '链炮阵：攻方炮兵先承伤' : null,
                    isMountedInfantry ? '骑马步兵：攻方附兵按步兵结算' : null,
                    isInstigateDefectArtillery ? `${playedCard.label}：1 个敌方炮兵临时转为攻方` : null,
                    isJirinaiInfantryAttackingMing ? '机里耐步兵：攻方步兵每部队额外掷 1 骰' : null,
                    isJirinaiInfantryDefendingMing ? '机里耐步兵：防守明军步兵先结算' : null,
                    isSteadfastDefense ? '坚守不屈：攻城方掷骰减半' : null,
                    isChevalDeFrise ? '拒马：取消对手先结算/跨阶段修正' : null,
                ].filter(Boolean).join(' · '),
                resolutionHint: [
                    pendingTargetAction.resolutionHint,
                    isWuzhenChaoha ? '鸟真超哈步兵+1' : null,
                    isArrowsLikeRain ? '箭如雨下步兵先结算' : null,
                    isRaidGrain ? '打草惊蛇劫掠免伤' : null,
                    isCavalryCharge ? '骑兵冲锋骑兵+2骰' : null,
                    isWarChariotFormation ? '战车阵步兵防御+1' : null,
                    isBayaraAttack ? '巴雅喇守方-1' : null,
                    isBayaraDefense ? '巴雅喇防守步兵+1' : null,
                    isChainCannonFormation ? '链炮阵炮兵先承伤' : null,
                    isMountedInfantry ? '骑马步兵附兵视为步兵' : null,
                    isInstigateDefectArtillery ? `${playedCard.label}敌方炮兵转攻方` : null,
                    isJirinaiInfantryAttackingMing ? '机里耐步兵步兵+1骰' : null,
                    isJirinaiInfantryDefendingMing ? '机里耐步兵防守明军先结算' : null,
                    isSteadfastDefense ? '坚守不屈攻城方掷骰减半' : null,
                    isChevalDeFrise ? '拒马取消对手先结算/跨阶段' : null,
                ].filter(Boolean).join(' · '),
            }
            : pendingTargetAction,
        handCards: state.handCards.filter((card) => card.id !== playedCard.id),
        discardPileCount: state.discardPileCount + 1,
        lastSeasonSummary: {
            id: `summary-${event.timestamp}`,
            title: '战术牌',
            lines: tacticLines,
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${event.timestamp}`,
                text: tacticLogText,
                timestamp: event.timestamp,
            },
        ],
    };
};

type QidahenResolvedEventType = QidahenEvent['type'];

interface QidahenResolvedEventReducerSpec<TEventType extends QidahenResolvedEventType = QidahenResolvedEventType> {
    eventTypes: readonly TEventType[];
    reduce: (
        state: QidahenCore,
        event: Extract<QidahenEvent, { type: TEventType }>,
    ) => QidahenCore;
}

const defineResolvedEventReducer = <TEventType extends QidahenResolvedEventType>(
    eventTypes: readonly TEventType[],
    reduce: (
        state: QidahenCore,
        event: Extract<QidahenEvent, { type: TEventType }>,
    ) => QidahenCore,
): QidahenResolvedEventReducerSpec<TEventType> => ({
    eventTypes,
    reduce,
});

const QIDAHEN_RESOLVED_EVENT_REDUCERS_BY_EVENT_TYPE = new Map<
    QidahenResolvedEventType,
    QidahenResolvedEventReducerSpec
>();

const QIDAHEN_RESOLVED_EVENT_REDUCERS = [
    defineResolvedEventReducer(
        ['SCENARIO_VOTE_CAST'],
        resolveQidahenScenarioVoteCastEvent,
    ),
    defineResolvedEventReducer(
        ['FACTION_SELECTED'],
        resolveQidahenFactionSelectedEvent,
    ),
    defineResolvedEventReducer(
        ['SUN_YUANHUA_TECH_RESOLVED'],
        resolveQidahenSunYuanhuaTechResolvedEvent,
    ),
    defineResolvedEventReducer(
        ['GAO_DI_DISPATCH_RESOLVED'],
        (state, event) => resolveQidahenGaoDiDispatchChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            null,
            getFactionIdByPlayerId(
                state,
                event.payload.playerId,
            ),
        ),
    ),
    defineResolvedEventReducer(
        ['INTERNAL_DISPATCH_RESOLVED'],
        (state, event) => resolveQidahenInternalDispatchInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['FORTIFICATION_MAINTENANCE_RESOLVED'],
        (state, event) => resolveQidahenFortificationMaintenanceInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.attritionPriority,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['DRIVE_TIGER_CONSENT_RESOLVED'],
        (state, event) => resolveQidahenDriveTigerConsentInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['RECRUIT_CHOICE_RESOLVED'],
        (state, event) => resolveQidahenRecruitInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['GRANT_PARDON_CHOICE_RESOLVED'],
        (state, event) => resolveQidahenGrantPardonInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['MA_SHI_TRADE_CHOICE_RESOLVED'],
        (state, event) => resolveQidahenMaShiTradeInteractionChoice(
            state,
            event.payload.troopCount,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['KHAN_EDICT_CHOICE_RESOLVED'],
        (state, event) => resolveQidahenKhanEdictInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['DIPLOMACY_CHOICE_RESOLVED'],
        (state, event) => resolveQidahenDiplomacyInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['EVENT_CHARACTER_TARGET_RESOLVED'],
        (state, event) => resolveQidahenEventCharacterTargetChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        ['EVENT_OPPONENT_HAND_CHOICE_RESOLVED'],
        (state, event) => resolveQidahenEventOpponentHandChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
    defineResolvedEventReducer(
        [
            'SCENARIO_CHARACTER_CHOICE_RESOLVED',
            'SCENARIO_ARMAMENT_CHOICE_RESOLVED',
        ],
        resolveQidahenScenarioChoiceResolvedEvent,
    ),
    defineResolvedEventReducer(
        ['SELECTED_ACTION_EXECUTED'],
        (state, event) => executeQidahenSelectedAction(
            state,
            event.payload.playerId,
            event.payload.actionId,
            event.payload.cardIds,
            event.timestamp,
        ),
    ),
    defineResolvedEventReducer(
        ['TACTIC_CARD_PLAYED'],
        resolveQidahenTacticCardPlayedEvent,
    ),
    defineResolvedEventReducer(
        ['BATTLE_RESPONSE_EVENT_CARD_PLAYED'],
        (state, event) => resolveQidahenDefeatInDetailPlayed(
            state,
            event.payload.cardId,
            event.timestamp,
        ),
    ),
    defineResolvedEventReducer(
        ['PINCER_ADVANCE_TROOP_TOGGLED'],
        (state, event) => state.pincerAdvanceSelection
            ? {
                ...state,
                pincerAdvanceSelection: toggleQidahenPincerAdvanceChoice(
                    state.pincerAdvanceSelection,
                    event.payload.choiceId,
                ),
            }
            : state,
    ),
    defineResolvedEventReducer(
        ['PINCER_ADVANCE_RESOLVED'],
        (state, event) => resolveQidahenPincerAdvanceSelection(
            state,
            event.timestamp,
        ),
    ),
    defineResolvedEventReducer(
        ['PINCER_ADVANCE_CANCELLED'],
        (state) => ({
            ...state,
            pincerAdvanceSelection: null,
        }),
    ),
    defineResolvedEventReducer(
        ['INFANTRY_CAVALRY_COMBINED_RESOLVED'],
        (state, event) => resolveQidahenInfantryCavalryCombinedSelection(
            state,
            event.payload.mode,
            event.timestamp,
        ),
    ),
    defineResolvedEventReducer(
        ['INSTIGATE_DEFECTION_RESOLVED'],
        (state, event) => resolveQidahenInstigateDefectionSelection(
            state,
            event.payload.choiceId,
            event.timestamp,
        ),
    ),
    defineResolvedEventReducer(
        ['INSTIGATE_DEFECTION_CANCELLED'],
        (state) => ({
            ...state,
            instigateDefectionSelection: null,
        }),
    ),
    defineResolvedEventReducer(
        ['WUZHEN_CHAOHA_ARTILLERY_TECH_COUNT_SET'],
        (state, event) => setQidahenWuzhenChaohaArtilleryTechCount(
            state,
            event.payload.count,
        ),
    ),
    defineResolvedEventReducer(
        ['WUZHEN_CHAOHA_RESOLVED'],
        (state, event) => resolveQidahenWuzhenChaohaSelection(
            state,
            event.payload.choiceId,
            event.timestamp,
        ),
    ),
    defineResolvedEventReducer(
        ['WUZHEN_CHAOHA_CANCELLED'],
        (state) => ({
            ...state,
            wuzhenChaohaSelection: null,
        }),
    ),
    defineResolvedEventReducer(
        ['PENDING_ACTION_RESOLVED'],
        (state, event) => resolveQidahenPendingActionFromPayload(
            state,
            event.payload,
            event.timestamp,
        ),
    ),
    defineResolvedEventReducer(
        ['POST_BATTLE_DECISION_RESOLVED'],
        (state, event) => resolveQidahenPostBattleInteractionChoice(
            state,
            event.payload.choiceId,
            event.timestamp,
            event.payload.selection,
        ),
    ),
] as const satisfies readonly QidahenResolvedEventReducerSpec[];

for (const reducer of QIDAHEN_RESOLVED_EVENT_REDUCERS) {
    for (const eventType of reducer.eventTypes) {
        QIDAHEN_RESOLVED_EVENT_REDUCERS_BY_EVENT_TYPE.set(eventType, reducer);
    }
}

export const reduceQidahenResolvedEvent = (
    state: QidahenCore,
    event: QidahenEvent,
): QidahenCore | null => {
    const reducer = QIDAHEN_RESOLVED_EVENT_REDUCERS_BY_EVENT_TYPE.get(event.type);
    return reducer
        ? reducer.reduce(state, event as never)
        : null;
};
