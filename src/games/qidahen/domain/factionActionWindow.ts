import type {
    QidahenActionChoice,
    QidahenCore,
    QidahenFactionId,
    QidahenPaymentState,
} from './types';
import { hasActiveCharacter } from './characterPresenceAccessors';
import {
    getCurrentFactionId,
} from './factionTurnAccessors';

const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];

const upgradeArmamentActionChoice: QidahenActionChoice = {
    id: 'upgrade-armament',
    label: '升级军备',
    cost: 2,
    detail: '弃 1 张手牌，选择一项已开发军备进行升级。',
};

const defaultActionIdByFaction: Record<QidahenFactionId, string> = {
    ming: 'grant-pardon',
    mongol: 'khan-edict',
    jin: 'marriage-subjugation',
};

const actionChoiceCatalog: Record<QidahenFactionId, QidahenActionChoice[]> = {
    ming: [
        upgradeArmamentActionChoice,
        { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
        { id: 'recruit', label: '征召军队', cost: 1, detail: '弃 1 张手牌，建立 6 个等级 2 部队、2 个等级 4 川兵；已研发火炮技术时可建立炮兵。' },
        { id: 'grant-pardon', label: '赐印招安', cost: 3, detail: '指定 1 个对手，将相邻部队改为大明控制。' },
        { id: 'drive-tiger', label: '驱虎吞狼', cost: 3, detail: '指定 1 个对手抽 6 张牌，并由大明指挥其部队。' },
    ],
    mongol: [
        upgradeArmamentActionChoice,
        { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
        { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
        { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
    ],
    jin: [
        upgradeArmamentActionChoice,
        { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
        { id: 'marriage-subjugation', label: '联姻诱降', cost: 2, detail: '弃 2 张手牌，指定邻近控制区域，触发对手支付或转控判定。' },
    ],
};

const isFactionActionSelectable = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    actionId: string,
): boolean => (
    getActionChoicesForFaction(factionId).some((choice) => choice.id === actionId)
    && (!state.factionActionUsed || !hasRemainingFactionAction(state, factionId) || state.lastFactionActionId !== actionId)
);

export const getActionChoicesForFaction = (factionId: QidahenFactionId): QidahenActionChoice[] => (
    actionChoiceCatalog[factionId].map((choice) => ({ ...choice }))
);

export const getActionChoiceById = (actionId: string): QidahenActionChoice | undefined => (
    factionOrder.flatMap((factionId) => actionChoiceCatalog[factionId]).find((choice) => choice.id === actionId)
);

export const getDefaultActionIdForFaction = (factionId: QidahenFactionId): string => (
    defaultActionIdByFaction[factionId] ?? getActionChoicesForFaction(factionId)[0]?.id ?? 'raid'
);

export const buildPaymentState = (
    selectedActionId: string,
    selectedCardCount = 0,
): QidahenPaymentState => {
    const action = getActionChoiceById(selectedActionId) ?? actionChoiceCatalog.ming[2];
    const selected = Math.min(selectedCardCount, action.cost);
    return {
        required: action.cost,
        selected,
        prompt: `需弃 ${action.cost} / 已选 ${selected}`,
    };
};

export const buildTurnLabel = (
    roundNumber: number,
    factionName: string,
    turnPhase: QidahenCore['turnPhase'],
    wheelActionUsed: boolean,
    factionActionUsed: boolean,
    bonusFactionActionPending: boolean,
): string => {
    const pendingLabel = turnPhase === 'resolve-pending'
        ? '待结算'
        : turnPhase === 'hand-limit-discard'
            ? '检查手牌上限'
        : turnPhase === 'sun-yuanhua-tech-choice'
            ? '孙元化科技'
        : turnPhase === 'internal-dispatch-choice'
            ? '选择内部调度'
        : turnPhase === 'recruit-choice'
            ? '选择征召军队'
        : turnPhase === 'ma-shi-trade-choice'
            ? '选择马市贸易数量'
        : turnPhase === 'khan-edict-choice'
            ? '选择令箭效果'
        : turnPhase === 'drive-tiger-consent'
            ? '等待驱虎吞狼同意'
        : turnPhase === 'dispatch-targeting'
            ? '选择调度目标'
        : turnPhase === 'season-resolution'
            ? '岁时结算'
        : wheelActionUsed && factionActionUsed && !bonusFactionActionPending
            ? '回合收口'
        : wheelActionUsed
                ? '势力行动'
                : factionActionUsed && !bonusFactionActionPending
                    ? '轮盘行动'
                    : factionActionUsed
                        ? '势力行动'
                        : '行动窗口';
    return `第 ${roundNumber} 轮 · ${factionName} · ${pendingLabel}`;
};

export const hasRemainingFactionAction = (
    state: QidahenCore,
    factionId = getCurrentFactionId(state),
): boolean => {
    if (!state.factionActionUsed) {
        return true;
    }
    return factionId === 'jin'
        && hasActiveCharacter(state, 'jin', 'jin-huangtaiji')
        && state.bonusFactionActionAvailable
        && !state.bonusFactionActionUsed;
};

export const isFactionActionTurnComplete = (
    state: QidahenCore,
    factionId = getCurrentFactionId(state),
): boolean => (
    state.factionActionUsed && !hasRemainingFactionAction(state, factionId)
);

export const syncFactionActionWindow = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): QidahenCore => {
    const actionChoices = getActionChoicesForFaction(factionId);
    const fallbackActionId = actionChoices.find((choice) => isFactionActionSelectable(state, factionId, choice.id))?.id
        ?? getDefaultActionIdForFaction(factionId);
    const selectedActionId = isFactionActionSelectable(state, factionId, state.selectedActionId)
        ? state.selectedActionId
        : fallbackActionId;
    const confirmedActionId = state.confirmedActionId === selectedActionId
        ? state.confirmedActionId
        : null;
    return {
        ...state,
        actionChoices,
        selectedActionId,
        confirmedActionId,
        payment: buildPaymentState(selectedActionId, state.selectedPaymentCardIds.length),
    };
};
