import type { RandomFn } from "../../engine/types";
import { rollBetrayalDicePips } from "./diceRules";
import { getAllExplorers } from "./explorerReadModel";
import { cloneDustRuntimeState } from "./hauntRuntimeSetupModel";
import { isDustHaunt } from "./hauntScenarioReadModel";
import type {
  BetrayalCore,
  BetrayalDustRuntimeState,
  BetrayalDustSicknessSwapResult,
  BetrayalExplorerSummary,
  BetrayalTraitKey,
} from "./game";

export const DUST_SEARCH_TRAIT_CHOICES: readonly BetrayalTraitKey[] = [
  "knowledge",
  "sanity",
];

export const DUST_CURE_TRAIT_CHOICES: readonly BetrayalTraitKey[] = [
  "might",
  "speed",
  "knowledge",
  "sanity",
];

export function isDustTraitChoice(
  choices: readonly BetrayalTraitKey[],
  trait: BetrayalTraitKey | null,
): trait is BetrayalTraitKey {
  return Boolean(trait && choices.includes(trait));
}

export interface BetrayalDustEndTurnResult {
  swaps: BetrayalDustSicknessSwapResult[];
  damagePlayerId?: string;
  damageAmount?: number;
  damageTraits?: BetrayalTraitKey[];
  defeatedPlayerId?: string;
  feverishPlayerId?: string;
}

export function resolveDustSicknessSwap(
  dust: BetrayalDustRuntimeState,
  fromPlayerId: string,
  toPlayerId: string,
  random: RandomFn,
): BetrayalDustSicknessSwapResult | null {
  const fromTokens = dust.sicknessTokensByPlayerId[fromPlayerId] ?? [];
  const toTokens = dust.sicknessTokensByPlayerId[toPlayerId] ?? [];
  if (fromTokens.length === 0 || toTokens.length === 0 || fromPlayerId === toPlayerId) {
    return null;
  }
  const fromToken = fromTokens[random.range(0, fromTokens.length - 1)] ?? fromTokens[0]!;
  const toToken = toTokens[random.range(0, toTokens.length - 1)] ?? toTokens[0]!;
  return {
    fromPlayerId,
    toPlayerId,
    fromTokenId: fromToken.id,
    toTokenId: toToken.id,
  };
}

function refreshDustTraitors(dust: BetrayalDustRuntimeState): void {
  const currentHolders = Object.entries(dust.sicknessTokensByPlayerId)
    .filter(([, tokens]) => tokens.some((token) => token.value === 1))
    .map(([playerId]) => playerId);
  dust.permanentTraitorPlayerIds = Array.from(new Set([
    ...dust.permanentTraitorPlayerIds,
    ...currentHolders,
  ]));
}

export function applyDustSicknessSwap(
  dust: BetrayalDustRuntimeState,
  swap: BetrayalDustSicknessSwapResult,
): void {
  const fromTokens = dust.sicknessTokensByPlayerId[swap.fromPlayerId] ?? [];
  const toTokens = dust.sicknessTokensByPlayerId[swap.toPlayerId] ?? [];
  const fromIndex = fromTokens.findIndex((token) => token.id === swap.fromTokenId);
  const toIndex = toTokens.findIndex((token) => token.id === swap.toTokenId);
  if (fromIndex < 0 || toIndex < 0) {
    return;
  }
  const fromToken = { ...fromTokens[fromIndex]! };
  const toToken = { ...toTokens[toIndex]! };
  const nextFromTokens = [...fromTokens];
  const nextToTokens = [...toTokens];
  nextFromTokens[fromIndex] = toToken;
  nextToTokens[toIndex] = fromToken;
  dust.sicknessTokensByPlayerId = {
    ...dust.sicknessTokensByPlayerId,
    [swap.fromPlayerId]: nextFromTokens,
    [swap.toPlayerId]: nextToTokens,
  };
  dust.exchangedSicknessThisTurnPlayerIds = Array.from(new Set([
    ...dust.exchangedSicknessThisTurnPlayerIds,
    swap.fromPlayerId,
    swap.toPlayerId,
  ]));
  refreshDustTraitors(dust);
}

function resolveSameRoomLivingExplorers(
  core: BetrayalCore,
  roomId: string,
  exceptPlayerId?: string,
): BetrayalExplorerSummary[] {
  return getAllExplorers(core).filter((explorer) => (
    explorer.playerId !== exceptPlayerId
    && explorer.roomId === roomId
    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
  ));
}

export function resolveDustEndTurn(
  core: BetrayalCore,
  random: RandomFn,
): BetrayalDustEndTurnResult | undefined {
  const dust = core.scenarioRuntime.dust;
  if (!isDustHaunt(core) || !dust || core.scenarioRuntime.deadExplorerPlayerIds.includes(core.currentExplorer.playerId)) {
    return undefined;
  }
  const previewDust = cloneDustRuntimeState(dust);
  const sameRoomExplorers = resolveSameRoomLivingExplorers(
    core,
    core.currentExplorer.roomId,
    core.currentExplorer.playerId,
  );
  const swaps: BetrayalDustSicknessSwapResult[] = [];
  for (const target of sameRoomExplorers) {
    const swap = resolveDustSicknessSwap(
      previewDust,
      core.currentExplorer.playerId,
      target.playerId,
      random,
    );
    if (!swap) {
      continue;
    }
    swaps.push(swap);
    applyDustSicknessSwap(previewDust, swap);
  }
  const alreadyExchanged = dust.exchangedSicknessThisTurnPlayerIds.includes(core.currentExplorer.playerId);
  if (swaps.length > 0 || alreadyExchanged) {
    return { swaps };
  }
  const damageDice = rollBetrayalDicePips(random, 2);
  const damageAmount = damageDice.reduce((sum, pip) => sum + pip, 0);
  const damageTraits: BetrayalTraitKey[] = ["might", "speed", "knowledge", "sanity"];
  return {
    swaps,
    damagePlayerId: core.currentExplorer.playerId,
    damageAmount,
    damageTraits,
  };
}
