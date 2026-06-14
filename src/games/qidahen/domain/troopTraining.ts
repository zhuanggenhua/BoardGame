import {
    buildCompatPieceTrainingDetails,
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
    recordCompatPieceTrainingDetail,
    recordSpecialTroopTrainingDetail,
    upgradeCompatPieceToLevel,
} from './troopCompat';
import { buildRegularTroopStack, clampTroopLevel } from './troopStacks';
import type { QidahenCore, QidahenFactionId, QidahenSpecialTroopStack } from './types';

type QidahenTroopTrainingRegionSource = Pick<QidahenCore['regions'][number], 'id' | 'controller' | 'troops' | 'specialTroops'>;

interface QidahenTroopTrainingDetailEntry {
    label: string;
    count: number;
    targetLevel: number;
}

interface QidahenArtilleryTrainingResult {
    specialTroops: QidahenSpecialTroopStack[];
    trainedCount: number;
    targetLevel: number;
}

interface QidahenTroopTrainingResult {
    specialTroops: QidahenSpecialTroopStack[];
    trainedCount: number;
    trainedDetails: string[];
}

interface QidahenLimitedTroopTrainingOptions {
    upgradedRegularTroopSourceId?: string;
}

export const trainArtilleryStacksToLevel = (
    region: QidahenTroopTrainingRegionSource,
    maxLevel: number,
): QidahenArtilleryTrainingResult => {
    const targetLevel = clampTroopLevel(maxLevel);
    if (targetLevel <= 1 || region.specialTroops.length === 0) {
        return { specialTroops: region.specialTroops, trainedCount: 0, targetLevel };
    }

    let trainedCount = 0;
    const specialTroops = collapseCompatPiecesToSpecialTroopStacks(
        expandSpecialTroopStacksToCompatPieces(region.specialTroops).map((piece) => {
            if (piece.troopKind !== 'artillery' || piece.level >= targetLevel) {
                return piece;
            }
            trainedCount += 1;
            return upgradeCompatPieceToLevel(piece, targetLevel);
        }),
    );

    return { specialTroops, trainedCount, targetLevel };
};

export const trainSpecialTroopsOneStepForFaction = (
    region: QidahenTroopTrainingRegionSource,
    factionId: QidahenFactionId,
    artilleryMaxLevel: number,
): QidahenTroopTrainingResult => {
    let trainedCount = 0;
    const trainedDetailEntries = new Map<string, QidahenTroopTrainingDetailEntry>();
    const specialTroops = collapseCompatPiecesToSpecialTroopStacks(
        expandSpecialTroopStacksToCompatPieces(region.specialTroops).map((piece) => {
            if (piece.faction !== factionId) {
                return piece;
            }

            const maxLevel = piece.troopKind === 'artillery'
                ? clampTroopLevel(Math.max(1, artilleryMaxLevel))
                : 4;
            const nextLevel = Math.min(maxLevel, clampTroopLevel(piece.level + 1));
            if (nextLevel <= piece.level) {
                return piece;
            }

            trainedCount += 1;
            recordCompatPieceTrainingDetail(trainedDetailEntries, piece, nextLevel);
            return upgradeCompatPieceToLevel(piece, nextLevel);
        }),
    );

    return {
        specialTroops,
        trainedCount,
        trainedDetails: trainedCount > 0 ? buildCompatPieceTrainingDetails(trainedDetailEntries) : [],
    };
};

export const trainTroopsOneStepForFactionWithLimit = (
    region: QidahenTroopTrainingRegionSource,
    factionId: QidahenFactionId,
    artilleryMaxLevel: number,
    maxTroops: number,
    options: QidahenLimitedTroopTrainingOptions = {},
): QidahenTroopTrainingResult => {
    let remainingTroops = Math.max(0, Math.floor(maxTroops));
    if (remainingTroops <= 0) {
        return { specialTroops: region.specialTroops, trainedCount: 0, trainedDetails: [] };
    }

    let trainedCount = 0;
    const trainedDetailEntries = new Map<string, QidahenTroopTrainingDetailEntry>();
    const allPieces = expandSpecialTroopStacksToCompatPieces(region.specialTroops);
    const originalSpecialTroopCount = allPieces.length;
    const nextCompatPieces = allPieces.map((piece) => {
        if (piece.faction !== factionId) {
            return piece;
        }
        const maxLevel = piece.troopKind === 'artillery'
            ? clampTroopLevel(Math.max(1, artilleryMaxLevel))
            : 4;
        const nextLevel = Math.min(maxLevel, clampTroopLevel(piece.level + 1));
        if (remainingTroops <= 0 || nextLevel <= piece.level) {
            return piece;
        }

        trainedCount += 1;
        remainingTroops -= 1;
        recordCompatPieceTrainingDetail(trainedDetailEntries, piece, nextLevel);
        return upgradeCompatPieceToLevel(piece, nextLevel);
    });

    const specialTroops = collapseCompatPiecesToSpecialTroopStacks(nextCompatPieces);
    const genericTroops = region.controller === factionId
        ? Math.max(0, region.troops - originalSpecialTroopCount)
        : 0;
    if (remainingTroops > 0 && genericTroops > 0) {
        const upgradedTroops = Math.min(genericTroops, remainingTroops);
        const upgradedLevel = 3;
        const upgradedStack = buildRegularTroopStack(
            factionId,
            options.upgradedRegularTroopSourceId ?? `${region.id}-trained-regular`,
            upgradedTroops,
            upgradedLevel,
        );
        specialTroops.push(upgradedStack);
        trainedCount += upgradedTroops;
        recordSpecialTroopTrainingDetail(
            trainedDetailEntries,
            upgradedStack,
            upgradedLevel,
            upgradedTroops,
        );
    }

    return {
        specialTroops,
        trainedCount,
        trainedDetails: trainedCount > 0 ? buildCompatPieceTrainingDetails(trainedDetailEntries) : [],
    };
};
