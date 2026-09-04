import { isAttackWeaponCard } from './attackRules';
import type {
    BetrayalCore,
    BetrayalInventoryCard,
} from './game';
import type { UseEffectProfile } from './possessionEffects';

function eventInventoryCardMatchesFilter(
    card: BetrayalInventoryCard,
    filter: Extract<UseEffectProfile, { mode: 'optionalItemEffect' }>['itemFilter'],
): boolean {
    if (card.kind !== 'item') {
        return false;
    }
    if (filter === 'nonWeaponItem') {
        return !isAttackWeaponCard(card);
    }
    return true;
}

export function effectAllowsItemChoice(core: BetrayalCore, effect: UseEffectProfile, cardId: string | undefined): boolean {
    if (!cardId) {
        return false;
    }
    if (effect.mode === 'compound') {
        return effect.effects.some((childEffect) => effectAllowsItemChoice(core, childEffect, cardId));
    }
    if (effect.mode !== 'optionalItemEffect') {
        return false;
    }
    return core.currentExplorer.inventory.some((card) => (
        card.id === cardId && eventInventoryCardMatchesFilter(card, effect.itemFilter)
    ));
}

export function applyItemChoiceToEffect(core: BetrayalCore, effect: UseEffectProfile, cardId?: string): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => applyItemChoiceToEffect(core, childEffect, cardId)),
        };
    }
    if (effect.mode !== 'optionalItemEffect' || !cardId || !effectAllowsItemChoice(core, effect, cardId)) {
        return effect;
    }
    const card = core.currentExplorer.inventory.find((candidate) => candidate.id === cardId)!;
    return {
        ...effect,
        selectedCardId: card.id,
        selectedCardName: card.name,
    };
}
