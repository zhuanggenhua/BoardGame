import type { QidahenPassageBoundaryType } from '../data/mapGraph';
import {
    QIDAHEN_PASSAGE_BOUNDARY_TYPE_IDS,
    UI_STYLE,
    ASSETS,
    HAND_ROW_HORIZONTAL_PADDING,
    MOBILE_LANDSCAPE_HAND_CARD_MIN_WIDTH,
    MOBILE_LANDSCAPE_HAND_CARD_MAX_WIDTH,
    CARD_DIMENSIONS,
    MOBILE_LANDSCAPE_VISIBLE_HAND_LIMIT,
} from './boardLayout';
import type { QidahenHandCard, QidahenCore, QidahenFactionId, QidahenMapToken, QidahenActionChoice, QidahenPostBattleSelection } from '../domain';
import { getQidahenDirectActionIdForHandCard } from '../domain/handCardIdentity';
import { getActionChoiceById } from '../domain/factionActionWindow';

export const asQidahenPassageBoundaryType = (value: string | null | undefined): QidahenPassageBoundaryType | null =>
    value && QIDAHEN_PASSAGE_BOUNDARY_TYPE_IDS.has(value as QidahenPassageBoundaryType)
        ? (value as QidahenPassageBoundaryType)
        : null;

export const getQidahenHandCardTutorialTargetId = (card: QidahenHandCard): string => card.cardDefId ?? card.id;

export const getQidahenDirectHandActionIdsForFaction = (core: QidahenCore, factionId: QidahenFactionId): Set<string> =>
    new Set(
        core.handCards
            .filter((card) => card.faction === factionId && card.status !== 'disabled')
            .map((card) => getQidahenDirectActionIdForHandCard(card))
            .filter((actionId): actionId is string => actionId != null),
    );

export const factionTone: Record<QidahenFactionId, { bg: string; border: string; text: string; chip: string }> = {
    ming: { bg: UI_STYLE.paper, border: UI_STYLE.cinnabar, text: UI_STYLE.ink, chip: ASSETS.mingMarker },
    mongol: { bg: UI_STYLE.paper, border: UI_STYLE.oldGold, text: UI_STYLE.ink, chip: ASSETS.mongolMarker },
    jin: { bg: UI_STYLE.paper, border: UI_STYLE.bronze, text: UI_STYLE.ink, chip: ASSETS.jinMarker },
};

export const armyHiddenBackColorByFaction: Record<QidahenFactionId | 'neutral', string> = {
    ming: UI_STYLE.cinnabar,
    mongol: UI_STYLE.oldGold,
    jin: UI_STYLE.bronze,
    neutral: UI_STYLE.paperDeep,
};

export const shouldRevealQidahenMapArmyToken = (
    token: QidahenMapToken,
    viewerFactionId: QidahenFactionId | null,
    revealedBattleRegionIds: ReadonlySet<string>,
): boolean => {
    if (token.type !== 'army') {
        return true;
    }
    if (viewerFactionId != null && token.faction === viewerFactionId) {
        return true;
    }
    return token.regionId != null && revealedBattleRegionIds.has(token.regionId);
};

export const buildRevealedBattleRegionIds = (
    pendingTargetAction: QidahenCore['pendingTargetAction'],
    postBattleSelection: QidahenCore['postBattleSelection'],
): ReadonlySet<string> => {
    const regionIds = [
        pendingTargetAction?.sourceRegionId,
        pendingTargetAction?.targetRegionId,
        pendingTargetAction?.targetRuntimeRegionId,
        pendingTargetAction?.attackerPositionRegionId,
        postBattleSelection?.sourceRegionId,
        postBattleSelection?.targetRegionId,
        postBattleSelection?.targetRuntimeRegionId,
        postBattleSelection?.attackerPositionRegionId,
    ].filter((regionId): regionId is string => Boolean(regionId));
    return new Set(regionIds);
};

export const getQidahenMobileLandscapeHandLayout = (dockWidth: number) => {
    const availableWidth = Math.max(240, dockWidth - HAND_ROW_HORIZONTAL_PADDING * 2);
    const fourCardWidth = Math.floor((availableWidth - HAND_ROW_HORIZONTAL_PADDING) / 4);
    const width = Math.max(
        MOBILE_LANDSCAPE_HAND_CARD_MIN_WIDTH,
        Math.min(MOBILE_LANDSCAPE_HAND_CARD_MAX_WIDTH, fourCardWidth),
    );
    return {
        availableWidth,
        width,
        height: Math.round((width * CARD_DIMENSIONS.hand.height) / CARD_DIMENSIONS.hand.width),
    };
};

export const getQidahenHandCardOverlapPx = (
    handCount: number,
    cardWidth: number = CARD_DIMENSIONS.hand.width,
    availableWidth?: number,
): number => {
    if (availableWidth != null && handCount > 1) {
        const visibleCardCount = Math.min(handCount, MOBILE_LANDSCAPE_VISIBLE_HAND_LIMIT);
        const visibleRowWidth = Math.max(cardWidth, availableWidth - HAND_ROW_HORIZONTAL_PADDING);
        const fitOverlap = Math.floor((visibleRowWidth - cardWidth * visibleCardCount) / (visibleCardCount - 1));
        return Math.max(-64, Math.min(0, fitOverlap));
    }
    if (handCount <= 6) {
        return 0;
    }
    return -Math.min(18 + Math.max(0, handCount - 7) * 12, 60);
};

export const resolveViewerFactionId = (core: QidahenCore, playerID: string | null): QidahenFactionId | null =>
    core.factionSelection
        ? null
        : ((playerID
              ? (Object.entries(core.factions).find(([, faction]) => faction.playerId === playerID)?.[0] as
                    QidahenFactionId | undefined)
              : undefined) ?? null);

export const formatQidahenCandidateRegionSummary = (regionNames: string[]): string => {
    const uniqueNames = Array.from(new Set(regionNames.filter((name) => name.trim().length > 0)));
    if (uniqueNames.length <= 0) {
        return '暂无可选地区';
    }
    if (uniqueNames.length <= 4) {
        return uniqueNames.join('、');
    }
    return `${uniqueNames.slice(0, 4).join('、')} 等 ${uniqueNames.length} 处`;
};

export const isQidahenGaoDiTargetSelectionActive = (
    selection: QidahenCore['gaoDiDispatchSelection'] | null | undefined,
): boolean => Boolean(selection?.selectedCardId);

export const getQidahenForegroundActionChoice = (
    core: QidahenCore,
    options: {
        actionPaymentPreviewVisible: boolean;
        recruitSelection: unknown | null;
        grantPardonSelection: unknown | null;
        maShiTradeSelection: unknown | null;
        khanEdictSelection: unknown | null;
        driveTigerConsentSelection: unknown | null;
    },
): QidahenActionChoice | null => {
    if (options.actionPaymentPreviewVisible && core.selectedActionId) {
        return (
            getActionChoiceById(core.selectedActionId) ??
            core.actionChoices.find((action) => action.id === core.selectedActionId) ??
            null
        );
    }
    if (options.recruitSelection) {
        return core.actionChoices.find((action) => action.id === 'recruit') ?? null;
    }
    if (options.grantPardonSelection) {
        return core.actionChoices.find((action) => action.id === 'grant-pardon') ?? null;
    }
    if (options.maShiTradeSelection) {
        return core.actionChoices.find((action) => action.id === 'ma-shi-trade') ?? null;
    }
    if (options.khanEdictSelection) {
        return core.actionChoices.find((action) => action.id === 'khan-edict') ?? null;
    }
    if (options.driveTigerConsentSelection) {
        return core.actionChoices.find((action) => action.id === 'drive-tiger') ?? null;
    }
    return null;
};

export const getQidahenFriendlyPendingTargetTitle = (
    pendingTargetAction: QidahenCore['pendingTargetAction'],
): string => {
    if (!pendingTargetAction) {
        return '';
    }
    if (pendingTargetAction.targetKind === 'siege-attacker') {
        return `解围 ${pendingTargetAction.targetRegionName}`;
    }
    if ((pendingTargetAction.battleMode ?? 'field') === 'city' || pendingTargetAction.title.includes('城战')) {
        return `${pendingTargetAction.targetRegionName} 城战`;
    }
    switch (pendingTargetAction.actionId) {
        case 'raid':
            return `突袭 ${pendingTargetAction.targetRegionName}`;
        case 'wheel-dispatch':
            return `进攻 ${pendingTargetAction.targetRegionName}`;
        case 'drive-tiger':
            return `驱虎吞狼：进攻 ${pendingTargetAction.targetRegionName}`;
        case 'marriage-subjugation':
            return `联姻诱降 ${pendingTargetAction.targetRegionName}`;
        default:
            return pendingTargetAction.targetRegionName;
    }
};

export const getQidahenFriendlyPendingChoiceLabel = (choice: { id: string; label: string }): string => {
    if (choice.id === 'rear-guard') {
        return '断后';
    }
    if (choice.id === 'rout') {
        return '溃退';
    }
    if (choice.id === 'defender-hold-city') {
        return '守城避战';
    }
    if (choice.id === 'defender-sortie') {
        return '出城野战';
    }
    if (choice.id === 'cavalry-plunder-attacker') {
        return '抽己方牌堆';
    }
    if (choice.id === 'cavalry-plunder-defender') {
        return '抽守方牌堆';
    }
    if (choice.id.startsWith('cavalry-evasion:')) {
        return choice.label.replace('骑兵避战至', '骑兵撤往 ');
    }
    return choice.label;
};

export const getQidahenFriendlyPostBattleTitle = (postBattleSelection: QidahenPostBattleSelection): string =>
    postBattleSelection.targetKind === 'siege-attacker' ? '解围后进驻' : '战后选择';

export const formatSpecialTroops = (specialTroops: QidahenCore['regions'][number]['specialTroops']) =>
    specialTroops.map((stack) => `${stack.label} x${stack.count}（${stack.level}级）`).join('，');

export const getPendingTargetChoiceTestId = (choiceId: string): string => {
    if (choiceId === 'rear-guard') {
        return 'qidahen-resolve-pending-action';
    }
    if (choiceId === 'rout') {
        return 'qidahen-resolve-pending-action-rout';
    }
    if (choiceId === 'cavalry-plunder-attacker') {
        return 'qidahen-resolve-pending-action-cavalry-plunder';
    }
    if (choiceId === 'cavalry-plunder-defender') {
        return 'qidahen-resolve-pending-action-cavalry-plunder-defender';
    }
    if (choiceId.startsWith('cavalry-evasion:')) {
        return `qidahen-resolve-pending-action-${choiceId}`;
    }
    return `qidahen-resolve-pending-action-${choiceId}`;
};

export const getPendingTargetChoiceMinWidth = (choiceId: string): number => {
    if (choiceId === 'cavalry-plunder-attacker') {
        return 168;
    }
    if (choiceId === 'cavalry-plunder-defender') {
        return 180;
    }
    if (choiceId.startsWith('cavalry-evasion:')) {
        return 176;
    }
    return 132;
};

export const hasStructuredCasualtyChoice = (
    core: QidahenCore,
    pending: QidahenCore['pendingTargetAction'],
): boolean => {
    if (!pending) {
        return false;
    }
    const sourceRegion = pending.sourceRegionId
        ? core.regions.find((region) => !region.isLogicalRegion && region.id === pending.sourceRegionId)
        : null;
    const targetRegion = core.regions.find(
        (region) => !region.isLogicalRegion && region.id === pending.targetRuntimeRegionId,
    );
    return [sourceRegion, targetRegion].some(
        (region) => region?.specialTroops.some((stack) => stack.troopKind !== 'artillery' && stack.count > 0) === true,
    );
};

export const getPendingCommittedTroopOptions = (pending: QidahenCore['pendingTargetAction']): number[] => {
    if (
        !pending ||
        (pending.actionId !== 'raid' && pending.actionId !== 'wheel-dispatch' && pending.actionId !== 'drive-tiger')
    ) {
        return [];
    }
    const maxCommittedTroops = Math.max(
        0,
        Math.min(
            pending.committedTroops,
            pending.sourceAvailableTroops,
            pending.boundaryUnitCap ?? pending.committedTroops,
        ),
    );
    return Array.from({ length: maxCommittedTroops }, (_, index) => index + 1);
};
