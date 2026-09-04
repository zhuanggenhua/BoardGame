import {
    getBetrayalMonsterDefinition,
    type BetrayalMonsterDefinition,
    type BetrayalMonsterDefinitionId,
    type BetrayalMonsterDefinitionTraitKey,
} from './domain/monsterDefinitions';
import type {
    BetrayalCore,
    BetrayalMonsterStatusKind,
    BetrayalMonsterStatusSummary,
    BetrayalMonsterSummary,
    BetrayalTraitKey,
} from './game';

const MAGIC_CAMERA_PHANTOM_PHOTOGRAPHER_TRAITS = {
    might: 4,
    speed: 1,
    sanity: 6,
    knowledge: 2,
    damage: 1,
};

export type BetrayalMonsterDamageOutcomeKind =
    | 'none'
    | 'stunned'
    | 'killed'
    | 'resisted';

export interface BetrayalMonsterDamageOutcome {
    monsterId: string;
    name: string;
    damageAmount: number;
    damageTrait: BetrayalTraitKey;
    previousStatus: BetrayalMonsterStatusKind;
    nextStatus: BetrayalMonsterStatusKind;
    kind: BetrayalMonsterDamageOutcomeKind;
    canBeStunned: boolean;
    stunned: boolean;
    killed: boolean;
    removedFromHouse: boolean;
    logLabel: string;
    ruleNote: string;
}

export function resolveMonsterTrait(monster: BetrayalMonsterSummary, trait: BetrayalTraitKey): number {
    return trait === 'might'
        ? monster.might
        : trait === 'speed'
            ? monster.speed
            : trait === 'sanity'
                ? monster.sanity ?? monster.might
                : monster.knowledge ?? monster.might;
}

export function inferMonsterDefinitionId(monster: BetrayalMonsterSummary): BetrayalMonsterDefinitionId | null {
    if (monster.definitionId) {
        return monster.definitionId;
    }
    if (monster.id === 'jack-spirit') {
        return 'crimson-jack-spirit';
    }
    if (monster.id === 'mummy' || monster.name === '木乃伊') {
        return 'mummy';
    }
    if (monster.id.startsWith('feverish-') || monster.name === '狂热病患') {
        return 'dust-feverish-patient';
    }
    if (monster.id.startsWith('troll-hand-') || monster.name === '巨魔手') {
        return 'helping-hands-troll-hand';
    }
    if (monster.id.startsWith('phantom-photographer-') || monster.name === '幻影摄影师') {
        return 'magic-camera-phantom-photographer';
    }
    if (monster.name === '石像小天使') {
        return 'blood-from-stone-stone-cherub';
    }
    if (monster.name === '恶魔地产经纪人') {
        return 'free-the-realtor-demon-realtor';
    }
    if (monster.name === '镜中怪物') {
        return 'upon-reflection-mirror-being';
    }
    if (monster.name === '管家') {
        return 'housekeeping-housekeeper';
    }
    return null;
}

export function resolveMonsterDefinition(monster: BetrayalMonsterSummary): BetrayalMonsterDefinition | null {
    return getBetrayalMonsterDefinition(inferMonsterDefinitionId(monster));
}

export function monsterCanBeStunned(monster: BetrayalMonsterSummary): boolean {
    const definition = resolveMonsterDefinition(monster);
    if (definition) {
        return definition.canBeStunned;
    }
    return !monster.id.startsWith('troll-hand-') && monster.id !== 'jack-spirit';
}

export function monsterCanBeAttacked(monster: BetrayalMonsterSummary): boolean {
    return resolveMonsterDefinition(monster)?.canBeAttacked ?? true;
}

function monsterCanAttack(monster: BetrayalMonsterSummary): boolean {
    return resolveMonsterDefinition(monster)?.canAttack ?? true;
}

export function resolveMonsterDefaultAttackTrait(monster: BetrayalMonsterSummary): BetrayalTraitKey {
    return (resolveMonsterDefinition(monster)?.defaultAttackTrait ?? 'might') as BetrayalTraitKey;
}

export function resolveMonsterStatusKind(core: BetrayalCore, monsterId: string): BetrayalMonsterStatusKind {
    const magicCamera = core.scenarioRuntime.magicCamera;
    if (magicCamera?.killedPhantomPhotographerIds.includes(monsterId)) {
        return 'killed';
    }
    if (magicCamera?.stunnedPhantomPhotographerIds.includes(monsterId)) {
        return 'stunned';
    }
    const genericStatus = core.scenarioRuntime.monsterStatusesById?.[monsterId];
    if (genericStatus) {
        return genericStatus;
    }
    return 'active';
}

function monsterKilledByDamageTrait(
    monster: BetrayalMonsterSummary,
    trait: BetrayalTraitKey,
): boolean {
    const definition = resolveMonsterDefinition(monster);
    return Boolean(
        definition?.killedByDamageTraits?.includes(trait as BetrayalMonsterDefinitionTraitKey),
    );
}

export function resolveBetrayalMonsterDamageOutcome(
    core: BetrayalCore,
    monsterId: string,
    params: {
        damageAmount: number;
        damageTrait: BetrayalTraitKey;
    },
): BetrayalMonsterDamageOutcome | null {
    const monster = core.monsters.find((item) => item.id === monsterId);
    if (!monster) {
        return null;
    }
    const damageAmount = Math.max(0, params.damageAmount);
    const previousStatus = resolveMonsterStatusKind(core, monsterId);
    const canBeStunned = monsterCanBeStunned(monster);
    const canBeAttacked = monsterCanBeAttacked(monster);
    const isPhantomPhotographer = core.scenarioRuntime.magicCamera?.phantomPhotographerIds.includes(monsterId) ?? false;
    if (damageAmount <= 0 || previousStatus !== 'active') {
        return {
            monsterId,
            name: monster.name,
            damageAmount,
            damageTrait: params.damageTrait,
            previousStatus,
            nextStatus: previousStatus,
            kind: 'none',
            canBeStunned,
            stunned: false,
            killed: previousStatus === 'killed',
            removedFromHouse: previousStatus === 'killed',
            logLabel: '未伤到怪物',
            ruleNote: previousStatus === 'active'
                ? '攻击没有造成正数伤害，怪物状态不变。'
                : '该怪物当前不是可受伤的正面状态，状态不变。',
        };
    }
    if (!canBeAttacked) {
        return {
            monsterId,
            name: monster.name,
            damageAmount,
            damageTrait: params.damageTrait,
            previousStatus,
            nextStatus: previousStatus,
            kind: 'resisted',
            canBeStunned,
            stunned: false,
            killed: false,
            removedFromHouse: false,
            logLabel: `${monster.name}不能被攻击`,
            ruleNote: resolveMonsterDefinition(monster)?.ruleNotes[0]
                ?? '该怪物规则明确不能被普通攻击。',
        };
    }
    if (!canBeStunned) {
        return {
            monsterId,
            name: monster.name,
            damageAmount,
            damageTrait: params.damageTrait,
            previousStatus,
            nextStatus: previousStatus,
            kind: 'resisted',
            canBeStunned,
            stunned: false,
            killed: false,
            removedFromHouse: false,
            logLabel: `${monster.name}不能被击晕`,
            ruleNote: '该怪物规则明确不能被击晕，受伤成功也不会翻为击晕面。',
        };
    }
    if (monsterKilledByDamageTrait(monster, params.damageTrait) || (isPhantomPhotographer && params.damageTrait === 'might')) {
        return {
            monsterId,
            name: monster.name,
            damageAmount,
            damageTrait: params.damageTrait,
            previousStatus,
            nextStatus: 'killed',
            kind: 'killed',
            canBeStunned,
            stunned: false,
            killed: true,
            removedFromHouse: true,
            logLabel: `击杀${monster.name}`,
            ruleNote: '幻影摄影师受到力量伤害时被杀死并移出房子。',
        };
    }
    return {
        monsterId,
        name: monster.name,
        damageAmount,
        damageTrait: params.damageTrait,
        previousStatus,
        nextStatus: 'stunned',
        kind: 'stunned',
        canBeStunned,
        stunned: true,
        killed: false,
        removedFromHouse: false,
        logLabel: `击晕${monster.name}`,
        ruleNote: '怪物受到非杀死型正数伤害时翻为击晕面。',
    };
}

function buildMonsterStatusSummary(input: {
    monsterId: string;
    name: string;
    roomId: string | null;
    might: number;
    speed: number;
    sanity?: number | null;
    knowledge?: number | null;
    damage: number;
    status: BetrayalMonsterStatusKind;
    canBeStunned: boolean;
    canBeAttacked?: boolean;
    canAttack?: boolean;
    defaultAttackTrait?: BetrayalTraitKey;
    removedFromHouse?: boolean;
    definitionRuleNotes?: readonly string[];
}): BetrayalMonsterStatusSummary {
    const stunned = input.status === 'stunned';
    const killed = input.status === 'killed';
    const canAttack = input.canAttack ?? true;
    const canBeAttacked = input.canBeAttacked ?? true;
    const ruleNotes = [
        '怪物使用固定属性，不使用探索者属性轨。',
        canAttack ? null : '该怪物规则明确不会发动攻击。',
        canBeAttacked ? null : '该怪物不能被普通攻击。',
        input.canBeStunned ? '受伤时通常翻为击晕面。' : '该怪物不能被击晕。',
        stunned ? '已击晕的怪物不会减缓英雄移动。' : null,
        killed ? '已杀死的怪物从房子中移除。' : null,
        '怪物不能持有物品或预兆，也不能探索新板块。',
        ...(input.definitionRuleNotes ?? []),
    ].filter((note): note is string => Boolean(note));
    return {
        monsterId: input.monsterId,
        name: input.name,
        roomId: input.roomId,
        traits: {
            might: input.might,
            speed: input.speed,
            sanity: input.sanity ?? null,
            knowledge: input.knowledge ?? null,
            usesTraitTrack: false,
        },
        damage: input.damage,
        status: input.status,
        canBeStunned: input.canBeStunned,
        stunned,
        killed,
        removedFromHouse: input.removedFromHouse ?? false,
        slowsHeroMovement: input.status === 'active',
        canAttack,
        canBeAttacked,
        canHoldPossessions: false,
        canExploreNewRooms: false,
        defaultAttackTrait: input.defaultAttackTrait ?? 'might',
        ruleNotes,
    };
}

export function resolveBetrayalMonsterStatuses(core: BetrayalCore): BetrayalMonsterStatusSummary[] {
    const liveStatuses = core.monsters.map((monster) => {
        const status = resolveMonsterStatusKind(core, monster.id);
        const definition = resolveMonsterDefinition(monster);
        return buildMonsterStatusSummary({
            monsterId: monster.id,
            name: monster.name,
            roomId: status === 'killed' ? null : monster.roomId,
            might: monster.might,
            speed: monster.speed,
            sanity: monster.sanity,
            knowledge: monster.knowledge,
            damage: monster.damage,
            status,
            canBeStunned: monsterCanBeStunned(monster),
            canBeAttacked: monsterCanBeAttacked(monster),
            canAttack: monsterCanAttack(monster),
            defaultAttackTrait: resolveMonsterDefaultAttackTrait(monster),
            removedFromHouse: status === 'killed',
            definitionRuleNotes: definition?.ruleNotes,
        });
    });
    const liveMonsterIds = new Set(core.monsters.map((monster) => monster.id));
    const killedPhotographerStatuses = (core.scenarioRuntime.magicCamera?.killedPhantomPhotographerIds ?? [])
        .filter((monsterId) => !liveMonsterIds.has(monsterId))
        .map((monsterId) => buildMonsterStatusSummary({
            monsterId,
            name: '幻影摄影师',
            roomId: null,
            ...MAGIC_CAMERA_PHANTOM_PHOTOGRAPHER_TRAITS,
            status: 'killed',
            canBeStunned: true,
            canBeAttacked: true,
            canAttack: true,
            defaultAttackTrait: 'sanity',
            removedFromHouse: true,
            definitionRuleNotes: getBetrayalMonsterDefinition('magic-camera-phantom-photographer')?.ruleNotes,
        }));
    return [...liveStatuses, ...killedPhotographerStatuses];
}
