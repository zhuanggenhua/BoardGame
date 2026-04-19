import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { EventStreamEntry } from '../../../engine/types';
import type { BonusDieInfo } from '../domain/types';
import { useCardSpotlight } from '../hooks/useCardSpotlight';
import { BonusDieOverlay } from '../ui/BonusDieOverlay';
import { SpotlightContainer } from '../ui/SpotlightContainer';
import { shouldSuppressPendingDisplayOnlyBonusOverlay } from '../ui/bonusDiceOverlayVisibility';
import { shouldHighlightOpponentViewAbilities } from '../ui/abilityHighlightVisibility';
import { resolveBonusDieText } from '../ui/bonusDieTranslation';
import {
    COMMON_CARDS,
    GUNSLINGER_COMMON_ATLAS_INDEX,
    SAMURAI_COMMON_ATLAS_INDEX,
} from '../domain/commonCards';
import { getDiceThroneCardPreviewRef } from '../ui/cardPreviewHelper';

const bonusDieEffectTranslations = {
    'watchOut.bow': '弓🏹：伤害+2',
    'volley.result': '{{bowCount}}个弓面：伤害+{{bonusDamage}}',
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, string | number>) => {
            if (!options) return key;
            const params = Object.entries(options)
                .map(([paramKey, value]) => `${paramKey}=${value}`)
                .join(',');
            return `${key}:${params}`;
        },
        i18n: {
            resolvedLanguage: 'zh-CN',
            language: 'zh-CN',
            exists: () => false,
            getResource: (_language: string, _namespace: string, key: string) => (
                key === 'bonusDie.effect' ? bonusDieEffectTranslations : undefined
            ),
        },
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../../core', async () => {
    const actual = await vi.importActual<typeof import('../../../core')>('../../../core');
    return {
        ...actual,
        HudPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

vi.mock('framer-motion', () => {
    const motion = new Proxy({}, {
        get: (_target, tag) => {
            return ({ children, ...rest }: { children?: React.ReactNode }) => (
                React.createElement(tag as string, rest, children)
            );
        },
    });

    return {
        motion,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => (
            <>{children}</>
        ),
    };
});

vi.mock('../../../core', async () => {
    const actual = await vi.importActual<typeof import('../../../core')>('../../../core');
    return {
        ...actual,
        HudPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

const buildBonusDice = (): BonusDieInfo[] => [
    { index: 0, value: 4, face: 'taiji' },
    { index: 1, value: 4, face: 'taiji' },
    { index: 2, value: 4, face: 'taiji' },
];

afterEach(() => {
    vi.useRealTimers();
});

describe('BonusDieOverlay', () => {
    it('有太极时显示重掷提示与确认伤害按钮', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={buildBonusDice()}
                canReroll
                onReroll={vi.fn()}
                onSkipReroll={vi.fn()}
                showTotal
                rerollCostAmount={2}
                rerollCostTokenId="taiji"
            />
        );

        expect(html).toContain('bonusDie.selectToReroll:cost=2,token=tokens.taiji.name');
        expect(html).toContain('bonusDie.confirmDamage');
        expect(html).toContain('bonusDie.total');
        expect(html).toContain('cursor-pointer');
        expect(html).toContain('bg-amber-600/80');
        expect(html).toContain('(bonusDie.knockdownTrigger)');
    });

    it('无太极时显示无法重掷提示且不显示操作按钮', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={buildBonusDice()}
                canReroll={false}
                onReroll={vi.fn()}
                onSkipReroll={vi.fn()}
                showTotal
                rerollCostAmount={2}
                rerollCostTokenId="taiji"
            />
        );

        expect(html).toContain('bonusDie.noTokenToReroll:token=tokens.taiji.name');
        expect(html).not.toContain('bonusDie.continue');
        expect(html).not.toContain('bonusDie.confirmDamage');
        expect(html).not.toContain('cursor-pointer');
        expect(html).not.toContain('bg-amber-600/80');
    });

    it('displayOnly 模式不显示继续按钮', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={buildBonusDice()}
                canReroll={false}
                displayOnly
            />
        );

        expect(html).toContain('bonusDie.diceResult');
        expect(html).not.toContain('bonusDie.continue');
        expect(html).not.toContain('bonusDie.confirmDamage');
    });

    it('多骰紧凑模式不应在每颗骰子下重复渲染长效果文本', async () => {
        vi.useFakeTimers();

        render(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={[
                    { index: 0, value: 1, face: 'fist', effectKey: 'bonusDie.effect.watchOut.bow', effectParams: { value: 1 } },
                    { index: 1, value: 2, face: 'fist', effectKey: 'bonusDie.effect.watchOut.bow', effectParams: { value: 2 } },
                ]}
                canReroll={false}
                displayOnly
            />
        );

        await act(async () => {
            vi.advanceTimersByTime(1200);
        });

        expect(screen.queryByText('弓🏹：伤害+2')).not.toBeInTheDocument();
    });

    it('单骰重掷模式应使用特写布局并保留效果文案', async () => {
        vi.useFakeTimers();

        render(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={[
                    { index: 0, value: 1, face: 'fist', effectKey: 'bonusDie.effect.watchOut.bow', effectParams: { value: 1 } },
                ]}
                canReroll
                onReroll={vi.fn()}
            />
        );

        await act(async () => {
            vi.advanceTimersByTime(1200);
        });

        expect(screen.getByTestId('bonus-die-single-reroll-spotlight')).toBeInTheDocument();
        expect(screen.getByText('弓🏹：伤害+2')).toBeInTheDocument();
        expect(screen.queryByTestId('bonus-die-multi-reroll-spotlight')).not.toBeInTheDocument();
    });

    it('奖励骰展示态特写应保留首次点击保护，保护窗后才允许关闭', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();

        render(
            <BonusDieOverlay
                isVisible
                onClose={onClose}
                value={4}
                face="lotus"
                autoCloseDelay={10000}
            />
        );

        fireEvent.click(document.querySelector('.fixed.inset-0') as Element);
        expect(onClose).not.toHaveBeenCalled();

        vi.advanceTimersByTime(250);
        fireEvent.click(document.querySelector('.fixed.inset-0') as Element);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('displayOnly 的 settlement 分支也应保留首次点击保护', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();

        render(
            <BonusDieOverlay
                isVisible
                onClose={onClose}
                bonusDice={buildBonusDice()}
                displayOnly
            />
        );

        fireEvent.click(document.querySelector('.fixed.inset-0') as Element);
        expect(onClose).not.toHaveBeenCalled();

        vi.advanceTimersByTime(250);
        fireEvent.click(document.querySelector('.fixed.inset-0') as Element);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('扁平 bonusDie effect key 应解析为本地化文案', () => {
        const translated = resolveBonusDieText('bonusDie.effect.watchOut.bow', {
            t: (key) => key,
            i18n: {
                resolvedLanguage: 'zh-CN',
                language: 'zh-CN',
                exists: () => false,
                getResource: (_language, _namespace, key) => (
                    key === 'bonusDie.effect' ? bonusDieEffectTranslations : undefined
                ),
            },
        });

        expect(translated).toBe('弓🏹：伤害+2');
    });

    it('多骰汇总文案也应支持扁平 effect key 解析', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={buildBonusDice()}
                displayOnly
                summaryEffectKey="bonusDie.effect.volley.result"
                summaryEffectParams={{ bowCount: 2, bonusDamage: 2 }}
            />
        );

        expect(html).toContain('2个弓面：伤害+2');
        expect(html).not.toContain('bonusDie.effect.volley.result');
    });

    it('同批卡牌与额外骰事件会把骰子绑定到卡牌特写，而不是直接丢失', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'volley',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '0',
                        value: 4,
                        face: 'taiji',
                        effectKey: 'bonusDie.effect.volley',
                    },
                    timestamp: 1100,
                },
            },
            {
                id: 3,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '0',
                        value: 3,
                        face: 'taiji',
                        effectKey: 'bonusDie.effect.volley',
                    },
                    timestamp: 1150,
                },
            },
            {
                id: 4,
                event: {
                    type: 'BONUS_DICE_REROLL_REQUESTED',
                    payload: {
                        settlement: {
                            id: 'settlement-1',
                            attackerId: '1',
                            dice: [
                                { index: 0, value: 4, face: 'taiji' },
                                { index: 1, value: 3, face: 'taiji' },
                            ],
                            rerollCount: 0,
                            displayOnly: true,
                        },
                    },
                    timestamp: 1200,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'monk',
                    '1': 'moon-elf',
                },
            });

            return (
                <pre data-testid="spotlight-state">
                    {JSON.stringify({
                        cardSpotlightQueue: state.cardSpotlightQueue,
                        bonusDie: state.bonusDie,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} />);
        rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].bonusDice).toHaveLength(2);
            expect(state.cardSpotlightQueue[0].bonusDice[0].value).toBe(4);
            expect(state.cardSpotlightQueue[0].bonusDice[1].value).toBe(3);
            expect(state.bonusDie.show).toBe(false);
        });
    });

    it('新角色通用卡特写应按角色解析 previewRef，而不是回退到旧角色默认索引', async () => {
        const buildEntries = (): EventStreamEntry[] => [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'card-next-time',
                    },
                    timestamp: 1000,
                },
            },
        ];

        function HookProbe({
            streamEntries,
            opponentCharacter,
        }: {
            streamEntries: EventStreamEntry[];
            opponentCharacter: 'gunslinger' | 'samurai';
        }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'monk',
                    '1': opponentCharacter,
                },
            });

            return (
                <pre data-testid="common-card-spotlight-state">
                    {JSON.stringify(state.cardSpotlightQueue)}
                </pre>
            );
        }

        const firstRender = render(<HookProbe streamEntries={[]} opponentCharacter="gunslinger" />);
        firstRender.rerender(<HookProbe streamEntries={buildEntries()} opponentCharacter="gunslinger" />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('common-card-spotlight-state').textContent ?? '[]');
            expect(state).toHaveLength(1);
            expect(state[0].previewRef).toEqual({
                type: 'atlas',
                atlasId: 'dicethrone:gunslinger-cards',
                index: 9,
            });
        });

        firstRender.unmount();

        const secondRender = render(<HookProbe streamEntries={[]} opponentCharacter="samurai" />);
        secondRender.rerender(<HookProbe streamEntries={buildEntries()} opponentCharacter="samurai" />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('common-card-spotlight-state').textContent ?? '[]');
            expect(state).toHaveLength(1);
            expect(state[0].previewRef).toEqual({
                type: 'atlas',
                atlasId: 'dicethrone:samurai-cards',
                index: 9,
            });
        });
    });

    it('新角色整组通用卡都应按角色解析各自的 atlas 索引', () => {
        for (const card of COMMON_CARDS) {
            expect(getDiceThroneCardPreviewRef(card.id, 'gunslinger')).toEqual({
                type: 'atlas',
                atlasId: 'dicethrone:gunslinger-cards',
                index: GUNSLINGER_COMMON_ATLAS_INDEX[card.id],
            });

            expect(getDiceThroneCardPreviewRef(card.id, 'samurai')).toEqual({
                type: 'atlas',
                atlasId: 'dicethrone:samurai-cards',
                index: SAMURAI_COMMON_ATLAS_INDEX[card.id],
            });
        }
    });

    it('升级牌的 CARD_PLAYED 与 ABILITY_REPLACED 不应被拆成两次卡牌特写', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'upgrade-deadeye-2',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'ABILITY_REPLACED',
                    payload: {
                        playerId: '1',
                        oldAbilityId: 'deadeye',
                        newAbilityDef: { id: 'deadeye' },
                        cardId: 'upgrade-deadeye-2',
                        newLevel: 2,
                    },
                    timestamp: 1000,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'samurai',
                    '1': 'gunslinger',
                },
            });

            return (
                <pre data-testid="upgrade-card-spotlight-state">
                    {JSON.stringify(state.cardSpotlightQueue)}
                </pre>
            );
        }

        const view = render(<HookProbe streamEntries={[]} />);
        view.rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('upgrade-card-spotlight-state').textContent ?? '[]');
            expect(state).toHaveLength(1);
            expect(state[0].id).toBe('upgrade-deadeye-2-1000');
            expect(state[0].previewRef).toEqual({
                type: 'atlas',
                atlasId: 'dicethrone:gunslinger-cards',
                index: 24,
            });
        });
    });

    it('自己打出的 Volley 多骰事件应显示独立多骰特写，而不是卡牌特写或单骰特写', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '0',
                        cardId: 'volley',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '0',
                        targetPlayerId: '1',
                        value: 4,
                        face: 'bow',
                        effectParams: { value: 4, index: 0 },
                    },
                    timestamp: 1100,
                },
            },
            {
                id: 3,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '0',
                        targetPlayerId: '1',
                        value: 3,
                        face: 'moon',
                        effectParams: { value: 3, index: 1 },
                    },
                    timestamp: 1150,
                },
            },
            {
                id: 4,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '0',
                        targetPlayerId: '1',
                        value: 4,
                        face: 'bow',
                        effectKey: 'bonusDie.effect.volley.result',
                        effectParams: { bowCount: 1, bonusDamage: 1 },
                    },
                    timestamp: 1200,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'moon_elf',
                    '1': 'barbarian',
                },
            });

            return (
                <pre data-testid="self-volley-state">
                    {JSON.stringify({
                        cardSpotlightQueue: state.cardSpotlightQueue,
                        bonusDie: state.bonusDie,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} />);
        rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('self-volley-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(0);
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.bonusDice).toHaveLength(2);
            expect(state.bonusDie.summaryEffectKey).toBe('bonusDie.effect.volley.result');
            expect(state.bonusDie.value).toBeUndefined();
        });
    });

    it('对手打出带 displayOnly settlement 的多骰卡牌时，应优先显示卡牌特写而不是重复弹多骰面板', async () => {
        const settlement = {
            id: 'volley-display-1200',
            sourceAbilityId: 'volley',
            attackerId: '1',
            targetId: '0',
            dice: [
                { index: 0, value: 4, face: 'taiji' },
                { index: 1, value: 3, face: 'taiji' },
            ],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 0,
            readyToSettle: false,
            displayOnly: true,
        };

        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'volley',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '0',
                        value: 4,
                        face: 'taiji',
                        effectKey: 'bonusDie.effect.volley',
                    },
                    timestamp: 1100,
                },
            },
            {
                id: 3,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '0',
                        value: 3,
                        face: 'taiji',
                        effectKey: 'bonusDie.effect.volley',
                    },
                    timestamp: 1150,
                },
            },
            {
                id: 4,
                event: {
                    type: 'BONUS_DICE_REROLL_REQUESTED',
                    payload: { settlement },
                    timestamp: 1200,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'monk',
                    '1': 'moon_elf',
                },
            });

            return (
                <pre data-testid="opponent-volley-state">
                    {JSON.stringify({
                        cardSpotlightQueue: state.cardSpotlightQueue,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} />);
        rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('opponent-volley-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].bonusDice).toHaveLength(2);
            expect(
                shouldSuppressPendingDisplayOnlyBonusOverlay({
                    settlement,
                    cardSpotlightQueue: state.cardSpotlightQueue,
                    viewerPlayerId: '0',
                })
            ).toBe(true);
            expect(
                shouldSuppressPendingDisplayOnlyBonusOverlay({
                    settlement,
                    cardSpotlightQueue: state.cardSpotlightQueue,
                    viewerPlayerId: '1',
                })
            ).toBe(false);
        });
    });

    it('卡牌特写尚未完整绑定全部骰子时，不应提前隐藏 displayOnly 多骰面板', () => {
        const settlement = {
            id: 'volley-display-1200',
            sourceAbilityId: 'volley',
            attackerId: '1',
            targetId: '0',
            dice: [
                { index: 0, value: 4, face: 'taiji' },
                { index: 1, value: 3, face: 'taiji' },
            ],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 0,
            readyToSettle: false,
            displayOnly: true,
        };

        expect(
            shouldSuppressPendingDisplayOnlyBonusOverlay({
                settlement,
                viewerPlayerId: '0',
                cardSpotlightQueue: [
                    {
                        id: 'volley-1000',
                        timestamp: 1000,
                        playerId: '1',
                        playerName: '对手',
                        bonusDice: [
                            {
                                value: 4,
                                face: 'taiji',
                                timestamp: 1100,
                            },
                        ],
                    },
                ],
            })
        ).toBe(false);
    });

    it('displayOnly 结算缺少时间戳时，若卡牌特写已完整绑定骰子也应隐藏重复面板', () => {
        const settlement = {
            id: 'volley-display',
            sourceAbilityId: 'volley',
            attackerId: '1',
            targetId: '0',
            dice: [
                { index: 0, value: 4, face: 'taiji' },
                { index: 1, value: 3, face: 'taiji' },
            ],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 0,
            readyToSettle: false,
            displayOnly: true,
        };

        expect(
            shouldSuppressPendingDisplayOnlyBonusOverlay({
                settlement,
                viewerPlayerId: '0',
                cardSpotlightQueue: [
                    {
                        id: 'volley-1000',
                        timestamp: 1000,
                        playerId: '1',
                        playerName: '对手',
                        bonusDice: [
                            {
                                value: 4,
                                face: 'taiji',
                                timestamp: 1100,
                            },
                            {
                                value: 3,
                                face: 'taiji',
                                timestamp: 1101,
                            },
                        ],
                    },
                ],
            })
        ).toBe(true);
    });

    it('displayOnly 结算缺少时间戳时，若卡牌特写已完整绑定骰子也应隐藏重复面板', () => {
        const settlement = {
            id: 'volley-display',
            sourceAbilityId: 'volley',
            attackerId: '1',
            targetId: '0',
            dice: [
                { index: 0, value: 4, face: 'taiji' },
                { index: 1, value: 3, face: 'taiji' },
            ],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 0,
            readyToSettle: false,
            displayOnly: true,
        };

        expect(
            shouldSuppressPendingDisplayOnlyBonusOverlay({
                settlement,
                viewerPlayerId: '0',
                cardSpotlightQueue: [
                    {
                        id: 'volley-1000',
                        timestamp: 1000,
                        playerId: '1',
                        playerName: '对手',
                        bonusDice: [
                            {
                                value: 4,
                                face: 'taiji',
                                timestamp: 1100,
                            },
                            {
                                value: 3,
                                face: 'taiji',
                                timestamp: 1101,
                            },
                        ],
                    },
                ],
            })
        ).toBe(true);
    });

    it('对手打出自疗型多骰卡牌时，也应把奖励骰绑定到卡牌特写而不是走独立多骰面板', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'card-lucky',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '1',
                        value: 1,
                        face: 'heart',
                        effectParams: { value: 1, index: 0 },
                    },
                    timestamp: 1100,
                },
            },
            {
                id: 3,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '1',
                        value: 2,
                        face: 'axe',
                        effectParams: { value: 2, index: 1 },
                    },
                    timestamp: 1101,
                },
            },
            {
                id: 4,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '1',
                        value: 3,
                        face: 'heart',
                        effectParams: { value: 3, index: 2 },
                    },
                    timestamp: 1102,
                },
            },
            {
                id: 5,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '1',
                        value: 1,
                        face: 'heart',
                        effectKey: 'bonusDie.effect.luckyRoll.result',
                        effectParams: { heartCount: 2, healAmount: 5 },
                    },
                    timestamp: 1103,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'moon_elf',
                    '1': 'barbarian',
                },
            });

            return (
                <pre data-testid="opponent-lucky-state">
                    {JSON.stringify({
                        cardSpotlightQueue: state.cardSpotlightQueue,
                        bonusDie: state.bonusDie,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} />);
        rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('opponent-lucky-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].bonusDice).toHaveLength(3);
            expect(state.cardSpotlightQueue[0].summaryText?.effectKey).toBe('bonusDie.effect.luckyRoll.result');
            expect(state.bonusDie.show).toBe(false);
        });
    });

    it('自己打出的 Watch Out 单骰事件应显示独立骰子特写', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '0',
                        cardId: 'watch-out',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '0',
                        targetPlayerId: '1',
                        value: 1,
                        face: 'bow',
                        effectKey: 'bonusDie.effect.watchOut.bow',
                        effectParams: { value: 1 },
                    },
                    timestamp: 1100,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'moon_elf',
                    '1': 'barbarian',
                },
            });

            return (
                <pre data-testid="watch-out-state">
                    {JSON.stringify({
                        cardSpotlightQueue: state.cardSpotlightQueue,
                        bonusDie: state.bonusDie,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} />);
        rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('watch-out-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(0);
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.value).toBe(1);
            expect(state.bonusDie.face).toBe('bow');
            expect(state.bonusDie.effectKey).toBe('bonusDie.effect.watchOut.bow');
        });
    });

    it('自己打出的 Get Fired Up 单骰事件也应显示独立骰子特写', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '0',
                        cardId: 'card-get-fired-up',
                    },
                    timestamp: 2000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '0',
                        targetPlayerId: '1',
                        value: 1,
                        face: 'fire',
                        effectKey: 'bonusDie.effect.fire',
                    },
                    timestamp: 2100,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'pyromancer',
                    '1': 'barbarian',
                },
            });

            return (
                <pre data-testid="get-fired-up-state">
                    {JSON.stringify({
                        cardSpotlightQueue: state.cardSpotlightQueue,
                        bonusDie: state.bonusDie,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} />);
        rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('get-fired-up-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(0);
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.value).toBe(1);
            expect(state.bonusDie.face).toBe('fire');
            expect(state.bonusDie.effectKey).toBe('bonusDie.effect.fire');
        });
    });

    it('首次挂载后的短时间点击不应立刻关闭特写', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();

        render(
            <SpotlightContainer
                id="bonus-die-test"
                isVisible
                onClose={onClose}
                autoCloseDelay={10000}
            >
                <button type="button" data-testid="spotlight-content">关闭</button>
            </SpotlightContainer>
        );

        fireEvent.click(screen.getByTestId('spotlight-content'));
        expect(onClose).not.toHaveBeenCalled();

        vi.advanceTimersByTime(250);
        fireEvent.click(screen.getByTestId('spotlight-content'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('展示态特写默认支持点空白关闭', () => {
        const onClose = vi.fn();
        render(
            <SpotlightContainer
                id="bonus-die-backdrop-close"
                isVisible
                onClose={onClose}
                autoCloseDelay={10000}
                closeClickGuardMs={0}
            >
                <button type="button">内容</button>
            </SpotlightContainer>
        );

        fireEvent.click(document.querySelector('.fixed.inset-0') as Element);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('闈炰氦浜掔壒鍐欓粯璁や笉搴旀嫤鎴暣灞忕偣鍑?', () => {
        const html = renderToStaticMarkup(
            <SpotlightContainer
                id="bonus-die-non-blocking"
                isVisible
                onClose={vi.fn()}
            >
                <button type="button">鍐呭</button>
            </SpotlightContainer>
        );

        expect(html).toContain('pointer-events-auto');
    });

    it('闈炰氦浜掔壒鍐欓粯璁ゆ敮鎸佺偣鍐呭鍏抽棴', async () => {
        const onClose = vi.fn();
        render(
            <SpotlightContainer
                id="bonus-die-display-close"
                isVisible
                onClose={onClose}
                autoCloseDelay={10000}
                closeClickGuardMs={0}
            >
                <button type="button" data-testid="display-spotlight-content">关闭</button>
            </SpotlightContainer>
        );

        fireEvent.click(screen.getByTestId('display-spotlight-content'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('切到对方视角且处于对方进攻掷骰阶段时，应高亮对方可选技能', () => {
        expect(shouldHighlightOpponentViewAbilities({
            isSelfView: false,
            isSpectator: false,
            currentPhase: 'offensiveRoll',
            isViewRolling: true,
            hasRolled: true,
        })).toBe(true);
    });

    it('切到对方视角但未进入对方进攻掷骰条件时，不应高亮对方技能', () => {
        expect(shouldHighlightOpponentViewAbilities({
            isSelfView: false,
            isSpectator: false,
            currentPhase: 'offensiveRoll',
            isViewRolling: true,
            hasRolled: false,
        })).toBe(false);
        expect(shouldHighlightOpponentViewAbilities({
            isSelfView: false,
            isSpectator: false,
            currentPhase: 'defensiveRoll',
            isViewRolling: true,
            hasRolled: true,
        })).toBe(false);
    });
    it('replaces the rerolled card spotlight die by dieIndex', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'thunder-strike',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '0',
                        value: 4,
                        face: 'taiji',
                        effectParams: { index: 0 },
                    },
                    timestamp: 1100,
                },
            },
            {
                id: 3,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '0',
                        value: 2,
                        face: 'taiji',
                        effectParams: { index: 1 },
                    },
                    timestamp: 1110,
                },
            },
            {
                id: 4,
                event: {
                    type: 'BONUS_DIE_REROLLED',
                    payload: {
                        dieIndex: 1,
                        playerId: '1',
                        targetPlayerId: '0',
                        newValue: 6,
                        newFace: 'taiji',
                        effectParams: { index: 1 },
                    },
                    timestamp: 1200,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: 'opponent',
                selectedCharacters: {
                    '0': 'monk',
                    '1': 'monk',
                },
            });

            return (
                <pre data-testid="rerolled-card-spotlight-state">
                    {JSON.stringify({
                        cardSpotlightQueue: state.cardSpotlightQueue,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} />);
        rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('rerolled-card-spotlight-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].bonusDice).toHaveLength(2);
            expect(state.cardSpotlightQueue[0].bonusDice[0].value).toBe(4);
            expect(state.cardSpotlightQueue[0].bonusDice[1].value).toBe(6);
            expect(state.cardSpotlightQueue[0].bonusDice[1].index).toBe(1);
        });
    });
});
