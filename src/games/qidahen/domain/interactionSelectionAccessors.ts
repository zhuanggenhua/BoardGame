import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import {
    QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID,
    QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID,
    QIDAHEN_EVENT_CHARACTER_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_EVENT_OPPONENT_HAND_CHOICE_INTERACTION_SOURCE_ID,
    QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
    QIDAHEN_GRANT_PARDON_INTERACTION_SOURCE_ID,
    QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,
    QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID,
    QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID,
    QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID,
    QIDAHEN_OPEN_GATE_SURRENDER_INTERACTION_SOURCE_ID,
    QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
    QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID,
    QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,
    type QidahenInteractionSourceId,
} from './interactionSources';
import {
    buildDriveTigerDispatchSelectionFromRegionSemantics,
    getQidahenInternalDispatchSelectionForCore as getCoreQidahenInternalDispatchSelectionForCore,
} from './dispatchSelectionBuilders';
import { getQidahenLockedRegionSelectionSemantics } from './regionFocusSemantics';
import {
    getQidahenDiplomacySelectionForCore as getCoreQidahenDiplomacySelectionForCore,
    getQidahenGrantPardonSelectionForCore as getCoreQidahenGrantPardonSelectionForCore,
    getQidahenKhanEdictSelectionForCore as getCoreQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore as getCoreQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore as getCoreQidahenRecruitSelectionForCore,
} from './selectionBuilders';
import type {
    QidahenCore,
    QidahenDiplomacySelection,
    QidahenDriveTigerConsentSelection,
    QidahenEventCharacterTargetSelection,
    QidahenEventOpponentHandChoiceSelection,
    QidahenFactionId,
    QidahenFortificationMaintenanceSelection,
    QidahenGrantPardonSelection,
    QidahenHandLimitDiscardSelection,
    QidahenInternalDispatchSelection,
    QidahenKhanEdictSelection,
    QidahenMaShiTradeSelection,
    QidahenOpenGateSurrenderSelection,
    QidahenPendingTargetAction,
    QidahenPostBattleSelection,
    QidahenRecruitSelection,
    QidahenWheelDispatchSelection,
} from './types';

type QidahenInteractionSelectionCarrier = Pick<InteractionDescriptor, 'data'>;

const readQidahenInteractionSelectionField = <TSelection>(
    interactionData: unknown,
    expectedSourceId: QidahenInteractionSourceId,
    selectionKey: string,
): TSelection | null => {
    if (!interactionData || typeof interactionData !== 'object') {
        return null;
    }
    const data = interactionData as { sourceId?: unknown } & Record<string, unknown>;
    const selection = data[selectionKey] as TSelection | null | undefined;
    if (data.sourceId !== expectedSourceId && selection == null) {
        return null;
    }
    return selection ?? null;
};

const getFactionIdByPlayerId = (core: QidahenCore, playerId: string): QidahenFactionId | null => {
    if (core.factions.ming.playerId === playerId) {
        return 'ming';
    }
    if (core.factions.mongol.playerId === playerId) {
        return 'mongol';
    }
    if (core.factions.jin.playerId === playerId) {
        return 'jin';
    }
    return null;
};

const getQidahenDriveTigerConsentDispatchSelectionForCore = (
    core: QidahenCore,
): QidahenWheelDispatchSelection | null => {
    if (core.turnPhase !== 'drive-tiger-consent') {
        return null;
    }
    const shouldRebuildDriveTigerDispatchSelection = core.lastFactionActionId === 'drive-tiger'
        && !core.wheelActionUsed;
    const commanderFactionId = getFactionIdByPlayerId(core, core.currentPlayer);
    return shouldRebuildDriveTigerDispatchSelection
        && commanderFactionId
        ? buildDriveTigerDispatchSelectionFromRegionSemantics(
            core,
            commanderFactionId,
            getQidahenLockedRegionSelectionSemantics(core),
        )
        : null;
};

const getQidahenInteractionSelectionMirrorForCore = <TSelection>({
    core,
    interaction,
    isActive,
    readInteraction,
    readCore,
    preferInteraction = true,
}: {
    core: QidahenCore;
    interaction?: QidahenInteractionSelectionCarrier | null;
    isActive: (core: QidahenCore) => boolean;
    readInteraction: (interaction?: QidahenInteractionSelectionCarrier | null) => TSelection | null;
    readCore: (core: QidahenCore) => TSelection | null;
    preferInteraction?: boolean;
}): TSelection | null => {
    if (!isActive(core)) {
        return null;
    }
    return preferInteraction
        ? readInteraction(interaction) ?? readCore(core)
        : readCore(core) ?? readInteraction(interaction);
};

export const getQidahenInteractionSelectionStateForCore = <TSelection>(
    interactionSelection: TSelection | null | undefined,
    core: QidahenCore,
    readCoreSelection: (state: QidahenCore) => TSelection | null,
): TSelection | null => interactionSelection ?? readCoreSelection(core);

export function getQidahenDiplomacySelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenDiplomacySelection | null {
    return getQidahenDiplomacySelectionFromInteractionData(interaction?.data);
}

const getQidahenDiplomacySelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenDiplomacySelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID,
        'qidahenDiplomacySelection',
    );
};

export function getQidahenDiplomacySelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenDiplomacySelection | null {
    return getCoreQidahenDiplomacySelectionForCore(
        core,
        getQidahenDiplomacySelectionFromInteraction(interaction),
    );
}

export function getQidahenHandLimitDiscardSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenHandLimitDiscardSelection | null {
    return getQidahenHandLimitDiscardSelectionFromInteractionData(interaction?.data);
}

const getQidahenHandLimitDiscardSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenHandLimitDiscardSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,
        'qidahenHandLimitDiscardSelection',
    );
};

export function getQidahenHandLimitDiscardSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenHandLimitDiscardSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => currentCore.turnPhase === 'hand-limit-discard',
        readInteraction: getQidahenHandLimitDiscardSelectionFromInteraction,
        readCore: (currentCore) => currentCore.handLimitDiscardSelection,
    });
}

export function getQidahenRecruitSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenRecruitSelection | null {
    return getQidahenRecruitSelectionFromInteractionData(interaction?.data);
}

const getQidahenRecruitSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenRecruitSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID,
        'qidahenRecruitSelection',
    );
};

export function getQidahenRecruitSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenRecruitSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => (
            currentCore.turnPhase === 'recruit-choice'
            && currentCore.confirmedActionId === 'recruit'
        ),
        readInteraction: getQidahenRecruitSelectionFromInteraction,
        readCore: (currentCore) => currentCore.recruitSelection ?? getCoreQidahenRecruitSelectionForCore(currentCore),
    });
}

export function getQidahenGrantPardonSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenGrantPardonSelection | null {
    return getQidahenGrantPardonSelectionFromInteractionData(interaction?.data);
}

const getQidahenGrantPardonSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenGrantPardonSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_GRANT_PARDON_INTERACTION_SOURCE_ID,
        'qidahenGrantPardonSelection',
    );
};

export function getQidahenGrantPardonSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenGrantPardonSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => (
            currentCore.turnPhase === 'grant-pardon-choice'
            && currentCore.confirmedActionId === 'grant-pardon'
        ),
        readInteraction: getQidahenGrantPardonSelectionFromInteraction,
        readCore: (currentCore) => currentCore.grantPardonSelection ?? getCoreQidahenGrantPardonSelectionForCore(currentCore),
    });
}

export function getQidahenWheelDispatchSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenWheelDispatchSelection | null {
    return getQidahenWheelDispatchSelectionFromInteractionData(interaction?.data);
}

const getQidahenWheelDispatchSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenWheelDispatchSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,
        'qidahenWheelDispatchSelection',
    );
};

export function getQidahenWheelDispatchSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenWheelDispatchSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => currentCore.turnPhase === 'dispatch-targeting',
        readInteraction: getQidahenWheelDispatchSelectionFromInteraction,
        readCore: (currentCore) => currentCore.wheelDispatchProgress,
    });
}

export function getQidahenInternalDispatchSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenInternalDispatchSelection | null {
    return getQidahenInternalDispatchSelectionFromInteractionData(interaction?.data);
}

const getQidahenInternalDispatchSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenInternalDispatchSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID,
        'qidahenInternalDispatchSelection',
    );
};

export function getQidahenInternalDispatchSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenInternalDispatchSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => currentCore.turnPhase === 'internal-dispatch-choice',
        readInteraction: getQidahenInternalDispatchSelectionFromInteraction,
        readCore: getCoreQidahenInternalDispatchSelectionForCore,
    });
}

export function getQidahenMaShiTradeSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenMaShiTradeSelection | null {
    return getQidahenMaShiTradeSelectionFromInteractionData(interaction?.data);
}

const getQidahenMaShiTradeSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenMaShiTradeSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID,
        'qidahenMaShiTradeSelection',
    );
};

export function getQidahenMaShiTradeSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenMaShiTradeSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => currentCore.turnPhase === 'ma-shi-trade-choice',
        readInteraction: getQidahenMaShiTradeSelectionFromInteraction,
        readCore: (currentCore) => currentCore.maShiTradeSelection ?? getCoreQidahenMaShiTradeSelectionForCore(currentCore),
    });
}

export function getQidahenKhanEdictSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenKhanEdictSelection | null {
    return getQidahenKhanEdictSelectionFromInteractionData(interaction?.data);
}

const getQidahenKhanEdictSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenKhanEdictSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID,
        'qidahenKhanEdictSelection',
    );
};

export function getQidahenKhanEdictSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenKhanEdictSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => (
            currentCore.turnPhase === 'khan-edict-choice'
            && currentCore.confirmedActionId === 'khan-edict'
        ),
        readInteraction: getQidahenKhanEdictSelectionFromInteraction,
        readCore: (currentCore) => currentCore.khanEdictSelection ?? getCoreQidahenKhanEdictSelectionForCore(currentCore),
    });
}

export function getQidahenDriveTigerConsentSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenDriveTigerConsentSelection | null {
    return getQidahenDriveTigerConsentSelectionFromInteractionData(interaction?.data);
}

const getQidahenDriveTigerConsentSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenDriveTigerConsentSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID,
        'qidahenDriveTigerConsentSelection',
    );
};

export function getQidahenDriveTigerConsentSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenDriveTigerConsentSelection | null {
    const interactionSelection = getQidahenDriveTigerConsentSelectionFromInteraction(interaction);
    if (interactionSelection) {
        return interactionSelection;
    }
    const dispatchSelection = getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => currentCore.turnPhase === 'drive-tiger-consent',
        readInteraction: getQidahenWheelDispatchSelectionFromInteraction,
        readCore: (currentCore) => currentCore.wheelDispatchProgress,
    }) ?? getQidahenDriveTigerConsentDispatchSelectionForCore(core);
    if (!dispatchSelection || dispatchSelection.sourceActionId !== 'drive-tiger') {
        return null;
    }
    const commanderFactionId = getFactionIdByPlayerId(core, core.currentPlayer);
    if (
        commanderFactionId == null
        || dispatchSelection.attackerFactionId === commanderFactionId
    ) {
        return null;
    }
    const targetFactionName = core.factions[dispatchSelection.attackerFactionId].name;
    const commanderFactionName = core.factions[commanderFactionId].name;
    const committedTroopLimit = dispatchSelection.candidates.reduce(
        (max, candidate) => Math.max(max, candidate.committedTroops),
        0,
    );
    return {
        commanderFactionId,
        targetFactionId: dispatchSelection.attackerFactionId,
        targetFactionName,
        dispatchSelection,
        choices: [
            {
                id: 'accept',
                label: '同意受指挥',
                detail: `${targetFactionName} 同意后，先抽 6 张手牌，再由${commanderFactionName}指挥最多 ${committedTroopLimit || 6} 个部队进行调度进攻。`,
            },
            {
                id: 'decline',
                label: '拒绝执行',
                detail: `${targetFactionName} 拒绝后，本次驱虎吞狼不生效，也不会抽牌。`,
            },
        ],
    };
}

export function getQidahenFortificationMaintenanceSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenFortificationMaintenanceSelection | null {
    return getQidahenFortificationMaintenanceSelectionFromInteractionData(interaction?.data);
}

const getQidahenFortificationMaintenanceSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenFortificationMaintenanceSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
        'qidahenFortificationMaintenanceSelection',
    );
};

export function getQidahenFortificationMaintenanceSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenFortificationMaintenanceSelection | null {
    const isFortificationMaintenanceActive = (
        core.turnPhase === 'season-resolution'
        && core.actionWheelPosition === 'wheel-new-year'
    );
    if (!isFortificationMaintenanceActive) {
        return null;
    }
    const interactionSelection = getQidahenFortificationMaintenanceSelectionFromInteraction(interaction);
    if (interactionSelection) {
        return interactionSelection;
    }
    return {
        title: '新年防线维护',
        summary: `大明当前手牌 ${core.factions.ming.handCount} 张；可先选择尽量维护，也可本年放弃维护全部防线。`,
        choices: [
            {
                id: 'auto-pay',
                label: '尽量维护防线',
                detail: '按当前防线优先级自动支付可负担的维护费，无法维护或依赖区域失守的防线改为破败。',
            },
            {
                id: 'skip-all',
                label: '放弃维护全部防线',
                detail: '本年不支付防线维护费，外长城、内长城、山海关、宁远、锦州全部改为破败。',
            },
        ],
    };
}

export function getQidahenPendingTargetActionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenPendingTargetAction | null {
    return getQidahenPendingTargetActionFromInteractionData(interaction?.data);
}

const getQidahenPendingTargetActionFromInteractionData = (
    interactionData?: unknown,
): QidahenPendingTargetAction | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
        'qidahenPendingTargetAction',
    );
};

export function getQidahenPendingTargetActionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenPendingTargetAction | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => currentCore.turnPhase === 'resolve-pending',
        readInteraction: getQidahenPendingTargetActionFromInteraction,
        readCore: (currentCore) => currentCore.pendingTargetAction,
    });
}

export function getQidahenEventCharacterTargetSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenEventCharacterTargetSelection | null {
    return getQidahenEventCharacterTargetSelectionFromInteractionData(interaction?.data);
}

const getQidahenEventCharacterTargetSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenEventCharacterTargetSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_EVENT_CHARACTER_TARGET_INTERACTION_SOURCE_ID,
        'qidahenEventCharacterTargetSelection',
    );
};

export function getQidahenEventCharacterTargetSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenEventCharacterTargetSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => currentCore.turnPhase === 'event-character-target',
        readInteraction: getQidahenEventCharacterTargetSelectionFromInteraction,
        readCore: (currentCore) => currentCore.eventCharacterTargetSelection,
    });
}

export function getQidahenEventOpponentHandChoiceSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenEventOpponentHandChoiceSelection | null {
    return getQidahenEventOpponentHandChoiceSelectionFromInteractionData(interaction?.data);
}

const getQidahenEventOpponentHandChoiceSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenEventOpponentHandChoiceSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_EVENT_OPPONENT_HAND_CHOICE_INTERACTION_SOURCE_ID,
        'qidahenEventOpponentHandChoiceSelection',
    );
};

export function getQidahenEventOpponentHandChoiceSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenEventOpponentHandChoiceSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => currentCore.turnPhase === 'event-opponent-hand-choice',
        readInteraction: getQidahenEventOpponentHandChoiceSelectionFromInteraction,
        readCore: (currentCore) => currentCore.eventOpponentHandChoiceSelection,
    });
}

export function getQidahenOpenGateSurrenderSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenOpenGateSurrenderSelection | null {
    return readQidahenInteractionSelectionField(
        interaction?.data,
        QIDAHEN_OPEN_GATE_SURRENDER_INTERACTION_SOURCE_ID,
        'qidahenOpenGateSurrenderSelection',
    );
}

export function getQidahenOpenGateSurrenderSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenOpenGateSurrenderSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => currentCore.turnPhase === 'open-gate-surrender',
        readInteraction: getQidahenOpenGateSurrenderSelectionFromInteraction,
        readCore: (currentCore) => currentCore.openGateSurrenderSelection,
    });
}

export function getQidahenPostBattleSelectionFromInteraction(
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenPostBattleSelection | null {
    return getQidahenPostBattleSelectionFromInteractionData(interaction?.data);
}

const getQidahenPostBattleSelectionFromInteractionData = (
    interactionData?: unknown,
): QidahenPostBattleSelection | null => {
    return readQidahenInteractionSelectionField(
        interactionData,
        QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
        'qidahenPostBattleSelection',
    );
};

export function getQidahenPostBattleSelectionForCore(
    core: QidahenCore,
    interaction?: QidahenInteractionSelectionCarrier | null,
): QidahenPostBattleSelection | null {
    return getQidahenInteractionSelectionMirrorForCore({
        core,
        interaction,
        isActive: (currentCore) => currentCore.turnPhase === 'post-battle-decision',
        readInteraction: getQidahenPostBattleSelectionFromInteraction,
        readCore: (currentCore) => currentCore.postBattleSelection,
    });
}
