import { clampTroopLevel } from './troopStacks';
import type { QidahenBattleRolls, QidahenCore, QidahenTroopKind } from './types';

export interface QidahenAttackRuleConfig {
    id: 'raid' | 'wheel-dispatch' | 'drive-tiger';
    label: string;
    maxCommittedTroops: number;
}

interface QidahenAttackCommitmentInput {
    availableTroops: number;
    boundaryUnitCap: number | null;
    actionId: 'raid' | 'wheel-dispatch' | 'drive-tiger';
}

interface QidahenEffectiveAttackCommitmentInput extends QidahenAttackCommitmentInput {
    characterCommittedTroopLimit?: number | null;
}

export const QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS = 3;

const QIDAHEN_ATTACK_RULE_CONFIGS: QidahenAttackRuleConfig[] = [
    { id: 'raid', label: '进攻行动', maxCommittedTroops: 6 },
    { id: 'wheel-dispatch', label: '轮盘进攻/调度', maxCommittedTroops: 6 },
    { id: 'drive-tiger', label: '驱虎吞狼', maxCommittedTroops: 6 },
];

const QIDAHEN_ATTACK_RULE_CONFIG_BY_ID = new Map(
    QIDAHEN_ATTACK_RULE_CONFIGS.map((config) => [config.id, config]),
);

export const getQidahenAttackRuleConfig = (
    actionId: 'raid' | 'wheel-dispatch' | 'drive-tiger',
): QidahenAttackRuleConfig => (
    QIDAHEN_ATTACK_RULE_CONFIG_BY_ID.get(actionId) ?? QIDAHEN_ATTACK_RULE_CONFIGS[0]
);

const computeQidahenCommittedTroops = ({
    availableTroops,
    boundaryUnitCap,
    actionId,
}: QidahenAttackCommitmentInput): number => {
    const rule = getQidahenAttackRuleConfig(actionId);
    const normalizedAvailableTroops = Math.max(0, Math.floor(availableTroops));
    const committedTroopCap = boundaryUnitCap == null
        ? rule.maxCommittedTroops
        : Math.min(rule.maxCommittedTroops, Math.max(0, Math.floor(boundaryUnitCap)));
    return Math.max(0, Math.min(normalizedAvailableTroops, committedTroopCap));
};

export const computeQidahenEffectiveCommittedTroops = ({
    availableTroops,
    boundaryUnitCap,
    actionId,
    characterCommittedTroopLimit = null,
}: QidahenEffectiveAttackCommitmentInput): number => {
    const defaultCommittedTroops = computeQidahenCommittedTroops({
        availableTroops,
        boundaryUnitCap,
        actionId,
    });
    if (characterCommittedTroopLimit == null) {
        return defaultCommittedTroops;
    }
    const normalizedAvailableTroops = Math.max(0, Math.floor(availableTroops));
    const normalizedBoundaryUnitCap = boundaryUnitCap == null
        ? characterCommittedTroopLimit
        : Math.min(characterCommittedTroopLimit, Math.max(0, Math.floor(boundaryUnitCap)));
    return Math.max(0, Math.min(normalizedAvailableTroops, normalizedBoundaryUnitCap));
};

export const computeQidahenAttackPressure = (
    committedTroops: number,
    battleWidth: number,
): number => (
    Math.max(0, Math.min(Math.floor(committedTroops), Math.max(0, Math.floor(battleWidth))))
);

const QIDAHEN_TROOP_DIE_SIDES_BY_LEVEL: Record<number, number> = {
    1: 6,
    2: 8,
    3: 10,
    4: 12,
};

export const getQidahenTroopDieSides = (level: number): number => (
    QIDAHEN_TROOP_DIE_SIDES_BY_LEVEL[clampTroopLevel(level)] ?? 6
);

export const getQidahenBattleResolutionTroopCount = (
    region: Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>,
): number => Math.max(0, region.troops - getQidahenArtilleryTroopCount(region));

type QidahenBattleForceView = Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>;

type QidahenCombatPowerUnit = {
    troopKind: QidahenTroopKind;
    level: number;
    count: number;
};

const getQidahenSpecialTroopCount = (
    region: Pick<QidahenCore['regions'][number], 'specialTroops'>,
): number => region.specialTroops.reduce((sum, stack) => sum + Math.max(0, stack.count), 0);

const getQidahenArtilleryTroopCount = (
    region: Pick<QidahenCore['regions'][number], 'specialTroops'>,
): number => region.specialTroops
    .filter((stack) => stack.troopKind === 'artillery')
    .reduce((sum, stack) => sum + Math.max(0, stack.count), 0);

const buildQidahenCombatPowerUnits = (
    region: QidahenBattleForceView,
): QidahenCombatPowerUnit[] => {
    const genericTroops = Math.max(0, region.troops - getQidahenSpecialTroopCount(region));
    return [
        ...region.specialTroops
            .filter((stack) => stack.count > 0)
            .map((stack) => ({
                troopKind: stack.troopKind,
                level: Math.max(1, stack.level),
                count: stack.count,
            })),
        ...(genericTroops > 0
            ? [{
                troopKind: 'infantry' as const,
                level: 2,
                count: genericTroops,
            }]
            : []),
    ];
};

const computeQidahenCombatPower = (
    region: QidahenBattleForceView,
    maxNonArtilleryTroops: number,
): number => {
    const units = buildQidahenCombatPowerUnits(region);
    let remainingNonArtillery = Math.max(0, maxNonArtilleryTroops);
    let power = units
        .filter((unit) => unit.troopKind === 'artillery')
        .reduce((sum, unit) => sum + unit.level * unit.count, 0);

    for (const unit of units
        .filter((item) => item.troopKind !== 'artillery')
        .sort((left, right) => right.level - left.level)) {
        const used = Math.min(unit.count, remainingNonArtillery);
        power += used * unit.level;
        remainingNonArtillery -= used;
        if (remainingNonArtillery <= 0) {
            break;
        }
    }

    return power;
};

interface QidahenStructuredBattleCasualtyInput {
    sourceRegion: QidahenBattleForceView | null;
    targetRegion: QidahenBattleForceView;
    committedTroops: number;
    committedArtilleryTroops: number;
    attackPressure: number;
    effectiveDefenderTroops: number;
    defenderPressure: number;
    fallbackDefenderLoss: number;
    fallbackAttackerLoss: number;
    battleRolls?: QidahenBattleRolls | null;
}

interface QidahenStructuredBattleCasualtyResult {
    defenderLoss: number;
    attackerLoss: number;
    summary: string | null;
}

export const computeQidahenStructuredBattleCasualties = ({
    sourceRegion,
    targetRegion,
    committedTroops,
    committedArtilleryTroops,
    attackPressure,
    effectiveDefenderTroops,
    defenderPressure,
    fallbackDefenderLoss,
    fallbackAttackerLoss,
    battleRolls,
}: QidahenStructuredBattleCasualtyInput): QidahenStructuredBattleCasualtyResult => {
    const hasStructuredTroops = Boolean(sourceRegion?.specialTroops.length) || targetRegion.specialTroops.length > 0;
    if (!hasStructuredTroops || !sourceRegion) {
        return {
            defenderLoss: fallbackDefenderLoss,
            attackerLoss: fallbackAttackerLoss,
            summary: null,
        };
    }

    const committedBattleTroops = Math.max(0, committedTroops - committedArtilleryTroops);
    if (battleRolls) {
        return {
            defenderLoss: Math.max(0, Math.min(effectiveDefenderTroops, battleRolls.attackerDamage)),
            attackerLoss: Math.max(0, Math.min(committedBattleTroops, battleRolls.defenderDamage)),
            summary: battleRolls.summary,
        };
    }

    const attackPower = computeQidahenCombatPower(sourceRegion, attackPressure);
    const defenderPower = computeQidahenCombatPower(targetRegion, defenderPressure);
    const defenderLoss = effectiveDefenderTroops > 0
        ? Math.max(1, Math.min(effectiveDefenderTroops, Math.ceil(attackPower / 3)))
        : 0;
    const attackerLoss = Math.max(0, Math.min(committedBattleTroops, Math.ceil(defenderPower / 3)));

    return {
        defenderLoss,
        attackerLoss,
        summary: `等级损伤估算：攻方战力 ${attackPower} 造成 ${defenderLoss} 损伤，守方战力 ${defenderPower} 造成 ${attackerLoss} 损伤。`,
    };
};
