import type { RandomFn } from '../../../../engine/types';
import type { CardPreviewRef } from '../../../../core';
import type { AbilityCard } from '../../types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import {
    COMMON_CARDS,
    GUNSLINGER_COMMON_ATLAS_INDEX,
    injectCommonCardPreviewRefs,
} from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS, TOKEN_IDS } from '../../domain/ids';
import {
    BOUNTY_HUNTER_2,
    DEADEYE_2,
    DUEL_2,
    FAN_THE_HAMMER_2,
    GUNSLINGER_SFX_BOUNTY,
    GUNSLINGER_SFX_DRAW,
    GUNSLINGER_SFX_HEAVY,
    GUNSLINGER_SFX_LOADED,
    GUNSLINGER_SFX_SHOT,
    GUNSLINGER_SFX_ULTIMATE,
    QUICK_DRAW_UPGRADED,
    REVOLVER_2,
    SHOWDOWN_2,
    SHOWDOWN_3,
    TAKE_COVER_2,
} from './abilities';

const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

const GUNSLINGER_CARD_ATLAS_ID = DICETHRONE_CARD_ATLAS_IDS.GUNSLINGER;

const atlasPreview = (index: number): CardPreviewRef => ({
    type: 'atlas',
    atlasId: GUNSLINGER_CARD_ATLAS_ID,
    index,
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

const gunslingerAtlasRef = (previewIndex: number, sourceAtlasIndex: number = previewIndex) => ({
    previewRef: atlasPreview(previewIndex),
    sourceAtlasIndex,
});

export const GUNSLINGER_CARDS: AbilityCard[] = [
    {
        id: 'upgrade-revolver-2',
        name: cardText('upgrade-revolver-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-revolver-2', 'description'),
        sfxKey: GUNSLINGER_SFX_SHOT,
        ...gunslingerAtlasRef(18),
        effects: [replaceAbility('revolver', REVOLVER_2, 2, cardText('upgrade-revolver-2', 'description'))],
    },
    {
        id: 'upgrade-bounty-hunter-2',
        name: cardText('upgrade-bounty-hunter-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-bounty-hunter-2', 'description'),
        sfxKey: GUNSLINGER_SFX_SHOT,
        ...gunslingerAtlasRef(19),
        effects: [replaceAbility('bounty-hunter', BOUNTY_HUNTER_2, 2, cardText('upgrade-bounty-hunter-2', 'description'))],
    },
    {
        id: 'upgrade-showdown-2',
        name: cardText('upgrade-showdown-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-showdown-2', 'description'),
        sfxKey: GUNSLINGER_SFX_HEAVY,
        ...gunslingerAtlasRef(20),
        effects: [replaceAbility('showdown', SHOWDOWN_2, 2, cardText('upgrade-showdown-2', 'description'))],
    },
    {
        id: 'upgrade-showdown-3',
        name: cardText('upgrade-showdown-3', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-showdown-3', 'description'),
        sfxKey: GUNSLINGER_SFX_HEAVY,
        ...gunslingerAtlasRef(21),
        effects: [replaceAbility('showdown', SHOWDOWN_3, 3, cardText('upgrade-showdown-3', 'description'))],
    },
    {
        id: 'upgrade-fan-the-hammer-2',
        name: cardText('upgrade-fan-the-hammer-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-fan-the-hammer-2', 'description'),
        sfxKey: GUNSLINGER_SFX_HEAVY,
        ...gunslingerAtlasRef(22),
        effects: [replaceAbility('fan-the-hammer', FAN_THE_HAMMER_2, 2, cardText('upgrade-fan-the-hammer-2', 'description'))],
    },
    {
        id: 'upgrade-take-cover-2',
        name: cardText('upgrade-take-cover-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-take-cover-2', 'description'),
        sfxKey: GUNSLINGER_SFX_SHOT,
        ...gunslingerAtlasRef(23),
        effects: [replaceAbility('take-cover', TAKE_COVER_2, 2, cardText('upgrade-take-cover-2', 'description'))],
    },
    {
        id: 'upgrade-deadeye-2',
        name: cardText('upgrade-deadeye-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-deadeye-2', 'description'),
        sfxKey: GUNSLINGER_SFX_HEAVY,
        ...gunslingerAtlasRef(24),
        effects: [replaceAbility('deadeye', DEADEYE_2, 2, cardText('upgrade-deadeye-2', 'description'))],
    },
    {
        id: 'upgrade-duel-2',
        name: cardText('upgrade-duel-2', 'name'),
        type: 'upgrade',
        cpCost: 3,
        timing: 'main',
        description: cardText('upgrade-duel-2', 'description'),
        sfxKey: GUNSLINGER_SFX_HEAVY,
        ...gunslingerAtlasRef(25),
        effects: [replaceAbility('duel', DUEL_2, 2, cardText('upgrade-duel-2', 'description'))],
    },
    {
        id: 'upgrade-quick-draw',
        name: cardText('upgrade-quick-draw', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-quick-draw', 'description'),
        sfxKey: GUNSLINGER_SFX_DRAW,
        ...gunslingerAtlasRef(26),
        effects: [replaceAbility('quick-draw', QUICK_DRAW_UPGRADED, 2, cardText('upgrade-quick-draw', 'description'))],
    },
    {
        id: 'card-wanted',
        name: cardText('card-wanted', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-wanted', 'description'),
        sfxKey: GUNSLINGER_SFX_BOUNTY,
        ...gunslingerAtlasRef(27),
        effects: [
            custom('gunslinger-card-wanted', cardText('card-wanted', 'description')),
        ],
    },
    {
        id: 'card-spin-the-chamber',
        name: cardText('card-spin-the-chamber', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-spin-the-chamber', 'description'),
        sfxKey: GUNSLINGER_SFX_LOADED,
        ...gunslingerAtlasRef(28),
        effects: [
            grantToken('self', TOKEN_IDS.LOADED, 1, cardText('card-spin-the-chamber', 'description')),
        ],
    },
    {
        id: 'card-high-noon',
        name: cardText('card-high-noon', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-high-noon', 'description'),
        sfxKey: GUNSLINGER_SFX_SHOT,
        ...gunslingerAtlasRef(29),
        effects: [
            custom('gunslinger-card-high-noon', cardText('card-high-noon', 'description')),
        ],
    },
    {
        id: 'card-wild-west',
        name: cardText('card-wild-west', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'roll',
        description: cardText('card-wild-west', 'description'),
        sfxKey: GUNSLINGER_SFX_SHOT,
        ...gunslingerAtlasRef(30),
        isAttackModifier: true,
        playCondition: { requireDiceExists: true, requireHasRolled: true, requireLoaded: true },
        effects: [
            // 说明：这里的“该骰子”指的是你后续花费 Loaded 时触发的装填奖励骰结算中的那颗骰子（不是主攻击骰盘）。
            // 注意：本效果挂载到装填奖励骰的后续结算上；玩家交互由右侧 2D 骰盘承接，卡面描述不强调“下一次”，这里保持与 i18n 文案一致，避免双源漂移。
            custom('gunslinger-card-wild-west', cardText('card-wild-west', 'description')),
        ],
    },
    {
        id: 'card-eat-my-lead',
        name: cardText('card-eat-my-lead', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'roll',
        description: cardText('card-eat-my-lead', 'description'),
        sfxKey: GUNSLINGER_SFX_ULTIMATE,
        ...gunslingerAtlasRef(31),
        isAttackModifier: true,
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [
            custom('gunslinger-card-eat-my-lead', cardText('card-eat-my-lead', 'description')),
        ],
    },

    ...injectCommonCardPreviewRefs(
        COMMON_CARDS,
        DICETHRONE_CARD_ATLAS_IDS.GUNSLINGER,
        GUNSLINGER_COMMON_ATLAS_INDEX,
    ),
];

export const getGunslingerStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck = GUNSLINGER_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
