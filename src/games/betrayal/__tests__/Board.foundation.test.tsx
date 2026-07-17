/* @vitest-environment happy-dom */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { TutorialProvider } from '../../../contexts/TutorialContext';
import { GameModeProvider } from '../../../contexts/GameModeContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import Board from '../Board';
import {
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    EXPLORER_CATALOG,
    createBetrayalCharacterSelectCore,
    createBetrayalFoundationCore,
} from '../game';
import {
    applyBetrayalCommand,
    BETRAYAL_FIXED_RANDOM,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createCorpseLootReadyCore,
    createFirstScenarioHauntCore,
    createStartedFirstScenarioCore,
    createJackSpiritPostReviveAttackReadyCore,
    playFirstScenarioToSurvivorVictory,
} from '../testing/firstScenarioTestUtils';
import { BETRAYAL_DISCOVERY_POOLS } from '../scenarioConfig';
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

vi.mock('../../../lib/audio/useGameAudio', () => ({
    playSound: vi.fn(),
    useGameAudio: vi.fn(),
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

function HarnessBoardWithRandom({ initialCore, playerID = '0', matchData }: BoardHarnessProps) {
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
        const nextCore = BetrayalDomain.execute(stateOf(core), command, createBetrayalScriptedRandom(2, 2, 2, 2))
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
        expect(screen.getByTestId('betrayal-character-detail-scroll')).toHaveClass(
            'custom-scrollbar',
            'overflow-y-auto',
            'overflow-x-hidden',
        );
        expect(screen.getByTestId('betrayal-character-selection-grid')).toHaveClass(
            'no-scrollbar',
            'overflow-x-hidden',
            'overflow-y-auto',
        );
        expect(screen.queryByTestId('betrayal-character-mobile-pager')).not.toBeInTheDocument();
        const mobileGrid = screen.getByTestId('betrayal-character-mobile-grid');
        expect(mobileGrid).toHaveClass(
            'grid',
            'grid-cols-3',
            'overflow-x-hidden',
            'overflow-y-auto',
            'no-scrollbar',
        );
        const mobileCharacters = within(mobileGrid);
        expect(mobileCharacters.getByTestId('betrayal-character-card-jaden-jones')).not.toHaveTextContent('已选择');
        expect(mobileCharacters.getByTestId('betrayal-character-card-jaden-jones')).toHaveAttribute('aria-label', expect.stringContaining('已选择'));
        expect(mobileCharacters.getByTestId('betrayal-character-card-jaden-jones')).toHaveTextContent('P1');
        expect(mobileCharacters.getByTestId('betrayal-character-card-jaden-jones-state-outline')).toHaveAttribute('data-highlight-shape', 'pentagon');
        [
            'jaden-jones',
            'rebecca-allen',
            'darryl-highla',
            'oliver-swift',
            'lia-valencia',
            'sam-yin',
        ].forEach((explorerId) => {
            expect(mobileCharacters.getByTestId(`betrayal-character-card-${explorerId}`)).toBeInTheDocument();
        });
        expect(screen.queryByTestId('betrayal-character-mobile-page-label')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-character-page-down')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-character-page-up')).not.toBeInTheDocument();

        const abilitySummary = screen.getByTestId('betrayal-character-ability-summary');
        expect(abilitySummary).toHaveTextContent('特性：');
        expect(abilitySummary).toHaveTextContent('大胆');
        expect(abilitySummary).toHaveTextContent('攻击投掷 +1。');
        expect(abilitySummary).not.toHaveAttribute('title');
        expect(screen.queryByTestId('betrayal-character-ability-trigger')).not.toBeInTheDocument();
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
        expect(screen.getByTestId('betrayal-current-ability')).toHaveTextContent('特性：');
        expect(screen.getByTestId('betrayal-current-ability')).toHaveTextContent(/\S+：\S+/);
        const currentTraits = screen.getByTestId('betrayal-current-traits');
        expect(currentTraits.querySelector('[data-trait-pip-shape="square"]')).toBeInTheDocument();
        expect(within(currentTraits).getByText('力量').parentElement).toHaveClass('text-[#e8b09f]');
        expect(within(currentTraits).getByText('速度').parentElement).toHaveClass('text-[#ebdca1]');
        expect(within(currentTraits).getByText('知识').parentElement).toHaveClass('text-[#cbe4ea]');
        expect(within(currentTraits).getByText('神志').parentElement).toHaveClass('text-[#d9c4ef]');
        const currentBoardToken = screen.getByTestId('betrayal-explorer-figure-token-0');
        const currentPanelToken = screen.getByTestId('betrayal-current-panel-token-0');
        expect(currentPanelToken).toHaveAttribute('data-player-id', currentBoardToken.getAttribute('data-player-id')!);
        expect(currentPanelToken).toHaveAttribute('data-explorer-id', currentBoardToken.getAttribute('data-explorer-id')!);
        expect(currentPanelToken).toHaveAttribute('data-token-asset', currentBoardToken.getAttribute('data-token-asset')!);
        expect(currentTraits).toHaveAttribute('data-player-id', currentBoardToken.getAttribute('data-player-id')!);
        expect(currentTraits).toHaveAttribute('data-explorer-id', currentBoardToken.getAttribute('data-explorer-id')!);
        expect(currentTraits).toHaveAttribute('data-token-asset', currentBoardToken.getAttribute('data-token-asset')!);
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('等待第一步');
        expect(screen.queryByRole('region', { name: '阶段提示' })).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-mobile-selected-card')).toHaveTextContent('未选卡牌');
        expect(screen.getByTestId('betrayal-action-use')).toBeDisabled();
        expect(screen.getByTestId('betrayal-inventory-row-item')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-inventory-row-omen')).toBeInTheDocument();
        expect(document.querySelector('[data-resource-count-shape="square"]')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-bottom-teammate-1')).toHaveTextContent('队友一');
        expect(screen.getByTestId('betrayal-bottom-teammate-1').querySelector('[data-trait-value-shape="square"]')).toBeInTheDocument();
        const teammatePanel = screen.getByTestId('betrayal-bottom-teammate-1');
        const teammatePanelToken = screen.getByTestId('betrayal-bottom-teammate-token-1');
        expect(teammatePanelToken).toHaveAttribute('data-player-id', teammatePanel.getAttribute('data-player-id')!);
        expect(teammatePanelToken).toHaveAttribute('data-explorer-id', teammatePanel.getAttribute('data-explorer-id')!);
        expect(teammatePanelToken).toHaveAttribute('data-token-asset', teammatePanel.getAttribute('data-token-asset')!);
        const desktopTeammatePanel = screen.getByTestId('betrayal-teammate-panel-1');
        const desktopTeammatePanelToken = screen.getByTestId('betrayal-teammate-panel-token-1');
        expect(desktopTeammatePanelToken).toHaveAttribute('data-player-id', desktopTeammatePanel.getAttribute('data-player-id')!);
        expect(desktopTeammatePanelToken).toHaveAttribute('data-explorer-id', desktopTeammatePanel.getAttribute('data-explorer-id')!);
        expect(desktopTeammatePanelToken).toHaveAttribute('data-token-asset', desktopTeammatePanel.getAttribute('data-token-asset')!);
        expect(desktopTeammatePanel).toHaveAttribute('data-player-id', teammatePanel.getAttribute('data-player-id')!);
        expect(desktopTeammatePanel).toHaveAttribute('data-explorer-id', teammatePanel.getAttribute('data-explorer-id')!);
        expect(desktopTeammatePanel).toHaveAttribute('data-token-asset', teammatePanel.getAttribute('data-token-asset')!);
    });

    it('探索者棋子素材不使用眩晕或化猫这类错误 token，并支持查看详情', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: core.currentExplorer.roomId }
                : explorer
        ));

        renderBoard(core, {
            playerID: '0',
            matchData: defaultMatchData,
        });

        const rebecca = EXPLORER_CATALOG.find((explorer) => explorer.explorerId === 'rebecca-allen')!;
        const darryl = EXPLORER_CATALOG.find((explorer) => explorer.explorerId === 'darryl-highla')!;
        expect(rebecca.tokenAsset).toBeUndefined();
        expect(darryl.tokenAsset).toBeUndefined();
        expect(screen.getByTestId('betrayal-bottom-teammate-1')).toHaveAttribute('data-token-asset', rebecca.portraitAsset);
        expect(screen.getByTestId('betrayal-bottom-teammate-2')).toHaveAttribute('data-token-asset', darryl.portraitAsset);

        fireEvent.click(screen.getByTestId('betrayal-bottom-teammate-1'));
        expect(screen.getByTestId('betrayal-explorer-detail-dialog-1')).toHaveTextContent('队友一');
        expect(screen.getByTestId('betrayal-explorer-detail-dialog-1')).toHaveAttribute('data-token-asset', rebecca.portraitAsset);
        fireEvent.click(screen.getByTestId('betrayal-explorer-detail-close'));

        fireEvent.click(screen.getByTestId(`betrayal-room-occupant-${core.currentExplorer.roomId}-1`));
        expect(screen.getByTestId('betrayal-explorer-detail-dialog-1')).toHaveTextContent('丽贝卡·艾伦博士');
        expect(screen.getByTestId('betrayal-explorer-detail-token-1')).toHaveAttribute('data-token-asset', rebecca.portraitAsset);
    });

    it('局内首剧本查阅打开当前剧本书页并支持翻页', () => {
        renderBoard(createBetrayalFoundationCore(['0', '1', '2', '3']), {
            playerID: '0',
            matchData: defaultMatchData,
        });

        fireEvent.click(screen.getByTestId('betrayal-open-scenario'));

        expect(screen.getByTestId('betrayal-scenario-objective-page')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-scenario-book')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-scenario-book-page-dossier-opening')).toHaveTextContent('山屋异象');
        expect(screen.getByTestId('betrayal-scenario-book-page-dossier-heroes')).toHaveTextContent('英雄手册');
        expect(screen.getByTestId('betrayal-scenario-reader-page-label-desktop-left')).toHaveTextContent('01');
        expect(screen.queryByTestId('betrayal-reference-card-image')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-scenario-reader-next-zone'));

        expect(screen.getByTestId('betrayal-scenario-reader-page-label-desktop-left')).toHaveTextContent('03');
        expect(screen.getByTestId('betrayal-scenario-book-page-dossier-exorcism')).toHaveTextContent('最终驱魔');
        expect(screen.getByTestId('betrayal-scenario-book-page-dossier-traitor')).toHaveTextContent('杰克之灵');
    });

    it('第一剧本真实图书馆不在 upper-west 时也能显示调查杰克入口', async () => {
        const core = createFirstScenarioHauntCore();
        const actor = {
            ...core.currentExplorer,
            roomId: 'upper-north',
        };
        core.currentExplorer = actor;
        core.currentExplorerTraits = { ...actor.traits };
        core.currentExplorerInventory = [...actor.inventory];
        core.activeRoomId = 'upper-north';
        core.recommendedAction = 'use';
        core.rooms = core.rooms.map((room) => {
            if (room.id === 'upper-west') {
                return {
                    ...room,
                    name: '书房',
                    visualId: 'study',
                    tags: ['知识', '调查'],
                };
            }
            if (room.id === 'upper-north') {
                return {
                    ...room,
                    name: '图书馆',
                    state: 'discovered',
                    discoveryReward: null,
                    visualId: 'library',
                    tags: ['知识', '调查', '图书馆'],
                };
            }
            return room;
        });

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-action-use')).toHaveTextContent('调查杰克');
        fireEvent.click(screen.getByTestId('betrayal-action-use'));

        await waitFor(() => {
            expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('图书馆');
            expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('Crimson Jack');
        });
    });

    it('第一剧本已掌握线索的英雄仍可在图书馆帮队友调查杰克', async () => {
        const core = createFirstScenarioHauntCore();
        const actor = {
            ...core.currentExplorer,
            roomId: 'upper-west',
        };
        core.currentExplorer = actor;
        core.currentExplorerTraits = { ...actor.traits };
        core.currentExplorerInventory = [...actor.inventory];
        core.activeRoomId = 'upper-west';
        core.currentExplorerRoomId = 'upper-west';
        core.recommendedAction = 'use';
        core.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-action-use')).toHaveTextContent('调查杰克');
        fireEvent.click(screen.getByTestId('betrayal-action-use'));

        await waitFor(() => {
            expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('Crimson Jack');
            expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('丽贝卡·艾伦博士');
            expect(screen.getByTestId('betrayal-bottom-teammate-knowledge-1')).toHaveTextContent('掌握杰克线索');
        });
    });

    it('第一剧本杰克之灵同房时没有法阵也会从页面入口尝试驱魔', async () => {
        const core = createFirstScenarioHauntCore();
        const actor = {
            ...core.currentExplorer,
            roomId: 'upper-north',
            traits: {
                ...core.currentExplorer.traits,
                sanity: 1,
            },
        };
        core.currentExplorer = actor;
        core.currentExplorerTraits = { ...actor.traits };
        core.currentExplorerInventory = [...actor.inventory];
        core.activeRoomId = 'upper-north';
        core.currentExplorerRoomId = 'upper-north';
        core.recommendedAction = 'use';
        core.scenarioRuntime.exorcismCircleRoomIds = [];
        core.scenarioRuntime.jackSpiritReleased = true;
        core.scenarioRuntime.jackSpiritRoomId = 'upper-north';
        core.monsters = [{
            id: 'jack-spirit',
            name: '杰克之灵',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId: 'upper-north',
            might: 5,
            speed: 3,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }];

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-action-use')).toHaveTextContent('驱魔');
        fireEvent.click(screen.getByTestId('betrayal-action-use'));

        await waitFor(() => {
            expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('驱魔');
            expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('反扑');
        });
    });

    it('真实 reducer 驱动下可以使用物品并进入移动选目标', () => {
        render(
            <HarnessBoard
                initialCore={createBetrayalFoundationCore(['0', '1', '2', '3'])}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-mobile-selected-card')).toHaveTextContent('未选卡牌');
        expect(screen.getByTestId('betrayal-action-use')).toBeDisabled();
        fireEvent.click(screen.getByTestId('betrayal-inventory-omen-book'));
        expect(screen.getByTestId('betrayal-mobile-selected-card')).toHaveTextContent('书本');
        expect(screen.getByTestId('betrayal-inventory-omen-book-shell')).toHaveAttribute('data-selected-outline', 'true');
        expect(screen.getByTestId('betrayal-inventory-omen-book-selected-outline')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-inventory-omen-book-selected-outline')).toHaveAttribute('data-highlight-shape', 'card');
        expect(screen.getByTestId('betrayal-action-use')).not.toBeDisabled();

        fireEvent.click(screen.getByTestId('betrayal-action-use'));
        expect(screen.getByTestId('betrayal-use-status')).toHaveTextContent('本回合已用');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('书本');

        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        fireEvent.click(screen.getByTestId('betrayal-room-floor-up'));
        expect(screen.getByTestId('betrayal-room-upper-landing')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-action-cue')).toHaveTextContent('现在：点绿色房间');

        fireEvent.click(screen.getByTestId('betrayal-room-upper-landing'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('移动到上层起始点');
    });

    it('持有区卡牌本体只负责选择，独立放大镜负责打开大图', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-inventory-rope'));
        expect(screen.getByTestId('betrayal-inventory-rope')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('betrayal-inventory-preview-overlay')).not.toBeVisible();

        fireEvent.click(screen.getByTestId('betrayal-inventory-rope-magnify'));
        expect(screen.getByTestId('betrayal-inventory-preview-overlay')).toBeVisible();
        expect(screen.getByTestId('betrayal-inventory-preview-card')).toHaveTextContent('兔脚');
    });

    it.each([
        ['map', '地图'],
        ['notebook', '笔记本'],
        ['journal', '日记'],
        ['manuscript', '手稿'],
    ] as const)('%s 会在真实页面选择已发现板块并放置当前探索者', (cardId, cardName) => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [{ id: cardId, name: cardName, kind: 'item' }],
        };
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = [cardId];

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId(`betrayal-inventory-${cardId}`));
        expect(screen.getByTestId('betrayal-selected-inventory-card-name')).toHaveTextContent(cardName);
        expect(screen.getByTestId('betrayal-inventory-target-room-selector')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-floor-up')).toBeEnabled();
        fireEvent.click(screen.getByTestId('betrayal-room-floor-up'));
        expect(screen.getByTestId('betrayal-room-inventory-target-card-highlight-upper-landing')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-room-upper-landing'));
        fireEvent.click(screen.getByTestId('betrayal-action-use'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent(`埋葬${cardName}`);
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
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-inventory-medical-kit'));
        expect(screen.getByTestId('betrayal-inventory-target-player-selector')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-1')).toHaveAttribute('data-highlight-shape', 'pentagon');
        fireEvent.click(screen.getByTestId('betrayal-room-occupant-entrance-hall-1'));
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
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        expect(screen.getByTestId('betrayal-room-upper-west')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-room-upper-west'));
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

        expect(screen.getByTestId('betrayal-room-floor-down')).toBeEnabled();
        fireEvent.click(screen.getByTestId('betrayal-room-floor-down'));
        expect(screen.getByTestId('betrayal-room-mask-target-card-highlight-grand-staircase')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-room-grand-staircase'));
        fireEvent.click(screen.getByTestId('betrayal-room-floor-up'));
        expect(screen.getByTestId('betrayal-room-monster-upper-landing-mask-test-monster')).toHaveAttribute('data-direct-target', 'true');
        expect(screen.getByTestId('betrayal-room-monster-target-outline-upper-landing-mask-test-monster')).toHaveAttribute('data-highlight-shape', 'token');
        fireEvent.click(screen.getByTestId('betrayal-room-monster-upper-landing-mask-test-monster'));
        fireEvent.click(screen.getByTestId('betrayal-room-upper-west'));
        fireEvent.click(screen.getByTestId('betrayal-action-use'));

        fireEvent.click(screen.getByTestId('betrayal-room-floor-down'));
        expect(screen.getByTestId('betrayal-room-occupant-grand-staircase-1')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-room-floor-up'));
        expect(screen.getByTestId('betrayal-room-monster-upper-west-mask-test-monster')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('面具');
        expect(screen.queryByTestId('betrayal-selected-inventory-card-name')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-mask-target-selector')).not.toBeInTheDocument();
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
        fireEvent.click(screen.getByTestId('betrayal-room-floor-up'));
        expect(screen.getByTestId('betrayal-room-occupant-target-outline-upper-landing-1')).toHaveAttribute('data-highlight-shape', 'pentagon');
        fireEvent.click(screen.getByTestId('betrayal-room-occupant-upper-landing-1'));
        fireEvent.click(screen.getByTestId('betrayal-action-trade'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用狗');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('急救包、地图');
    });

    it('搜尸必须在真实页面选择尸体和具体持有物，不能默认拿第一张', async () => {
        render(
            <HarnessBoard
                initialCore={createCorpseLootReadyCore()}
                playerID="1"
                matchData={defaultMatchData.slice(0, 3)}
            />,
        );

        expect(screen.getByTestId('betrayal-action-trade')).toHaveTextContent('搜尸');
        fireEvent.click(screen.getByTestId('betrayal-action-trade'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).not.toHaveTextContent('拿走');

        expect(screen.getByTestId('betrayal-room-occupant-target-outline-hallway-0')).toHaveAttribute('data-highlight-shape', 'pentagon');
        fireEvent.click(screen.getByTestId('betrayal-room-occupant-hallway-0'));
        expect(screen.getByTestId('betrayal-corpse-loot-card-selector')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-corpse-loot-card-corpse-omen-1'));
        fireEvent.click(screen.getByTestId('betrayal-action-trade'));

        await waitFor(() => {
            expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('拿走了黑暗预兆');
        });
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
        expect(screen.getByTestId('betrayal-room-explore-target-ground-north')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-room-ground-north'));

        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('没有抽取或结算事件卡');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('圣符埋葬');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用雕像跳过了事件：阴影扑面');
    });

    it('探索只在进入选择态后高亮未知房间，并在发现结束回合后置灰', async () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.drawOrder = ['item'];
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'armory')!,
        ];
        core.possessionOrderByKind.item = [
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'hunting-knife')!,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            inventory: [],
        };
        core.activeRoomId = 'hallway';
        core.currentExplorerInventory = [];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.queryByTestId('betrayal-room-explore-target-ground-north')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-action-explore')).not.toBeDisabled();

        fireEvent.click(screen.getByTestId('betrayal-action-explore'));
        expect(screen.getByTestId('betrayal-room-explore-target-ground-north')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-room-ground-north'));

        await waitFor(() => {
            expect(screen.getByTestId('betrayal-action-explore')).toBeDisabled();
        });
        expect(screen.queryByTestId('betrayal-room-explore-target-ground-north')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('探索到器械库');
    });

    it('器械库会在真实页面展示发现结果并把武器放入持有区', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.drawOrder = ['item'];
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'armory')!,
        ];
        core.possessionOrderByKind.item = [
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'medical-kit')!,
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'hunting-knife')!,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            inventory: [],
        };
        core.activeRoomId = 'hallway';
        core.currentExplorerInventory = [];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-action-explore'));
        fireEvent.click(screen.getByTestId('betrayal-room-ground-north'));

        expect(screen.getByTestId('betrayal-discovery-panel')).toHaveAttribute(
            'aria-label',
            expect.stringContaining('物品牌 砍刀'),
        );
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('已加入持有区');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('探索到器械库');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('拿到了砍刀');
        expect(screen.getByTestId('betrayal-inventory-hunting-knife-armory-0-1')).toBeInTheDocument();
    });

    it('圣符预兆翻出后同屏显示作祟检定骰盘', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.drawOrder = ['omen'];
        core.possessionOrderByKind.omen = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            inventory: [],
        };
        core.activeRoomId = 'hallway';
        core.currentExplorerInventory = [];
        const expectedHauntDiceCount = 1 + [core.currentExplorer, ...core.otherExplorers]
            .reduce((count, explorer) => count + explorer.inventory.filter((card) => card.kind === 'omen').length, 0);

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        fireEvent.click(screen.getByTestId('betrayal-action-explore'));
        fireEvent.click(screen.getByTestId('betrayal-room-ground-north'));

        expect(screen.getByTestId('betrayal-discovery-panel')).toHaveAttribute(
            'aria-label',
            expect.stringContaining('预兆牌 圣符'),
        );
        expect(screen.getByTestId('betrayal-discovery-card-front-atlas')).toHaveAttribute(
            'data-atlas-frame-index',
            '4',
        );
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('作祟检定');
        expect(screen.getByTestId('betrayal-recent-roll-panel')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute(
            'data-dice-count',
            String(expectedHauntDiceCount),
        );
        expect(screen.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute(
            'data-dice-rule-subtotal',
            String(expectedHauntDiceCount),
        );
        expect(screen.getByTestId('betrayal-recent-roll-result-stage')).toHaveAttribute(
            'data-result-layout',
            'split-primary-total',
        );
        expect(screen.getByTestId('betrayal-recent-roll-total')).toHaveAttribute(
            'data-result-emphasis',
            'primary-total',
        );
        expect(screen.getByTestId('betrayal-recent-roll-breakdown')).toContainElement(
            screen.getByTestId('betrayal-recent-roll-subtotal'),
        );
        expect(screen.getByTestId('betrayal-recent-roll-breakdown')).toContainElement(
            screen.getByTestId('betrayal-recent-roll-passive-bonus'),
        );
        expect(screen.getByTestId('betrayal-recent-roll-subtotal')).toBeInTheDocument();
    });

    it('持有物卡片会暴露主动、被动和特殊触发规则摘要，避免误判为空效果', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'camera', name: '魔法相机', kind: 'item' },
                { id: 'armor', name: '盔甲', kind: 'omen' },
                { id: 'radio', name: '头戴耳机', kind: 'item' },
                { id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' },
            ],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-inventory-skull-shell')).toHaveAttribute(
            'data-rules-summary',
            expect.stringContaining('濒死时投 3 骰'),
        );
        expect(screen.getByTestId('betrayal-inventory-camera-shell')).toHaveAttribute(
            'data-rules-summary',
            expect.stringContaining('说茄子'),
        );
        expect(screen.getByTestId('betrayal-inventory-armor-shell')).toHaveAttribute(
            'data-rules-summary',
            expect.stringContaining('受到物理伤害 -1'),
        );
        expect(screen.getByTestId('betrayal-inventory-radio-shell')).toHaveAttribute(
            'data-rules-summary',
            expect.stringContaining('受到精神伤害 -1'),
        );
        expect(screen.getByTestId('betrayal-inventory-lockpick-tool-shell')).toHaveAttribute(
            'data-rules-summary',
            expect.stringContaining('穿过一格同层相邻墙体'),
        );
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

        const discoveryPanel = screen.getByTestId('betrayal-discovery-panel');
        expect(discoveryPanel).toHaveAttribute('data-backdrop-dismiss', 'disabled');
        fireEvent.click(discoveryPanel);
        expect(screen.getByTestId('betrayal-discovery-panel')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-recent-roll-panel')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-inventory-rope'));
        expect(screen.getByTestId('betrayal-rabbit-foot-dice')).toHaveTextContent('选择要重掷的骰子');
        expect(Number(screen.getByTestId('betrayal-rabbit-foot-dice').getAttribute('data-reroll-target-count'))).toBeGreaterThan(0);
        expect(screen.getByTestId('betrayal-house-dice-reroll-target-1')).toHaveAttribute('data-reroll-target-source', 'fallback-projection');

        fireEvent.click(screen.getByTestId('betrayal-house-dice-reroll-target-1'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用兔脚重掷第 2 颗骰子');
        expect(screen.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-rerolling-die-index', '1');
        expect(screen.queryByTestId('betrayal-rabbit-foot-dice')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-panel')).toHaveAttribute('data-backdrop-dismiss', 'enabled');
        fireEvent.click(screen.getByTestId('betrayal-discovery-panel'));
        expect(screen.queryByTestId('betrayal-discovery-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-recent-roll-panel')).not.toBeInTheDocument();
    });

    it('普通投骰结果没有可改骰时点击空白关闭，点击骰盘内容不关闭', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [],
        };
        core.currentExplorerInventory = [];
        core.turnStartInventoryCardIds = [];
        core.usedCardIdsThisTurn = [];
        core.latestDiscovery = null;
        core.latestDiscoveryOwnerPlayerId = null;
        core.recentRoll = {
            id: 'board-open-roll-backdrop-close',
            kind: 'mysticElevator',
            playerId: '0',
            sourceTitle: '神秘电梯',
            rollLabel: '房间移动',
            dice: [1, 1],
            passiveBonus: 0,
            latestLabel: '移动到未探索',
            consumedRabbitFootCardIds: [],
        };

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        const backdrop = screen.getByTestId('betrayal-roll-result-backdrop');
        expect(backdrop).toHaveAttribute('data-backdrop-dismiss', 'enabled');
        fireEvent.click(screen.getByTestId('betrayal-roll-result-dock'));
        expect(screen.getByTestId('betrayal-recent-roll-panel')).toBeInTheDocument();
        fireEvent.click(backdrop);
        expect(screen.queryByTestId('betrayal-recent-roll-panel')).not.toBeInTheDocument();
    });

    it('普通投骰结果仍可改骰时点击空白不关闭，只能用明确按钮关闭', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];
        core.usedCardIdsThisTurn = [];
        core.latestDiscovery = null;
        core.latestDiscoveryOwnerPlayerId = null;
        core.recentRoll = {
            id: 'board-roll-modifier-requires-button-close',
            kind: 'roomEndTurnTraitCheck',
            playerId: '0',
            sourceTitle: '倒塌房间',
            trait: 'speed',
            rollLabel: '速度检定',
            dice: [0, 0, 0],
            passiveBonus: 0,
            latestLabel: '坠落到地下室起始点',
            consumedRabbitFootCardIds: [],
        };

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        const backdrop = screen.getByTestId('betrayal-roll-result-backdrop');
        expect(backdrop).toHaveAttribute('data-backdrop-dismiss', 'disabled');
        fireEvent.click(backdrop);
        expect(screen.getByTestId('betrayal-recent-roll-panel')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-roll-continue'));
        expect(screen.queryByTestId('betrayal-recent-roll-panel')).not.toBeInTheDocument();
    });

    it('结束回合投骰未确认前阻塞行动链，点击继续后才切到下一位玩家', async () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'basement-landing',
            inventory: [],
        };
        core.currentPlayer = '0';
        core.activeRoomId = core.currentExplorer.roomId;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core.turnStartInventoryCardIds = [];
        core.usedCardIdsThisTurn = [];
        core.latestDiscovery = null;
        core.latestDiscoveryOwnerPlayerId = null;
        core.recommendedAction = 'endTurn';
        core.recentRoll = {
            id: 'pending-room-end-turn-roll',
            kind: 'roomEndTurnTraitCheck',
            playerId: '0',
            sourceTitle: '倒塌房间',
            trait: 'speed',
            rollLabel: '速度检定',
            dice: [0, 0, 0],
            passiveBonus: 0,
            latestLabel: '坠落到地下室起始点',
            roomEndTurn: {
                kind: 'speedCheckFallToBasement',
                roomName: '倒塌房间',
                roomId: 'upper-north',
                originalRoomId: 'upper-north',
                traitsBeforeEffect: { ...core.currentExplorer.traits },
                previousPhysicalDamage: 1,
                previousDestinationRoomId: 'basement-landing',
                nextPlayerId: '1',
                monsterMovementRoll: null,
                turnLogText: '轮到玩家 2',
            },
            consumedRabbitFootCardIds: [],
        };

        render(
            <HarnessBoard
                initialCore={core}
                playerID="0"
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-roll-result-backdrop')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-recent-roll-panel')).toHaveTextContent('倒塌房间');
        expect(screen.getByTestId('betrayal-current-panel-token-0')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-roll-continue'));
        await waitFor(() => {
            expect(screen.queryByTestId('betrayal-recent-roll-panel')).not.toBeInTheDocument();
        });

        expect(screen.getByTestId('betrayal-current-panel-token-1')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-action-endTurn')).toBeInTheDocument();
    });

    it('攻击投骰结果没有可改骰时点击空白关闭', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const defender = core.otherExplorers[0]!;
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [],
        };
        core.currentExplorerInventory = [];
        core.turnStartInventoryCardIds = [];
        core.usedCardIdsThisTurn = [];
        core.latestDiscovery = null;
        core.latestDiscoveryOwnerPlayerId = null;
        core.recentRoll = {
            id: 'board-attack-roll-backdrop-close',
            kind: 'attackRoll',
            playerId: '0',
            sourceTitle: '攻击投骰',
            rollLabel: '攻击投骰',
            dice: [2, 2, 0, 0],
            passiveBonus: 0,
            latestLabel: '造成 2 点伤害',
            consumedRabbitFootCardIds: [],
            attack: {
                target: 'hero',
                defenderPlayerId: defender.playerId,
                damageKind: 'physical',
                previousDamageToAttacker: 0,
                previousDamageToDefender: 2,
                defenderRoll: 2,
                attackerTraitsBeforeDamage: { ...core.currentExplorer.traits },
                defenderTraitsBeforeDamage: { ...defender.traits },
            },
        };

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        const backdrop = screen.getByTestId('betrayal-roll-review-backdrop');
        expect(backdrop).toHaveAttribute('data-backdrop-dismiss', 'enabled');
        fireEvent.click(screen.getByTestId('betrayal-attack-roll-review'));
        expect(screen.getByTestId('betrayal-recent-roll-panel')).toBeInTheDocument();
        fireEvent.click(backdrop);
        expect(screen.queryByTestId('betrayal-recent-roll-panel')).not.toBeInTheDocument();
    });

    it('驱魔投骰结果没有可改骰时点击空白关闭', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [],
        };
        core.currentExplorerInventory = [];
        core.turnStartInventoryCardIds = [];
        core.usedCardIdsThisTurn = [];
        core.latestDiscovery = null;
        core.latestDiscoveryOwnerPlayerId = null;
        core.recentRoll = {
            id: 'board-exorcise-roll-backdrop-close',
            kind: 'hauntActionTraitCheck',
            playerId: '0',
            sourceTitle: '驱魔',
            trait: 'sanity',
            rollLabel: '神志检定',
            dice: [0, 0, 0],
            passiveBonus: 0,
            latestLabel: '驱魔失败',
            consumedRabbitFootCardIds: [],
        };

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        const backdrop = screen.getByTestId('betrayal-roll-review-backdrop');
        expect(backdrop).toHaveAttribute('data-backdrop-dismiss', 'enabled');
        fireEvent.click(screen.getByTestId('betrayal-exorcise-roll-review'));
        expect(screen.getByTestId('betrayal-recent-roll-panel')).toBeInTheDocument();
        fireEvent.click(backdrop);
        expect(screen.queryByTestId('betrayal-recent-roll-panel')).not.toBeInTheDocument();
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

    it('房间障碍物标记会显示在对应房间格上', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const hallway = core.rooms.find((room) => room.id === 'hallway')!;
        hallway.markerTokens = ['obstacle'];

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        const marker = screen.getByTestId('betrayal-room-marker-hallway-obstacle');
        expect(marker).toBeInTheDocument();
        expect(within(marker).getByAltText('障碍物')).toHaveAttribute('data-src', 'betrayal/markers/obstacle');
    });

    it('地图主视区默认只显示当前楼层，避免同坐标跨楼层房间叠住', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const upperLanding = core.rooms.find((room) => room.id === 'upper-landing')!;
        const grandStaircase = core.rooms.find((room) => room.id === 'grand-staircase')!;
        const basementLanding = core.rooms.find((room) => room.id === 'basement-landing')!;
        upperLanding.x = 2;
        upperLanding.y = 1;
        grandStaircase.x = 2;
        grandStaircase.y = 1;
        basementLanding.x = 2;
        basementLanding.y = 1;
        core.currentExplorer.roomId = 'upper-landing';
        core.activeRoomId = 'upper-landing';
        core.otherExplorers[0]!.roomId = 'grand-staircase';
        core.otherExplorers[1]!.roomId = 'upper-landing';
        core.otherExplorers[2]!.roomId = 'upper-landing';

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-room-floor-upper')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('betrayal-room-floor-up')).toBeDisabled();
        expect(screen.getByTestId('betrayal-room-floor-down')).not.toBeDisabled();
        expect(screen.getByTestId('betrayal-room-shell-upper-landing')).toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-room-shell-grand-staircase')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-room-shell-basement-landing')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('betrayal-room-floor-down'));
        expect(screen.getByTestId('betrayal-room-floor-ground')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('betrayal-room-shell-grand-staircase')).toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-room-shell-upper-landing')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-room-shell-basement-landing')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-floor-up')).not.toBeDisabled();
        expect(screen.getByTestId('betrayal-room-floor-down')).toBeDisabled();

        fireEvent.click(screen.getByTestId('betrayal-room-floor-down'));
        expect(screen.getByTestId('betrayal-room-floor-ground')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByTestId('betrayal-room-floor-basement')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-room-shell-basement-landing')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-room-shell-upper-landing')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-shell-grand-staircase')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-floor-up')).not.toBeDisabled();
        expect(screen.getByTestId('betrayal-room-floor-down')).toBeDisabled();
    });

    it('其他玩家接手行动时不自动把地图楼层拉到对方位置', async () => {
        const core = createBetrayalFoundationCore(['0', '1', '2']);
        const playerZero = core.currentExplorer;
        const playerOne = core.otherExplorers.find((explorer) => explorer.playerId === '1')!;
        const playerTwo = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core.currentExplorer = { ...playerOne, roomId: 'grand-staircase' };
        core.otherExplorers = [
            { ...playerZero, roomId: 'upper-landing' },
            { ...playerTwo, roomId: 'basement-landing' },
        ];
        core.currentPlayer = '1';
        core.activeRoomId = 'grand-staircase';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.movesRemaining = 0;

        render(
            <HarnessBoard
                initialCore={core}
                playerID="1"
                matchData={defaultMatchData.slice(0, 3)}
            />,
        );

        expect(screen.getByTestId('betrayal-room-floor-ground')).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByTestId('betrayal-room-floor-up'));
        expect(screen.getByTestId('betrayal-room-floor-upper')).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByTestId('betrayal-action-endTurn'));

        await waitFor(() => {
            expect(screen.getByTestId('betrayal-room-floor-upper')).toHaveAttribute('aria-pressed', 'true');
        });
        expect(screen.getByTestId('betrayal-room-shell-upper-landing')).toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-room-shell-basement-landing')).not.toBeInTheDocument();
    });

    it('移动模式会把跨层相邻房间所在楼层加入切换链并允许移动', async () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const upperLanding = core.rooms.find((room) => room.id === 'upper-landing')!;
        const grandStaircase = core.rooms.find((room) => room.id === 'grand-staircase')!;
        const basementLanding = core.rooms.find((room) => room.id === 'basement-landing')!;
        upperLanding.x = 2;
        upperLanding.y = 1;
        grandStaircase.x = 2;
        grandStaircase.y = 1;
        basementLanding.x = 2;
        basementLanding.y = 1;
        core.currentExplorer.roomId = 'upper-landing';
        core.activeRoomId = 'upper-landing';
        core.otherExplorers[0]!.roomId = 'upper-landing';
        core.otherExplorers[1]!.roomId = 'upper-landing';
        core.otherExplorers[2]!.roomId = 'upper-landing';

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-room-floor-upper')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('betrayal-room-floor-down')).not.toBeDisabled();
        fireEvent.click(screen.getByTestId('betrayal-room-floor-down'));
        expect(screen.getByTestId('betrayal-room-floor-ground')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('betrayal-room-shell-grand-staircase')).toBeInTheDocument();
        const grandStaircaseButton = screen.getByTestId('betrayal-room-grand-staircase');
        expect(grandStaircaseButton).toBeDisabled();

        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        expect(grandStaircaseButton).not.toBeDisabled();
        fireEvent.click(grandStaircaseButton);

        await waitFor(() => {
            expect(screen.getByTestId('betrayal-room-floor-ground')).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByTestId('betrayal-room-occupant-grand-staircase-0')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('betrayal-room-floor-upper')).not.toBeInTheDocument();
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

    it('结束回合房间效果会提前提示并在结算后反馈', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const furnaceRoom = core.rooms.find((room) => room.id === 'upper-landing')!;
        furnaceRoom.name = '火炉房';
        furnaceRoom.visualId = 'furnaceRoom';
        furnaceRoom.endTurnEffect = 'physicalDamage1';
        core.currentExplorer.roomId = 'upper-landing';
        core.activeRoomId = 'upper-landing';
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-room-end-turn-effect-status')).toHaveTextContent('火炉房');
        expect(screen.getByTestId('betrayal-room-end-turn-effect-status')).toHaveTextContent('1 点物理伤害');
        expect(screen.getByTestId('betrayal-room-end-turn-effect-hint')).toHaveTextContent('结束回合受伤');
        expect(screen.getByTestId('betrayal-action-endTurn')).toHaveTextContent('结束回合');
        expect(screen.getByTestId('betrayal-action-endTurn')).not.toHaveTextContent('结算房间');

        fireEvent.click(screen.getByTestId('betrayal-action-endTurn'));

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('火炉房');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('1 点物理伤害');
    });

    it('洗衣滑槽会提示结束回合移动到地下室起始点', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const chuteRoom = core.rooms.find((room) => room.id === 'upper-landing')!;
        chuteRoom.name = '洗衣滑槽';
        chuteRoom.visualId = 'laundryChute';
        chuteRoom.endTurnEffect = 'moveToBasementLanding';
        core.currentExplorer.roomId = 'upper-landing';
        core.activeRoomId = 'upper-landing';

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-room-end-turn-effect-status')).toHaveTextContent('洗衣滑槽');
        expect(screen.getByTestId('betrayal-room-end-turn-effect-status')).toHaveTextContent('地下室起始点');
        fireEvent.click(screen.getByTestId('betrayal-action-endTurn'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('洗衣滑槽');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('地下室起始点');
    });

    it('倒塌房间会提示结束回合速度检定并反馈坠落结算', () => {
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        const collapsedRoom = core.rooms.find((room) => room.id === 'upper-landing')!;
        collapsedRoom.name = '倒塌房间';
        collapsedRoom.visualId = 'collapsedRoom';
        collapsedRoom.endTurnEffect = 'speedCheckFallToBasement';
        core.currentExplorer.roomId = 'upper-landing';
        core.activeRoomId = 'upper-landing';
        core.currentExplorer.traits.speed = 1;

        render(
            <HarnessBoard
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-room-end-turn-effect-status')).toHaveTextContent('倒塌房间');
        expect(screen.getByTestId('betrayal-room-end-turn-effect-status')).toHaveTextContent('投速度');
        expect(screen.getByTestId('betrayal-room-end-turn-effect-hint')).toHaveTextContent('结束回合检定');
        fireEvent.click(screen.getByTestId('betrayal-action-endTurn'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('倒塌房间');
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('坠落到地下室起始点');
    });

    it('能渲染首剧本真实 haunt 态的关键入口', () => {
        renderBoard(createFirstScenarioHauntCore(), {
            playerID: '0',
            matchData: defaultMatchData.slice(0, 3),
        });

        expect(screen.getByTestId('betrayal-phase-chip')).toHaveTextContent('恶兆后');
        expect(screen.queryByRole('region', { name: '阶段提示' })).not.toBeInTheDocument();
        expect(screen.queryByText('推荐动作：移动')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-action-move')).toHaveTextContent('移动');
        expect(screen.queryByTestId('betrayal-action-explore')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-mobile-dock-explore')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-explore-options')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-room-grid')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-open-scenario')).toBeInTheDocument();
    });

    it('能渲染首剧本真实终局屏', () => {
        renderBoard(playFirstScenarioToSurvivorVictory(), {
            playerID: '0',
            matchData: defaultMatchData.slice(0, 3),
        });

        if (screen.queryByTestId('betrayal-exorcise-roll-continue')) {
            fireEvent.click(screen.getByTestId('betrayal-exorcise-roll-continue'));
        }

        expect(screen.getByTestId('betrayal-endgame-screen')).toBeInTheDocument();
        expect(screen.getAllByText('幸存者逃脱').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Crimson Jack Returns').length).toBeGreaterThan(0);
        const endgameMain = screen.getByTestId('betrayal-endgame-screen');
        expect(within(endgameMain).getByText('测试玩家')).toBeInTheDocument();
        expect(within(endgameMain).getByText('队友一')).toBeInTheDocument();
        expect(endgameMain.querySelector('[data-trait-value-shape="square"]')).toBeInTheDocument();
    });

    it('叛徒复活后若同房间已有英雄，必须点击英雄对象而不是自动代选目标', async () => {
        render(
            <HarnessBoard
                initialCore={createJackSpiritPostReviveAttackReadyCore()}
                playerID="2"
                matchData={defaultMatchData.slice(0, 3)}
            />,
        );

        expect(screen.queryByTestId('betrayal-room-focus-target')).not.toBeInTheDocument();
        const heroToken = screen.getByTestId('betrayal-room-occupant-basement-east-0');
        expect(heroToken).toHaveAttribute('data-direct-target', 'true');
        expect(screen.getByTestId('betrayal-room-occupant-target-outline-basement-east-0')).toHaveAttribute('data-highlight-shape', 'pentagon');
        fireEvent.click(heroToken);
        await waitFor(() => {
            expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('扑向英雄');
        });
    });

    it('头骨死亡保护会在真实页面显示死亡保护骰盘与最终存活反馈', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'ground-north' });
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, inventory: [{ id: 'skull', name: '头骨', kind: 'omen' }] }
                : explorer
        ));
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 1, 1, 1, 1, 3, 3, 1),
        );

        renderBoard(core, {
            playerID: '0',
            matchData: defaultMatchData.slice(0, 3),
        });

        expect(screen.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute('data-dice-count', '3');
        expect(screen.getByTestId('betrayal-recent-roll-detail')).toHaveTextContent('骰子合计 4');
        expect(screen.getByTestId('betrayal-recent-roll-total')).toHaveTextContent('总点数 4');
        expect(screen.getAllByText('头骨死亡保护').length).toBeGreaterThan(0);
        expect(screen.getAllByText('阻止死亡').length).toBeGreaterThan(0);
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('头骨投出 4，阻止死亡');
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
        const traitorToken = screen.getByTestId('betrayal-room-occupant-entrance-hall-2');
        expect(traitorToken).toHaveAttribute('data-direct-target', 'true');
        expect(screen.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-2')).toHaveAttribute('data-highlight-shape', 'pentagon');
        fireEvent.click(traitorToken);

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
        const traitorToken = screen.getByTestId('betrayal-room-occupant-entrance-hall-2');
        expect(traitorToken).toHaveAttribute('data-direct-target', 'true');
        expect(screen.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-2')).toHaveAttribute('data-highlight-shape', 'pentagon');
        fireEvent.click(traitorToken);

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
        const traitorToken = screen.getByTestId('betrayal-room-occupant-entrance-hall-2');
        expect(traitorToken).toHaveAttribute('data-direct-target', 'true');
        expect(screen.getByTestId('betrayal-room-occupant-target-outline-entrance-hall-2')).toHaveAttribute('data-highlight-shape', 'pentagon');
        fireEvent.click(traitorToken);

        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('使用指环');
    });

    it('普通投骰事件牌会在真实页面同屏承接牌面、骰盘和分支结果', () => {
        const ordinaryRollEvents = [
            '标本剥制',
            '外星几何',
            '小丑房间',
            '咬一口！',
            '电话铃声',
            '小机器人',
            '嘎吱的木门',
            '最深的壁橱',
            '磁带播放器',
            '在你背后！',
            '一种怪异的感觉',
            '葬礼',
        ];

        for (const eventName of ordinaryRollEvents) {
            const eventCard = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName);
            expect(eventCard?.roll).toBeTruthy();

            const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
            core.drawOrder = ['event'];
            core.eventOrder = [eventCard!];
            core.currentExplorer = {
                ...core.currentExplorer,
                roomId: 'hallway',
                traits: {
                    ...core.currentExplorer.traits,
                    might: 4,
                    speed: 4,
                    knowledge: 4,
                    sanity: 4,
                },
                inventory: [],
            };
            core.activeRoomId = 'hallway';
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.currentExplorerInventory = [];

            const view = render(
                <HarnessBoardWithRandom
                    initialCore={core}
                    matchData={defaultMatchData}
                />,
            );

            fireEvent.click(screen.getByTestId('betrayal-action-explore'));
            fireEvent.click(screen.getByTestId('betrayal-room-ground-north'));

            expect(screen.getByTestId('betrayal-discovery-panel')).toHaveAttribute(
                'aria-label',
                expect.stringContaining(eventName),
            );
            expect(screen.getByTestId('betrayal-discovery-panel')).toHaveAttribute(
                'data-card-testid',
                'betrayal-discovery-card-reveal',
            );
            const discoveryDetailText = screen.getByTestId('betrayal-discovery-detail').textContent ?? '';
            expect(discoveryDetailText).toMatch(/检定|投|骰/);
            expect(
                eventCard!.roll!.branches.some((branch) => discoveryDetailText.includes(branch.label)),
            ).toBe(true);
            expect(screen.getByTestId('betrayal-house-dice-3d-group')).toHaveAttribute(
                'data-dice-count',
                String(eventCard!.roll!.kind === 'dice' ? eventCard!.roll!.dice : 4),
            );
            expect(screen.getByTestId('betrayal-recent-roll-result-stage')).toHaveAttribute(
                'data-result-layout',
                'split-primary-total',
            );
            expect(screen.getByTestId('betrayal-recent-roll-breakdown')).toContainElement(
                screen.getByTestId('betrayal-recent-roll-subtotal'),
            );
            expect(screen.getByTestId('betrayal-recent-roll-subtotal')).toBeInTheDocument();

            view.unmount();
        }
    });

    it('上古旧宅待选事件能在真实页面选择属性、目标板块和通用伤害', () => {
        const oldMansion = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '上古旧宅');
        expect(oldMansion?.effect).toBeTruthy();
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            traits: {
                ...core.currentExplorer.traits,
                speed: 4,
                might: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.activeRoomId = 'hallway';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core.pendingEventChoice = {
            id: 'test-old-mansion-choice',
            playerId: '0',
            sourceTitle: '上古旧宅',
            effect: oldMansion!.effect!,
        };

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        const eventChoicePanel = screen.getByTestId('betrayal-event-choice-panel');
        expect(eventChoicePanel).toHaveAttribute('aria-label', '上古旧宅');
        expect(eventChoicePanel).toHaveAttribute('data-layout', 'main-stage');
        expect(eventChoicePanel).toHaveAttribute('data-surface', 'open-table');
        expect(screen.getByTestId('betrayal-event-choice-card-front-atlas')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-event-choice-trait-might')).toHaveClass('min-h-[76px]');
        fireEvent.click(screen.getByTestId('betrayal-event-choice-trait-might'));
        expect(screen.getByTestId('betrayal-room-event-choice-target-hallway')).toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-event-choice-damage-might')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-room-hallway'));
        expect(screen.getByTestId('betrayal-event-choice-damage-might')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-event-choice-damage-might'));
        fireEvent.click(screen.getByTestId('betrayal-event-choice-confirm'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('力量检定');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('放置到门厅');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('通用伤害 1（力量）');
    });

    it('肉质苔癣待选事件能在真实页面跳过可选效果', () => {
        const fleshMoss = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣');
        expect(fleshMoss?.effect).toBeTruthy();
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.pendingEventChoice = {
            id: 'test-flesh-moss-choice',
            playerId: '0',
            sourceTitle: '肉质苔癣',
            acceptLabel: '大口吸入芳香',
            declineLabel: '不吸入芳香',
            effect: fleshMoss!.effect!,
        };

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-event-choice-panel')).toHaveAttribute('aria-label', '肉质苔癣');
        expect(screen.getByTestId('betrayal-event-choice-confirm')).toHaveTextContent('大口吸入芳香');
        fireEvent.click(screen.getByTestId('betrayal-event-choice-decline'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('无事发生');
    });

    it('大宅饿了待选事件能在真实页面选择属性并跳过作祟检定', () => {
        const hungryHouse = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了');
        expect(hungryHouse?.effect).toBeTruthy();
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.pendingEventChoice = {
            id: 'test-hungry-house-choice',
            playerId: '0',
            sourceTitle: '大宅饿了',
            acceptLabel: '进行作祟检定',
            declineLabel: '跳过作祟检定',
            effect: hungryHouse!.effect!,
        };

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-event-choice-panel')).toHaveAttribute('aria-label', '大宅饿了');
        fireEvent.click(screen.getByTestId('betrayal-event-choice-trait-knowledge'));
        fireEvent.click(screen.getByTestId('betrayal-event-choice-decline'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('知识 +1');
    });

    it('蜘蛛！真实探索先神志检定，并在待选项同屏保留投骰结果', () => {
        const spider = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '蜘蛛！');
        expect(spider?.roll?.trait).toBe('sanity');
        let core = createStartedFirstScenarioCore(['0', '1', '2', '3']);
        core.drawOrder = ['event'];
        core.eventOrder = [spider!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                sanity: 4,
                speed: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.title).toBe('蜘蛛！');
        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.recentRoll?.trait).toBe('sanity');
        expect(core.recentRoll?.sourceTitle).toBe('蜘蛛！');
        expect(core.recentRoll?.latestLabel).toContain('获得 1 点神志或速度');
        expect(core.pendingEventChoice?.sourceTitle).toBe('蜘蛛！');

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        const eventChoicePanel = screen.getByTestId('betrayal-event-choice-panel');
        expect(eventChoicePanel).toHaveAttribute('aria-label', '蜘蛛！');
        const rollPanel = screen.getByTestId('betrayal-recent-roll-panel');
        expect(rollPanel).toHaveTextContent('神志检定');
        expect(rollPanel).toHaveTextContent('总点数 4');
        expect(rollPanel).toHaveTextContent('获得 1 点神志或速度');
        fireEvent.click(screen.getByTestId('betrayal-event-choice-trait-speed'));
        expect(screen.getByTestId('betrayal-room-event-choice-target-hallway')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-room-hallway'));
        fireEvent.click(screen.getByTestId('betrayal-event-choice-confirm'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-panel')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-recent-roll-panel')).toHaveTextContent('神志检定');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('速度 +1');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('放置到门厅');
        fireEvent.click(screen.getByTestId('betrayal-discovery-continue'));
        expect(screen.queryByTestId('betrayal-discovery-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('betrayal-recent-roll-panel')).not.toBeInTheDocument();
    });

    it('吊死鬼待选事件能在真实页面选择奖励属性', () => {
        const hangingTree = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '吊死鬼');
        expect(hangingTree?.effect?.mode).toBe('allTraitChecks');
        const hangingTreeEffect = hangingTree!.effect!;
        if (hangingTreeEffect.mode !== 'allTraitChecks') {
            throw new Error('吊死鬼应为四项属性检定事件');
        }
        const passedResults = hangingTreeEffect.traits.map((trait) => ({
            trait,
            total: 6,
            dice: [2, 2, 2],
            passiveBonus: 0,
            passed: true,
        }));
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.recentAllTraitCheck = {
            sourceTitle: '吊死鬼',
            playerId: '0',
            results: passedResults,
        };
        core.pendingEventChoice = {
            id: 'test-hanging-tree-trait-choice',
            playerId: '0',
            sourceTitle: '吊死鬼',
            effect: {
                ...hangingTreeEffect,
                results: passedResults,
            },
        };

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-event-choice-panel')).toHaveAttribute('aria-label', '吊死鬼');
        expect(screen.getByTestId('betrayal-event-choice-all-trait-check')).toHaveTextContent('四项属性检定');
        expect(screen.getByTestId('betrayal-event-choice-confirm')).toBeDisabled();
        fireEvent.click(screen.getByTestId('betrayal-event-choice-trait-knowledge'));
        expect(screen.getByTestId('betrayal-event-choice-confirm')).not.toBeDisabled();
        fireEvent.click(screen.getByTestId('betrayal-event-choice-confirm'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('知识 +1');
    });

    it('一条秘密通道待选事件能在真实页面选择第二目标板块', () => {
        const secretPassage = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一条秘密通道');
        expect(secretPassage?.roll?.branches).toBeTruthy();
        const successBranch = secretPassage!.roll!.branches.find((branch) => branch.min === 5);
        expect(successBranch?.effect).toBeTruthy();
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'ground-north',
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
            },
            inventory: [],
        };
        core.activeRoomId = 'ground-north';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core.pendingEventChoice = {
            id: 'test-secret-passage-room-choice',
            playerId: '0',
            sourceTitle: '一条秘密通道',
            effect: successBranch!.effect,
        };

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-event-choice-panel')).toHaveAttribute('aria-label', '一条秘密通道');
        expect(screen.getByTestId('betrayal-room-event-choice-target-hallway')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('betrayal-room-hallway'));
        fireEvent.click(screen.getByTestId('betrayal-event-choice-confirm'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('在当前板块放置秘密通道标志物');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('在门厅放置秘密通道标志物');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('知识 +1');
    });

    it('脑状食品待选事件能在真实页面选择奖励属性和通用伤害属性', () => {
        const brainFood = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品');
        expect(brainFood?.roll?.branches).toBeTruthy();
        const rewardBranch = brainFood!.roll!.branches.find((branch) => branch.min === 5);
        const damageBranch = brainFood!.roll!.branches.find((branch) => branch.min === 0);
        expect(rewardBranch?.effect).toBeTruthy();
        expect(damageBranch?.effect).toBeTruthy();

        const rewardCore = createBetrayalFoundationCore(['0', '1', '2', '3']);
        rewardCore.pendingEventChoice = {
            id: 'test-brain-food-reward-choice',
            playerId: '0',
            sourceTitle: '脑状食品',
            effect: rewardBranch!.effect,
        };

        const rewardRender = render(
            <HarnessBoardWithRandom
                initialCore={rewardCore}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-event-choice-panel')).toHaveAttribute('aria-label', '脑状食品');
        fireEvent.click(screen.getByTestId('betrayal-event-choice-trait-speed'));
        fireEvent.click(screen.getByTestId('betrayal-event-choice-confirm'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('速度 +1');
        rewardRender.unmount();

        const damageCore = createBetrayalFoundationCore(['0', '1', '2', '3']);
        damageCore.pendingEventChoice = {
            id: 'test-brain-food-damage-choice',
            playerId: '0',
            sourceTitle: '脑状食品',
            effect: damageBranch!.effect,
        };

        render(
            <HarnessBoardWithRandom
                initialCore={damageCore}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-event-choice-panel')).toHaveAttribute('aria-label', '脑状食品');
        fireEvent.click(screen.getByTestId('betrayal-event-choice-damage-might'));
        fireEvent.click(screen.getByTestId('betrayal-event-choice-damage-knowledge'));
        fireEvent.click(screen.getByTestId('betrayal-event-choice-confirm'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('通用伤害 2（力量、知识）');
    });

    it('夜幕众星待选事件能在真实页面选择检定属性', () => {
        const nightStars = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '夜幕众星');
        expect(nightStars?.effect).toBeTruthy();
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core.pendingEventChoice = {
            id: 'test-night-stars-trait-choice',
            playerId: '0',
            sourceTitle: '夜幕众星',
            effect: nightStars!.effect!,
        };

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-event-choice-panel')).toHaveAttribute('aria-label', '夜幕众星');
        expect(screen.queryByTestId('betrayal-recent-roll-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-event-choice-confirm')).toBeDisabled();
        fireEvent.click(screen.getByTestId('betrayal-event-choice-trait-knowledge'));
        expect(screen.getByTestId('betrayal-event-choice-confirm')).not.toBeDisabled();
        fireEvent.click(screen.getByTestId('betrayal-event-choice-confirm'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-recent-roll-panel')).toHaveTextContent('知识检定');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('知识检定');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('知识 -1');
    });

    it('一抹鲜红待选事件能在真实页面跳过作祟检定并结算伤害', () => {
        const crimsonSplash = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一抹鲜红');
        expect(crimsonSplash?.effect).toBeTruthy();
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.pendingEventChoice = {
            id: 'test-crimson-splash-choice',
            playerId: '0',
            sourceTitle: '一抹鲜红',
            acceptLabel: '进行作祟检定',
            declineLabel: '跳过作祟检定',
            effect: crimsonSplash!.effect!,
        };

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-event-choice-panel')).toHaveAttribute('aria-label', '一抹鲜红');
        fireEvent.click(screen.getByTestId('betrayal-event-choice-decline'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('物理伤害');
    });

    it('一瓶微尘待选事件能在真实页面跳过作祟检定并结算双属性变化', () => {
        const dustyVial = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一瓶微尘');
        expect(dustyVial?.effect).toBeTruthy();
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.pendingEventChoice = {
            id: 'test-dusty-vial-choice',
            playerId: '0',
            sourceTitle: '一瓶微尘',
            acceptLabel: '进行作祟检定',
            declineLabel: '跳过作祟检定',
            effect: dustyVial!.effect!,
        };

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-event-choice-panel')).toHaveAttribute('aria-label', '一瓶微尘');
        fireEvent.click(screen.getByTestId('betrayal-event-choice-decline'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('力量 -1');
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('神志 +1');
    });

    it('说“茄子”！待选事件能在真实页面跳过作祟检定并抽取物品', () => {
        const sayCheese = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '说“茄子”！');
        expect(sayCheese?.effect).toBeTruthy();
        const core = createBetrayalFoundationCore(['0', '1', '2', '3']);
        core.possessionOrderByKind.item = [{ id: 'camera', name: '魔法相机', kind: 'item' }];
        core.currentExplorer.inventory = [];
        core.currentExplorerInventory = [];
        core.pendingEventChoice = {
            id: 'test-say-cheese-choice',
            playerId: '0',
            sourceTitle: '说“茄子”！',
            acceptLabel: '进行作祟检定',
            declineLabel: '跳过作祟检定',
            effect: sayCheese!.effect!,
        };

        render(
            <HarnessBoardWithRandom
                initialCore={core}
                matchData={defaultMatchData}
            />,
        );

        expect(screen.getByTestId('betrayal-event-choice-panel')).toHaveAttribute('aria-label', '说“茄子”！');
        fireEvent.click(screen.getByTestId('betrayal-event-choice-decline'));

        expect(screen.queryByTestId('betrayal-event-choice-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('betrayal-discovery-detail')).toHaveTextContent('抽取一张物品卡');
        expect(within(screen.getByTestId('betrayal-inventory-row-item')).getByText('魔法相机')).toBeInTheDocument();
    });
});
