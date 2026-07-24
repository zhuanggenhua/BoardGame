import type {
  AiActionDecision,
  AiDecisionContext,
  AiDifficultyLevel,
  AiLegalAction,
  BuildGameAiFeatureSnapshotArgs,
  BuildGameAiLegalActionsArgs,
  GameAiRuntime,
  LocalAiActionScorer,
  LocalAiPolicy,
} from "../../engine/ai";
import {
  createAiLegalActionId,
  buildDeterministicAiNoise,
  createLookaheadLocalAiPolicy,
  evaluateLocalAiActions,
} from "../../engine/ai";
import { SplendorDomain } from "./domain";
import type {
  CardTier,
  GemColor,
  SplendorCardDef,
  SplendorCommand,
  SplendorCore,
  SplendorPlayerState,
  TokenColor,
} from "./domain/types";
import { SPLENDOR_COMMANDS } from "./domain/types";
import {
  CARD_DEFS_BY_ID,
  CARD_TIERS,
  GEM_COLORS,
  NOBLE_DEFS_BY_ID,
  MAX_RESERVED_CARDS,
  calculateDiscounts,
  calculateEffectiveCost,
  canAffordCard,
  getBankForPlayerCount,
  hasAnyStandardTurnAction,
  getMissingColors,
  getMissingTokenCount,
  getMissingNobleRequirementCount,
  getTokenCount,
} from "./domain/rules";
import type { LocalAiActionEvaluation } from "../../engine/ai/types";
import type { MatchState, RandomFn } from "../../engine/types";

type SplendorState = MatchState<SplendorCore>;
type GamePhase = "opening" | "development" | "endgame";
type SplendorPendingResolutionType = "discardToLimit" | "chooseNoble";

const AI_NOOP_RANDOM: RandomFn = {
  random: () => 0.5,
  d: (max: number) => Math.max(1, Math.ceil(max / 2)),
  range: (min: number, max: number) => Math.floor((min + max) / 2),
  shuffle: <T>(array: T[]) => [...array],
};

export const AI_ACTION_KINDS = {
  TAKE_THREE: "take-three",
  TAKE_TWO: "take-two",
  RESERVE_OPEN: "reserve-open",
  RESERVE_DECK: "reserve-deck",
  BUY_OPEN: "buy-open",
  BUY_RESERVED: "buy-reserved",
  DISCARD: "discard",
  CHOOSE_NOBLE: "choose-noble",
  PASS_TURN: "pass-turn",
} as const;

// --- Scoring weights ---
const W_POINTS = 100;
const W_BUY_BASE = 20;
const W_TIER_BONUS = 10;
const W_NOBLE_ALIGN = 80;
const W_CHEAP_BUY = 30;
const W_CHEAP_COST_FACTOR = 3;
const W_GEM_IMPORTANCE_TIER = 10;
const W_TAKE_TWO_BONUS = 10;
const W_RESERVE_POINTS = 30;
const W_RESERVE_CLOSE_2 = 40;
const W_RESERVE_CLOSE_4 = 20;
const W_RESERVE_TIER = 15;
const W_DECK_TIER = 10;
const W_DECK_BASE = 5;
const W_EVAL_NOBLE_BASE = 30;
const W_EVAL_NOBLE_MISSING = 5;

// --- Difficulty configuration ---

interface SplendorDifficultyConfig {
  /** 购买卡牌时分数权重倍率 */
  pointsMultiplier: number;
  /** 贵族对齐权重倍率 */
  nobleMultiplier: number;
  /** 对手威胁权重 (0 = 不考虑对手) */
  opponentThreatWeight: number;
  /** 终局加速：接近 15 分时直接得分额外加权 */
  endgamePointsBonus: number;
  /** 终局触发分数阈值 */
  endgameThreshold: number;
  /** 保留卡用于卡人的权重 */
  blockReserveWeight: number;
  /** 目标卡考虑数量 (影响拿宝石决策的前瞻范围) */
  targetCardCount: number;
  /** 红利价值权重 */
  bonusValueWeight: number;
  /** 投影分值倍率 */
  projectionScale: number;
  /** 动作后链式购买奖励权重 */
  chainWeight: number;
  /** 干扰对手节奏的额外权重 */
  threatProjectionWeight: number;
  /** 预留位占用惩罚 */
  reserveSlotPenalty: number;
  /** 盲抽预留的期望价值 */
  deckReserveValue: number;
  /** 稀缺资源加权 */
  scarcityWeight: number;
  /** 溢出/丢弃惩罚权重 */
  overflowPenaltyWeight: number;
  /** 预留时黄金基础价值 */
  reserveGoldBase: number;
  /** 已预留目标卡偏置 */
  reservedTargetBias: number;
  /** 专家 follow-up 折扣 */
  expertFollowUpDiscount: number;
}

const DIFFICULTY_CONFIGS: Record<AiDifficultyLevel, SplendorDifficultyConfig> =
  {
    easy: {
      pointsMultiplier: 0.9,
      nobleMultiplier: 0.15,
      opponentThreatWeight: 0,
      endgamePointsBonus: 0,
      endgameThreshold: 15,
      blockReserveWeight: 0,
      targetCardCount: 4,
      bonusValueWeight: 0.45,
      projectionScale: 0.14,
      chainWeight: 0.6,
      threatProjectionWeight: 0,
      reserveSlotPenalty: 12,
      deckReserveValue: 10,
      scarcityWeight: 0.6,
      overflowPenaltyWeight: 0.75,
      reserveGoldBase: 48,
      reservedTargetBias: 12,
      expertFollowUpDiscount: 0,
    },
    normal: {
      pointsMultiplier: 1.15,
      nobleMultiplier: 0.8,
      opponentThreatWeight: 20,
      endgamePointsBonus: 40,
      endgameThreshold: 12,
      blockReserveWeight: 10,
      targetCardCount: 8,
      bonusValueWeight: 1.0,
      projectionScale: 0.2,
      chainWeight: 0.85,
      threatProjectionWeight: 0.5,
      reserveSlotPenalty: 15,
      deckReserveValue: 13,
      scarcityWeight: 0.9,
      overflowPenaltyWeight: 0.95,
      reserveGoldBase: 52,
      reservedTargetBias: 16,
      expertFollowUpDiscount: 0,
    },
    hard: {
      pointsMultiplier: 1.45,
      nobleMultiplier: 1.35,
      opponentThreatWeight: 90,
      endgamePointsBonus: 120,
      endgameThreshold: 9,
      blockReserveWeight: 55,
      targetCardCount: 16,
      bonusValueWeight: 1.75,
      projectionScale: 0.3,
      chainWeight: 1.05,
      threatProjectionWeight: 1.25,
      reserveSlotPenalty: 24,
      deckReserveValue: 20,
      scarcityWeight: 1.15,
      overflowPenaltyWeight: 1.15,
      reserveGoldBase: 56,
      reservedTargetBias: 24,
      expertFollowUpDiscount: 0.45,
    },
    expert: {
      pointsMultiplier: 1.95,
      nobleMultiplier: 1.5,
      opponentThreatWeight: 110,
      endgamePointsBonus: 420,
      endgameThreshold: 7,
      blockReserveWeight: 68,
      targetCardCount: 24,
      bonusValueWeight: 2.15,
      projectionScale: 1.65,
      chainWeight: 2.6,
      threatProjectionWeight: 1.45,
      reserveSlotPenalty: 36,
      deckReserveValue: 18,
      scarcityWeight: 1.25,
      overflowPenaltyWeight: 1.25,
      reserveGoldBase: 60,
      reservedTargetBias: 28,
      expertFollowUpDiscount: 0.85,
    },
  };

function getDifficultyConfig(
  context: AiDecisionContext,
): SplendorDifficultyConfig {
  return (
    DIFFICULTY_CONFIGS[context.difficulty.level] ?? DIFFICULTY_CONFIGS.normal
  );
}

function isGemColor(value: unknown): value is GemColor {
  return (
    typeof value === "string" &&
    (GEM_COLORS as readonly string[]).includes(value)
  );
}

function resolveScorerContext(
  context: AiDecisionContext,
): { core: SplendorCore; player: SplendorPlayerState } | null {
  const state = context.visibleState as SplendorState;
  const core = state.core;
  const player = core.players[context.playerId];
  if (!player) return null;
  return { core, player };
}

function createTakeThreeAction(colors: GemColor[]): AiLegalAction {
  const sortedColors = [...colors].sort();
  return {
    actionId: createAiLegalActionId(
      AI_ACTION_KINDS.TAKE_THREE,
      sortedColors.join("-"),
    ),
    kind: AI_ACTION_KINDS.TAKE_THREE,
    label: `拿取3枚不同宝石: ${sortedColors.join(", ")}`,
    commands: [
      {
        type: SPLENDOR_COMMANDS.TAKE_THREE_DIFFERENT_GEMS,
        payload: { colors: sortedColors },
      },
    ],
    metadata: { colors: sortedColors },
  };
}

function createTakeTwoAction(color: GemColor): AiLegalAction {
  return {
    actionId: createAiLegalActionId(AI_ACTION_KINDS.TAKE_TWO, color),
    kind: AI_ACTION_KINDS.TAKE_TWO,
    label: `拿取2枚${color}宝石`,
    commands: [
      {
        type: SPLENDOR_COMMANDS.TAKE_TWO_SAME_GEMS,
        payload: { color },
      },
    ],
    metadata: { color },
  };
}

function createReserveOpenAction(
  tier: CardTier,
  cardId: string,
): AiLegalAction {
  return {
    actionId: createAiLegalActionId(
      AI_ACTION_KINDS.RESERVE_OPEN,
      `t${tier}`,
      cardId,
    ),
    kind: AI_ACTION_KINDS.RESERVE_OPEN,
    label: `预留公开卡牌 ${cardId}`,
    commands: [
      {
        type: SPLENDOR_COMMANDS.RESERVE_OPEN_CARD,
        payload: { tier, cardId },
      },
    ],
    metadata: { tier, cardId },
  };
}

function createReserveDeckAction(tier: CardTier): AiLegalAction {
  return {
    actionId: createAiLegalActionId(AI_ACTION_KINDS.RESERVE_DECK, `t${tier}`),
    kind: AI_ACTION_KINDS.RESERVE_DECK,
    label: `预留牌堆${tier}层顶牌`,
    commands: [
      {
        type: SPLENDOR_COMMANDS.RESERVE_DECK_TOP_CARD,
        payload: { tier },
      },
    ],
    metadata: { tier },
  };
}

function createBuyOpenAction(tier: CardTier, cardId: string): AiLegalAction {
  return {
    actionId: createAiLegalActionId(
      AI_ACTION_KINDS.BUY_OPEN,
      `t${tier}`,
      cardId,
    ),
    kind: AI_ACTION_KINDS.BUY_OPEN,
    label: `购买公开卡牌 ${cardId}`,
    commands: [
      {
        type: SPLENDOR_COMMANDS.BUY_OPEN_CARD,
        payload: { tier, cardId },
      },
    ],
    metadata: { tier, cardId },
  };
}

function createBuyReservedAction(cardId: string): AiLegalAction {
  return {
    actionId: createAiLegalActionId(AI_ACTION_KINDS.BUY_RESERVED, cardId),
    kind: AI_ACTION_KINDS.BUY_RESERVED,
    label: `购买预留卡牌 ${cardId}`,
    commands: [
      {
        type: SPLENDOR_COMMANDS.BUY_RESERVED_CARD,
        payload: { cardId },
      },
    ],
    metadata: { cardId },
  };
}

function createDiscardAction(color: TokenColor): AiLegalAction {
  return {
    actionId: createAiLegalActionId(AI_ACTION_KINDS.DISCARD, color),
    kind: AI_ACTION_KINDS.DISCARD,
    label: `丢弃1枚${color}宝石`,
    commands: [
      {
        type: SPLENDOR_COMMANDS.DISCARD_GEMS_TO_LIMIT,
        payload: { color },
      },
    ],
    metadata: { color },
  };
}

function createChooseNobleAction(nobleId: string): AiLegalAction {
  return {
    actionId: createAiLegalActionId(AI_ACTION_KINDS.CHOOSE_NOBLE, nobleId),
    kind: AI_ACTION_KINDS.CHOOSE_NOBLE,
    label: `选择贵族 ${nobleId}`,
    commands: [
      {
        type: SPLENDOR_COMMANDS.CHOOSE_NOBLE,
        payload: { nobleId },
      },
    ],
    metadata: { nobleId },
  };
}

function createPassTurnAction(): AiLegalAction {
  return {
    actionId: createAiLegalActionId(AI_ACTION_KINDS.PASS_TURN, "no-standard-action"),
    kind: AI_ACTION_KINDS.PASS_TURN,
    label: "无可执行动作，跳过当前玩家",
    commands: [
      {
        type: SPLENDOR_COMMANDS.PASS_TURN,
        payload: {},
      },
    ],
    metadata: { reason: "no-standard-action" },
  };
}

function getAvailableGemColors(bank: Record<TokenColor, number>): GemColor[] {
  return GEM_COLORS.filter((color) => bank[color] > 0);
}

function generateThreeColorCombos(available: GemColor[]): GemColor[][] {
  const combos: GemColor[][] = [];
  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      for (let k = j + 1; k < available.length; k++) {
        combos.push([available[i], available[j], available[k]]);
      }
    }
  }
  return combos;
}

function getCardDef(cardId: string) {
  const card = CARD_DEFS_BY_ID[cardId];
  if (card) return card;
  const hiddenTier = parseHiddenDeckTier(cardId);
  if (!hiddenTier) return null;
  const expected = HIDDEN_DECK_EXPECTED_CARD_BY_TIER[hiddenTier];
  return expected ? { ...expected, id: cardId } : null;
}

function parseHiddenDeckTier(cardId: string): CardTier | null {
  const matched = /^hidden-deck-(1|2|3)-\d+$/.exec(cardId);
  if (!matched) return null;
  return Number(matched[1]) as CardTier;
}

function isHiddenDeckPlaceholderId(cardId: string): boolean {
  return parseHiddenDeckTier(cardId) !== null;
}

function createHiddenDeckExpectedCardsByTier(): Record<CardTier, SplendorCardDef> {
  const cardsByTier: Record<CardTier, SplendorCardDef[]> = {
    1: [],
    2: [],
    3: [],
  };
  for (const card of Object.values(CARD_DEFS_BY_ID)) {
    cardsByTier[card.tier].push(card);
  }

  const expectedCards = {} as Record<CardTier, SplendorCardDef>;
  for (const tier of CARD_TIERS) {
    const cards = cardsByTier[tier];
    const count = Math.max(1, cards.length);
    const averageCost = createGemColorRecord();
    const bonusFrequency = createGemColorRecord();
    let pointSum = 0;

    for (const card of cards) {
      pointSum += card.points;
      bonusFrequency[card.bonus] += 1;
      for (const color of GEM_COLORS) {
        averageCost[color] += card.cost[color];
      }
    }

    for (const color of GEM_COLORS) {
      averageCost[color] = roundScore(averageCost[color] / count);
    }

    const bonus = [...GEM_COLORS].sort(
      (left, right) => bonusFrequency[right] - bonusFrequency[left],
    )[0];
    expectedCards[tier] = {
      id: `hidden-deck-expected-t${tier}`,
      name: `hidden-deck-expected-t${tier}`,
      tier,
      points: roundScore(pointSum / count),
      bonus,
      cost: averageCost,
    };
  }

  return expectedCards;
}

const HIDDEN_DECK_EXPECTED_CARD_BY_TIER = createHiddenDeckExpectedCardsByTier();

interface SplendorCardInsight {
  cardId: string;
  tier: CardTier;
  points: number;
  bonus: GemColor;
  missingTokens: number;
  missingColors: GemColor[];
  nobleRelevance: number;
  bonusDemand: number;
  utility: number;
  affordable: boolean;
}

interface SplendorOpponentThreatSnapshot {
  playerId: string;
  points: number;
  imminentEndgame: boolean;
  buyableOpenCardIds: string[];
  closeOpenCardIds: string[];
  keyNeededColors: GemColor[];
  topThreatCardId: string | null;
  topThreatValue: number;
}

interface SplendorFeatureSnapshot {
  marketCards: SplendorCardInsight[];
  reservedCards: SplendorCardInsight[];
  cardById: Record<string, SplendorCardInsight>;
  targetCards: SplendorCardInsight[];
  demandByColor: Record<GemColor, number>;
  nobleNeedByColor: Record<GemColor, number>;
  opponentThreats: SplendorOpponentThreatSnapshot[];
  hotColors: GemColor[];
  discountsByColor: Record<GemColor, number>;
  bankScarcityByColor: Record<GemColor, number>;
  gamePhase: GamePhase;
  tokenOverflowRisk: number;
  reserveSlotPressure: number;
  nobleGapById: Record<string, number>;
  mostDangerousOpponentId: string | null;
  topTargetCardIds: string[];
}

interface SplendorProjectedPlayerState {
  nextState: SplendorState;
  nextPlayer: SplendorPlayerState;
  legalActions: AiLegalAction[];
  featureSnapshot: SplendorFeatureSnapshot | null;
  pendingResolutionType: SplendorPendingResolutionType | null;
}

interface SplendorOpportunitySummary {
  affordableCount: number;
  closeCount: number;
  topAffordableUtility: number;
  topCloseUtility: number;
  topFutureUtility: number;
}

interface SplendorProjectionCandidateLoopConfig {
  maxIterations: number;
  batchSize: number;
  stopOnUtility: number;
}

/** Builds a gem-color keyed record for cheap derived-state accumulation. */
function createGemColorRecord(initialValue = 0): Record<GemColor, number> {
  return {
    white: initialValue,
    blue: initialValue,
    green: initialValue,
    red: initialValue,
    black: initialValue,
  };
}

/** Builds a token-color keyed record, including gold. */
function createTokenColorRecord(initialValue = 0): Record<TokenColor, number> {
  return {
    white: initialValue,
    blue: initialValue,
    green: initialValue,
    red: initialValue,
    black: initialValue,
    gold: initialValue,
  };
}

/** Rounds internal heuristic scores to keep traces stable and compact. */
function roundScore(value: number): number {
  return Number(value.toFixed(3));
}

/** Maps the visible scoreboard to a coarse strategic phase. */
function getGamePhase(core: SplendorCore): GamePhase {
  const maxScore = Math.max(
    ...Object.values(core.players).map((player) => player.points),
  );
  if (maxScore >= 11) return "endgame";
  if (maxScore >= 5) return "development";
  return "opening";
}

/** Returns phase multipliers used by buy/bonus heuristics. */
function getPhaseWeights(phase: GamePhase): { points: number; bonus: number } {
  if (phase === "opening") return { points: 0.5, bonus: 1.5 };
  if (phase === "endgame") return { points: 2.0, bonus: 0.3 };
  return { points: 1.0, bonus: 1.0 };
}

/** Estimates how scarce a gem color currently is relative to its initial bank size. */
function calcGemScarcity(color: GemColor, core: SplendorCore): number {
  const maxBank = getBankForPlayerCount(core.setupPlayerCount)[color];
  if (maxBank <= 0) return 0;
  return roundScore(1 - core.bank[color] / maxBank);
}

/** Precomputes scarcity for every gem color in the visible bank. */
function buildBankScarcityByColor(
  core: SplendorCore,
): Record<GemColor, number> {
  const scarcity = createGemColorRecord();
  for (const color of GEM_COLORS) {
    scarcity[color] = calcGemScarcity(color, core);
  }
  return scarcity;
}

/** Computes each visible noble's remaining discount gap for the acting player. */
function buildNobleGapById(
  core: SplendorCore,
  player: SplendorPlayerState,
): Record<string, number> {
  const gaps: Record<string, number> = {};
  for (const nobleId of core.nobleIds) {
    const noble = NOBLE_DEFS_BY_ID[nobleId];
    if (!noble) continue;
    gaps[nobleId] = getMissingNobleRequirementCount(player, noble);
  }
  return gaps;
}

/** Projects the remaining gap to a noble after buying one more card of `addedColor`. */
function calcNobleGapAfterBuy(
  nobleId: string,
  player: SplendorPlayerState,
  addedColor: GemColor,
): number {
  const noble = NOBLE_DEFS_BY_ID[nobleId];
  if (!noble) return 0;
  const discounts = calculateDiscounts(player);
  discounts[addedColor] += 1;
  let gap = 0;
  for (const color of GEM_COLORS) {
    gap += Math.max(0, noble.requirement[color] - discounts[color]);
  }
  return gap;
}

/** Compresses continuous noble pressure into a per-bonus-color demand score. */
function buildNobleNeedByColor(
  core: SplendorCore,
  player: SplendorPlayerState,
  nobleGapById: Record<string, number>,
): Record<GemColor, number> {
  const discounts = calculateDiscounts(player);
  const needByColor = createGemColorRecord();
  for (const nobleId of core.nobleIds) {
    const noble = NOBLE_DEFS_BY_ID[nobleId];
    if (!noble) continue;
    const totalGap = nobleGapById[nobleId] ?? 0;
    const gapWeight =
      totalGap <= 0 ? 0 : Math.max(4, 32 * Math.pow(0.62, totalGap));
    for (const color of GEM_COLORS) {
      if (noble.requirement[color] <= discounts[color]) continue;
      needByColor[color] += gapWeight;
    }
  }
  return needByColor;
}

/** Aggregates how much the visible market cares about each bonus color. */
function buildDemandByColor(core: SplendorCore): Record<GemColor, number> {
  const demandByColor = createGemColorRecord();
  for (const tier of CARD_TIERS) {
    for (const cardId of core.market[tier]) {
      const card = getCardDef(cardId);
      if (!card) continue;
      const weight = 1 + card.points * 0.8 + card.tier * 0.5;
      for (const color of GEM_COLORS) {
        if (card.cost[color] > 0) {
          demandByColor[color] += card.cost[color] * weight;
        }
      }
    }
  }
  return demandByColor;
}

/** Scores a card as a medium-term target using visible-only state. */
function computeCardUtility(args: {
  player: SplendorPlayerState;
  card: NonNullable<ReturnType<typeof getCardDef>>;
  demandByColor: Record<GemColor, number>;
  nobleNeedByColor: Record<GemColor, number>;
}): number {
  const { player, card, demandByColor, nobleNeedByColor } = args;
  const missingTokens = getMissingTokenCount(player, card);
  const missingColors = getMissingColors(player, card);
  const readinessBonus =
    missingTokens === 0
      ? 34
      : missingTokens === 1
        ? 18
        : missingTokens === 2
          ? 8
          : 0;
  const bonusDemand = (demandByColor[card.bonus] ?? 0) * 2.4;
  const nobleRelevance = (nobleNeedByColor[card.bonus] ?? 0) * 1.1;
  const hiddenCardPenalty = isHiddenDeckPlaceholderId(card.id) ? 0.72 : 1;
  const rawScore =
    card.points * 95 +
    (card.tier - 1) * 8 +
    bonusDemand +
    nobleRelevance +
    readinessBonus -
    missingTokens * 16 -
    missingColors.length * 5;
  return roundScore(Math.max(0, rawScore * hiddenCardPenalty));
}

/** Adds a configurable bias so already-reserved cards stay on the AI's target list. */
function getTargetPriority(
  insight: SplendorCardInsight,
  player: SplendorPlayerState,
  config: SplendorDifficultyConfig,
): number {
  return (
    insight.utility +
    (player.reservedCardIds.includes(insight.cardId)
      ? config.reservedTargetBias
      : 0)
  );
}

/** Returns the top-scoring target cards after applying reserved-card bias. */
function getScoringTargetCards(
  snapshot: SplendorFeatureSnapshot | null,
  player: SplendorPlayerState,
  config: SplendorDifficultyConfig,
): SplendorCardInsight[] {
  const source = snapshot
    ? [...snapshot.marketCards, ...snapshot.reservedCards]
    : [];
  return source
    .sort(
      (left, right) =>
        getTargetPriority(right, player, config) -
        getTargetPriority(left, player, config),
    )
    .slice(0, config.targetCardCount);
}

/** Measures how much an action shortens the gap to the current target set. */
function calcTargetImprovement(args: {
  beforePlayer: SplendorPlayerState;
  afterPlayer: SplendorPlayerState;
  targetCards: SplendorCardInsight[];
}): number {
  let bestDelta = 0;
  let totalDelta = 0;

  for (const target of args.targetCards) {
    const card = getCardDef(target.cardId);
    if (!card) continue;
    const beforeGap = getMissingTokenCount(args.beforePlayer, card);
    const afterGap = getMissingTokenCount(args.afterPlayer, card);
    const delta = Math.max(0, beforeGap - afterGap);
    bestDelta = Math.max(bestDelta, delta);
    totalDelta += delta;
    if (beforeGap > 0 && afterGap <= 0) {
      totalDelta += 2 + card.points * 0.5;
    }
  }

  return roundScore(bestDelta * 12 + totalDelta * 4);
}

/** Values the wildcard gold gained from reserving while accounting for diminishing returns. */
function calcReserveGoldValue(
  core: SplendorCore,
  player: SplendorPlayerState,
  config: SplendorDifficultyConfig,
): number {
  if (core.bank.gold <= 0) return 0;
  const decayFactor = Math.max(0, 1 - player.tokens.gold * 0.22);
  return roundScore(config.reserveGoldBase * decayFactor);
}

/** Scores each token as a discard candidate; higher means safer to throw away. */
function buildDiscardPreference(args: {
  core: SplendorCore;
  player: SplendorPlayerState;
  snapshot: SplendorFeatureSnapshot | null;
  config: SplendorDifficultyConfig;
}): Record<TokenColor, number> {
  const { core, player, snapshot, config } = args;
  const discardScores = createTokenColorRecord(0);
  const targetCards = getScoringTargetCards(snapshot, player, config);
  const demandByColor = snapshot?.demandByColor ?? buildDemandByColor(core);

  for (const color of GEM_COLORS) {
    const held = player.tokens[color];
    const targetNeed = targetCards.reduce((sum, target) => {
      const card = getCardDef(target.cardId);
      if (!card) return sum;
      const effectiveCost = calculateEffectiveCost(player, card);
      return sum + Math.max(0, effectiveCost[color] - player.tokens[color]);
    }, 0);
    const scarcity =
      snapshot?.bankScarcityByColor[color] ?? calcGemScarcity(color, core);
    discardScores[color] = roundScore(
      held * 18 -
        targetNeed * 22 -
        demandByColor[color] * 0.45 -
        scarcity * config.scarcityWeight * 20 -
        (snapshot?.discountsByColor[color] ?? 0) * 1.5,
    );
  }

  discardScores.gold = roundScore(-220 - player.tokens.gold * 10);
  return discardScores;
}

/** Estimates how painful token overflow will be after selecting the best available discards. */
function calcOverflowPenalty(args: {
  core: SplendorCore;
  player: SplendorPlayerState;
  snapshot: SplendorFeatureSnapshot | null;
  config: SplendorDifficultyConfig;
}): number {
  const overflow = Math.max(0, getTokenCount(args.player) - 10);
  if (overflow <= 0) return 0;

  const preference = buildDiscardPreference(args);
  const rankedTokens: Array<{ color: TokenColor; score: number }> = [];
  for (const color of [...GEM_COLORS, "gold" as const]) {
    for (let count = 0; count < args.player.tokens[color]; count += 1) {
      rankedTokens.push({ color, score: preference[color] });
    }
  }

  rankedTokens.sort((left, right) => right.score - left.score);
  return roundScore(
    rankedTokens
      .slice(0, overflow)
      .reduce(
        (sum, token) => sum + Math.max(0, 60 - token.score),
        overflow * 12,
      ),
  );
}

function buildCardInsight(args: {
  player: SplendorPlayerState;
  cardId: string;
  demandByColor: Record<GemColor, number>;
  nobleNeedByColor: Record<GemColor, number>;
}): SplendorCardInsight | null {
  const card = getCardDef(args.cardId);
  if (!card) return null;
  const missingTokens = getMissingTokenCount(args.player, card);
  const missingColors = getMissingColors(args.player, card);
  const nobleRelevance = args.nobleNeedByColor[card.bonus] ?? 0;
  const bonusDemand = args.demandByColor[card.bonus] ?? 0;
  return {
    cardId: args.cardId,
    tier: card.tier,
    points: card.points,
    bonus: card.bonus,
    missingTokens,
    missingColors,
    nobleRelevance,
    bonusDemand,
    utility: computeCardUtility({
      player: args.player,
      card,
      demandByColor: args.demandByColor,
      nobleNeedByColor: args.nobleNeedByColor,
    }),
    affordable: canAffordCard(args.player, card),
  };
}

function computeThreatValue(
  opponent: SplendorPlayerState,
  card: NonNullable<ReturnType<typeof getCardDef>>,
): number {
  const missingTokens = getMissingTokenCount(opponent, card);
  const proximityBonus =
    missingTokens <= 0
      ? 56
      : missingTokens === 1
        ? 34
        : missingTokens === 2
          ? 16
          : 0;
  const endgameBonus = opponent.points >= 11 && card.points > 0 ? 28 : 0;
  return roundScore(
    card.points * 44 + card.tier * 12 + proximityBonus + endgameBonus,
  );
}

function buildOpponentThreatSnapshot(
  core: SplendorCore,
  opponentId: string,
): SplendorOpponentThreatSnapshot | null {
  const opponent = core.players[opponentId];
  if (!opponent) return null;

  const keyNeededColors = new Set<GemColor>();
  const buyableOpenCardIds: string[] = [];
  const closeOpenCardIds: string[] = [];
  let topThreatCardId: string | null = null;
  let topThreatValue = 0;

  for (const tier of CARD_TIERS) {
    for (const cardId of core.market[tier]) {
      const card = getCardDef(cardId);
      if (!card) continue;
      const missingTokens = getMissingTokenCount(opponent, card);
      if (missingTokens <= 0) {
        buyableOpenCardIds.push(cardId);
      }
      if (missingTokens <= 2) {
        closeOpenCardIds.push(cardId);
        for (const color of getMissingColors(opponent, card)) {
          keyNeededColors.add(color);
        }
      }

      const threatValue = computeThreatValue(opponent, card);
      if (threatValue > topThreatValue) {
        topThreatValue = threatValue;
        topThreatCardId = cardId;
      }
    }
  }

  return {
    playerId: opponentId,
    points: opponent.points,
    imminentEndgame: opponent.points >= 11,
    buyableOpenCardIds,
    closeOpenCardIds,
    keyNeededColors: [...keyNeededColors],
    topThreatCardId,
    topThreatValue,
  };
}

function getOpponentThreats(
  core: SplendorCore,
  playerId: string,
  snapshot?: SplendorFeatureSnapshot | null,
): SplendorOpponentThreatSnapshot[] {
  return (
    snapshot?.opponentThreats ??
    (() => {
      const opponents = Object.entries(core.players).filter(
        ([oppId]) => oppId !== playerId,
      );
      return opponents
        .map(([oppId]) => buildOpponentThreatSnapshot(core, oppId))
        .filter(
          (item): item is SplendorOpponentThreatSnapshot => item !== null,
        );
    })()
  );
}

function buildSplendorFeatureSnapshot(
  args: BuildGameAiFeatureSnapshotArgs,
): SplendorFeatureSnapshot | null {
  const state = args.state as SplendorState;
  const core = state.core;
  const player = core.players[args.playerId];
  if (!player) return null;

  const gamePhase = getGamePhase(core);
  const discountsByColor = calculateDiscounts(player);
  const nobleGapById = buildNobleGapById(core, player);
  const demandByColor = buildDemandByColor(core);
  const nobleNeedByColor = buildNobleNeedByColor(core, player, nobleGapById);
  const bankScarcityByColor = buildBankScarcityByColor(core);
  const marketCards = CARD_TIERS.flatMap((tier) => core.market[tier])
    .map((cardId) =>
      buildCardInsight({ player, cardId, demandByColor, nobleNeedByColor }),
    )
    .filter((item): item is SplendorCardInsight => item !== null);
  const reservedCards = player.reservedCardIds
    .map((cardId) =>
      buildCardInsight({ player, cardId, demandByColor, nobleNeedByColor }),
    )
    .filter((item): item is SplendorCardInsight => item !== null);
  const cardById = Object.fromEntries(
    [...marketCards, ...reservedCards].map((insight) => [
      insight.cardId,
      insight,
    ]),
  ) as Record<string, SplendorCardInsight>;
  const targetCards = [...marketCards, ...reservedCards]
    .sort((left, right) => right.utility - left.utility);
  const opponentThreats = getOpponentThreats(core, args.playerId);
  const hotColors = [...GEM_COLORS].sort(
    (left, right) => demandByColor[right] - demandByColor[left],
  );
  const mostDangerousOpponentId =
    opponentThreats.sort(
      (left, right) => right.topThreatValue - left.topThreatValue,
    )[0]?.playerId ?? null;

  return {
    marketCards,
    reservedCards,
    cardById,
    targetCards,
    demandByColor,
    nobleNeedByColor,
    opponentThreats,
    hotColors,
    discountsByColor,
    bankScarcityByColor,
    gamePhase,
    tokenOverflowRisk: Math.max(0, getTokenCount(player) - 8),
    reserveSlotPressure: roundScore(
      player.reservedCardIds.length / MAX_RESERVED_CARDS,
    ),
    nobleGapById,
    mostDangerousOpponentId,
    topTargetCardIds: targetCards.map((card) => card.cardId),
  };
}

/** Reads the current Splendor feature snapshot from the AI decision context. */
function getSplendorFeatureSnapshot(
  context: AiDecisionContext,
): SplendorFeatureSnapshot | null {
  const snapshot = context.featureSnapshot as
    | SplendorFeatureSnapshot
    | null
    | undefined;
  if (
    !snapshot ||
    !Array.isArray(snapshot.marketCards) ||
    !Array.isArray(snapshot.targetCards)
  ) {
    return null;
  }
  return snapshot;
}

/** Lists all visible card ids the current player can reason about without peeking hidden decks. */
function getKnownVisibleCardIds(
  core: SplendorCore,
  player: SplendorPlayerState,
): string[] {
  const marketCardIds = CARD_TIERS.flatMap((tier) => core.market[tier]);
  const reservedCardIds = player.reservedCardIds.filter((cardId) =>
    getCardDef(cardId),
  );
  return [...marketCardIds, ...reservedCardIds];
}

/** Summarizes how many attractive purchases are available in a visible card set. */
function evaluateOpportunitySummary(
  core: SplendorCore,
  player: SplendorPlayerState,
  visibleCardIds: string[],
  snapshot: SplendorFeatureSnapshot | null,
): SplendorOpportunitySummary {
  const demandByColor = snapshot?.demandByColor ?? buildDemandByColor(core);
  const nobleNeedByColor =
    snapshot?.nobleNeedByColor ??
    buildNobleNeedByColor(core, player, buildNobleGapById(core, player));
  const scored = visibleCardIds
    .map((cardId) => {
      const card = getCardDef(cardId);
      if (!card) return null;
      const utility = computeCardUtility({
        player,
        card,
        demandByColor,
        nobleNeedByColor,
      });
      return {
        utility,
        missingTokens: getMissingTokenCount(player, card),
      };
    })
    .filter(
      (item): item is { utility: number; missingTokens: number } =>
        item !== null,
    );

  const affordable = scored
    .filter((item) => item.missingTokens <= 0)
    .sort((left, right) => right.utility - left.utility);
  const close = scored
    .filter((item) => item.missingTokens <= 1)
    .sort((left, right) => right.utility - left.utility);
  const future = [...scored].sort(
    (left, right) => right.utility - left.utility,
  );

  return {
    affordableCount: affordable.length,
    closeCount: close.length,
    topAffordableUtility: affordable
      .slice(0, 2)
      .reduce((sum, item) => sum + item.utility, 0),
    topCloseUtility: close
      .slice(0, 2)
      .reduce((sum, item) => sum + item.utility, 0),
    topFutureUtility: future
      .slice(0, 3)
      .reduce((sum, item) => sum + item.utility, 0),
  };
}

function countProjectedBuyActions(actions: AiLegalAction[]): number {
  return actions.filter(
    (action) =>
      action.kind === AI_ACTION_KINDS.BUY_OPEN ||
      action.kind === AI_ACTION_KINDS.BUY_RESERVED,
  ).length;
}

/** Converts an AI legal action back into a domain command for visible-state projection. */
function toProjectedCommand(
  playerId: string,
  action: AiLegalAction,
): SplendorCommand | null {
  switch (action.kind) {
    case AI_ACTION_KINDS.TAKE_THREE: {
      const colors = Array.isArray(action.metadata?.colors)
        ? action.metadata.colors.filter(isGemColor)
        : [];
      return colors.length > 0
        ? {
            type: SPLENDOR_COMMANDS.TAKE_THREE_DIFFERENT_GEMS,
            payload: { colors },
            playerId,
            timestamp: 0,
          }
        : null;
    }
    case AI_ACTION_KINDS.TAKE_TWO: {
      const color = isGemColor(action.metadata?.color)
        ? action.metadata.color
        : null;
      return color
        ? {
            type: SPLENDOR_COMMANDS.TAKE_TWO_SAME_GEMS,
            payload: { color },
            playerId,
            timestamp: 0,
          }
        : null;
    }
    case AI_ACTION_KINDS.RESERVE_OPEN: {
      const tier =
        typeof action.metadata?.tier === "number"
          ? (action.metadata.tier as CardTier)
          : null;
      const cardId =
        typeof action.metadata?.cardId === "string"
          ? action.metadata.cardId
          : null;
      return tier && cardId
        ? {
            type: SPLENDOR_COMMANDS.RESERVE_OPEN_CARD,
            payload: { tier, cardId },
            playerId,
            timestamp: 0,
          }
        : null;
    }
    case AI_ACTION_KINDS.RESERVE_DECK: {
      const tier =
        typeof action.metadata?.tier === "number"
          ? (action.metadata.tier as CardTier)
          : null;
      return tier
        ? {
            type: SPLENDOR_COMMANDS.RESERVE_DECK_TOP_CARD,
            payload: { tier },
            playerId,
            timestamp: 0,
          }
        : null;
    }
    case AI_ACTION_KINDS.BUY_OPEN: {
      const tier =
        typeof action.metadata?.tier === "number"
          ? (action.metadata.tier as CardTier)
          : null;
      const cardId =
        typeof action.metadata?.cardId === "string"
          ? action.metadata.cardId
          : null;
      return tier && cardId
        ? {
            type: SPLENDOR_COMMANDS.BUY_OPEN_CARD,
            payload: { tier, cardId },
            playerId,
            timestamp: 0,
          }
        : null;
    }
    case AI_ACTION_KINDS.BUY_RESERVED: {
      const cardId =
        typeof action.metadata?.cardId === "string"
          ? action.metadata.cardId
          : null;
      return cardId
        ? {
            type: SPLENDOR_COMMANDS.BUY_RESERVED_CARD,
            payload: { cardId },
            playerId,
            timestamp: 0,
          }
        : null;
    }
    case AI_ACTION_KINDS.DISCARD: {
      const color =
        typeof action.metadata?.color === "string"
          ? (action.metadata.color as TokenColor)
          : null;
      return color
        ? {
            type: SPLENDOR_COMMANDS.DISCARD_GEMS_TO_LIMIT,
            payload: { color },
            playerId,
            timestamp: 0,
          }
        : null;
    }
    case AI_ACTION_KINDS.CHOOSE_NOBLE: {
      const nobleId =
        typeof action.metadata?.nobleId === "string"
          ? action.metadata.nobleId
          : null;
      return nobleId
        ? {
            type: SPLENDOR_COMMANDS.CHOOSE_NOBLE,
            payload: { nobleId },
            playerId,
            timestamp: 0,
          }
        : null;
    }
    default:
      return null;
  }
}

/** Applies one action to the player's visible state without peeking hidden deck information. */
function buildProjectedActionState(
  state: SplendorState,
  playerId: string,
  action: AiLegalAction,
): SplendorProjectedPlayerState | null {
  const command = toProjectedCommand(playerId, action);
  if (!command) return null;

  const events = SplendorDomain.execute(state, command, AI_NOOP_RANDOM);
  let projectedCore = state.core;
  for (const event of events) {
    projectedCore = SplendorDomain.reduce(projectedCore, event);
  }

  const nextState = {
    ...state,
    core: projectedCore,
  } as SplendorState;
  const preAdvanceState = {
    ...nextState,
    core: { ...projectedCore, currentPlayer: playerId },
  } as SplendorState;
  const legalActions = buildSplendorAiLegalActions({
    playerId,
    state: preAdvanceState,
  });
  const featureSnapshot = buildSplendorFeatureSnapshot({
    playerId,
    state: preAdvanceState,
    legalActions,
    interaction: null,
    responseWindow: null,
  });

  return {
    nextState,
    nextPlayer: projectedCore.players[playerId],
    legalActions,
    featureSnapshot,
    pendingResolutionType: projectedCore.pendingResolution?.type ?? null,
  };
}

/** Reopens a projected visible state as a hypothetical next self turn for expert follow-up search. */
function buildSyntheticSelfFollowUpState(
  state: SplendorState,
  playerId: string,
): SplendorState {
  return {
    ...state,
    core: {
      ...state.core,
      currentPlayer: playerId,
    },
  };
}

/** Builds a fallback target set when the context snapshot is unavailable. */
function buildFallbackTargetCards(
  core: SplendorCore,
  player: SplendorPlayerState,
  config: SplendorDifficultyConfig,
): SplendorCardInsight[] {
  const nobleGapById = buildNobleGapById(core, player);
  const demandByColor = buildDemandByColor(core);
  const nobleNeedByColor = buildNobleNeedByColor(core, player, nobleGapById);
  const marketCards = CARD_TIERS.flatMap((tier) => core.market[tier])
    .map((cardId) =>
      buildCardInsight({ player, cardId, demandByColor, nobleNeedByColor }),
    )
    .filter((item): item is SplendorCardInsight => item !== null);
  const reservedCards = player.reservedCardIds
    .map((cardId) =>
      buildCardInsight({ player, cardId, demandByColor, nobleNeedByColor }),
    )
    .filter((item): item is SplendorCardInsight => item !== null);
  const snapshotLike: SplendorFeatureSnapshot = {
    marketCards,
    reservedCards,
    cardById: Object.fromEntries(
      [...marketCards, ...reservedCards].map((item) => [item.cardId, item]),
    ) as Record<string, SplendorCardInsight>,
    targetCards: [...marketCards, ...reservedCards],
    demandByColor,
    nobleNeedByColor,
    opponentThreats: [],
    hotColors: [...GEM_COLORS],
    discountsByColor: calculateDiscounts(player),
    bankScarcityByColor: buildBankScarcityByColor(core),
    gamePhase: getGamePhase(core),
    tokenOverflowRisk: Math.max(0, getTokenCount(player) - 8),
    reserveSlotPressure: roundScore(
      player.reservedCardIds.length / MAX_RESERVED_CARDS,
    ),
    nobleGapById,
    mostDangerousOpponentId: null,
    topTargetCardIds: [],
  };
  return getScoringTargetCards(snapshotLike, player, config);
}

/** Restricts projection to action kinds that can change Splendor's medium-term outlook. */
function isProjectableSplendorActionKind(kind: string): boolean {
  return (
    kind === AI_ACTION_KINDS.TAKE_THREE ||
    kind === AI_ACTION_KINDS.TAKE_TWO ||
    kind === AI_ACTION_KINDS.BUY_OPEN ||
    kind === AI_ACTION_KINDS.BUY_RESERVED ||
    kind === AI_ACTION_KINDS.RESERVE_OPEN ||
    kind === AI_ACTION_KINDS.RESERVE_DECK
  );
}

/** Ranks actions for shortlist search so hard/expert prioritize impactful tempo moves. */
function rankSplendorProjectionCandidate(args: {
  context: AiDecisionContext;
  action: AiLegalAction;
  baseEvaluation: LocalAiActionEvaluation;
}): number {
  const { context, action, baseEvaluation } = args;
  const snapshot = getSplendorFeatureSnapshot(context);
  const config = getDifficultyConfig(context);

  let priority = baseEvaluation.totalScore * 0.04;
  if (
    action.kind === AI_ACTION_KINDS.BUY_OPEN ||
    action.kind === AI_ACTION_KINDS.BUY_RESERVED
  ) {
    priority += 18;
  }
  if (action.kind === AI_ACTION_KINDS.TAKE_TWO) {
    priority += 8;
  }
  if (action.kind === AI_ACTION_KINDS.RESERVE_OPEN) {
    const cardId =
      typeof action.metadata?.cardId === "string"
        ? action.metadata.cardId
        : null;
    if (cardId && snapshot?.topTargetCardIds.includes(cardId)) {
      priority += config.reservedTargetBias * 0.5;
    }
  }
  return roundScore(priority);
}

/** Computes the best synthetic self follow-up available after a projected action. */
function evaluateExpertFollowUp(args: {
  playerId: string;
  projected: SplendorProjectedPlayerState;
  config: SplendorDifficultyConfig;
}): { score: number; actionId: string | null } {
  if (
    args.projected.pendingResolutionType ||
    args.projected.nextState.core.gameResult
  ) {
    return { score: 0, actionId: null };
  }

  const syntheticState = buildSyntheticSelfFollowUpState(
    args.projected.nextState,
    args.playerId,
  );
  const legalActions = buildSplendorAiLegalActions({
    playerId: args.playerId,
    state: syntheticState,
  });
  if (legalActions.length === 0) return { score: 0, actionId: null };

  const featureSnapshot = buildSplendorFeatureSnapshot({
    playerId: args.playerId,
    state: syntheticState,
    legalActions,
    interaction: null,
    responseWindow: null,
  });
  const followUpContext: AiDecisionContext = {
    gameId: "splendor",
    matchId: "splendor-follow-up",
    playerId: args.playerId,
    visibleState: syntheticState,
    interaction: null,
    responseWindow: null,
    legalActions,
    rulesVersion: null,
    decisionBudgetMs: 0,
    source: "local",
    difficulty: {
      level: "expert",
      searchDepth: 0,
      shortlistSize: 4,
      simulationBudgetMs: 0,
      randomness: 0,
      beliefSampleCount: 1,
      evaluatorProfile: "expert",
    },
    featureSnapshot: featureSnapshot as Record<string, unknown> | null,
  };
  const followUpScorers = [
    ...extendedScorers,
    expertTempoScorer,
    expertEndgameRaceScorer,
  ];
  const evaluations = evaluateLocalAiActions(followUpContext, followUpScorers)
    .sort((left, right) => right.totalScore - left.totalScore)
    .slice(0, 4);
  const best = evaluations[0];
  return {
    score: roundScore(
      (best?.totalScore ?? 0) * args.config.expertFollowUpDiscount,
    ),
    actionId: best?.action.actionId ?? null,
  };
}

/** Projects one Splendor action and returns a lookahead contribution for hard/expert search. */
function projectSplendorAction(args: {
  context: AiDecisionContext;
  action: AiLegalAction;
}): {
  score: number;
  reason?: string;
  metadata?: Record<string, unknown>;
} | null {
  const resolved = resolveScorerContext(args.context);
  if (!resolved) return null;
  if (!isProjectableSplendorActionKind(args.action.kind)) return null;

  const { core, player } = resolved;
  const config = getDifficultyConfig(args.context);
  const snapshot = getSplendorFeatureSnapshot(args.context);
  const projected = buildProjectedActionState(
    args.context.visibleState as SplendorState,
    args.context.playerId,
    args.action,
  );
  if (!projected) return null;

  const targetCards = snapshot
    ? getScoringTargetCards(snapshot, player, config)
    : buildFallbackTargetCards(core, player, config);
  const beforeVisibleCardIds = getKnownVisibleCardIds(core, player);
  const afterVisibleCardIds = getKnownVisibleCardIds(
    projected.nextState.core,
    projected.nextPlayer,
  );
  const beforeOpportunity = evaluateOpportunitySummary(
    core,
    player,
    beforeVisibleCardIds,
    snapshot,
  );
  const afterOpportunity = evaluateOpportunitySummary(
    projected.nextState.core,
    projected.nextPlayer,
    afterVisibleCardIds,
    projected.featureSnapshot,
  );
  const targetImprovement = calcTargetImprovement({
    beforePlayer: player,
    afterPlayer: projected.nextPlayer,
    targetCards,
  });
  const overflowPenalty = calcOverflowPenalty({
    core: projected.nextState.core,
    player: projected.nextPlayer,
    snapshot: projected.featureSnapshot,
    config,
  });

  let score = 0;
  score += targetImprovement * config.projectionScale;
  score +=
    (afterOpportunity.affordableCount - beforeOpportunity.affordableCount) *
    22 *
    config.chainWeight;
  score +=
    (afterOpportunity.topAffordableUtility -
      beforeOpportunity.topAffordableUtility) *
    0.08 *
    config.chainWeight;
  score += (afterOpportunity.closeCount - beforeOpportunity.closeCount) * 7;

  const gainedNoble =
    projected.nextPlayer.nobleIds.length > player.nobleIds.length;
  if (gainedNoble) score += 42;
  if (projected.pendingResolutionType === "discardToLimit") {
    score -= overflowPenalty * config.overflowPenaltyWeight;
  }

  let followUpScore = 0;
  let followUpActionId: string | null = null;
  if (args.context.difficulty.level === "expert") {
    const followUp = evaluateExpertFollowUp({
      playerId: args.context.playerId,
      projected,
      config,
    });
    followUpScore = followUp.score;
    followUpActionId = followUp.actionId;
    score += followUpScore;
  }

  return {
    score: roundScore(score),
    reason: `前瞻收益 ${Math.round(score)}`,
    metadata: {
      targetImprovement,
      overflowPenalty,
      pendingResolutionType: projected.pendingResolutionType,
      gainedNoble,
      followUpScore,
      followUpActionId,
      searched: true,
    },
  };
}

export function buildSplendorAiLegalActions(
  args: BuildGameAiLegalActionsArgs,
): AiLegalAction[] {
  const { state, playerId } = args;
  if ((state as SplendorState).sys.interaction?.current) return [];
  const core = (state as SplendorState).core;
  const player = core.players[playerId];
  if (!player) return [];
  if (!core.hostStarted || core.gameResult) return [];

  const actions: AiLegalAction[] = [];

  if (core.currentPlayer !== playerId) return [];

  if (core.pendingResolution) {
    if (core.pendingResolution.type === "discardToLimit") {
      const tokenColors: TokenColor[] = [...GEM_COLORS, "gold"];
      for (const color of tokenColors) {
        if (player.tokens[color] > 0) {
          actions.push(createDiscardAction(color));
        }
      }
      return actions;
    }
    if (core.pendingResolution.type === "chooseNoble") {
      for (const nobleId of core.pendingResolution.nobleIds) {
        actions.push(createChooseNobleAction(nobleId));
      }
      return actions;
    }
    return [];
  }

  // BUY actions — highest priority
  for (const tier of CARD_TIERS) {
    for (const cardId of core.market[tier]) {
      if (isHiddenDeckPlaceholderId(cardId)) continue;
      const card = getCardDef(cardId);
      if (card && canAffordCard(player, card)) {
        actions.push(createBuyOpenAction(tier, cardId));
      }
    }
  }
  for (const cardId of player.reservedCardIds) {
    const card = getCardDef(cardId);
    if (card && canAffordCard(player, card)) {
      actions.push(createBuyReservedAction(cardId));
    }
  }

  // TAKE GEMS actions — pre-compute missing colors per card to avoid redundant discount calculations
  const marketMissingCache = new Map<
    string,
    { card: NonNullable<ReturnType<typeof getCardDef>>; missing: GemColor[] }
  >();
  for (const tier of CARD_TIERS) {
    for (const cardId of core.market[tier]) {
      const card = getCardDef(cardId);
      if (card) {
        marketMissingCache.set(cardId, {
          card,
          missing: getMissingColors(player, card),
        });
      }
    }
  }

  const availableColors = getAvailableGemColors(core.bank);
  if (availableColors.length >= 3) {
    const combos = generateThreeColorCombos(availableColors);
    const scoredCombos = combos.map((combo) => {
      let score = 0;
      for (const [, entry] of marketMissingCache) {
        const overlap = combo.filter((c) => entry.missing.includes(c));
        score += overlap.length * (4 - entry.card.tier);
      }
      return { combo, score };
    });
    scoredCombos.sort((a, b) => b.score - a.score);
    const topCount = Math.min(10, scoredCombos.length);
    for (let i = 0; i < topCount; i++) {
      actions.push(createTakeThreeAction(scoredCombos[i].combo));
    }
  } else if (availableColors.length === 2) {
    actions.push(createTakeThreeAction(availableColors));
  }

  for (const color of GEM_COLORS) {
    if (core.bank[color] >= 4) {
      actions.push(createTakeTwoAction(color));
    }
  }

  // RESERVE actions
  if (player.reservedCardIds.length < MAX_RESERVED_CARDS) {
    for (const tier of CARD_TIERS) {
      for (const cardId of core.market[tier]) {
        if (isHiddenDeckPlaceholderId(cardId)) continue;
        const entry = marketMissingCache.get(cardId);
        if (!entry) continue;
        const missing = getMissingTokenCount(player, entry.card);
        if (entry.card.points >= 4 || (tier >= 2 && missing <= 3)) {
          actions.push(createReserveOpenAction(tier, cardId));
        }
      }
    }
    for (const tier of CARD_TIERS) {
      if (core.decks[tier].length > 0) {
        actions.push(createReserveDeckAction(tier));
      }
    }
  }

  // Fallback: generate take-three with all available colors (valid when bank has >=1 colors)
  if (actions.length === 0 && availableColors.length > 0) {
    actions.push(
      createTakeThreeAction(
        availableColors.slice(0, Math.min(3, availableColors.length)),
      ),
    );
  }

  if (actions.length === 0 && player.reservedCardIds.length < MAX_RESERVED_CARDS) {
    for (const tier of CARD_TIERS) {
      const cardId = core.market[tier].find((id) => !isHiddenDeckPlaceholderId(id));
      if (cardId) {
        actions.push(createReserveOpenAction(tier, cardId));
        break;
      }
      if (core.decks[tier].length > 0) {
        actions.push(createReserveDeckAction(tier));
        break;
      }
    }
  }

  if (actions.length === 0 && !hasAnyStandardTurnAction(core, playerId)) {
    actions.push(createPassTurnAction());
  }

  return actions;
}

const buyCardScorer: LocalAiActionScorer = {
  id: "buy-card",
  score(context, action) {
    if (
      action.kind !== AI_ACTION_KINDS.BUY_OPEN &&
      action.kind !== AI_ACTION_KINDS.BUY_RESERVED
    )
      return null;
    const resolved = resolveScorerContext(context);
    if (!resolved) return null;
    const { core, player } = resolved;
    const config = getDifficultyConfig(context);
    const snapshot = getSplendorFeatureSnapshot(context);

    const cardId =
      typeof action.metadata?.cardId === "string"
        ? action.metadata.cardId
        : null;
    if (!cardId) return null;
    const card = getCardDef(cardId);
    if (!card) return null;

    const phase = snapshot?.gamePhase ?? getGamePhase(core);
    const phaseWeights = getPhaseWeights(phase);
    let score = 0;
    const endgameBonus =
      player.points >= config.endgameThreshold
        ? card.points * config.endgamePointsBonus
        : 0;
    score +=
      card.points * W_POINTS * config.pointsMultiplier * phaseWeights.points +
      endgameBonus;
    score += W_BUY_BASE;
    score += card.tier * W_TIER_BONUS;

    let bestNobleProgress = 0;
    const newDiscounts = calculateDiscounts({
      ...player,
      purchasedCardIds: [...player.purchasedCardIds, cardId],
    });
    for (const nobleId of core.nobleIds) {
      const noble = NOBLE_DEFS_BY_ID[nobleId];
      if (!noble) continue;
      const gapAfter = calcNobleGapAfterBuy(nobleId, player, card.bonus);
      bestNobleProgress = Math.max(
        bestNobleProgress,
        Math.max(5, 100 * Math.pow(0.55, gapAfter)),
      );
      if (GEM_COLORS.every((c) => newDiscounts[c] >= noble.requirement[c])) {
        score += W_NOBLE_ALIGN * config.nobleMultiplier;
      }
    }
    score += bestNobleProgress * 0.42 * config.nobleMultiplier;

    const oldDiscounts = calculateDiscounts(player);
    const bonusColor = card.bonus;
    const bonusDelta = newDiscounts[bonusColor] - oldDiscounts[bonusColor];
    if (bonusDelta > 0) {
      const bonusDemand = snapshot?.demandByColor[bonusColor] ?? 0;
      score +=
        bonusDelta *
        bonusDemand *
        0.55 *
        W_GEM_IMPORTANCE_TIER *
        config.bonusValueWeight *
        phaseWeights.bonus;
    }

    const totalCost = GEM_COLORS.reduce(
      (s, c) => s + Math.max(0, card.cost[c] - oldDiscounts[c]),
      0,
    );
    score += Math.max(0, W_CHEAP_BUY - totalCost * W_CHEAP_COST_FACTOR);
    score += Math.max(0, getTokenCount(player) - 6) * 3;

    const projected = buildProjectedActionState(
      context.visibleState as SplendorState,
      context.playerId,
      action,
    );
    if (projected) {
      const beforeVisibleCardIds = getKnownVisibleCardIds(core, player);
      const afterVisibleCardIds = getKnownVisibleCardIds(
        projected.nextState.core,
        projected.nextPlayer,
      );
      const beforeOpportunity = evaluateOpportunitySummary(
        core,
        player,
        beforeVisibleCardIds,
        snapshot,
      );
      const afterOpportunity = evaluateOpportunitySummary(
        projected.nextState.core,
        projected.nextPlayer,
        afterVisibleCardIds,
        projected.featureSnapshot,
      );
      score +=
        (afterOpportunity.affordableCount - beforeOpportunity.affordableCount) *
        26 *
        config.chainWeight;
      score +=
        (afterOpportunity.topAffordableUtility -
          beforeOpportunity.topAffordableUtility) *
        0.12 *
        config.chainWeight;
      score += (afterOpportunity.closeCount - beforeOpportunity.closeCount) * 8;
      score -=
        calcOverflowPenalty({
          core: projected.nextState.core,
          player: projected.nextPlayer,
          snapshot: projected.featureSnapshot,
          config,
        }) * 0.08;
    }

    return { score, reason: `购买卡牌(价值${card.points}分, T${card.tier})` };
  },
};

const takeGemsScorer: LocalAiActionScorer = {
  id: "take-gems",
  score(context, action) {
    if (
      action.kind !== AI_ACTION_KINDS.TAKE_THREE &&
      action.kind !== AI_ACTION_KINDS.TAKE_TWO
    )
      return null;
    const resolved = resolveScorerContext(context);
    if (!resolved) return null;
    const { core, player } = resolved;
    const config = getDifficultyConfig(context);

    const rawColors =
      action.kind === AI_ACTION_KINDS.TAKE_THREE
        ? action.metadata?.colors
        : action.metadata?.color;
    const colors: GemColor[] =
      action.kind === AI_ACTION_KINDS.TAKE_THREE
        ? Array.isArray(rawColors)
          ? rawColors.filter(isGemColor)
          : []
        : isGemColor(rawColors)
          ? [rawColors]
          : [];
    const snapshot = getSplendorFeatureSnapshot(context);

    const targetCards = snapshot
      ? getScoringTargetCards(snapshot, player, config)
      : buildFallbackTargetCards(core, player, config);
    const projected = buildProjectedActionState(
      context.visibleState as SplendorState,
      context.playerId,
      action,
    );
    let score = 0;
    if (projected) {
      const beforeVisibleCardIds = getKnownVisibleCardIds(core, player);
      const afterVisibleCardIds = getKnownVisibleCardIds(
        projected.nextState.core,
        projected.nextPlayer,
      );
      const beforeOpportunity = evaluateOpportunitySummary(
        core,
        player,
        beforeVisibleCardIds,
        snapshot,
      );
      const afterOpportunity = evaluateOpportunitySummary(
        projected.nextState.core,
        projected.nextPlayer,
        afterVisibleCardIds,
        projected.featureSnapshot,
      );

      score +=
        calcTargetImprovement({
          beforePlayer: player,
          afterPlayer: projected.nextPlayer,
          targetCards,
        }) * config.projectionScale;
      score +=
        (afterOpportunity.affordableCount - beforeOpportunity.affordableCount) *
        18 *
        config.chainWeight;
      score +=
        (afterOpportunity.closeCount - beforeOpportunity.closeCount) *
        7 *
        config.chainWeight;
      score +=
        (afterOpportunity.topAffordableUtility -
          beforeOpportunity.topAffordableUtility) *
        0.08 *
        config.chainWeight;
      if (
        beforeOpportunity.affordableCount === 0 &&
        afterOpportunity.affordableCount > 0
      ) {
        score += 14 * config.chainWeight;
      }
      score +=
        countProjectedBuyActions(projected.legalActions) *
        4 *
        config.chainWeight;
      score -=
        calcOverflowPenalty({
          core: projected.nextState.core,
          player: projected.nextPlayer,
          snapshot: projected.featureSnapshot,
          config,
        }) * config.overflowPenaltyWeight;
    }
    score += colors.reduce(
      (sum, color) =>
        sum +
        (snapshot?.bankScarcityByColor[color] ?? calcGemScarcity(color, core)) *
          18 *
          config.scarcityWeight,
      0,
    );

    // 对手威胁：困难/专家难度考虑抢走对手需要的宝石
    if (config.opponentThreatWeight > 0) {
      const opponentThreats = getOpponentThreats(
        core,
        context.playerId,
        snapshot,
      );
      for (const threat of opponentThreats) {
        for (const color of colors) {
          if (threat.keyNeededColors.includes(color)) {
            score += threat.imminentEndgame
              ? config.opponentThreatWeight * 0.45
              : config.opponentThreatWeight * 0.22;
          }
        }
      }
    }
    if (action.kind === AI_ACTION_KINDS.TAKE_TWO) {
      score += W_TAKE_TWO_BONUS;
    }

    return score > 0 ? { score, reason: `收集宝石(帮助购买卡牌)` } : null;
  },
};

const reserveScorer: LocalAiActionScorer = {
  id: "reserve",
  score(context, action) {
    if (
      action.kind !== AI_ACTION_KINDS.RESERVE_OPEN &&
      action.kind !== AI_ACTION_KINDS.RESERVE_DECK
    )
      return null;
    const resolved = resolveScorerContext(context);
    if (!resolved) return null;
    const { core, player } = resolved;
    const config = getDifficultyConfig(context);
    const snapshot = getSplendorFeatureSnapshot(context);

    if (player.reservedCardIds.length >= MAX_RESERVED_CARDS) return null;

    let score = 0;

    if (action.kind === AI_ACTION_KINDS.RESERVE_OPEN) {
      const cardId =
        typeof action.metadata?.cardId === "string"
          ? action.metadata.cardId
          : null;
      if (!cardId) return null;
      const card = getCardDef(cardId);
      if (!card) return null;
      const cardInsight =
        snapshot?.cardById[cardId] ??
        (() => {
          const demandByColor =
            snapshot?.demandByColor ?? buildDemandByColor(core);
          const nobleNeedByColor =
            snapshot?.nobleNeedByColor ??
            buildNobleNeedByColor(
              core,
              player,
              buildNobleGapById(core, player),
            );
          return buildCardInsight({
            player,
            cardId,
            demandByColor,
            nobleNeedByColor,
          });
        })();
      if (!cardInsight) return null;

      score += card.points * W_RESERVE_POINTS;
      const missing = cardInsight.missingTokens;
      if (missing <= 2) score += W_RESERVE_CLOSE_2;
      else if (missing <= 4) score += W_RESERVE_CLOSE_4;
      score += card.tier * W_RESERVE_TIER;
      score += getTargetPriority(cardInsight, player, config) * 0.16;
      score += calcReserveGoldValue(core, player, config);

      // 对手威胁：困难/专家难度，如果对手即将能买到这张卡，提高预留价值
      if (config.blockReserveWeight > 0) {
        const opponentThreats = getOpponentThreats(
          core,
          context.playerId,
          snapshot,
        );
        for (const threat of opponentThreats) {
          if (
            threat.topThreatCardId === cardId ||
            threat.buyableOpenCardIds.includes(cardId)
          ) {
            score += config.blockReserveWeight * (card.points + 1);
          } else if (threat.closeOpenCardIds.includes(cardId)) {
            score += config.blockReserveWeight * 0.6;
          }
        }
      }
    } else {
      const tier =
        typeof action.metadata?.tier === "number" ? action.metadata.tier : 1;
      score +=
        tier * W_DECK_TIER +
        W_DECK_BASE +
        config.deckReserveValue +
        calcReserveGoldValue(core, player, config) * 0.65;
    }

    const projected = buildProjectedActionState(
      context.visibleState as SplendorState,
      context.playerId,
      action,
    );
    if (projected) {
      const beforeVisibleCardIds = getKnownVisibleCardIds(core, player);
      const afterVisibleCardIds = getKnownVisibleCardIds(
        projected.nextState.core,
        projected.nextPlayer,
      );
      const beforeOpportunity = evaluateOpportunitySummary(
        core,
        player,
        beforeVisibleCardIds,
        snapshot,
      );
      const afterOpportunity = evaluateOpportunitySummary(
        projected.nextState.core,
        projected.nextPlayer,
        afterVisibleCardIds,
        projected.featureSnapshot,
      );

      score +=
        (afterOpportunity.affordableCount - beforeOpportunity.affordableCount) *
        16 *
        config.chainWeight;
      score +=
        (afterOpportunity.closeCount - beforeOpportunity.closeCount) *
        6 *
        config.chainWeight;
      score +=
        countProjectedBuyActions(projected.legalActions) *
        5 *
        config.chainWeight;

      score -=
        calcOverflowPenalty({
          core: projected.nextState.core,
          player: projected.nextPlayer,
          snapshot: projected.featureSnapshot,
          config,
        }) * 0.45;
    }
    score -=
      player.reservedCardIds.length * (8 + config.reserveSlotPenalty * 0.35);
    score -=
      (snapshot?.reserveSlotPressure ?? 0) * config.reserveSlotPenalty * 8;

    return score > 0 ? { score, reason: `预留卡牌` } : null;
  },
};

const discardScorer: LocalAiActionScorer = {
  id: "discard",
  score(context, action) {
    if (action.kind !== AI_ACTION_KINDS.DISCARD) return null;
    const resolved = resolveScorerContext(context);
    if (!resolved) return null;
    const { core, player } = resolved;
    const snapshot = getSplendorFeatureSnapshot(context);
    const config = getDifficultyConfig(context);

    const rawColor = action.metadata?.color;
    if (typeof rawColor !== "string") return null;
    const color = rawColor as TokenColor;
    const discardPreference = buildDiscardPreference({
      core,
      player,
      snapshot,
      config,
    });
    return {
      score: discardPreference[color],
      reason: `丢弃宝石(${color})`,
    };
  },
};

const chooseNobleScorer: LocalAiActionScorer = {
  id: "choose-noble",
  score(context, action) {
    if (action.kind !== AI_ACTION_KINDS.CHOOSE_NOBLE) return null;
    if (typeof action.metadata?.nobleId !== "string") return null;
    const resolved = resolveScorerContext(context);
    if (!resolved) return null;
    const noble = NOBLE_DEFS_BY_ID[action.metadata.nobleId];
    if (!noble) return null;
    const missing = getMissingNobleRequirementCount(resolved.player, noble);
    const base = W_EVAL_NOBLE_BASE - missing * W_EVAL_NOBLE_MISSING;
    const discounts = calculateDiscounts(resolved.player);
    let alignment = 0;
    for (const color of GEM_COLORS) {
      alignment += Math.min(discounts[color], noble.requirement[color]);
    }
    const score = base + alignment * 2;
    return { score, reason: `选择贵族(3分)` };
  },
};

// --- 对手威胁评分器 (困难/专家) ---
const opponentThreatScorer: LocalAiActionScorer = {
  id: "opponent-threat",
  score(context, action) {
    if (action.kind !== AI_ACTION_KINDS.BUY_OPEN) return null;
    const resolved = resolveScorerContext(context);
    if (!resolved) return null;
    const { core } = resolved;
    const config = getDifficultyConfig(context);
    if (config.opponentThreatWeight <= 0) return null;

    const cardId =
      typeof action.metadata?.cardId === "string"
        ? action.metadata.cardId
        : null;
    if (!cardId) return null;
    const card = getCardDef(cardId);
    if (!card) return null;

    // 检查对手是否也快能买到这张卡
    let threatBonus = 0;
    for (const [oppId, opponent] of Object.entries(core.players)) {
      if (oppId === context.playerId) continue;
      const oppMissing = getMissingTokenCount(opponent, card);
      if (oppMissing <= 1) {
        // 对手差 1 个宝石就能买，抢买价值高
        threatBonus += config.opponentThreatWeight * (card.points + 1);
      } else if (oppMissing <= 3) {
        // 对手接近购买
        threatBonus += config.opponentThreatWeight * 0.5;
      }
    }

    // 检查对手是否快到 15 分
    for (const [oppId, opponent] of Object.entries(core.players)) {
      if (oppId === context.playerId) continue;
      if (opponent.points >= 11 && card.points > 0) {
        // 对手接近终局，自己买有分卡更紧迫
        threatBonus += config.opponentThreatWeight * 0.5;
      }
    }

    return threatBonus > 0
      ? { score: threatBonus, reason: `对手威胁(抢买高价值卡)` }
      : null;
  },
};

// --- 贵族进度评分器 ---
const nobleProgressScorer: LocalAiActionScorer = {
  id: "noble-progress",
  score(context, action) {
    if (
      action.kind !== AI_ACTION_KINDS.TAKE_THREE &&
      action.kind !== AI_ACTION_KINDS.TAKE_TWO
    )
      return null;
    const resolved = resolveScorerContext(context);
    if (!resolved) return null;
    const { player } = resolved;
    const config = getDifficultyConfig(context);
    if (config.nobleMultiplier <= 0) return null;
    const snapshot = getSplendorFeatureSnapshot(context);

    const rawColors =
      action.kind === AI_ACTION_KINDS.TAKE_THREE
        ? action.metadata?.colors
        : action.metadata?.color;
    const colors: GemColor[] =
      action.kind === AI_ACTION_KINDS.TAKE_THREE
        ? Array.isArray(rawColors)
          ? rawColors.filter(isGemColor)
          : []
        : isGemColor(rawColors)
          ? [rawColors]
          : [];

    let score = 0;
    const nobleGapById = snapshot?.nobleGapById ?? {};
    const targetCards = snapshot
      ? getScoringTargetCards(snapshot, player, config)
      : [];
    for (const target of targetCards) {
      const card = getCardDef(target.cardId);
      if (!card) continue;
      const helpful = colors.filter((c) =>
        target.missingColors.includes(c),
      ).length;
      if (helpful <= 0) continue;
      const alignedGap =
        Object.entries(nobleGapById)
          .filter(([nobleId, gap]) => {
            const noble = NOBLE_DEFS_BY_ID[nobleId];
            return noble && noble.requirement[card.bonus] > 0 && gap > 0;
          })
          .map(([, gap]) => Math.max(5, 100 * Math.pow(0.55, gap)))
          .sort((a, b) => b - a)[0] ?? 0;
      score += helpful * alignedGap * 0.08 * config.nobleMultiplier;
    }

    return score > 0 ? { score, reason: `贵族进度` } : null;
  },
};

const expertTempoScorer: LocalAiActionScorer = {
  id: "expert-tempo",
  score(context, action) {
    if (context.difficulty.level !== "expert") return null;
    const resolved = resolveScorerContext(context);
    if (!resolved) return null;
    const { core, player } = resolved;

    const canBuyNow =
      CARD_TIERS.some((tier) =>
        core.market[tier].some((cardId) => {
          const card = getCardDef(cardId);
          return card ? canAffordCard(player, card) : false;
        }),
      ) ||
      player.reservedCardIds.some((cardId) => {
        const card = getCardDef(cardId);
        return card ? canAffordCard(player, card) : false;
      });
    const tokenCount = getTokenCount(player);
    let score = 0;

    if (canBuyNow) {
      if (
        action.kind === AI_ACTION_KINDS.BUY_OPEN ||
        action.kind === AI_ACTION_KINDS.BUY_RESERVED
      )
        score += 92;
      if (
        action.kind === AI_ACTION_KINDS.TAKE_THREE ||
        action.kind === AI_ACTION_KINDS.TAKE_TWO
      )
        score -= 68;
      if (
        action.kind === AI_ACTION_KINDS.RESERVE_OPEN ||
        action.kind === AI_ACTION_KINDS.RESERVE_DECK
      )
        score -= 42;
    }

    if (tokenCount >= 8) {
      if (
        action.kind === AI_ACTION_KINDS.BUY_OPEN ||
        action.kind === AI_ACTION_KINDS.BUY_RESERVED
      )
        score += 28;
      if (
        action.kind === AI_ACTION_KINDS.TAKE_THREE ||
        action.kind === AI_ACTION_KINDS.TAKE_TWO
      )
        score -= 52;
      if (
        action.kind === AI_ACTION_KINDS.RESERVE_OPEN ||
        action.kind === AI_ACTION_KINDS.RESERVE_DECK
      )
        score -= 18;
    }

    return score !== 0 ? { score, reason: "专家节奏控制" } : null;
  },
};

const expertEndgameRaceScorer: LocalAiActionScorer = {
  id: "expert-endgame-race",
  score(context, action) {
    if (context.difficulty.level !== "expert") return null;
    const resolved = resolveScorerContext(context);
    if (!resolved) return null;
    const { core, player } = resolved;
    const maxOpponentPoints = Math.max(
      0,
      ...Object.entries(core.players)
        .filter(([playerId]) => playerId !== context.playerId)
        .map(([, opponent]) => opponent.points),
    );
    if (player.points < 7 && maxOpponentPoints < 9) return null;

    if (
      action.kind === AI_ACTION_KINDS.BUY_OPEN ||
      action.kind === AI_ACTION_KINDS.BUY_RESERVED
    ) {
      const cardId =
        typeof action.metadata?.cardId === "string"
          ? action.metadata.cardId
          : null;
      const card = cardId ? getCardDef(cardId) : null;
      if (!card) return null;
      let score = card.points * 74;
      if (player.points + card.points >= 15) {
        score += 160;
      }
      return { score, reason: "专家终局抢分" };
    }

    if (
      action.kind === AI_ACTION_KINDS.TAKE_THREE ||
      action.kind === AI_ACTION_KINDS.TAKE_TWO
    ) {
      return { score: -34, reason: "专家终局避免空转收集" };
    }

    if (action.kind === AI_ACTION_KINDS.RESERVE_DECK) {
      return { score: -26, reason: "专家终局避免盲抽预留" };
    }

    return null;
  },
};

const tempoScorer: LocalAiActionScorer = {
  id: "tempo",
  score(context, action) {
    if (context.difficulty.level === "easy") return null;
    const resolved = resolveScorerContext(context);
    if (!resolved) return null;
    const { core, player } = resolved;

    const canBuyNow =
      CARD_TIERS.some((tier) =>
        core.market[tier].some((cardId) => {
          const card = getCardDef(cardId);
          return card ? canAffordCard(player, card) : false;
        }),
      ) ||
      player.reservedCardIds.some((cardId) => {
        const card = getCardDef(cardId);
        return card ? canAffordCard(player, card) : false;
      });

    const tokenCount = getTokenCount(player);
    let score = 0;

    if (canBuyNow) {
      if (
        action.kind === AI_ACTION_KINDS.BUY_OPEN ||
        action.kind === AI_ACTION_KINDS.BUY_RESERVED
      )
        score += 140;
      if (
        action.kind === AI_ACTION_KINDS.TAKE_THREE ||
        action.kind === AI_ACTION_KINDS.TAKE_TWO
      )
        score -= 108;
      if (
        action.kind === AI_ACTION_KINDS.RESERVE_OPEN ||
        action.kind === AI_ACTION_KINDS.RESERVE_DECK
      )
        score -= 64;
    }

    if (tokenCount >= 8) {
      if (
        action.kind === AI_ACTION_KINDS.BUY_OPEN ||
        action.kind === AI_ACTION_KINDS.BUY_RESERVED
      )
        score += 20;
      if (
        action.kind === AI_ACTION_KINDS.TAKE_THREE ||
        action.kind === AI_ACTION_KINDS.TAKE_TWO
      )
        score -= 40;
      if (
        action.kind === AI_ACTION_KINDS.RESERVE_OPEN ||
        action.kind === AI_ACTION_KINDS.RESERVE_DECK
      )
        score -= 16;
    }

    return score !== 0 ? { score, reason: "节奏优先" } : null;
  },
};

const easyDriftScorer: LocalAiActionScorer = {
  id: "easy-drift",
  score(context, action) {
    if (context.difficulty.level !== "easy") return null;
    if (action.kind === AI_ACTION_KINDS.TAKE_THREE) {
      return { score: 26, reason: "简单难度更偏向先收集宝石" };
    }
    if (action.kind === AI_ACTION_KINDS.TAKE_TWO) {
      return { score: 18, reason: "简单难度偏好直接拿宝石" };
    }
    if (action.kind === AI_ACTION_KINDS.RESERVE_DECK) {
      return { score: 18, reason: "简单难度更容易盲抽预留" };
    }
    if (action.kind === AI_ACTION_KINDS.RESERVE_OPEN) {
      return { score: 8, reason: "简单难度容易提前预留" };
    }
    if (
      action.kind === AI_ACTION_KINDS.BUY_OPEN ||
      action.kind === AI_ACTION_KINDS.BUY_RESERVED
    ) {
      const cardId =
        typeof action.metadata?.cardId === "string"
          ? action.metadata.cardId
          : null;
      const card = cardId ? getCardDef(cardId) : null;
      if (!card) return null;
      return {
        score: card.points > 0 ? -160 : -260,
        reason: "简单难度更容易错过更优购买时机",
      };
    }
    return null;
  },
};

export const splendorScorers: LocalAiActionScorer[] = [
  buyCardScorer,
  takeGemsScorer,
  reserveScorer,
  discardScorer,
  chooseNobleScorer,
];

// 扩展评分器列表 (困难/专家使用)
export const extendedScorers: LocalAiActionScorer[] = [
  ...splendorScorers,
  opponentThreatScorer,
  nobleProgressScorer,
  tempoScorer,
];

export const expertScorers: LocalAiActionScorer[] = [
  ...extendedScorers,
  expertTempoScorer,
  expertEndgameRaceScorer,
];

export const easyDriftScorerRef = easyDriftScorer;

// --- 策略工厂 ---
function pickEasyWeightedActionId(
  context: AiDecisionContext,
  decision: AiActionDecision | null,
): string | null {
  const evaluations = (
    decision?.providerMetadata as
      | { evaluations?: Array<Record<string, unknown>> }
      | undefined
  )?.evaluations;
  if (!Array.isArray(evaluations) || evaluations.length <= 1) return null;

  const scored = evaluations
    .map((entry) => ({
      actionId:
        typeof entry.actionId === "string" ? (entry.actionId as string) : null,
      finalScore:
        typeof entry.finalScore === "number" && Number.isFinite(entry.finalScore)
          ? (entry.finalScore as number)
          : null,
    }))
    .filter(
      (entry): entry is { actionId: string; finalScore: number } =>
        entry.actionId !== null && entry.finalScore !== null,
    )
    .sort((left, right) => right.finalScore - left.finalScore);
  if (scored.length <= 1) return null;

  const shortlistSize = Math.max(
    1,
    Math.min(context.difficulty.shortlistSize, scored.length),
  );
  const shortlist = scored.slice(0, shortlistSize);
  if (shortlist.length <= 1) return null;

  let bestActionId: string | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const candidate of shortlist) {
    const action = context.legalActions.find(
      (item) => item.actionId === candidate.actionId,
    );
    if (!action) continue;

    const weight = Math.max(1, candidate.finalScore + 100);
    const noise = buildDeterministicAiNoise(context, action, "easy-pick");
    const value = weight * (1 + noise);
    if (value > bestValue) {
      bestValue = value;
      bestActionId = candidate.actionId;
    }
  }

  return bestActionId;
}

function createSplendorLookaheadPolicy(args: {
  id: AiDifficultyLevel;
  scorers: LocalAiActionScorer[];
  randomnessOverride?: number;
  enableProjection?: boolean;
  weightedRandom?: boolean;
  projectionCandidateLoop?: SplendorProjectionCandidateLoopConfig;
}): LocalAiPolicy {
  const basePolicy = createLookaheadLocalAiPolicy({
    id: args.id,
    scorers: args.scorers,
    maxReasonCount: 3,
    ...(args.enableProjection
      ? {
          rankProjectionCandidate({ context, action, baseEvaluation }) {
            return rankSplendorProjectionCandidate({
              context,
              action,
              baseEvaluation,
            });
          },
          projectAction({ context, action }) {
            return projectSplendorAction({ context, action });
          },
          candidateLoop: {
            enabled: true,
            maxIterations: args.projectionCandidateLoop?.maxIterations ?? 3,
            batchSize: args.projectionCandidateLoop?.batchSize ?? 4,
            stopOnUtility: args.projectionCandidateLoop?.stopOnUtility ?? 0.9,
          },
        }
      : {}),
  });

  if (args.randomnessOverride === undefined) {
    return basePolicy;
  }

  return {
    id: args.id,
    decide(context) {
      const nextContext = {
        ...context,
        difficulty: {
          ...context.difficulty,
          randomness: args.randomnessOverride ?? context.difficulty.randomness,
        },
      };
      const picked = basePolicy.decide(nextContext);
      const applyWeightedRandom = (decision: AiActionDecision | null) => {
        if (!args.weightedRandom || !decision) return decision;
        const actionId = pickEasyWeightedActionId(nextContext, decision);
        return actionId ? { ...decision, actionId } : decision;
      };

      if (picked && typeof (picked as Promise<AiActionDecision | null>).then === "function") {
        return (picked as Promise<AiActionDecision | null>).then(
          applyWeightedRandom,
        );
      }
      return applyWeightedRandom(picked as AiActionDecision | null);
    },
  };
}

// --- Policies ---
const easyPolicy = createSplendorLookaheadPolicy({
  id: "easy",
  scorers: [...splendorScorers, easyDriftScorer],
  randomnessOverride: 26,
  weightedRandom: true,
});

const normalPolicy = createSplendorLookaheadPolicy({
  id: "normal",
  scorers: extendedScorers,
  randomnessOverride: 0,
  enableProjection: true,
  projectionCandidateLoop: {
    maxIterations: 2,
    batchSize: 2,
    stopOnUtility: 0.95,
  },
});

const hardPolicy = createSplendorLookaheadPolicy({
  id: "hard",
  scorers: extendedScorers,
  randomnessOverride: 3,
  enableProjection: true,
  projectionCandidateLoop: {
    maxIterations: 4,
    batchSize: 4,
    stopOnUtility: 0.88,
  },
});

const expertPolicy = createSplendorLookaheadPolicy({
  id: "expert",
  scorers: expertScorers,
  randomnessOverride: 0,
  enableProjection: true,
  projectionCandidateLoop: {
    maxIterations: 5,
    batchSize: 5,
    stopOnUtility: 0.86,
  },
});

const difficultyPolicyByLevel: Record<AiDifficultyLevel, LocalAiPolicy> = {
  easy: easyPolicy,
  normal: normalPolicy,
  hard: hardPolicy,
  expert: expertPolicy,
};

const baselineLocalPolicy: LocalAiPolicy = {
  id: "baseline",
  decide(context) {
    const policy =
      difficultyPolicyByLevel[context.difficulty.level] ?? normalPolicy;
    return policy.decide(context);
  },
};

// --- Runtime ---
export const splendorAiRuntime: GameAiRuntime = {
  gameId: "splendor",
  buildLegalActions: buildSplendorAiLegalActions,
  defaultMinimumActionDelayMs: 1000,
  buildFeatureSnapshot(args) {
    return buildSplendorFeatureSnapshot(args) as Record<string, unknown> | null;
  },
  resolveOnlineDecisionVisibility(args) {
    const sharedInteraction = args.sharedState.sys?.interaction as {
      current?: unknown;
      isBlocked?: unknown;
    } | undefined;
    if (sharedInteraction?.current || sharedInteraction?.isBlocked === true) {
      return undefined;
    }

    const sharedResponseWindow = args.sharedState.sys?.responseWindow as {
      current?: unknown;
    } | undefined;
    if (sharedResponseWindow?.current) {
      return undefined;
    }

    const core = args.sharedState.core as {
      hostStarted?: unknown;
      currentPlayer?: unknown;
      pendingResolution?: { type?: unknown } | undefined;
    } | undefined;
    if (core?.hostStarted !== true || core.currentPlayer !== args.playerId) {
      return undefined;
    }

    const pendingResolutionType =
      typeof core.pendingResolution?.type === "string"
        ? core.pendingResolution.type
        : null;
    if (
      pendingResolutionType !== null &&
      pendingResolutionType !== "discardToLimit" &&
      pendingResolutionType !== "chooseNoble"
    ) {
      return undefined;
    }

    return "shared";
  },
  localPolicies: {
    baseline: baselineLocalPolicy,
    easy: easyPolicy,
    normal: normalPolicy,
    hard: hardPolicy,
    expert: expertPolicy,
  },
  defaultLocalPolicyId: "baseline",
};
