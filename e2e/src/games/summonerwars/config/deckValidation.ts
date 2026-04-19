/**
 * 牌组验证模块
 *
 * 验证 DeckDraft 是否满足召唤师战争的牌组构建规则。
 * 规则参考：rule/ 目录下的规则文档
 */

import type { Card, UnitCard } from '../domain/types';

export interface DeckDraft {
    name: string;
    summoner: UnitCard | null;
    /** 自动填充的卡牌（起始单位、史诗事件、城门） */
    autoCards: Card[];
    /** 用户手动添加的卡牌（cardId → 数量） */
    manualCards: Map<string, { card: Card; count: number }>;
    /** 自由组卡模式（跳过符号匹配限制） */
    freeMode?: boolean;
}

export type DeckValidationRule =
    | 'summoner_count'
    | 'gate_10hp_count'
    | 'gate_5hp_count'
    | 'starting_units'
    | 'epic_events'
    | 'standard_events'
    | 'champions'
    | 'commons'
    | 'symbol_mismatch';

export interface DeckValidationError {
    rule: DeckValidationRule;
    message: string;
    current: number;
    expected: number;
}

export interface DeckValidationResult {
    valid: boolean;
    errors: DeckValidationError[];
}

// ============================================================================
// 牌组规则常量
// ============================================================================

/** 普通单位需要的总数 */
const REQUIRED_COMMONS = 16;
/** 冠军单位需要的总数 */
const REQUIRED_CHAMPIONS = 3;
/** 标准事件需要的总数 */
const REQUIRED_STANDARD_EVENTS = 6;
/** 同名普通单位最多张数 */
const MAX_SAME_COMMON = 4;
/** 同名冠军单位最多张数 */
const MAX_SAME_CHAMPION = 1;
/** 同名标准事件最多张数 */
const MAX_SAME_STANDARD_EVENT = 2;

// ============================================================================
// 验证函数
// ============================================================================

export function validateDeck(deck: DeckDraft): DeckValidationResult {
    const errors: DeckValidationError[] = [];

    // 1. 必须有召唤师
    if (!deck.summoner) {
        errors.push({
            rule: 'summoner_count',
            message: '牌组必须包含一个召唤师',
            current: 0,
            expected: 1,
        });
        return { valid: false, errors };
    }

    // 统计手动添加的卡牌
    let commonCount = 0;
    let championCount = 0;
    let standardEventCount = 0;

    deck.manualCards.forEach(({ card, count }) => {
        if (card.cardType === 'unit') {
            if (card.unitClass === 'common') commonCount += count;
            if (card.unitClass === 'champion') championCount += count;
        } else if (card.cardType === 'event') {
            if (card.eventType !== 'legendary') standardEventCount += count;
        }
    });

    // 2. 普通单位数量（必须恰好等于要求数量）
    if (commonCount !== REQUIRED_COMMONS) {
        errors.push({
            rule: 'commons',
            message: commonCount < REQUIRED_COMMONS
                ? `普通单位需要 ${REQUIRED_COMMONS} 张，当前 ${commonCount} 张`
                : `普通单位最多 ${REQUIRED_COMMONS} 张，当前 ${commonCount} 张`,
            current: commonCount,
            expected: REQUIRED_COMMONS,
        });
    }

    // 3. 冠军单位数量（必须恰好等于要求数量）
    if (championCount !== REQUIRED_CHAMPIONS) {
        errors.push({
            rule: 'champions',
            message: championCount < REQUIRED_CHAMPIONS
                ? `冠军单位需要 ${REQUIRED_CHAMPIONS} 个，当前 ${championCount} 个`
                : `冠军单位最多 ${REQUIRED_CHAMPIONS} 个，当前 ${championCount} 个`,
            current: championCount,
            expected: REQUIRED_CHAMPIONS,
        });
    }

    // 4. 标准事件数量（必须恰好等于要求数量）
    if (standardEventCount !== REQUIRED_STANDARD_EVENTS) {
        errors.push({
            rule: 'standard_events',
            message: standardEventCount < REQUIRED_STANDARD_EVENTS
                ? `标准事件需要 ${REQUIRED_STANDARD_EVENTS} 张，当前 ${standardEventCount} 张`
                : `标准事件最多 ${REQUIRED_STANDARD_EVENTS} 张，当前 ${standardEventCount} 张`,
            current: standardEventCount,
            expected: REQUIRED_STANDARD_EVENTS,
        });
    }

    // 5. 符号匹配检查：所有手动添加的卡牌必须与召唤师符号匹配（自由组卡模式跳过）
    if (!deck.freeMode) {
        const summonerSymbols = deck.summoner.deckSymbols;
        let mismatchCount = 0;
        deck.manualCards.forEach(({ card }) => {
            if (!getSymbolMatch(card, summonerSymbols)) {
                mismatchCount++;
            }
        });
        if (mismatchCount > 0) {
            errors.push({
                rule: 'symbol_mismatch',
                message: `${mismatchCount} 张卡牌的符号与召唤师不匹配`,
                current: mismatchCount,
                expected: 0,
            });
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * 检查是否可以添加指定卡牌到牌组
 */
export function canAddCard(deck: DeckDraft, card: Card): { allowed: boolean; reason?: string } {
    if (!deck.summoner) {
        return { allowed: false, reason: '请先选择一个召唤师' };
    }

    // 符号匹配检查（自由组卡模式跳过）
    if (!deck.freeMode && !getSymbolMatch(card, deck.summoner.deckSymbols)) {
        return { allowed: false, reason: '卡牌符号与召唤师不匹配' };
    }

    // 检查同名卡牌数量上限
    const existing = deck.manualCards.get(card.id);
    const currentCount = existing?.count ?? 0;

    if (card.cardType === 'unit') {
        if (card.unitClass === 'champion') {
            if (currentCount >= MAX_SAME_CHAMPION) {
                return { allowed: false, reason: `同名冠军单位最多 ${MAX_SAME_CHAMPION} 个` };
            }
            // 检查冠军总数上限
            let totalChampions = 0;
            deck.manualCards.forEach(({ card: c, count }) => {
                if (c.cardType === 'unit' && c.unitClass === 'champion') totalChampions += count;
            });
            if (totalChampions >= REQUIRED_CHAMPIONS) {
                return { allowed: false, reason: `冠军单位总数已达上限 ${REQUIRED_CHAMPIONS} 个` };
            }
        }
        if (card.unitClass === 'common') {
            if (currentCount >= MAX_SAME_COMMON) {
                return { allowed: false, reason: `同名普通单位最多 ${MAX_SAME_COMMON} 个` };
            }
            // 检查普通单位总数上限
            let totalCommons = 0;
            deck.manualCards.forEach(({ card: c, count }) => {
                if (c.cardType === 'unit' && c.unitClass === 'common') totalCommons += count;
            });
            if (totalCommons >= REQUIRED_COMMONS) {
                return { allowed: false, reason: `普通单位总数已达上限 ${REQUIRED_COMMONS} 张` };
            }
        }
    } else if (card.cardType === 'event') {
        if (card.eventType !== 'legendary') {
            if (currentCount >= MAX_SAME_STANDARD_EVENT) {
                return { allowed: false, reason: `同名标准事件最多 ${MAX_SAME_STANDARD_EVENT} 张` };
            }
            // 检查标准事件总数上限
            let totalStandardEvents = 0;
            deck.manualCards.forEach(({ card: c, count }) => {
                if (c.cardType === 'event' && c.eventType !== 'legendary') totalStandardEvents += count;
            });
            if (totalStandardEvents >= REQUIRED_STANDARD_EVENTS) {
                return { allowed: false, reason: `标准事件总数已达上限 ${REQUIRED_STANDARD_EVENTS} 张` };
            }
        }
    }

    return { allowed: true };
}

/**
 * 检查卡牌符号是否与召唤师匹配
 * 规则：卡牌的 deckSymbols 中至少有一个符号在召唤师的 deckSymbols 中
 * 特殊：传奇事件和城门无需符号匹配
 */
export function getSymbolMatch(card: Card, summonerSymbols: string[]): boolean {
    // 传奇事件无需符号匹配
    if (card.cardType === 'event' && card.eventType === 'legendary') return true;
    // 城门/建筑无需符号匹配
    if (card.cardType === 'structure') return true;
    // 召唤师自身无需匹配
    if (card.cardType === 'unit' && card.unitClass === 'summoner') return true;
    // 无符号的卡牌（如某些特殊卡）默认允许
    if (!card.deckSymbols || card.deckSymbols.length === 0) return true;

    return card.deckSymbols.some(s => summonerSymbols.includes(s));
}
