import type { TriggerCondition } from '../domain/combat/conditions';
import type { AbilityEffect } from '../domain/combat';
import type { PlayerAbilityMatch } from '../domain/abilityLookup';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;
type ExistsFn = (key: string) => boolean;

interface TextResolver {
    t: TranslateFn;
    exists: ExistsFn;
}

const DEFAULT_FACE_LABELS: Record<string, string> = {
    fist: '拳',
    palm: '掌',
    taiji: '太极',
    lotus: '莲花',
    sword: '剑',
    heart: '心',
    strength: '力量',
    fire: '火',
    magma: '岩浆',
    fiery_soul: '火魂',
    meteor: '陨石',
    bow: '弓',
    foot: '脚',
    moon: '月',
    dagger: '匕首',
    bag: '背包',
    card: '卡牌',
    shadow: '暗影',
    helm: '头盔',
    pray: '祈祷',
    bullet: '子弹',
    bullseye: '靶心',
    dash: '冲刺',
};

const DEFAULT_PHASE_LABELS: Record<string, string> = {
    setup: '准备阶段',
    income: '收入阶段',
    main1: '主要阶段 1',
    offensiveRoll: '进攻掷骰',
    defensiveRoll: '防守掷骰',
    main2: '主要阶段 2',
    discard: '弃牌阶段',
};

const resolveFaceLabel = (faceId: string, resolver: TextResolver): string => {
    const key = `abilityChoice.faceLabel.${faceId}`;
    return resolver.exists(key) ? resolver.t(key) : (DEFAULT_FACE_LABELS[faceId] ?? faceId);
};

const joinTranslated = (
    parts: string[],
    separatorKey: string,
    fallbackSeparator: string,
    resolver: TextResolver,
): string => {
    const separator = resolver.exists(separatorKey) ? resolver.t(separatorKey) : fallbackSeparator;
    return parts.join(separator);
};

const formatTriggerSummary = (trigger: TriggerCondition, resolver: TextResolver): string => {
    switch (trigger.type) {
        case 'diceSet': {
            const parts = Object.entries(trigger.faces).map(([faceId, count]) =>
                resolver.exists('abilityChoice.trigger.countFace')
                    ? resolver.t('abilityChoice.trigger.countFace', {
                        count,
                        face: resolveFaceLabel(faceId, resolver),
                    })
                    : `${count}${resolveFaceLabel(faceId, resolver)}`,
            );
            return joinTranslated(parts, 'abilityChoice.trigger.diceSetSeparator', ' + ', resolver);
        }
        case 'allSymbolsPresent': {
            const faces = joinTranslated(
                trigger.symbols.map(symbol => resolveFaceLabel(symbol, resolver)),
                'abilityChoice.trigger.faceSeparator',
                '、',
                resolver,
            );
            return resolver.exists('abilityChoice.trigger.allSymbolsPresent')
                ? resolver.t('abilityChoice.trigger.allSymbolsPresent', { faces })
                : `包含${faces}`;
        }
        case 'smallStraight':
            return resolver.exists('abilityChoice.trigger.smallStraight')
                ? resolver.t('abilityChoice.trigger.smallStraight')
                : '小顺子';
        case 'largeStraight':
            return resolver.exists('abilityChoice.trigger.largeStraight')
                ? resolver.t('abilityChoice.trigger.largeStraight')
                : '大顺子';
        case 'phase': {
            const phaseKey = `abilityChoice.trigger.phase.${trigger.phaseId}`;
            return resolver.exists(phaseKey)
                ? resolver.t(phaseKey)
                : (DEFAULT_PHASE_LABELS[trigger.phaseId] ?? '变体条件');
        }
        default:
            return resolver.exists('abilityChoice.trigger.generic')
                ? resolver.t('abilityChoice.trigger.generic')
                : '变体条件';
    }
};

const buildEffectDescription = (
    effects: AbilityEffect[],
    resolver: TextResolver,
): string | undefined => {
    const descriptions = effects
        .map(effect => effect.description)
        .filter((description): description is string => Boolean(description))
        .map(description => resolver.t(description));

    if (descriptions.length === 0) return undefined;
    return joinTranslated(descriptions, 'abilityChoice.effectSeparator', '；', resolver);
};

export function getAbilityChoiceText(
    abilityId: string,
    match: PlayerAbilityMatch,
    resolver: TextResolver,
): { name: string; description?: string } {
    if (!match.variant) {
        return {
            name: resolver.t(match.ability.name),
            description: match.ability.description ? resolver.t(match.ability.description) : undefined,
        };
    }

    const variantNameKey = `abilities.${abilityId}.name`;
    const variantDescriptionKey = `abilities.${abilityId}.description`;
    const reusesParentDescriptionKey = match.ability.description === variantDescriptionKey;
    const parentDescription =
        match.ability.description && !reusesParentDescriptionKey
            ? resolver.t(match.ability.description)
            : undefined;

    const fallbackDescription =
        buildEffectDescription(match.variant.effects ?? [], resolver)
        ?? parentDescription;

    if (resolver.exists(variantNameKey)) {
        return {
            name: resolver.t(variantNameKey),
            description: resolver.exists(variantDescriptionKey) && !reusesParentDescriptionKey
                ? resolver.t(variantDescriptionKey)
                : fallbackDescription,
        };
    }

    const trigger = formatTriggerSummary(match.variant.trigger, resolver);
    return {
        name: resolver.exists('abilityChoice.variantFallbackName')
            ? resolver.t('abilityChoice.variantFallbackName', {
                abilityName: resolver.t(match.ability.name),
                trigger,
            })
            : `${resolver.t(match.ability.name)}（${trigger}）`,
        description: fallbackDescription,
    };
}
