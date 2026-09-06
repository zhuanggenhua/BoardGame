import type { RandomFn } from "../../engine/types";
import { countDrawnCards } from "./eventDeckModel";
import {
  findExplorerByPlayerId,
  getAllExplorers,
} from "./explorerReadModel";
import {
  findMummyMonster,
  isMummyHaunt,
  isMummyMonster,
} from "./hauntScenarioReadModel";
import {
  cloneInventoryCard,
  createDrawnCardFromTemplate,
} from "./possessionDeckModel";
import { resolveInventoryEffectId } from "./possessionEffects";
import { repeatTraitForDamage } from "./damageResolutionModel";
import {
  BETRAYAL_SCENARIO_CONFIGS,
  type BetrayalScenarioOutcome,
} from "./scenarioConfig";
import { resolveTraitDamageAssignableSteps } from "./traitTrackModel";
import type {
  BetrayalCore,
  BetrayalEndgameResult,
  BetrayalExplorerSummary,
  BetrayalInventoryCard,
  BetrayalTraitKey,
} from "./game";

const MUMMY_WEDDING_OMEN_CARD_IDS = new Set(["holy-symbol", "ring"]);

function isOmenStillInDeck(core: BetrayalCore, effectId: string): boolean {
  return core.possessionOrderByKind.omen.some(
    (card) => resolveInventoryEffectId(card.id) === effectId,
  );
}

function isOmenRevealed(core: BetrayalCore, effectId: string): boolean {
  if (!isOmenStillInDeck(core, effectId)) {
    return true;
  }
  const explorerHasOmen = getAllExplorers(core).some((explorer) => (
    explorer.inventory.some((card) => card.kind === "omen" && resolveInventoryEffectId(card.id) === effectId)
  ));
  if (explorerHasOmen) {
    return true;
  }
  const mummy = core.scenarioRuntime.mummy;
  return Boolean(
    mummy?.mummyCarriedOmenIds.some((cardId) => resolveInventoryEffectId(cardId) === effectId)
    || mummy?.mummyCarriedCards.some((card) => card.kind === "omen" && resolveInventoryEffectId(card.id) === effectId),
  );
}

function shouldMummyForceHeroBookDraw(
  core: BetrayalCore,
  actor: BetrayalExplorerSummary,
): boolean {
  return isMummyHaunt(core)
    && actor.playerId !== core.scenarioRuntime.traitorPlayerId
    && !isOmenRevealed(core, "omen-book");
}

function shouldMummyForceTraitorWeddingOmenDraw(
  core: BetrayalCore,
  actor: BetrayalExplorerSummary,
): boolean {
  return isMummyHaunt(core)
    && actor.playerId === core.scenarioRuntime.traitorPlayerId
    && [...MUMMY_WEDDING_OMEN_CARD_IDS].every((cardId) => !isOmenRevealed(core, cardId));
}

export function resolveMummyForcedOmenDraw(
  core: BetrayalCore,
  actor: BetrayalExplorerSummary,
  fallbackDrawnCard: BetrayalInventoryCard,
  random: RandomFn,
): {
  drawnCard: BetrayalInventoryCard;
  forcedOmenSearch?: {
    role: "hero-book" | "traitor-wedding-omen";
    cardId: string;
    cardName: string;
    shuffledOmenDeck: BetrayalInventoryCard[];
  };
} {
  const targetEffectIds = shouldMummyForceHeroBookDraw(core, actor)
    ? ["omen-book"]
    : shouldMummyForceTraitorWeddingOmenDraw(core, actor)
      ? [...MUMMY_WEDDING_OMEN_CARD_IDS]
      : [];
  if (targetEffectIds.length === 0) {
    return { drawnCard: fallbackDrawnCard };
  }
  const targetIndex = core.possessionOrderByKind.omen.findIndex((card) => (
    targetEffectIds.includes(resolveInventoryEffectId(card.id))
  ));
  const template = targetIndex >= 0 ? core.possessionOrderByKind.omen[targetIndex] : null;
  if (!template) {
    return { drawnCard: fallbackDrawnCard };
  }
  const drawnCard = createDrawnCardFromTemplate(core, template);
  const remainingDeck = core.possessionOrderByKind.omen
    .filter((_, index) => index !== targetIndex)
    .map(cloneInventoryCard);
  const role = resolveInventoryEffectId(template.id) === "omen-book"
    ? "hero-book"
    : "traitor-wedding-omen";
  return {
    drawnCard,
    forcedOmenSearch: {
      role,
      cardId: drawnCard.id,
      cardName: drawnCard.name,
      shuffledOmenDeck: random.shuffle(remainingDeck).map(cloneInventoryCard),
    },
  };
}

function isMummyWeddingOmenCard(card: BetrayalInventoryCard): boolean {
  const normalizedName = card.name.trim().toLowerCase();
  return card.kind === "omen"
    && (
      MUMMY_WEDDING_OMEN_CARD_IDS.has(resolveInventoryEffectId(card.id))
      || card.name === "圣符"
      || card.name === "指环"
      || normalizedName === "holy symbol"
      || normalizedName === "ring"
    );
}

export function findMummyWeddingOmenCard(
  explorer: BetrayalExplorerSummary | null | undefined,
  cardId?: string,
): BetrayalInventoryCard | null {
  const cards = explorer?.inventory.filter(isMummyWeddingOmenCard) ?? [];
  if (cardId) {
    return cards.find((card) => card.id === cardId) ?? null;
  }
  return cards[0] ?? null;
}

export function resolveMummyForcedDamageTraits(
  explorer: BetrayalExplorerSummary,
  amount: number,
  options: { allowSkull?: boolean } = {},
): BetrayalTraitKey[] {
  const sequence: BetrayalTraitKey[] = [];
  const speedSteps = resolveTraitDamageAssignableSteps(explorer, "speed", options);
  const mightSteps = resolveTraitDamageAssignableSteps(explorer, "might", options);
  const speedDamage = Math.min(amount, speedSteps);
  const mightDamage = Math.min(Math.max(0, amount - speedDamage), mightSteps);
  sequence.push(...repeatTraitForDamage("speed", speedDamage));
  sequence.push(...repeatTraitForDamage("might", mightDamage));
  return sequence;
}

export function collectMummyGirlByExplorerIfPresent(
  core: BetrayalCore,
  playerId: string,
  roomId: string,
): boolean {
  const mummy = core.scenarioRuntime.mummy;
  if (
    !isMummyHaunt(core)
    || !mummy
    || mummy.girlRoomId !== roomId
    || mummy.girlHolderPlayerId
    || mummy.girlHeldByMummy
    || core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)
  ) {
    return false;
  }
  mummy.girlRoomId = null;
  mummy.girlHolderPlayerId = playerId;
  mummy.girlHeldByMummy = false;
  return true;
}

export function collectMummyGirlByMummyIfPresent(
  core: BetrayalCore,
  monsterId: string,
  roomId: string,
): boolean {
  const mummy = core.scenarioRuntime.mummy;
  if (
    !isMummyMonster(core, monsterId)
    || !mummy
    || mummy.girlRoomId !== roomId
    || mummy.girlHolderPlayerId
    || mummy.girlHeldByMummy
  ) {
    return false;
  }
  mummy.girlRoomId = null;
  mummy.girlHolderPlayerId = null;
  mummy.girlHeldByMummy = true;
  return true;
}

export function createMummyEndgameResult(
  core: BetrayalCore,
  outcome: "survivors" | "traitor",
): BetrayalEndgameResult {
  const livingHeroes = getAllExplorers(core)
    .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)
    .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId));
  const traitor = findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer) ?? core.currentExplorer;
  const winners = outcome === "survivors"
    ? livingHeroes.map((explorer) => explorer.playerId)
    : [traitor.playerId];
  const scenario = BETRAYAL_SCENARIO_CONFIGS[core.scenarioId];
  return {
    hauntId: "mummy-rampage",
    hauntTitle: "木乃伊横行",
    outcome: outcome satisfies BetrayalScenarioOutcome,
    winners,
    traitorPlayerId: traitor.playerId,
    survivorsEscaped: outcome === "survivors" ? [...winners] : [],
    reward: {
      stars: outcome === "survivors" ? scenario.completion.reward.stars : 0,
      omens: countDrawnCards(core, "omen"),
      logs: outcome === "survivors" ? scenario.completion.reward.logs : 0,
    },
    stats: {
      roomsExplored: core.rooms.filter((room) => room.state === "discovered").length,
      omensDrawn: countDrawnCards(core, "omen"),
      itemsDrawn: countDrawnCards(core, "item"),
      eventsDrawn: countDrawnCards(core, "event"),
    },
  };
}

export function canCompleteMummyTraitorVictory(core: BetrayalCore): boolean {
  const mummy = core.scenarioRuntime.mummy;
  const mummyMonster = findMummyMonster(core);
  return Boolean(
    isMummyHaunt(core)
    && mummy
    && mummyMonster
    && mummy.girlHeldByMummy
    && mummyMonster.roomId === mummy.sarcophagusRoomId
    && mummy.mummyCarriedOmenIds.some((cardId) => (
      MUMMY_WEDDING_OMEN_CARD_IDS.has(resolveInventoryEffectId(cardId))
    )),
  );
}
