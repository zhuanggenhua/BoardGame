import type { MatchState } from '../../../../engine/types';
import type { DiceThroneCore, TurnPhase } from '../core-types';
import { DOCTOR_STRANGE_TOKEN as TOKEN } from '../../heroes/doctor_strange/constants';

export function canPrepareSpell(state: DiceThroneCore, playerId: string, phase: TurnPhase): boolean {
    const player = state.players[playerId];
    return player?.characterId === 'doctor_strange' && state.activePlayerId === playerId
        && (phase === 'main1' || phase === 'main2') && player.spellPreparedTurn !== state.turnNumber;
}

export function isCrimsonBandsBlocking(state: DiceThroneCore, playerId: string, phase: TurnPhase): boolean {
    const player = state.players[playerId];
    return (player?.statusEffects[TOKEN.CRIMSON_BANDS] ?? 0) > 0
        && player.crimsonBandsActiveTurn === state.turnNumber
        && (phase === 'offensiveRoll' || phase === 'targetingRoll' || phase === 'defensiveRoll');
}

/** 允许已用完次数或被改骰后重开；能力声明/致盲等判定开始后不再允许。 */
export function canUseDejaVu(state: Readonly<MatchState<DiceThroneCore>>, playerId: string): boolean {
    return canUseDejaVuCore(
        state.core,
        state.sys.phase as TurnPhase,
        playerId,
        state.sys.responseWindow?.current?.windowType,
        Boolean(state.sys.interaction.current),
        Boolean(state.sys.gameover),
    );
}

export function canUseDejaVuCore(
    core: Readonly<DiceThroneCore>,
    phase: TurnPhase,
    playerId: string,
    responseWindowType?: string,
    hasPendingInteraction = false,
    isGameOver = false,
): boolean {
    return phase === 'offensiveRoll' && core.activePlayerId === playerId
        && (core.players[playerId]?.tokens[TOKEN.DEJA_VU] ?? 0) > 0
        && !core.pendingAttack && !core.activatingAbilityId && !core.pendingDamage
        && (!responseWindowType || responseWindowType === 'afterRollConfirmed')
        && !hasPendingInteraction && !core.pendingBonusDiceSettlement && !isGameOver;
}
