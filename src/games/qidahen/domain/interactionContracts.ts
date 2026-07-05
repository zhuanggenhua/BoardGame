import type {
    InteractionDescriptor,
    SimpleChoiceData,
} from '../../../engine/systems/InteractionSystem';
import type {
    QidahenCasualtyPriority,
    QidahenDiplomacyChoice,
    QidahenDiplomacySelection,
    QidahenDriveTigerConsentChoice,
    QidahenDriveTigerConsentSelection,
    QidahenEventCharacterTargetSelection,
    QidahenEventOpponentHandChoiceSelection,
    QidahenFortificationMaintenanceMode,
    QidahenFortificationMaintenanceSelection,
    QidahenGrantPardonChoice,
    QidahenGrantPardonSelection,
    QidahenHandLimitDiscardSelection,
    QidahenInternalDispatchSelection,
    QidahenKhanEdictChoice,
    QidahenKhanEdictSelection,
    QidahenMaShiTradeSelection,
    QidahenPendingTargetAction,
    QidahenPostBattleSelection,
    QidahenRecruitChoice,
    QidahenRecruitSelection,
    QidahenWheelDispatchSelection,
    ResolvePendingActionCommand,
} from './types';

interface QidahenHandLimitDiscardChoiceValue {
    cardId: string;
}

interface QidahenRecruitChoiceValue {
    choiceId: QidahenRecruitChoice['id'];
}

interface QidahenGrantPardonChoiceValue {
    choiceId: QidahenGrantPardonChoice['id'];
}

interface QidahenDiplomacyChoiceValue {
    choiceId: QidahenDiplomacyChoice['id'];
}

interface QidahenWheelDispatchChoiceValue {
    choiceId: string;
}

export type QidahenPendingTargetChoiceValue = ResolvePendingActionCommand['payload'] & {
    choiceId: string;
};

interface QidahenPostBattleChoiceValue {
    choiceId: string;
}

interface QidahenInternalDispatchChoiceValue {
    choiceId: string;
}

interface QidahenMaShiTradeChoiceValue {
    troopCount: 1 | 2 | 3;
}

interface QidahenKhanEdictChoiceValue {
    choiceId: QidahenKhanEdictChoice['id'];
}

interface QidahenDriveTigerConsentChoiceValue {
    choiceId: QidahenDriveTigerConsentChoice['id'];
}

interface QidahenFortificationMaintenanceChoiceValue {
    choiceId: QidahenFortificationMaintenanceMode;
    attritionPriority?: QidahenCasualtyPriority;
}

interface QidahenEventCharacterTargetChoiceValue {
    choiceId: string;
}

interface QidahenEventOpponentHandChoiceValue {
    choiceId: string;
}

export type QidahenHandLimitDiscardInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenHandLimitDiscardChoiceValue> & {
        qidahenHandLimitDiscardSelection: QidahenHandLimitDiscardSelection;
    }
>;

export type QidahenRecruitInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenRecruitChoiceValue> & {
        qidahenRecruitSelection: QidahenRecruitSelection;
    }
>;

export type QidahenGrantPardonInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenGrantPardonChoiceValue> & {
        qidahenGrantPardonSelection: QidahenGrantPardonSelection;
    }
>;

export type QidahenDiplomacyInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenDiplomacyChoiceValue> & {
        qidahenDiplomacySelection: QidahenDiplomacySelection;
    }
>;

export type QidahenWheelDispatchInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenWheelDispatchChoiceValue> & {
        qidahenWheelDispatchSelection: QidahenWheelDispatchSelection;
    }
>;

export type QidahenPendingTargetInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenPendingTargetChoiceValue> & {
        qidahenPendingTargetAction: QidahenPendingTargetAction;
    }
>;

export type QidahenPostBattleInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenPostBattleChoiceValue> & {
        qidahenPostBattleSelection: QidahenPostBattleSelection;
    }
>;

export type QidahenInternalDispatchInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenInternalDispatchChoiceValue> & {
        qidahenInternalDispatchSelection: QidahenInternalDispatchSelection;
    }
>;

export type QidahenMaShiTradeInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenMaShiTradeChoiceValue> & {
        qidahenMaShiTradeSelection: QidahenMaShiTradeSelection;
    }
>;

export type QidahenKhanEdictInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenKhanEdictChoiceValue> & {
        qidahenKhanEdictSelection: QidahenKhanEdictSelection;
    }
>;

export type QidahenDriveTigerConsentInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenDriveTigerConsentChoiceValue> & {
        qidahenDriveTigerConsentSelection: QidahenDriveTigerConsentSelection;
    }
>;

export type QidahenFortificationMaintenanceInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenFortificationMaintenanceChoiceValue> & {
        qidahenFortificationMaintenanceSelection: QidahenFortificationMaintenanceSelection;
    }
>;

export type QidahenEventCharacterTargetInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenEventCharacterTargetChoiceValue> & {
        qidahenEventCharacterTargetSelection: QidahenEventCharacterTargetSelection;
    }
>;

export type QidahenEventOpponentHandChoiceInteraction = InteractionDescriptor<
    SimpleChoiceData<QidahenEventOpponentHandChoiceValue> & {
        qidahenEventOpponentHandChoiceSelection: QidahenEventOpponentHandChoiceSelection;
    }
>;
