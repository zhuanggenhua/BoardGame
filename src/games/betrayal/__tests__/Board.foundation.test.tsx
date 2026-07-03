/* @vitest-environment happy-dom */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { TutorialProvider } from '../../../contexts/TutorialContext';
import { GameModeProvider } from '../../../contexts/GameModeContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import Board from '../Board';
import {
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    createBetrayalCharacterSelectCore,
    createBetrayalFoundationCore,
} from '../game';
import {
    BETRAYAL_FIXED_RANDOM,
    createBetrayalCommand,
    createFirstScenarioHauntCore,
    createJackSpiritPostReviveAttackReadyCore,
    playFirstScenarioToSurvivorVictory,
} from '../testing/firstScenarioTestUtils';
import gameLocale from '../../../../public/locales/zh-CN/game-betrayal.json';
import commonLocale from '../../../../public/locales/zh-CN/common.json';

type TranslationTree = Record<string, string | TranslationTree>;

function resolveTranslation(tree: TranslationTree, key: string): string | undefined {
    return key.split('.').reduce<string | TranslationTree | undefined>((value, segment) => {
        if (!value || typeof value === 'string') {
            return undefined;
        }
        return value[segment];
    }, tree) as string | undefined;
}

function interpolate(template: string, options?: Record<string, unknown>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token: string) => String(options?.[token] ?? ''));
}

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const [namespace, plainKey] = key.includes(':') ? key.split(':', 2) : ['game-betrayal', key];
            const tree = namespace === 'common' ? commonLocale as TranslationTree : gameLocale as TranslationTree;
            const resolved = resolveTranslation(tree, plainKey);
            return typeof resolved === 'string' ? interpolate(resolved, options) : key;
        },
        i18n: { language: 'zh-CN' },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../../../components/common/media/OptimizedImage', () => ({
    OptimizedImage: ({ src, alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) => (
        <img alt={alt} data-src={src} {...rest} />
    ),
}));

type BoardHarnessProps = {
    initialCore: ReturnType<typeof createBetrayalFoundationCore>;
    playerID?: string;
    matchData?: Array<{ id: number; name: string; isConnected: boolean }>;
};

function stateOf(core: BoardHarnessProps['initialCore']): MatchState<typeof core> {
    return { core, sys: {} as MatchState<typeof core>['sys'] };
}

function HarnessBoard({ initialCore, playerID = '0', matchData }: BoardHarnessProps) {
    const [core, setCore] = React.useState(initialCore);

    const dispatch = React.useCallback(<K extends keyof typeof BETRAYAL_COMMANDS extends infer _ ? string : never>(
        type: K,
        payload: unknown,
    ) => {
        const command = createBetrayalCommand(
            type as never,
            playerID,
            payload as never,
            Date.now(),
        );
        const validation = BetrayalDomain.validate(stateOf(core), command);
        if (!validation.valid) {
            return;
        }
        const nextCore = BetrayalDomain.execute(stateOf(core), command, BETRAYAL_FIXED_RANDOM)
            .reduce((currentCore, event) => BetrayalDomain.reduce(currentCore, event), core);
        setCore(nextCore);
    }, [core, playerID]);

    return (
        <ToastProvider>
            <TutorialProvider>
                <GameModeProvider mode="local">
                    <Board
                        G={{
                            core,
                            sys: {} as MatchState<unknown>['sys'],
                        } as MatchState<Record<string, unknown>>}
                        dispatch={dispatch as never}
                        playerID={playerID}
                        matchData={matchData}
                        isConnected
                    />
                </GameModeProvider>
            </TutorialProvider>
        </ToastProvider>
    );
}

function renderBoard(
    core: MatchState<Record<string, unknown>>['core'],
    options?: {
        playerID?: string;
        matchData?: Array<{ id: number; name: string; isConnected: boolean }>;
    },
) {
    return render(
        <ToastProvider>
            <TutorialProvider>
                <GameModeProvider mode="local">
                    <Board
                        G={{
                            core,
                            sys: {} as MatchState<unknown>['sys'],
                        } as MatchState<Record<string, unknown>>}
                        dispatch={() => {}}
                        playerID={options?.playerID ?? '0'}
                        matchData={options?.matchData}
                        isConnected
                    />
                </GameModeProvider>
            </TutorialProvider>
        </ToastProvider>,
    );
}

const defaultMatchData = [
    { id: 0, name: '测试玩家', isConnected: true },
    { id: 1, name: '队友一', isConnected: true },
    { id: 2, name: '队友二', isConnected: true },
    { id: 3, name: '队友三', isConnected: true },
];

describe('Betrayal Board foundation', () => {
    it('能渲染角色选择屏并提供确认入口', () => {
        renderBoard(createBetrayalCharacterSelectCore(['0', '1', '2']), {
            playerID: '0',
            matchData: defaultMatchData.slice(0, 3),
        });

        expect(screen.getByTestId('betrayal-character-select-screen')).toBeInTheDocument();
        expect(screen.getByText('选择探索者')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-character-confirm')).toHaveTextContent('确认');
    });

    it('能渲染真实运行时基础布局', () => {
        renderBoard(createBetrayalFoundationCore(['0', '1', '2', '3']), {
            playerID: '0',
            matchData: defaultMatchData,
        });

        expect(screen.getByTestId('betrayal-board')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-grid')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-action-explore')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-mobile-dock-explore')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-open-scenario')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-open-active-room-preview')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('等待第一步');
        expect(screen.queryByRole('region', { name: '阶段提示' })).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-mobile-selected-card')).toHaveTextContent('书本');
        expect(screen.getByTestId('betrayal-inventory-row-item')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-inventory-row-omen')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-bottom-teammate-1')).toHaveTextContent('队友一');
    });

    it('真实 reducer 驱动下可以使用物品并进入移动选目标', () => {
        render(
            <HarnessBoard
                initialCore={createBetrayalFoundationCore(['0', '1', '2', '3'])}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-action-use'));
        expect(screen.getByTestId('betrayal-use-status')).toHaveTextContent('本回合已用');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('书本');

        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        expect(screen.getByTestId('betrayal-room-move-target-upper-landing')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-action-cue')).toHaveTextContent('现在：点绿色房间');

        fireEvent.click(screen.getByTestId('betrayal-room-move-target-upper-landing'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('移动到上层起始点');
    });

    it('地图会在真实页面选择已发现板块并放置当前探索者', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [{ id: 'map', name: '地图', kind: 'item' }],
        };
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['map'];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-inventory-map'));
        expect(screen.getByTestId('betrayal-inventory-target-room-selector')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-inventory-target-room-upper-landing'));
        fireEvent.click(screen.getByTestId('betrayal-action-use'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('埋葬地图');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('上层起始点');
        expect(screen.getByTestId('betrayal-room-occupant-upper-landing-0')).toBeInTheDocument();
    });

    it('急救包会在真实页面选择同板块队友并治疗目标', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [{ id: 'medical-kit', name: '急救包', kind: 'item' }],
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'entrance-hall',
                    traits: {
                        ...explorer.traits,
                        might: 1,
                        speed: 1,
                    },
                }
                : explorer
        ));
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['medical-kit'];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-inventory-medical-kit'));
        expect(screen.getByTestId('betrayal-inventory-target-player-selector')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-inventory-target-player-1'));
        fireEvent.click(screen.getByTestId('betrayal-action-use'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('埋葬急救包');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('治疗丽贝卡·艾伦博士的力量和速度和知识和神志');
        expect(screen.queryByTestId('betrayal-inventory-medical-kit')).not.toBeInTheDocument();
    });

    it('骨制钥匙会在真实页面移动模式显示穿墙目标并传入领域命令', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'upper-landing',
            inventory: [{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }],
        };
        core.activeRoomId = 'upper-landing';
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['lockpick-tool'];
        core.movesRemaining = 2;
        core.rooms = core.rooms.map((room) => {
            if (room.id === 'upper-landing') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-west'),
                };
            }
            if (room.id === 'upper-west') {
                return {
                    ...room,
                    name: '图书馆',
                    state: 'discovered',
                    hint: '已发现的相邻上层房间',
                    tags: ['知识', '调查', '图书馆'],
                    discoveryReward: 'event',
                    visualId: 'library',
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-landing'),
                };
            }
            return room;
        });

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        expect(screen.getByTestId('betrayal-room-move-target-upper-west')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-room-move-target-upper-west'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用骨制钥匙穿过墙壁');
    });

    it('面具会在真实页面给同板块队友和怪物分别选择相邻板块', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const teammate = core.otherExplorers.find((explorer) => explorer.playerId === '1')!;
        const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'upper-landing',
            inventory: [{ id: 'mask', name: '面具', kind: 'omen' }],
        };
        core.otherExplorers = [
            { ...teammate, roomId: 'upper-landing' },
            { ...traitor, roomId: 'entrance-hall' },
        ];
        core.monsters = [
            {
                id: 'mask-test-monster',
                name: '杰克之灵',
                portraitAsset: '/assets/games/betrayal/jack-spirit.png',
                roomId: 'upper-landing',
                might: 5,
                speed: 3,
                damage: 0,
            },
        ];
        core.activeRoomId = 'upper-landing';
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['mask'];
        core.movesRemaining = 2;
        core.rooms = core.rooms.map((room) => {
            if (room.id === 'upper-landing') {
                return {
                    ...room,
                    doorways: [
                        ...room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-west'),
                        {
                            edge: 'left' as const,
                            connectsToRoomId: 'upper-west',
                            connectsToEdge: 'right' as const,
                        },
                    ],
                };
            }
            if (room.id === 'upper-west') {
                return {
                    ...room,
                    name: '图书馆',
                    state: 'discovered',
                    hint: '已发现的相邻上层房间',
                    tags: ['知识', '调查', '图书馆'],
                    discoveryReward: 'event',
                    visualId: 'library',
                    doorways: [
                        ...room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-landing'),
                        {
                            edge: 'right' as const,
                            connectsToRoomId: 'upper-landing',
                            connectsToEdge: 'left' as const,
                        },
                    ],
                };
            }
            return room;
        });

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-inventory-mask'));
        expect(screen.getByTestId('betrayal-mask-target-selector')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-mask-target-1-grand-staircase'));
        fireEvent.click(screen.getByTestId('betrayal-mask-target-mask-test-monster-upper-west'));
        fireEvent.click(screen.getByTestId('betrayal-action-use'));

        expect(screen.getByTestId('betrayal-room-occupant-grand-staircase-1')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-monster-upper-west-mask-test-monster')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('面具');
    });

    it('狗会在真实页面选择 4 格内目标并交易多张牌', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const teammate = core.otherExplorers.find((explorer) => explorer.playerId === '1')!;
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [
                { id: 'dog', name: '狗', kind: 'omen' },
                { id: 'medical-kit', name: '急救包', kind: 'item' },
                { id: 'map', name: '地图', kind: 'item' },
            ],
        };
        core.otherExplorers = [
            { ...teammate, roomId: 'upper-landing', inventory: [] },
        ];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['dog', 'medical-kit', 'map'];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-dog-trade-selector')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-dog-trade-card-medical-kit'));
        fireEvent.click(screen.getByTestId('betrayal-dog-trade-card-map'));
        fireEvent.click(screen.getByTestId('betrayal-trade-target-1'));
        fireEvent.click(screen.getByTestId('betrayal-action-trade'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用狗');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('急救包、地图');
    });

    it('圣符和雕像会在真实页面探索入口传入声明', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '阴影扑面',
                text: '阴影扑向你。失去 1 点力量。',
                effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            inventory: [
                { id: 'holy-symbol', name: '圣符', kind: 'omen' },
                { id: 'idol', name: '雕像', kind: 'omen' },
            ],
        };
        core.activeRoomId = 'hallway';
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['holy-symbol', 'idol'];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-explore-options')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-explore-option-holy-symbol'));
        fireEvent.click(screen.getByTestId('betrayal-explore-option-idol'));
        fireEvent.click(screen.getByTestId('betrayal-action-explore'));
        fireEvent.click(screen.getByTestId('betrayal-room-explore-target-ground-north'));

        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('没有抽取或结算事件卡');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('圣符埋葬');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用雕像跳过了事件：阴影扑面');
    });

    it('兔脚会在真实页面展示最近投骰并重掷指定骰子', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 3,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];
        core.usedCardIdsThisTurn = [];
        core.recentRoll = {
            id: 'board-rabbit-foot-roll',
            kind: 'eventTraitCheck',
            playerId: '0',
            sourceTitle: '墙中低语',
            trait: 'knowledge',
            dice: [0, 0, 0],
            passiveBonus: 0,
            latestLabel: '失去 1 点知识',
            consumedRabbitFootCardIds: [],
            branchThresholds: [
                {
                    min: 4,
                    label: '获得 1 点知识',
                    effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                },
                {
                    min: 0,
                    label: '失去 1 点知识',
                    effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' },
                },
            ],
        };
        core.latestDiscovery = {
            kind: 'event',
            title: '墙中低语',
            summary: '即时生效',
            detail: '知识检定 0：失去 1 点知识；知识 -1',
            tone: 'warning',
        };
        core.latestDiscoveryOwnerPlayerId = '0';

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-inventory-rope'));
        expect(screen.getByTestId('betrayal-rabbit-foot-dice')).toHaveTextContent('兔脚');
        expect(screen.getByTestId('betrayal-rabbit-foot-die-1')).toHaveTextContent('0');

        fireEvent.click(screen.getByTestId('betrayal-rabbit-foot-die-1'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用兔脚重掷一颗骰子');
        expect(screen.queryByTestId('betrayal-rabbit-foot-dice')).not.toBeInTheDocument();
    });

    it('运行时房间会读取正式空间规则字段', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const entranceHall = core.rooms.find((room) => room.id === 'entrance-hall');
        const upperLanding = core.rooms.find((room) => room.id === 'upper-landing');
        const hallway = core.rooms.find((room) => room.id === 'hallway');
        const grandStaircase = core.rooms.find((room) => room.id === 'grand-staircase');
        const basementLanding = core.rooms.find((room) => room.id === 'basement-landing');

        expect(entranceHall?.visualId).toBe('startTriple');
        expect(entranceHall?.doorways.map((doorway) => doorway.connectsToRoomId)).not.toContain('basement-landing');
        expect(entranceHall?.doorways.map((doorway) => doorway.connectsToRoomId)).toContain('hallway');
        expect(upperLanding?.visualId).toBe('upperLanding');
        expect(upperLanding?.doorways.some((doorway) => doorway.leadsToFloor === 'ground')).toBe(true);
        expect(hallway?.visualId).toBe('startHallway');
        expect(hallway?.doorways.map((doorway) => doorway.connectsToRoomId)).toEqual(
            expect.arrayContaining(['grand-staircase', 'entrance-hall', 'ground-north', 'ground-south']),
        );
        expect(grandStaircase?.doorways.map((doorway) => doorway.connectsToRoomId)).toContain('basement-landing');
        expect(basementLanding?.doorways.map((doorway) => doorway.connectsToRoomId)).toContain('grand-staircase');
    });

    it('当前房间是神秘电梯时才显示并执行房间效果按钮', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const elevatorRoom = core.rooms.find((room) => room.id === 'upper-landing')!;
        elevatorRoom.name = '神秘电梯';
        elevatorRoom.visualId = 'mysticElevator';
        elevatorRoom.enterEffect = 'mysticElevator';
        core.currentExplorer.roomId = 'upper-landing';
        core.activeRoomId = 'upper-landing';

        const hiddenCheck = renderBoard(createBetrayalFoundationCore(['0', '1', '2', '3']), {
            playerID: '0',
            matchData: defaultMatchData,
        });
        expect(screen.queryByTestId('betrayal-action-roomEffect')).not.toBeInTheDocument();
        hiddenCheck.unmount();

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        const roomEffectButton = screen.getByTestId('betrayal-action-roomEffect');
        expect(roomEffectButton).toHaveTextContent('神秘电梯');

        fireEvent.click(roomEffectButton);
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('神秘电梯');
    });

    it('能渲染首剧本真实 haunt 态的关键入口', () => {
        renderBoard(createFirstScenarioHauntCore(), {
            playerID: '0',
            matchData: defaultMatchData.slice(0, 3),
        });

        expect(within(screen.getByTestId('betrayal-runtime-header-grid')).getByText('恶兆后')).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: '阶段提示' })).not.toBeInTheDocument();
        expect(screen.queryByText('推荐动作：移动')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-action-move')).toHaveTextContent('移动');
        expect(screen.getByTestId('betrayal-room-grid')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-open-scenario')).toBeInTheDocument();
    });

    it('能渲染首剧本真实终局屏', () => {
        renderBoard(playFirstScenarioToSurvivorVictory(), {
            playerID: '0',
            matchData: defaultMatchData.slice(0, 3),
        });

        expect(screen.getByTestId('betrayal-endgame-screen')).toBeInTheDocument();
        expect(screen.getAllByText('幸存者逃脱').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Crimson Jack Returns').length).toBeGreaterThan(0);
        const endgameMain = screen.getByTestId('betrayal-endgame-screen');
        expect(within(endgameMain).getByText('测试玩家')).toBeInTheDocument();
        expect(within(endgameMain).getByText('队友一')).toBeInTheDocument();
    });

    it('叛徒复活后若同房间已有英雄，房间焦点应优先给攻击英雄而不是单一移动目标', () => {
        renderBoard(createJackSpiritPostReviveAttackReadyCore(), {
            playerID: '2',
            matchData: defaultMatchData.slice(0, 3),
        });

        expect(screen.getByTestId('betrayal-room-focus-target')).toHaveTextContent('攻击测试玩家');
        expect(screen.getByTestId('betrayal-action-cue')).toHaveTextContent('现在：点攻击测试玩家');
    });

    it('砍刀会在真实页面攻击入口选择武器并传入攻击命令', () => {
        const core = createFirstScenarioHauntCore();
        const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [{ id: 'hunting-knife', name: '砍刀', kind: 'item' }],
        };
        core.otherExplorers = [
            { ...core.otherExplorers.find((explorer) => explorer.playerId === '1')! },
            { ...traitor, roomId: 'entrance-hall' },
        ];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['hunting-knife'];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData.slice(0, 3)}
            />,
        );

        expect(screen.getByTestId('betrayal-attack-weapon-selector')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-attack-weapon-hunting-knife'));
        fireEvent.click(screen.getByTestId('betrayal-room-focus-target'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用砍刀');
    });

    it('匕首会在真实页面攻击入口选择武器并传入攻击命令', () => {
        const core = createFirstScenarioHauntCore();
        const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [{ id: 'dagger', name: '匕首', kind: 'omen' }],
        };
        core.otherExplorers = [
            { ...core.otherExplorers.find((explorer) => explorer.playerId === '1')! },
            { ...traitor, roomId: 'entrance-hall' },
        ];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['dagger'];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData.slice(0, 3)}
            />,
        );

        expect(screen.getByTestId('betrayal-attack-weapon-selector')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-attack-weapon-dagger'));
        fireEvent.click(screen.getByTestId('betrayal-room-focus-target'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用匕首');
    });

    it('指环会在真实页面攻击入口选择武器并传入攻击命令', () => {
        const core = createFirstScenarioHauntCore();
        const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [{ id: 'ring', name: '指环', kind: 'omen' }],
        };
        core.otherExplorers = [
            { ...core.otherExplorers.find((explorer) => explorer.playerId === '1')! },
            { ...traitor, roomId: 'entrance-hall' },
        ];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['ring'];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData.slice(0, 3)}
            />,
        );

        expect(screen.getByTestId('betrayal-attack-weapon-selector')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-attack-weapon-ring'));
        fireEvent.click(screen.getByTestId('betrayal-room-focus-target'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用指环');
    });
});
