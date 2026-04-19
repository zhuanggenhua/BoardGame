/**
 * 通用重抽 (Mulligan) 工具
 *
 * 提供与游戏无关的纯函数，用于起始手牌重抽逻辑。
 * 任何桌游只需传入不同的条件函数即可复用。
 *
 * @example SmashUp: 若手牌无随从则重抽一次
 * ```ts
 * autoMulligan(hand, deck, h => !h.some(c => c.type === 'minion'), 5, random.shuffle);
 * ```
 *
 * @future 交互式重抽模式 (MulliganMode = 'interactive')
 * 当前仅实现自动模式。未来若需要玩家选择是否重抽，可：
 * 1. 新增 mulligan 阶段插入 FlowSystem 的 PHASE_ORDER
 * 2. 新增 MULLIGAN_DECIDE 命令（payload: { accept: boolean }）
 * 3. 在 onPhaseEnter(mulligan) 中用 checkMulliganEligible 检查资格
 * 4. 在 onAutoContinueCheck(mulligan) 中等待所有资格玩家决策后推进
 * 参见 SmashUp 官方规则："you may show your hand"——原始规则为可选。
 */

// ============================================================================
// 类型
// ============================================================================

/** 重抽执行结果 */
export interface MulliganResult<T> {
    /** 重抽后的手牌 */
    hand: T[];
    /** 重抽后的牌库 */
    deck: T[];
}

/** 自动重抽结果（含重抽次数统计） */
export interface AutoMulliganResult<T> extends MulliganResult<T> {
    /** 实际执行的重抽次数（0 = 未触发） */
    mulliganCount: number;
}

/**
 * @future 重抽模式
 * - 'auto': 条件满足时自动执行（当前实现）
 * - 'interactive': 由玩家选择是否重抽（未来实现）
 */
export type MulliganMode = 'auto' | 'interactive';

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 执行一次重抽：将手牌全部洗回牌库，洗混后重新抽取。
 *
 * @param hand     当前手牌
 * @param deck     当前牌库
 * @param drawCount 重抽张数
 * @param shuffle  洗牌函数（必须返回新数组）
 * @returns 重抽后的 hand 和 deck
 */
export function performMulligan<T>(
    hand: T[],
    deck: T[],
    drawCount: number,
    shuffle: <U>(arr: U[]) => U[],
): MulliganResult<T> {
    // 手牌洗回牌库
    const combined = [...deck, ...hand];
    const shuffled = shuffle(combined);

    // 从顶部抽取
    const actualDraw = Math.min(drawCount, shuffled.length);
    const newHand = shuffled.slice(0, actualDraw);
    const newDeck = shuffled.slice(actualDraw);

    return { hand: newHand, deck: newDeck };
}

/**
 * 检查手牌是否满足重抽条件。
 *
 * @param hand      当前手牌
 * @param condition 条件函数——返回 true 表示「应该重抽」
 * @returns 是否有重抽资格
 */
export function checkMulliganEligible<T>(
    hand: T[],
    condition: (hand: T[]) => boolean,
): boolean {
    return condition(hand);
}

/**
 * 自动重抽：检查条件 → 满足则执行 performMulligan，最多执行 maxTimes 次。
 *
 * SmashUp 规则：若无随从可重抽一次（必须保留第二次），故 maxTimes=1。
 *
 * @param hand      当前手牌
 * @param deck      当前牌库
 * @param condition 条件函数——返回 true 表示「应该重抽」
 * @param drawCount 每次重抽的抽牌数
 * @param shuffle   洗牌函数
 * @param maxTimes  最大重抽次数（默认 1）
 * @returns 最终的 hand/deck + 实际重抽次数
 */
export function autoMulligan<T>(
    hand: T[],
    deck: T[],
    condition: (hand: T[]) => boolean,
    drawCount: number,
    shuffle: <U>(arr: U[]) => U[],
    maxTimes: number = 1,
): AutoMulliganResult<T> {
    let currentHand = hand;
    let currentDeck = deck;
    let count = 0;

    for (let i = 0; i < maxTimes; i++) {
        if (!checkMulliganEligible(currentHand, condition)) break;

        const result = performMulligan(currentHand, currentDeck, drawCount, shuffle);
        currentHand = result.hand;
        currentDeck = result.deck;
        count++;
    }

    return { hand: currentHand, deck: currentDeck, mulliganCount: count };
}
