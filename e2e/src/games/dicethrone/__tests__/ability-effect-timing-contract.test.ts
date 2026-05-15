import { describe, expect, it } from 'vitest';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import type { AbilityCard } from '../domain/core-types';
import type { AbilityDef, AbilityEffect, EffectTiming } from '../domain/combat';
import type { SelectableCharacterId } from '../domain/types';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import { GUNSLINGER_CARDS } from '../heroes/gunslinger/cards';
import { MONK_CARDS } from '../heroes/monk/cards';
import { MOON_ELF_CARDS } from '../heroes/moon_elf/cards';
import { NINJA_CARDS } from '../heroes/ninja/cards';
import { PALADIN_CARDS } from '../heroes/paladin/cards';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import { SAMURAI_CARDS } from '../heroes/samurai/cards';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import { TREANT_CARDS } from '../heroes/treant/cards';

type AbilitySource = {
    heroId: SelectableCharacterId;
    source: string;
    ability: AbilityDef;
};

const DEFENSE_RESOLVER_CONSUMED_TIMINGS = new Set<EffectTiming>(['withDamage', 'postDamage']);

const HERO_CARDS: Record<SelectableCharacterId, AbilityCard[]> = {
    barbarian: BARBARIAN_CARDS,
    monk: MONK_CARDS,
    pyromancer: PYROMANCER_CARDS,
    shadow_thief: SHADOW_THIEF_CARDS,
    moon_elf: MOON_ELF_CARDS,
    paladin: PALADIN_CARDS,
    gunslinger: GUNSLINGER_CARDS,
    samurai: SAMURAI_CARDS,
    treant: TREANT_CARDS,
    ninja: NINJA_CARDS,
};

const collectEffects = (ability: AbilityDef): AbilityEffect[] => [
    ...(ability.effects ?? []),
    ...(ability.variants ?? []).flatMap(variant => variant.effects ?? []),
];

const collectUpgradeAbilityDefs = (heroId: SelectableCharacterId): AbilitySource[] =>
    HERO_CARDS[heroId].flatMap(card =>
        (card.effects ?? [])
            .map(effect => effect.action?.newAbilityDef)
            .filter((value): value is AbilityDef => {
                if (!value || typeof value !== 'object') return false;
                const candidate = value as Partial<AbilityDef>;
                return typeof candidate.id === 'string' && Array.isArray(candidate.effects);
            })
            .map(ability => ({
                heroId,
                source: `${card.id}.replaceAbility`,
                ability,
            })),
    );

const collectAbilitySources = (): AbilitySource[] =>
    (Object.keys(CHARACTER_DATA_MAP) as SelectableCharacterId[]).flatMap(heroId => [
        ...((CHARACTER_DATA_MAP[heroId].abilities as AbilityDef[]).map(ability => ({
            heroId,
            source: 'base',
            ability,
        }))),
        ...collectUpgradeAbilityDefs(heroId),
    ]);

const formatAbility = ({ heroId, source, ability }: AbilitySource): string =>
    `${heroId}/${ability.id}@${source}`;

describe('DiceThrone effect timing 框架消费合同', () => {
    it('防御技能的可执行效果必须能被 defense resolver 消费', () => {
        const violations = collectAbilitySources()
            .filter(entry => entry.ability.type === 'defensive' || entry.ability.trigger?.type === 'phase' && entry.ability.trigger.phaseId === 'defensiveRoll')
            .filter(entry => {
                const effects = collectEffects(entry.ability);
                return effects.length === 0 || !effects.some(effect => DEFENSE_RESOLVER_CONSUMED_TIMINGS.has(effect.timing ?? 'preDefense'));
            })
            .map(formatAbility);

        expect(violations).toEqual([]);
    });

    it('防御技能不得把唯一执行效果声明成 immediate 或 preDefense', () => {
        const violations = collectAbilitySources()
            .filter(entry => entry.ability.type === 'defensive' || entry.ability.trigger?.type === 'phase' && entry.ability.trigger.phaseId === 'defensiveRoll')
            .flatMap(entry => collectEffects(entry.ability).map(effect => ({ entry, effect })))
            .filter(({ effect }) => !DEFENSE_RESOLVER_CONSUMED_TIMINGS.has(effect.timing ?? 'preDefense'))
            .map(({ entry, effect }) => `${formatAbility(entry)} -> ${effect.description} timing=${effect.timing ?? 'default:preDefense'}`);

        expect(violations).toEqual([]);
    });
});
