import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { BaseZone } from '../ui/BaseZone';
import { SU_COMMANDS } from '../domain/types';

vi.mock('../../../hooks/ui/useCoarsePointer', () => ({
    useCoarsePointer: () => true,
}));

vi.mock('../../../components/common/media/CardPreview', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../components/common/media/CardPreview')>();
    return {
        ...actual,
        CardPreview: ({ previewRef }: { previewRef?: unknown }) => (
            React.createElement('div', {
                'data-testid': 'mock-card-preview',
                'data-preview-ref': JSON.stringify(previewRef ?? null),
            })
        ),
    };
});

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearPowerModifierRegistry();
    resetAbilityInit();
    initAllAbilities();
});

afterEach(() => {
    vi.clearAllMocks();
});

function buildCore() {
    return {
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
                factions: ['tricksters', 'werewolves'],
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
                factions: ['pirates', 'dinosaurs'],
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            {
                defId: 'base_the_jungle',
                minions: [],
                ongoingActions: [],
            },
        ],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
    };
}

function renderBaseZone(options?: {
    ongoingActions?: Array<{ uid: string; defId: string; ownerId: string; talentUsed?: boolean }>;
    minions?: Array<Record<string, unknown>>;
    buriedCards?: Array<Record<string, unknown>>;
    titans?: Array<Record<string, unknown>>;
    usableOngoingTalentUids?: Set<string>;
    isMobileViewport?: boolean;
    isMinionSelectMode?: boolean;
    selectableMinionUids?: Set<string>;
    onMinionSelect?: (minionUid: string, baseIndex: number) => void;
}) {
    const dispatch = vi.fn();
    const onViewAction = vi.fn();
    const onViewMinion = vi.fn();
    const core = buildCore();
    core.bases[0] = {
        ...core.bases[0],
        minions: (options?.minions ?? []) as any,
        ongoingActions: (options?.ongoingActions ?? []) as any,
        buriedCards: (options?.buriedCards ?? []) as any,
    };
    (core as any).titans = options?.titans ?? [];

    render(
        React.createElement(BaseZone, {
            base: core.bases[0] as any,
            baseIndex: 0,
            core: core as any,
            turnOrder: core.turnOrder,
            isMobileViewport: options?.isMobileViewport,
            isDeployMode: false,
            isMinionSelectMode: options?.isMinionSelectMode,
            selectableMinionUids: options?.selectableMinionUids,
            isMyTurn: true,
            myPlayerId: '0',
            dispatch,
            onClick: vi.fn(),
            onMinionSelect: options?.onMinionSelect,
            onViewMinion,
            onViewAction,
            onViewBase: vi.fn(),
            onViewTitan: vi.fn(),
            usableOngoingTalentUids: options?.usableOngoingTalentUids,
        }),
    );

    return { dispatch, onViewAction, onViewMinion };
}

describe('BaseZone 移动端 ongoing 交互', () => {
    it('基地上的天赋战术在移动端应先选中，再次点击才发动', () => {
        const { dispatch } = renderBaseZone({
            ongoingActions: [
                { uid: 'oa1', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false },
            ],
            usableOngoingTalentUids: new Set(['oa1']),
        });

        const ongoingCard = document.querySelector('[data-ongoing-uid="oa1"]');
        expect(ongoingCard).not.toBeNull();
        fireEvent.click(ongoingCard as Element);

        expect(dispatch).not.toHaveBeenCalled();

        fireEvent.click(ongoingCard as Element);

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith(SU_COMMANDS.USE_TALENT, {
            ongoingCardUid: 'oa1',
            baseIndex: 0,
        });
    });

    it('基地上的持续行动卡不显示放大镜以免挡住点击', () => {
        renderBaseZone({
            ongoingActions: [
                { uid: 'oa1', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false },
            ],
            usableOngoingTalentUids: new Set(['oa1']),
        });

        expect(document.querySelector('[data-testid="su-base-ongoing-magnify-oa1"]')).toBeNull();
    });

    it('基地上的普通持续行动卡在移动端应先选中，再显示放大镜用于放大预览', () => {
        const { onViewAction } = renderBaseZone({
            ongoingActions: [
                { uid: 'oa1', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false },
            ],
        });

        expect(document.querySelector('[data-testid="su-base-ongoing-magnify-oa1"]')).toBeNull();
        const ongoingCard = document.querySelector('[data-ongoing-uid="oa1"]');
        expect(ongoingCard).not.toBeNull();

        fireEvent.click(ongoingCard as Element);
        expect(onViewAction).not.toHaveBeenCalled();

        const magnifyButton = document.querySelector('[data-testid="su-base-ongoing-magnify-oa1"]');
        expect(magnifyButton).not.toBeNull();

        fireEvent.click(magnifyButton as Element);
        expect(onViewAction).toHaveBeenCalledWith('miskatonic_lost_knowledge');
    });

    it('移动端普通随从在没有可发动效果时应直接打开放大预览', () => {
        const { onViewMinion, dispatch } = renderBaseZone({
            minions: [
                {
                    uid: 'm1',
                    defId: 'pirate_first_mate',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                },
            ],
        });

        const minionCard = document.querySelector('[data-minion-uid="m1"]');
        expect(minionCard).not.toBeNull();

        fireEvent.click(minionCard as Element);

        expect(dispatch).not.toHaveBeenCalled();
        expect(onViewMinion).toHaveBeenCalledTimes(1);
    });

    it('附着在随从上的天赋战术在移动端展开后单击一次就应发动', () => {
        const { dispatch } = renderBaseZone({
            minions: [
                {
                    uid: 'm1',
                    defId: 'pirate_first_mate',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [
                        { uid: 'aa1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: false },
                    ],
                },
            ],
            usableOngoingTalentUids: new Set(['aa1']),
        });

        const minionCard = document.querySelector('[data-minion-uid="m1"]');
        expect(minionCard).not.toBeNull();
        fireEvent.click(minionCard as Element);
        const attachedAction = document.querySelector('[data-attached-action-uid="aa1"]');
        expect(attachedAction).not.toBeNull();

        fireEvent.click(attachedAction as Element);

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith(SU_COMMANDS.USE_TALENT, {
            ongoingCardUid: 'aa1',
            baseIndex: 0,
        });
    });

    it('基地战场卡片在移动端应有显式高度，避免只剩横条', () => {
        renderBaseZone({
            isMobileViewport: true,
            ongoingActions: [
                { uid: 'oa1', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false },
            ],
            minions: [
                {
                    uid: 'm1',
                    defId: 'pirate_first_mate',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                },
                {
                    uid: 'm2',
                    defId: 'pirate_first_mate',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [
                        { uid: 'aa1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: false },
                    ],
                },
            ],
            buriedCards: [
                {
                    uid: 'b1',
                    defId: 'pirate_first_mate',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                },
            ],
            titans: [
                {
                    uid: 't1',
                    defId: 'dinosaurs_fort_titanosaurus',
                    faction: 'dinosaurs',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
            usableOngoingTalentUids: new Set(['aa1']),
        });

        const minionCard = document.querySelector('[data-minion-uid="m1"]') as HTMLElement | null;
        expect(minionCard).not.toBeNull();
        expect(minionCard?.style.width).toContain('--mobile-layout-inline-unit');
        expect(minionCard?.style.height).toContain('--mobile-layout-inline-unit');

        const attachedBadgeShell = document.querySelector('[data-testid="smashup-attached-badge-shell"]') as HTMLElement | null;
        expect(attachedBadgeShell).not.toBeNull();
        expect(attachedBadgeShell?.style.paddingTop).toBe('24%');

        const baseCard = document.querySelector('[data-base-index="0"]') as HTMLElement | null;
        const ongoingCard = document.querySelector('[data-ongoing-uid="oa1"]') as HTMLElement | null;
        const buriedCard = document.querySelector('[data-buried-card-uid="b1"]') as HTMLElement | null;
        const titanCard = document.querySelector('[data-titan-uid="t1"]') as HTMLElement | null;

        expect(baseCard?.style.height).toContain('--mobile-layout-inline-unit');
        expect(ongoingCard?.style.height).toBe('100%');
        expect((ongoingCard?.parentElement as HTMLElement | null)?.style.height).toContain('--mobile-layout-inline-unit');
        expect(buriedCard?.style.height).toBe('100%');
        expect((buriedCard?.parentElement as HTMLElement | null)?.style.height).toContain('--mobile-layout-inline-unit');
        expect(titanCard?.style.height).toBe('100%');
        expect((titanCard?.parentElement as HTMLElement | null)?.style.height).toContain('--mobile-layout-inline-unit');

        fireEvent.click(document.querySelector('[data-minion-uid="m2"]') as Element);
        const attachedAction = document.querySelector('[data-attached-action-uid="aa1"]') as HTMLElement | null;
        expect(attachedAction?.style.width).toContain('--mobile-layout-inline-unit');
        expect(attachedAction?.style.height).toContain('--mobile-layout-inline-unit');
    });

    it('时间盒子在场上时显示时间计数标记', () => {
        renderBaseZone({
            titans: [
                {
                    uid: 'time-box-live',
                    defId: 'time_travelers_time_box',
                    faction: 'time_travelers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    metadata: { timeBoxCounters: 5 },
                },
            ],
        });

        const counter = document.querySelector('[data-testid="su-base-titan-timebox-counter-time-box-live"]');
        expect(counter).not.toBeNull();
        expect(counter).toHaveTextContent('5');
    });

    it('混合增减来源时应显示当前有效力量，避免把净值误读成单一卡牌加成', () => {
        renderBaseZone({
            minions: [
                {
                    uid: 'puck-1',
                    defId: 'fairies_puck',
                    controller: '0',
                    owner: '0',
                    basePower: 3,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [
                        { uid: 'daisy-1', defId: 'fairies_daisy_chain', ownerId: '0', talentUsed: false },
                    ],
                },
            ],
            ongoingActions: [
                { uid: 'enchantment-1', defId: 'fairies_enchantment', ownerId: '0', talentUsed: false, metadata: { fairiesEnchantmentMode: 'minus' } } as any,
            ],
        });

        const badge = document.querySelector('[data-testid="su-minion-power-badge-puck-1"]') as HTMLElement | null;
        expect(badge).not.toBeNull();
        expect(badge).toHaveTextContent('4');
        expect(badge?.textContent).not.toContain('+1');
        expect(badge?.className).toContain('bg-amber-700');
        expect(badge?.title).toContain('雏菊花环: +2');
        expect(badge?.title).toContain('结果: -1');
        expect(badge?.title).toContain('= 4');
    });

    it('随从选择模式下少量候选只半展开，不启用滚动列表', () => {
        const onMinionSelect = vi.fn();
        renderBaseZone({
            isMinionSelectMode: true,
            selectableMinionUids: new Set(['m1']),
            onMinionSelect,
            minions: [
                {
                    uid: 'm1',
                    defId: 'pirate_first_mate',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                },
                {
                    uid: 'm2',
                    defId: 'pirate_first_mate',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                },
                {
                    uid: 'm3',
                    defId: 'pirate_first_mate',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                },
            ],
        });

        const secondMinion = document.querySelector('[data-minion-uid="m2"]') as HTMLElement | null;
        const thirdMinion = document.querySelector('[data-minion-uid="m3"]') as HTMLElement | null;
        const minionStack = document.querySelector('[data-testid="su-base-stack-0-0"]') as HTMLElement | null;
        expect(secondMinion).not.toBeNull();
        expect(thirdMinion).not.toBeNull();
        expect(minionStack).not.toBeNull();
        expect(minionStack?.getAttribute('data-minion-select-mode')).toBe('true');
        expect(minionStack?.getAttribute('data-minion-select-list')).toBe('false');
        expect(minionStack?.className).not.toContain('overflow-y-auto');
        expect(minionStack?.className).not.toContain('no-scrollbar');
        expect(minionStack?.style.maxHeight).toBe('');
        expect(secondMinion?.style.marginTop).toBe('-3.5203vw');
        expect(thirdMinion?.style.marginTop).toBe('-3.5203vw');
        expect(secondMinion?.className).not.toContain('cursor-not-allowed');
        expect(thirdMinion?.className).not.toContain('cursor-not-allowed');

        fireEvent.click(thirdMinion as Element);
        expect(onMinionSelect).not.toHaveBeenCalled();

        const firstMinion = document.querySelector('[data-minion-uid="m1"]') as HTMLElement | null;
        expect(firstMinion).not.toBeNull();
        const firstFrame = document.querySelector('[data-testid="su-minion-frame-m1"]');
        const secondFrame = document.querySelector('[data-testid="su-minion-frame-m2"]');
        expect(firstFrame?.className).toContain('border-green-400');
        expect(secondFrame?.className).not.toContain('border-green-400');
        fireEvent.click(firstMinion as Element);
        expect(onMinionSelect).toHaveBeenCalledWith('m1', 0);
    });

    it('随从选择模式下内容超过半展开高度时才启用无滚动条滚动列表', () => {
        renderBaseZone({
            isMinionSelectMode: true,
            selectableMinionUids: new Set(['m1', 'm2', 'm3', 'm4', 'm5', 'm6']),
            minions: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((uid) => ({
                uid,
                defId: 'pirate_first_mate',
                controller: '0',
                owner: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                attachedActions: [],
            })),
        });

        const minionStack = document.querySelector('[data-testid="su-base-stack-0-0"]') as HTMLElement | null;
        const secondMinion = document.querySelector('[data-minion-uid="m2"]') as HTMLElement | null;
        const sixthMinion = document.querySelector('[data-minion-uid="m6"]') as HTMLElement | null;
        expect(minionStack).not.toBeNull();
        expect(secondMinion).not.toBeNull();
        expect(sixthMinion).not.toBeNull();
        expect(minionStack?.getAttribute('data-minion-select-mode')).toBe('true');
        expect(minionStack?.getAttribute('data-minion-select-list')).toBe('true');
        expect(minionStack?.className).toContain('overflow-y-auto');
        expect(minionStack?.className).toContain('no-scrollbar');
        expect(minionStack?.style.maxHeight).toBe('20.4132vw');
        expect(secondMinion?.style.marginTop).toBe('-3.5203vw');
        expect(sixthMinion?.style.marginTop).toBe('-3.5203vw');
    });

    it('随从选择模式下收起附着行动浮层，避免源卡遮挡目标随从', () => {
        renderBaseZone({
            isMinionSelectMode: true,
            selectableMinionUids: new Set(['target']),
            minions: [
                {
                    uid: 'source',
                    defId: 'pirate_first_mate',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [
                        { uid: 'source-action', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: false },
                    ],
                },
                {
                    uid: 'target',
                    defId: 'pirate_first_mate',
                    controller: '1',
                    owner: '1',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                },
            ],
        });

        const sourceMinion = document.querySelector('[data-minion-uid="source"]') as HTMLElement | null;
        expect(sourceMinion).not.toBeNull();

        fireEvent.mouseEnter(sourceMinion as Element);

        expect(sourceMinion?.getAttribute('data-attached-overlay-visible')).toBe('false');
        expect(document.querySelector('[data-attached-action-uid="source-action"]')?.parentElement?.className)
            .toContain('pointer-events-none');
    });
});
