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
        expect(screen.getByTestId('betrayal-mobile-selected-card')).toHaveTextContent('绳索');
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
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('绳索');

        fireEvent.click(screen.getByTestId('betrayal-action-move'));
        expect(screen.getByTestId('betrayal-room-move-target-upper-landing')).toBeInTheDocument();
        expect(screen.getByTestId('betrayal-action-cue')).toHaveTextContent('现在：点绿色房间');

        fireEvent.click(screen.getByTestId('betrayal-room-move-target-upper-landing'));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('移动到上层起始点');
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

    it('能渲染首剧本真实 haunt 态的关键入口', () => {
        renderBoard(createFirstScenarioHauntCore(), {
            playerID: '0',
            matchData: defaultMatchData.slice(0, 3),
        });

        expect(within(screen.getByTestId('betrayal-runtime-header-grid')).getByText('恶兆后')).toBeInTheDocument();
        expect(screen.getAllByText('推荐动作：移动').length).toBeGreaterThan(0);
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
});
