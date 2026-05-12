import type { Command, GameEvent, PlayerId } from '../../../engine/types';

export type QidahenFactionId = 'ming' | 'mongol' | 'jin';

export interface QidahenFactionState {
    id: QidahenFactionId;
    playerId: PlayerId;
    name: string;
    colorClass: string;
    troops: number;
    grain: number;
    landTax: number;
    handLimit: number;
    handCount: number;
    actionDiamonds: number;
}

export interface QidahenRegionSummary {
    id: string;
    name: string;
    controller: QidahenFactionId | 'neutral';
    x: number;
    y: number;
    troops?: number;
    population?: number;
    note: string;
}

export interface QidahenLogEntry {
    id: string;
    faction: QidahenFactionId;
    text: string;
}

export interface QidahenCore {
    playerIds: PlayerId[];
    currentPlayer: PlayerId;
    currentYear: string;
    turnLabel: string;
    actionWheelPosition: string;
    selectedRegionId: string;
    factions: Record<QidahenFactionId, QidahenFactionState>;
    regions: QidahenRegionSummary[];
    pendingEffects: Array<{
        id: string;
        title: string;
        detail: string;
        timer: string;
    }>;
    battlePreview: {
        regionName: string;
        attacker: QidahenFactionId;
        defender: QidahenFactionId;
        attackerStrength: number;
        defenderStrength: number;
        phase: string;
    };
    handCards: Array<{
        id: string;
        title: string;
        cost: number;
        type: string;
        text: string;
    }>;
    actionLog: QidahenLogEntry[];
}

export interface SelectRegionCommand extends Command<'SELECT_REGION'> {
    payload: {
        regionId: string;
    };
}

export interface ConfirmPreviewActionCommand extends Command<'CONFIRM_PREVIEW_ACTION'> {
    payload: {
        actionId: string;
    };
}

export type QidahenCommand = SelectRegionCommand | ConfirmPreviewActionCommand;

export interface RegionSelectedEvent extends GameEvent<'REGION_SELECTED'> {
    payload: {
        regionId: string;
        playerId: PlayerId;
    };
}

export interface PreviewActionConfirmedEvent extends GameEvent<'PREVIEW_ACTION_CONFIRMED'> {
    payload: {
        actionId: string;
        playerId: PlayerId;
    };
}

export type QidahenEvent = RegionSelectedEvent | PreviewActionConfirmedEvent;

export interface QidahenCommandMap extends Record<string, unknown> {
    SELECT_REGION: SelectRegionCommand['payload'];
    CONFIRM_PREVIEW_ACTION: ConfirmPreviewActionCommand['payload'];
}
