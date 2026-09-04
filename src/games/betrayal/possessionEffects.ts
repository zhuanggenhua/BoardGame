import type {
    BetrayalRecommendedAction,
    BetrayalTraitKey,
    BetrayalUseEffectSeed,
} from './scenarioConfig';
import type {
    BetrayalCore,
    BetrayalExplorerSummary,
} from './game';
import { resolveConnectedRoomIds } from './roomMapModel';
import { damageTraitsAreAssignable } from './traitTrackModel';

export type UseEffectProfile = BetrayalUseEffectSeed;

export const BETRAYAL_TRAIT_LABEL: Record<BetrayalTraitKey, string> = {
    might: '力量',
    speed: '速度',
    knowledge: '知识',
    sanity: '神志',
};

export type PossessionUseEffectProfile = UseEffectProfile | {
    mode: 'nextNonCombatTraitReplacement';
    replacementTrait: BetrayalTraitKey;
    sanityCost: number;
    recommendedAction: BetrayalRecommendedAction;
} | {
    mode: 'healTraits';
    traits: BetrayalTraitKey[];
    consumeOnUse: boolean;
    target: 'self' | 'selfOrSameRoomExplorer';
    recommendedAction: BetrayalRecommendedAction;
} | {
    mode: 'placeExplorer';
    target: 'anyDiscoveredRoom';
    consumeOnUse: boolean;
    recommendedAction: BetrayalRecommendedAction;
} | {
    mode: 'moveOthersInRoom';
    target: 'sameRoomOtherExplorersAndMonsters';
    recommendedAction: BetrayalRecommendedAction;
} | {
    mode: 'extraTurnAfterTurnEnd';
    consumeOnUse: boolean;
    recommendedAction: BetrayalRecommendedAction;
} | {
    mode: 'nextNonCombatTraitRollTotalReplacement';
    minTotal: number;
    maxTotal: number;
    consumeOnUse: boolean;
    recommendedAction: BetrayalRecommendedAction;
};

export const POSSESSION_USE_EFFECTS: Record<string, PossessionUseEffectProfile> = {
    'omen-book': {
        mode: 'nextNonCombatTraitReplacement',
        replacementTrait: 'knowledge',
        sanityCost: 1,
        recommendedAction: 'explore',
    },
    notebook: {
        mode: 'placeExplorer',
        target: 'anyDiscoveredRoom',
        consumeOnUse: true,
        recommendedAction: 'explore',
    },
    'medical-kit': {
        mode: 'healTraits',
        traits: ['might', 'speed', 'knowledge', 'sanity'],
        consumeOnUse: true,
        target: 'selfOrSameRoomExplorer',
        recommendedAction: 'explore',
    },
    mask: {
        mode: 'moveOthersInRoom',
        target: 'sameRoomOtherExplorersAndMonsters',
        recommendedAction: 'move',
    },
    map: {
        mode: 'placeExplorer',
        target: 'anyDiscoveredRoom',
        consumeOnUse: true,
        recommendedAction: 'explore',
    },
    mirror: {
        mode: 'healTraits',
        traits: ['knowledge', 'sanity'],
        consumeOnUse: true,
        target: 'self',
        recommendedAction: 'explore',
    },
    journal: {
        mode: 'placeExplorer',
        target: 'anyDiscoveredRoom',
        consumeOnUse: true,
        recommendedAction: 'explore',
    },
    'holy-water': {
        mode: 'healTraits',
        traits: ['might', 'speed'],
        consumeOnUse: true,
        target: 'self',
        recommendedAction: 'explore',
    },
    manuscript: {
        mode: 'placeExplorer',
        target: 'anyDiscoveredRoom',
        consumeOnUse: true,
        recommendedAction: 'explore',
    },
    'mysterious-stopwatch': {
        mode: 'extraTurnAfterTurnEnd',
        consumeOnUse: true,
        recommendedAction: 'endTurn',
    },
    'angel-feather': {
        mode: 'nextNonCombatTraitRollTotalReplacement',
        minTotal: 0,
        maxTotal: 8,
        consumeOnUse: true,
        recommendedAction: 'explore',
    },
};

export function resolveInventoryEffectId(cardId: string): string {
    return cardId
        .replace(/-preview-\d+$/, '')
        .replace(/-armory-\d+-\d+$/, '')
        .replace(/-\d+$/, '');
}

export function resolveUseEffect(card: { id: string }): PossessionUseEffectProfile | null {
    return POSSESSION_USE_EFFECTS[resolveInventoryEffectId(card.id)] ?? null;
}

export function cloneUseEffect(effect: UseEffectProfile): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map(cloneUseEffect),
        };
    }
    if (effect.mode === 'optionalEventRoll') {
        return {
            ...effect,
            roll: {
                ...effect.roll,
                branches: effect.roll.branches.map((branch) => ({
                    ...branch,
                    effect: cloneUseEffect(branch.effect),
                })),
            },
        };
    }
    if (effect.mode === 'optionalEffect') {
        return {
            ...effect,
            acceptEffect: cloneUseEffect(effect.acceptEffect),
        };
    }
    if (effect.mode === 'optionalItemEffect') {
        return {
            ...effect,
            acceptEffect: cloneUseEffect(effect.acceptEffect),
            declineEffect: cloneUseEffect(effect.declineEffect),
        };
    }
    if (effect.mode === 'optionalHauntRoll') {
        return {
            ...effect,
            failureEffect: cloneUseEffect(effect.failureEffect),
            skippedOrStartedEffect: cloneUseEffect(effect.skippedOrStartedEffect),
        };
    }
    if (effect.mode === 'traitRoll') {
        return {
            ...effect,
            branches: effect.branches.map((branch) => ({
                ...branch,
                effect: cloneUseEffect(branch.effect),
            })),
        };
    }
    if (effect.mode === 'chooseTraitRoll') {
        return {
            ...effect,
            allowedTraits: [...effect.allowedTraits],
            branches: effect.branches.map((branch) => ({
                ...branch,
                effect: cloneUseEffect(branch.effect),
            })),
        };
    }
    if (effect.mode === 'allTraitChecks') {
        return {
            ...effect,
            traits: [...effect.traits],
            results: effect.results?.map((result) => ({
                ...result,
                dice: [...result.dice],
            })),
            allPassEffect: cloneUseEffect(effect.allPassEffect),
        };
    }
    if (effect.mode === 'generalDamage') {
        return { ...effect, traits: [...effect.traits] };
    }
    if (effect.mode === 'generalDamageChoice') {
        return {
            ...effect,
            allowedTraits: [...effect.allowedTraits],
            selectedTraits: effect.selectedTraits ? [...effect.selectedTraits] : undefined,
        };
    }
    if (effect.mode === 'chosenTrait') {
        return { ...effect, allowedTraits: [...effect.allowedTraits] };
    }
    if (effect.mode === 'healChosenTrait') {
        return { ...effect, allowedTraits: [...effect.allowedTraits] };
    }
    if (effect.mode === 'rolledDamage') {
        return { ...effect, rolls: effect.rolls ? [...effect.rolls] : undefined };
    }
    if (effect.mode === 'drawPossession') {
        return {
            ...effect,
            drawnCard: effect.drawnCard ? { ...effect.drawnCard } : undefined,
        };
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByFloor') {
        return {
            ...effect,
            requiredIfDiscoveredVisualIds: effect.requiredIfDiscoveredVisualIds
                ? [...effect.requiredIfDiscoveredVisualIds]
                : undefined,
        };
    }
    return { ...effect };
}

export function effectNeedsTraitChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectNeedsTraitChoice);
    }
    if (effect.mode === 'optionalItemEffect') {
        return effectNeedsTraitChoice(effect.acceptEffect) || effectNeedsTraitChoice(effect.declineEffect);
    }
    return effect.mode === 'chosenTrait' || effect.mode === 'healChosenTrait' || effect.mode === 'generalDamageChoice';
}

export function effectHasUnresolvedTraitChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectHasUnresolvedTraitChoice);
    }
    if (effect.mode === 'optionalItemEffect') {
        return effectHasUnresolvedTraitChoice(effect.acceptEffect) || effectHasUnresolvedTraitChoice(effect.declineEffect);
    }
    if (effect.mode === 'chosenTrait' || effect.mode === 'healChosenTrait') {
        return !effect.chosenTrait;
    }
    if (effect.mode === 'generalDamageChoice') {
        return !effect.selectedTraits || effect.selectedTraits.length !== effect.amount;
    }
    return false;
}

export function effectHasUnresolvedChosenTraitChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectHasUnresolvedChosenTraitChoice);
    }
    if (effect.mode === 'optionalItemEffect') {
        return effectHasUnresolvedChosenTraitChoice(effect.acceptEffect) || effectHasUnresolvedChosenTraitChoice(effect.declineEffect);
    }
    if (effect.mode === 'chosenTrait' || effect.mode === 'healChosenTrait') {
        return !effect.chosenTrait;
    }
    return false;
}

export function effectHasUnresolvedGeneralDamageChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectHasUnresolvedGeneralDamageChoice);
    }
    if (effect.mode === 'optionalItemEffect') {
        return effectHasUnresolvedGeneralDamageChoice(effect.acceptEffect) || effectHasUnresolvedGeneralDamageChoice(effect.declineEffect);
    }
    if (effect.mode === 'generalDamageChoice') {
        return !effect.selectedTraits || effect.selectedTraits.length !== effect.amount;
    }
    return false;
}

export function effectNeedsAdjacentRoomChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectNeedsAdjacentRoomChoice);
    }
    if (effect.mode === 'optionalItemEffect') {
        return effectNeedsAdjacentRoomChoice(effect.acceptEffect) || effectNeedsAdjacentRoomChoice(effect.declineEffect);
    }
    return effect.mode === 'placeExplorerInAdjacentRoom' && !effect.targetRoomId;
}

export function effectNeedsRoomTargetChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectNeedsRoomTargetChoice);
    }
    if (effect.mode === 'optionalItemEffect') {
        return effectNeedsRoomTargetChoice(effect.acceptEffect) || effectNeedsRoomTargetChoice(effect.declineEffect);
    }
    return (
        (
            effect.mode === 'placeSecretPassageToken'
            || effect.mode === 'placeExplorerInDiscoveredRoomByFloor'
        )
        && Boolean(effect.targetRoomScope)
        && !effect.targetRoomId
    );
}

export function eventEffectNeedsPendingEventChoice(effect: UseEffectProfile | undefined): boolean {
    if (!effect) {
        return false;
    }
    return effect.mode === 'optionalEventRoll'
        || effect.mode === 'optionalEffect'
        || effect.mode === 'optionalItemEffect'
        || effect.mode === 'optionalHauntRoll'
        || effect.mode === 'chooseTraitRoll'
        || effect.mode === 'traitRoll'
        || effectHasUnresolvedTraitChoice(effect)
        || effectNeedsAdjacentRoomChoice(effect)
        || effectNeedsRoomTargetChoice(effect)
        || (
            effect.mode === 'allTraitChecks'
            && Boolean(effect.results?.every((result) => result.passed))
            && effectHasUnresolvedTraitChoice(effect.allPassEffect)
        );
}

export function effectAllowsChosenTrait(effect: UseEffectProfile, trait: BetrayalTraitKey): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some((childEffect) => effectAllowsChosenTrait(childEffect, trait));
    }
    if (effect.mode === 'optionalItemEffect') {
        return effectAllowsChosenTrait(effect.acceptEffect, trait) || effectAllowsChosenTrait(effect.declineEffect, trait);
    }
    if (effect.mode === 'chosenTrait' || effect.mode === 'healChosenTrait') {
        return effect.allowedTraits.includes(trait);
    }
    return false;
}

export function effectAllowsRoomTargetChoice(core: BetrayalCore, effect: UseEffectProfile, targetRoomId: string): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some((childEffect) => effectAllowsRoomTargetChoice(core, childEffect, targetRoomId));
    }
    if (effect.mode === 'optionalItemEffect') {
        return effectAllowsRoomTargetChoice(core, effect.acceptEffect, targetRoomId)
            || effectAllowsRoomTargetChoice(core, effect.declineEffect, targetRoomId);
    }
    if (
        (
            effect.mode !== 'placeSecretPassageToken'
            && effect.mode !== 'placeExplorerInDiscoveredRoomByFloor'
        )
        || !effect.targetRoomScope
    ) {
        return false;
    }
    const targetRoom = core.rooms.find((room) => room.id === targetRoomId);
    if (!targetRoom || targetRoom.state !== 'discovered') {
        return false;
    }
    if (effect.mode === 'placeSecretPassageToken' && targetRoom.markerTokens?.includes('secretPassage')) {
        return false;
    }
    const requiredRoom = effect.requiredIfDiscoveredVisualIds?.length
        ? core.rooms.find((room) => (
            room.state === 'discovered' && effect.requiredIfDiscoveredVisualIds!.includes(room.visualId)
        ))
        : null;
    if (requiredRoom) {
        return targetRoom.id === requiredRoom.id;
    }
    if (effect.targetRoomScope === 'anyDiscovered') {
        return true;
    }
    if (effect.targetRoomScope === 'anyOtherDiscovered') {
        return targetRoom.id !== core.currentExplorer.roomId;
    }
    if (effect.targetRoomScope === 'groundDiscovered') {
        return targetRoom.floor === 'ground';
    }
    if (effect.targetRoomScope === 'basementDiscovered') {
        return targetRoom.floor === 'basement';
    }
    const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
    if (effect.targetRoomScope === 'groundOrBasementDiscovered') {
        return targetRoom.floor === 'ground' || targetRoom.floor === 'basement';
    }
    if (effect.targetRoomScope === 'sameFloorDiscovered') {
        return Boolean(currentRoom && targetRoom.floor === currentRoom.floor);
    }
    if (effect.targetRoomScope === 'differentFloorDiscovered') {
        return Boolean(currentRoom && targetRoom.floor !== currentRoom.floor);
    }
    return false;
}

export function effectAllowsAdjacentRoomChoice(core: BetrayalCore, targetRoomId: string): boolean {
    const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
    const targetRoom = core.rooms.find((room) => room.id === targetRoomId);
    if (!currentRoom || !targetRoom || targetRoom.state !== 'discovered') {
        return false;
    }
    return resolveConnectedRoomIds(core.rooms, currentRoom.id).has(targetRoom.id);
}

export function effectAllowsGeneralDamageTraits(
    effect: UseEffectProfile,
    traits: BetrayalTraitKey[] | undefined,
    explorer?: BetrayalExplorerSummary,
    options: { allowSkull?: boolean } = {},
): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some((childEffect) => effectAllowsGeneralDamageTraits(childEffect, traits, explorer, options));
    }
    if (effect.mode === 'optionalItemEffect') {
        return effectAllowsGeneralDamageTraits(effect.acceptEffect, traits, explorer, options)
            || effectAllowsGeneralDamageTraits(effect.declineEffect, traits, explorer, options);
    }
    if (effect.mode !== 'generalDamageChoice') {
        return false;
    }
    if (!traits || traits.length !== effect.amount) {
        return false;
    }
    if (!traits.every((trait) => effect.allowedTraits.includes(trait))) {
        return false;
    }
    return explorer ? damageTraitsAreAssignable(explorer, traits, options) : true;
}

export function applyChosenTraitToEffect(effect: UseEffectProfile, trait?: BetrayalTraitKey): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => applyChosenTraitToEffect(childEffect, trait)),
        };
    }
    if (effect.mode === 'optionalItemEffect') {
        return {
            ...effect,
            acceptEffect: applyChosenTraitToEffect(effect.acceptEffect, trait),
            declineEffect: applyChosenTraitToEffect(effect.declineEffect, trait),
        };
    }
    if (
        trait
        && (effect.mode === 'chosenTrait' || effect.mode === 'healChosenTrait')
        && effect.allowedTraits.includes(trait)
    ) {
        return { ...effect, chosenTrait: trait };
    }
    return effect;
}

export function applyAdjacentRoomChoiceToEffect(
    core: BetrayalCore,
    effect: UseEffectProfile,
    targetRoomId?: string,
): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => applyAdjacentRoomChoiceToEffect(core, childEffect, targetRoomId)),
        };
    }
    if (effect.mode === 'optionalItemEffect') {
        return {
            ...effect,
            acceptEffect: applyAdjacentRoomChoiceToEffect(core, effect.acceptEffect, targetRoomId),
            declineEffect: applyAdjacentRoomChoiceToEffect(core, effect.declineEffect, targetRoomId),
        };
    }
    if (
        effect.mode === 'placeExplorerInAdjacentRoom'
        && targetRoomId
        && effectAllowsAdjacentRoomChoice(core, targetRoomId)
    ) {
        const targetRoom = core.rooms.find((room) => room.id === targetRoomId)!;
        return { ...effect, targetRoomId, targetRoomName: targetRoom.name };
    }
    return effect;
}

export function applyRoomTargetChoiceToEffect(
    core: BetrayalCore,
    effect: UseEffectProfile,
    targetRoomId?: string,
): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => applyRoomTargetChoiceToEffect(core, childEffect, targetRoomId)),
        };
    }
    if (effect.mode === 'optionalItemEffect') {
        return {
            ...effect,
            acceptEffect: applyRoomTargetChoiceToEffect(core, effect.acceptEffect, targetRoomId),
            declineEffect: applyRoomTargetChoiceToEffect(core, effect.declineEffect, targetRoomId),
        };
    }
    if (
        (
            effect.mode === 'placeSecretPassageToken'
            || effect.mode === 'placeExplorerInDiscoveredRoomByFloor'
        )
        && targetRoomId
        && effectAllowsRoomTargetChoice(core, effect, targetRoomId)
    ) {
        const targetRoom = core.rooms.find((room) => room.id === targetRoomId)!;
        return { ...effect, targetRoomId, targetRoomName: targetRoom.name };
    }
    return effect;
}

export function applyGeneralDamageTraitsToEffect(
    effect: UseEffectProfile,
    traits?: BetrayalTraitKey[],
): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => applyGeneralDamageTraitsToEffect(childEffect, traits)),
        };
    }
    if (effect.mode === 'optionalItemEffect') {
        return {
            ...effect,
            acceptEffect: applyGeneralDamageTraitsToEffect(effect.acceptEffect, traits),
            declineEffect: applyGeneralDamageTraitsToEffect(effect.declineEffect, traits),
        };
    }
    if (
        effect.mode === 'generalDamageChoice'
        && traits
        && traits.length === effect.amount
        && traits.every((trait) => effect.allowedTraits.includes(trait))
    ) {
        return { ...effect, selectedTraits: [...traits] };
    }
    return effect;
}

export function isWarningEventEffect(effect: PossessionUseEffectProfile): boolean {
    switch (effect.mode) {
        case 'fixedDamage':
        case 'rolledDamage':
            return true;
        case 'generalDamage':
        case 'generalDamageChoice':
            return effect.amount > 0;
        case 'trait':
        case 'chosenTrait':
            return effect.amount < 0;
        case 'compound':
            return effect.effects.some(isWarningEventEffect);
        case 'placeExplorerInNextFloorStartingRoom':
            return Boolean(effect.basementFallbackDamage);
        case 'optionalItemEffect':
            return isWarningEventEffect(effect.selectedCardId ? effect.acceptEffect : effect.declineEffect);
        default:
            return false;
    }
}

export function formatEffectLabel(effect: PossessionUseEffectProfile): string {
    if (effect.mode === 'none') {
        return '无事发生';
    }
    if (effect.mode === 'move') {
        return `移动 ${effect.amount > 0 ? '+' : ''}${effect.amount}`;
    }
    if (effect.mode === 'nextNonCombatTraitReplacement') {
        return `下一次非战斗检定可用${BETRAYAL_TRAIT_LABEL[effect.replacementTrait]}替换`;
    }
    if (effect.mode === 'nextNonCombatTraitRollTotalReplacement') {
        return `下一次属性检定可用 ${effect.minTotal}-${effect.maxTotal} 的结果替代投骰`;
    }
    if (effect.mode === 'healTraits') {
        return `治疗${effect.traits.map((trait) => BETRAYAL_TRAIT_LABEL[trait]).join('和')}`;
    }
    if (effect.mode === 'placeExplorer') {
        return '放置到任一已发现板块';
    }
    if (effect.mode === 'moveOthersInRoom') {
        return '移动同板块其他探险者和怪物到相邻板块';
    }
    if (effect.mode === 'generalDamage') {
        return `通用伤害 ${effect.amount}`;
    }
    if (effect.mode === 'generalDamageChoice') {
        const selected = effect.selectedTraits?.map((trait) => BETRAYAL_TRAIT_LABEL[trait]).join('、');
        return selected
            ? `通用伤害 ${effect.amount}（${selected}）`
            : `通用伤害 ${effect.amount}`;
    }
    if (effect.mode === 'placeObstacleToken') {
        return '放置障碍物';
    }
    if (effect.mode === 'placeSecretPassageToken') {
        return `在${effect.targetRoomName ?? '当前板块'}放置秘密通道标志物`;
    }
    if (effect.mode === 'placeBlessingToken') {
        return '放置祝福标志物';
    }
    if (effect.mode === 'rolledDamage') {
        return `重新投掷 ${effect.dice} 颗骰子，按合计值分配${effect.damageKind === 'physical' ? '物理' : '精神'}伤害`;
    }
    if (effect.mode === 'fixedDamage') {
        return `受到 ${effect.amount} 点${effect.damageKind === 'physical' ? '物理' : '精神'}伤害`;
    }
    if (effect.mode === 'drawPossession') {
        return `抽取一张${effect.kind === 'item' ? '物品' : '预兆'}卡`;
    }
    if (effect.mode === 'chosenTrait') {
        const trait = effect.chosenTrait ?? effect.allowedTraits[0];
        return `${trait ? BETRAYAL_TRAIT_LABEL[trait] : '任意属性'} ${effect.amount > 0 ? '+' : ''}${effect.amount}`;
    }
    if (effect.mode === 'healChosenTrait') {
        const trait = effect.chosenTrait ?? effect.allowedTraits[0];
        return `治疗${trait ? BETRAYAL_TRAIT_LABEL[trait] : '任意属性'}`;
    }
    if (effect.mode === 'placeExplorerInRoom') {
        return `放置到${effect.roomName}`;
    }
    if (effect.mode === 'placeExplorerInFloorStartingRoom') {
        return `放置到${effect.roomName}`;
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByVisualId') {
        return `放置到${effect.roomNames.join('或')}`;
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByFloor') {
        if (effect.targetRoomName) {
            return `放置到${effect.targetRoomName}`;
        }
        const scopeLabelByTarget = {
            anyDiscovered: '任意已发现板块',
            groundDiscovered: '任意地面层板块',
            basementDiscovered: '任意地下室板块',
            groundOrBasementDiscovered: '任意地面层或地下室板块',
            sameFloorDiscovered: '所在区域的任意板块',
            differentFloorDiscovered: '不同区域的任意板块',
        } satisfies Record<Extract<UseEffectProfile, { mode: 'placeExplorerInDiscoveredRoomByFloor' }>['targetRoomScope'], string>;
        return `放置到${scopeLabelByTarget[effect.targetRoomScope]}`;
    }
    if (effect.mode === 'placeExplorerInNextFloorStartingRoom') {
        return '放置到下一楼层起始点';
    }
    if (effect.mode === 'placeExplorerInAdjacentRoom') {
        return `放置到${effect.targetRoomName ?? '相邻板块'}`;
    }
    if (effect.mode === 'optionalEffect') {
        return `可选择${effect.acceptLabel}`;
    }
    if (effect.mode === 'optionalItemEffect') {
        if (effect.selectedCardName) {
            return `${effect.consumeAction === 'bury' ? '埋葬' : '弃置'}${effect.selectedCardName}；${formatEffectLabel(effect.acceptEffect)}`;
        }
        return `可选择${effect.acceptLabel}`;
    }
    if (effect.mode === 'optionalEventRoll') {
        return `可选择${effect.acceptLabel}`;
    }
    if (effect.mode === 'optionalHauntRoll') {
        return `可选择${effect.acceptLabel}`;
    }
    if (effect.mode === 'chooseTraitRoll') {
        return effect.prompt;
    }
    if (effect.mode === 'traitRoll') {
        return `${BETRAYAL_TRAIT_LABEL[effect.trait]}检定`;
    }
    if (effect.mode === 'allTraitChecks') {
        return '每项属性各检定一次';
    }
    if (effect.mode === 'compound') {
        return effect.effects.map(formatEffectLabel).join('；');
    }
    return `${BETRAYAL_TRAIT_LABEL[effect.trait!]} ${effect.amount > 0 ? '+' : ''}${effect.amount}`;
}
