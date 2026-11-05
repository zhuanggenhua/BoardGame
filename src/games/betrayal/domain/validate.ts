import type { MatchState, ValidationResult } from '../../../engine/types';
import type { BetrayalCore } from './types';
import type { BetrayalCommand } from '../commandTypes';
import { validateHauntAction } from './hauntValidation';
import { BETRAYAL_COMMANDS } from '../commands';
import { templateByExplorerId } from './stateFactory';
import {
    isBetrayalScenarioCardId,
    resolveImplementedScenarioIdForCard,
    BETRAYAL_SCENARIO_CONFIGS,
} from '../scenarioConfig';
import { validatePreHauntAction } from './preHauntValidation';

export function validateCommand(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    const core = state.core;
    if (core.phase === 'haunt') {
        return validateHauntAction(state, command);
    }
    switch (command.type) {
        case BETRAYAL_COMMANDS.SELECT_EXPLORER: {
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            const explorerId = command.payload.explorerId;
            if (!templateByExplorerId(explorerId)) return { valid: false, error: '未知探索者。' };
            const takenByAnother = Object.entries(core.selectedExplorerByPlayerId).some(
                ([playerId, selectedExplorerId]) => playerId !== command.playerId && selectedExplorerId === explorerId,
            );
            return takenByAnother ? { valid: false, error: '该探索者已被选择。' } : { valid: true };
        }
        case BETRAYAL_COMMANDS.CONFIRM_EXPLORER:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            return core.selectedExplorerByPlayerId[command.playerId]
                ? { valid: true }
                : { valid: false, error: '请先选择探索者。' };
        case BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            if (!isBetrayalScenarioCardId(command.payload.candidateId)) {
                return { valid: false, error: '未知剧本卡。' };
            }
            return core.scenarioCandidateIds.includes(command.payload.candidateId)
                ? { valid: true }
                : { valid: false, error: '该剧本卡不在本局候选池。' };
        case BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            if (!core.selectedExplorerByPlayerId[command.playerId]) {
                return { valid: false, error: '请先选择探索者。' };
            }
            if (!core.scenarioCandidateIds.includes(core.proposedScenarioCardId)) {
                return { valid: false, error: '当前剧本卡不在本局候选池。' };
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.START_SCENARIO:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            {
                const missingExplorerPlayerId = core.playerIds.find(
                    (playerId) => !core.selectedExplorerByPlayerId[playerId],
                );
                if (missingExplorerPlayerId) {
                    return { valid: false, error: '每位玩家都需要先选择探索者。' };
                }
                const unconfirmedExplorerPlayerId = core.playerIds.find(
                    (playerId) => !core.readyPlayerIds.includes(playerId),
                );
                if (unconfirmedExplorerPlayerId) {
                    return { valid: false, error: '每位玩家都需要先确认探索者。' };
                }
                const missingConfirmationPlayerId = core.playerIds.find(
                    (playerId) => core.scenarioCardConfirmations[playerId] !== core.proposedScenarioCardId,
                );
                if (missingConfirmationPlayerId) {
                    return { valid: false, error: '请先确认当前剧本卡。' };
                }
                const implementedScenarioId = resolveImplementedScenarioIdForCard(core.proposedScenarioCardId);
                if (!implementedScenarioId) {
                    return { valid: false, error: '这个剧本现在不能开始。' };
                }
                if (command.payload.scenarioId && command.payload.scenarioId !== implementedScenarioId) {
                    return { valid: false, error: '开始剧本与当前剧本卡提议不一致。' };
                }
            }
            if (command.payload.scenarioId && !BETRAYAL_SCENARIO_CONFIGS[command.payload.scenarioId]) {
                return { valid: false, error: '未知剧本。' };
            }
            return Object.keys(core.selectedExplorerByPlayerId).length > 0
                ? { valid: true }
                : { valid: false, error: '至少需要一名玩家选择探索者。' };
        default:
            return validatePreHauntAction(state, command);
    }
}
