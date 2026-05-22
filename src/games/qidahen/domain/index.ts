import type { DomainCore, PlayerId, RandomFn } from '../../../engine/types';
import { QIDAHEN_COMMANDS, validate } from './commands';
import { qidahenChronologyPreview, qidahenKoreaSpecialPreview, qidahenMingHandPreview } from '../ui/cardAtlas';
import type {
    QidahenCommand,
    QidahenActionChoice,
    QidahenCore,
    QidahenEvent,
    QidahenFactionId,
    QidahenFactionState,
    QidahenPaymentState,
    QidahenWheelMoveChoice,
} from './types';

const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];
const wheelSectorOrder = [
    'wheel-reclaim',
    'wheel-military-farm',
    'wheel-recruit-train',
    'wheel-diplomacy',
    'wheel-hire',
    'wheel-attack',
    'wheel-midyear',
    'wheel-new-year',
];

const createFactionState = (
    id: QidahenFactionId,
    playerId: PlayerId,
    name: string,
    colorClass: string,
    vp: number,
    troops: number,
    grain: number,
    landTax: number,
): QidahenFactionState => ({
    id,
    playerId,
    name,
    colorClass,
    vp,
    troops,
    grain,
    landTax,
    handLimit: id === 'ming' ? 15 : 10,
    handCount: id === 'ming' ? 5 : id === 'mongol' ? 6 : 8,
    actionDiamonds: id === 'jin' ? 2 : 3,
});

const actionChoiceCatalog: Record<QidahenFactionId, QidahenActionChoice[]> = {
    ming: [
        { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
        { id: 'recruit', label: '征召军队', cost: 1, detail: '弃 1 张手牌，建立 6 个等级 2 部队或 2 个等级 4 川兵。' },
        { id: 'grant-pardon', label: '赐印招安', cost: 3, detail: '指定 1 个对手，将相邻部队改为大明控制。' },
        { id: 'drive-tiger', label: '驱虎吞狼', cost: 3, detail: '指定 1 个对手抽 6 张牌，并由大明指挥其部队。' },
    ],
    mongol: [
        { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
        { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
        { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
    ],
    jin: [
        { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
        { id: 'marriage-subjugation', label: '联姻诱降', cost: 2, detail: '弃 2 张手牌，指定邻近控制区域，触发对手支付或转控判定。' },
    ],
};

export const getActionChoicesForFaction = (factionId: QidahenFactionId): QidahenActionChoice[] => (
    actionChoiceCatalog[factionId].map((choice) => ({ ...choice }))
);

const getActionChoiceById = (actionId: string): QidahenActionChoice | undefined => (
    factionOrder.flatMap((factionId) => actionChoiceCatalog[factionId]).find((choice) => choice.id === actionId)
);

const getFactionIdByPlayerId = (state: QidahenCore, playerId: PlayerId): QidahenFactionId => (
    factionOrder.find((id) => state.factions[id].playerId === playerId) ?? 'ming'
);

const wheelMoveChoices: QidahenWheelMoveChoice[] = [
    { id: 'move-1-free', label: '免费走 1', steps: 1, drawText: '对手不抽牌' },
    { id: 'move-2-one-opponent', label: '一名对手抽 2，走 2', steps: 2, drawText: '蒙古抽 2' },
    { id: 'move-3-all-opponents', label: '所有对手抽 2，走 3', steps: 3, drawText: '蒙古、后金各抽 2' },
];

const controlMarkerByFaction: Record<QidahenFactionId, string> = {
    ming: 'qidahen/markers/ming-control-diplomacy-marker-a',
    mongol: 'qidahen/markers/mongol-control-diplomacy-marker-a',
    jin: 'qidahen/markers/jin-control-diplomacy-marker-a',
};

const controlTokenByRegion: Record<string, string> = {
    jinzhou: 'jinzhou-control',
    'song-jin': 'songjin-control',
};

const buildPaymentState = (selectedActionId: string, selectedCardCount = 0): QidahenPaymentState => {
    const action = getActionChoiceById(selectedActionId) ?? actionChoiceCatalog.ming[2];
    const selected = Math.min(selectedCardCount, action.cost);
    return {
        required: action.cost,
        selected,
        prompt: `需弃 ${action.cost} / 已选 ${selected}`,
    };
};

const togglePaymentCard = (state: QidahenCore, cardId: string): string[] => {
    const card = state.handCards.find((item) => item.id === cardId);
    if (!card || card.status === 'disabled') {
        return state.selectedPaymentCardIds;
    }

    if (state.selectedPaymentCardIds.includes(cardId)) {
        return state.selectedPaymentCardIds.filter((selectedId) => selectedId !== cardId);
    }

    if (state.selectedPaymentCardIds.length >= state.payment.required) {
        return state.selectedPaymentCardIds;
    }

    return [...state.selectedPaymentCardIds, cardId];
};

const getAutoPaymentCardIds = (state: QidahenCore, actionId: string): string[] => {
    const action = getActionChoiceById(actionId);
    if (!action) return [];
    return state.handCards
        .filter((card) => card.status !== 'disabled')
        .slice(0, action.cost)
        .map((card) => card.id);
};

const advanceWheelPosition = (currentId: string, steps: number): string => {
    const index = Math.max(0, wheelSectorOrder.indexOf(currentId));
    return wheelSectorOrder[(index + steps) % wheelSectorOrder.length];
};

const buildWheelMoveSummary = (moveId: string): string => {
    const move = wheelMoveChoices.find((choice) => choice.id === moveId) ?? wheelMoveChoices[0];
    return `${move.label}：${move.drawText}`;
};

const createInitialCore = (playerIds: PlayerId[]): QidahenCore => {
    const normalizedPlayerIds = factionOrder.map((_, index) => playerIds[index] ?? String(index));

    return {
        playerIds: normalizedPlayerIds,
        currentPlayer: normalizedPlayerIds[0],
        currentYear: '天命四年 1619',
        turnLabel: '手牌行动',
        actionWheelPosition: 'wheel-military-farm',
        selectedWheelMoveId: 'move-2-one-opponent',
        wheelMoveChoices,
        wheelMoveSummary: buildWheelMoveSummary('move-2-one-opponent'),
        selectedRegionId: 'shou-cheng',
        selectedActionId: 'grant-pardon',
        selectedPaymentCardIds: [],
        pendingTargetAction: null,
        factions: {
            ming: createFactionState('ming', normalizedPlayerIds[0], '大明', 'bg-[#8f2f24]', 0, 18, 12, 70),
            mongol: createFactionState('mongol', normalizedPlayerIds[1], '蒙古', 'bg-[#6f4c24]', 1, 16, 10, 65),
            jin: createFactionState('jin', normalizedPlayerIds[2], '后金', 'bg-[#244c6f]', 0, 17, 11, 75),
        },
        regions: [
            { id: 'jinzhou', name: '锦州', controller: 'jin', x: 0.615, y: 0.458, troops: 2, population: 2, controlLabel: '后金', note: '辽西前线。当前势力行动指向沿海区域与相邻敌军。' },
            { id: 'song-jin', name: '宋进', controller: 'ming', x: 0.58, y: 0.605, troops: 2, population: 2, controlLabel: '大明', note: '沿海据点，可承接被赐印招安后的单位。' },
            { id: 'shan-hai-guan', name: '山海关', controller: 'ming', x: 0.535, y: 0.585, troops: 2, population: 2, controlLabel: '大明', note: '长城门户，城战与补给判断关键。' },
            { id: 'shou-cheng', name: '汉城', controller: 'ming', x: 0.865, y: 0.665, troops: 3, population: 3, controlLabel: '大明', note: '当前目标区域。支付完成后，指定对手相邻部队向此处转换阵营。' },
            { id: 'xian-xing', name: '咸兴', controller: 'jin', x: 0.852, y: 0.535, troops: 3, population: 3, controlLabel: '后金', note: '朝鲜方向前线，保留红色部队与目标箭头示意。' },
        ],
        actionChoices: getActionChoicesForFaction('ming'),
        yearCards: [
            { id: 'current-year', label: '今年纪年卡', previewRef: qidahenChronologyPreview(0) },
            { id: 'next-year', label: '下一年纪年', previewRef: qidahenChronologyPreview(1) },
        ],
        payment: buildPaymentState('grant-pardon'),
        koreaDeckCount: 12,
        koreaDiscardCount: 5,
        koreaDiscardPreviewRef: qidahenKoreaSpecialPreview(0),
        drawPileCount: 20,
        discardPileCount: 7,
        handCards: [
            { id: 'hand-1', label: '大明手牌 1', previewRef: qidahenMingHandPreview(0), accent: 'ming', status: 'payable' },
            { id: 'hand-2', label: '大明手牌 2', previewRef: qidahenMingHandPreview(1), accent: 'ming', status: 'payable' },
            { id: 'hand-3', label: '大明手牌 3', previewRef: qidahenMingHandPreview(2), accent: 'ming', status: 'payable' },
            { id: 'hand-4', label: '大明手牌 4', previewRef: qidahenMingHandPreview(3), accent: 'neutral', status: 'payable' },
            { id: 'hand-5', label: '大明手牌 5', previewRef: qidahenMingHandPreview(4), accent: 'ming', status: 'payable' },
            { id: 'hand-6', label: '大明手牌 6', previewRef: qidahenMingHandPreview(5), accent: 'jin', status: 'idle' },
        ],
        mapTokens: [
            { id: 'jinzhou-pop', x: 0.628, y: 0.497, type: 'population', faction: 'neutral', value: 2 },
            { id: 'jinzhou-control', x: 0.647, y: 0.47, type: 'control', faction: 'jin', imageSrc: 'qidahen/markers/jin-control-diplomacy-marker-a', size: 29 },
            { id: 'songjin-control', x: 0.592, y: 0.611, type: 'control', faction: 'ming', imageSrc: 'qidahen/markers/ming-control-diplomacy-marker-a', size: 29 },
            { id: 'songjin-army', x: 0.566, y: 0.632, type: 'army', faction: 'ming', imageSrc: 'qidahen/units/ming-regular-infantry-unit', size: 34, value: 2 },
            { id: 'shanhaiguan-army', x: 0.535, y: 0.59, type: 'army', faction: 'ming', imageSrc: 'qidahen/units/ming-regular-cavalry-unit', size: 34, value: 2 },
            { id: 'shoucheng-army', x: 0.863, y: 0.662, type: 'army', faction: 'ming', imageSrc: 'qidahen/units/ming-regular-infantry-unit', size: 36, value: 3 },
            { id: 'xianxing-army-1', x: 0.844, y: 0.545, type: 'army', faction: 'ming', imageSrc: 'qidahen/units/ming-regular-infantry-unit', size: 34, value: 3 },
            { id: 'xianxing-army-2', x: 0.883, y: 0.498, type: 'army', faction: 'ming', imageSrc: 'qidahen/units/ming-regular-infantry-unit', size: 34, value: 3 },
        ],
        routeLines: [
            {
                id: 'ming-route',
                tone: 'blue',
                points: [
                    { x: 0.57, y: 0.63 },
                    { x: 0.57, y: 0.73 },
                    { x: 0.76, y: 0.73 },
                    { x: 0.76, y: 0.64 },
                    { x: 0.845, y: 0.64 },
                ],
            },
            {
                id: 'target-route',
                tone: 'red',
                points: [
                    { x: 0.89, y: 0.40 },
                    { x: 0.86, y: 0.47 },
                    { x: 0.84, y: 0.55 },
                    { x: 0.84, y: 0.66 },
                ],
            },
        ],
        actionLog: [
            { id: 'log-1', faction: 'ming', text: '大明 进入势力行动并锁定赐印招安。' },
            { id: 'log-2', faction: 'jin', text: '后金 在 沿海据点 维持前线兵力。' },
        ],
    };
};

const now = () => Date.now();

export const QidahenDomain: DomainCore<QidahenCore, QidahenCommand, QidahenEvent> = {
    gameId: 'qidahen',

    setup: (playerIds: PlayerId[], _random: RandomFn): QidahenCore => createInitialCore(playerIds),

    validate,

    execute: (_state, command): QidahenEvent[] => {
        switch (command.type) {
            case QIDAHEN_COMMANDS.SELECT_REGION:
                return [{
                    type: 'REGION_SELECTED',
                    payload: {
                        regionId: command.payload.regionId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION:
                return [{
                    type: 'PREVIEW_ACTION_CONFIRMED',
                    payload: {
                        actionId: command.payload.actionId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE:
                return [{
                    type: 'WHEEL_MOVE_SELECTED',
                    payload: {
                        moveId: command.payload.moveId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE:
                return [{
                    type: 'WHEEL_MOVE_EXECUTED',
                    payload: {
                        moveId: command.payload.moveId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD:
                return [{
                    type: 'PAYMENT_CARD_SELECTED',
                    payload: {
                        cardId: command.payload.cardId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION:
                return [{
                    type: 'SELECTED_ACTION_EXECUTED',
                    payload: {
                        actionId: _state.core.selectedActionId,
                        cardIds: _state.core.selectedPaymentCardIds,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.EXECUTE_ACTION:
                return [{
                    type: 'SELECTED_ACTION_EXECUTED',
                    payload: {
                        actionId: command.payload.actionId,
                        cardIds: getAutoPaymentCardIds(_state.core, command.payload.actionId),
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            default:
                return [];
        }
    },

    reduce: (state, event): QidahenCore => {
        switch (event.type) {
            case 'REGION_SELECTED':
                return {
                    ...state,
                    selectedRegionId: event.payload.regionId,
                };
            case 'PREVIEW_ACTION_CONFIRMED':
                if (getActionChoiceById(event.payload.actionId)) {
                    return {
                        ...state,
                        selectedActionId: event.payload.actionId,
                        selectedPaymentCardIds: [],
                        pendingTargetAction: null,
                        payment: buildPaymentState(event.payload.actionId),
                        actionLog: [
                            {
                                id: `log-${event.timestamp}`,
                                faction: 'ming',
                                text: `大明 选择势力行动：${getActionChoiceById(event.payload.actionId)?.label ?? event.payload.actionId}。`,
                            },
                            ...state.actionLog,
                        ].slice(0, 6),
                    };
                }
                return {
                    ...state,
                    actionWheelPosition: event.payload.actionId,
                };
            case 'WHEEL_MOVE_SELECTED': {
                const move = wheelMoveChoices.find((item) => item.id === event.payload.moveId);
                if (!move) return state;
                return {
                    ...state,
                    selectedWheelMoveId: move.id,
                    wheelMoveSummary: buildWheelMoveSummary(move.id),
                };
            }
            case 'WHEEL_MOVE_EXECUTED': {
                const move = wheelMoveChoices.find((item) => item.id === event.payload.moveId);
                if (!move) return state;
                const factions = {
                    ...state.factions,
                    mongol: move.steps >= 2
                        ? { ...state.factions.mongol, handCount: state.factions.mongol.handCount + 2 }
                        : state.factions.mongol,
                    jin: move.steps >= 3
                        ? { ...state.factions.jin, handCount: state.factions.jin.handCount + 2 }
                        : state.factions.jin,
                };
                return {
                    ...state,
                    selectedWheelMoveId: move.id,
                    actionWheelPosition: advanceWheelPosition(state.actionWheelPosition, move.steps),
                    wheelMoveSummary: buildWheelMoveSummary(move.id),
                    factions,
                };
            }
            case 'PAYMENT_CARD_SELECTED': {
                const selectedPaymentCardIds = togglePaymentCard(state, event.payload.cardId);
                return {
                    ...state,
                    selectedPaymentCardIds,
                    payment: buildPaymentState(state.selectedActionId, selectedPaymentCardIds.length),
                };
            }
            case 'SELECTED_ACTION_EXECUTED': {
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                const selectedCardIds = new Set(event.payload.cardIds);
                const spentCardCount = event.payload.cardIds.length;
                const actionLabel = getActionChoiceById(event.payload.actionId)?.label ?? event.payload.actionId;
                const selectedRegion = state.regions.find((region) => region.id === state.selectedRegionId);
                const pendingTargetAction = (event.payload.actionId === 'raid' || event.payload.actionId === 'marriage-subjugation') && selectedRegion
                    ? {
                        actionId: event.payload.actionId as 'raid' | 'marriage-subjugation',
                        title: event.payload.actionId === 'raid' ? '突袭待结算' : '联姻待结算',
                        targetRegionId: selectedRegion.id,
                        targetRegionName: selectedRegion.name,
                        defenderFactionId: selectedRegion.controller,
                        defenderLabel: selectedRegion.controlLabel,
                        restriction: event.payload.actionId === 'raid' ? '仅进攻行动' : '邻近控制区域',
                    }
                    : null;
                const nextRegions = state.regions.map((region) => {
                    if (event.payload.actionId === 'recruit' && region.id === state.selectedRegionId) {
                        return {
                            ...region,
                            troops: region.troops + 2,
                            note: `${region.name} 执行征召军队后部队增加 2。`,
                        };
                    }
                    if (event.payload.actionId === 'grant-pardon' && region.id === state.selectedRegionId && region.controller !== 'ming') {
                        return {
                            ...region,
                            controller: 'ming',
                            controlLabel: '大明',
                            note: `${region.name} 经赐印招安后转为大明控制。`,
                        };
                    }
                    return region;
                });
                const nextMapTokens = state.mapTokens.map((token) => {
                    const regionId = Object.entries(controlTokenByRegion).find(([, tokenId]) => tokenId === token.id)?.[0];
                    const nextRegion = regionId ? nextRegions.find((region) => region.id === regionId) : undefined;
                    if (!nextRegion || nextRegion.controller === 'neutral') return token;
                    if (token.faction === nextRegion.controller) return token;
                    return {
                        ...token,
                        faction: nextRegion.controller,
                        imageSrc: controlMarkerByFaction[nextRegion.controller],
                    };
                });
                const targetFactionId = state.regions.find((region) => region.id === state.selectedRegionId)?.controller ?? currentFactionId;
                const driveTigerTargetId = targetFactionId !== 'neutral' && targetFactionId !== currentFactionId
                    ? targetFactionId
                    : undefined;
                return {
                    ...state,
                    selectedActionId: event.payload.actionId,
                    selectedPaymentCardIds: [],
                    payment: buildPaymentState(event.payload.actionId, 0),
                    discardPileCount: state.discardPileCount + spentCardCount,
                    handCards: state.handCards.filter((card) => !selectedCardIds.has(card.id)),
                    regions: nextRegions,
                    mapTokens: nextMapTokens,
                    factions: {
                        ...state.factions,
                        [currentFactionId]: {
                            ...state.factions[currentFactionId],
                            handCount: Math.max(0, state.factions[currentFactionId].handCount - spentCardCount),
                            troops: event.payload.actionId === 'recruit'
                                ? state.factions[currentFactionId].troops + 2
                                : state.factions[currentFactionId].troops,
                        },
                        ...(event.payload.actionId === 'drive-tiger' && driveTigerTargetId ? {
                            [driveTigerTargetId]: {
                                ...state.factions[driveTigerTargetId],
                                handCount: state.factions[driveTigerTargetId].handCount + 6,
                            },
                        } : {}),
                    },
                    pendingTargetAction,
                    actionLog: [
                        {
                            id: `log-${event.timestamp}`,
                            faction: currentFactionId,
                            text: pendingTargetAction
                                ? `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，进入 ${pendingTargetAction.title}。`
                                : `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                };
            }
            default:
                return state;
        }
    },

    isGameOver: () => undefined,
};

export type { QidahenCommand, QidahenCommandMap, QidahenCore, QidahenEvent } from './types';
