/**
 * DiceThrone - ActionLog 格式化测试
 * 
 * 验证 formatDiceThroneActionEntry 生成正确的 i18n segment（延迟翻译）。
 */

import { describe, expect, it } from 'vitest';
import type { ActionLogEntry, ActionLogSegment, Command, GameEvent, MatchState } from '../../../engine/types';
import type {
    AbilityActivatedEvent,
    AttackResolvedEvent,
    DamageDealtEvent,
    DiceThroneCore,
    HealAppliedEvent,
    StatusAppliedEvent,
    TokenGrantedEvent,
    TokenUsedEvent,
} from '../domain/types';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { createInitializedState, fixedRandom, fistAttackAbilityId } from './test-utils';
import { formatDiceThroneActionEntry } from '../game';

const normalizeEntries = (result: ActionLogEntry | ActionLogEntry[] | null): ActionLogEntry[] => {
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
};

const createState = (): MatchState<DiceThroneCore> => {
    return createInitializedState(['0', '1'], fixedRandom);
};

/** 从 segments 中提取所有 i18n segment 的 key */
const getI18nKeys = (segments: ActionLogSegment[]): string[] =>
    segments.filter(s => s.type === 'i18n').map(s => (s as { key: string }).key);

/** 查找指定 key 的 i18n segment */
const findI18nSegment = (segments: ActionLogSegment[], key: string) =>
    segments.find(s => s.type === 'i18n' && (s as { key: string }).key === key) as
    | { type: 'i18n'; ns: string; key: string; params?: Record<string, string | number>; paramI18nKeys?: string[] }
    | undefined;

describe('formatDiceThroneActionEntry', () => {
    it('SELECT_ABILITY 生成 i18n segment', () => {
        const state = createState();
        const command: Command = {
            type: 'SELECT_ABILITY',
            playerId: '0',
            payload: { abilityId: fistAttackAbilityId },
            timestamp: 1,
        };
        const abilityEvent: AbilityActivatedEvent = {
            type: 'ABILITY_ACTIVATED',
            payload: { abilityId: fistAttackAbilityId, playerId: '0', isDefense: false },
            timestamp: 1,
        };

        const result = formatDiceThroneActionEntry({
            command,
            state,
            events: [abilityEvent] as GameEvent[],
        });
        const entries = normalizeEntries(result);

        expect(entries).toHaveLength(1);
        const seg = entries[0].segments[0];
        expect(seg.type).toBe('i18n');
        if (seg.type === 'i18n') {
            expect(seg.ns).toBe('game-dicethrone');
            expect(seg.key).toBe('actionLog.abilityActivated');
            expect(seg.params).toHaveProperty('abilityName');
        }
    });

    it('DAMAGE_DEALT 生成 i18n segment（含原始伤害）', () => {
        const state = createState();
        const command: Command = {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: {},
            timestamp: 10,
        };
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 5,
                actualDamage: 4,
                sourceAbilityId: 'test-ability',
            },
            timestamp: 10,
        };
        const resolvedEvent: AttackResolvedEvent = {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'test-ability',
                defenseAbilityId: undefined,
                totalDamage: 4,
            },
            timestamp: 10,
        };

        const result = formatDiceThroneActionEntry({
            command,
            state,
            events: [damageEvent, resolvedEvent] as GameEvent[],
        });
        const entries = normalizeEntries(result);

        expect(entries).toHaveLength(1);
        expect(entries[0].actorId).toBe('0');
        // 统一 breakdown 模式：before + breakdown数字 + after
        const segs = entries[0].segments;
        const i18nKeys = getI18nKeys(segs);
        expect(i18nKeys).toContain('actionLog.damageBefore.dealt');
        expect(i18nKeys).toContain('actionLog.damageAfter.dealt');

        // breakdown segment 应包含来源信息
        const breakdownSeg = segs.find(s => s.type === 'breakdown');
        expect(breakdownSeg).toBeTruthy();
        if (breakdownSeg?.type === 'breakdown') {
            expect(breakdownSeg.displayText).toBe('4');
            // 无 modifiers 但有 source：显示来源名 + 数值
            expect(breakdownSeg.lines.length).toBeGreaterThanOrEqual(1);
            expect(breakdownSeg.lines[0].value).toBe(4);
            // source fallback 为 'test-ability'（技能表中找不到）
            expect(breakdownSeg.lines[0].label).toBe('test-ability');
        }
    });

    it('伤害修改器应记录在 ActionLog 中（太极减伤）', () => {
        const state = createState();
        const command: Command = {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: {},
            timestamp: 10,
        };
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 8,
                actualDamage: 5,
                sourceAbilityId: 'test-ability',
                modifiers: [
                    { type: 'token', value: -3, sourceId: 'taiji', sourceName: 'tokens.taiji.name' },
                ],
            },
            timestamp: 10,
        };
        const attackResolved: AttackResolvedEvent = {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'test-ability',
                totalDamage: 5,
            },
            timestamp: 11,
        };

        const entries = normalizeEntries(formatDiceThroneActionEntry({ 
            command, 
            state, 
            events: [damageEvent, attackResolved] as GameEvent[] 
        }));

        expect(entries).toHaveLength(1);
        const segs = entries[0].segments;
        // 有 modifiers 时使用 breakdown segment：before + breakdown + after
        const i18nKeys = getI18nKeys(segs);
        expect(i18nKeys).toContain('actionLog.damageBefore.dealt');
        expect(i18nKeys).toContain('actionLog.damageAfter.dealt');

        // 验证 breakdown segment
        const breakdownSeg = segs.find(s => s.type === 'breakdown');
        expect(breakdownSeg).toBeTruthy();
        if (breakdownSeg?.type === 'breakdown') {
            expect(breakdownSeg.displayText).toBe('5');
            expect(breakdownSeg.lines).toHaveLength(2); // 原始伤害 + 太极减伤
            expect(breakdownSeg.lines[0].value).toBe(8); // 原始伤害
            expect(breakdownSeg.lines[1].value).toBe(-3); // 太极减伤
            expect(breakdownSeg.lines[1].label).toBe('tokens.taiji.name');
        }
    });

    it('锁定（status modifier）应记录在 breakdown tooltip 中', () => {
        const state = createState();
        const command: Command = {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '0',
            payload: {},
            timestamp: 10,
        };
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                amount: 7,
                actualDamage: 7,
                sourceAbilityId: 'test-ability',
                sourcePlayerId: '0',
                modifiers: [
                    { type: 'status', value: 2, sourceId: 'targeted', sourceName: 'statusEffects.targeted.name' },
                ],
            },
            timestamp: 11,
        };

        const entries = normalizeEntries(formatDiceThroneActionEntry({
            command,
            state,
            events: [damageEvent] as GameEvent[],
        }));

        expect(entries).toHaveLength(1);
        const breakdownSeg = entries[0].segments.find(s => s.type === 'breakdown');
        expect(breakdownSeg).toBeTruthy();
        if (breakdownSeg?.type === 'breakdown') {
            expect(breakdownSeg.displayText).toBe('7');
            // 应有 2 行：原始伤害(5) + 锁定(+2)
            expect(breakdownSeg.lines).toHaveLength(2);
            expect(breakdownSeg.lines[0].value).toBe(5); // baseDamage = 7 - 2
            expect(breakdownSeg.lines[1].value).toBe(2);
            expect(breakdownSeg.lines[1].label).toBe('statusEffects.targeted.name');
            expect(breakdownSeg.lines[1].labelIsI18n).toBe(true);
        }
    });

    it('HEAL_APPLIED/STATUS_APPLIED/TOKEN_USED 生成正确的 i18n segment', () => {
        const state = createState();
        const command: Command = {
            type: 'SELECT_ABILITY',
            playerId: '0',
            payload: { abilityId: fistAttackAbilityId },
            timestamp: 20,
        };
        const healEvent: HealAppliedEvent = {
            type: 'HEAL_APPLIED',
            payload: { targetId: '0', amount: 3, sourceAbilityId: fistAttackAbilityId },
            timestamp: 20,
        };
        const statusEvent: StatusAppliedEvent = {
            type: 'STATUS_APPLIED',
            payload: { targetId: '1', statusId: STATUS_IDS.BURN, stacks: 1, newTotal: 1 },
            timestamp: 20,
        };
        const tokenEvent: TokenGrantedEvent = {
            type: 'TOKEN_GRANTED',
            payload: { targetId: '0', tokenId: TOKEN_IDS.TAIJI, amount: 1, newTotal: 2 },
            timestamp: 20,
        };
        const tokenUsedEvent: TokenUsedEvent = {
            type: 'TOKEN_USED',
            payload: { playerId: '0', tokenId: TOKEN_IDS.TAIJI, amount: 1, effectType: 'damageBoost', damageModifier: 1 },
            timestamp: 20,
        };

        const result = formatDiceThroneActionEntry({
            command,
            state,
            events: [healEvent, statusEvent, tokenEvent, tokenUsedEvent] as GameEvent[],
        });
        const entries = normalizeEntries(result);

        // SELECT_ABILITY + 4 个事件 = 5 个 entry
        expect(entries).toHaveLength(5);

        // 验证 HEAL_APPLIED（现在用 breakdown segment）
        const healEntry = entries.find(e => e.kind === 'HEAL_APPLIED');
        expect(healEntry).toBeTruthy();
        const healBeforeSeg = findI18nSegment(healEntry!.segments, 'actionLog.healBefore');
        expect(healBeforeSeg?.params?.targetPlayerId).toBe('0');
        // breakdown segment 应包含治疗来源
        const healBreakdown = healEntry!.segments.find(s => s.type === 'breakdown');
        expect(healBreakdown).toBeTruthy();
        if (healBreakdown?.type === 'breakdown') {
            expect(healBreakdown.displayText).toBe('3');
            expect(healBreakdown.lines.length).toBeGreaterThanOrEqual(1);
        }

        // 验证 STATUS_APPLIED
        const statusEntry = entries.find(e => e.kind === 'STATUS_APPLIED');
        expect(statusEntry).toBeTruthy();
        const statusSeg = findI18nSegment(statusEntry!.segments, 'actionLog.statusApplied');
        expect(statusSeg?.params?.targetPlayerId).toBe('1');

        // 验证 TOKEN_GRANTED
        const tokenEntry = entries.find(e => e.kind === 'TOKEN_GRANTED');
        expect(tokenEntry).toBeTruthy();
        const tokenSeg = findI18nSegment(tokenEntry!.segments, 'actionLog.tokenGranted');
        expect(tokenSeg?.params?.amount).toBe(1);

        // 验证 TOKEN_USED
        const tokenUsedEntry = entries.find(e => e.kind === 'TOKEN_USED');
        expect(tokenUsedEntry).toBeTruthy();
        const tokenUsedSeg = findI18nSegment(tokenUsedEntry!.segments, 'actionLog.tokenUsed');
        expect(tokenUsedSeg?.params?.effectLabel).toBe('actionLog.tokenEffect.damageBoost');
        expect(tokenUsedSeg?.paramI18nKeys).toContain('effectLabel');
    });

    it('ADVANCE_PHASE 生成带 paramI18nKeys 的 i18n segment', () => {
        const state = createState();
        const command: Command = {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: {},
            timestamp: 30,
        };
        const phaseEvent: GameEvent = {
            type: 'SYS_PHASE_CHANGED',
            payload: { to: 'offensiveRoll' },
            timestamp: 30,
        };

        const result = formatDiceThroneActionEntry({
            command,
            state,
            events: [phaseEvent],
        });
        const entries = normalizeEntries(result);

        expect(entries).toHaveLength(1);
        const seg = findI18nSegment(entries[0].segments, 'actionLog.advancePhase');
        expect(seg).toBeTruthy();
        expect(seg?.params?.phase).toBe('phase.offensiveRoll.label');
        expect(seg?.paramI18nKeys).toContain('phase');
    });

    it('效果 entries 的 timestamp 严格大于命令 entry（newest-first 排序正确）', () => {
        const state = createState();
        const command: Command = {
            type: 'PLAY_CARD',
            playerId: '0',
            payload: { cardId: 'test-card' },
            timestamp: 100,
        };
        // 模拟卡牌打出后产生治疗效果
        const healEvent: HealAppliedEvent = {
            type: 'HEAL_APPLIED',
            payload: { targetId: '0', amount: 3 },
            timestamp: 100, // 与命令相同的 timestamp
        };

        // 手动在玩家手牌中添加测试卡牌
        const testState = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    '0': {
                        ...state.core.players['0'],
                        hand: [
                            ...state.core.players['0'].hand,
                            {
                                id: 'test-card',
                                name: 'test.card.name',
                                type: 'action' as const,
                                cpCost: 0,
                                timing: 'instant' as const,
                                description: 'test',
                                previewRef: { type: 'atlas' as const, atlasId: 'test', index: 0 },
                            },
                        ],
                    },
                },
            },
        };

        const result = formatDiceThroneActionEntry({
            command,
            state: testState,
            events: [healEvent] as GameEvent[],
        });
        const entries = normalizeEntries(result);

        // 应有 2 个 entry：打出卡牌 + 治疗
        expect(entries).toHaveLength(2);
        const cardEntry = entries.find(e => e.kind === 'PLAY_CARD');
        const healEntry = entries.find(e => e.kind === 'HEAL_APPLIED');
        expect(cardEntry).toBeTruthy();
        expect(healEntry).toBeTruthy();
        // 效果 entry 的 timestamp 必须严格大于命令 entry
        expect(healEntry!.timestamp).toBeGreaterThan(cardEntry!.timestamp);
    });
});
