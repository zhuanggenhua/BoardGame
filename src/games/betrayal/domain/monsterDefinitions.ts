export type BetrayalMonsterDefinitionTraitKey = 'might' | 'speed' | 'knowledge' | 'sanity';

export type BetrayalMonsterDefinitionId =
    | 'mummy'
    | 'crimson-jack-spirit'
    | 'dust-feverish-patient'
    | 'helping-hands-troll-hand'
    | 'magic-camera-phantom-photographer'
    | 'blood-from-stone-stone-cherub'
    | 'free-the-realtor-demon-realtor'
    | 'upon-reflection-mirror-being'
    | 'housekeeping-housekeeper';

export interface BetrayalMonsterDefinition {
    id: BetrayalMonsterDefinitionId;
    name: string;
    hauntNumber: number;
    sourcePath: string;
    portraitAsset: string;
    tokenAsset?: string;
    traits: {
        might: number;
        speed: number;
        sanity?: number;
        knowledge?: number;
    };
    damage: number;
    defaultAttackTrait: BetrayalMonsterDefinitionTraitKey;
    canAttack: boolean;
    canBeAttacked: boolean;
    canBeStunned: boolean;
    killedByDamageTraits?: readonly BetrayalMonsterDefinitionTraitKey[];
    ruleNotes: readonly string[];
}

export interface BetrayalMonsterDefinitionInstance {
    definitionId: BetrayalMonsterDefinitionId;
    id: string;
    name: string;
    portraitAsset: string;
    tokenAsset?: string;
    roomId: string;
    might: number;
    speed: number;
    sanity?: number;
    knowledge?: number;
    damage: number;
}

type MonsterDefinitionInstanceOverrides = Partial<
    Pick<
        BetrayalMonsterDefinitionInstance,
        'name' | 'portraitAsset' | 'tokenAsset' | 'might' | 'speed' | 'sanity' | 'knowledge' | 'damage'
    >
>;

export const BETRAYAL_MONSTER_DEFINITIONS: Record<BetrayalMonsterDefinitionId, BetrayalMonsterDefinition> = {
    mummy: {
        id: 'mummy',
        name: '木乃伊',
        hauntNumber: 1,
        sourcePath: 'docs/games/betrayal/haunts/01-mummy-rampage.md',
        portraitAsset: 'betrayal/monsters/mummy',
        tokenAsset: 'betrayal/tokens/monsters/mummy.svg',
        traits: { might: 8, speed: 3, sanity: 5 },
        damage: 1,
        defaultAttackTrait: 'might',
        canAttack: true,
        canBeAttacked: true,
        canBeStunned: true,
        ruleNotes: [
            '木乃伊速度 3、力量 8、神志 5；只用力量攻击。',
            '速度攻击对木乃伊无效，包括手枪和炸药。',
            '木乃伊移动掷骰结果为 0 或 1 时，可瞬移到任意房间；物件不会改变木乃伊属性。',
            '木乃伊受伤时按通用怪物规则击晕；英雄胜利仍必须按剧本驱逐步骤结算。',
        ],
    },
    'crimson-jack-spirit': {
        id: 'crimson-jack-spirit',
        name: '杰克之灵',
        hauntNumber: 1,
        sourcePath: 'docs/games/betrayal/haunts/01-stacked-like-cordwood-2.md',
        portraitAsset: 'betrayal/monsters/spirit',
        tokenAsset: 'betrayal/tokens/monsters/jacks-spirit',
        traits: { might: 5, speed: 3, sanity: 4, knowledge: 4 },
        damage: 1,
        defaultAttackTrait: 'might',
        canAttack: true,
        canBeAttacked: true,
        canBeStunned: false,
        ruleNotes: [
            '杰克之灵不能被击晕；叛徒死亡后的怪物替代回合另由首剧本规则控制。',
        ],
    },
    'dust-feverish-patient': {
        id: 'dust-feverish-patient',
        name: '狂热病患',
        hauntNumber: 3,
        sourcePath: 'docs/games/betrayal/haunts/03-the-dust.md',
        portraitAsset: 'betrayal/monsters/spirit',
        tokenAsset: 'betrayal/tokens/monsters/ghost',
        traits: { might: 6, speed: 5, sanity: 3, knowledge: 3 },
        damage: 1,
        defaultAttackTrait: 'might',
        canAttack: true,
        canBeAttacked: true,
        canBeStunned: true,
        ruleNotes: [
            '死亡叛徒变为狂热病患后使用固定怪物属性，不再使用探索者属性轨。',
        ],
    },
    'helping-hands-troll-hand': {
        id: 'helping-hands-troll-hand',
        name: '巨魔手',
        hauntNumber: 12,
        sourcePath: 'docs/games/betrayal/haunts/12-the-house-is-hungry-helping-hands.md',
        portraitAsset: 'betrayal/cards/back-monster',
        tokenAsset: 'betrayal/tokens/monsters/troll-right-hand',
        traits: { might: 5, speed: 3, sanity: 4, knowledge: 4 },
        damage: 1,
        defaultAttackTrait: 'might',
        canAttack: true,
        canBeAttacked: true,
        canBeStunned: false,
        ruleNotes: [
            '巨魔手不能被击晕；奇异护符控制权和合击规则由 12 号作祟逻辑覆盖。',
        ],
    },
    'magic-camera-phantom-photographer': {
        id: 'magic-camera-phantom-photographer',
        name: '幻影摄影师',
        hauntNumber: 33,
        sourcePath: 'docs/games/betrayal/haunts/33-smile-for-the-camera.md',
        portraitAsset: 'betrayal/monsters/spirit',
        tokenAsset: 'betrayal/tokens/monsters/ghost',
        traits: { might: 4, speed: 1, sanity: 6, knowledge: 2 },
        damage: 1,
        defaultAttackTrait: 'sanity',
        canAttack: true,
        canBeAttacked: true,
        canBeStunned: true,
        killedByDamageTraits: ['might'],
        ruleNotes: [
            '幻影摄影师使用神志攻击；受到力量伤害时被杀死，其他成功攻击只会击晕。',
        ],
    },
    'blood-from-stone-stone-cherub': {
        id: 'blood-from-stone-stone-cherub',
        name: '石像小天使',
        hauntNumber: 5,
        sourcePath: 'docs/games/betrayal/haunts/05-blood-from-a-stone.md',
        portraitAsset: 'betrayal/monsters/stone-cherub',
        tokenAsset: 'betrayal/tokens/monsters/small-monster-1-front',
        traits: { might: 8, speed: 4, sanity: 8, knowledge: 8 },
        damage: 1,
        defaultAttackTrait: 'might',
        canAttack: false,
        canBeAttacked: false,
        canBeStunned: false,
        ruleNotes: [
            '石像小天使不能攻击，也不能被普通攻击；必须通过“玩躲猫猫”成对移除。',
            '本定义只覆盖怪物卡基础属性和攻防限制；视线移动停步、视线伤害和成对移除由 5 号作祟专属逻辑接入。',
        ],
    },
    'free-the-realtor-demon-realtor': {
        id: 'free-the-realtor-demon-realtor',
        name: '恶魔地产经纪人',
        hauntNumber: 4,
        sourcePath: 'docs/games/betrayal/haunts/04-free-the-realtor.md',
        portraitAsset: 'betrayal/monsters/demon-realtor',
        tokenAsset: 'betrayal/tokens/monsters/demon',
        traits: { might: 5, speed: 3, sanity: 6, knowledge: 4 },
        damage: 1,
        defaultAttackTrait: 'sanity',
        canAttack: true,
        canBeAttacked: true,
        canBeStunned: false,
        ruleNotes: [
            '恶魔地产经纪人不能被击晕；受伤后的推动和区域精神伤害仍由 4 号作祟专属逻辑接入。',
        ],
    },
    'upon-reflection-mirror-being': {
        id: 'upon-reflection-mirror-being',
        name: '镜中怪物',
        hauntNumber: 7,
        sourcePath: 'docs/games/betrayal/haunts/07-upon-reflection.md',
        portraitAsset: 'betrayal/monsters/mirror-being',
        tokenAsset: 'betrayal/tokens/monsters/small-monster-1-front',
        traits: { might: 4, speed: 3, sanity: 6, knowledge: 4 },
        damage: 1,
        defaultAttackTrait: 'sanity',
        canAttack: true,
        canBeAttacked: true,
        canBeStunned: true,
        ruleNotes: [
            '镜中怪物使用神志攻击；最近目标和平手选择仍由 7 号作祟专属逻辑接入。',
        ],
    },
    'housekeeping-housekeeper': {
        id: 'housekeeping-housekeeper',
        name: '管家',
        hauntNumber: 8,
        sourcePath: 'docs/games/betrayal/haunts/08-housekeeping.md',
        portraitAsset: 'betrayal/monsters/housekeeper',
        tokenAsset: 'betrayal/tokens/monsters/small-monster-1-front',
        traits: { might: 5, speed: 4, sanity: 5, knowledge: 5 },
        damage: 1,
        defaultAttackTrait: 'might',
        canAttack: true,
        canBeAttacked: true,
        canBeStunned: true,
        ruleNotes: [
            '管家使用力量攻击；最近英雄、年龄平手和怪物回合末全员伤害仍由 8 号作祟专属逻辑接入。',
        ],
    },
};

export function getBetrayalMonsterDefinition(
    definitionId: BetrayalMonsterDefinitionId | null | undefined,
): BetrayalMonsterDefinition | null {
    return definitionId ? BETRAYAL_MONSTER_DEFINITIONS[definitionId] ?? null : null;
}

export function createBetrayalMonsterFromDefinition(
    definitionId: BetrayalMonsterDefinitionId,
    id: string,
    roomId: string,
    overrides: MonsterDefinitionInstanceOverrides = {},
): BetrayalMonsterDefinitionInstance {
    const definition = BETRAYAL_MONSTER_DEFINITIONS[definitionId];
    return {
        definitionId,
        id,
        name: overrides.name ?? definition.name,
        portraitAsset: overrides.portraitAsset ?? definition.portraitAsset,
        tokenAsset: overrides.tokenAsset ?? definition.tokenAsset,
        roomId,
        might: overrides.might ?? definition.traits.might,
        speed: overrides.speed ?? definition.traits.speed,
        sanity: overrides.sanity ?? definition.traits.sanity,
        knowledge: overrides.knowledge ?? definition.traits.knowledge,
        damage: overrides.damage ?? definition.damage,
    };
}
