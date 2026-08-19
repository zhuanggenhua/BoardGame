/**
 * 大杀四方 - UI 交互手动测试
 * 
 * 这个测试文件用于手动验证 UI 交互是否正常工作。
 * 运行后会在控制台输出交互状态，可以手动检查。
 */

import React from 'react';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import {
    createFlowSystem, createActionLogSystem, createUndoSystem,
    createInteractionSystem, createRematchSystem,
    createTutorialSystem, createEventStreamSystem, createSimpleChoiceSystem,
} from '../../../engine';
import type { EngineSystem } from '../../../engine/systems/types';
import { createSmashUpEventSystem } from '../domain/systems';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import type { SmashUpCore, CardInstance, MinionOnBase, BaseInPlay } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { createInitialSystemState } from '../../../engine/pipeline';
import { SU_COMMANDS } from '../domain/types';
import { ToastProvider } from '../../../contexts/ToastContext';
import { PromptOverlay } from '../ui/PromptOverlay';
import { SmashUpCardRenderer } from '../ui/SmashUpCardRenderer';
import { BaseZone } from '../ui/BaseZone';
import { CardMagnifyOverlay } from '../ui/CardMagnifyOverlay';
import {
    buildMinionUidSnapshotByController,
    resolveEnteringMinionUidsByController,
} from '../ui/baseZoneEntryAnimation';
import { buildMatchPlayerViewModel } from '../../../components/game/framework/matchPlayerViewModel';
import { buildPlayerDisplayNameMap, resolveOrderedPlayerIds } from '../../../components/game/framework/playerDisplay';
import type { TitanState } from '../domain/types';
import { getSimpleChoicePrompt } from './helpers';

vi.mock('../../../components/common/media/CardPreview', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../components/common/media/CardPreview')>();
    return {
        ...actual,
        CardPreview: ({ previewRef, className, style }: { previewRef?: unknown; className?: string; style?: React.CSSProperties }) => (
            React.createElement('div', {
                'data-testid': 'mock-card-preview',
                'data-preview-ref': JSON.stringify(previewRef ?? null),
                className,
                style,
            })
        ),
    };
});

const PLAYER_IDS = ['0', '1'];

afterEach(() => {
    cleanup();
});

function makeCard(uid: string, defId: string, owner: string, type: 'minion' | 'action' = 'action'): CardInstance {
    return { uid, defId, owner, type };
}

function makeMinion(uid: string, defId: string, controller: string, power: number, metadata?: Record<string, unknown>): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
        ...(metadata ? { metadata } : {}),
    };
}

function makeBase(defId: string, minions: MinionOnBase[] = []): BaseInPlay {
    return { defId, minions, ongoingActions: [] };
}

function makePlayer(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id, vp: 0, hand: [] as CardInstance[], deck: [] as CardInstance[], discard: [] as CardInstance[],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['zombies', 'pirates'] as [string, string],
        ...overrides,
    };
}

function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [makeBase('test_base_1'), makeBase('test_base_2'), makeBase('test_base_3')],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function buildSystems(): EngineSystem<SmashUpCore>[] {
    return [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        createActionLogSystem<SmashUpCore>(),
        createUndoSystem<SmashUpCore>(),
        createInteractionSystem<SmashUpCore>(),
        createSimpleChoiceSystem<SmashUpCore>(),
        createRematchSystem<SmashUpCore>(),
        createTutorialSystem<SmashUpCore>(),
        createEventStreamSystem<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
}

function makeFullMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    const systems = buildSystems();
    const sys = createInitialSystemState(PLAYER_IDS, systems);
    return { core, sys: { ...sys, phase: 'playCards' } } as MatchState<SmashUpCore>;
}

function createRunner(customState: MatchState<SmashUpCore>) {
    return new GameTestRunner<SmashUpCore, any, any>({
        domain: SmashUpDomain,
        systems: buildSystems(),
        playerIds: PLAYER_IDS,
        setup: () => customState,
        silent: true,
    });
}

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('SmashUp UI 交互验证', () => {
    it('BaseZone 初次挂载时不应把现有随从误判成新入场', () => {
        const turnOrder = ['0', '1'];
        const minionsByController = {
            '0': [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2)],
            '1': [makeMinion('enemy-1', 'pirate_first_mate', '1', 3)],
        };

        const initialSnapshot = buildMinionUidSnapshotByController(turnOrder, minionsByController);
        const entering = resolveEnteringMinionUidsByController(turnOrder, initialSnapshot, initialSnapshot);

        expect(Array.from(entering['0'] ?? [])).toEqual([]);
        expect(Array.from(entering['1'] ?? [])).toEqual([]);
    });

    it('BaseZone 仅应给新 UID 随从播放入场动画，旧 UID 重渲染不应重复入场', () => {
        const turnOrder = ['0', '1'];
        const previousSnapshot = buildMinionUidSnapshotByController(turnOrder, {
            '0': [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2)],
            '1': [makeMinion('enemy-1', 'pirate_first_mate', '1', 3)],
        });
        const currentSnapshot = buildMinionUidSnapshotByController(turnOrder, {
            '0': [
                makeMinion('ally-1', 'robot_microbot_alpha', '0', 2),
                makeMinion('ally-2', 'robot_microbot_fixer', '0', 1),
            ],
            '1': [makeMinion('enemy-1', 'pirate_first_mate', '1', 3)],
        });

        const entering = resolveEnteringMinionUidsByController(turnOrder, currentSnapshot, previousSnapshot);

        expect(Array.from(entering['0'] ?? [])).toEqual(['ally-2']);
        expect(Array.from(entering['1'] ?? [])).toEqual([]);
    });

    it('BaseZone 的泰坦 hover 应沿用随从级别的轻微放大，不再把整张卡放大过头', () => {
        const titan: TitanState = {
            uid: 't-kraken',
            defId: 'pirates_the_kraken',
            faction: 'pirates',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
        };
        const core = makeState({
            titans: [titan],
        });

        render(
            React.createElement(
                ToastProvider,
                undefined,
                React.createElement(BaseZone, {
                    base: core.bases[0],
                    baseIndex: 0,
                    core,
                    turnOrder: core.turnOrder,
                    isDeployMode: false,
                    isMyTurn: true,
                    myPlayerId: '0',
                    dispatch: vi.fn(),
                    onClick: vi.fn(),
                    onViewMinion: vi.fn(),
                    onViewAction: vi.fn(),
                    onViewBase: vi.fn(),
                    onViewTitan: vi.fn(),
                }),
            ),
        );

        const titanCard = screen.getByTestId('su-base-titan-t-kraken');
        expect(titanCard.className).toContain('origin-bottom');
        expect(titanCard.className).toContain('hover:scale-110');
        expect(titanCard.className).not.toContain('hover:scale-125');
    });

    it('BaseZone 泰坦来源选择必须复用场上对象统一高亮样式', () => {
        const titan: TitanState = {
            uid: 't-kraken',
            defId: 'pirates_the_kraken',
            faction: 'pirates',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
        };
        const core = makeState({
            titans: [titan],
        });

        render(
            React.createElement(
                ToastProvider,
                undefined,
                React.createElement(BaseZone, {
                    base: core.bases[0],
                    baseIndex: 0,
                    core,
                    turnOrder: core.turnOrder,
                    isDeployMode: false,
                    isMyTurn: true,
                    myPlayerId: '0',
                    dispatch: vi.fn(),
                    onClick: vi.fn(),
                    onViewMinion: vi.fn(),
                    onViewAction: vi.fn(),
                    onViewBase: vi.fn(),
                    onViewTitan: vi.fn(),
                    selectableTitanUids: new Set(['t-kraken']),
                    onTitanSelect: vi.fn(),
                }),
            ),
        );

        const titanCard = screen.getByTestId('su-base-titan-t-kraken');
        expect(titanCard.getAttribute('data-highlighted')).toBe('true');
        expect(titanCard.className).toContain('ring-2');
        expect(titanCard.className).toContain('ring-green-400');
        expect(titanCard.className).toContain('shadow-[0_0_15px');
        expect(screen.queryByTestId('su-base-titan-source-highlight-t-kraken')).toBeNull();
    });

    it('BaseZone 随从选择滚动列表必须给统一高亮外环留出缓冲', () => {
        const minions = Array.from({ length: 5 }, (_, index) =>
            makeMinion(`ally-${index + 1}`, 'robot_microbot_alpha', '0', 2),
        );
        const core = makeState({
            bases: [makeBase('test_base_1', minions), makeBase('test_base_2'), makeBase('test_base_3')],
        });

        render(
            React.createElement(
                ToastProvider,
                undefined,
                React.createElement(BaseZone, {
                    base: core.bases[0],
                    baseIndex: 0,
                    core,
                    turnOrder: core.turnOrder,
                    isDeployMode: false,
                    isMinionSelectMode: true,
                    selectableMinionUids: new Set(['ally-1']),
                    isMyTurn: true,
                    myPlayerId: '0',
                    dispatch: vi.fn(),
                    onClick: vi.fn(),
                    onMinionSelect: vi.fn(),
                    onViewMinion: vi.fn(),
                    onViewAction: vi.fn(),
                    onViewBase: vi.fn(),
                    onViewTitan: vi.fn(),
                }),
            ),
        );

        const stack = screen.getByTestId('su-base-stack-0-0');
        const minion = document.querySelector('[data-minion-uid="ally-1"]') as HTMLElement | null;
        const minionFrame = screen.getByTestId('su-minion-frame-ally-1');
        expect(stack.getAttribute('data-minion-select-list')).toBe('true');
        expect(stack.getAttribute('style') ?? '').toContain('padding-block');
        expect(minion?.getAttribute('data-highlighted')).toBe('true');
        expect(minionFrame.className).toContain('ring-[0.26vw]');
        expect(minionFrame.className).toContain('ring-green-400');
        expect(screen.queryByTestId('su-minion-selection-highlight-ally-1')).toBeNull();
    });

    it('桌面端附加行动卡可见时应把所属列抬到最高层', () => {
        const core = makeState({
            bases: [
                makeBase('test_base_1', [
                    {
                        ...makeMinion('host-minion', 'pirate_first_mate', '0', 2),
                        attachedActions: [
                            { uid: 'attached-1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: false },
                        ],
                    },
                    makeMinion('ally-cover', 'robot_microbot_alpha', '1', 3),
                ]),
                makeBase('test_base_2'),
                makeBase('test_base_3'),
            ],
        });

        render(
            React.createElement(
                ToastProvider,
                undefined,
                React.createElement(BaseZone, {
                    base: core.bases[0],
                    baseIndex: 0,
                    core,
                    turnOrder: core.turnOrder,
                    isDeployMode: false,
                    isMyTurn: true,
                    myPlayerId: '0',
                    dispatch: vi.fn(),
                    onClick: vi.fn(),
                    onViewMinion: vi.fn(),
                    onViewAction: vi.fn(),
                    onViewBase: vi.fn(),
                    onViewTitan: vi.fn(),
                    selectableOngoingUids: new Set(['attached-1']),
                }),
            ),
        );

        const hostMinion = document.querySelector('[data-minion-uid="host-minion"]') as HTMLElement | null;
        const hostColumn = document.querySelector('[data-testid="su-base-player-column-0-0"]') as HTMLElement | null;
        const attachedOverlay = document.querySelector('[data-attached-overlay-owner="host-minion"]') as HTMLElement | null;
        expect(hostMinion).not.toBeNull();
        expect(hostColumn).not.toBeNull();
        expect(attachedOverlay).not.toBeNull();

        expect(hostMinion?.dataset.attachedOverlayVisible).toBe('true');
        expect(hostColumn?.className).toContain('z-[1400]');
    });

    it('通用玩家显示工具应优先使用昵称，并在缺失时回退到座位标签', () => {
        const playerNames = buildPlayerDisplayNameMap(
            ['0', '1', '2'],
            [
                { id: 0, name: '阿土' },
                { id: 2, name: '老王' },
            ],
            (playerId) => `P${Number(playerId) + 1}`,
        );

        expect(playerNames).toEqual({
            '0': '阿土',
            '1': 'P2',
            '2': '老王',
        });
    });

    it('通用玩家顺序工具应优先使用 seatOrder，并在缺项时回退到 turnOrder', () => {
        const orderedPlayerIds = resolveOrderedPlayerIds({
            preferredOrder: ['2', '0'],
            fallbackOrder: ['0', '1', '2'],
            players: { '0': {}, '1': {}, '2': {} },
        });

        expect(orderedPlayerIds).toEqual(['2', '0', '1']);
    });

    it('通用玩家视图模型应统一产出自己、当前回合与当前操作者名称', () => {
        const playerView = buildMatchPlayerViewModel({
            core: {
                players: { '0': {}, '1': {} },
                seatOrder: ['1', '0'],
                turnOrder: ['0', '1'],
                currentPlayerIndex: 1,
            },
            playerID: '0',
            matchData: [
                { id: 0, name: '阿土' },
                { id: 1, name: '老王' },
            ],
            resolvePreferredOrder: ({ core }) => core?.seatOrder,
            resolveFallbackOrder: ({ core }) => core?.turnOrder,
            resolveTurnPlayerId: ({ core }) => core?.turnOrder[core.currentPlayerIndex],
            resolveActiveActorId: () => '0',
        });

        expect(playerView.orderedPlayerIds).toEqual(['1', '0']);
        expect(playerView.playerOrderLabels).toEqual({
            '1': 'P1',
            '0': 'P2',
        });
        expect(playerView.selfPlayerId).toBe('0');
        expect(playerView.selfPlayerName).toBe('阿土');
        expect(playerView.turnPlayerId).toBe('1');
        expect(playerView.turnPlayerName).toBe('老王');
        expect(playerView.activeActorId).toBe('0');
        expect(playerView.activeActorName).toBe('阿土');
        expect(playerView.getPlayerOrderLabel('1')).toBe('P1');
        expect(playerView.getPlayerOrderLabel('0')).toBe('P2');
    });

    it('原生泰坦图集预览应透传正确的 atlas index', () => {
        render(
            React.createElement(SmashUpCardRenderer, {
                previewRef: {
                    type: 'renderer',
                    rendererId: 'smashup-card-renderer',
                    payload: { defId: 'pirates_the_kraken' },
                },
            }),
        );

        const preview = screen.getByTestId('mock-card-preview');
        expect(JSON.parse(preview.getAttribute('data-preview-ref') ?? 'null')).toEqual({
            type: 'atlas',
            atlasId: 'smashup:titans',
            index: 14,
        });
    });

    it('放大查看中的英文卡图应自动常显中文覆盖层', () => {
        render(
            React.createElement(SmashUpCardRenderer, {
                previewRef: {
                    type: 'renderer',
                    rendererId: 'smashup-card-renderer',
                    payload: { defId: 'zombie_lord_pod', forceShowOverlay: true },
                },
            }),
        );

        const overlay = screen.getByTestId('su-card-text-overlay');
        expect(overlay.getAttribute('data-overlay-visibility')).toBe('always');
        expect(overlay.className).toContain('opacity-100');
        expect(overlay.className).not.toContain('group-hover:opacity-100');
    });

    it('基地放大查看应允许使用仅存在 renderer 映射的基地卡图', () => {
        render(
            React.createElement(CardMagnifyOverlay, {
                target: { defId: 'base_crypt', type: 'base' },
                onClose: vi.fn(),
            }),
        );

        const preview = screen.getByTestId('mock-card-preview');
        expect(JSON.parse(preview.getAttribute('data-preview-ref') ?? 'null')).toEqual({
            type: 'renderer',
            rendererId: 'smashup-card-renderer',
            payload: { defId: 'base_crypt', forceShowOverlay: true },
        });
    });

    it('放大查看卡框应有显式高度，兼容不支持 aspect-ratio 的旧 WebView', () => {
        render(
            React.createElement(CardMagnifyOverlay, {
                target: { defId: 'zombie_lord_pod', type: 'minion' },
                onClose: vi.fn(),
            }),
        );

        const frame = screen.getByTestId('su-card-magnify-content');
        expect(frame.style.width).toBe('25vw');
        expect(frame.style.height).toContain('vw');
        expect(frame.style.maxHeight).toContain('px');
    });

    it('普通卡面中的英文卡图仍保持 hover 才显示中文覆盖层', () => {
        render(
            React.createElement(SmashUpCardRenderer, {
                previewRef: {
                    type: 'renderer',
                    rendererId: 'smashup-card-renderer',
                    payload: { defId: 'zombie_lord_pod' },
                },
            }),
        );

        const overlay = screen.getByTestId('su-card-text-overlay');
        expect(overlay.getAttribute('data-overlay-visibility')).toBe('hover');
        expect(overlay.className).toContain('group-hover:opacity-100');
    });

    it('模仿者会把目标卡图的下半部叠到自己的卡面上', () => {
        render(
            React.createElement(SmashUpCardRenderer, {
                previewRef: {
                    type: 'renderer',
                    rendererId: 'smashup-card-renderer',
                    payload: {
                        defId: 'shapeshifters_copycat',
                        cardUid: 'copycat-1',
                        overlayDefId: 'cyborg_apes_furious_george',
                    },
                },
            }),
        );

        const previews = screen.getAllByTestId('mock-card-preview');
        expect(previews).toHaveLength(2);
        expect(JSON.parse(previews[0].getAttribute('data-preview-ref') ?? 'null')).toMatchObject({
            type: 'atlas',
        });
        expect(JSON.parse(previews[1].getAttribute('data-preview-ref') ?? 'null')).toEqual({
            type: 'renderer',
            rendererId: 'smashup-card-renderer',
            payload: {
                defId: 'cyborg_apes_furious_george',
                cardUid: 'copycat-1',
                disableHoverOverlay: true,
            },
        });
        expect(screen.getByTestId('su-card-bottom-overlay')).toBeTruthy();
    });

    it('BaseZone 会把模仿者的下半部叠图信息传给渲染器和放大查看', () => {
        const onViewMinion = vi.fn();
        render(
            React.createElement(BaseZone, {
                base: makeBase('base_the_vats', [
                    makeMinion('copycat-1', 'shapeshifters_copycat', '0', 2, {
                        copiedAbilityDefId: 'cyborg_apes_furious_george',
                    }),
                ]),
                baseIndex: 0,
                core: makeState(),
                turnOrder: ['0', '1'],
                isDeployMode: false,
                isMyTurn: true,
                myPlayerId: '0',
                dispatch: vi.fn(),
                onClick: vi.fn(),
                onViewMinion,
                onViewAction: vi.fn(),
                onViewBase: vi.fn(),
                onViewTitan: vi.fn(),
            }),
        );

        const previews = screen.getAllByTestId('mock-card-preview');
        const minionPreview = previews.find((node) => (
            (node.getAttribute('data-preview-ref') ?? '').includes('shapeshifters_copycat')
        ));
        expect(minionPreview).toBeTruthy();
        expect(JSON.parse(minionPreview!.getAttribute('data-preview-ref') ?? 'null')).toEqual({
            type: 'renderer',
            rendererId: 'smashup-card-renderer',
            payload: {
                defId: 'shapeshifters_copycat',
                cardUid: 'copycat-1',
                overlayDefId: 'cyborg_apes_furious_george',
            },
        });

        const inspectButton = document.querySelector('[data-minion-uid="copycat-1"] button');
        expect(inspectButton).toBeTruthy();
        fireEvent.click(inspectButton as Element);
        expect(onViewMinion).toHaveBeenCalledWith('shapeshifters_copycat', {
            overlayDefId: 'cyborg_apes_furious_george',
        });
    });

    it('随从高亮框应只包卡面，不应把力量角标和附着角标纳入描边层', () => {
        render(
            React.createElement(BaseZone, {
                base: makeBase('base_the_vats', [
                    {
                        ...makeMinion('badge-host', 'pirate_first_mate', '0', 2),
                        powerCounters: 1,
                        powerModifier: 2,
                        attachedActions: [
                            { uid: 'attached-1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: false },
                        ],
                    },
                ]),
                baseIndex: 0,
                core: makeState(),
                turnOrder: ['0', '1'],
                isDeployMode: false,
                isMyTurn: true,
                myPlayerId: '0',
                dispatch: vi.fn(),
                onClick: vi.fn(),
                onViewMinion: vi.fn(),
                onViewAction: vi.fn(),
                onViewBase: vi.fn(),
                onViewTitan: vi.fn(),
            }),
        );

        const frame = screen.getByTestId('su-minion-frame-badge-host');
        const powerBadge = screen.getByTestId('su-minion-power-badge-badge-host');
        const attachedBadge = screen.getByTestId('smashup-attached-badge-shell');

        expect(frame.contains(powerBadge)).toBe(false);
        expect(frame.contains(attachedBadge)).toBe(false);
    });

    it('随从自己高亮时，内部角标和附着预览不应复用宿主描边语义', () => {
        render(
            React.createElement(BaseZone, {
                base: makeBase('base_the_vats', [
                    {
                        ...makeMinion('badge-host', 'pirate_first_mate', '0', 2),
                        powerCounters: 1,
                        powerModifier: 2,
                        attachedActions: [
                            { uid: 'attached-1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: false },
                            { uid: 'attached-2', defId: 'fairies_daisy_chain', ownerId: '0', talentUsed: false },
                        ],
                    },
                ]),
                baseIndex: 0,
                core: makeState(),
                turnOrder: ['0', '1'],
                isDeployMode: false,
                isMyTurn: true,
                myPlayerId: '0',
                isMinionSelectMode: true,
                selectableMinionUids: new Set(['badge-host']),
                dispatch: vi.fn(),
                onClick: vi.fn(),
                onViewMinion: vi.fn(),
                onViewAction: vi.fn(),
                onViewBase: vi.fn(),
                onViewTitan: vi.fn(),
            }),
        );

        const minionCard = document.querySelector('[data-minion-uid="badge-host"]');
        expect(minionCard).not.toBeNull();
        fireEvent.mouseEnter(minionCard as Element);

        const powerBadge = screen.getByTestId('su-minion-power-badge-badge-host');
        const attachedBadgeFace = screen.getByTestId('smashup-attached-badge-face');
        const attachedBadgeCountFace = screen.getByTestId('smashup-attached-badge-count-face');
        const attachedPreview = document.querySelector('[data-attached-action-uid="attached-1"]') as HTMLElement | null;

        expect(powerBadge.className).toContain('border-0');
        expect(powerBadge.className).toContain('shadow-none');
        expect(attachedBadgeFace.className).toContain('border-0');
        expect(attachedBadgeFace.className).toContain('shadow-none');
        expect(attachedBadgeCountFace.className).toContain('border-0');
        expect(attachedPreview).not.toBeNull();
        expect(attachedPreview?.className).toContain('border-slate-200');
        expect(attachedPreview?.className).not.toContain('border-green-300');
        expect(attachedPreview?.className).not.toContain('ring-green-300');
    });

    it('持续行动卡和泰坦高亮时，角标与状态标记也不应复用宿主描边', () => {
        render(
            React.createElement(BaseZone, {
                base: {
                    ...makeBase('base_the_vats'),
                    ongoingActions: [
                        {
                            uid: 'oa1',
                            defId: 'miskatonic_lost_knowledge',
                            ownerId: '0',
                            talentUsed: true,
                            metadata: { powerCounters: 2 },
                        },
                    ],
                },
                baseIndex: 0,
                core: {
                    ...makeState(),
                    titans: [
                        {
                            uid: 'time-box-live',
                            defId: 'time_travelers_time_box',
                            faction: 'time_travelers',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 1,
                            talentUsed: true,
                            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                            metadata: { timeBoxCounters: 5 },
                        },
                    ],
                } as any,
                turnOrder: ['0', '1'],
                isDeployMode: false,
                isMyTurn: true,
                myPlayerId: '0',
                selectableOngoingUids: new Set(['oa1']),
                usableTitanTalentUids: new Set(['time-box-live']),
                dispatch: vi.fn(),
                onClick: vi.fn(),
                onViewMinion: vi.fn(),
                onViewAction: vi.fn(),
                onViewBase: vi.fn(),
                onViewTitan: vi.fn(),
            }),
        );

        const ongoingPowerCounter = screen.getByTestId('su-base-ongoing-power-counter-oa1');
        const ongoingUsedBadge = screen.getByTestId('su-base-ongoing-used-badge-oa1');
        const titanTimeboxCounter = screen.getByTestId('su-base-titan-timebox-counter-time-box-live');
        const titanPowerCounter = screen.getByTestId('su-base-titan-power-counter-time-box-live');
        const titanUsedBadge = screen.getByTestId('su-base-titan-used-badge-time-box-live');

        expect(ongoingPowerCounter.className).toContain('border-0');
        expect(ongoingPowerCounter.className).toContain('shadow-none');
        expect(ongoingPowerCounter.className).toContain('bg-amber-400');
        expect(ongoingUsedBadge.className).toContain('border-0');
        expect(ongoingUsedBadge.className).toContain('shadow-none');
        expect(titanTimeboxCounter.className).toContain('border-0');
        expect(titanTimeboxCounter.className).toContain('shadow-none');
        expect(titanTimeboxCounter.className).toContain('bg-sky-300');
        expect(titanPowerCounter.className).toContain('border-0');
        expect(titanPowerCounter.className).toContain('shadow-none');
        expect(titanPowerCounter.className).toContain('bg-amber-400');
        expect(titanUsedBadge.className).toContain('border-0');
        expect(titanUsedBadge.className).toContain('shadow-none');
    });

    it('PromptOverlay 的卡牌选择模式应始终走 smashup-card-renderer（POD 卡也一样）', () => {
        const interaction = createSimpleChoice(
            'pod-preview-check',
            '0',
            '选择要取回的卡牌',
            [
                {
                    id: 'card-0',
                    label: '僵尸领主',
                    value: { cardUid: 'discard-1', defId: 'zombie_lord_pod' },
                    displayMode: 'card' as const,
                },
            ],
            { sourceId: 'zombie_grave_robbing', targetType: 'generic' },
        );

        render(
            React.createElement(
                ToastProvider,
                null,
                React.createElement(PromptOverlay, {
                    interaction,
                    dispatch: () => undefined,
                    playerID: '0',
                }),
            ),
        );

        const preview = screen.getByTestId('mock-card-preview');
        expect(JSON.parse(preview.getAttribute('data-preview-ref') ?? 'null')).toEqual({
            type: 'renderer',
            rendererId: 'smashup-card-renderer',
            payload: { defId: 'zombie_lord_pod' },
        });
        expect(preview.className).toContain('aspect-[0.714]');
        expect(preview.className).toContain('bg-slate-900');
    });

    it('PromptOverlay 的排序卡牌选项只要带 defId，就应显示对应卡面而不是占位块', async () => {
        const interaction = createSimpleChoice(
            'deck-order-preview-check',
            '0',
            '选择放回牌库顶的顺序',
            [
                {
                    id: 'card-0',
                    label: '召唤',
                    value: { topCardUid: 'top-b', cardUid: 'top-b', defId: 'wizard_summon' },
                    displayMode: 'card' as const,
                },
            ],
            { sourceId: 'vikings_cast_the_runes_order', targetType: 'generic' },
        );

        await act(async () => {
            render(
                React.createElement(
                    ToastProvider,
                    null,
                    React.createElement(PromptOverlay, {
                        interaction,
                        dispatch: () => undefined,
                        playerID: '0',
                    }),
                ),
            );
        });

        const preview = screen.getByTestId('mock-card-preview');
        expect(JSON.parse(preview.getAttribute('data-preview-ref') ?? 'null')).toEqual({
            type: 'renderer',
            rendererId: 'smashup-card-renderer',
            payload: { defId: 'wizard_summon' },
        });
    });

    it('PromptOverlay 响应 simple-choice 时应带上当前 interactionId', () => {
        const dispatch = vi.fn();
        const interaction = createSimpleChoice(
            'prompt-interaction-id-check',
            '0',
            '选择一个选项',
            [
                {
                    id: 'pick-1',
                    label: '选项一',
                    value: { branch: 'a' },
                    displayMode: 'button' as const,
                },
            ],
            { sourceId: 'test_prompt', targetType: 'generic' },
        );

        render(
            React.createElement(
                ToastProvider,
                null,
                React.createElement(PromptOverlay, {
                    interaction,
                    dispatch,
                    playerID: '0',
                }),
            ),
        );

        fireEvent.click(screen.getByRole('button', { name: '选项一' }));

        expect(dispatch).toHaveBeenCalledWith('SYS_INTERACTION_RESPOND', {
            interactionId: 'prompt-interaction-id-check',
            optionId: 'pick-1',
        });
    });

    it('zombie_mall_crawl: 验证选项结构', () => {
        // 准备状态：手牌有 mall_crawl，牌库有多种卡牌
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mc1', 'zombie_mall_crawl', '0', 'action')],
                    deck: [
                        makeCard('dk-w1', 'zombie_walker', '0', 'minion'),
                        makeCard('dk-gd1', 'zombie_grave_digger', '0', 'minion'),
                        makeCard('dk-w2', 'zombie_walker', '0', 'minion'),
                        makeCard('dk-c1', 'pirate_cannon', '0', 'action'),
                    ],
                    discard: [],
                    factions: ['zombies', 'pirates'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
        });
        const state = makeFullMatchState(core);
        const runner = createRunner(state);

        // 打出 mall_crawl
        const r1 = runner.run({
            name: 'mall_crawl UI 验证',
            commands: [{ type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'mc1' } }],
        });

        expect(r1.steps[0]?.success).toBe(true);
        const choice = getSimpleChoicePrompt(r1.finalState);
        expect(choice).toBeDefined();
        expect(choice?.sourceId).toBe('zombie_mall_crawl');

        expect(choice?.title).toBe('ui.zombie_mall_crawl_title');
        expect(choice?.options).toHaveLength(3);
        expect(choice?.options.map(opt => ({
            id: opt.id,
            label: opt.label,
            value: opt.value,
            displayMode: opt.displayMode,
        }))).toEqual([
            {
                id: 'group-0',
                label: '行尸 (×2)',
                value: { defId: 'zombie_walker' },
                displayMode: undefined,
            },
            {
                id: 'group-1',
                label: '掘墓者 (×1)',
                value: { defId: 'zombie_grave_digger' },
                displayMode: undefined,
            },
            {
                id: 'group-2',
                label: '加农炮 (×1)',
                value: { defId: 'pirate_cannon' },
                displayMode: undefined,
            },
        ]);
    });

    it('zombie_lend_a_hand: 验证多选选项结构', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('lh1', 'zombie_lend_a_hand', '0', 'action')],
                    discard: [
                        makeCard('d1', 'zombie_walker', '0', 'minion'),
                        makeCard('d2', 'pirate_cannon', '0', 'action'),
                        makeCard('d3', 'zombie_grave_digger', '0', 'minion'),
                    ],
                    factions: ['zombies', 'pirates'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
        });
        const state = makeFullMatchState(core);
        const runner = createRunner(state);

        const r1 = runner.run({
            name: 'lend_a_hand UI 验证',
            commands: [{ type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'lh1' } }],
        });

        expect(r1.steps[0]?.success).toBe(true);
        const choice = getSimpleChoicePrompt(r1.finalState);
        expect(choice).toBeDefined();

        expect(choice?.title).toBe('ui.zombie_lend_a_hand_title');
        expect(choice?.multi).toEqual({ min: 0, max: 3 });
        expect(choice?.options).toHaveLength(3); // 弃牌堆有 3 张牌
    });

    it('pirate_dinghy: 验证多步链选项结构', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dinghy1', 'pirate_dinghy', '0', 'action')],
                    factions: ['pirates', 'aliens'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('test_base_1', [
                    makeMinion('m1', 'test_minion', '0', 3),
                    makeMinion('m2', 'test_minion', '1', 2),
                ]),
                makeBase('test_base_2', [
                    makeMinion('m3', 'test_minion', '0', 2),
                ]),
            ],
        });
        const state = makeFullMatchState(core);
        const runner = createRunner(state);

        const r1 = runner.run({
            name: 'dinghy UI 验证 - 第一步',
            commands: [{ type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'dinghy1' } }],
        });

        expect(r1.steps[0]?.success).toBe(true);
        const choice1 = getSimpleChoicePrompt(r1.finalState);
        expect(choice1).toBeDefined();

        expect(choice1?.title).toBe('ui.pirate_dinghy_choose_first_title');
        expect(choice1?.sourceId).toBe('pirate_dinghy_choose_first');
        expect(choice1?.options.map(opt => ({
            id: opt.id,
            label: opt.label,
            hasValue: !!opt.value,
        }))).toEqual([
            { id: 'minion-0', label: 'test_minion (力量 3) @ 基地 1', hasValue: true },
            { id: 'minion-1', label: 'test_minion (力量 2) @ 基地 2', hasValue: true },
        ]);
    });
});
