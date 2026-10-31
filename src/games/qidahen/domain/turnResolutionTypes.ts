import type { GameEvent, ResolutionFrame } from '../../../engine/types';
import type { QidahenFactionId } from './types';
import type { QidahenCharacterOutcome } from './characterJudgement';

export const QIDAHEN_TURN_RESOLUTION_FRAME = 'qidahen:turn-resolution';
export const QIDAHEN_TURN_RESOLUTION_CHOICE = 'qidahen:turn-resolution-choice';

export type QidahenWheelSubaction = 'reclaim' | 'military-farm' | 'diplomacy' | 'hire' | 'dispatch' | 'play-character' | 'recruit-train';
export type QidahenTurnResolutionStep = 'menu' | 'reclaim-targets' | 'farm-target' | 'diplomacy-targets'
    | 'hire-payment' | 'hire-target' | 'dispatch-payment' | 'dispatch-source' | 'dispatch-troops' | 'dispatch-target'
    | 'slot-character' | 'await-child' | 'await-hand' | 'finish-hand' | 'await-fact' | 'midyear-income' | 'character-judgement' | 'tribute'
    | 'maintenance' | 'maintenance-payment' | 'upkeep' | 'chronology' | 'chronology-payment' | 'year-characters' | 'character-conflict' | 'wei-extra-character' | 'income-bonus' | 'complete';

export interface QidahenUpkeepTask {
    regionId: string;
    location: 'field' | 'city' | 'siege';
    factionId: QidahenFactionId;
    required: number;
    reason: 'troops' | 'siege' | 'neutral' | 'korea' | 'desert';
}

export interface QidahenCharacterJudgementTask {
    factionId: QidahenFactionId;
    characterId: string;
    reason: 'extra' | 'defeat-marker';
}

/** 长事务恢复位点只保存在共享ResolutionFrame，不在core另存季节进度。 */
export interface QidahenTurnResolutionData {
    positionId: string;
    factionId: QidahenFactionId;
    season: 'midyear' | 'new-year' | null;
    step: QidahenTurnResolutionStep;
    completedSubactions: QidahenWheelSubaction[];
    action?: QidahenWheelSubaction;
    hireExecutions: number;
    sourceRegionId?: string;
    selectedPieceIds?: string[];
    diplomacyRegionIds: string[];
    maintenanceIndex: number;
    upkeepTasks: QidahenUpkeepTask[];
    upkeepIndex: number;
    judgementTasks: QidahenCharacterJudgementTask[];
    judgementIndex: number;
    chronologyCandidates: QidahenFactionId[];
    chronologyIndex: number;
    yearCharacterIndex: number;
    upkeepRemaining?: number;
    paymentCardIds: string[];
    incomeBonusIndex: number;
    incomeBonusTasks: Array<{ factionId: QidahenFactionId; cards: number; label: string }>;
    characterReplacementFactionId?: QidahenFactionId;
    characterReturnStep?: 'slot-character' | 'year-characters' | 'character-judgement';
    handReturnStep?: 'menu' | 'complete';
}

export interface QidahenTurnResolutionFrame extends ResolutionFrame {
    kind: typeof QIDAHEN_TURN_RESOLUTION_FRAME;
    metadata: Record<string, unknown> & { qidahenTurn: QidahenTurnResolutionData };
}

export type QidahenTurnResolutionFact =
    | { kind: 'choose-action'; action: QidahenWheelSubaction }
    | { kind: 'choose-hand' }
    | { kind: 'skip-hand' }
    | { kind: 'finish-slot' }
    | { kind: 'cancel-selection' }
    | { kind: 'select-payment-card'; cardId: string }
    | { kind: 'begin-maintenance' }
    | { kind: 'begin-chronology' }
    | { kind: 'finish-diplomacy' }
    | { kind: 'income-bonus'; factionId: QidahenFactionId; cards: number }
    | { kind: 'replace-character'; factionId: QidahenFactionId; characterId: string | null }
    | { kind: 'reclaim'; regionIds: string[] }
    | { kind: 'military-farm'; regionId: string }
    | { kind: 'diplomacy'; regionIds: string[] }
    | { kind: 'pay-hire'; cardIds: string[] }
    | { kind: 'hire'; regionId: string; troops: number }
    | { kind: 'pay-dispatch'; cardIds: string[] }
    | { kind: 'select-dispatch-source'; regionId: string }
    | { kind: 'select-dispatch-troops'; pieceIds: string[] }
    | { kind: 'dispatch'; regionId: string; sourceRegionId: string; pieceIds: string[] }
    | { kind: 'recruit-train' }
    | { kind: 'midyear-income' }
    | { kind: 'tribute' }
    | { kind: 'maintenance'; fortificationId: string; cardIds: string[]; maintain: boolean }
    | { kind: 'upkeep'; task: QidahenUpkeepTask; cardIds: string[]; removedPieceIds: string[] }
    | { kind: 'judgement'; task: QidahenCharacterJudgementTask; rawRoll: number; outcome: QidahenCharacterOutcome }
    | { kind: 'chronology'; factionId: QidahenFactionId; cardIds: string[]; accept: boolean }
    | { kind: 'year-transition' }
    | { kind: 'character'; factionId: QidahenFactionId; characterIds: string[] }
    | { kind: 'finish-wheel' };

export interface QidahenTurnResolutionAppliedEvent extends GameEvent<'TURN_RESOLUTION_APPLIED'> {
    payload: {
        frameId: string;
        factionId: QidahenFactionId;
        fromStep: QidahenTurnResolutionStep;
        fact: QidahenTurnResolutionFact;
    };
}
