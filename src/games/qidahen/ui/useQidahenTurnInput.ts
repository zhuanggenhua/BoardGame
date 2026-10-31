import { useState } from 'react';
import type { MatchState } from '../../../engine/types';
import type { SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { getQidahenTurnResolutionFrame } from '../domain/turnResolutionOpportunities';
import { QIDAHEN_TURN_RESOLUTION_CHOICE } from '../domain/turnResolutionTypes';
import type { QidahenCore } from '../domain/types';
import { getQidahenDispatchDraftTargets } from '../domain/wheelDispatchDraft';

/** UI仅选择正式请求中的实体；候选、数量和最终效果仍由规则owner决定。 */
export function useQidahenTurnInput(state: MatchState<QidahenCore>, playerId: string | null, dispatch: (type: string, payload?: unknown) => void, disabled: boolean) {
    const current = state.sys.interaction?.current;
    const data = current?.data as SimpleChoiceData | undefined;
    const active = data?.sourceId === QIDAHEN_TURN_RESOLUTION_CHOICE;
    const frame = getQidahenTurnResolutionFrame(state);
    const step = frame?.metadata.qidahenTurn.step;
    const [draft, setDraft] = useState<{ interactionId?: string; ids: string[] }>({ ids: [] });
    const selectedIds = draft.interactionId === current?.id ? draft.ids : [];
    const options = active ? data.options : [];
    const min = data?.multi?.min ?? 1;
    const max = data?.multi?.max ?? 1;
    const tutorialStep = state.sys.tutorial?.active ? state.sys.tutorial.step : null;
    const tutorialAllowsInput = !tutorialStep || tutorialStep.infoStep !== true
        && (!tutorialStep.allowedCommands?.length || tutorialStep.allowedCommands.includes('SYS_INTERACTION_RESPOND'));
    const canAct = active && !disabled && tutorialAllowsInput && (playerId == null || playerId === current?.playerId);
    const regionIds = new Set(state.core.regions.filter(region => !region.isLogicalRegion).map(region => region.id));
    const mapCandidateIds = active ? options.filter(option => regionIds.has(option.id)).map(option => option.id) : [];
    const cardIds = active ? options.filter(option => state.core.handCards.some(card => card.id === option.id)).map(option => option.id) : [];
    const pieceIds = step === 'dispatch-troops' || step === 'upkeep' ? options.filter(option => state.core.pieces.some(piece => piece.id === option.id)).map(option => option.id) : [];
    const allowedTargets = state.sys.tutorial?.active ? state.sys.tutorial.step?.allowedTargets : undefined;
    const authoredSelectionAllowed = !allowedTargets?.length || selectedIds.length > 0 && selectedIds.every(id => allowedTargets.includes(id)
        || allowedTargets.includes(state.core.handCards.find(card => card.id === id)?.cardDefId ?? ''))
        && (!data?.multi || allowedTargets.every(id => selectedIds.includes(id)));
    const troopsCanReach = step !== 'dispatch-troops' || !frame || getQidahenDispatchDraftTargets(state.core, frame.metadata.qidahenTurn.factionId, frame.metadata.qidahenTurn.sourceRegionId!, selectedIds).length > 0;
    const toggle = (id: string) => {
        if (!canAct || !options.some(option => option.id === id && !option.disabled)) return;
        setDraft({ interactionId: current!.id, ids: selectedIds.includes(id) ? selectedIds.filter(value => value !== id) : max === 1 ? [id] : selectedIds.length < max ? [...selectedIds, id] : selectedIds });
    };
    const selectRegion = (regionId: string, tokenId?: string): boolean => {
        if (!active) return false;
        if (step === 'dispatch-troops' || step === 'upkeep') {
            const pieceId = state.core.mapTokens.find(token => token.id === tokenId)?.pieceId;
            if (pieceId) toggle(pieceId);
            return true;
        }
        if (mapCandidateIds.length) { toggle(regionId); return true; }
        return false;
    };
    const confirm = () => {
        if (!canAct || !troopsCanReach || selectedIds.length < min || selectedIds.length > max) return;
        if (!authoredSelectionAllowed) {
            // 正式候选仍可选择；偏离本次示范时复用教程完整检查点，不提交另一套规则结果。
            dispatch('SYS_TUTORIAL_RESTART_STEP', {});
            setDraft({ ids: [] });
            return;
        }
        dispatch('SYS_INTERACTION_RESPOND', { interactionId: current!.id, ...(data?.multi ? { optionIds: selectedIds } : { optionId: selectedIds[0] }) });
    };
    return { active, canAct, step, title: active ? data.title : '', options, selectedIds, mapCandidateIds, cardIds, pieceIds,
        selectedPieceIds: selectedIds.filter(id => pieceIds.includes(id)), selectedCardIds: selectedIds.filter(id => cardIds.includes(id)), selectedRegionId: selectedIds.find(id => regionIds.has(id)),
        canConfirm: canAct && troopsCanReach && selectedIds.length >= min && selectedIds.length <= max, toggle, selectRegion, confirm,
    };
}
