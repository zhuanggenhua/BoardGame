/* @vitest-environment happy-dom */
import React from 'react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import locale from '../../../../public/locales/zh-CN/game-betrayal.json';
import common from '../../../../public/locales/zh-CN/common.json';
import gameLocale from '../../../../public/locales/zh-CN/game.json';
import { GameModeProvider, type GameMode } from '../../../contexts/GameModeContext';
import { UndoProvider } from '../../../contexts/UndoContext';
import { ModalStackProvider } from '../../../contexts/ModalStackContext';
import { ModalStackRoot } from '../../../components/system/ModalStackRoot';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';
import { engineConfig, EXPLORER_CATALOG, type BetrayalCore } from '../game';
import { BETRAYAL_COMMANDS } from '../commands';
import { EndgameScreen } from '../endgameScreen';
import { playMummyScenarioToTraitorVictory } from '../testing/firstScenarioTestUtils';

vi.mock('../../../components/common/media/OptimizedImage', () => ({
  OptimizedImage: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} data-src={src} />,
}));
afterEach(() => { cleanup(); document.getElementById('modal-root')?.remove(); vi.unstubAllGlobals(); });

function loggedState(): MatchState<BetrayalCore> {
  const ids = ['0', '1', '2'];
  const random = createSeededRandom('endgame-log');
  const result = executePipeline(engineConfig, {
    core: engineConfig.domain.setup(ids, random),
    sys: createInitialSystemState(ids, engineConfig.systems, 'endgame-log'),
  }, { type: BETRAYAL_COMMANDS.SELECT_EXPLORER, playerId: '0', payload: { explorerId: EXPLORER_CATALOG[0].explorerId }, timestamp: 1000 }, random, ids);
  expect(result.success).toBe(true);
  expect(result.state.sys.actionLog.entries).toHaveLength(1);
  return { ...result.state, core: playMummyScenarioToTraitorVictory() };
}

async function renderResult(mode: GameMode = 'local', spectator = false, empty = false) {
  const root = document.createElement('div'); root.id = 'modal-root'; document.body.append(root);
  const i18n = i18next.createInstance();
  await i18n.use(initReactI18next).init({ lng: 'zh-CN', defaultNS: 'game-betrayal', resources: { 'zh-CN': { 'game-betrayal': locale, common, game: gameLocale } }, interpolation: { escapeValue: false } });
  const G = loggedState(); if (empty) G.sys.actionLog.entries = [];
  const before = JSON.stringify(G); const dispatch = vi.fn(); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const tree = (state: MatchState<BetrayalCore>, show = true) => <I18nextProvider i18n={i18n}><MemoryRouter><ModalStackProvider>
    {show && <GameModeProvider mode={mode} isSpectator={spectator}><UndoProvider value={{ G: state, dispatch, playerID: spectator ? null : '0', isGameOver: true }}>
      <EndgameScreen core={state.core} matchData={[{ id: 0, name: '阿明' }]} effectiveLocale="zh-CN" />
    </UndoProvider></GameModeProvider>}
    <ModalStackRoot />
  </ModalStackProvider></MemoryRouter></I18nextProvider>;
  const view = render(tree(G));
  fireEvent.click(screen.getByRole('button', { name: '查看结果报告' }));
  return { G, before, dispatch, fetch, rerender: (state = G, show = true) => view.rerender(tree(state, show)) };
}
function openLog() { fireEvent.click(screen.getByRole('button', { name: '日志' })); return screen.getByRole('dialog', { name: '行为日志' }); }

describe('Betrayal result report action log', () => {
  it.each([['local', false], ['online', false], ['online', true]] as const)('opens the existing public log in %s spectator=%s and closes back to the report', async (mode, spectator) => {
    const { G, before, dispatch, fetch } = await renderResult(mode, spectator);
    const dialog = openLog();
    expect(within(dialog).getByText('阿明 选择了探索者')).toBeInTheDocument();
    expect(within(dialog).getByTestId('hud-action-log-row')).toHaveTextContent('阿明');
    expect(dialog).not.toHaveTextContent('roomDiscoveryDeck');
    expect(dialog).not.toHaveTextContent('roomDiscoveryOrderByFloor');
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('betrayal-endgame-ending-stage')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '日志' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '大厅' })).toBeInTheDocument();
    expect(JSON.stringify(G)).toBe(before); expect(dispatch).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the existing empty state and consumes subsequent log updates without copying state', async () => {
    const { G, rerender } = await renderResult('local', false, true);
    expect(openLog()).toHaveTextContent('暂无行为日志');
    rerender({ ...G, sys: { ...G.sys, actionLog: loggedState().sys.actionLog } });
    expect(screen.getByRole('dialog')).toHaveTextContent('阿明 选择了探索者');
  });

  it('supports repeated opening, Escape and backdrop close without returning to narration', async () => {
    await renderResult(); openLog();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openLog();
    fireEvent.click(document.querySelector('.betrayal-endgame-log-backdrop')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '日志' })).toHaveFocus();
    expect(screen.queryByTestId('betrayal-endgame-ending-stage')).not.toBeInTheDocument();
  });

  it('removes the log when its result screen unmounts instead of leaving a stale overlay', async () => {
    const { rerender } = await renderResult(); openLog(); rerender(undefined, false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.getElementById('modal-root')).not.toHaveTextContent('阿明');
  });
});
