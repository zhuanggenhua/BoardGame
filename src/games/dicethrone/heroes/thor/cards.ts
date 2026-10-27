/** 完整物理卡合同见 rule/雷神卡牌录入核对.md；推广卡不混入常规33张牌库。 */
import type { RandomFn } from '../../../../engine/types';
import type { AbilityCard } from '../../types';
import type { AbilityDef, AbilityEffect } from '../../domain/combat';
import { COMMON_CARDS, injectCommonCardPreviewRefs, type CommonCardAtlasIndexMap } from '../../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS, TOKEN_IDS } from '../../domain/ids';
import {
    THOR_HAMMER_2, THOR_HAMMER_3, THOR_MIGHTY_SUMMON_2, THOR_CHAIN_LIGHTNING_2,
    THOR_ODINFORCE_2, THOR_THUNDER_STRIKE_2, THOR_POWER_OF_THUNDER_2,
    THOR_BOTTLED_LIGHTNING_2, THOR_THUNDER_WHEEL_2, THOR_SFX,
} from './abilities';

export const THOR_COMMON_ATLAS_INDEX: CommonCardAtlasIndexMap = {
    'card-transfer-status': 0, 'card-what-status': 1, 'card-one-throw-fortune': 2,
    'card-get-away': 3, 'card-super-double': 4, 'card-double': 5, 'card-bye-bye': 6,
    'card-flick': 7, 'card-boss-generous': 8, 'card-next-time': 9, 'card-unexpected': 10,
    'card-worthy-of-me': 11, 'card-surprise': 12, 'card-me-too': 13, 'card-i-can-again': 14,
    'card-give-hand': 15, 'card-just-this': 16, 'card-play-six': 17,
};
const card = (id: string, slot: number, cpCost: number, timing: AbilityCard['timing'], effects: AbilityEffect[], extra: Partial<AbilityCard> = {}): AbilityCard => ({
    id, name: `cards.${id}.name`, description: `cards.${id}.description`, type: 'action', cpCost, timing,
    sfxKey: THOR_SFX, sourceAtlasIndex: slot, previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.THOR, index: slot }, effects, ...extra,
});
const upgrade = (id: string, slot: number, cost: number, ability: AbilityDef, level = 2) => card(id, slot, cost, 'main', [{
    description: `cards.${id}.description`, timing: 'immediate',
    action: { type: 'replaceAbility', target: 'self', targetAbilityId: ability.id,
        newAbilityDef: { ...ability, name: `abilities.${ability.id}-${level}.name`, description: `abilities.${ability.id}-${level}.description` }, newAbilityLevel: level },
}], { type: 'upgrade' });
const custom = (id: string): AbilityEffect[] => [{ description: `cards.card-${id}.description`, timing: 'immediate', action: { type: 'custom', target: 'self', customActionId: id } }];

const heroCards: AbilityCard[] = [
    upgrade('upgrade-thor-hammer-2', 18, 0, THOR_HAMMER_2),
    upgrade('upgrade-thor-hammer-3', 19, 2, THOR_HAMMER_3, 3),
    upgrade('upgrade-thor-mighty-summon-2', 20, 2, THOR_MIGHTY_SUMMON_2),
    upgrade('upgrade-thor-chain-lightning-2', 21, 2, THOR_CHAIN_LIGHTNING_2),
    upgrade('upgrade-thor-odinforce-2', 22, 2, THOR_ODINFORCE_2),
    upgrade('upgrade-thor-thunder-strike-2', 23, 2, THOR_THUNDER_STRIKE_2),
    upgrade('upgrade-thor-power-of-thunder-2', 24, 2, THOR_POWER_OF_THUNDER_2),
    upgrade('upgrade-thor-bottled-lightning-2', 25, 2, THOR_BOTTLED_LIGHTNING_2),
    upgrade('upgrade-thor-thunder-wheel-2', 26, 2, THOR_THUNDER_WHEEL_2),
    card('card-thor-worthy', 27, 1, 'roll', custom('thor-worthy'), { playCondition: { requireIsRoller: true, requireDiceExists: true, requireHasRolled: true } }),
    card('card-thor-impenetrable', 28, 2, 'roll', custom('thor-impenetrable'), { playCondition: { requireTokenStacks: { tokenId: TOKEN_IDS.ELECTROKINESIS, min: 2 }, pendingDamage: { role: 'target', responseType: 'beforeDamageReceived', requireCommittedDamage: true } } }),
    card('card-thor-undaunted', 29, 2, 'roll', custom('thor-undaunted'), { playCondition: { pendingDamage: { role: 'target', responseType: 'beforeDamageReceived' }, requireLethalAttack: true } }),
    card('card-thor-hammer-time', 30, 0, 'instant', custom('thor-hammer-time')),
    card('card-thor-thunderous', 31, 1, 'instant', custom('thor-thunderous')),
    card('card-thor-storm-brewing', 32, 0, 'instant', custom('thor-storm-brewing'), { playCondition: { requireMjolnirThrowsThisTurn: 2 } }),
    card('card-thor-bifrost', 33, 0, 'main', custom('thor-bifrost')),
];

export const THOR_CARDS: AbilityCard[] = [
    ...injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.THOR, THOR_COMMON_ATLAS_INDEX),
    ...heroCards,
];
export const getThorStartingDeck = (random: RandomFn): AbilityCard[] => random.shuffle(
    THOR_CARDS.filter(item => item.id !== 'card-thor-bifrost').map(item => ({ ...item })),
);
