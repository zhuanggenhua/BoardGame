import {
    buildYearCardSlots,
    getFactionOrderForYearIndex,
    getQidahenMaxChronologyYearIndex,
    getYearLabelByIndex,
} from './characterChronologyConfig';
import {
    applyChronologyCharactersForYear,
} from './characterChronologyState';
import {
    getMidyearDefeatMarkerRoll,
    listMarkedCharacters,
    syncFactionCharactersToDefeatMarkerCount,
} from './defeatMarkerState';
import {
    addFactionHandCards,
    drawFromFactionPile,
    drawKoreaCardsForFaction,
} from './handCardState';
import { hasActiveCharacter } from './characterPresenceAccessors';
import { getFactionDisplayName, toFactionLabel } from './factionLabelSemantics';
import { getEffectiveKoreaTributeCardsForFaction } from './koreaTributeRules';
import {
    getQidahenEffectiveCityPopulation,
    getQidahenEffectivePopulation,
} from './populationRules';
import { isQidahenKoreaRuntimeRegionId } from './regionConfig';
import {
    QIDAHEN_HAN_RUNTIME_REGION_IDS,
    QIDAHEN_NON_HAN_RUNTIME_REGION_IDS,
} from './regionEthnicity';
import { getActionRuleDisplayRegionName } from './regionRuleSemantics';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import { getQidahenRuleRegionController } from './specialRuleState';
import {
    cloneRuntimeRegionAsPieceSnapshot,
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
    getRegularTroopCount,
    getSpecialTroopCount,
    sortCompatPiecesForRemoval,
} from './troopCompat';
import type {
    QidahenCasualtyPriority,
    QidahenCharacterState,
    QidahenCore,
    QidahenFactionId,
    QidahenFortificationMaintenanceMode,
} from './types';
import {
    countQidahenControlledRuntimeRegions,
    getQidahenEffectiveVpByFaction,
} from './victoryResolution';

const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];

const MING_DONGLIN_CHARACTER_IDS = new Set([
    'ming-xiong-tingbi',
    'ming-sun-yuanhua',
    'ming-yuan-chonghuan',
    'ming-mao-wenlong',
]);

type QidahenMidyearCharacterJudgementContext = Pick<QidahenCore, 'factions' | 'regions'>;

type QidahenMidyearCharacterJudgementOutcome =
    | { kind: 'none'; summary: string }
    | { kind: 'down'; summary: string }
    | { kind: 'remove'; summary: string }
    | { kind: 'transfer'; summary: string; targetFactionId: QidahenFactionId };

type QidahenMidyearCharacterJudgementRule = {
    dieSides: 6 | 8 | 10 | 12;
    getAttemptCount?: (state: QidahenMidyearCharacterJudgementContext, character: QidahenCharacterState) => number;
    resolve: (
        state: QidahenMidyearCharacterJudgementContext,
        character: QidahenCharacterState,
        effectiveRoll: number,
    ) => QidahenMidyearCharacterJudgementOutcome;
};

export interface QidahenCharacterJudgementResolution {
    factions: QidahenCore['factions'];
    summary: string;
}

type QidahenMidyearResolution = Pick<QidahenCore, 'factions' | 'lastSeasonSummary'>;

type QidahenNewYearResolution = Pick<
    QidahenCore,
    'currentYearIndex' | 'currentYear' | 'currentFactionOrder' | 'yearCards' | 'factions' | 'regions' | 'fortifications' | 'koreaDeckCount' | 'lastSeasonSummary'
>;

interface QidahenSeasonResolutionDependencies {
    drawFromFactionPile: (
        factions: QidahenCore['factions'],
        sourceFactionId: QidahenFactionId,
        requestedCards: number,
        discardGain?: number,
    ) => { factions: QidahenCore['factions']; drawnCards: number };
    addFactionHandCards: (
        factions: QidahenCore['factions'],
        factionId: QidahenFactionId,
        handGain: number,
    ) => QidahenCore['factions'];
    applyChronologyCharactersForYear: (
        factions: QidahenCore['factions'],
        currentYearIndex: number,
    ) => {
        factions: QidahenCore['factions'];
        summaryLines: string[];
    };
}

const getFanWenchengMidyearBonusDraw = (
    state: QidahenCore,
): { controlledHanRegionCount: number; bonusDrawCards: number } => {
    if (!hasActiveCharacter(state, 'jin', 'jin-fan-wencheng')) {
        return { controlledHanRegionCount: 0, bonusDrawCards: 0 };
    }
    const controlledHanRegionCount = state.regions.filter((region) => (
        !region.isLogicalRegion
        && QIDAHEN_HAN_RUNTIME_REGION_IDS.has(region.id)
        && region.controller === 'jin'
    )).length;
    return {
        controlledHanRegionCount,
        bonusDrawCards: controlledHanRegionCount * 2,
    };
};

const getQidahenFreeUpkeepSupport = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    supportGap: number,
): number => (
    factionId === 'ming' && supportGap > 0 && hasActiveCharacter(state, 'ming', 'ming-wang-huazhen')
        ? 1
        : 0
);

const getYearCardClaimCost = (handCount: number): number => Math.ceil(Math.max(0, handCount) / 2);

const getChronologyClaimPriority = (state: QidahenCore): QidahenFactionId[] => {
    const effectiveVpByFaction = Object.fromEntries(
        factionOrder.map((factionId) => [factionId, getQidahenEffectiveVpByFaction(state, factionId)]),
    ) as Record<QidahenFactionId, number>;
    const currentOrderIndexByFaction = Object.fromEntries(
        factionOrder.map((factionId) => {
            const orderIndex = state.currentFactionOrder.indexOf(factionId);
            return [factionId, orderIndex >= 0 ? orderIndex : factionOrder.indexOf(factionId)];
        }),
    ) as Record<QidahenFactionId, number>;

    return [...factionOrder].sort((left, right) => {
        const vpDiff = effectiveVpByFaction[right] - effectiveVpByFaction[left];
        if (vpDiff !== 0) {
            return vpDiff;
        }
        return currentOrderIndexByFaction[left] - currentOrderIndexByFaction[right];
    });
};

const applyUpkeepAttritionToRegion = <TRegion extends Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>>(
    region: TRegion,
    troopLoss: number,
    casualtyPriority: QidahenCasualtyPriority = 'lowest-level',
): {
    region: TRegion;
    removedDetails: string[];
} => {
    const remainingLoss = Math.max(0, troopLoss);
    if (remainingLoss <= 0 || region.specialTroops.length === 0) {
        return {
            region,
            removedDetails: remainingLoss > 0 ? [`未结构化部队 x${remainingLoss}`] : [],
        };
    }

    const genericTroops = Math.max(0, region.troops - getSpecialTroopCount(region));
    const specialLoss = Math.max(0, remainingLoss - genericTroops);
    const removedDetails: string[] = genericTroops > 0
        ? [`未结构化部队 x${Math.min(genericTroops, remainingLoss)}`]
        : [];
    if (specialLoss <= 0) {
        return {
            region,
            removedDetails,
        };
    }

    const allPieces = expandSpecialTroopStacksToCompatPieces(region.specialTroops);
    const removedPieces = sortCompatPiecesForRemoval(allPieces, casualtyPriority)
        .slice(0, specialLoss);
    const removedPieceIds = new Set(removedPieces.map((piece) => piece.id));
    const removedByLabel = new Map<string, { label: string; count: number }>();
    for (const piece of removedPieces) {
        const previous = removedByLabel.get(piece.label);
        if (previous) {
            previous.count += 1;
            continue;
        }
        removedByLabel.set(piece.label, {
            label: piece.label,
            count: 1,
        });
    }
    removedDetails.push(
        ...Array.from(removedByLabel.values()).map((entry) => `${entry.label} x${entry.count}`),
    );

    return {
        region: {
            ...region,
            specialTroops: collapseCompatPiecesToSpecialTroopStacks(
                allPieces.filter((piece) => !removedPieceIds.has(piece.id)),
            ),
        },
        removedDetails,
    };
};

const hasLindanHutuktuMidyearPenalty = (
    factions: QidahenCore['factions'],
    character: QidahenCharacterState,
): boolean => {
    const lindanHutuktuActive = factionOrder.some((candidateFactionId) => (
        factions[candidateFactionId].characters.some((candidate) => (
            candidate.id === 'mongol-lindan-hutuktu'
            && candidate.inPlay
        ))
    ));
    if (!lindanHutuktuActive || character.id === 'mongol-lindan-hutuktu') {
        return false;
    }
    const jinCharactersProtectedByDaisan = factions.jin.characters.some((candidate) => candidate.id === 'jin-daisan' && candidate.inPlay);
    return !(character.faction === 'jin' && jinCharactersProtectedByDaisan);
};

const applyMidyearCharacterJudgementPenalty = (
    factions: QidahenCore['factions'],
    character: QidahenCharacterState,
    rawRoll: number,
): number => (
    hasLindanHutuktuMidyearPenalty(factions, character)
        ? Math.max(0, rawRoll - 1)
        : rawRoll
);

const getMidyearCharacterJudgementRoll = (
    characterId: string,
    dieSides: number,
    attemptIndex: number,
): number => {
    const source = `${characterId}:${attemptIndex}`;
    let seed = 0;
    for (const char of source) {
        seed = (seed * 31 + char.charCodeAt(0)) % 9973;
    }
    return (seed % dieSides) + 1;
};

const hasAnyOtherActiveCharacter = (
    state: QidahenMidyearCharacterJudgementContext,
    characterId: string,
): boolean => factionOrder.some((factionId) => (
    state.factions[factionId].characters.some((candidate) => candidate.inPlay && candidate.id !== characterId)
));

const getOccupiedDongjiangController = (
    regions: QidahenCore['regions'],
): QidahenFactionId | null => {
    const dongjiang = regions.find((region) => !region.isLogicalRegion && region.id === 'song-jin');
    if (!dongjiang || dongjiang.controller === 'neutral' || dongjiang.controller === 'ming') {
        return null;
    }
    return dongjiang.controller;
};

const buildReturnToCurrentPileSummary = (character: QidahenCharacterState): string => (
    `下野，回到${getFactionDisplayName(character.faction)}人物牌堆`
);

const getMidyearCharacterJudgementRule = (
    characterId: string,
): QidahenMidyearCharacterJudgementRule | null => {
    switch (characterId) {
        case 'ming-xiong-tingbi':
            return {
                dieSides: 8,
                resolve: (state, character, effectiveRoll) => {
                    if (effectiveRoll === 1) {
                        return { kind: 'remove', summary: '失势，自游戏中移除' };
                    }
                    if (effectiveRoll >= 2 && effectiveRoll <= 4) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    if (effectiveRoll >= 5 && effectiveRoll <= 6 && hasAnyOtherActiveCharacter(state, character.id)) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'ming-sun-yuanhua':
            return {
                dieSides: 12,
                resolve: (_state, character, effectiveRoll) => {
                    if (effectiveRoll === 1) {
                        return { kind: 'transfer', summary: '叛逃，进入后金人物牌堆', targetFactionId: 'jin' };
                    }
                    if (effectiveRoll >= 2 && effectiveRoll <= 5) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'ming-mao-wenlong':
            return {
                dieSides: 10,
                getAttemptCount: (state) => (getOccupiedDongjiangController(state.regions) ? 2 : 1),
                resolve: (state, character, effectiveRoll) => {
                    if (effectiveRoll >= 1 && effectiveRoll <= 4) {
                        const occupiedDongjiangController = getOccupiedDongjiangController(state.regions);
                        if (occupiedDongjiangController) {
                            return {
                                kind: 'transfer',
                                summary: `叛逃，进入${getFactionDisplayName(occupiedDongjiangController)}人物牌堆`,
                                targetFactionId: occupiedDongjiangController,
                            };
                        }
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    if (effectiveRoll >= 5 && effectiveRoll <= 8) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'ming-yang-gao':
            return {
                dieSides: 6,
                resolve: (_state, _character, effectiveRoll) => {
                    if (effectiveRoll === 1) {
                        return { kind: 'transfer', summary: '叛逃，进入后金人物牌堆', targetFactionId: 'jin' };
                    }
                    if (effectiveRoll === 2) {
                        return { kind: 'transfer', summary: '叛逃，进入蒙古人物牌堆', targetFactionId: 'mongol' };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'ming-gao-di':
            return {
                dieSides: 10,
                resolve: (state, character, effectiveRoll) => {
                    if (effectiveRoll === 1) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    if (
                        effectiveRoll >= 2
                        && effectiveRoll <= 5
                        && state.factions.ming.characters.some((candidate) => (
                            candidate.inPlay
                            && candidate.id !== character.id
                            && MING_DONGLIN_CHARACTER_IDS.has(candidate.id)
                        ))
                    ) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'ming-wang-huazhen':
            return {
                dieSides: 10,
                resolve: (state, character, effectiveRoll) => {
                    if (effectiveRoll === 1) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    if (
                        effectiveRoll >= 2
                        && effectiveRoll <= 5
                        && state.factions.ming.characters.some((candidate) => (
                            candidate.inPlay
                            && candidate.id !== character.id
                            && MING_DONGLIN_CHARACTER_IDS.has(candidate.id)
                        ))
                    ) {
                        return { kind: 'remove', summary: '失势，自游戏中移除' };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'mongol-lindan-hutuktu':
            return {
                dieSides: 12,
                resolve: (_state, character, effectiveRoll) => {
                    if (effectiveRoll === 1) {
                        return { kind: 'remove', summary: '伤重而死，自游戏中移除' };
                    }
                    if (effectiveRoll >= 2 && effectiveRoll <= 4) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'mongol-oba-taiji':
            return {
                dieSides: 8,
                resolve: (_state, character, effectiveRoll) => {
                    if (effectiveRoll >= 0 && effectiveRoll <= 2) {
                        return { kind: 'transfer', summary: '叛逃，进入后金人物牌堆', targetFactionId: 'jin' };
                    }
                    if (effectiveRoll >= 3 && effectiveRoll <= 5) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'mongol-qisai-noyan':
            return {
                dieSides: 12,
                resolve: (_state, character, effectiveRoll) => {
                    if (effectiveRoll >= 0 && effectiveRoll <= 1) {
                        return { kind: 'transfer', summary: '叛逃，进入后金人物牌堆', targetFactionId: 'jin' };
                    }
                    if (effectiveRoll >= 2 && effectiveRoll <= 4) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'jin-fan-wencheng':
            return {
                dieSides: 10,
                resolve: (_state, character, effectiveRoll) => (
                    effectiveRoll >= 1 && effectiveRoll <= 2
                        ? { kind: 'down', summary: buildReturnToCurrentPileSummary(character) }
                        : { kind: 'none', summary: '无效果' }
                ),
            };
        case 'jin-amin':
            return {
                dieSides: 10,
                resolve: (_state, character, effectiveRoll) => {
                    if (effectiveRoll >= 1 && effectiveRoll <= 3) {
                        return { kind: 'transfer', summary: '叛逃，进入大明人物牌堆', targetFactionId: 'ming' };
                    }
                    if (effectiveRoll >= 3 && effectiveRoll <= 6) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'jin-manggultai':
            return {
                dieSides: 8,
                resolve: (_state, character, effectiveRoll) => {
                    if (effectiveRoll === 1) {
                        return { kind: 'remove', summary: '被围俘，自游戏中移除' };
                    }
                    if (effectiveRoll >= 2 && effectiveRoll <= 3) {
                        return { kind: 'transfer', summary: '叛逃，进入蒙古人物牌堆', targetFactionId: 'mongol' };
                    }
                    if (effectiveRoll >= 4 && effectiveRoll <= 6) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'jin-eidu':
            return {
                dieSides: 10,
                resolve: (_state, _character, effectiveRoll) => {
                    if (effectiveRoll === 1) {
                        return { kind: 'transfer', summary: '叛逃，进入蒙古人物牌堆', targetFactionId: 'mongol' };
                    }
                    if (effectiveRoll === 2) {
                        return { kind: 'remove', summary: '伤重而死，自游戏中移除' };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        case 'jin-yanguli':
            return {
                dieSides: 8,
                resolve: (_state, character, effectiveRoll) => {
                    if (effectiveRoll >= 1 && effectiveRoll <= 2) {
                        return { kind: 'remove', summary: '战死，自游戏中移除' };
                    }
                    if (effectiveRoll >= 3 && effectiveRoll <= 6) {
                        return { kind: 'down', summary: buildReturnToCurrentPileSummary(character) };
                    }
                    return { kind: 'none', summary: '无效果' };
                },
            };
        default:
            return null;
    }
};

const transferCharacterToFactionPile = (
    factions: QidahenCore['factions'],
    sourceFactionId: QidahenFactionId,
    character: QidahenCharacterState,
    targetFactionId: QidahenFactionId,
): QidahenCore['factions'] => {
    const sourceCharacters = factions[sourceFactionId].characters;
    const targetCharacters = factions[targetFactionId].characters;
    const movedCharacter: QidahenCharacterState = {
        ...character,
        faction: targetFactionId,
        inPlay: false,
        removedFromGame: false,
        defeatMarkers: 0,
    };
    return {
        ...factions,
        [sourceFactionId]: {
            ...factions[sourceFactionId],
            characters: sourceCharacters.filter((candidate) => candidate.id !== character.id),
        },
        [targetFactionId]: {
            ...factions[targetFactionId],
            characters: [
                ...targetCharacters.filter((candidate) => candidate.id !== character.id),
                movedCharacter,
            ],
        },
    };
};

export const canResolveQidahenCharacterJudgement = (characterId: string): boolean => (
    getMidyearCharacterJudgementRule(characterId) != null
);

export const resolveQidahenSingleCharacterJudgement = (
    state: QidahenMidyearCharacterJudgementContext,
    factionId: QidahenFactionId,
    characterId: string,
    attemptIndex = 0,
): QidahenCharacterJudgementResolution | null => {
    const character = state.factions[factionId].characters.find((candidate) => candidate.id === characterId);
    if (!character?.inPlay) {
        return null;
    }
    const rule = getMidyearCharacterJudgementRule(character.id);
    if (!rule) {
        return null;
    }

    const rawRoll = getMidyearCharacterJudgementRoll(character.id, rule.dieSides, attemptIndex);
    const effectiveRoll = applyMidyearCharacterJudgementPenalty(state.factions, character, rawRoll);
    const outcome = rule.resolve(state, character, effectiveRoll);
    const rollSegment = `${rawRoll}${effectiveRoll !== rawRoll ? `→${effectiveRoll}` : ''}`;
    let nextFactions = state.factions;

    if (outcome.kind === 'down') {
        nextFactions = {
            ...nextFactions,
            [factionId]: {
                ...nextFactions[factionId],
                characters: nextFactions[factionId].characters.map((candidate) => (
                    candidate.id === character.id
                        ? {
                            ...candidate,
                            inPlay: false,
                            removedFromGame: false,
                            defeatMarkers: 0,
                        }
                        : candidate
                )),
            },
        };
    } else if (outcome.kind === 'remove') {
        nextFactions = {
            ...nextFactions,
            [factionId]: {
                ...nextFactions[factionId],
                characters: nextFactions[factionId].characters.map((candidate) => (
                    candidate.id === character.id
                        ? {
                            ...candidate,
                            inPlay: false,
                            removedFromGame: true,
                            defeatMarkers: 0,
                        }
                        : candidate
                )),
            },
        };
    } else if (outcome.kind === 'transfer') {
        nextFactions = transferCharacterToFactionPile(
            nextFactions,
            factionId,
            character,
            outcome.targetFactionId,
        );
    }

    return {
        factions: nextFactions,
        summary: `${character.name}(d${rule.dieSides}) 掷 ${rollSegment}：${outcome.summary}`,
    };
};

const resolveMidyearCharacterJudgements = (
    state: QidahenMidyearCharacterJudgementContext,
): {
    factions: QidahenCore['factions'];
    summary: string;
} => {
    let nextFactions = state.factions;
    const judgementSummaries: string[] = [];

    for (const factionId of factionOrder) {
        const charactersInPlay = nextFactions[factionId].characters.filter((character) => character.inPlay);
        for (const snapshotCharacter of charactersInPlay) {
            const currentCharacter = nextFactions[factionId].characters.find((candidate) => candidate.id === snapshotCharacter.id);
            if (!currentCharacter?.inPlay) {
                continue;
            }
            const rule = getMidyearCharacterJudgementRule(currentCharacter.id);
            if (!rule) {
                continue;
            }
            const attempts = Math.max(1, rule.getAttemptCount?.({ factions: nextFactions, regions: state.regions }, currentCharacter) ?? 1);
            const rollSegments: string[] = [];
            let finalOutcome: QidahenMidyearCharacterJudgementOutcome = { kind: 'none', summary: '无效果' };

            for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
                const latestCharacter = nextFactions[factionId].characters.find((candidate) => candidate.id === snapshotCharacter.id);
                if (!latestCharacter?.inPlay) {
                    break;
                }
                const rawRoll = getMidyearCharacterJudgementRoll(latestCharacter.id, rule.dieSides, attemptIndex);
                const effectiveRoll = applyMidyearCharacterJudgementPenalty(nextFactions, latestCharacter, rawRoll);
                const outcome = rule.resolve({ factions: nextFactions, regions: state.regions }, latestCharacter, effectiveRoll);
                rollSegments.push(`${rawRoll}${effectiveRoll !== rawRoll ? `→${effectiveRoll}` : ''}`);
                finalOutcome = outcome;

                if (outcome.kind === 'down') {
                    nextFactions = {
                        ...nextFactions,
                        [factionId]: {
                            ...nextFactions[factionId],
                            characters: nextFactions[factionId].characters.map((candidate) => (
                                candidate.id === latestCharacter.id
                                    ? {
                                        ...candidate,
                                        inPlay: false,
                                        removedFromGame: false,
                                        defeatMarkers: 0,
                                    }
                                    : candidate
                            )),
                        },
                    };
                    break;
                }

                if (outcome.kind === 'remove') {
                    nextFactions = {
                        ...nextFactions,
                        [factionId]: {
                            ...nextFactions[factionId],
                            characters: nextFactions[factionId].characters.map((candidate) => (
                                candidate.id === latestCharacter.id
                                    ? {
                                        ...candidate,
                                        inPlay: false,
                                        removedFromGame: true,
                                        defeatMarkers: 0,
                                    }
                                    : candidate
                            )),
                        },
                    };
                    break;
                }

                if (outcome.kind === 'transfer') {
                    nextFactions = transferCharacterToFactionPile(nextFactions, factionId, latestCharacter, outcome.targetFactionId);
                    break;
                }
            }

            judgementSummaries.push(`${currentCharacter.name}(d${rule.dieSides}) 掷 ${rollSegments.join('/')}：${finalOutcome.summary}`);
        }
    }

    return {
        factions: nextFactions,
        summary: judgementSummaries.length > 0
            ? judgementSummaries.join('；')
            : '本次没有需要处理的人物额外判定',
    };
};

const resolveCharacterDefeatMarkerRolls = (
    factionId: QidahenFactionId,
    characters: QidahenCharacterState[],
    factions: QidahenCore['factions'],
): {
    characters: QidahenCharacterState[];
    rolls: number[];
    details: string[];
    removedCharacters: string[];
} => {
    let nextCharacters = characters;
    const rolls: number[] = [];
    const details: string[] = [];
    const removedCharacters: string[] = [];

    for (const character of listMarkedCharacters(characters)) {
        const currentCharacter = nextCharacters.find((item) => item.id === character.id);
        if (!currentCharacter || !currentCharacter.inPlay || currentCharacter.defeatMarkers <= 0) {
            continue;
        }

        for (let markerIndex = 0; markerIndex < currentCharacter.defeatMarkers; markerIndex += 1) {
            const rawRoll = getMidyearDefeatMarkerRoll(factionId, rolls.length);
            const effectiveRoll = applyMidyearCharacterJudgementPenalty(factions, currentCharacter, rawRoll);
            rolls.push(rawRoll);
            const removed = currentCharacter.number !== 'X' && effectiveRoll === Number(currentCharacter.number);
            details.push(`${currentCharacter.name}(${currentCharacter.number}) 掷 ${rawRoll}${effectiveRoll !== rawRoll ? `→${effectiveRoll}` : ''}${removed ? ' 离场' : ''}`);

            if (removed) {
                removedCharacters.push(currentCharacter.name);
                nextCharacters = nextCharacters.map((item) => (
                    item.id === currentCharacter.id
                        ? {
                            ...item,
                            inPlay: false,
                            defeatMarkers: 0,
                        }
                        : item
                ));
                break;
            }
        }

        nextCharacters = nextCharacters.map((item) => (
            item.id === currentCharacter.id
                ? {
                    ...item,
                    defeatMarkers: 0,
                }
                : item
        ));
    }

    return {
        characters: nextCharacters,
        rolls,
        details,
        removedCharacters,
    };
};

const resolveMidyearDefeatMarkers = (
    state: Pick<QidahenCore, 'factions' | 'regions'>,
): {
    factions: QidahenCore['factions'];
    summaryLines: string[];
} => {
    const characterJudgementResolution = resolveMidyearCharacterJudgements(state);
    let nextFactions = characterJudgementResolution.factions;
    const markerSummaries: string[] = [];

    for (const factionId of factionOrder) {
        const syncedFaction = syncFactionCharactersToDefeatMarkerCount(nextFactions[factionId]);
        const markerCount = syncedFaction.defeatMarkers ?? 0;
        if (markerCount <= 0) {
            nextFactions = {
                ...nextFactions,
                [factionId]: syncedFaction,
            };
            continue;
        }
        const markerResolution = resolveCharacterDefeatMarkerRolls(factionId, syncedFaction.characters, nextFactions);
        const markerRolls = markerResolution.rolls.length > 0 ? markerResolution.rolls : [getMidyearDefeatMarkerRoll(factionId, 0)];
        const markerDetails = markerResolution.details.join('、');
        const removedSummary = markerResolution.removedCharacters.length > 0
            ? `，${markerResolution.removedCharacters.join('、')}离场`
            : '';
        nextFactions = {
            ...nextFactions,
            [factionId]: {
                ...syncedFaction,
                defeatMarkers: 0,
                characters: markerResolution.characters,
            },
        };
        markerSummaries.push(`${syncedFaction.name}处理 ${markerCount} 个战败标记，掷骰 ${markerRolls.join('/')}${markerDetails ? `（${markerDetails}）` : ''}${removedSummary}`);
    }

    const markerSummary = markerSummaries.length > 0
        ? `${markerSummaries.join('，')}，标记已移除`
        : '本次没有需要处理的战败标记';
    const summaryLine = `年中战败标记与人物判定：人物额外判定：${characterJudgementResolution.summary}；战败标记：${markerSummary}。`;

    return {
        factions: nextFactions,
        summaryLines: [summaryLine],
    };
};

export const resolveQidahenMidyear = (
    state: QidahenCore,
    timestamp: number,
    dependencies: QidahenSeasonResolutionDependencies = {
        drawFromFactionPile,
        addFactionHandCards,
        applyChronologyCharactersForYear,
    },
): QidahenMidyearResolution => {
    let nextFactions = { ...state.factions };
    const landTaxGain: Record<QidahenFactionId, number> = { ming: 0, mongol: 0, jin: 0 };

    for (const region of state.regions) {
        if (region.isLogicalRegion || region.controller === 'neutral') {
            continue;
        }
        if (region.siegeState) {
            continue;
        }
        const totalPopulation = getQidahenEffectivePopulation(region)
            + getQidahenEffectiveCityPopulation(region);
        const totalTroops = region.troops + (region.cityState?.troops ?? 0);
        if (totalPopulation > totalTroops) {
            landTaxGain[region.controller] += 1;
        }
    }

    for (const factionId of factionOrder) {
        if (landTaxGain[factionId] <= 0) {
            continue;
        }
        nextFactions[factionId] = {
            ...nextFactions[factionId],
            handCount: nextFactions[factionId].handCount + landTaxGain[factionId],
            landTax: nextFactions[factionId].landTax + landTaxGain[factionId],
        };
    }

    const canalDrawResult = dependencies.drawFromFactionPile(nextFactions, 'ming', 5);
    nextFactions = dependencies.addFactionHandCards(canalDrawResult.factions, 'ming', canalDrawResult.drawnCards);
    const fanWenchengBonus = getFanWenchengMidyearBonusDraw(state);
    const fanWenchengDrawResult = dependencies.drawFromFactionPile(nextFactions, 'jin', fanWenchengBonus.bonusDrawCards);
    nextFactions = dependencies.addFactionHandCards(fanWenchengDrawResult.factions, 'jin', fanWenchengDrawResult.drawnCards);
    const defeatMarkerResolution = resolveMidyearDefeatMarkers({
        factions: nextFactions,
        regions: state.regions,
    });
    nextFactions = defeatMarkerResolution.factions;

    const summaryLines = factionOrder.map((factionId) => {
        const gain = landTaxGain[factionId];
        return gain > 0
            ? `${nextFactions[factionId].name} 因土地税赋获得 ${gain} 张手牌。`
            : `${nextFactions[factionId].name} 本次年中未从土地税赋获得手牌。`;
    });

    summaryLines.push(
        canalDrawResult.drawnCards > 0
            ? `大明因江南漕运获得 ${canalDrawResult.drawnCards} 张手牌。`
            : '大明因普通牌堆不足，本次江南漕运未获得手牌。',
    );
    if (fanWenchengBonus.controlledHanRegionCount > 0) {
        summaryLines.push(
            fanWenchengDrawResult.drawnCards > 0
                ? `后金因范文程控制 ${fanWenchengBonus.controlledHanRegionCount} 个汉人区域，额外抽 ${fanWenchengDrawResult.drawnCards} 张手牌。`
                : `后金虽因范文程控制 ${fanWenchengBonus.controlledHanRegionCount} 个汉人区域可额外抽牌，但后金牌堆不足，本次未获得手牌。`,
        );
    }
    summaryLines.push(...defeatMarkerResolution.summaryLines);
    summaryLines.push(...factionOrder.map((factionId) => (
        `${nextFactions[factionId].name} 当前控制 ${countQidahenControlledRuntimeRegions(state.regions, factionId)} 个非朝鲜区域。`
    )));

    return {
        factions: nextFactions,
        lastSeasonSummary: buildSeasonSummary('年中结算', timestamp, summaryLines),
    };
};

export const resolveQidahenNewYear = (
    state: QidahenCore,
    timestamp: number,
    maintenanceMode: QidahenFortificationMaintenanceMode = 'auto-pay',
    attritionPriority: QidahenCasualtyPriority = 'lowest-level',
    dependencies: QidahenSeasonResolutionDependencies = {
        drawFromFactionPile,
        addFactionHandCards,
        applyChronologyCharactersForYear,
    },
): QidahenNewYearResolution => {
    let nextFactions = { ...state.factions };
    let nextFortifications = state.fortifications.map((fortification) => ({ ...fortification }));
    let nextKoreaDeckCount = state.koreaDeckCount;
    const summaryLines: string[] = [];

    const koreaTributeByFaction: Record<QidahenFactionId, number> = { ming: 0, mongol: 0, jin: 0 };
    for (const region of state.regions) {
        if (region.isLogicalRegion || region.controller === 'neutral') {
            continue;
        }
        const tributeCards = getEffectiveKoreaTributeCardsForFaction(state, region.controller, region.id);
        if (tributeCards > 0) {
            koreaTributeByFaction[region.controller] += tributeCards;
        }
    }
    for (const factionId of factionOrder) {
        const tributeGain = koreaTributeByFaction[factionId];
        if (tributeGain > 0) {
            const drawResult = drawKoreaCardsForFaction(nextFactions, nextKoreaDeckCount, factionId, tributeGain);
            nextFactions = drawResult.factions;
            nextKoreaDeckCount = drawResult.koreaDeckCount;
            summaryLines.push(`${nextFactions[factionId].name} 因朝鲜朝贡获得 ${drawResult.drawnCards} 张朝鲜牌。`);
        }
    }

    let mingHandCount = nextFactions.ming.handCount;
    nextFortifications = nextFortifications.map((fortification) => {
        if (maintenanceMode === 'skip-all') {
            summaryLines.push(`大明放弃维护 ${fortification.label}，改为破败。`);
            return { ...fortification, ruined: true };
        }
        const dependencyHeld = fortification.dependencyRegionId == null
            || getQidahenRuleRegionController(state, fortification.dependencyRegionId) === 'ming';
        const canMaintain = dependencyHeld && mingHandCount >= fortification.maintenanceCost;
        if (canMaintain) {
            mingHandCount -= fortification.maintenanceCost;
            summaryLines.push(`大明维护 ${fortification.label}，支付 ${fortification.maintenanceCost} 张手牌。`);
            return { ...fortification, ruined: false };
        }

        if (!dependencyHeld && fortification.dependencyLabel) {
            summaryLines.push(`大明失去 ${fortification.dependencyLabel}，${fortification.label} 本轮无法修缮，改为破败。`);
        } else {
            summaryLines.push(`大明未能维护 ${fortification.label}，改为破败。`);
        }
        return { ...fortification, ruined: true };
    });
    nextFactions.ming = {
        ...nextFactions.ming,
        handCount: mingHandCount,
    };

    const upkeepByFaction: Record<QidahenFactionId, number> = { ming: 0, mongol: 0, jin: 0 };
    const nextRuntimeRegions = state.regions
        .filter((region) => !region.isLogicalRegion)
        .map(cloneRuntimeRegionAsPieceSnapshot);
    const applyCityStateUpkeep = (region: typeof nextRuntimeRegions[number], defaultAttritionReason: string) => {
        const cityDefenderFactionId = region.controller === 'neutral' ? null : region.controller;
        if (!region.cityState || !cityDefenderFactionId) {
            return;
        }
        const displayRegionName = getActionRuleDisplayRegionName(region, region.name);
        const isKoreaRegion = isQidahenKoreaRuntimeRegionId(region.id);
        if (
            isKoreaRegion
            && cityDefenderFactionId === 'ming'
            && hasActiveCharacter(state, 'ming', 'ming-mao-wenlong')
        ) {
            return;
        }
        const isMingNonHanRegion = cityDefenderFactionId === 'ming' && QIDAHEN_NON_HAN_RUNTIME_REGION_IDS.has(region.id);
        const regularTroopCount = isMingNonHanRegion ? getRegularTroopCount(region.cityState, 'ming') : 0;
        const supportPopulation = isKoreaRegion
            ? 0
            : Math.max(0, getQidahenEffectiveCityPopulation(region) - regularTroopCount);
        const citySupportGap = Math.max(0, region.cityState.troops - supportPopulation);
        if (citySupportGap <= 0) {
            return;
        }
        const freeSupport = getQidahenFreeUpkeepSupport(state, cityDefenderFactionId, citySupportGap);
        const faction = nextFactions[cityDefenderFactionId];
        const payableGap = Math.max(0, citySupportGap - freeSupport);
        const paid = Math.min(faction.handCount, payableGap);
        const unresolved = payableGap - paid;
        if (freeSupport > 0) {
            summaryLines.push(`${toFactionLabel(cityDefenderFactionId)} 因王化贞在 ${displayRegionName} 免费支持 ${freeSupport} 部队。`);
        }
        if (paid > 0) {
            upkeepByFaction[cityDefenderFactionId] += paid;
            nextFactions[cityDefenderFactionId] = {
                ...faction,
                handCount: faction.handCount - paid,
            };
        }
        if (unresolved > 0) {
            const attrition = applyUpkeepAttritionToRegion(region.cityState, unresolved, attritionPriority);
            region.cityState = {
                ...region.cityState,
                troops: Math.max(0, region.cityState.troops - unresolved),
                specialTroops: attrition.region.specialTroops,
            };
            const removedText = attrition.removedDetails.length > 0
                ? `（移除：${attrition.removedDetails.join('、')}）`
                : '';
            const priorityText = attritionPriority === 'highest-level' ? '高级先损' : '低级先损';
            const attritionReason = isKoreaRegion
                ? '朝鲜耗损'
                : isMingNonHanRegion && regularTroopCount > 0
                    ? '大漠耗损'
                    : defaultAttritionReason;
            const cityNote = `${displayRegionName} 城内守军因${attritionReason}减员 ${unresolved}（${priorityText}）${removedText}。`;
            region.note = region.note ? `${region.note} ${cityNote}` : cityNote;
            summaryLines.push(`${toFactionLabel(cityDefenderFactionId)} 在 ${displayRegionName} 触发${attritionReason}，城内守军无法补足 ${unresolved} 点补给，减员 ${unresolved}（${priorityText}）${removedText}。`);
        }
    };
    for (const region of nextRuntimeRegions) {
        const displayRegionName = getActionRuleDisplayRegionName(region, region.name);
        if (region.siegeState) {
            const siegeFaction = region.siegeState.attackerFactionId;
            const supportGap = Math.max(0, region.siegeState.attackerTroops);
            if (supportGap > 0) {
                const freeSupport = getQidahenFreeUpkeepSupport(state, siegeFaction, supportGap);
                const faction = nextFactions[siegeFaction];
                const payableGap = Math.max(0, supportGap - freeSupport);
                const paid = Math.min(faction.handCount, payableGap);
                const unresolved = payableGap - paid;
                if (freeSupport > 0) {
                    summaryLines.push(`${toFactionLabel(siegeFaction)} 因王化贞在 ${displayRegionName} 免费支持 ${freeSupport} 部队。`);
                }
                if (paid > 0) {
                    upkeepByFaction[siegeFaction] += paid;
                    nextFactions[siegeFaction] = {
                        ...faction,
                        handCount: faction.handCount - paid,
                    };
                }
                if (unresolved > 0) {
                    const attrition = applyUpkeepAttritionToRegion({
                        ...region,
                        troops: region.siegeState.attackerTroops,
                        specialTroops: region.siegeState.attackerSpecialTroops,
                    }, unresolved, attritionPriority);
                    region.siegeState = {
                        ...region.siegeState,
                        attackerTroops: Math.max(0, region.siegeState.attackerTroops - unresolved),
                        attackerSpecialTroops: attrition.region.specialTroops,
                    };
                    const removedText = attrition.removedDetails.length > 0
                        ? `（移除：${attrition.removedDetails.join('、')}）`
                        : '';
                    const priorityText = attritionPriority === 'highest-level' ? '高级先损' : '低级先损';
                    region.note = `${displayRegionName} 仍由${toFactionLabel(region.controller)}控制，但${toFactionLabel(siegeFaction)}围城部队因围城耗损减员 ${unresolved}（${priorityText}）${removedText}。`;
                    summaryLines.push(`${toFactionLabel(siegeFaction)} 在 ${displayRegionName} 触发围城耗损，无法补足 ${unresolved} 点补给，围城部队减员 ${unresolved}（${priorityText}）${removedText}。`);
                }
            }
            applyCityStateUpkeep(region, '守城耗损');
            continue;
        }
        const isKoreaRegion = isQidahenKoreaRuntimeRegionId(region.id);
        const isFriendlyNeutralRegion = region.controller === 'neutral'
            && region.diplomacyMarkerFaction != null
            && region.diplomacyMarkerSide === 'friendly';
        const attritionFactionId = isFriendlyNeutralRegion ? region.diplomacyMarkerFaction : region.controller;
        if (!attritionFactionId || attritionFactionId === 'neutral') {
            continue;
        }
        if (
            isKoreaRegion
            && attritionFactionId === 'ming'
            && hasActiveCharacter(state, 'ming', 'ming-mao-wenlong')
        ) {
            continue;
        }
        const isMingNonHanRegion = attritionFactionId === 'ming' && QIDAHEN_NON_HAN_RUNTIME_REGION_IDS.has(region.id);
        const regularTroopCount = isMingNonHanRegion ? getRegularTroopCount(region, 'ming') : 0;
        const supportPopulation = isKoreaRegion || isFriendlyNeutralRegion
            ? 0
            : Math.max(0, getQidahenEffectivePopulation(region) - regularTroopCount);
        const supportGap = Math.max(0, region.troops - supportPopulation);
        if (supportGap <= 0) {
            applyCityStateUpkeep(region, '守城耗损');
            continue;
        }
        const freeSupport = getQidahenFreeUpkeepSupport(state, attritionFactionId, supportGap);
        const faction = nextFactions[attritionFactionId];
        const payableGap = Math.max(0, supportGap - freeSupport);
        const paid = Math.min(faction.handCount, payableGap);
        const unresolved = payableGap - paid;
        if (freeSupport > 0) {
            summaryLines.push(`${toFactionLabel(attritionFactionId)} 因王化贞在 ${displayRegionName} 免费支持 ${freeSupport} 部队。`);
        }
        if (paid > 0) {
            upkeepByFaction[attritionFactionId] += paid;
            nextFactions[attritionFactionId] = {
                ...faction,
                handCount: faction.handCount - paid,
            };
        }
        if (unresolved > 0) {
            const attrition = applyUpkeepAttritionToRegion(region, unresolved, attritionPriority);
            region.specialTroops = attrition.region.specialTroops;
            region.troops = Math.max(0, region.troops - unresolved);
            const removedText = attrition.removedDetails.length > 0
                ? `（移除：${attrition.removedDetails.join('、')}）`
                : '';
            const priorityText = attritionPriority === 'highest-level' ? '高级先损' : '低级先损';
            const attritionReason = isKoreaRegion
                ? '朝鲜耗损'
                : isFriendlyNeutralRegion
                    ? '中立耗损'
                    : isMingNonHanRegion && regularTroopCount > 0
                        ? '大漠耗损'
                        : '兵力耗损';
            region.note = `${displayRegionName} 因${attritionReason}损失 ${unresolved} 部队（${priorityText}）${removedText}。`;
            summaryLines.push(`${toFactionLabel(attritionFactionId)} 在 ${displayRegionName} 触发${attritionReason}，无法补足 ${unresolved} 点补给，部队减员 ${unresolved}（${priorityText}）${removedText}。`);
        }
        applyCityStateUpkeep(region, '守城耗损');
    }
    for (const factionId of factionOrder) {
        if (upkeepByFaction[factionId] > 0) {
            summaryLines.push(`${nextFactions[factionId].name} 为兵力耗损额外支付 ${upkeepByFaction[factionId]} 张手牌。`);
        }
    }

    const chronologyClaimPriority = getChronologyClaimPriority({
        ...state,
        factions: nextFactions,
        fortifications: nextFortifications,
        regions: nextRuntimeRegions,
    });
    let chronologyWinner: QidahenFactionId | null = null;
    for (const factionId of chronologyClaimPriority) {
        const faction = nextFactions[factionId];
        const claimCost = getYearCardClaimCost(faction.handCount);
        if (claimCost > faction.handCount) {
            summaryLines.push(`${faction.name} 无法支付获得本年纪年卡所需的 ${claimCost} 张手牌，资格顺延。`);
            continue;
        }
        chronologyWinner = factionId;
        nextFactions[factionId] = {
            ...faction,
            handCount: faction.handCount - claimCost,
            vp: faction.vp + 1,
        };
        summaryLines.push(`${faction.name} 以 ${claimCost} 张手牌获得本年纪年卡，威望 +1。`);
        break;
    }
    if (chronologyWinner == null) {
        summaryLines.push('本年纪年卡无人获得。');
    }

    const currentYearIndex = Math.min(state.currentYearIndex + 1, getQidahenMaxChronologyYearIndex());
    const currentFactionOrder = getFactionOrderForYearIndex(state.scenarioId, currentYearIndex);
    const chronologyCharacters = dependencies.applyChronologyCharactersForYear(
        nextFactions,
        currentYearIndex,
    );
    const refreshedRegions = refreshRuntimeRegionRules(nextRuntimeRegions, nextFortifications);

    summaryLines.push(...chronologyCharacters.summaryLines);
    summaryLines.push(...factionOrder.map((factionId) => (
        `${chronologyCharacters.factions[factionId].name} 当前控制 ${countQidahenControlledRuntimeRegions(refreshedRegions, factionId)} 个非朝鲜区域。`
    )));
    summaryLines.push(`进入 ${getYearLabelByIndex(currentYearIndex)}。`);

    return {
        currentYearIndex,
        currentYear: getYearLabelByIndex(currentYearIndex),
        currentFactionOrder,
        yearCards: buildYearCardSlots(currentYearIndex),
        factions: chronologyCharacters.factions,
        regions: refreshedRegions,
        fortifications: nextFortifications,
        koreaDeckCount: nextKoreaDeckCount,
        lastSeasonSummary: buildSeasonSummary('新年结算', timestamp, summaryLines),
    };
};
