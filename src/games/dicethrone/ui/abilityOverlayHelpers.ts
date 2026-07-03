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
import type { HeroState } from '../domain/types';

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
};

const HERO_SLOT_TO_ABILITY: Record<string, Record<string, string>> = {
    monk: {
        fist: 'meditation',
        chi: 'calm-water',
        sky: 'thunder-strike',
        lotus: 'taiji-combo',
        combo: 'lotus-palm',
        lightning: 'harmony',
        calm: 'fist-technique',
        meditate: 'zen-forget',
        ultimate: 'transcendence',
    },
    pyromancer: {
        fist: 'magma-armor',
        chi: 'pyro-blast',
        sky: 'meteor',
        lotus: 'meteor',
        combo: 'fireball',
        lightning: 'burn-down',
        calm: 'soul-burn',
        meditate: 'fiery-combo',
        ultimate: 'ultimate-inferno',
    },
    barbarian: {
        fist: 'thick-skin',
        chi: 'reckless-strike',
        sky: 'suppress',
        lotus: 'steadfast',
        combo: 'violent-assault',
        lightning: 'powerful-strike',
        calm: 'all-out-strike',
        meditate: 'slap',
        ultimate: 'rage',
    },
    paladin: {
        fist: 'holy-defense',
        chi: 'holy-light',
        sky: 'righteous-combat',
        lotus: 'blessing-of-might',
        combo: 'righteous-combat',
        lightning: 'vengeance',
        calm: 'holy-strike',
        meditate: 'righteous-prayer',
        ultimate: 'unyielding-faith',
    },
    moon_elf: {
        fist: 'elusive-step',
        chi: 'eclipse',
        sky: 'blinding-shot',
        lotus: 'entangling-shot',
        combo: 'exploding-arrow',
        lightning: 'covering-fire',
        calm: 'covert-fire',
        meditate: 'longbow',
        ultimate: 'lunar-eclipse',
    },
    shadow_thief: {
        fist: 'pickpocket',
        chi: 'kidney-shot',
        sky: 'shadow-defense',
        lotus: 'dagger-strike',
        combo: 'shadow-dance',
        lightning: 'steal',
        calm: 'cornucopia',
        meditate: 'fearless-riposte',
        ultimate: 'shadow-shank',
    },
    gunslinger: {
        fist: 'revolver',
        chi: 'bounty-hunter',
        sky: 'quick-draw',
        lotus: 'take-cover',
        combo: 'showdown',
        lightning: 'deadeye',
        calm: 'fan-the-hammer',
        meditate: 'duel',
        ultimate: 'fill-em-with-lead',
    },
    samurai: {
        fist: 'katana-slice',
        chi: 'wakizashi',
        sky: 'bushido',
        lotus: 'solemnity',
        combo: 'budo',
        lightning: 'samurai-slot-06',
        calm: 'masamune',
        meditate: 'stand-tall',
        ultimate: 'samurai-ultimate',
    },
    treant: {
        fist: 'shattering-fist',
        chi: 'tend-care',
        sky: 'quiet-cultivation',
        lotus: 'wild-growth',
        combo: 'vengeful-vines',
        lightning: 'nature-touch',
        meditate: 'rooted',
        ultimate: 'forest-awakens',
    },
    ninja: {
        fist: 'slash',
        chi: 'going-forward',
        sky: 'death-blossom',
        lotus: 'smoke-screen',
        combo: 'poison-blade',
        lightning: 'shadow-step',
        calm: 'shadow-fang',
        meditate: 'blink',
        ultimate: 'ninja-assassinate',
    },
    zhanshujia: {
        fist: 'sabre-thrust',
        chi: 'carpet-bombing',
        sky: 'war-monger',
        lotus: 'drum-movement',
        combo: 'flanking',
        lightning: 'expand-battlefield',
        calm: 'strategic-shift',
        meditate: 'countermeasures',
        ultimate: 'high-ground',
    },
    cursed_pirate: {
        fist: 'soul-stab',
        chi: 'marked-for-death',
        sky: 'cursed',
        lotus: 'deep-sea-dive',
        combo: 'breath-of-death',
        lightning: 'soul-command',
        calm: 'undead-claw',
        meditate: 'still-wet-behind-ears',
        ultimate: 'merciless-curse',
    },
    artificer: {
        fist: 'wrench-strike',
        chi: 'schematics',
        sky: 'collect-parts',
        lotus: 'eureka',
        combo: 'activate-bots',
        lightning: 'overclock',
        calm: 'shock-bot',
        meditate: 'tinker',
        ultimate: 'maximum-power',
    },
};

const CURSED_PIRATE_NORMAL_SLOT_TO_ABILITY: Record<string, string> = {
    fist: 'cutlass-stab',
    chi: 'make-your-mark',
    sky: 'human-cursed',
    lotus: 'walk-the-plank',
    combo: 'light-the-fuse',
    lightning: 'verdict-command',
    calm: 'astonishing',
    meditate: 'human-still-wet-behind-ears',
    ultimate: 'merciless-plunder',
};

export function getSlotAbilityId(
    characterId: string,
    slotId: string,
    playerBoardFace?: HeroState['playerBoardFace'],
): string | undefined {
    if (characterId === 'cursed_pirate' && playerBoardFace === 'normal') {
        return CURSED_PIRATE_NORMAL_SLOT_TO_ABILITY[slotId];
    }
    return HERO_SLOT_TO_ABILITY[characterId]?.[slotId];
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
