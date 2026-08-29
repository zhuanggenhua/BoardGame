import type { MatchState } from '../../../engine/types';
import type { SummonerWarsCore } from './types';

export type PhaseEndAbilityResolvedMap = Record<string, true>;

type LegacySummonerWarsSystemState = {
  summonerWars?: {
    phaseEndAbilityResolved?: PhaseEndAbilityResolvedMap;
  };
};

export function getPhaseEndAbilityResolved(
  state: Readonly<MatchState<SummonerWarsCore>>,
): PhaseEndAbilityResolvedMap | undefined {
  return state.core.phaseEndAbilityResolved
    ?? (state.sys as LegacySummonerWarsSystemState | undefined)?.summonerWars?.phaseEndAbilityResolved;
}

export function withPhaseEndAbilityResolved(
  state: MatchState<SummonerWarsCore>,
  phaseEndAbilityResolved: PhaseEndAbilityResolvedMap,
): MatchState<SummonerWarsCore> {
  const nextSys = { ...(state.sys as unknown as Record<string, unknown>) };
  delete nextSys.summonerWars;

  return {
    ...state,
    core: {
      ...state.core,
      phaseEndAbilityResolved,
    },
    sys: nextSys as unknown as typeof state.sys,
  };
}
