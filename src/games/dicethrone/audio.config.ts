/**
 * DiceThrone 音频配置
 * 
 * 职责：
 * - feedbackResolver：自动生成（基于 DT_EVENTS 配置）
 * - 有动画的事件音效（伤害、治疗、状态、Token）由 animationSoundConfig.ts 管理
 */
import type { AudioEvent, AudioRuntimeContext, GameAudioConfig, SoundKey } from '../../lib/audio/types';
import { pickDiceRollSoundKey } from '../../lib/audio/audioUtils';
import { createFeedbackResolver, collectPreloadKeys } from '../../lib/audio/defineEvents';
import { DT_EVENTS } from './domain/events';
import type { DiceThroneCore, TurnPhase, SelectableCharacterId } from './domain/types';
import { findPlayerAbility } from './domain/abilityLookup';
import { findHeroCard } from './heroes';
import { CHARACTER_DATA_MAP } from './domain/characters';

const resolveTokenSfx = (state: DiceThroneCore, tokenId?: string): string | null => {
    if (!tokenId) return null;
    const def = state.tokenDefinitions?.find(token => token.id === tokenId);
    return def?.sfxKey ?? null;
};

// DT BGM：只引用当前共享音频包中已有压缩 OGG 的曲目，避免 App 已安装包读取缺文件。
const BGM_ALPHA_KEY = 'bgm.heroes_music_pack_vol.alpha_rt_6.heroes_alpha_main';
const BGM_DAUNTLESS_KEY = 'bgm.heroes_music_pack_vol.dauntless_rt_5.heroes_dauntless_main';
const BGM_MAGNUS_KEY = 'bgm.heroes_music_pack_vol.magnus_rt_6.heroes_magnus_main';
const BGM_TERMINUS_KEY = 'bgm.heroes_music_pack_vol.terminus_rt_4.heroes_terminus_main';
const BGM_INVICTUS_KEY = 'bgm.epic_music_pack_vol.invictus_rt_5.epic_vol5_invictus_main';
const BGM_HERCULES_KEY = 'bgm.epic_music_pack_vol.hercules_rt_3.epic_vol5_hercules_main';
const BGM_ZENITH_KEY = 'bgm.epic_music_pack_vol.zenith_rt_3.epic_vol5_zenith_main';
const BGM_GO_NOW_KEY = 'bgm.epic_music_pack_vol.go_now_rt_4.epic_vol5_go_now_main';

const DICE_ROLL_SINGLE_KEY = 'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_001';
const DICE_ROLL_MULTI_KEYS = [
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_001',
    'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_003',
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_005',
];
const DICE_ROLL_KEYS = [DICE_ROLL_SINGLE_KEY, ...DICE_ROLL_MULTI_KEYS];

// 模块级预构建：避免在 feedbackResolver 每次调用时重建查找表
const baseDtFeedbackResolver = createFeedbackResolver(DT_EVENTS);

export const DICETHRONE_AUDIO_CONFIG: GameAudioConfig = {
    // 自动收集 DT_EVENTS 中所有 immediate/ui 策略的音效 key（零维护）
    // 额外补充非事件驱动的高频音效（骰子等由 FX 或手动播放）
    // SYS_PHASE_CHANGED 是引擎层系统事件，不在 DT_EVENTS 中，需手动补充
    criticalSounds: [
        ...collectPreloadKeys(DT_EVENTS),
        ...DICE_ROLL_KEYS,
        'dice.decks_and_cards_sound_fx_pack.dice_handling_001',
        'fantasy.gothic_fantasy_sound_fx_pack_vol.musical.drums_of_fate_002',
    ],
    bgm: [
        // --- normal 组 ---
        { key: BGM_ALPHA_KEY, name: 'Alpha', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        { key: BGM_DAUNTLESS_KEY, name: 'Dauntless', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        { key: BGM_MAGNUS_KEY, name: 'Magnus', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        { key: BGM_TERMINUS_KEY, name: 'Terminus', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        // --- battle 组 ---
        { key: BGM_INVICTUS_KEY, name: 'Invictus', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_HERCULES_KEY, name: 'Hercules', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_ZENITH_KEY, name: 'Zenith', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_GO_NOW_KEY, name: 'Go Now', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
    ],
    bgmGroups: {
        normal: [
            BGM_ALPHA_KEY,
            BGM_DAUNTLESS_KEY,
            BGM_MAGNUS_KEY,
            BGM_TERMINUS_KEY,
        ],
        battle: [
            BGM_INVICTUS_KEY,
            BGM_HERCULES_KEY,
            BGM_ZENITH_KEY,
            BGM_GO_NOW_KEY,
        ],
    },
    feedbackResolver: (event, context): SoundKey | null => {
        const runtime = context as AudioRuntimeContext<
            DiceThroneCore,
            { currentPhase: TurnPhase; isGameOver: boolean; isWinner?: boolean },
            { currentPlayerId: string }
        >;
        const { G } = runtime;
        const type = event.type;

        // ========== 特殊处理逻辑（覆盖框架默认）==========

        // DICE_ROLLED：使用自定义骰子音效选择逻辑
        if (type === 'DICE_ROLLED') {
            const results = (event as AudioEvent & { payload?: { results?: number[] } }).payload?.results ?? [];
            return pickDiceRollSoundKey(
                'dicethrone.dice_roll',
                results.length,
                { single: DICE_ROLL_SINGLE_KEY, multiple: DICE_ROLL_MULTI_KEYS },
                { minGap: 1 }
            );
        }

        // CARD_PLAYED：检查卡牌自带音效
        if (type === 'CARD_PLAYED') {
            const cardId = (event as AudioEvent & { payload?: { cardId?: string } }).payload?.cardId;
            const card = findCardById(G, cardId);
            const hasEffectSfx = card?.effects?.some(effect => effect.sfxKey);
            if (hasEffectSfx) return null;
            return card?.sfxKey ?? DT_EVENTS.CARD_PLAYED.sound;
        }

        // CHARACTER_SELECTED / PLAYER_READY / HOST_STARTED：UI 层已播放，跳过 EventStream
        const eventPlayerId = (event as AudioEvent & { payload?: { playerId?: string } }).payload?.playerId;
        const currentPlayerId = runtime.meta?.currentPlayerId;

        if (type === 'CHARACTER_SELECTED') {
            // 角色选择音效：本地玩家由 UI 层播放（即时反馈），远程玩家不播放（选角是本地操作）
            if (!currentPlayerId) {
                return null;
            }
            if (eventPlayerId && currentPlayerId && eventPlayerId === currentPlayerId) {
                return null;
            }
            // 其他玩家选角时也不播放音效（选角是本地操作，不需要提示其他玩家）
            return null;
        }

        if (type === 'PLAYER_READY') {
            // 自己点击 Ready 时已在本地按钮播放点击音，事件音仅用于提示"其他玩家已准备"
            if (!currentPlayerId) {
                return null;
            }
            if (eventPlayerId && currentPlayerId && eventPlayerId === currentPlayerId) {
                return null;
            }
            return 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
        }

        if (type === 'HOST_STARTED') {
            // Host 自己点击开始时已在本地按钮播放点击音，事件音仅用于提示"他人已开始"
            if (!currentPlayerId) {
                return null;
            }
            if (eventPlayerId && currentPlayerId && eventPlayerId === currentPlayerId) {
                return null;
            }
            // 开始游戏使用回合开始音效（开始游戏本质也是开始回合）
            return 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
        }

        // SYS_PHASE_CHANGED：特殊处理开局阶段切换
        if (type === 'SYS_PHASE_CHANGED') {
            const phasePayload = (event as AudioEvent & { payload?: { from?: string; to?: string } }).payload;
            const phaseFrom = phasePayload?.from;

            // 开局从 setup 自动连推到主阶段时，避免与"开始对局"提示音叠加造成一次点击多次响
            if (phaseFrom === 'setup') {
                return null;
            }
            if (G.turnNumber === 1 && (phaseFrom === 'upkeep' || phaseFrom === 'income')) {
                return null;
            }
            return 'fantasy.gothic_fantasy_sound_fx_pack_vol.musical.drums_of_fate_002';
        }

        // ABILITY_ACTIVATED：技能激活时不播放音效
        // 技能音效由 FX 系统在攻击动画 onImpact 时播放（useAnimationEffects.findAbilitySfxKey）
        if (type === 'ABILITY_ACTIVATED') {
            return null;
        }

        // ATTACK_INITIATED：总是播放攻击发起音效（挥剑音效）
        // 技能专属音效在伤害动画 onImpact 时播放，不在这里播放
        // 不需要特殊处理，直接回退到框架默认音效

        // RESPONSE_WINDOW_OPENED / RESPONSE_WINDOW_CLOSED：只有响应者才播放音效
        // 避免暴露对方有响应牌的信息（信息隐藏原则）
        if (type === 'RESPONSE_WINDOW_OPENED' || type === 'RESPONSE_WINDOW_CLOSED') {
            const payload = (event as AudioEvent & { payload?: { responderQueue?: string[] } }).payload;
            const responderQueue = payload?.responderQueue ?? [];
            const isResponder = currentPlayerId && responderQueue.includes(currentPlayerId);
            // 只有自己在响应者队列中时才播放音效
            if (!isResponder) return null;
            // 回退到框架默认音效
        }

        // ========== 使用框架自动生成的默认音效 ==========
        return baseDtFeedbackResolver(event);
    },
    bgmRules: [
        {
            when: (context) => {
                const { currentPhase } = context.ctx as { currentPhase?: TurnPhase };
                return currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll' || currentPhase === 'defensiveRoll';
            },
            key: BGM_INVICTUS_KEY,
            group: 'battle',
        },
        {
            when: () => true,
            key: BGM_ALPHA_KEY,
            group: 'normal',
        },
    ],
    stateTriggers: [
        {
            condition: (prev, next) => {
                const prevOver = (prev.ctx as { isGameOver?: boolean }).isGameOver;
                const nextOver = (next.ctx as { isGameOver?: boolean }).isGameOver;
                return !prevOver && !!nextOver;
            },
            resolveSound: (_prev, next) => {
                const isWinner = (next.ctx as { isWinner?: boolean }).isWinner;
                return isWinner
                    ? 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win'
                    : 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';
            },
        },
    ],
    contextualPreloadKeys: (context) => {
        const core = context.G as DiceThroneCore | undefined;
        if (!core) return [];
        const selected = new Set<SelectableCharacterId>();
        for (const charId of Object.values(core.selectedCharacters ?? {})) {
            if (charId && charId !== 'unselected') {
                selected.add(charId as SelectableCharacterId);
            }
        }
        if (selected.size === 0) return [];

        const keys = new Set<string>();

        // 通用战斗音效（选角后立即预加载，消除首次攻击延迟）
        const MELEE_LIGHT_KEYS = [
            'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_small_1',
            'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1',
        ];
        const MELEE_HEAVY_KEYS = [
            'fantasy.dark_sword_whoosh_01',
            'fantasy.dark_sword_whoosh_02',
            'fantasy.dark_sword_whoosh_03',
        ];
        const DAMAGE_HEAVY_KEY = 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_01_krst';
        const DAMAGE_LIGHT_KEY = 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
        const UNIT_DESTROY_KEY = 'combat.general.fight_fury_vol_2.body_hitting_the_ground_with_blood.fghtbf_body_hitting_the_ground_with_blood_01_krst';

        MELEE_LIGHT_KEYS.forEach(key => keys.add(key));
        MELEE_HEAVY_KEYS.forEach(key => keys.add(key));
        keys.add(DAMAGE_HEAVY_KEY);
        keys.add(DAMAGE_LIGHT_KEY);
        keys.add(UNIT_DESTROY_KEY);

        // 已选角色的专属音效（技能 + Token）
        for (const charId of selected) {
            const data = CHARACTER_DATA_MAP[charId];
            if (!data) continue;
            // 技能 sfxKey
            for (const ability of data.abilities) {
                if (ability.sfxKey) keys.add(ability.sfxKey);
            }
            // Token sfxKey
            for (const token of data.tokens) {
                if (token.sfxKey) keys.add(token.sfxKey);
            }
        }

        return Array.from(keys);
    },
};

const findCardById = (state: DiceThroneCore, cardId?: string) => {
    if (!cardId) return undefined;
    const players = state.players ?? {};
    for (const player of Object.values(players)) {
        const card = player.hand.find(c => c.id === cardId)
            ?? player.deck.find(c => c.id === cardId)
            ?? player.discard.find(c => c.id === cardId);
        if (card) return card;
    }
    return findHeroCard(cardId);
};

const findAbilityById = (state: DiceThroneCore, abilityId?: string) => {
    if (!abilityId) return null;
    const players = state.players ?? {};
    for (const playerId of Object.keys(players)) {
        const match = findPlayerAbility(state, playerId, abilityId);
        if (match) return match;
    }
    return null;
};
