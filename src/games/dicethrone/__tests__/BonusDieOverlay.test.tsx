import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { EventStreamEntry } from '../../../engine/types';
import type { BonusDieInfo } from '../domain/types';
import { useCardSpotlight } from '../hooks/useCardSpotlight';
import { BonusDieOverlay } from '../ui/BonusDieOverlay';
import { BoardOverlays } from '../ui/BoardOverlays';
import { SpotlightContainer } from '../ui/SpotlightContainer';
import {
    resolveInteractivePendingBonusDiceSettlement,
    shouldSuppressForegroundBonusDieOverlay,
    shouldSuppressPendingDisplayOnlyBonusOverlay,
} from '../ui/bonusDiceOverlayVisibility';
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
    'watchOut.none': '未触发额外效果',
    'volley.result': '{{bowCount}}个弓面：伤害+{{bonusDamage}}',
    'volley.bowContribution': '弓🏹：本次伤害 +1',
    'volley.otherContribution': '未命中弓面：本次伤害不增加',
    'luckyRoll.heartContribution': '心：最终治疗 +2',
    'luckyRoll.otherContribution': '非心面：最终治疗不增加',
    'morePleaseRoll.swordContribution': '剑：最终伤害 +1',
    'morePleaseRoll.otherContribution': '非剑面：最终伤害不增加',
    'gunslingerEatMyLead.bulletContribution': '子弹：本次攻击伤害 +1',
    'gunslingerEatMyLead.otherContribution': '非子弹面：本次攻击伤害不增加',
    'totalDamageContribution': '本骰点数 {{value}} 计入最终伤害',
    'totalDamageContributionThreshold': '本骰点数 {{value}} 计入最终伤害；总和达阈值会触发额外效果',
    fire: '烈焰: 伤害 +3',
    magma: '熔岩: 施加灼烧',
    fiery_soul: '焚魂: 获得 2 烈焰精通',
    meteor: '陨石: 施加击倒',
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
    it('前景交互存在时应压住奖励骰覆盖层', () => {
        render(
            <BoardOverlays
                isMagnifyOpen={false}
                magnifiedImage={null}
                magnifiedCard={null}
                magnifiedCards={[]}
                onCloseMagnify={vi.fn()}
                players={{
                    '0': {
                        characterId: 'gunslinger',
                        resources: { hp: 40, cp: 2 },
                        statusEffects: {},
                        tokens: { loaded: 1 },
                        hand: [],
                        discard: [],
                        deck: [],
                        abilityLevels: {},
                    } as any,
                }}
                currentPlayerId="0"
                playerNames={{ '0': 'P0' }}
                cardSpotlightQueue={[]}
                onCardSpotlightClose={vi.fn()}
                opponentHeaderRef={{ current: null }}
                bonusDie={{ show: false }}
                onBonusDieClose={vi.fn()}
                suppressBonusDieOverlay
                pendingBonusDiceSettlement={{
                    id: 'loaded-display-1',
                    sourceAbilityId: 'revolver-3',
                    attackerId: '0',
                    targetId: '1',
                    dice: [{ index: 0, value: 4, face: 'bullet' as any }],
                    rerollCostTokenId: '',
                    rerollCostAmount: 0,
                    rerollCount: 0,
                    maxRerollCount: 0,
                    readyToSettle: false,
                    displayOnly: true,
                }}
                canRerollBonusDie={false}
                isGameOver={false}
                gameoverResult={null}
                rematchState={null}
                onRematchVote={vi.fn()}
                locale="zh-CN"
                currentPhase={'offensiveRoll' as any}
                selectedCharacters={{ '0': 'gunslinger' as any }}
                hostPlayerId="0"
            />
        );

        expect(screen.queryByTestId('bonus-die-overlay')).toBeNull();
    });

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

    it('无太极时显示无法重掷提示但仍保留确认伤害按钮', () => {
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
        expect(html).toContain('bonusDie.confirmDamage');
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
        expect(html).toContain('bonusDie.closeSpotlight');
        expect(html).not.toContain('bonusDie.continue');
        expect(html).not.toContain('bonusDie.confirmDamage');
    });

    it('可改骰的 displayOnly 结算保留确认伤害入口', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={buildBonusDice()}
                canReroll={false}
                displayOnly
                allowBackgroundInteraction
                onSkipReroll={vi.fn()}
            />
        );

        expect(html).toContain('bonusDie.confirmDamage');
        expect(html).not.toContain('bonusDie.closeSpotlight');
    });

    it('固定选择结果不应显示为投掷结果，也不播放投骰揭示动画', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                value={4}
                face="gear"
                effectKey="bonusDie.effect.artificerWrenchStrikeGear"
                presentationKind="choice"
            />
        );

        expect(html).toContain('data-animate-on-mount="false"');
        expect(html).not.toContain('data-animate-on-mount="true"');
    });

    it('displayOnly 固定选择面板应显示选择结果而不是投掷结果', () => {
        const html = renderToStaticMarkup(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={[{ index: 0, value: 4, face: 'gear' as any, presentationKind: 'choice' }]}
                canReroll={false}
                displayOnly
                presentationKind="choice"
            />
        );

        expect(html).toContain('bonusDie.choiceResult');
        expect(html).not.toContain('bonusDie.diceResult');
        expect(html).toContain('data-animate-on-mount="false"');
    });

    it('displayOnly 多骰特写点击骰子内容时应冒泡关闭容器', () => {
        const onClose = vi.fn();
        vi.useFakeTimers();

        render(
            <BonusDieOverlay
                isVisible
                onClose={onClose}
                bonusDice={buildBonusDice()}
                canReroll={false}
                displayOnly
                usePortal={false}
            />
        );

        fireEvent.pointerDown(screen.getByTestId('bonus-die-reroll-option-0'));
        fireEvent.click(screen.getByTestId('bonus-die-reroll-option-0'));
        act(() => {
            vi.advanceTimersByTime(350);
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('displayOnly 且 manualCloseOnly 时不应自动关闭', () => {
        const onClose = vi.fn();
        vi.useFakeTimers();

        render(
            <BonusDieOverlay
                isVisible
                onClose={onClose}
                bonusDice={buildBonusDice()}
                canReroll={false}
                displayOnly
                manualCloseOnly
                usePortal={false}
            />
        );

        act(() => {
            vi.advanceTimersByTime(3500);
        });

        expect(onClose).not.toHaveBeenCalled();
    });

    it('阻塞式奖励骰结算的关闭按钮应走确认伤害收口，而不是只做本地关闭', () => {
        const onClose = vi.fn();
        const onSkipReroll = vi.fn();

        render(
            <BonusDieOverlay
                isVisible
                onClose={onClose}
                bonusDice={buildBonusDice()}
                canReroll={false}
                onSkipReroll={onSkipReroll}
            />
        );

        fireEvent.click(screen.getByLabelText('bonusDie.confirmDamage'));
        expect(onSkipReroll).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('单骰特写的关闭按钮应直接关闭特写', () => {
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

        fireEvent.click(screen.getByLabelText('bonusDie.closeSpotlight'));
        expect(onClose).toHaveBeenCalledTimes(1);
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
        const onReroll = vi.fn();

        render(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={[
                    { index: 0, value: 1, face: 'fist', effectKey: 'bonusDie.effect.watchOut.bow', effectParams: { value: 1 } },
                ]}
                canReroll
                onReroll={onReroll}
            />
        );

        await act(async () => {
            vi.advanceTimersByTime(1200);
        });

        expect(screen.getByTestId('bonus-die-single-reroll-spotlight')).toBeInTheDocument();
        expect(screen.getByTestId('bonus-die-reroll-option-0')).toBeInTheDocument();
        expect(screen.getByText('弓🏹：伤害+2')).toBeInTheDocument();
        expect(screen.queryByTestId('bonus-die-multi-reroll-spotlight')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('bonus-die-reroll-option-0'));
        expect(onReroll).toHaveBeenCalledWith(0);
    });

    it('单骰有汇总文案时应只显示一句描述，不重复渲染每骰文案', async () => {
        vi.useFakeTimers();

        render(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={[
                    { index: 0, value: 1, face: 'fist', effectKey: 'bonusDie.effect.watchOut.bow', effectParams: { value: 1 } },
                ]}
                canReroll={false}
                displayOnly
                summaryEffectKey="bonusDie.effect.watchOut.bow"
                summaryEffectParams={{ value: 1 }}
            />
        );

        await act(async () => {
            vi.advanceTimersByTime(1200);
        });

        expect(screen.getAllByText('弓🏹：伤害+2')).toHaveLength(1);
    });

    it('多骰重掷后只应让被选中的那颗骰子播放重投动画', async () => {
        vi.useFakeTimers();

        const readRollingStates = () => screen.getAllByTestId('bonus-die-spotlight-content').map((node) =>
            node.getAttribute('data-is-rolling') === 'true'
        );

        const { rerender } = render(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={[
                    { index: 0, value: 1, face: 'palm' },
                    { index: 1, value: 2, face: 'sword' },
                    { index: 2, value: 3, face: 'taiji' },
                ]}
                canReroll
            />
        );

        await act(async () => {
            vi.advanceTimersByTime(1200);
        });
        expect(readRollingStates()).toEqual([false, false, false]);

        rerender(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                bonusDice={[
                    { index: 0, value: 1, face: 'palm' },
                    { index: 1, value: 5, face: 'sword' },
                    { index: 2, value: 3, face: 'taiji' },
                ]}
                canReroll
                lastRerolledDieIndex={1}
                rerollPresentationKey={1}
            />
        );

        expect(readRollingStates()).toEqual([false, true, false]);
    });

    it('单骰特写在结果相同但 presentationKey 变化时也应重播滚动动画', async () => {
        vi.useFakeTimers();

        const readIsRolling = () => screen.getByTestId('bonus-die-spotlight-content').getAttribute('data-is-rolling') === 'true';

        const { rerender } = render(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                value={4}
                face="lotus"
                presentationKey="bonus-1"
                autoCloseDelay={10000}
            />
        );

        await act(async () => {
            vi.advanceTimersByTime(1200);
        });
        expect(readIsRolling()).toBe(false);

        rerender(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                value={4}
                face="lotus"
                presentationKey="bonus-2"
                autoCloseDelay={10000}
            />
        );

        expect(readIsRolling()).toBe(true);
    });

    it('spotlight 奖励骰应使用 3D 骰模承接当前骰面展示', async () => {
        vi.useFakeTimers();

        render(
            <BonusDieOverlay
                isVisible
                onClose={vi.fn()}
                value={4}
                face="lotus"
                presentationKey="bonus-face-2d"
                autoCloseDelay={10000}
            />
        );

        await act(async () => {
            vi.advanceTimersByTime(1200);
        });

        expect(screen.getByTestId('dice-3d')).toBeInTheDocument();
        expect(screen.queryByTestId('bonus-die-spotlight-face')).toBeNull();
    });

    it('奖励骰展示态特写应保留首次点击保护，0.3 秒后才允许关闭', () => {
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

        vi.advanceTimersByTime(350);
        fireEvent.click(document.querySelector('.fixed.inset-0') as Element);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('displayOnly 的 settlement 分支也应保留 0.3 秒首次点击保护', () => {
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

        vi.advanceTimersByTime(350);
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

        expect(html).toContain('bonusDie.summary.attackDamageBonus:amount=2');
        expect(html).toContain('bonusDie.summary.inflictEntangle');
        expect(html).not.toContain('bonusDie.effect.volley.result');
    });

    it('通用卡牌掷骰 key 应解析为最终结果而不是卡面说明', () => {
        const context = {
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
        };

        expect(resolveBonusDieText('bonusDie.effect.watchOut', context, { value: 2 })).toBe('未触发额外效果');
        expect(resolveBonusDieText('bonusDie.effect.volley', context, { value: 1 }, 'bow')).toBe('弓🏹：本次伤害 +1');
        expect(resolveBonusDieText('bonusDie.effect.luckyRoll', context, { value: 3 }, 'heart')).toBe('心：最终治疗 +2');
        expect(resolveBonusDieText('bonusDie.effect.morePleaseRoll', context, { value: 6 }, 'sword')).toBe('剑：最终伤害 +1');
        expect(resolveBonusDieText('bonusDie.effect.gunslingerEatMyLeadDie', context, { value: 4 }, 'bullet')).toBe('子弹：本次攻击伤害 +1');
        expect(resolveBonusDieText('bonusDie.effect.thunderStrikeDie', context, { value: 4 })).toBe('本骰点数 4 计入最终伤害');
        expect(resolveBonusDieText('bonusDie.effect.barbarianSuppress', context, { value: 5 })).toBe('本骰点数 5 计入最终伤害；总和达阈值会触发额外效果');
        expect(resolveBonusDieText('bonusDie.effect.pyroBlast2Die', context, { value: 6 }, 'meteor')).toBe('陨石: 施加击倒');
        expect(resolveBonusDieText('bonusDie.effect.samuraiMasamune.result', context, {
            katanaCount: 2,
            appliedShameCount: 1,
            grantedRetributionCount: 1,
        })).toBe('bonusDie.summary.attackDamageBonus:amount=2；bonusDie.summary.inflictShame:count=1；bonusDie.summary.gainBackStrike:count=1');
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
                index: 26,
            });
        });
    });

    it('同一张卡的重复 CARD_PLAYED 事件不应重复入特写队列', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'card-boss-generous',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 2,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'card-boss-generous',
                    },
                    timestamp: 1000,
                },
            },
            {
                id: 3,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'card-boss-generous',
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
                <pre data-testid="duplicate-card-spotlight-state">
                    {JSON.stringify(state.cardSpotlightQueue)}
                </pre>
            );
        }

        const view = render(<HookProbe streamEntries={[]} />);
        view.rerender(<HookProbe streamEntries={entries} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('duplicate-card-spotlight-state').textContent ?? '[]');
            expect(state).toHaveLength(1);
            expect(state[0].id).toBe('card-boss-generous-1000');
        });
    });

    it('自己打出的 Volley 多骰事件应由卡牌特写携带多骰结果', async () => {
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
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0]).toMatchObject({
                cardId: 'volley',
                bonusDice: [
                    { value: 4, face: 'bow' },
                    { value: 3, face: 'moon' },
                ],
                summaryText: {
                    effectKey: 'bonusDie.effect.volley.result',
                    effectParams: { bowCount: 1, bonusDamage: 1 },
                },
            });
            expect(state.bonusDie.show).toBe(false);
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

    it('displayOnly 结算的旧脏 dice shape 不应在可见性判断里崩溃', () => {
        const settlement = {
            id: 'legacy-display-only',
            sourceAbilityId: 'volley',
            attackerId: '1',
            targetId: '0',
            dice: { legacy: true },
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 0,
            readyToSettle: false,
            displayOnly: true,
        } as any;

        expect(
            shouldSuppressPendingDisplayOnlyBonusOverlay({
                settlement,
                viewerPlayerId: '0',
                cardSpotlightQueue: [
                    {
                        id: 'legacy-volley-1000',
                        timestamp: 1000,
                        playerId: '1',
                        playerName: '对手',
                        bonusDice: [],
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
            expect(state.cardSpotlightQueue[0].bonusDice[0].presentationKey).toBe('BONUS_DIE_ROLLED:1100');
            expect(state.cardSpotlightQueue[0].bonusDice[1].presentationKey).toBe('BONUS_DIE_ROLLED:1101');
            expect(state.cardSpotlightQueue[0].bonusDice[2].presentationKey).toBe('BONUS_DIE_ROLLED:1102');
            expect(state.cardSpotlightQueue[0].summaryText?.effectKey).toBe('bonusDie.effect.luckyRoll.result');
            expect(state.bonusDie.show).toBe(false);
        });
    });

    it('对手打出一掷千金且奖励骰走右侧骰盘时，卡牌特写只保留首次结果说明', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'CARD_PLAYED',
                    payload: {
                        playerId: '1',
                        cardId: 'card-one-throw-fortune',
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
                        value: 6,
                        face: 'lotus',
                        effectKey: 'bonusDie.effect.gainCp',
                        effectParams: { value: 6, cp: 3 },
                    },
                    timestamp: 1100,
                },
            },
            {
                id: 3,
                event: {
                    type: 'BONUS_DICE_REROLL_REQUESTED',
                    payload: {
                        settlement: {
                            id: 'card-one-throw-fortune-display-1000',
                            sourceAbilityId: 'card-one-throw-fortune',
                            attackerId: '1',
                            targetId: '1',
                            dice: [{
                                index: 0,
                                value: 6,
                                face: 'lotus',
                                effectKey: 'bonusDie.effect.gainCp',
                                effectParams: { value: 6, cp: 3 },
                            }],
                            rerollCostTokenId: '',
                            rerollCostAmount: 0,
                            rerollCount: 0,
                            maxRerollCount: 0,
                            readyToSettle: false,
                            displayOnly: true,
                            showTotal: false,
                            customResolutionId: 'one-throw-fortune-cp',
                            allowDiceModification: true,
                        },
                    },
                    timestamp: 1101,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'barbarian',
                    '1': 'monk',
                },
                suppressBonusDiceInCardSpotlight: true,
            });

            return (
                <pre data-testid="opponent-one-throw-fortune-state">
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
            const state = JSON.parse(screen.getByTestId('opponent-one-throw-fortune-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0].bonusDice).toBeUndefined();
            expect(state.cardSpotlightQueue[0].summaryText).toEqual({
                effectKey: 'bonusDie.spotlight.initialGainCp',
                effectParams: { value: 6, cp: 3 },
            });
            expect(state.bonusDie.show).toBe(false);
        });
    });

    it('对手视角下的自掷单骰 standalone 奖励骰也应显示特写，不能静默跳过', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '1',
                        value: 1,
                        face: 'heart',
                        effectKey: 'bonusDie.effect.powderKeg.bang',
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
                    '0': 'gunslinger',
                    '1': 'cursed_pirate',
                },
            });

            return (
                <pre data-testid="opponent-standalone-single-die-state">
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
            const state = JSON.parse(screen.getByTestId('opponent-standalone-single-die-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(0);
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.value).toBe(1);
            expect(state.bonusDie.face).toBe('heart');
            expect(state.bonusDie.effectKey).toBe('bonusDie.effect.powderKeg.bang');
        });
    });

    it('对手视角下的自掷多骰 standalone 奖励骰也应聚合展示，不能只静默吃掉前几颗', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '1',
                        value: 1,
                        face: 'heart',
                        effectParams: { index: 0 },
                    },
                    timestamp: 1100,
                },
            },
            {
                id: 2,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '1',
                        value: 2,
                        face: 'axe',
                        effectParams: { index: 1 },
                    },
                    timestamp: 1101,
                },
            },
            {
                id: 3,
                event: {
                    type: 'BONUS_DIE_ROLLED',
                    payload: {
                        playerId: '1',
                        targetPlayerId: '1',
                        value: 1,
                        face: 'heart',
                        effectKey: 'bonusDie.effect.syntheticStandalone.result',
                        effectParams: { heartCount: 1 },
                    },
                    timestamp: 1102,
                },
            },
        ];

        function HookProbe({ streamEntries }: { streamEntries: EventStreamEntry[] }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: '对手',
                selectedCharacters: {
                    '0': 'gunslinger',
                    '1': 'barbarian',
                },
            });

            return (
                <pre data-testid="opponent-standalone-multi-dice-state">
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
            const state = JSON.parse(screen.getByTestId('opponent-standalone-multi-dice-state').textContent ?? '{}');
            expect(state.cardSpotlightQueue).toHaveLength(0);
            expect(state.bonusDie.show).toBe(true);
            expect(state.bonusDie.bonusDice).toHaveLength(2);
            expect(state.bonusDie.bonusDice[0].index).toBe(0);
            expect(state.bonusDie.bonusDice[1].index).toBe(1);
            expect(state.bonusDie.summaryEffectKey).toBe('bonusDie.effect.syntheticStandalone.result');
            expect(state.bonusDie.displayOnly).toBe(true);
        });
    });

    it('自己打出的 Watch Out 单骰事件应由卡牌特写携带骰面结果', async () => {
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
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0]).toMatchObject({
                cardId: 'watch-out',
                bonusDice: [
                    { value: 1, face: 'bow', effectKey: 'bonusDie.effect.watchOut.bow' },
                ],
            });
            expect(state.bonusDie.show).toBe(false);
        });
    });

    it('自己打出的 Get Fired Up 单骰事件也应由卡牌特写携带骰面结果', async () => {
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
            expect(state.cardSpotlightQueue).toHaveLength(1);
            expect(state.cardSpotlightQueue[0]).toMatchObject({
                cardId: 'card-get-fired-up',
                bonusDice: [
                    { value: 1, face: 'fire', effectKey: 'bonusDie.effect.fire' },
                ],
            });
            expect(state.bonusDie.show).toBe(false);
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
            expect(state.cardSpotlightQueue[0].bonusDice[0].presentationKey).toBe('BONUS_DIE_ROLLED:1100');
            expect(state.cardSpotlightQueue[0].bonusDice[1].presentationKey).toBe('BONUS_DIE_REROLLED:1200');
        });
    });

    it('suppresses standalone bonus die spotlight while blocking bonus settlement is active', async () => {
        const entries: EventStreamEntry[] = [
            {
                id: 1,
                event: {
                    type: 'BONUS_DIE_REROLLED',
                    payload: {
                        dieIndex: 0,
                        playerId: '0',
                        targetPlayerId: '1',
                        newValue: 6,
                        newFace: 'bullet',
                        effectKey: 'bonusDie.effect.gunslingerLoadedDie',
                        effectParams: { index: 0 },
                    },
                    timestamp: 1500,
                },
            },
        ];

        function HookProbe({ streamEntries, suppress }: { streamEntries: EventStreamEntry[]; suppress: boolean }) {
            const state = useCardSpotlight({
                eventStreamEntries: streamEntries,
                currentPlayerId: '0',
                opponentName: 'opponent',
                selectedCharacters: {
                    '0': 'gunslinger',
                    '1': 'monk',
                },
                suppressStandaloneBonusDie: suppress,
            });

            return (
                <pre data-testid="suppressed-bonus-die-state">
                    {JSON.stringify({
                        show: state.bonusDie.show,
                        bonusDice: state.bonusDie.bonusDice,
                        effectKey: state.bonusDie.effectKey,
                    })}
                </pre>
            );
        }

        const { rerender } = render(<HookProbe streamEntries={[]} suppress={false} />);
        rerender(<HookProbe streamEntries={entries} suppress={true} />);

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('suppressed-bonus-die-state').textContent ?? '{}');
            expect(state.show).toBe(false);
            expect(state.bonusDice).toBeUndefined();
            expect(state.effectKey).toBeUndefined();
        });
    });

    it('keeps interactive bonus settlement visible when dt:bonus-dice interaction is current', () => {
        const settlement = {
            id: 'samurai-righteousness-1000',
            sourceAbilityId: 'samurai-righteousness',
            attackerId: '0',
            targetId: '1',
            dice: [{ index: 0, value: 4, face: 'sword' as const }],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            readyToSettle: false,
        };

        expect(resolveInteractivePendingBonusDiceSettlement({
            settlement,
            viewerPlayerId: '0',
            interactionState: {
                current: {
                    kind: 'dt:bonus-dice',
                    playerId: '0',
                },
            },
        })).toBe(settlement);
    });

    it('falls back to pending interactive bonus settlement when interaction ownership is lost', () => {
        const settlement = {
            id: 'samurai-righteousness-1000',
            sourceAbilityId: 'samurai-righteousness',
            attackerId: '0',
            targetId: '1',
            dice: [{ index: 0, value: 4, face: 'sword' as const }],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            readyToSettle: false,
        };

        expect(resolveInteractivePendingBonusDiceSettlement({
            settlement,
            viewerPlayerId: '0',
            interactionState: {
                current: undefined,
                queue: [],
            },
            responseWindowState: {
                current: undefined,
            },
        })).toBe(settlement);
    });

    it('keeps powder keg standalone spotlight visible even when choice prompt is already open', () => {
        expect(shouldSuppressForegroundBonusDieOverlay({
            hasChoice: true,
            interactiveSettlement: undefined,
            bonusDie: {
                show: true,
                effectKey: 'bonusDie.effect.powderKeg.6',
            },
        })).toBe(false);
    });

    it('keeps non-powder-keg standalone spotlight visible when choice prompt is already open', () => {
        expect(shouldSuppressForegroundBonusDieOverlay({
            hasChoice: true,
            interactiveSettlement: undefined,
            bonusDie: {
                show: true,
                effectKey: 'bonusDie.effect.cursedPirateMarkedLoot',
            },
        })).toBe(false);
    });

    it('always suppresses foreground spotlight when interactive bonus settlement is active', () => {
        expect(shouldSuppressForegroundBonusDieOverlay({
            hasChoice: false,
            interactiveSettlement: {
                id: 'samurai-righteousness-1000',
                sourceAbilityId: 'samurai-righteousness',
                attackerId: '0',
                targetId: '1',
                dice: [{ index: 0, value: 4, face: 'sword' as const }],
                rerollCostTokenId: '',
                rerollCostAmount: 0,
                rerollCount: 0,
                readyToSettle: false,
            },
            bonusDie: {
                show: true,
                effectKey: 'bonusDie.effect.powderKeg.6',
            },
        })).toBe(true);
    });

    it('旧脏 interactive pendingBonusDiceSettlement 不应在前台奖励骰弹层链路里崩溃', () => {
        const settlement = {
            id: 'legacy-interactive-settlement',
            sourceAbilityId: 'volley',
            attackerId: '0',
            targetId: '1',
            dice: { legacy: true },
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 1,
            readyToSettle: false,
            displayOnly: false,
        } as any;

        expect(resolveInteractivePendingBonusDiceSettlement({
            settlement,
            viewerPlayerId: '0',
            interactionState: {
                current: {
                    kind: 'dt:bonus-dice',
                    playerId: '0',
                },
            },
        })).toBe(settlement);
    });

    it('does not steal foreground when another interaction still owns the modal stack', () => {
        const settlement = {
            id: 'samurai-righteousness-1000',
            sourceAbilityId: 'samurai-righteousness',
            attackerId: '0',
            targetId: '1',
            dice: [{ index: 0, value: 4, face: 'sword' as const }],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            readyToSettle: false,
        };

        expect(resolveInteractivePendingBonusDiceSettlement({
            settlement,
            viewerPlayerId: '0',
            interactionState: {
                current: {
                    kind: 'simple-choice',
                    playerId: '0',
                },
            },
        })).toBeUndefined();

        expect(resolveInteractivePendingBonusDiceSettlement({
            settlement,
            viewerPlayerId: '0',
            interactionState: {
                current: undefined,
                queue: [{
                    kind: 'simple-choice',
                    playerId: '0',
                }],
            },
        })).toBeUndefined();
    });
});
