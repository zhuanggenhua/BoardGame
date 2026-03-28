import type { RandomFn } from '../../../../engine/types';
import type { CardPreviewRef } from '../../../../core';
import type { AbilityCard } from '../../types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { COMMON_CARDS } from '../../domain/commonCards';
import { TOKEN_IDS } from '../../domain/ids';
import {
    BOUNTY_HUNTER_2,
    DEADEYE_2,
    DUEL_2,
    FAN_THE_HAMMER_2,
    QUICK_DRAW_UPGRADED,
    REVOLVER_2,
    SHOWDOWN_2,
    SHOWDOWN_3,
    TAKE_COVER_2,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

const GUNSLINGER_CARD_CROP_BASE = 'dicethrone/images/gunslinger/crops/ability-cards';

const cropPreview = (fileName: string): CardPreviewRef => ({
    type: 'image',
    src: `${GUNSLINGER_CARD_CROP_BASE}/${fileName}`,
});

const replaceAbility = (
    targetAbilityId: string,
    newAbilityDef: AbilityDef,
    newAbilityLevel: number,
    description: string,
): AbilityEffect => ({
    description,
    action: { type: 'replaceAbility', target: 'self', targetAbilityId, newAbilityDef, newAbilityLevel },
    timing: 'immediate',
});

const grantToken = (
    target: 'self' | 'opponent',
    tokenId: string,
    value: number,
    description: string,
): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target, tokenId, value },
    timing: 'immediate',
});

const custom = (customActionId: string, description: string): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId },
    timing: 'immediate',
});

const COMMON_CARD_CROP_FILES: Record<string, string> = {
    'card-transfer-status': 'slot-00.webp',
    'card-what-status': 'slot-01.webp',
    'card-one-throw-fortune': 'slot-02.webp',
    'card-get-away': 'slot-03.webp',
    'card-super-double': 'slot-04.webp',
    'card-double': 'slot-05.webp',
    'card-bye-bye': 'slot-06.webp',
    'card-flick': 'slot-07.webp',
    'card-boss-generous': 'slot-08.webp',
    'card-next-time': 'slot-09.webp',
    'card-unexpected': 'slot-10.webp',
    'card-worthy-of-me': 'slot-11.webp',
    'card-surprise': 'slot-12.webp',
    'card-me-too': 'slot-13.webp',
    'card-i-can-again': 'slot-14.webp',
    'card-give-hand': 'slot-15.webp',
    'card-just-this': 'slot-16.webp',
    'card-play-six': 'slot-17.webp',
};

const injectGunslingerCommonPreviewRefs = (cards: AbilityCard[]): AbilityCard[] =>
    cards.map(card => {
        const cropFile = COMMON_CARD_CROP_FILES[card.id];
        if (!cropFile) return card;
        return { ...card, previewRef: cropPreview(cropFile) };
    });

export const GUNSLINGER_CARDS: AbilityCard[] = [
    {
        id: 'upgrade-revolver-2',
        name: cardText('upgrade-revolver-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-revolver-2', 'description'),
        previewRef: cropPreview('slot-18.webp'),
        effects: [replaceAbility('revolver', REVOLVER_2, 2, '升级左轮手枪至 II 级。')],
    },
    {
        id: 'upgrade-bounty-hunter-2',
        name: cardText('upgrade-bounty-hunter-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-bounty-hunter-2', 'description'),
        previewRef: cropPreview('slot-19.webp'),
        effects: [replaceAbility('bounty-hunter', BOUNTY_HUNTER_2, 2, '升级赏金猎人至 II 级。')],
    },
    {
        id: 'upgrade-showdown-2',
        name: cardText('upgrade-showdown-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-showdown-2', 'description'),
        previewRef: cropPreview('slot-20.webp'),
        effects: [replaceAbility('showdown', SHOWDOWN_2, 2, '升级摊到牌面至 II 级。')],
    },
    {
        id: 'upgrade-showdown-3',
        name: cardText('upgrade-showdown-3', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-showdown-3', 'description'),
        previewRef: cropPreview('slot-21.webp'),
        effects: [replaceAbility('showdown', SHOWDOWN_3, 3, '升级摊到牌面至 III 级。')],
    },
    {
        id: 'upgrade-fan-the-hammer-2',
        name: cardText('upgrade-fan-the-hammer-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-fan-the-hammer-2', 'description'),
        previewRef: cropPreview('fan-the-hammer-2.webp'),
        effects: [replaceAbility('fan-the-hammer', FAN_THE_HAMMER_2, 2, '升级左轮速射至 II 级。')],
    },
    {
        id: 'card-pistol-whip',
        name: cardText('card-pistol-whip', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-pistol-whip', 'description'),
        previewRef: cropPreview('pistol-whip.webp'),
        effects: [
            grantToken('self', TOKEN_IDS.EVASIVE, 1, '获得 1 个闪避。'),
            custom('gunslinger-card-pistol-whip', '选择 1 位敌方玩家，使其获得击倒并受到 1 点伤害。'),
        ],
    },
    {
        id: 'upgrade-take-cover-2',
        name: cardText('upgrade-take-cover-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-take-cover-2', 'description'),
        previewRef: cropPreview('take-cover-2.webp'),
        effects: [replaceAbility('take-cover', TAKE_COVER_2, 2, '升级掩护射击至 II 级。')],
    },
    {
        id: 'card-mark-the-target',
        name: cardText('card-mark-the-target', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('card-mark-the-target', 'description'),
        previewRef: cropPreview('mark-the-target.webp'),
        effects: [
            grantToken('self', TOKEN_IDS.EVASIVE, 2, '获得 2 个闪避。'),
            custom('gunslinger-card-mark-the-target', '选择 1 位敌方玩家，使其获得 1 个赏金。'),
        ],
    },
    {
        id: 'upgrade-deadeye-2',
        name: cardText('upgrade-deadeye-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-deadeye-2', 'description'),
        previewRef: cropPreview('deadeye-2.webp'),
        effects: [replaceAbility('deadeye', DEADEYE_2, 2, '升级死亡之眼至 II 级。')],
    },
    {
        id: 'card-the-law',
        name: cardText('card-the-law', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-the-law', 'description'),
        previewRef: cropPreview('the-law.webp'),
        effects: [
            grantToken('self', TOKEN_IDS.EVASIVE, 1, '获得 1 个闪避。'),
            custom('gunslinger-card-the-law', '选择至多 2 位目标玩家。每名目标玩家获得 1 个赏金并受到 1 层击倒。'),
        ],
    },
    {
        id: 'upgrade-duel-2',
        name: cardText('upgrade-duel-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-duel-2', 'description'),
        previewRef: cropPreview('slot-25.webp'),
        effects: [replaceAbility('duel', DUEL_2, 2, '升级对决至 II 级。')],
    },
    {
        id: 'upgrade-quick-draw',
        name: cardText('upgrade-quick-draw', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-quick-draw', 'description'),
        previewRef: cropPreview('slot-26.webp'),
        effects: [replaceAbility('quick-draw', QUICK_DRAW_UPGRADED, 2, '升级快速拔枪至 II 级。')],
    },
    {
        id: 'card-wanted',
        name: cardText('card-wanted', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-wanted', 'description'),
        previewRef: cropPreview('slot-27.webp'),
        effects: [
            custom('gunslinger-card-wanted', '选择 1 位敌方玩家，使其获得 1 个赏金。'),
        ],
    },
    {
        id: 'card-spin-the-chamber',
        name: cardText('card-spin-the-chamber', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-spin-the-chamber', 'description'),
        previewRef: cropPreview('slot-28.webp'),
        effects: [
            grantToken('self', TOKEN_IDS.LOADED, 1, '获得 1 个装填。'),
        ],
    },
    {
        id: 'card-high-noon',
        name: cardText('card-high-noon', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-high-noon', 'description'),
        previewRef: cropPreview('slot-29.webp'),
        effects: [
            custom('gunslinger-card-high-noon', '选择 1 位敌方玩家，掷 1 颗骰子并按结果结算。'),
        ],
    },
    {
        id: 'card-wild-west',
        name: cardText('card-wild-west', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-wild-west', 'description'),
        previewRef: cropPreview('slot-30.webp'),
        isAttackModifier: true,
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [
            custom('gunslinger-card-wild-west', '本次攻击伤害 +1。'),
        ],
    },
    {
        id: 'card-eat-my-lead',
        name: cardText('card-eat-my-lead', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-eat-my-lead', 'description'),
        previewRef: cropPreview('slot-31.webp'),
        isAttackModifier: true,
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [
            custom('gunslinger-card-eat-my-lead', '额外掷 5 颗骰子；每个子弹令本次攻击 +1。若加值大于 4，再施加击倒。'),
        ],
    },

    // 枪手卡图顺序与默认 COMMON_CARDS 图集顺序不一致，且包含拆卡位，因此统一使用裁图预览。
    ...injectGunslingerCommonPreviewRefs(COMMON_CARDS),
];

export const getGunslingerStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck = GUNSLINGER_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
