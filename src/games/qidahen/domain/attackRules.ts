export type QidahenAttackActionId = 'raid' | 'wheel-dispatch' | 'drive-tiger';

export interface QidahenAttackRuleConfig {
    id: QidahenAttackActionId;
    label: string;
    maxCommittedTroops: number;
}

export interface QidahenAttackCommitmentInput {
    availableTroops: number;
    boundaryUnitCap: number | null;
    actionId: QidahenAttackActionId;
}

export const QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS = 3;

export const QIDAHEN_ATTACK_RULE_CONFIGS: QidahenAttackRuleConfig[] = [
    { id: 'raid', label: '进攻行动', maxCommittedTroops: 6 },
    { id: 'wheel-dispatch', label: '轮盘进攻/调度', maxCommittedTroops: 6 },
    { id: 'drive-tiger', label: '驱虎吞狼', maxCommittedTroops: 6 },
];

const QIDAHEN_ATTACK_RULE_CONFIG_BY_ID = new Map(
    QIDAHEN_ATTACK_RULE_CONFIGS.map((config) => [config.id, config]),
);

export const getQidahenAttackRuleConfig = (
    actionId: QidahenAttackActionId,
): QidahenAttackRuleConfig => (
    QIDAHEN_ATTACK_RULE_CONFIG_BY_ID.get(actionId) ?? QIDAHEN_ATTACK_RULE_CONFIGS[0]
);

export const computeQidahenCommittedTroops = ({
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

export const computeQidahenAttackPressure = (
    committedTroops: number,
    battleWidth: number,
): number => (
    Math.max(0, Math.min(Math.floor(committedTroops), Math.max(0, Math.floor(battleWidth))))
);
