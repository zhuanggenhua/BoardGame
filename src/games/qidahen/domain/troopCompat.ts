import type {
    QidahenBattleCasualtyPriority,
    QidahenCasualtyPriority,
    QidahenCore,
    QidahenFactionId,
    QidahenPiece,
    QidahenSpecialTroopStack,
    QidahenTroopClass,
    QidahenTroopKind,
} from './types';

type QidahenPieceLocation = QidahenPiece['location'];

type QidahenCompatPieceView = Pick<
    QidahenCore['pieces'][number],
    'id' | 'sourceStackId' | 'label' | 'faction' | 'troopKind' | 'level'
> & {
    originalFaction: QidahenFactionId;
    troopClass: QidahenTroopClass;
    stackOrder: number;
    pieceOrder: number;
};

type QidahenCompatPieceTrainingDetailEntry = {
    label: string;
    count: number;
    targetLevel: number;
};

export const inferTroopKindForStack = (stack: QidahenSpecialTroopStack): QidahenTroopKind => {
    if (stack.troopKind) {
        return stack.troopKind;
    }
    if (stack.id.includes('artillery') || stack.label.includes('炮')) {
        return 'artillery';
    }
    if (stack.id.includes('cavalry') || stack.label.includes('骑')) {
        return 'cavalry';
    }
    return 'infantry';
};

export const inferTroopClassForStack = (
    stack: QidahenSpecialTroopStack,
): QidahenTroopClass => {
    if (stack.troopClass) {
        return stack.troopClass;
    }
    if (stack.id.includes('mercenary') || stack.label.includes('雇佣')) {
        return 'auxiliary';
    }
    return 'regular';
};

const isMercenaryCompatPiece = (
    piece: Pick<QidahenCompatPieceView, 'sourceStackId' | 'label'>,
): boolean => piece.sourceStackId.includes('mercenary') || piece.label.includes('雇佣');

const normalizeStackPieceIds = (
    pieceIds: readonly string[] | undefined,
    count: number,
): string[] => {
    if (!Array.isArray(pieceIds) || count <= 0) {
        return [];
    }
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const pieceId of pieceIds) {
        if (typeof pieceId !== 'string' || pieceId.length === 0 || seen.has(pieceId)) {
            continue;
        }
        seen.add(pieceId);
        normalized.push(pieceId);
        if (normalized.length >= count) {
            break;
        }
    }
    return normalized;
};

const normalizeSpecialTroopStack = (
    stack: QidahenSpecialTroopStack,
): QidahenSpecialTroopStack => ({
    ...stack,
    originalFaction: stack.originalFaction ?? stack.faction,
    troopClass: inferTroopClassForStack(stack),
    troopKind: inferTroopKindForStack(stack),
    ...(normalizeStackPieceIds(stack.pieceIds, stack.count).length > 0
        ? { pieceIds: normalizeStackPieceIds(stack.pieceIds, stack.count) }
        : {}),
});

const withTrimmedPieceIds = (
    stack: QidahenSpecialTroopStack,
    count: number,
): QidahenSpecialTroopStack => {
    const nextCount = Math.max(0, Math.floor(count));
    const pieceIds = normalizeStackPieceIds(stack.pieceIds, nextCount);
    return {
        ...stack,
        count: nextCount,
        ...(pieceIds.length > 0 ? { pieceIds } : {}),
    };
};

export const expandSpecialTroopStacksToCompatPieces = (
    stacks: readonly QidahenSpecialTroopStack[],
): QidahenCompatPieceView[] => (
    stacks.flatMap((rawStack, stackOrder) => {
        const normalizedStack = normalizeSpecialTroopStack(rawStack);
        const fallbackPieceIds = Array.from({ length: Math.max(0, normalizedStack.count) }, (_, index) => (
            `${normalizedStack.id}__compat__${index + 1}`
        ));
        const pieceIds = normalizeStackPieceIds(normalizedStack.pieceIds, normalizedStack.count);
        return Array.from({ length: Math.max(0, normalizedStack.count) }, (_, index) => ({
            id: pieceIds[index] ?? fallbackPieceIds[index],
            sourceStackId: normalizedStack.id,
            label: normalizedStack.label,
            faction: normalizedStack.faction,
            originalFaction: normalizedStack.originalFaction ?? normalizedStack.faction,
            troopClass: normalizedStack.troopClass ?? 'regular',
            troopKind: normalizedStack.troopKind,
            level: normalizedStack.level,
            stackOrder,
            pieceOrder: index,
        }));
    })
);

export const collapseCompatPiecesToSpecialTroopStacks = (
    pieces: readonly QidahenCompatPieceView[],
): QidahenSpecialTroopStack[] => {
    const grouped = new Map<string, QidahenSpecialTroopStack>();
    for (const piece of pieces) {
        const key = [
            piece.sourceStackId,
            piece.label,
            piece.faction,
            piece.originalFaction,
            piece.troopClass,
            piece.troopKind,
            piece.level.toString(),
        ].join('\u0000');
        const previous = grouped.get(key);
        if (previous) {
            previous.count += 1;
            previous.pieceIds = [...(previous.pieceIds ?? []), piece.id];
            continue;
        }
        grouped.set(key, {
            id: piece.sourceStackId,
            label: piece.label,
            faction: piece.faction,
            originalFaction: piece.originalFaction,
            troopClass: piece.troopClass,
            troopKind: piece.troopKind,
            count: 1,
            level: piece.level,
            pieceIds: [piece.id],
        });
    }
    return [...grouped.values()]
        .map((stack) => withTrimmedPieceIds(stack, stack.count))
        .filter((stack) => stack.count > 0);
};

export const mergeSpecialTroopStackGroupsAsPieces = (
    ...groups: readonly (readonly QidahenSpecialTroopStack[])[]
): QidahenSpecialTroopStack[] => collapseCompatPiecesToSpecialTroopStacks(
    groups.flatMap((group) => expandSpecialTroopStacksToCompatPieces(group)),
);

export const cloneSpecialTroopStacksAsPieces = (
    stacks: readonly QidahenSpecialTroopStack[],
): QidahenSpecialTroopStack[] => mergeSpecialTroopStackGroupsAsPieces(stacks);

export const someCompatPieces = (
    stacks: readonly QidahenSpecialTroopStack[],
    predicate: (piece: QidahenCompatPieceView) => boolean,
): boolean => expandSpecialTroopStacksToCompatPieces(stacks).some(predicate);

export const filterCompatPiecesToSpecialTroopStacks = (
    stacks: readonly QidahenSpecialTroopStack[],
    predicate: (piece: QidahenCompatPieceView) => boolean,
): QidahenSpecialTroopStack[] => collapseCompatPiecesToSpecialTroopStacks(
    expandSpecialTroopStacksToCompatPieces(stacks).filter(predicate),
);

const collapsePiecesToSpecialTroopStacks = (
    pieces: readonly Pick<
        QidahenCore['pieces'][number],
        'id' | 'sourceStackId' | 'label' | 'faction' | 'originalFaction' | 'troopClass' | 'troopKind' | 'level'
    >[],
): QidahenSpecialTroopStack[] => collapseCompatPiecesToSpecialTroopStacks(
    pieces.map((piece, index) => ({
        id: piece.id,
        sourceStackId: piece.sourceStackId,
        label: piece.label,
        faction: piece.faction,
        originalFaction: piece.originalFaction ?? piece.faction,
        troopClass: piece.troopClass ?? 'regular',
        troopKind: piece.troopKind,
        level: piece.level,
        stackOrder: index,
        pieceOrder: 0,
    })),
);

export const sortCompatPiecesForSelection = (
    pieces: readonly QidahenCompatPieceView[],
    casualtyPriority: QidahenCasualtyPriority = 'highest-level',
): QidahenCompatPieceView[] => (
    pieces
        .slice()
        .sort((left, right) => {
            const levelDiff = casualtyPriority === 'lowest-level'
                ? left.level - right.level
                : right.level - left.level;
            if (levelDiff !== 0) {
                return levelDiff;
            }
            const stackDiff = left.stackOrder - right.stackOrder;
            if (stackDiff !== 0) {
                return stackDiff;
            }
            return left.pieceOrder - right.pieceOrder;
        })
);

export const sortCompatPiecesForRemoval = (
    pieces: readonly QidahenCompatPieceView[],
    casualtyPriority: QidahenBattleCasualtyPriority,
): QidahenCompatPieceView[] => (
    pieces
        .slice()
        .sort((left, right) => {
            if (casualtyPriority === 'artillery-first') {
                return Number(right.troopKind === 'artillery') - Number(left.troopKind === 'artillery')
                    || right.level - left.level
                    || left.stackOrder - right.stackOrder
                    || right.pieceOrder - left.pieceOrder;
            }
            const levelDiff = casualtyPriority === 'lowest-level'
                ? left.level - right.level
                : right.level - left.level;
            if (levelDiff !== 0) {
                return levelDiff;
            }
            const stackDiff = left.stackOrder - right.stackOrder;
            if (stackDiff !== 0) {
                return stackDiff;
            }
            return right.pieceOrder - left.pieceOrder;
        })
);

export const upgradeCompatPieceToLevel = (
    piece: QidahenCompatPieceView,
    targetLevel: number,
): QidahenCompatPieceView => ({
    ...piece,
    sourceStackId: piece.sourceStackId.replace(/-lv\d+$/, `-lv${targetLevel}`),
    level: targetLevel,
});

const getQidahenPieceRotationDegForLevel = (level: number): number => {
    switch (Math.max(1, Math.min(4, Math.floor(level)))) {
        case 1:
            return 90;
        case 2:
            return 0;
        case 3:
            return 270;
        case 4:
            return 180;
        default:
            return 0;
    }
};

const expandSpecialTroopStacksToPieces = (
    regionId: string,
    location: QidahenPieceLocation,
    stacks: QidahenSpecialTroopStack[],
): QidahenPiece[] => (
    stacks.flatMap((stack) => {
        const normalizedStack = normalizeSpecialTroopStack(stack);
        const fallbackPieceIds = Array.from({ length: Math.max(0, normalizedStack.count) }, (_, index) => (
            `${normalizedStack.id}__${location}__${regionId}__${index + 1}`
        ));
        const pieceIds = normalizeStackPieceIds(normalizedStack.pieceIds, normalizedStack.count);
        return Array.from({ length: Math.max(0, normalizedStack.count) }, (_, index) => ({
            id: pieceIds[index] ?? fallbackPieceIds[index],
            sourceStackId: normalizedStack.id,
            label: normalizedStack.label,
            faction: normalizedStack.faction,
            originalFaction: normalizedStack.originalFaction ?? normalizedStack.faction,
            troopClass: normalizedStack.troopClass ?? 'regular',
            troopKind: normalizedStack.troopKind,
            level: normalizedStack.level,
            regionId,
            location,
            rotationDeg: getQidahenPieceRotationDegForLevel(normalizedStack.level),
        }));
    })
);

export const cloneCityStateAsPieceSnapshot = (
    region: QidahenCore['regions'][number],
): QidahenCore['regions'][number]['cityState'] => (
    region.cityState
        ? {
            troops: region.cityState.troops,
            population: region.cityState.population,
            specialTroops: cloneSpecialTroopStacksAsPieces(region.cityState.specialTroops),
        }
        : null
);

export const cloneSiegeStateAsPieceSnapshot = (
    region: QidahenCore['regions'][number],
): QidahenCore['regions'][number]['siegeState'] => (
    region.siegeState
        ? {
            ...region.siegeState,
            attackerSpecialTroops: cloneSpecialTroopStacksAsPieces(region.siegeState.attackerSpecialTroops),
        }
        : null
);

export const cloneRuntimeRegionAsPieceSnapshot = (
    region: QidahenCore['regions'][number],
): QidahenCore['regions'][number] => ({
    ...region,
    specialTroops: cloneSpecialTroopStacksAsPieces(region.specialTroops),
    cityState: cloneCityStateAsPieceSnapshot(region),
    siegeState: cloneSiegeStateAsPieceSnapshot(region),
});

const assignPieceIdsToStacks = (
    stacks: QidahenSpecialTroopStack[],
    nextPieceSerial: number,
): { stacks: QidahenSpecialTroopStack[]; nextPieceSerial: number } => {
    let serial = nextPieceSerial;
    const normalizedStacks = stacks.map((rawStack) => {
        const stack = normalizeSpecialTroopStack(rawStack);
        const pieceIds = normalizeStackPieceIds(stack.pieceIds, stack.count);
        const nextPieceIds = [...pieceIds];
        while (nextPieceIds.length < stack.count) {
            nextPieceIds.push(`qidahen-piece-${serial}`);
            serial += 1;
        }
        return {
            ...stack,
            ...(nextPieceIds.length > 0 ? { pieceIds: nextPieceIds } : {}),
        };
    });
    return {
        stacks: cloneSpecialTroopStacksAsPieces(normalizedStacks),
        nextPieceSerial: serial,
    };
};

const syncRegionPieceIds = (
    region: QidahenCore['regions'][number],
    nextPieceSerial: number,
): { region: QidahenCore['regions'][number]; nextPieceSerial: number } => {
    const field = assignPieceIdsToStacks(region.specialTroops, nextPieceSerial);
    let serial = field.nextPieceSerial;
    const city = region.cityState
        ? assignPieceIdsToStacks(region.cityState.specialTroops, serial)
        : null;
    if (city) {
        serial = city.nextPieceSerial;
    }
    const siege = region.siegeState
        ? assignPieceIdsToStacks(region.siegeState.attackerSpecialTroops, serial)
        : null;
    if (siege) {
        serial = siege.nextPieceSerial;
    }
    return {
        region: {
            ...region,
            specialTroops: field.stacks,
            cityState: region.cityState && city
                ? {
                    ...region.cityState,
                    specialTroops: city.stacks,
                }
                : region.cityState,
            siegeState: region.siegeState && siege
                ? {
                    ...region.siegeState,
                    attackerSpecialTroops: siege.stacks,
                }
                : region.siegeState,
        },
        nextPieceSerial: serial,
    };
};

export const syncRegionsPieceIds = (
    regions: QidahenCore['regions'],
    nextPieceSerial: number,
): { regions: QidahenCore['regions']; nextPieceSerial: number } => {
    let serial = nextPieceSerial;
    const syncedRegions = regions.map((region) => {
        if (region.isLogicalRegion) {
            return region;
        }
        const synced = syncRegionPieceIds(region, serial);
        serial = synced.nextPieceSerial;
        return synced.region;
    });
    return {
        regions: syncedRegions,
        nextPieceSerial: serial,
    };
};

export const syncPiecesFromRegions = (
    regions: QidahenCore['regions'],
): QidahenCore['pieces'] => (
    regions
        .filter((region) => !region.isLogicalRegion)
        .flatMap((region) => [
            ...expandSpecialTroopStacksToPieces(region.id, 'field', region.specialTroops),
            ...expandSpecialTroopStacksToPieces(region.id, 'city', region.cityState?.specialTroops ?? []),
            ...expandSpecialTroopStacksToPieces(region.id, 'siege-attacker', region.siegeState?.attackerSpecialTroops ?? []),
        ])
);

export const syncRegionsSpecialTroopsFromPieces = (
    regions: QidahenCore['regions'],
    pieces: QidahenCore['pieces'],
): QidahenCore['regions'] => (
    regions.map((region) => {
        if (region.isLogicalRegion) {
            return region;
        }
        const fieldPieces = pieces.filter((piece) => piece.regionId === region.id && piece.location === 'field');
        const cityPieces = pieces.filter((piece) => piece.regionId === region.id && piece.location === 'city');
        const siegePieces = pieces.filter((piece) => piece.regionId === region.id && piece.location === 'siege-attacker');
        return {
            ...region,
            specialTroops: collapsePiecesToSpecialTroopStacks(fieldPieces),
            cityState: region.cityState
                ? {
                    ...region.cityState,
                    specialTroops: collapsePiecesToSpecialTroopStacks(cityPieces),
                }
                : null,
            siegeState: region.siegeState
                ? {
                    ...region.siegeState,
                    attackerSpecialTroops: collapsePiecesToSpecialTroopStacks(siegePieces),
                }
                : null,
        };
    })
);

export const addSpecialTroopStackToRegion = (
    region: QidahenCore['regions'][number],
    stack: QidahenSpecialTroopStack,
): QidahenCore['regions'][number] => ({
    ...region,
    specialTroops: mergeSpecialTroopStackGroupsAsPieces(
        region.specialTroops,
        [stack],
    ),
});

export const buildCompatPieceTrainingDetails = (
    entries: ReadonlyMap<string, QidahenCompatPieceTrainingDetailEntry>,
): string[] => Array.from(entries.values()).map((entry) => (
    `${entry.label} x${entry.count} 升至 ${entry.targetLevel} 级`
));

export const recordSpecialTroopTrainingDetail = (
    details: Map<string, QidahenCompatPieceTrainingDetailEntry>,
    stack: Pick<QidahenSpecialTroopStack, 'id' | 'label'>,
    targetLevel: number,
    count = 1,
): void => {
    const normalizedCount = Math.max(0, Math.floor(count));
    if (normalizedCount <= 0) {
        return;
    }
    const key = `${stack.id}\u0000${targetLevel}`;
    const previous = details.get(key);
    if (previous) {
        previous.count += normalizedCount;
        return;
    }
    details.set(key, {
        label: stack.label,
        count: normalizedCount,
        targetLevel,
    });
};

export const recordCompatPieceTrainingDetail = (
    details: Map<string, QidahenCompatPieceTrainingDetailEntry>,
    piece: QidahenCompatPieceView,
    targetLevel: number,
): void => recordSpecialTroopTrainingDetail(
    details,
    { id: piece.sourceStackId, label: piece.label },
    targetLevel,
);

export const countCompatPieces = (
    stacks: readonly QidahenSpecialTroopStack[],
    predicate?: (piece: QidahenCompatPieceView) => boolean,
): number => {
    const pieces = expandSpecialTroopStacksToCompatPieces(stacks);
    return predicate ? pieces.filter(predicate).length : pieces.length;
};

export const countCompatTroopsByKind = (
    stacks: readonly QidahenSpecialTroopStack[],
    troopKind: QidahenTroopKind,
): number => countCompatPieces(
    stacks,
    (piece) => piece.troopKind === troopKind,
);

export const getSpecialTroopCount = (
    region: Pick<QidahenCore['regions'][number], 'specialTroops'>,
): number => countCompatPieces(region.specialTroops);

const getMercenaryTroopCount = (
    region: Pick<QidahenCore['regions'][number], 'specialTroops'>,
): number => countCompatPieces(region.specialTroops, (piece) => isMercenaryCompatPiece(piece));

export const hasNonMercenaryTroops = (
    region: Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>,
): boolean => region.troops > getMercenaryTroopCount(region);

export const getRegularTroopCount = (
    region: Pick<QidahenCore['regions'][number], 'specialTroops'>,
    factionId: QidahenFactionId,
): number => countCompatPieces(
    region.specialTroops,
    (piece) => piece.faction === factionId && !isMercenaryCompatPiece(piece),
);

export const getArtilleryTroopCount = (
    region: Pick<QidahenCore['regions'][number], 'specialTroops'>,
): number => countCompatTroopsByKind(region.specialTroops, 'artillery');

export const subtractSpecialTroopStacks = (
    stacks: QidahenSpecialTroopStack[],
    removalStacks: QidahenSpecialTroopStack[],
): QidahenSpecialTroopStack[] => {
    const removalPieceIds = new Set(
        expandSpecialTroopStacksToCompatPieces(removalStacks).map((piece) => piece.id),
    );
    return collapseCompatPiecesToSpecialTroopStacks(
        expandSpecialTroopStacksToCompatPieces(stacks)
            .filter((piece) => !removalPieceIds.has(piece.id)),
    );
};

export const addSpecialTroopStacksToRegion = (
    region: QidahenCore['regions'][number],
    stacks: QidahenSpecialTroopStack[],
): QidahenCore['regions'][number] => ({
    ...region,
    specialTroops: mergeSpecialTroopStackGroupsAsPieces(
        region.specialTroops,
        stacks,
    ),
});

export const removeMercenarySpecialTroops = (
    stacks: QidahenSpecialTroopStack[],
): { specialTroops: QidahenSpecialTroopStack[]; removedTroops: number } => {
    const allPieces = expandSpecialTroopStacksToCompatPieces(stacks);
    const remainingPieces = allPieces.filter((piece) => !isMercenaryCompatPiece(piece));
    return {
        specialTroops: collapseCompatPiecesToSpecialTroopStacks(remainingPieces),
        removedTroops: allPieces.length - remainingPieces.length,
    };
};

export const formatTroopTransferDetails = (
    movedGenericTroops: number,
    movedSpecialTroops: QidahenSpecialTroopStack[],
): string => {
    const parts: string[] = [];
    if (movedGenericTroops > 0) {
        parts.push(`未结构化部队 x${movedGenericTroops}`);
    }
    const grouped = new Map<string, { label: string; level: number; count: number }>();
    for (const piece of expandSpecialTroopStacksToCompatPieces(movedSpecialTroops)) {
        const key = [
            piece.sourceStackId,
            piece.label,
            piece.level.toString(),
        ].join('\u0000');
        const previous = grouped.get(key);
        if (previous) {
            previous.count += 1;
            continue;
        }
        grouped.set(key, {
            label: piece.label,
            level: piece.level,
            count: 1,
        });
    }
    for (const entry of grouped.values()) {
        parts.push(`${entry.label} x${entry.count}（${entry.level}级）`);
    }
    return parts.join('、');
};
