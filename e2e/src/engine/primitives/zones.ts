/**
 * 卡牌区域操作工具函数
 *
 * 提供 hand/deck/discard 等区域间的标准操作。
 * 从 systems/CardSystem/operations.ts 提取，API 完全兼容。
 *
 * 设计原则：
 * - 纯函数，不可变，返回新数组
 * - 泛型，不依赖具体卡牌类型（只要求 { id: string }）
 * - 不抛异常，操作失败返回原数据 + found: false
 */

// ============================================================================
// 基础约束
// ============================================================================

/** 最小卡牌约束：只要有 id 即可 */
export interface CardLike {
  id: string;
}

// ============================================================================
// 单区域操作
// ============================================================================

/** 从数组中移除指定 ID 的卡牌，返回 { card, remaining } */
export function removeCard<T extends CardLike>(
  cards: T[],
  cardId: string,
): { card: T | undefined; remaining: T[] } {
  const index = cards.findIndex(c => c.id === cardId);
  if (index === -1) return { card: undefined, remaining: cards };
  const card = cards[index];
  const remaining = [...cards.slice(0, index), ...cards.slice(index + 1)];
  return { card, remaining };
}

/** 从数组顶部抽取 N 张卡牌 */
export function drawFromTop<T extends CardLike>(
  cards: T[],
  count: number,
): { drawn: T[]; remaining: T[] } {
  const actual = Math.min(count, cards.length);
  return {
    drawn: cards.slice(0, actual),
    remaining: cards.slice(actual),
  };
}

/** 查看牌堆顶部 N 张卡牌（不移除） */
export function peekCards<T extends CardLike>(
  cards: T[],
  count: number,
): T[] {
  return cards.slice(0, Math.min(count, cards.length));
}

/** 查找卡牌 */
export function findCard<T extends CardLike>(
  cards: T[],
  cardId: string,
): T | undefined {
  return cards.find(c => c.id === cardId);
}

// ============================================================================
// 双区域操作（from → to）
// ============================================================================

export interface MoveResult<T extends CardLike> {
  /** 操作是否成功（卡牌是否找到） */
  found: boolean;
  /** 被移动的卡牌 */
  card: T | undefined;
  /** 来源区域（移除后） */
  from: T[];
  /** 目标区域（添加后） */
  to: T[];
}

/** 从 from 移动一张卡到 to 末尾 */
export function moveCard<T extends CardLike>(
  from: T[],
  to: T[],
  cardId: string,
): MoveResult<T> {
  const { card, remaining } = removeCard(from, cardId);
  if (!card) return { found: false, card: undefined, from, to };
  return {
    found: true,
    card,
    from: remaining,
    to: [...to, card],
  };
}

// ============================================================================
// 语义化快捷函数
// ============================================================================

/** 从牌库抽牌到手牌 */
export function drawCards<T extends CardLike>(
  deck: T[],
  hand: T[],
  count: number,
): { deck: T[]; hand: T[] } {
  const { drawn, remaining } = drawFromTop(deck, count);
  return {
    deck: remaining,
    hand: [...hand, ...drawn],
  };
}

/** 从手牌弃置到弃牌堆 */
export function discardFromHand<T extends CardLike>(
  hand: T[],
  discard: T[],
  cardId: string,
): MoveResult<T> {
  return moveCard(hand, discard, cardId);
}

/** 从手牌打出（移到弃牌堆），同 discardFromHand 但语义更清晰 */
export function playFromHand<T extends CardLike>(
  hand: T[],
  discard: T[],
  cardId: string,
): MoveResult<T> {
  return moveCard(hand, discard, cardId);
}

/** 从弃牌堆回收到手牌 */
export function recoverFromDiscard<T extends CardLike>(
  discard: T[],
  hand: T[],
  cardId: string,
): MoveResult<T> {
  return moveCard(discard, hand, cardId);
}

/** 从手牌移除（不进弃牌堆，如放到棋盘） */
export function removeFromHand<T extends CardLike>(
  hand: T[],
  cardId: string,
): { card: T | undefined; hand: T[] } {
  const { card, remaining } = removeCard(hand, cardId);
  return { card, hand: remaining };
}

/** 从弃牌堆移除（如召唤到棋盘） */
export function removeFromDiscard<T extends CardLike>(
  discard: T[],
  cardId: string,
): { card: T | undefined; discard: T[] } {
  const { card, remaining } = removeCard(discard, cardId);
  return { card, discard: remaining };
}

/** 洗牌（需要外部提供 shuffle 函数以保证确定性） */
export function shuffleDeck<T extends CardLike>(
  deck: T[],
  shuffleFn: <U>(arr: U[]) => U[],
): T[] {
  return shuffleFn([...deck]);
}

/** 将弃牌堆洗入牌库 */
export function reshuffleDiscardIntoDeck<T extends CardLike>(
  deck: T[],
  discard: T[],
  shuffleFn: <U>(arr: U[]) => U[],
): { deck: T[]; discard: T[] } {
  const combined = [...deck, ...discard];
  return {
    deck: shuffleFn(combined),
    discard: [],
  };
}
