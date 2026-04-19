import type { AbilityDef, AbilityEffect, EffectTiming } from '../../domain/combat';
import { GUNSLINGER_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';

const FACE = GUNSLINGER_DICE_FACE_IDS;

export const GUNSLINGER_SFX_SHOT = 'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_generic_a_shoot_1';
export const GUNSLINGER_SFX_HEAVY = 'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_generic_b_shoot_2';
export const GUNSLINGER_SFX_ULTIMATE = 'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_minigun_shoot_1';

const damage = (
    value: number,
    description: string,
    opts?: { timing?: EffectTiming; unblockable?: boolean; damageScope?: 'attack' | 'direct' },
): AbilityEffect => ({
    description,
    action: {
        type: 'damage',
        target: 'opponent',
        value,
        ...(opts?.unblockable ? { unblockable: true } : {}),
        ...(opts?.damageScope ? { damageScope: opts.damageScope } : {}),
    },
    timing: opts?.timing,
});

const grantToken = (
    target: 'self' | 'opponent',
    tokenId: string,
    value: number,
    description: string,
    timing: EffectTiming = 'immediate',
): AbilityEffect => ({
    description,
    action: { type: 'grantToken', target, tokenId, value },
    timing,
});

const inflictStatus = (
    statusId: string,
    value: number,
    description: string,
    timing: EffectTiming = 'immediate',
): AbilityEffect => ({
    description,
    action: { type: 'grantStatus', target: 'opponent', statusId, value },
    timing,
});

const custom = (
    customActionId: string,
    description: string,
    timing: EffectTiming,
    params?: Record<string, unknown>,
): AbilityEffect => ({
    description,
    action: { type: 'custom', target: 'self', customActionId, params },
    timing,
});

const REVOLVER: AbilityDef = {
    id: 'revolver',
    name: '左轮手枪',
    type: 'offensive',
    description: '3/4/5 个子弹：分别造成 3/4/5 点伤害。',
    sfxKey: GUNSLINGER_SFX_SHOT,
    variants: [
        {
            id: 'revolver-3',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 3 } },
            effects: [damage(3, '造成 3 点伤害。')],
            priority: 1,
        },
        {
            id: 'revolver-4',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 4 } },
            effects: [damage(4, '造成 4 点伤害。')],
            priority: 2,
        },
        {
            id: 'revolver-5',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 5 } },
            effects: [damage(5, '造成 5 点伤害。')],
            priority: 3,
        },
    ],
};

export const REVOLVER_2: AbilityDef = {
    id: 'revolver',
    name: '左轮手枪 II',
    type: 'offensive',
    description: '3/4/5 个子弹：分别造成 4/5/6 点伤害。若至少有 4 颗骰子点数相同，则施加击倒。',
    sfxKey: GUNSLINGER_SFX_SHOT,
    variants: [
        {
            id: 'revolver-2-3',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 3 } },
            effects: [
                damage(4, '造成 4 点伤害。'),
                custom('gunslinger-revolver-2-four-kind', '若至少有 4 颗骰子点数相同，则施加击倒。', 'preDefense'),
            ],
            priority: 1,
        },
        {
            id: 'revolver-2-4',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 4 } },
            effects: [
                damage(5, '造成 5 点伤害。'),
                custom('gunslinger-revolver-2-four-kind', '若至少有 4 颗骰子点数相同，则施加击倒。', 'preDefense'),
            ],
            priority: 2,
        },
        {
            id: 'revolver-2-5',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 5 } },
            effects: [
                damage(6, '造成 6 点伤害。'),
                custom('gunslinger-revolver-2-four-kind', '若至少有 4 颗骰子点数相同，则施加击倒。', 'preDefense'),
            ],
            priority: 3,
        },
    ],
};

const BOUNTY_HUNTER: AbilityDef = {
    id: 'bounty-hunter',
    name: '赏金猎人',
    type: 'offensive',
    description: '施加 1 个赏金，并造成 1 点不可防御伤害。',
    sfxKey: GUNSLINGER_SFX_SHOT,
    tags: ['unblockable'],
    trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 2, [FACE.BULLSEYE]: 2 } },
    effects: [
        grantToken('opponent', TOKEN_IDS.BOUNTY, 1, '对手获得 1 个赏金。', 'preDefense'),
        damage(1, '造成 1 点不可防御伤害。', { unblockable: true }),
    ],
};

export const BOUNTY_HUNTER_2: AbilityDef = {
    id: 'bounty-hunter',
    name: '赏金猎人 II',
    type: 'offensive',
    description: '施加 1 个赏金，并造成 2 点不可防御伤害。',
    sfxKey: GUNSLINGER_SFX_SHOT,
    tags: ['unblockable'],
    trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 2, [FACE.BULLSEYE]: 2 } },
    effects: [
        grantToken('opponent', TOKEN_IDS.BOUNTY, 1, '对手获得 1 个赏金。', 'preDefense'),
        damage(2, '造成 2 点不可防御伤害。', { unblockable: true }),
    ],
};

const QUICK_DRAW: AbilityDef = {
    id: 'quick-draw',
    name: '快速拔枪',
    type: 'passive',
    description: '维持阶段开始时，获得 1 个装填。',
    trigger: { type: 'phaseStart', phase: 'upkeep' },
    effects: [
        grantToken('self', TOKEN_IDS.LOADED, 1, '获得 1 个装填。'),
    ],
};

export const QUICK_DRAW_UPGRADED: AbilityDef = {
    id: 'quick-draw',
    name: '快速拔枪 II',
    type: 'passive',
    description: '维持阶段开始时，获得 1 个装填。每当你花费装填时，可以将该投掷重掷 1 次。',
    trigger: { type: 'phaseStart', phase: 'upkeep' },
    effects: [
        grantToken('self', TOKEN_IDS.LOADED, 1, '获得 1 个装填。'),
    ],
};

const TAKE_COVER: AbilityDef = {
    id: 'take-cover',
    name: '掩护射击',
    type: 'offensive',
    description: '获得 1 个闪避，并造成 5 点伤害。',
    sfxKey: GUNSLINGER_SFX_SHOT,
    trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 2, [FACE.DASH]: 3 } },
    effects: [
        grantToken('self', TOKEN_IDS.EVASIVE, 1, '获得 1 个闪避。', 'preDefense'),
        damage(5, '造成 5 点伤害。'),
    ],
};

export const TAKE_COVER_2: AbilityDef = {
    id: 'take-cover',
    name: '掩护射击 II',
    type: 'offensive',
    description: '包含掩护射击 II 与标记目标两个变体。',
    sfxKey: GUNSLINGER_SFX_SHOT,
    variants: [
        {
            id: 'mark-the-target',
            name: '标记目标',
            description: '3 个冲刺：获得 2 个闪避，并施加 1 个赏金。',
            trigger: { type: 'diceSet', faces: { [FACE.DASH]: 3 } },
            effects: [
                grantToken('self', TOKEN_IDS.EVASIVE, 2, '获得 2 个闪避。', 'preDefense'),
                custom('gunslinger-card-mark-the-target', '选择 1 位敌方玩家，使其获得 1 个赏金。', 'preDefense'),
            ],
            priority: 0,
        },
        {
            id: 'take-cover-2-main',
            name: '掩护射击 II',
            description: '2 个子弹 + 3 个冲刺：获得 1 个闪避，并造成 6 点伤害。',
            trigger: { type: 'diceSet', faces: { [FACE.BULLET]: 2, [FACE.DASH]: 3 } },
            effects: [
                grantToken('self', TOKEN_IDS.EVASIVE, 1, '获得 1 个闪避。', 'preDefense'),
                damage(6, '造成 6 点伤害。'),
            ],
            priority: 1,
        },
    ],
};

const SHOWDOWN: AbilityDef = {
    id: 'showdown',
    name: '摊到牌面',
    type: 'offensive',
    description: '双方各掷 1 颗骰子。若你的结果不小于对手，改为造成 7 点伤害；否则造成 5 点伤害。',
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'smallStraight' },
    effects: [
        custom(
            'gunslinger-showdown-bonus',
            '双方各掷 1 颗骰子；若你的结果不小于对手，本次攻击 +2 伤害。',
            'preDefense',
            { bonusDamageOnWin: 2 },
        ),
        damage(5, '造成 5 点伤害。'),
    ],
};

export const SHOWDOWN_2: AbilityDef = {
    id: 'showdown',
    name: '摊到牌面 II',
    type: 'offensive',
    description: '双方各掷 1 颗骰子。若你的结果不小于对手，改为造成 8 点伤害；否则造成 6 点伤害。',
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'smallStraight' },
    effects: [
        custom(
            'gunslinger-showdown-bonus',
            '双方各掷 1 颗骰子；若你的结果不小于对手，本次攻击 +2 伤害。',
            'preDefense',
            { bonusDamageOnWin: 2 },
        ),
        damage(6, '造成 6 点伤害。'),
    ],
};

export const SHOWDOWN_3: AbilityDef = {
    id: 'showdown',
    name: '摊到牌面 III',
    type: 'offensive',
    description: '双方各掷 1 颗骰子。若你的结果不小于对手，改为造成 9 点伤害；否则造成 6 点伤害。',
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'smallStraight' },
    effects: [
        custom(
            'gunslinger-showdown-bonus',
            '双方各掷 1 颗骰子；若你的结果不小于对手，本次攻击 +3 伤害。',
            'preDefense',
            { bonusDamageOnWin: 3 },
        ),
        damage(6, '造成 6 点伤害。'),
    ],
};

const DEADEYE: AbilityDef = {
    id: 'deadeye',
    name: '死亡之眼',
    type: 'offensive',
    description: '施加击倒，并造成 6 点不可防御伤害。',
    sfxKey: GUNSLINGER_SFX_HEAVY,
    tags: ['unblockable'],
    trigger: { type: 'diceSet', faces: { [FACE.BULLSEYE]: 4 } },
    effects: [
        inflictStatus(STATUS_IDS.KNOCKDOWN, 1, '对手获得击倒。', 'preDefense'),
        damage(6, '造成 6 点不可防御伤害。'),
    ],
};

export const DEADEYE_2: AbilityDef = {
    id: 'deadeye',
    name: '死亡之眼 II',
    type: 'offensive',
    description: '包含死亡之眼 II 与执法者两个变体。',
    sfxKey: GUNSLINGER_SFX_HEAVY,
    variants: [
        {
            id: 'the-law',
            name: '执法者',
            description: '3 个准星：获得 1 个闪避；至多 2 位目标玩家获得赏金与击倒。',
            trigger: { type: 'diceSet', faces: { [FACE.BULLSEYE]: 3 } },
            effects: [
                grantToken('self', TOKEN_IDS.EVASIVE, 1, '获得 1 个闪避。', 'preDefense'),
                custom('gunslinger-card-the-law', '选择至多 2 位目标玩家。每名目标玩家获得 1 个赏金并受到 1 层击倒。', 'preDefense'),
            ],
            priority: 0,
        },
        {
            id: 'deadeye-2-main',
            name: '死亡之眼 II',
            description: '4 个准星：施加击倒，并造成 8 点不可防御伤害。',
            trigger: { type: 'diceSet', faces: { [FACE.BULLSEYE]: 4 } },
            effects: [
                inflictStatus(STATUS_IDS.KNOCKDOWN, 1, '对手获得击倒。', 'preDefense'),
                damage(8, '造成 8 点不可防御伤害。', { unblockable: true }),
            ],
            tags: ['unblockable'],
            priority: 1,
        },
    ],
};

const FAN_THE_HAMMER: AbilityDef = {
    id: 'fan-the-hammer',
    name: '左轮速射',
    type: 'offensive',
    description: '获得 2 个闪避，并造成 7 点伤害。',
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'largeStraight' },
    effects: [
        grantToken('self', TOKEN_IDS.EVASIVE, 2, '获得 2 个闪避。', 'preDefense'),
        damage(7, '造成 7 点伤害。'),
    ],
};

export const FAN_THE_HAMMER_2: AbilityDef = {
    id: 'fan-the-hammer',
    name: '左轮速射 II',
    type: 'offensive',
    description: '包含左轮速射 II 与枪托击打两个变体。',
    sfxKey: GUNSLINGER_SFX_HEAVY,
    variants: [
        {
            id: 'pistol-whip',
            name: '枪托击打',
            description: '2 个冲刺 + 1 个准星：获得 1 个闪避，施加击倒，并造成 1 点不可防御伤害。',
            trigger: { type: 'diceSet', faces: { [FACE.DASH]: 2, [FACE.BULLSEYE]: 1 } },
            tags: ['unblockable'],
            effects: [
                grantToken('self', TOKEN_IDS.EVASIVE, 1, '获得 1 个闪避。', 'preDefense'),
                inflictStatus(STATUS_IDS.KNOCKDOWN, 1, '对手获得击倒。', 'preDefense'),
                damage(1, '造成 1 点不可防御伤害。', { unblockable: true, damageScope: 'direct' }),
            ],
            priority: 0,
        },
        {
            id: 'fan-the-hammer-2-main',
            name: '左轮速射 II',
            description: '大顺：获得 2 个闪避，并造成 8 点伤害。',
            trigger: { type: 'largeStraight' },
            effects: [
                grantToken('self', TOKEN_IDS.EVASIVE, 2, '获得 2 个闪避。', 'preDefense'),
                damage(8, '造成 8 点伤害。'),
            ],
            priority: 1,
        },
    ],
};

const DUEL: AbilityDef = {
    id: 'duel',
    name: '对决',
    type: 'defensive',
    description: '防御掷骰：掷 1 颗骰子。你与攻击方各掷 1 颗骰并比较；若你的结果更大，可选择造成 3 点不可防御伤害，或抵挡 1/2 进攻伤害（向上取整）；若更小，则造成 1 点不可防御伤害。',
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 1 },
    effects: [
        custom(
            'gunslinger-duel-resolve',
            '比较双方掷骰结果；获胜时二选一，失败时造成 1 点不可防御伤害。',
            'withDamage',
            { winOnTie: false },
        ),
    ],
};

export const DUEL_2: AbilityDef = {
    id: 'duel',
    name: '对决 II',
    type: 'defensive',
    description: '防御掷骰：掷 1 颗骰子。你与攻击方各掷 1 颗骰并比较；若你的结果大于或等于攻击方，可选择造成 3 点不可防御伤害，或抵挡 1/2 进攻伤害（向上取整）；若更小，则造成 1 点不可防御伤害。',
    sfxKey: GUNSLINGER_SFX_HEAVY,
    trigger: { type: 'phase', phaseId: 'defensiveRoll', diceCount: 1 },
    effects: [
        custom(
            'gunslinger-duel-resolve',
            '比较双方掷骰结果；平手也视为获胜，获胜时二选一，失败时造成 1 点不可防御伤害。',
            'withDamage',
            { winOnTie: true },
        ),
    ],
};

const FILL_EM_WITH_LEAD: AbilityDef = {
    id: 'fill-em-with-lead',
    name: '枪林弹雨！',
    type: 'offensive',
    tags: ['ultimate'],
    description: '获得 1 个闪避，对手获得赏金与击倒，然后造成 10 点不可防御伤害。若你花费装填来增加伤害，可以重掷该骰 1 次。',
    sfxKey: GUNSLINGER_SFX_ULTIMATE,
    trigger: { type: 'diceSet', faces: { [FACE.BULLSEYE]: 5 } },
    effects: [
        grantToken('self', TOKEN_IDS.EVASIVE, 1, '获得 1 个闪避。', 'preDefense'),
        grantToken('opponent', TOKEN_IDS.BOUNTY, 1, '对手获得 1 个赏金。', 'preDefense'),
        inflictStatus(STATUS_IDS.KNOCKDOWN, 1, '对手获得击倒。', 'preDefense'),
        damage(10, '造成 10 点不可防御伤害。'),
    ],
};

export const GUNSLINGER_ABILITIES: AbilityDef[] = [
    REVOLVER,
    BOUNTY_HUNTER,
    QUICK_DRAW,
    TAKE_COVER,
    SHOWDOWN,
    DEADEYE,
    FAN_THE_HAMMER,
    DUEL,
    FILL_EM_WITH_LEAD,
];
