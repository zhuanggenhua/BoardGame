import React from 'react';
import { useEventStreamCursor } from '../../../engine/hooks';
import { useEventStreamRollback } from '../../../engine/hooks/EventStreamRollbackContext';
import type { EventStreamEntry } from '../../../engine/types';
import { QIDAHEN_BATTLE_ROLLED, type QidahenBattleRolledEvent } from '../domain/battleVisualEvent';
import type { QidahenCore, QidahenFactionId, QidahenPendingTargetAction, QidahenPostBattleSelection, QidahenPublicBattleReport } from '../domain/types';

const EMPTY_EVENTS: EventStreamEntry[] = [];
const rollsFor = (core: QidahenCore) => core.pendingTargetAction?.resolvedBattleRolls ?? core.postBattleSelection?.battleRolls ?? null;
const identityFor = (core: QidahenCore) => {
    const rolls = rollsFor(core);
    const battle = core.pendingTargetAction ?? core.postBattleSelection;
    return rolls && battle ? `${core.roundNumber}:${battle.sourceRegionId}:${battle.targetRegionId}:${JSON.stringify(rolls)}` : null;
};
const reportKey = (report: QidahenPublicBattleReport) => `${report.battleId}:${JSON.stringify(report.rolls)}`;
type Cue = { id: number; report: QidahenPublicBattleReport; before: QidahenCore };
type Battle = QidahenPublicBattleReport | QidahenPendingTargetAction | QidahenPostBattleSelection;

function battleParticipants(battle: Battle): { attackerFactionId: QidahenFactionId; defenderFactionId: QidahenFactionId | 'neutral'; defenderLabel: string } {
    if ('originalController' in battle) return { attackerFactionId: battle.attackerFactionId,
        defenderFactionId: battle.originalController, defenderLabel: battle.originalControlLabel };
    return { attackerFactionId: battle.attackerFactionId, defenderFactionId: battle.defenderFactionId, defenderLabel: battle.defenderLabel };
}

function battleSelectedPieces(battle: Battle): string[] {
    return 'selectedPieceIds' in battle ? battle.selectedPieceIds
        : battle.forceCommitments?.flatMap(force => force.selectedSpecialPieceIds ?? []) ?? [];
}

function restoreBattlefield(core: QidahenCore, report: QidahenPublicBattleReport): QidahenCore {
    const field = report.battlefield;
    if (!field) return core;
    const ids = new Set(field.pieces.map(piece => piece.id));
    const tokenIds = new Set(field.mapTokens.map(token => token.id));
    return { ...core, pieces: [...core.pieces.filter(piece => !ids.has(piece.id)), ...field.pieces],
        mapTokens: [...core.mapTokens.filter(token => !tokenIds.has(token.id)), ...field.mapTokens] };
}

/** 仅在战斗公开后读取权威事件或该次正式摘要；表现队列不写规则状态。 */
export function useQidahenBattlePresentation(core: QidahenCore, entries: EventStreamEntry[] = EMPTY_EVENTS, tutorialPending = false) {
    const identity = identityFor(core);
    const [completed, setCompleted] = React.useState<string | null>(() => tutorialPending ? null : identity);
    const [before, setBefore] = React.useState<QidahenCore | null>(null);
    const [queue, setQueue] = React.useState<Cue[]>([]);
    const previousCore = React.useRef(core);
    const firstConsumption = React.useRef(true);
    const seen = React.useRef(new Map<string, number>());
    const rollback = useEventStreamRollback();
    const { consumeNew } = useEventStreamCursor({ entries, consumeInitialEntries: tutorialPending, consumeOnReconcile: true });
    const legacyActive = identity != null && completed !== identity;

    React.useLayoutEffect(() => {
        const result = consumeNew();
        const trueRollback = result.didReset || result.didOptimisticRollback && rollback.watermark !== null;
        if (trueRollback) {
            seen.current.clear();
            setQueue([]);
            setBefore(null);
            setCompleted(tutorialPending ? null : identityFor(core));
        }
        const resync = result.didOptimisticRollback && rollback.watermark === null;
        const report = core.pendingTargetAction?.battleReport ?? core.postBattleSelection?.battleReport ?? core.lastSeasonSummary?.battleReport;
        if (resync && queue.length) {
            const current = queue[0];
            const liveRolls = rollsFor(core);
            if (report && report.battleId === current.report.battleId) {
                if (reportKey(report) !== reportKey(current.report)) {
                    seen.current.delete(reportKey(current.report));
                    seen.current.set(reportKey(report), current.id);
                    setQueue([{ id: current.id, report, before: current.before }]);
                }
            } else if (!liveRolls || JSON.stringify(liveRolls) !== JSON.stringify(current.report.rolls)) {
                setQueue([]);
                setBefore(null);
                setCompleted(tutorialPending ? null : identityFor(core));
            }
        }
        let added = result.entries.filter(entry => entry.event.type === QIDAHEN_BATTLE_ROLLED);
        // 正常重进不重播旧历史；恢复教程等待时只恢复最近一场。
        const first = firstConsumption.current;
        if (first && tutorialPending) added = added.slice(-1);
        firstConsumption.current = false;
        const cues: Cue[] = [];
        for (const entry of added) {
            const next = (entry.event as QidahenBattleRolledEvent).payload.report;
            const key = reportKey(next);
            if (seen.current.has(key)) continue;
            seen.current.set(key, entry.id);
            cues.push({ id: entry.id, report: next, before: first ? restoreBattlefield(previousCore.current, next) : previousCore.current });
        }
        // 只有该教程仍在等待、事件流缺失且正式摘要就是已完成的战报时才恢复。
        if (!cues.length && tutorialPending && report && !seen.current.has(reportKey(report))) {
            seen.current.set(reportKey(report), -1);
            cues.push({ id: -1, report, before: restoreBattlefield(previousCore.current, report) });
        }
        if (cues.length) setQueue(current => {
            const correctedIds = new Set(cues.map(item => item.report.battleId));
            return [...current.filter(item => !correctedIds.has(item.report.battleId)), ...cues];
        });
        if (legacyActive && !rollsFor(previousCore.current)) setBefore(previousCore.current);
        if (!legacyActive) setBefore(null);
        previousCore.current = core;
    }, [consumeNew, core, tutorialPending, legacyActive, rollback.watermark]);

    const cue = queue[0];
    const active = Boolean(cue) || legacyActive;
    const battle: QidahenPublicBattleReport | QidahenPendingTargetAction | QidahenPostBattleSelection | null =
        cue?.report ?? (legacyActive ? before?.pendingTargetAction : null) ?? core.pendingTargetAction ?? core.postBattleSelection ?? null;
    const rolls = cue?.report.rolls ?? rollsFor(core);
    const participants = battle ? battleParticipants(battle) : null;
    const complete = React.useCallback(() => {
        if (cue) setQueue(current => current.filter(item => item !== cue));
        setCompleted(identityFor(core));
    }, [core, cue]);
    const committedPieceIds = !active || !battle ? [] : battleSelectedPieces(battle);
    return { identity: cue ? `event:${reportKey(cue.report)}` : identity, active, rolls, battle,
        displayCore: cue?.before ?? (legacyActive && before ? before : core), participants, committedPieceIds, complete };
}
