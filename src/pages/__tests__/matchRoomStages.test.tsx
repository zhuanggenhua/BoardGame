import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MatchRoomTutorialBoardStage } from '../matchRoomStages';

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>();
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
            i18n: { language: 'zh-CN' },
        }),
    };
});

vi.mock('../matchRoomTutorialStageRuntime', () => ({
    MatchRoomTutorialBoardRuntime: () => <div data-testid="tutorial-runtime">runtime</div>,
}));

describe('MatchRoomTutorialBoardStage', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('多章节教程且未指定 tutorialId 时，先显示章节目录而不是直接进默认章节', () => {
        render(
            <MemoryRouter initialEntries={['/play/qidahen/tutorial']}>
                <Routes>
                    <Route
                        path="/play/:gameId/tutorial"
                        element={(
                            <MatchRoomTutorialBoardStage
                                stage={{
                                    noTutorialText: 'no tutorial',
                                    gameId: 'qidahen',
                                    tutorialId: undefined,
                                    tutorialCatalog: {
                                        defaultTutorialId: 'basic-opening',
                                        tutorials: {
                                            'basic-opening': {
                                                title: '基础回合',
                                                description: '从开局进入并完成一次基础回合。',
                                                manifest: { id: 'basic-opening', steps: [] },
                                            },
                                            'attack-and-battle': {
                                                title: '进攻与野战',
                                                description: '走完一次真实进攻与战斗。',
                                                manifest: { id: 'attack-and-battle', steps: [] },
                                            },
                                        },
                                    },
                                    runtime: null,
                                }}
                            />
                        )}
                    />
                    <Route path="/play/:gameId/tutorial/:tutorialId" element={<div data-testid="navigated" />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('tutorial-catalog-entry-basic-opening')).toBeInTheDocument();
        expect(screen.getByTestId('tutorial-catalog-entry-attack-and-battle')).toBeInTheDocument();
        expect(screen.queryByTestId('tutorial-runtime')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('tutorial-catalog-entry-attack-and-battle'));

        expect(screen.getByTestId('navigated')).toBeInTheDocument();
    });

    it('隐藏教程仍保留路由能力，但不出现在玩家目录里', () => {
        render(
            <MemoryRouter initialEntries={['/play/qidahen/tutorial']}>
                <Routes>
                    <Route
                        path="/play/:gameId/tutorial"
                        element={(
                            <MatchRoomTutorialBoardStage
                                stage={{
                                    noTutorialText: 'no tutorial',
                                    gameId: 'qidahen',
                                    tutorialId: undefined,
                                    tutorialCatalog: {
                                        defaultTutorialId: 'basic-opening',
                                        tutorials: {
                                            'basic-opening': {
                                                title: '开局与完整首回合',
                                                description: '从开局走完一次完整首回合。',
                                                manifest: { id: 'basic-opening', steps: [] },
                                            },
                                            'attack-and-battle': {
                                                title: '进攻与野战',
                                                description: '从进攻一路看到野战与撤退。',
                                                manifest: { id: 'attack-and-battle', steps: [] },
                                            },
                                            'siege-and-occupation': {
                                                title: '攻城与围城',
                                                description: '单独学习城战、围城和占领差异。',
                                                manifest: { id: 'siege-and-occupation', steps: [] },
                                            },
                                            'wheel-shared-cost': {
                                                title: '轮盘分支与发展行动',
                                                description: '补充分支案例。',
                                                manifest: { id: 'wheel-shared-cost', steps: [] },
                                            },
                                            'year-and-characters': {
                                                title: '年中、新年与纪年',
                                                description: '单独学习年度结算链。',
                                                manifest: { id: 'year-and-characters', steps: [] },
                                            },
                                            'korea-and-special-map-rules': {
                                                title: '朝鲜与地图特例',
                                                description: '单独学习朝鲜、水路和山海关。',
                                                manifest: { id: 'korea-and-special-map-rules', steps: [] },
                                            },
                                            'retreat-and-rout': {
                                                title: '战败撤退',
                                                description: '隐藏续章。',
                                                hiddenFromCatalog: true,
                                                manifest: { id: 'retreat-and-rout', steps: [] },
                                            },
                                            'armament-upgrade': {
                                                title: '升级军备',
                                                description: '隐藏续章。',
                                                hiddenFromCatalog: true,
                                                manifest: { id: 'armament-upgrade', steps: [] },
                                            },
                                        },
                                    },
                                    runtime: null,
                                }}
                            />
                        )}
                    />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('tutorial-catalog-entry-basic-opening')).toBeInTheDocument();
        expect(screen.getByTestId('tutorial-catalog-entry-attack-and-battle')).toBeInTheDocument();
        expect(screen.getByTestId('tutorial-catalog-entry-siege-and-occupation')).toBeInTheDocument();
        expect(screen.getByTestId('tutorial-catalog-entry-wheel-shared-cost')).toBeInTheDocument();
        expect(screen.getByTestId('tutorial-catalog-entry-year-and-characters')).toBeInTheDocument();
        expect(screen.getByTestId('tutorial-catalog-entry-korea-and-special-map-rules')).toBeInTheDocument();
        expect(screen.queryByTestId('tutorial-catalog-entry-retreat-and-rout')).not.toBeInTheDocument();
        expect(screen.queryByTestId('tutorial-catalog-entry-armament-upgrade')).not.toBeInTheDocument();
    });

    it('只在多章节教程目录中给完成过的可见章节打勾', () => {
        window.localStorage.setItem('boardgame:tutorial-completion:v1:qidahen', JSON.stringify(['basic-opening']));

        render(
            <MemoryRouter initialEntries={['/play/qidahen/tutorial']}>
                <Routes>
                    <Route
                        path="/play/:gameId/tutorial"
                        element={(
                            <MatchRoomTutorialBoardStage
                                stage={{
                                    noTutorialText: 'no tutorial',
                                    gameId: 'qidahen',
                                    tutorialId: undefined,
                                    tutorialCatalog: {
                                        defaultTutorialId: 'basic-opening',
                                        tutorials: {
                                            'basic-opening': {
                                                title: '基础回合',
                                                description: '从开局进入并完成一次基础回合。',
                                                manifest: { id: 'basic-opening', steps: [] },
                                            },
                                            'attack-and-battle': {
                                                title: '进攻与野战',
                                                description: '走完一次真实进攻与战斗。',
                                                manifest: { id: 'attack-and-battle', steps: [] },
                                            },
                                        },
                                    },
                                    runtime: null,
                                }}
                            />
                        )}
                    />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByTestId('tutorial-catalog-entry-basic-opening')).toHaveTextContent('✓ matchRoom.tutorialCatalog.completed');
        expect(screen.getByTestId('tutorial-catalog-entry-attack-and-battle')).not.toHaveTextContent('matchRoom.tutorialCatalog.completed');
    });

    it('教程目录主题由 stage 模型传入，页面不按具体游戏名分支', () => {
        render(
            <MemoryRouter initialEntries={['/play/custom/tutorial']}>
                <MatchRoomTutorialBoardStage
                    stage={{
                        noTutorialText: 'no tutorial',
                        gameId: 'custom-game',
                        tutorialId: undefined,
                        tutorialCatalogTheme: {
                            className: 'tutorial-catalog-stage--custom',
                            chapterAccents: ['#123456'],
                        },
                        tutorialCatalog: {
                            defaultTutorialId: 'intro',
                            tutorials: {
                                intro: {
                                    title: '入门',
                                    description: '自定义教程。',
                                    manifest: { id: 'intro', steps: [] },
                                },
                                advanced: {
                                    title: '进阶',
                                    description: '第二章。',
                                    manifest: { id: 'advanced', steps: [] },
                                },
                            },
                        },
                        runtime: null,
                    }}
                />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('tutorial-catalog-stage')).toHaveClass('tutorial-catalog-stage--custom');
        expect(screen.getByTestId('tutorial-catalog-entry-intro'))
            .toHaveStyle({ '--tutorial-chapter-accent': '#123456' });
    });
});
