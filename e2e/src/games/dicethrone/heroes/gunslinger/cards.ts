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
    GUNSLINGER_SFX_HEAVY,
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
const GUNSLINGER_TOKEN_UPDATE_SFX = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';

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
        effects: [replaceAbility('revolver', REVOLVER_2, 2, '升级左轮手枪至 II 级。')],
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
        effects: [replaceAbility('bounty-hunter', BOUNTY_HUNTER_2, 2, '升级赏金猎人至 II 级。')],
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
        effects: [replaceAbility('showdown', SHOWDOWN_2, 2, '升级摊到牌面至 II 级。')],
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
        effects: [replaceAbility('showdown', SHOWDOWN_3, 3, '升级摊到牌面至 III 级。')],
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
        effects: [replaceAbility('fan-the-hammer', FAN_THE_HAMMER_2, 2, '升级左轮速射至 II 级。')],
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
        effects: [replaceAbility('take-cover', TAKE_COVER_2, 2, '升级掩护射击至 II 级。')],
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
        effects: [replaceAbility('deadeye', DEADEYE_2, 2, '升级死亡之眼至 II 级。')],
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
        effects: [replaceAbility('duel', DUEL_2, 2, '升级对决至 II 级。')],
    },
    {
        id: 'upgrade-quick-draw',
        name: cardText('upgrade-quick-draw', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-quick-draw', 'description'),
        sfxKey: GUNSLINGER_SFX_SHOT,
        ...gunslingerAtlasRef(26),
        effects: [replaceAbility('quick-draw', QUICK_DRAW_UPGRADED, 2, '升级快速拔枪至 II 级。')],
    },
    {
        id: 'card-wanted',
        name: cardText('card-wanted', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('card-wanted', 'description'),
        sfxKey: GUNSLINGER_TOKEN_UPDATE_SFX,
        ...gunslingerAtlasRef(27),
        effects: [
            custom('gunslinger-card-wanted', '选择 1 位玩家，使其获得 1 个赏金。'),
        ],
    },
    {
        id: 'card-spin-the-chamber',
        name: cardText('card-spin-the-chamber', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('card-spin-the-chamber', 'description'),
        sfxKey: GUNSLINGER_TOKEN_UPDATE_SFX,
        ...gunslingerAtlasRef(28),
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
        sfxKey: GUNSLINGER_SFX_SHOT,
        ...gunslingerAtlasRef(29),
        effects: [
            custom('gunslinger-card-high-noon', '选择 1 位目标玩家，掷 1 颗骰子并按结果结算。'),
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
            // 说明：这里的“该骰子”指的是你后续花费 Loaded 时触发的“装填奖励骰特写”中的那颗骰子（不是主攻击骰盘）。
            // 注意：本效果挂载到“装填奖励骰特写（bonus die spotlight）”的后续结算上；卡面描述不强调“下一次”，这里保持与 i18n 文案一致，避免双源漂移。
            custom('gunslinger-card-wild-west', '当你花费 1 个装填指示物并掷装填奖励骰时，你可以将该奖励骰重掷 1 次，然后本次攻击总伤害值 +1。'),
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
            custom('gunslinger-card-eat-my-lead', '额外掷 5 颗骰子；每个子弹令本次攻击 +1。若加值大于 4，再施加击倒。'),
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
