import type { AttackCardDefinition } from '../domain/types';
import { DEMO_CARDS } from './demo-data';

const cardAssets: Record<string, string> = {
    cardQ5: 'fate-domination/cards/berserker-swift-seven', cardQ6: 'fate-domination/cards/berserker-swift-nine',
    cardB5: 'fate-domination/cards/berserker-strength-seven', cardB6: 'fate-domination/cards/berserker-strength-nine',
    cardQ1: 'fate-domination/cards/swift-low', cardQ2: 'fate-domination/cards/swift-mid', cardQ3: 'fate-domination/cards/swift-high', cardQ4: 'fate-domination/cards/swift-super',
    cardPreparation: 'fate-domination/cards/remote-control', cardSurveil: 'fate-domination/cards/rush', cardluck: 'fate-domination/cards/luck', Card_Avenger: 'fate-domination/cards/avenger',
    cardA1: 'fate-domination/cards/attack-magic-low', cardA2: 'fate-domination/cards/attack-magic-mid', cardA3: 'fate-domination/cards/attack-magic-high', cardA4: 'fate-domination/cards/attack-magic-super',
    cardB1: 'fate-domination/cards/attack-strength-low', cardB2: 'fate-domination/cards/attack-strength-mid', cardB3: 'fate-domination/cards/attack-strength-high', cardB4: 'fate-domination/cards/attack-strength-super',
};
const migratedCards: AttackCardDefinition[] = DEMO_CARDS.map((card) => ({
    id: card.id,
    name: card.name,
    kind: card.kind,
    assetPath: cardAssets[card.id] ?? `fate-domination/cards/${card.id}`,
    manaCost: card.cost,
    basePower: card.power,
    sourceStatus: 'verified',
    type: card.type,
    cost: card.cost,
    power: card.power,
    desc: card.desc,
    effectSummary: card.desc,
}));

export const FATE_ATTACK_CARDS: AttackCardDefinition[] = migratedCards;

export const FATE_ATTACK_BY_ID = Object.fromEntries(FATE_ATTACK_CARDS.map((card) => [card.id, card])) as Record<string, AttackCardDefinition>;
