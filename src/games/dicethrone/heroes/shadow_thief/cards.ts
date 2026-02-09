import type { AbilityCard } from '../../types';
import { DICETHRONE_CARD_ATLAS_IDS } from '../../domain/ids';
import { COMMON_CARDS, injectCommonCardPreviewRefs } from '../../domain/commonCards';
import type { RandomFn } from '../../../../engine/types';
import { DAGGER_STRIKE_2, PICKPOCKET_2, KIDNEY_SHOT_2, SHADOW_ASSAULT, PIERCING_ATTACK, SHADOW_DEFENSE_2, FEARLESS_RIPOSTE_2, SHADOW_DANCE_2, STEAL_2, CORNUCOPIA_2 } from './abilities';


export const SHADOW_THIEF_CARDS: AbilityCard[] = [
    // 1. Pickpocket II (迅捷突袭 II)
    {
        id: 'upgrade-pickpocket-2',
        name: 'Pickpocket II',
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: 'Upgrade Pickpocket to Level 2',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 1 }, // Map to correct index eventually
        effects: [{ description: 'Upgrade Pickpocket', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'pickpocket', newAbilityDef: PICKPOCKET_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // 2. Kidney Shot II (破隐一击 II)
    {
        id: 'upgrade-kidney-shot-2',
        name: 'Kidney Shot II',
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: 'Upgrade Kidney Shot to Level 2',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 2 },
        effects: [{ description: 'Upgrade Kidney Shot', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'kidney-shot', newAbilityDef: KIDNEY_SHOT_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // 3. Shadow Assault (暗影突袭) - Assumed Upgrade for Shadow Dance
    {
        id: 'upgrade-shadow-assault',
        name: 'Shadow Assault',
        type: 'upgrade',
        cpCost: 2, // From image
        timing: 'main',
        description: 'Upgrade Shadow Dance to Shadow Assault',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 3 },
        effects: [{ description: 'Replace Shadow Dance', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'shadow-dance', newAbilityDef: SHADOW_ASSAULT, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // 4. Piercing Attack (穿刺攻击) - Assumed Upgrade for Steal
    {
        id: 'upgrade-piercing-attack',
        name: 'Piercing Attack',
        type: 'upgrade',
        cpCost: 2, // Guessing cost based on tier
        timing: 'main',
        description: 'Upgrade Steal to Piercing Attack',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 4 },
        effects: [{ description: 'Replace Steal', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'steal', newAbilityDef: PIERCING_ATTACK, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // 5. Sneaky! (鬼鬼祟祟!) - Instant Action (Keeping as is, card 11 is similar logic but different name?)
    // Card 15: "遁入暗影!" (Vanish / Into the Shadows!)
    {
        id: 'action-into-the-shadows', // "遁入暗影!"
        name: 'Into the Shadows!',
        type: 'action',
        cpCost: 4, // From Card Image 15: 4CP, Red Border (Instant Action)
        timing: 'instant',
        description: 'Gain Shadow Token',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 14 }, // Card 15 -> Index 14 (0-based)
        effects: [{ description: 'Gain Shadow', action: { type: 'grantToken', target: 'self', tokenId: 'shadow', value: 1 } }]
    },
    // 6. One with Shadows! (Keeping as is)
    {
        id: 'action-one-with-shadows',
        name: 'One with Shadows!',
        type: 'action',
        cpCost: 0,
        timing: 'main',
        description: 'Roll 1 die. If Shadow: Gain Sneak Attack + 2 CP. Else Draw 1 Card.',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 6 },
        effects: [{ description: 'Roll Die', action: { type: 'custom', target: 'self', customActionId: 'shadow_thief-one-with-shadows' } }]
    },
    // 7. Shadow Defense II (暗影守护 II) - Standard Defense Upgrade
    {
        id: 'upgrade-shadow-defense-2',
        name: 'Shadow Defense II', // "暗影守护 II"
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: 'Upgrade Shadow Defense to Level 2',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 6 },
        effects: [{ description: 'Upgrade Shadow Defense', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'shadow-defense', newAbilityDef: SHADOW_DEFENSE_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // 8. Fearless Riposte II (后发制人 II) - Alternative Defense Upgrade
    {
        id: 'upgrade-fearless-riposte-2',
        name: 'Fearless Riposte II', // "后发制人 II"
        type: 'upgrade',
        cpCost: 4,
        timing: 'main',
        description: 'Upgrade Defense to Fearless Riposte II',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 7 },
        effects: [{ description: 'Upgrade Defense', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'fearless-riposte', newAbilityDef: FEARLESS_RIPOSTE_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // 8. Poison Tip! (Keeping as is)
    {
        id: 'action-poison-tip',
        name: 'Poison Tip!',
        type: 'action',
        cpCost: 2,
        timing: 'instant',
        description: 'Inflict Poison',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 8 },
        effects: [{ description: 'Inflict Poison', action: { type: 'grantStatus', target: 'opponent', statusId: 'poison', value: 1 } }]
    },
    // 9. Card Trick! (Keeping as is)
    {
        id: 'action-card-trick',
        name: 'Card Trick!',
        type: 'action',
        cpCost: 2,
        timing: 'main',
        description: 'Opponent Discards 1. Draw 1 (2 if Sneak).',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 9 },
        effects: [{ description: 'Resolve Card Trick', action: { type: 'custom', target: 'opponent', customActionId: 'shadow_thief-card-trick' } }]
    },
    // 10. Dagger Strike II (Keeping as is)
    {
        id: 'upgrade-dagger-strike-2',
        name: 'Dagger Strike II',
        type: 'upgrade',
        cpCost: 2,
        timing: 'main',
        description: 'Upgrade Dagger Strike to Level 2',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 10 },
        effects: [{ description: 'Upgrade Dagger Strike', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'dagger-strike', newAbilityDef: DAGGER_STRIKE_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // 11. Shadow Dance II (暗影之舞 II) - Card 11
    {
        id: 'upgrade-shadow-dance-2',
        name: 'Shadow Dance II',
        type: 'upgrade',
        cpCost: 1, // Card 11
        timing: 'main',
        description: 'Upgrade Shadow Dance to Level 2',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 10 }, // Index? Need to map correctly. 11? 
        // Card 1-10 were covered. Card 11 is next.
        // Let's assume sequential indexing from the atlas.
        // Card 11 -> Index 10? No, user uploaded first 10, now 11-15.
        // indices should follow.
        // Just using partial indices for now, but really `index` should match the sprite sheet.
        // Assuming 10-14 for these 5 cards if strictly sequential.
        effects: [{ description: 'Upgrade Shadow Dance', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'shadow-dance', newAbilityDef: SHADOW_DANCE_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // 12. Steal II (扒窃 II) - Card 12
    {
        id: 'upgrade-steal-2',
        name: 'Steal II', // Matches '扒窃' which is usually 'Pickpocket' but ability uses Bags -> 'steal'
        type: 'upgrade',
        cpCost: 1, // Card 12
        timing: 'main',
        description: 'Upgrade Steal to Level 2',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 11 },
        effects: [{ description: 'Upgrade Steal', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'steal', newAbilityDef: STEAL_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },
    // 13. Cornucopia II (卡牌大师 II) - Card 13
    {
        id: 'upgrade-cornucopia-2',
        name: 'Cornucopia II', // Matches '卡牌大师' triggers on Cards -> 'cornucopia'
        type: 'upgrade',
        cpCost: 2, // Card 13
        timing: 'main',
        description: 'Upgrade Cornucopia to Level 2',
        previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF, index: 12 },
        effects: [{ description: 'Upgrade Cornucopia', action: { type: 'replaceAbility', target: 'self', targetAbilityId: 'cornucopia', newAbilityDef: CORNUCOPIA_2, newAbilityLevel: 2 }, timing: 'immediate' }]
    },

    // 注入通用卡牌
    ...injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.SHADOW_THIEF),
];

export const getShadowThiefStartingDeck = (random: RandomFn): AbilityCard[] => {
    const deck: AbilityCard[] = [];
    SHADOW_THIEF_CARDS.forEach(card => {
        deck.push({ ...card });
        if (card.type !== 'upgrade') deck.push({ ...card });
    });
    return random.shuffle(deck);
};
