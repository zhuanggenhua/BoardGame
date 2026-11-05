import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MatchRoomPageShell } from '../matchRoomPageShell';
import type { MatchRoomPageShellModel } from '../matchRoomPageModelBuilders';

vi.mock('react-i18next', async importOriginal => ({
    ...await importOriginal<typeof import('react-i18next')>(),
    useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}));
vi.mock('../../components/common/SEO', () => ({ SEO: () => null }));
vi.mock('../../core', () => ({ UI_Z_INDEX: { loading: 100 } }));
vi.mock('../../core/cursor', () => ({ GameCursorProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('../../games/pageRuntimeAdapter', () => ({ GamePageRuntimeProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('../../components/game/framework/widgets/GameHUD', () => ({ GameHUD: () => null }));
vi.mock('../../components/game/framework', () => ({
    MobileBoardShell: ({ children }: { children: ReactNode }) => <div data-testid="mobile-board-shell">{children}</div>,
}));
vi.mock('../matchRoomTutorialStageRuntime', () => ({ MatchRoomTutorialBoardRuntime: () => <div>教程牌桌</div> }));
vi.mock('../matchRoomOnlineStageRuntime', () => ({ MatchRoomOnlineBoardRuntime: () => <div>联机牌桌</div> }));

const buildShell = (): MatchRoomPageShellModel => ({
    gameId: 'dicethrone', rootDataAttributes: {}, seoTitle: '教程', showSpectatorShield: false,
    boardShellStyle: {}, boardShell: { Provider: ({ children }) => <>{children}</> },
    cursorPlayerID: '0', tutorialHud: null, onlineStage: null,
    tutorialStage: {
        gameId: 'dicethrone', noTutorialText: '没有教程牌桌', runtime: null,
        tutorialCatalog: {
            defaultTutorialId: 'main',
            tutorials: {
                main: { title: '完整回合', manifest: { id: 'main', steps: [] } },
                response: { title: '响应练习', manifest: { id: 'response', steps: [] } },
            },
        },
    },
});

const mount = (shell: MatchRoomPageShellModel) => render(<MemoryRouter><MatchRoomPageShell shell={shell} /></MemoryRouter>);

describe('MatchRoomPageShell 页面与牌桌的缩放边界', () => {
    it('选课目录使用真实页面尺寸，避免被手机牌桌壳缩小文字', () => {
        mount(buildShell());
        expect(screen.getByTestId('tutorial-catalog-stage')).toBeInTheDocument();
        expect(screen.queryByTestId('mobile-board-shell')).not.toBeInTheDocument();
    });

    it('指定课程后仍进入原来的牌桌缩放壳', () => {
        const shell = buildShell();
        shell.tutorialStage!.tutorialId = 'main';
        mount(shell);
        expect(screen.getByTestId('mobile-board-shell')).toBeInTheDocument();
        expect(screen.queryByTestId('tutorial-catalog-stage')).not.toBeInTheDocument();
    });

    it.each(['single', 'hidden'] as const)('只有一门可见课程时保留原直接进入行为：%s', mode => {
        const shell = buildShell();
        if (mode === 'single') delete shell.tutorialStage!.tutorialCatalog!.tutorials.response;
        else shell.tutorialStage!.tutorialCatalog!.tutorials.response.hiddenFromCatalog = true;
        mount(shell);
        expect(screen.getByTestId('mobile-board-shell')).toBeInTheDocument();
        expect(screen.queryByTestId('tutorial-catalog-stage')).not.toBeInTheDocument();
    });

    it('保留其它游戏目录的主题与章节覆盖', () => {
        const shell = buildShell();
        shell.gameId = 'qidahen';
        shell.tutorialStage!.gameId = 'qidahen';
        shell.tutorialStage!.tutorialCatalogTheme = { className: 'tutorial-catalog-stage--custom', chapterAccents: ['#123456'] };
        mount(shell);
        expect(screen.getByTestId('tutorial-catalog-stage')).toHaveClass('tutorial-catalog-stage--custom');
        expect(screen.getByTestId('tutorial-catalog-entry-response')).toHaveTextContent('响应练习');
        expect(screen.queryByTestId('mobile-board-shell')).not.toBeInTheDocument();
    });

    it('联机页面继续使用牌桌缩放壳', () => {
        const shell = buildShell();
        shell.tutorialStage = null;
        shell.onlineStage = { noClientText: '没有联机客户端', runtime: null };
        mount(shell);
        expect(screen.getByTestId('mobile-board-shell')).toBeInTheDocument();
        expect(screen.getByText('没有联机客户端')).toBeInTheDocument();
    });
});
