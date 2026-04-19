import type { AbilityCard } from '../../types';
import { DICETHRONE_CARD_ATLAS_IDS, SHADOW_THIEF_DICE_FACE_IDS } from '../../domain/ids';
import { COMMON_CARDS, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import type { RandomFn } from '../../../../engine/types';
import { DAGGER_STRIKE_2, PICKPOCKET_2, KIDNEY_SHOT_2, SHADOW_DEFENSE_2, FEARLESS_RIPOSTE_2, SHADOW_DANCE_2, STEAL_2, CORNUCOPIA_2 } from './abilities';

/** 卡牌文本 i18n key 生成 */
const cardText = (id: string, field: 'name' | 'description') => `cards.${id}.${field}`;

export const SHADOW_THIEF_CARDS: AbilityCard[] = [
    // === 图集索引 0: 迅捷突袭 II (原名: 抢夺 II) ===
    {
        id: 'upgrade-pickpocket-2',
        name: cardText('upgrade-pickpocket-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-pickpocket-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 0 },
        effects: [{ description: '升级迅捷突袭至 II 级', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'pickpocket', newAbilityDef: PICKPOCKET_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // === 图集索引 1: 破隐一击 II (原名: 肾击 II) ===
    {
        id: 'upgrade-kidney-shot-2',
        name: cardText('upgrade-kidney-shot-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-kidney-shot-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 1 },
        effects: [{ description: '升级破隐一击至 II 级', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'kidney-shot', newAbilityDef: KIDNEY_SHOT_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // === 图集索引 2: 鬼鬼崇崇！(新增行动卡) ===
    {
        id: 'action-sneaky-sneaky',
        name: cardText('action-sneaky-sneaky', 'name'),
        type: 'action',
        cpCost: 1,
        timing: 'main',
        description: cardText('action-sneaky-sneaky', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 2 },
        effects: [{ description: '获得隐匿攻击', action: { type: 'grantToken', target: 'self', tokenId: 'sneak_attack', value: 1 }, timing: 'immediate' }]
    },
    // === 图集索引 3: 与影共生！(原名: 与影同行！) ===
    {
        id: 'action-one-with-shadows',
        name: cardText('action-one-with-shadows', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: cardText('action-one-with-shadows', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 3 },
        effects: [{
            description: '投掷1骰：暗影→伏击+2CP；否则抽1牌',
            action: {
                type: 'rollDie', target: 'self', diceCount: 1,
                conditionalEffects: [
                    { face: SHADOW_THIEF_DICE_FACE_IDS.SHADOW, grantToken: { tokenId: 'sneak_attack', value: 1 }, cp: 2, effectKey: 'bonusDie.effect.oneWithShadowsHit' },
                ],
                defaultEffect: { drawCard: 1, effectKey: 'bonusDie.effect.oneWithShadowsMiss' },
            },
            timing: 'immediate',
        }]
    },
    // === 图集索引 4: 暗影防御 II (原名: 暗影守护 II) ===
    {
        id: 'upgrade-shadow-defense-2',
        name: cardText('upgrade-shadow-defense-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-shadow-defense-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 4 },
        effects: [{ description: '升级暗影防御至 II 级', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'shadow-defense', newAbilityDef: SHADOW_DEFENSE_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // === 图集索引 5: 毒伤！(原名: 淬毒！) ===
    {
        id: 'action-poison-tip',
        name: cardText('action-poison-tip', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: cardText('action-poison-tip', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 5 },
        effects: [{ description: '对对手施加中毒', action: { type: 'grantStatus', target: 'opponent', statusId: 'poison', value: 1 }, timing: 'immediate' }]
    },
    // === 图集索引 6: 卡牌戏法！===
    {
        id: 'action-card-trick',
        name: cardText('action-card-trick', 'name'),
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: cardText('action-card-trick', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 6 },
        effects: [{ description: '卡牌戏法结算', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-card-trick' }, timing: 'immediate' }]
    },
    // === 图集索引 7: 匕首突刺 II (原名: 匕首打击 II) ===
    {
        id: 'upgrade-dagger-strike-2',
        name: cardText('upgrade-dagger-strike-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-dagger-strike-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 7 },
        effects: [{ description: '升级匕首突刺至 II 级', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'dagger-strike', newAbilityDef: DAGGER_STRIKE_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // === 图集索引 8: 暗影币！(新增行动卡) ===
    {
        id: 'action-shadow-coins',
        name: cardText('action-shadow-coins', 'name'),
        type: 'action',
        cpCost: 0,
        timing: 'instant',
        description: cardText('action-shadow-coins', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 8 },
        effects: [{ description: '暗影币结算', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-shadow-coins' }, timing: 'immediate' }]
    },
    // === 图集索引 9: 暗影操控！===
    {
        id: 'action-shadow-manipulation',
        name: cardText('action-shadow-manipulation', 'name'),
        type: 'action',
        cpCost: 4,
        timing: 'roll',
        description: cardText('action-shadow-manipulation', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 9 },
        playCondition: { requireDiceExists: true, requireHasRolled: true },
        effects: [{ description: '暗影操控结算', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-shadow-manipulation' }, timing: 'immediate' }]
    },
    // === 图集索引 10: 暗影之舞 II ===
    {
        id: 'upgrade-shadow-dance-2',
        name: cardText('upgrade-shadow-dance-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-shadow-dance-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 10 },
        effects: [{ description: '升级暗影之舞至 II 级', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'shadow-dance', newAbilityDef: SHADOW_DANCE_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // === 图集索引 11: 扒窃 II (原名: 偷窃 II) ===
    {
        id: 'upgrade-steal-2',
        name: cardText('upgrade-steal-2', 'name'),
        type: 'upgrade',
        cpCost: 1,
        timing: 'main',
        description: cardText('upgrade-steal-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 11 },
        effects: [{ description: '升级扒窃至 II 级', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'steal', newAbilityDef: STEAL_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // === 图集索引 12: 卡牌大师 II (原名: 聚宝盆 II) ===
    {
        id: 'upgrade-cornucopia-2',
        name: cardText('upgrade-cornucopia-2', 'name'),
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: cardText('upgrade-cornucopia-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 12 },
        effects: [{ description: '升级卡牌大师至 II 级', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'cornucopia', newAbilityDef: CORNUCOPIA_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // === 图集索引 13: 后发制人 II ===
    {
        id: 'upgrade-fearless-riposte-2',
        name: cardText('upgrade-fearless-riposte-2', 'name'),
        type: 'upgrade',
        cpCost: 4,
        timing: 'main',
        description: cardText('upgrade-fearless-riposte-2', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 13 },
        effects: [{ description: '升级后发制人至 II 级', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'fearless-riposte', newAbilityDef: FEARLESS_RIPOSTE_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // === 图集索引 14: 遁入阴影！(原名: 遁入暗影！) ===
    {
        id: 'action-into-the-shadows',
        name: cardText('action-into-the-shadows', 'name'),
        type: 'action',
        cpCost: 4,
        timing: 'instant',
        description: cardText('action-into-the-shadows', 'description'),
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 14 },
        effects: [{ description: '获得1个暗影标记', action: { type: 'grantToken', target: 'self', tokenId: 'sneak', value: 1 }, timing: 'immediate' }]
    },

    // 注入通用卡牌
    ...injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF),
];

export const getShadowThiefStartingDeck = (random: RandomFn): AbilityCard[] => {
    // 每张卡牌只放 1 份，共 33 张（规则标准）
    const deck = SHADOW_THIEF_CARDS.map(card => ({ ...card }));
    return random.shuffle(deck);
};
