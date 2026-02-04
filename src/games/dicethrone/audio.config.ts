/**
 * DiceThrone 音频配置
 * 仅定义游戏特有的音效（战斗、BGM），通用音效由 common.config.ts 提供
 */
import type { AudioEvent, AudioRuntimeContext, GameAudioConfig } from '../../lib/audio/types';
import { pickRandomSoundKey } from '../../lib/audio/audioUtils';
import { findPlayerAbility } from './domain/abilityLookup';
import type { DiceThroneCore, TurnPhase } from './domain/types';
import { MONK_CARDS } from './monk/cards';

// 游戏特有音效资源路径（战斗、BGM）
const SFX_BASE = 'dicethrone/audio';

export const DICETHRONE_AUDIO_CONFIG: GameAudioConfig = {
    basePath: SFX_BASE,

    sounds: {
        // ============ 战斗音效（Monk 拳脚，游戏特有） ============
        attack_punch: { src: 'fight/compressed/WHSH_Punch_Whooosh_01.ogg', volume: 0.8, category: { group: 'combat', sub: 'punch' } },
        attack_kick: { src: 'fight/compressed/SFX_Fight_Kick_Swoosh_1.ogg', volume: 0.8, category: { group: 'combat', sub: 'kick' } },
        attack_hit: { src: 'fight/compressed/FGHTImpt_Versatile_Punch_Hit_01.ogg', volume: 0.9, category: { group: 'combat', sub: 'hit' } },
        attack_hit_heavy: { src: 'fight/compressed/FGHTImpt_Special_Hit_01.ogg', volume: 1.0, category: { group: 'combat', sub: 'hit_heavy' } },
        attack_start: { src: 'fight/compressed/SFX_Weapon_Melee_Swoosh_Sword_1.ogg', volume: 0.85, category: { group: 'combat', sub: 'start' } },
        attack_resolve: { src: 'fight/compressed/FGHTImpt_Special_Hit_02.ogg', volume: 0.9, category: { group: 'combat', sub: 'resolve' } },
        ability_activate: { src: 'fight/compressed/SFX_Weapon_Melee_Swoosh_Small_1.ogg', volume: 0.7, category: { group: 'combat', sub: 'ability' } },
        transcendence_ultimate: { src: 'fight/compressed/FGHTImpt_Special_Hit_02.ogg', volume: 1.0, category: { group: 'combat', sub: 'ultimate' } },
        thunder_strike: { src: 'fight/compressed/FGHTImpt_Versatile_Punch_Hit_01.ogg', volume: 0.9, category: { group: 'combat', sub: 'heavy_attack' } },
        taiji_combo: { src: 'fight/compressed/SFX_Fight_Kick_Swoosh_1.ogg', volume: 0.85, category: { group: 'combat', sub: 'combo' } },
        damage_prevented: { src: 'fight/compressed/Shield_Impact_A.ogg', volume: 0.75, category: { group: 'combat', sub: 'shield' } },
        damage_dealt: { src: 'fight/compressed/SFX_Body_Hit_Generic_Small_1.ogg', volume: 0.8, category: { group: 'combat', sub: 'damage' } },
    },

    bgm: [
        {
            key: 'battle',
            name: 'Dragon Dance',
            src: 'music/compressed/Fantasy Vol5 Dragon Dance Main.ogg',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: 'battle_intense',
            name: 'Shields and Spears',
            src: 'music/compressed/Fantasy Vol5 Shields and Spears Main.ogg',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
    ],
    // 游戏特有事件映射（通用事件由 common.config.ts 提供）
    eventSoundMap: {
        // 战斗事件（游戏特有）
        DAMAGE_PREVENTED: 'damage_prevented',
        ATTACK_INITIATED: 'attack_start',
        ATTACK_RESOLVED: 'attack_resolve',
    },
    eventSoundResolver: (event, context) => {
        const runtime = context as AudioRuntimeContext<
            DiceThroneCore,
            { currentPhase: TurnPhase; isGameOver: boolean; isWinner?: boolean },
            { currentPlayerId: string }
        >;
        const { G, meta } = runtime;

        if (event.type === 'DICE_ROLLED') {
            const diceKeys = ['dice_roll', 'dice_roll_2', 'dice_roll_3'];
            return pickRandomSoundKey('dicethrone.dice_roll', diceKeys, { minGap: 1 });
        }

        if (event.type === 'CP_CHANGED') {
            const delta = (event as AudioEvent & { payload?: { delta?: number } }).payload?.delta ?? 0;
            return delta >= 0 ? 'cp_gain' : 'cp_spend';
        }

        if (event.type === 'CARD_PLAYED') {
            const cardId = (event as AudioEvent & { payload?: { cardId?: string } }).payload?.cardId;
            const card = findCardById(G, cardId);
            const hasEffectSfx = card?.effects?.some(effect => effect.sfxKey);
            if (hasEffectSfx) return null;
            return card?.sfxKey ?? 'card_play';
        }

        if (event.type === 'ABILITY_ACTIVATED') {
            const payload = (event as AudioEvent & { payload?: { playerId?: string; abilityId?: string; isDefense?: boolean } }).payload;
            if (!payload?.playerId || !payload?.abilityId) return undefined;
            const match = findPlayerAbility(G, payload.playerId, payload.abilityId);
            const explicitKey = match?.variant?.sfxKey ?? match?.ability?.sfxKey;
            if (payload.isDefense && !explicitKey) return null;
            return explicitKey ?? 'ability_activate';
        }

        if (event.type === 'DAMAGE_DEALT') {
            const payload = (event as AudioEvent & { payload?: { actualDamage?: number; targetId?: string } }).payload;
            const damage = payload?.actualDamage ?? 0;
            if (damage <= 0) return null;
            if (payload?.targetId && meta?.currentPlayerId && payload.targetId !== meta.currentPlayerId) {
                return damage >= 8 ? 'attack_hit_heavy' : 'attack_hit';
            }
            return 'damage_dealt';
        }

        return undefined;
    },
    bgmRules: [
        {
            when: (context) => {
                const { currentPhase } = context.ctx as { currentPhase?: TurnPhase };
                return currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
            },
            key: 'battle_intense',
        },
        {
            when: () => true,
            key: 'battle',
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
                return isWinner ? 'victory' : 'defeat';
            },
        },
    ],
};

const findCardById = (state: DiceThroneCore, cardId?: string) => {
    if (!cardId) return undefined;
    for (const player of Object.values(state.players)) {
        const card = player.hand.find(c => c.id === cardId)
            ?? player.deck.find(c => c.id === cardId)
            ?? player.discard.find(c => c.id === cardId);
        if (card) return card;
    }
    return MONK_CARDS.find(card => card.id === cardId);
};
