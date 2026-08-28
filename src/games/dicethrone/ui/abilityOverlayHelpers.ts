import type { CardPreviewRef } from '../../../core';
import type { AbilityCard } from '../types';
import { MONK_CARDS } from '../heroes/monk/cards';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import { PALADIN_CARDS } from '../heroes/paladin/cards';
import { MOON_ELF_CARDS } from '../heroes/moon_elf/cards';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import { GUNSLINGER_CARDS } from '../heroes/gunslinger/cards';
import { SAMURAI_CARDS } from '../heroes/samurai/cards';
import { TREANT_CARDS } from '../heroes/treant/cards';
import { NINJA_CARDS } from '../heroes/ninja/cards';
import { ZHANSHUJIA_CARDS } from '../heroes/zhanshujia/cards';
import { CURSED_PIRATE_CARDS } from '../heroes/cursed_pirate/cards';
import { ARTIFICER_CARDS } from '../heroes/artificer/cards';
import { TIANSHI_CARDS } from '../heroes/tianshi/cards';
import { LIEREN_CARDS } from '../heroes/lieren/cards';
import { VAMPIRE_LORD_CARDS } from '../heroes/vampire_lord/cards';
import type { HeroState } from '../domain/types';
import { getSlotBaseAbilityIdForCharacter } from './abilitySlotMapping';

export const HERO_CARDS_MAP: Record<string, AbilityCard[]> = {
    monk: MONK_CARDS,
    barbarian: BARBARIAN_CARDS,
    pyromancer: PYROMANCER_CARDS,
    paladin: PALADIN_CARDS,
    moon_elf: MOON_ELF_CARDS,
    shadow_thief: SHADOW_THIEF_CARDS,
    gunslinger: GUNSLINGER_CARDS,
    samurai: SAMURAI_CARDS,
    treant: TREANT_CARDS,
    ninja: NINJA_CARDS,
    zhanshujia: ZHANSHUJIA_CARDS,
    cursed_pirate: CURSED_PIRATE_CARDS,
    artificer: ARTIFICER_CARDS,
    tianshi: TIANSHI_CARDS,
    lieren: LIEREN_CARDS,
    vampire_lord: VAMPIRE_LORD_CARDS,
};

export function getSlotAbilityId(
    characterId: string,
    slotId: string,
    playerBoardFace?: HeroState['playerBoardFace'],
): string | undefined {
    return getSlotBaseAbilityIdForCharacter(characterId, slotId, playerBoardFace);
}

export function getUpgradeCardForAbilityLevel(characterId: string, abilityId: string, level: number): AbilityCard | undefined {
    const heroCards = HERO_CARDS_MAP[characterId];
    if (!heroCards) return undefined;

    for (const card of heroCards) {
        if (card.type !== 'upgrade' || !card.effects) continue;
        for (const effect of card.effects) {
            const action = effect.action;
            if (
                action?.type === 'replaceAbility' &&
                action.targetAbilityId === abilityId &&
                action.newAbilityLevel === level
            ) {
                return card;
            }
        }
    }
    return undefined;
}

export function getUpgradeCardPreviewRef(characterId: string, abilityId: string, level: number): CardPreviewRef | undefined {
    return getUpgradeCardForAbilityLevel(characterId, abilityId, level)?.previewRef;
}
