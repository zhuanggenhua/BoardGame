import { OFFICIAL_FANTASY_REALMS_CARDS } from './data/cards';

export type FantasyRealmsSuit =
    | '军队'
    | '神器'
    | '巨兽'
    | '烈焰'
    | '洪流'
    | '土地'
    | '领袖'
    | '武器'
    | '天象'
    | '野牌'
    | '法师';

export type TableCard = {
    id: string;
    suit: FantasyRealmsSuit;
    toneClass: string;
    name: string;
    score: number;
    text: string;
};

export type FantasyRealmsScoreLine = {
    label: string;
    value: number;
};

export type FantasyRealmsFocusInsight = {
    kicker: string;
    description: string;
    estimatedDelta: number;
    tips: string[];
};

export const FANTASY_REALMS_HAND_CARD_SLOTS = 7;
export const FANTASY_REALMS_DISCARD_END_THRESHOLD = 12;

export const RUNTIME_DECK_CARDS: TableCard[] = OFFICIAL_FANTASY_REALMS_CARDS.map((card) => ({ ...card }));
// Foundation fallback 只取官方卡表中的前 14 张做静态卡位样例，不代表正式对局中的公开区规则。
export const PUBLIC_CARDS: TableCard[] = RUNTIME_DECK_CARDS.slice(0, 7).map((card) => ({ ...card }));
export const HAND_CARDS: TableCard[] = RUNTIME_DECK_CARDS.slice(7, 14).map((card) => ({ ...card }));

export const FANTASY_REALMS_FOUNDATION_COPY = {
    discardZoneTitle: '公开弃牌堆',
    discardZoneHint: '双人变体中可直接拿 1 张',
    handHint: '手牌上限 7 张，空槽位持续保留',
};

const FOCUS_INSIGHTS_BY_CARD_ID: Record<string, FantasyRealmsFocusInsight> = {
    'weather-blizzard': {
        kicker: '建议观察',
        description: 'Blizzard 在双人前期更像一张高风险公开牌：基础分很高，但会压制 Flood，同时拖累 Army、Leader、Beast 与 Flame。除非你已经明显转向天象线，否则不要只因为 30 分就盲拿。',
        estimatedDelta: 9,
        tips: [
            '前期先看弃牌堆里是否已经出现 Rainstorm、Whirlwind 这类同系牌。',
            '如果当前手里已有 Army/Beast 组合，先别急着拿这张。',
        ],
    },
    'flame-fire-elemental': {
        kicker: '当前冲突',
        description: 'Fire Elemental 本身基础分低，价值主要来自同花色叠加。若弃牌堆还没出现更多 Flame，这张更像过渡牌，不值得死保。',
        estimatedDelta: -2,
        tips: [
            '只有当你准备追 Forge / Lightning / Wildfire 时，它才会明显变强。',
            '若公开弃牌已经有高分单卡，Fire Elemental 往往是优先弃牌候选。',
        ],
    },
};

export const EMPTY_FOCUS_INSIGHT: FantasyRealmsFocusInsight = {
    kicker: '双人变体',
    description: '当前先按双人核心回合推进：手牌未满 7 时可直接拿弃牌，或从牌库摸 2 弃 1；满 7 后改为常规抽 1 弃 1。',
    estimatedDelta: 0,
    tips: [
        '先尽快把手牌补到 7 张，再开始做稳定组合。',
        '弃牌堆是公开信息，前期拿明牌往往比盲抽更稳。',
    ],
};

export function cloneTableCards(cards: TableCard[]): TableCard[] {
    return cards.map((card) => ({ ...card }));
}

export function createRuntimeDeck(): TableCard[] {
    return cloneTableCards(RUNTIME_DECK_CARDS);
}

export function resolveFocusInsight(card?: TableCard | null): FantasyRealmsFocusInsight {
    if (!card) {
        return {
            ...EMPTY_FOCUS_INSIGHT,
            tips: [...EMPTY_FOCUS_INSIGHT.tips],
        };
    }

    const preset = FOCUS_INSIGHTS_BY_CARD_ID[card.id];
    if (preset) {
        return {
            ...preset,
            tips: [...preset.tips],
        };
    }

    return {
        kicker: '当前焦点',
        description: `${card.name} 当前更像一张需要结合 ${card.suit} 联动来判断去留的牌。先看它与已公开弃牌和现有手牌是否能形成稳定加分。`,
        estimatedDelta: card.score >= 10 ? 3 : 1,
        tips: [
            '优先判断它是否能和现有高分线形成稳定组合。',
            '如果只是补点数但会制造冲突，宁可继续等待更合拍的公开弃牌。',
        ],
    };
}
