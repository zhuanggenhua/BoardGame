/**
 * 攻击修正指示器撤回测试
 *
 * 验证 scanActiveModifiers 函数的逻辑：
 * 1. 能正确扫描未结算的修正卡
 * 2. 撤回后能正确恢复剩余的修正卡
 * 3. 攻击结算后清空所有修正卡
 */

import React, { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { FLOW_EVENTS } from '../../../engine/systems/FlowSystem';
import { findHeroCard } from '../heroes';
import { RightSidebar } from '../ui/RightSidebar';
import type { ActiveModifier } from '../hooks/useActiveModifiers';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, string | number>) => {
            if (!options) return key;
            const params = Object.entries(options)
                .map(([paramKey, value]) => `${paramKey}=${value}`)
                .join(',');
            return `${key}:${params}`;
        },
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('framer-motion', () => {
    const motion = new Proxy({}, {
        get: (_target, tag) => {
            return ({ children, whileHover: _whileHover, whileTap: _whileTap, ...rest }: { children?: React.ReactNode; whileHover?: unknown; whileTap?: unknown }) => (
                React.createElement(tag as string, rest, children)
            );
        },
    });

    return {
        motion,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => (
            React.createElement(React.Fragment, null, children)
        ),
    };
});

// 从 useActiveModifiers 中提取的扫描函数
function isModifierResetEvent(entry: any) {
    if (entry.event.type === 'ATTACK_RESOLVED' || entry.event.type === 'TURN_CHANGED') {
        return true;
    }
    if (entry.event.type === FLOW_EVENTS.PHASE_CHANGED) {
        return entry.event.payload?.to === 'main2';
    }
    return false;
}

function scanActiveModifiers(entries: any[]) {
    let lastResolvedIndex = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
        if (isModifierResetEvent(entries[i])) {
            lastResolvedIndex = i;
            break;
        }
    }

    const modifiers: any[] = [];
    const startIndex = lastResolvedIndex + 1;
    
    for (let i = startIndex; i < entries.length; i++) {
        const entry = entries[i];
        const { type, payload } = entry.event;

        if (type === 'CARD_PLAYED') {
            const p = payload as { cardId: string };
            const card = findHeroCard(p.cardId);
            if (card && card.isAttackModifier) {
                modifiers.push({
                    cardId: p.cardId,
                    eventId: entry.id,
                });
            }
        }
    }

    return modifiers;
}

describe('攻击修正指示器撤回测试', () => {
    it('能正确扫描未结算的修正卡', () => {
        const entries = [
            { id: 1, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-more-please' } } },
            { id: 2, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-red-hot' } } },
        ];

        const modifiers = scanActiveModifiers(entries);

        expect(modifiers).toHaveLength(2);
        expect(modifiers[0].cardId).toBe('card-more-please');
        expect(modifiers[0].eventId).toBe(1);
        expect(modifiers[1].cardId).toBe('card-red-hot');
        expect(modifiers[1].eventId).toBe(2);
    });

    it('撤回后能正确恢复剩余的修正卡', () => {
        // 模拟：打出两张卡后撤回一张
        // EventStream 回退：entries 只剩第一张卡
        const entries = [
            { id: 1, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-more-please' } } },
        ];

        const modifiers = scanActiveModifiers(entries);

        expect(modifiers).toHaveLength(1);
        expect(modifiers[0].cardId).toBe('card-more-please');
        expect(modifiers[0].eventId).toBe(1);
    });

    it('攻击结算后清空所有修正卡', () => {
        const entries = [
            { id: 1, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-more-please' } } },
            { id: 2, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-red-hot' } } },
            { id: 3, event: { type: 'ATTACK_RESOLVED', payload: {} } },
        ];

        const modifiers = scanActiveModifiers(entries);

        // ATTACK_RESOLVED 之后没有修正卡
        expect(modifiers).toHaveLength(0);
    });

    it('攻击结算后打出新卡，能正确扫描', () => {
        const entries = [
            { id: 1, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-more-please' } } },
            { id: 2, event: { type: 'ATTACK_RESOLVED', payload: {} } },
            { id: 3, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-red-hot' } } },
        ];

        const modifiers = scanActiveModifiers(entries);

        // 只扫描 ATTACK_RESOLVED 之后的卡
        expect(modifiers).toHaveLength(1);
        expect(modifiers[0].cardId).toBe('card-red-hot');
        expect(modifiers[0].eventId).toBe(3);
    });

    it('忽略非攻击修正卡', () => {
        const entries = [
            { id: 1, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-more-please' } } },
            { id: 2, event: { type: 'CARD_PLAYED', payload: { cardId: 'some-non-modifier-card' } } },
        ];

        const modifiers = scanActiveModifiers(entries);

        // 只有 card-more-please 是攻击修正卡
        expect(modifiers).toHaveLength(1);
        expect(modifiers[0].cardId).toBe('card-more-please');
    });
    it('进入 main2 后应清空所有修正卡', () => {
        const entries = [
            { id: 1, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-more-please' } } },
            { id: 2, event: { type: FLOW_EVENTS.PHASE_CHANGED, payload: { to: 'main2' } } },
        ];

        const modifiers = scanActiveModifiers(entries);

        expect(modifiers).toHaveLength(0);
    });

    it('进入 defensiveRoll 时不应清空当前攻击的修正卡', () => {
        const entries = [
            { id: 1, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-red-hot' } } },
            { id: 2, event: { type: FLOW_EVENTS.PHASE_CHANGED, payload: { to: 'defensiveRoll' } } },
        ];

        const modifiers = scanActiveModifiers(entries);

        expect(modifiers).toHaveLength(1);
        expect(modifiers[0].cardId).toBe('card-red-hot');
    });

    it('回合切换后应清空所有修正卡', () => {
        const entries = [
            { id: 1, event: { type: 'CARD_PLAYED', payload: { cardId: 'card-more-please' } } },
            { id: 2, event: { type: 'TURN_CHANGED', payload: { previousPlayerId: '0', nextPlayerId: '1', turnNumber: 2 } } },
        ];

        const modifiers = scanActiveModifiers(entries);

        expect(modifiers).toHaveLength(0);
    });

    it('右侧栏应把伤害加成徽章与攻击修正徽章渲染到同一个上浮层栈', () => {
        const activeModifiers: ActiveModifier[] = [{
            cardId: 'card-red-hot',
            nameKey: 'cards.card-red-hot.name',
            descriptionKey: 'cards.card-red-hot.description',
            timestamp: 1,
            eventId: 101,
        }];

        const html = renderToStaticMarkup(
            React.createElement(RightSidebar, {
                dice: [],
                rollCount: 1,
                rollLimit: 2,
                rollConfirmed: true,
                currentPhase: 'offensiveRoll',
                canInteractDice: false,
                isRolling: false,
                setIsRolling: vi.fn(),
                rerollingDiceIds: [],
                setRerollingDiceIds: vi.fn(),
                onToggleLock: vi.fn(),
                onRoll: vi.fn(),
                onConfirm: vi.fn(),
                showAdvancePhaseButton: false,
                advanceLabel: 'advance',
                isAdvanceButtonEnabled: false,
                onAdvance: vi.fn(),
                discardPileRef: createRef<HTMLDivElement>(),
                discardCards: [],
                canUndoDiscard: false,
                onUndoDiscard: vi.fn(),
                discardHighlighted: false,
                sellButtonVisible: false,
                dispatch: vi.fn(),
                activeModifiers,
                attackModifierBonusDamage: 2,
                rootPlayerId: '0',
                teamIdByPlayerId: { '0': 'A', '1': 'B', '2': 'A', '3': 'B' },
            })
        );

        expect(html).toContain('data-testid="active-modifier-badge"');
        expect(html).toContain('data-bonus-damage="2"');
        expect(html).toContain('bottom-full');
        expect(html).toContain('relative w-[5.8vw]');
        expect(html).toContain('pointer-events-none absolute inset-x-0 bottom-full');
        expect(html).not.toContain('data-testid="attack-modifier-bonus-badge"');
        expect(html).not.toContain('-top-[2.2vw]');
        expect(html).not.toContain('-top-[3.8vw]');
    });

    it('右侧栏应显示当前总伤害，并保留原始与当前伤害数值', () => {
        const html = renderToStaticMarkup(
            React.createElement(RightSidebar, {
                dice: [],
                rollCount: 1,
                rollLimit: 2,
                rollConfirmed: true,
                currentPhase: 'defensiveRoll',
                canInteractDice: false,
                isRolling: false,
                setIsRolling: vi.fn(),
                rerollingDiceIds: [],
                setRerollingDiceIds: vi.fn(),
                onToggleLock: vi.fn(),
                onRoll: vi.fn(),
                onConfirm: vi.fn(),
                showAdvancePhaseButton: false,
                advanceLabel: 'advance',
                isAdvanceButtonEnabled: false,
                onAdvance: vi.fn(),
                discardPileRef: createRef<HTMLDivElement>(),
                discardCards: [],
                canUndoDiscard: false,
                onUndoDiscard: vi.fn(),
                discardHighlighted: false,
                sellButtonVisible: false,
                dispatch: vi.fn(),
                damageSummary: {
                    currentDamage: 7,
                    originalDamage: 5,
                },
                rootPlayerId: '0',
                teamIdByPlayerId: { '0': 'A', '1': 'B' },
            })
        );

        expect(html).toContain('data-testid="current-total-damage-badge"');
        expect(html).toContain('data-current-damage="7"');
        expect(html).toContain('data-original-damage="5"');
        expect(html).toContain('damageSummary.label');
        expect(html).toContain('damageSummary.changed:original=5,current=7');
        expect(html).toContain('data-testid="current-total-damage-badge-anchor"');
        expect(html).toContain('data-placement="dice-tray-left-top-outside"');
        expect(html).toContain('absolute right-[calc(100%+0.35vw)] top-0');
        expect(html).not.toContain('bottom-full');
        expect(html).not.toContain('right-full');
        expect(html).not.toContain('-translate-x-[0.35vw]');
        expect(html).not.toContain('-translate-y-[0.35vw]');
        expect(html).not.toContain('absolute inset-x-0 bottom-full');
    });

    it('右侧栏阶段推进按钮不可用时仍应保留显示，只禁用点击', () => {
        const html = renderToStaticMarkup(
            React.createElement(RightSidebar, {
                dice: [],
                rollCount: 0,
                rollLimit: 3,
                rollConfirmed: false,
                currentPhase: 'upkeep',
                canInteractDice: false,
                isRolling: false,
                setIsRolling: vi.fn(),
                rerollingDiceIds: [],
                setRerollingDiceIds: vi.fn(),
                onToggleLock: vi.fn(),
                onRoll: vi.fn(),
                onConfirm: vi.fn(),
                showAdvancePhaseButton: true,
                advanceLabel: 'advance',
                isAdvanceButtonEnabled: false,
                onAdvance: vi.fn(),
                discardPileRef: createRef<HTMLDivElement>(),
                discardCards: [],
                canUndoDiscard: false,
                onUndoDiscard: vi.fn(),
                discardHighlighted: false,
                sellButtonVisible: false,
                dispatch: vi.fn(),
                rootPlayerId: '0',
                teamIdByPlayerId: { '0': 'A', '1': 'B' },
            })
        );

        expect(html).toContain('data-tutorial-id="advance-phase-button"');
        expect(html).toContain('disabled=""');
        expect(html).not.toContain('invisible pointer-events-none');
    });

    it('RightSidebar 在 selectDie 交互中应根据 diceOwnerId 显示队友骰池提示', () => {
        const html = renderToStaticMarkup(
            React.createElement(RightSidebar, {
                dice: [],
                rollCount: 1,
                rollLimit: 2,
                rollConfirmed: true,
                currentPhase: 'defensiveRoll',
                canInteractDice: false,
                isRolling: false,
                setIsRolling: vi.fn(),
                rerollingDiceIds: [],
                setRerollingDiceIds: vi.fn(),
                onToggleLock: vi.fn(),
                onRoll: vi.fn(),
                onConfirm: vi.fn(),
                showAdvancePhaseButton: false,
                advanceLabel: 'advance',
                isAdvanceButtonEnabled: false,
                onAdvance: vi.fn(),
                discardPileRef: createRef<HTMLDivElement>(),
                discardCards: [],
                canUndoDiscard: false,
                onUndoDiscard: vi.fn(),
                discardHighlighted: false,
                sellButtonVisible: false,
                dispatch: vi.fn(),
                rootPlayerId: '2',
                teamIdByPlayerId: { '0': 'A', '1': 'B', '2': 'A', '3': 'B' },
                interaction: {
                    id: 'ally-select-die',
                    kind: 'multistep-choice',
                    playerId: '2',
                    title: 'ally select',
                    titleKey: 'interaction.selectDiceToReroll',
                    description: null,
                    options: [],
                    data: {
                        initialResult: { selectedDiceIds: [] },
                        meta: {
                            dtType: 'selectDie',
                            selectCount: 1,
                            diceOwnerId: '0',
                            targetOpponentDice: false,
                        },
                    },
                } as any,
            })
        );

        expect(html).toContain('interaction.hint_select_ally:current=0,max=1');
    });

    it('反馈 6a3a97e8 的 any 改骰交互快照应能正常渲染右侧骰区', () => {
        const html = renderToStaticMarkup(
            React.createElement(RightSidebar, {
                dice: [
                    { id: 0, value: 4, symbol: 'helm', symbols: ['helm'], isKept: false, definitionId: 'paladin-dice' },
                    { id: 1, value: 6, symbol: 'pray', symbols: ['pray'], isKept: true, definitionId: 'paladin-dice' },
                    { id: 2, value: 6, symbol: 'pray', symbols: ['pray'], isKept: true, definitionId: 'paladin-dice' },
                    { id: 3, value: 6, symbol: 'pray', symbols: ['pray'], isKept: true, definitionId: 'paladin-dice' },
                    { id: 4, value: 5, symbol: 'heart', symbols: ['heart'], isKept: false, definitionId: 'paladin-dice' },
                ] as any,
                rollCount: 3,
                rollLimit: 3,
                rollConfirmed: false,
                currentPhase: 'offensiveRoll',
                canInteractDice: true,
                isRolling: false,
                setIsRolling: vi.fn(),
                rerollingDiceIds: [],
                setRerollingDiceIds: vi.fn(),
                onToggleLock: vi.fn(),
                onRoll: vi.fn(),
                onConfirm: vi.fn(),
                showAdvancePhaseButton: false,
                advanceLabel: 'advance',
                isAdvanceButtonEnabled: false,
                onAdvance: vi.fn(),
                discardPileRef: createRef<HTMLDivElement>(),
                discardCards: [],
                canUndoDiscard: false,
                onUndoDiscard: vi.fn(),
                discardHighlighted: false,
                sellButtonVisible: false,
                dispatch: vi.fn(),
                rootPlayerId: '0',
                teamIdByPlayerId: { '0': 'A', '1': 'B' },
                interaction: {
                    id: 'dt-dice-modify-card-surprise-1782224859890',
                    kind: 'multistep-choice',
                    playerId: '0',
                    title: 'interaction.selectDieToChange',
                    description: null,
                    options: [],
                    data: {
                        title: 'interaction.selectDieToChange',
                        sourceId: 'card-surprise',
                        minSteps: 1,
                        allowedDieIds: [0, 1, 2, 3, 4],
                        completedDieIds: [],
                        meta: {
                            dtType: 'modifyDie',
                            dieModifyConfig: { mode: 'any' },
                            selectCount: 1,
                            diceOwnerId: '0',
                            targetOpponentDice: false,
                        },
                    },
                } as any,
            })
        );

        expect(html).toContain('interaction.hint_any');
        expect(html).toContain('data-player-seat-anchor="0"');
    });

    it('反馈 6a3cb53f 的对手重掷交互快照缺少 initialResult 时也不应渲染崩溃', () => {
        const html = renderToStaticMarkup(
            React.createElement(RightSidebar, {
                dice: [
                    { id: 0, value: 3, symbol: 'branch', symbols: ['branch'], isKept: false, definitionId: 'treant-dice' },
                    { id: 1, value: 6, symbol: 'spirit', symbols: ['spirit'], isKept: false, definitionId: 'treant-dice' },
                    { id: 2, value: 5, symbol: 'leaf', symbols: ['leaf'], isKept: false, definitionId: 'treant-dice' },
                    { id: 3, value: 4, symbol: 'leaf', symbols: ['leaf'], isKept: false, definitionId: 'treant-dice' },
                    { id: 4, value: 2, symbol: 'branch', symbols: ['branch'], isKept: false, definitionId: 'treant-dice' },
                ] as any,
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                currentPhase: 'offensiveRoll',
                canInteractDice: false,
                isRolling: false,
                setIsRolling: vi.fn(),
                rerollingDiceIds: [],
                setRerollingDiceIds: vi.fn(),
                onToggleLock: vi.fn(),
                onRoll: vi.fn(),
                onConfirm: vi.fn(),
                showAdvancePhaseButton: false,
                advanceLabel: 'advance',
                isAdvanceButtonEnabled: false,
                onAdvance: vi.fn(),
                discardPileRef: createRef<HTMLDivElement>(),
                discardCards: [],
                canUndoDiscard: false,
                onUndoDiscard: vi.fn(),
                discardHighlighted: false,
                sellButtonVisible: false,
                dispatch: vi.fn(),
                rootPlayerId: '0',
                teamIdByPlayerId: { '0': 'A', '1': 'B', '2': 'A', '3': 'B' },
                interaction: {
                    id: 'dt-dice-select-card-give-hand-1782363441041',
                    kind: 'multistep-choice',
                    playerId: '0',
                    title: 'interaction.selectOpponentDieToReroll',
                    description: null,
                    options: [],
                    data: {
                        title: 'interaction.selectOpponentDieToReroll',
                        sourceId: 'card-give-hand',
                        maxSteps: 1,
                        minSteps: 1,
                        allowedDieIds: [0, 1, 2, 3, 4],
                        completedDieIds: [],
                        meta: {
                            dtType: 'selectDie',
                            selectCount: 1,
                            diceOwnerId: '1',
                            targetOpponentDice: true,
                            skipAbilityReselection: false,
                        },
                    },
                } as any,
            })
        );

        expect(html).toContain('interaction.hint_select_opponent:current=0,max=1');
        expect(html).toContain('data-player-seat-anchor="0"');
    });
});

