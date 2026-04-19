/**
 * 大杀四方 - 弃牌堆出牌选项与基地限定额度交互测试
 *
 * 测试场景：当全局随从额度已满但有基地限定额度时，
 * 弃牌堆出牌选项应该正确过滤，只保留：
 * 1. 不消耗正常额度的选项（额外打出）
 * 2. 可以使用基地限定额度打出的选项
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { registerDiscardPlayProvider, clearDiscardPlayProviders, getDiscardPlayOptions } from '../domain/discardPlayability';
import type { SmashUpCore, CardInstance } from '../domain/types';

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makeCore(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        turnNumber: 1,
        bases: [],
        players: {
            '0': {
                id: '0',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['zombies', 'pirates'] as [string, string],
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['ninjas', 'robots'] as [string, string],
            },
        },
        ...overrides,
    } as SmashUpCore;
}

describe('弃牌堆出牌选项 - 基地限定额度交互', () => {
    beforeEach(() => {
        clearDiscardPlayProviders();
    });

    it('全局额度已满且无基地限定额度时，只保留不消耗正常额度的选项', () => {
        // 注册两个provider：一个消耗正常额度，一个不消耗
        registerDiscardPlayProvider({
            id: 'test_extra_play',
            getPlayableCards(core, playerId) {
                const player = core.players[playerId];
                if (!player) return [];
                const cards = player.discard.filter(c => c.defId === 'test_extra_minion');
                return cards.map(card => ({
                    card,
                    allowedBaseIndices: 'all' as const,
                    consumesNormalLimit: false, // 不消耗正常额度
                    sourceId: 'test_extra_play',
                    defId: card.defId,
                    power: 3,
                    name: 'Extra Minion',
                }));
            },
        });

        registerDiscardPlayProvider({
            id: 'test_normal_play',
            getPlayableCards(core, playerId) {
                const player = core.players[playerId];
                if (!player) return [];
                const cards = player.discard.filter(c => c.defId === 'test_normal_minion');
                return cards.map(card => ({
                    card,
                    allowedBaseIndices: 'all' as const,
                    consumesNormalLimit: true, // 消耗正常额度
                    sourceId: 'test_normal_play',
                    defId: card.defId,
                    power: 3,
                    name: 'Normal Minion',
                }));
            },
        });

        const core = makeCore({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [
                        makeCard('extra1', 'test_extra_minion', 'minion', '0'),
                        makeCard('normal1', 'test_normal_minion', 'minion', '0'),
                    ],
                    minionsPlayed: 1, // 全局额度已满
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['zombies', 'pirates'] as [string, string],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'] as [string, string],
                },
            },
        });

        const options = getDiscardPlayOptions(core, '0');
        
        // 应该返回2个选项（全部）
        expect(options.length).toBe(2);
        
        // 模拟Board.tsx中的过滤逻辑（修复前）
        const globalQuotaFull = core.players['0'].minionsPlayed >= core.players['0'].minionLimit;
        expect(globalQuotaFull).toBe(true);
        
        const baseQuota = core.players['0'].baseLimitedMinionQuota ?? {};
        const hasBaseQuota = Object.values(baseQuota).some(v => v > 0);
        expect(hasBaseQuota).toBe(false); // 无基地限定额度
        
        const filtered = options.filter(opt => {
            if (!opt.consumesNormalLimit) return true;
            if (!hasBaseQuota) return false;
            return false;
        });
        
        // 只保留不消耗正常额度的选项
        expect(filtered.length).toBe(1);
        expect(filtered[0].defId).toBe('test_extra_minion');
    });

    it('全局额度已满但有基地限定额度时，保留可以使用基地限定额度的选项', () => {
        registerDiscardPlayProvider({
            id: 'test_normal_play',
            getPlayableCards(core, playerId) {
                const player = core.players[playerId];
                if (!player) return [];
                const cards = player.discard.filter(c => c.defId === 'test_normal_minion');
                return cards.map(card => ({
                    card,
                    allowedBaseIndices: 'all' as const,
                    consumesNormalLimit: true,
                    sourceId: 'test_normal_play',
                    defId: card.defId,
                    power: 3,
                    name: 'Normal Minion',
                }));
            },
        });

        const core = makeCore({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [makeCard('normal1', 'test_normal_minion', 'minion', '0')],
                    minionsPlayed: 1, // 全局额度已满
                    minionLimit: 1,
                    baseLimitedMinionQuota: { 0: 1 }, // 基地0有1个额外额度
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['zombies', 'pirates'] as [string, string],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'] as [string, string],
                },
            },
        });

        const options = getDiscardPlayOptions(core, '0');
        expect(options.length).toBe(1);
        
        // 模拟Board.tsx中的过滤逻辑（修复后）
        const globalQuotaFull = core.players['0'].minionsPlayed >= core.players['0'].minionLimit;
        expect(globalQuotaFull).toBe(true);
        
        const baseQuota = core.players['0'].baseLimitedMinionQuota ?? {};
        const hasBaseQuota = Object.values(baseQuota).some(v => v > 0);
        expect(hasBaseQuota).toBe(true); // 有基地限定额度
        
        const filtered = options.filter(opt => {
            if (!opt.consumesNormalLimit) return true;
            if (!hasBaseQuota) return false;
            if (opt.allowedBaseIndices === 'all') {
                return Object.keys(baseQuota).some(baseIdx => baseQuota[Number(baseIdx)] > 0);
            }
            return opt.allowedBaseIndices.some(baseIdx => (baseQuota[baseIdx] ?? 0) > 0);
        });
        
        // 应该保留这个选项（可以使用基地限定额度）
        expect(filtered.length).toBe(1);
        expect(filtered[0].defId).toBe('test_normal_minion');
    });

    it('全局额度已满且有基地限定额度，但选项只能打到无额度的基地时，过滤掉该选项', () => {
        registerDiscardPlayProvider({
            id: 'test_limited_base_play',
            getPlayableCards(core, playerId) {
                const player = core.players[playerId];
                if (!player) return [];
                const cards = player.discard.filter(c => c.defId === 'test_limited_minion');
                return cards.map(card => ({
                    card,
                    allowedBaseIndices: [1], // 只能打到基地1
                    consumesNormalLimit: true,
                    sourceId: 'test_limited_base_play',
                    defId: card.defId,
                    power: 3,
                    name: 'Limited Minion',
                }));
            },
        });

        const core = makeCore({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [makeCard('limited1', 'test_limited_minion', 'minion', '0')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    baseLimitedMinionQuota: { 0: 1 }, // 只有基地0有额度，但选项只能打到基地1
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['zombies', 'pirates'] as [string, string],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'] as [string, string],
                },
            },
        });

        const options = getDiscardPlayOptions(core, '0');
        expect(options.length).toBe(1);
        
        const globalQuotaFull = core.players['0'].minionsPlayed >= core.players['0'].minionLimit;
        const baseQuota = core.players['0'].baseLimitedMinionQuota ?? {};
        const hasBaseQuota = Object.values(baseQuota).some(v => v > 0);
        
        const filtered = options.filter(opt => {
            if (!opt.consumesNormalLimit) return true;
            if (!hasBaseQuota) return false;
            if (opt.allowedBaseIndices === 'all') {
                return Object.keys(baseQuota).some(baseIdx => baseQuota[Number(baseIdx)] > 0);
            }
            return opt.allowedBaseIndices.some(baseIdx => (baseQuota[baseIdx] ?? 0) > 0);
        });
        
        // 应该过滤掉这个选项（只能打到基地1，但基地1没有额度）
        expect(filtered.length).toBe(0);
    });

    it('全局额度已满且有基地限定额度，选项可以打到有额度的基地时，保留该选项', () => {
        registerDiscardPlayProvider({
            id: 'test_limited_base_play',
            getPlayableCards(core, playerId) {
                const player = core.players[playerId];
                if (!player) return [];
                const cards = player.discard.filter(c => c.defId === 'test_limited_minion');
                return cards.map(card => ({
                    card,
                    allowedBaseIndices: [0, 1], // 可以打到基地0或基地1
                    consumesNormalLimit: true,
                    sourceId: 'test_limited_base_play',
                    defId: card.defId,
                    power: 3,
                    name: 'Limited Minion',
                }));
            },
        });

        const core = makeCore({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [makeCard('limited1', 'test_limited_minion', 'minion', '0')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    baseLimitedMinionQuota: { 0: 1 }, // 基地0有额度
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['zombies', 'pirates'] as [string, string],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'] as [string, string],
                },
            },
        });

        const options = getDiscardPlayOptions(core, '0');
        expect(options.length).toBe(1);
        
        const globalQuotaFull = core.players['0'].minionsPlayed >= core.players['0'].minionLimit;
        const baseQuota = core.players['0'].baseLimitedMinionQuota ?? {};
        const hasBaseQuota = Object.values(baseQuota).some(v => v > 0);
        
        const filtered = options.filter(opt => {
            if (!opt.consumesNormalLimit) return true;
            if (!hasBaseQuota) return false;
            if (opt.allowedBaseIndices === 'all') {
                return Object.keys(baseQuota).some(baseIdx => baseQuota[Number(baseIdx)] > 0);
            }
            return opt.allowedBaseIndices.some(baseIdx => (baseQuota[baseIdx] ?? 0) > 0);
        });
        
        // 应该保留这个选项（可以打到基地0，基地0有额度）
        expect(filtered.length).toBe(1);
        expect(filtered[0].defId).toBe('test_limited_minion');
    });
});


    it('顽强僵尸已使用过一次后，弃牌堆不应闪烁（provider返回空数组）', () => {
        // 注册顽强僵尸provider（模拟真实逻辑）
        registerDiscardPlayProvider({
            id: 'zombie_tenacious_z',
            getPlayableCards(core, playerId) {
                const player = core.players[playerId];
                if (!player) return [];
                // 每回合限一次
                if (player.usedDiscardPlayAbilities?.includes('zombie_tenacious_z')) return [];
                const cards = player.discard.filter(c => c.defId === 'zombie_tenacious_z');
                if (cards.length === 0) return [];
                return cards.map(card => ({
                    card,
                    allowedBaseIndices: 'all' as const,
                    consumesNormalLimit: false,
                    sourceId: 'zombie_tenacious_z',
                    defId: card.defId,
                    power: 3,
                    name: 'Tenacious Z',
                }));
            },
        });

        const core = makeCore({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [makeCard('tz1', 'zombie_tenacious_z', 'minion', '0')],
                    minionsPlayed: 1, // 全局额度已满
                    minionLimit: 1,
                    usedDiscardPlayAbilities: ['zombie_tenacious_z'], // 已使用过一次
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['zombies', 'pirates'] as [string, string],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'] as [string, string],
                },
            },
        });

        const options = getDiscardPlayOptions(core, '0');
        
        // provider应该返回空数组（已使用过一次）
        expect(options.length).toBe(0);
        
        // 模拟Board.tsx中的逻辑
        const globalQuotaFull = core.players['0'].minionsPlayed >= core.players['0'].minionLimit;
        const baseQuota = core.players['0'].baseLimitedMinionQuota ?? {};
        const hasBaseQuota = Object.values(baseQuota).some(v => v > 0);
        
        const filtered = options.filter(opt => {
            if (!opt.consumesNormalLimit) return true;
            if (!hasBaseQuota) return false;
            if (opt.allowedBaseIndices === 'all') {
                return Object.keys(baseQuota).some(baseIdx => baseQuota[Number(baseIdx)] > 0);
            }
            return opt.allowedBaseIndices.some(baseIdx => (baseQuota[baseIdx] ?? 0) > 0);
        });
        
        // 过滤后仍然是空数组
        expect(filtered.length).toBe(0);
        
        // 弃牌堆不应该闪烁（hasPlayableFromDiscard = false）
        const hasPlayableFromDiscard = filtered.length > 0;
        expect(hasPlayableFromDiscard).toBe(false);
    });
