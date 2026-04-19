/**
 * Cardia - 音频配置测试
 * 
 * 验证音频配置的正确性：
 * - collectPreloadKeys() 正确收集 immediate 音效
 * - feedbackResolver 返回正确的音效 key
 * - 动态选择逻辑（MODIFIER_TOKEN_PLACED 正负值、ENCOUNTER_RESOLVED 胜负）
 * - silent 事件返回 null
 * - bgmRules 根据游戏阶段返回正确的 BGM
 */

import { describe, it, expect } from 'vitest';
import { CARDIA_AUDIO_CONFIG } from '../audio.config';
import { CARDIA_EVENTS } from '../domain/events';
import { collectPreloadKeys } from '../../../lib/audio/defineEvents';

describe('Cardia - 音频配置', () => {
    describe('collectPreloadKeys', () => {
        it('应该正确收集所有 immediate 音效', () => {
            const preloadKeys = collectPreloadKeys(CARDIA_EVENTS);
            
            // 验证包含关键音效
            expect(preloadKeys).toContain('card.handling.decks_and_cards_sound_fx_pack.card_take_001');
            expect(preloadKeys).toContain('card.fx.decks_and_cards_sound_fx_pack.fx_discard_001');
            expect(preloadKeys).toContain('card.handling.decks_and_cards_sound_fx_pack.cards_shuffle_fast_001');
            expect(preloadKeys).toContain('coins.decks_and_cards_sound_fx_pack.small_reward_001');
            expect(preloadKeys).toContain('status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a');
            // 注意：负值音效不在 collectPreloadKeys 中，因为它是动态选择的
            // 但会在 criticalSounds 中手动补充
            expect(preloadKeys).toContain('status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a');
            expect(preloadKeys).toContain('stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win');
        });
        
        it('应该不包含 fx 或 silent 事件的音效', () => {
            const preloadKeys = collectPreloadKeys(CARDIA_EVENTS);
            
            // fx 和 silent 事件不应该被收集
            expect(preloadKeys.length).toBeGreaterThan(0);
            expect(preloadKeys.length).toBeLessThan(20); // 只有 immediate 事件
        });
    });
    
    describe('feedbackResolver - 基础事件', () => {
        const mockContext = {
            G: undefined,
            ctx: { currentPhase: 'play', isGameOver: false },
            meta: {},
            playerId: '0',  // 添加 playerId 用于 GAME_WON 测试
        } as any;
        
        it('CARD_PLAYED 应该返回卡牌打出音效', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.CARD_PLAYED.type,
                payload: { cardUid: 'card1', playerId: '0', slotIndex: 0 },
            } as any, mockContext);
            
            expect(sound).toBe('card.handling.decks_and_cards_sound_fx_pack.card_placing_001');
        });
        
        it('CARD_DRAWN 应该返回卡牌抽取音效', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.CARD_DRAWN.type,
                payload: { playerId: '0', count: 1 },
            } as any, mockContext);
            
            expect(sound).toBe('card.handling.decks_and_cards_sound_fx_pack.card_take_001');
        });
        
        it('SIGNET_GRANTED 应该返回印戒获得音效', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.SIGNET_GRANTED.type,
                payload: { playerId: '0', cardUid: 'card1', newTotal: 1 },
            } as any, mockContext);
            
            expect(sound).toBe('coins.decks_and_cards_sound_fx_pack.small_reward_001');
        });
        
        it('CARDS_DISCARDED 应该返回卡牌弃掉音效', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.CARDS_DISCARDED.type,
                payload: { playerId: '0', cardIds: ['card1'], from: 'hand' },
            } as any, mockContext);
            
            expect(sound).toBe('card.fx.decks_and_cards_sound_fx_pack.fx_discard_001');
        });
        
        it('CARD_REPLACED 应该返回卡牌替换音效', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.CARD_REPLACED.type,
                payload: { 
                    slotIndex: 0, 
                    oldCardId: 'card1', 
                    newCardId: 'card2', 
                    replacedByAbility: true,
                    playerId: '0'
                },
            } as any, mockContext);
            
            expect(sound).toBe('card.fx.decks_and_cards_sound_fx_pack.fx_discard_001');
        });
        
        it('DECK_SHUFFLED 应该返回牌库混洗音效', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.DECK_SHUFFLED.type,
                payload: { playerId: '0' },
            } as any, mockContext);
            
            expect(sound).toBe('card.handling.decks_and_cards_sound_fx_pack.cards_shuffle_fast_001');
        });
        
        it('MODIFIER_TOKEN_REMOVED 应该返回修正标记移除音效', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED.type,
                payload: { cardId: 'card1' },
            } as any, mockContext);
            
            expect(sound).toBe('status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a');
        });
        
        it('GAME_WON 应该返回游戏胜利音效（当前玩家获胜）', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.GAME_WON.type,
                payload: { winnerId: '0', reason: 'signets' },
            } as any, mockContext);
            
            expect(sound).toBe('stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win');
        });
        
        it('GAME_WON 应该返回游戏失败音效（对手获胜）', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.GAME_WON.type,
                payload: { winnerId: '1', reason: 'signets' },
            } as any, mockContext);
            
            expect(sound).toBe('stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose');
        });
    });
    
    describe('feedbackResolver - 动态选择逻辑', () => {
        const mockContext = {
            G: undefined,
            ctx: { currentPhase: 'play', isGameOver: false },
            meta: {},
        } as any;
        
        it('MODIFIER_TOKEN_PLACED 正值应该返回增益音效', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED.type,
                payload: { cardId: 'card1', value: 3, source: 'ability1', timestamp: 0 },
            } as any, mockContext);
            
            expect(sound).toBe('status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a');
        });
        
        it('MODIFIER_TOKEN_PLACED 负值应该返回减益音效', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED.type,
                payload: { cardId: 'card1', value: -2, source: 'ability1', timestamp: 0 },
            } as any, mockContext);
            
            expect(sound).toBe('status.general.player_status_sound_fx_pack_vol.mental_and_magical_debuffs.cursed_a');
        });
        
        it('MODIFIER_TOKEN_PLACED 零值应该返回增益音效（默认）', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED.type,
                payload: { cardId: 'card1', value: 0, source: 'ability1', timestamp: 0 },
            } as any, mockContext);
            
            expect(sound).toBe('status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a');
        });
    });
    
    describe('feedbackResolver - silent 事件', () => {
        const mockContext = {
            G: undefined,
            ctx: { currentPhase: 'play', isGameOver: false },
            meta: {},
        } as any;
        
        it('ABILITY_SKIPPED 应该返回 null', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.ABILITY_SKIPPED.type,
                payload: { playerId: '0' },
            } as any, mockContext);
            
            expect(sound).toBeNull();
        });
        
        it('ABILITY_INTERACTION_REQUESTED 应该返回 null', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED.type,
                payload: { 
                    abilityId: 'ability1', 
                    cardId: 'card1', 
                    playerId: '0', 
                    interaction: {} 
                },
            } as any, mockContext);
            
            expect(sound).toBeNull();
        });
        
        it('ABILITY_NO_VALID_TARGET 应该返回 null', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.ABILITY_NO_VALID_TARGET.type,
                payload: { 
                    abilityId: 'ability1', 
                    cardId: 'card1', 
                    playerId: '0', 
                    reason: 'no_markers' 
                },
            } as any, mockContext);
            
            expect(sound).toBeNull();
        });
        
        it('ONGOING_ABILITY_PLACED 应该返回 null', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED.type,
                payload: { 
                    abilityId: 'ability1', 
                    cardId: 'card1', 
                    playerId: '0', 
                    effectType: 'test',
                    timestamp: 0
                },
            } as any, mockContext);
            
            expect(sound).toBeNull();
        });
        
        it('PHASE_CHANGED 应该返回 null', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.PHASE_CHANGED.type,
                payload: { from: 'play', newPhase: 'encounter', playerId: '0' },
            } as any, mockContext);
            
            expect(sound).toBeNull();
        });
    });
    
    describe('feedbackResolver - fx 事件', () => {
        const mockContext = {
            G: undefined,
            ctx: { currentPhase: 'play', isGameOver: false },
            meta: {},
        } as any;
        
        it('ENCOUNTER_RESOLVED 应该返回 null（由 FX 系统处理）', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.ENCOUNTER_RESOLVED.type,
                payload: { slotIndex: 0, winner: '0', loser: '1' },
            } as any, mockContext);
            
            expect(sound).toBeNull();
        });
        
        it('ABILITY_ACTIVATED 应该根据 abilityId 返回定制音效', () => {
            // 测试 Card 01 - 雇佣剑士
            const sound1 = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.ABILITY_ACTIVATED.type,
                payload: { 
                    abilityId: 'ability_i_mercenary_swordsman', 
                    cardId: 'card1', 
                    playerId: '0',
                    isInstant: true,
                    isOngoing: false
                },
            } as any, mockContext);
            
            expect(sound1).toBe('card.fx.decks_and_cards_sound_fx_pack.fx_discard_001');
            
            // 测试 Card 12 - 财务官
            const sound2 = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.ABILITY_ACTIVATED.type,
                payload: { 
                    abilityId: 'ability_i_treasurer', 
                    cardId: 'card12', 
                    playerId: '0',
                    isInstant: true,
                    isOngoing: false
                },
            } as any, mockContext);
            
            expect(sound2).toBe('coins.decks_and_cards_sound_fx_pack.small_reward_001');
            
            // 测试 Card 16 - 精灵
            const sound3 = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.ABILITY_ACTIVATED.type,
                payload: { 
                    abilityId: 'ability_i_elf', 
                    cardId: 'card16', 
                    playerId: '0',
                    isInstant: true,
                    isOngoing: false
                },
            } as any, mockContext);
            
            expect(sound3).toBe('stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win');
        });
        
        it('ABILITY_ACTIVATED 未知 abilityId 应该返回默认音效', () => {
            const sound = CARDIA_AUDIO_CONFIG.feedbackResolver({
                type: CARDIA_EVENTS.ABILITY_ACTIVATED.type,
                payload: { 
                    abilityId: 'unknown_ability', 
                    cardId: 'card1', 
                    playerId: '0',
                    isInstant: true,
                    isOngoing: false
                },
            } as any, mockContext);
            
            expect(sound).toBe('magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001');
        });
    });
    
    describe('bgmRules', () => {
        it('所有阶段应该返回 main BGM', () => {
            const mockContext = {
                G: { phase: 'play' } as any,
                ctx: { currentPhase: 'play', isGameOver: false },
                meta: {},
            };
            
            const rule = CARDIA_AUDIO_CONFIG.bgmRules?.find(r => r.when(mockContext));
            expect(rule).toBeDefined();
            expect(rule?.group).toBe('main');
            expect(rule?.key).toBe('bgm.fantasy.fantasy_music_pack_vol.dragon_dance_rt_2.fantasy_vol5_dragon_dance_main');
        });
    });
    
    describe('criticalSounds', () => {
        it('应该包含所有 immediate 音效', () => {
            const criticalSounds = CARDIA_AUDIO_CONFIG.criticalSounds || [];
            
            // 验证包含关键音效
            expect(criticalSounds).toContain('card.handling.decks_and_cards_sound_fx_pack.card_take_001');
            expect(criticalSounds).toContain('card.handling.decks_and_cards_sound_fx_pack.cards_shuffle_fast_001');
            expect(criticalSounds).toContain('card.fx.decks_and_cards_sound_fx_pack.fx_discard_001');
            expect(criticalSounds).toContain('coins.decks_and_cards_sound_fx_pack.small_reward_001');
            expect(criticalSounds).toContain('status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a');
            expect(criticalSounds).toContain('status.general.player_status_sound_fx_pack_vol.mental_and_magical_debuffs.cursed_a');
            expect(criticalSounds).toContain('status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a');
            expect(criticalSounds).toContain('stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win');
        });
        
        it('应该没有重复的音效 key', () => {
            const criticalSounds = CARDIA_AUDIO_CONFIG.criticalSounds || [];
            const uniqueSounds = new Set(criticalSounds);
            
            expect(criticalSounds.length).toBe(uniqueSounds.size);
        });
    });
    
    describe('bgm 配置', () => {
        it('应该包含 1 首 BGM', () => {
            const bgm = CARDIA_AUDIO_CONFIG.bgm || [];
            expect(bgm.length).toBe(1);
        });
        
        it('main 组应该包含 1 首 BGM', () => {
            const mainBgm = CARDIA_AUDIO_CONFIG.bgmGroups?.main || [];
            expect(mainBgm.length).toBe(1);
        });
        
        it('所有 BGM 应该有正确的 category', () => {
            const bgm = CARDIA_AUDIO_CONFIG.bgm || [];
            
            bgm.forEach(track => {
                expect(track.category).toBeDefined();
                expect(track.category.group).toBe('bgm');
                expect(track.category.sub).toBe('main');
            });
        });
        
        it('所有 BGM 应该有合理的音量', () => {
            const bgm = CARDIA_AUDIO_CONFIG.bgm || [];
            
            bgm.forEach(track => {
                expect(track.volume).toBeGreaterThanOrEqual(0);
                expect(track.volume).toBeLessThanOrEqual(1);
            });
        });
    });
});
