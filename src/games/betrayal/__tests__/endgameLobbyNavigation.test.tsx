/* @vitest-environment happy-dom */
import React from 'react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import locale from '../../../../public/locales/zh-CN/game-betrayal.json';
import common from '../../../../public/locales/zh-CN/common.json';
import { GameModeProvider, type GameMode } from '../../../contexts/GameModeContext';
import { MatchRoomExitProvider } from '../../../contexts/MatchRoomExitContext';
import { EndgameScreen } from '../endgameScreen';
import { playMummyScenarioToTraitorVictory } from '../testing/firstScenarioTestUtils';

vi.mock('../../../components/common/media/OptimizedImage', () => ({
  OptimizedImage: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} data-src={src} />,
}));
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

async function renderResult(mode: GameMode, isSpectator = false, exitToLobby?: () => void | Promise<void>) {
  const i18n = i18next.createInstance();
  await i18n.use(initReactI18next).init({
    lng: 'zh-CN', defaultNS: 'game-betrayal',
    resources: { 'zh-CN': { 'game-betrayal': locale, common } },
    interpolation: { escapeValue: false },
  });
  const core = playMummyScenarioToTraitorVictory();
  const before = JSON.stringify(core);
  const endgame = <GameModeProvider mode={mode} isSpectator={isSpectator}>
    <EndgameScreen core={core} effectiveLocale="zh-CN" />
  </GameModeProvider>;
  render(<I18nextProvider i18n={i18n}><MemoryRouter initialEntries={['/play/betrayal/match/old']}><Routes>
    <Route path="/play/betrayal/match/old" element={exitToLobby
      ? <MatchRoomExitProvider value={{ exitToLobby }}>{endgame}</MatchRoomExitProvider> : endgame} />
    <Route path="/" element={<div data-testid="lobby-destination">Lobby</div>} />
  </Routes></MemoryRouter></I18nextProvider>);
  return { core, before };
}

function openReport() { fireEvent.click(screen.getByRole('button', { name: '查看结果报告' })); }

describe('Betrayal result report Lobby action', () => {
  it.each([['local', false], ['online', false], ['online', true]] as const)(
    'returns to the lobby from %s spectator=%s without changing the game or credentials', async (mode, spectator) => {
      const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
      localStorage.setItem('match_creds_old', 'synthetic-retained-record');
      const { core, before } = await renderResult(mode, spectator);
      expect(screen.queryByTestId('lobby-destination')).not.toBeInTheDocument();
      openReport();
      fireEvent.click(screen.getByRole('button', { name: '大厅' }));
      expect(screen.getByTestId('lobby-destination')).toBeInTheDocument();
      expect(screen.queryByTestId('betrayal-endgame-screen')).not.toBeInTheDocument();
      expect(document.documentElement).not.toHaveAttribute('data-betrayal-endgame');
      expect(JSON.stringify(core)).toBe(before);
      expect(localStorage.getItem('match_creds_old')).toBe('synthetic-retained-record');
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('defers to the existing room-exit owner without navigating around its pending or cancelled outcome', async () => {
    let finish!: () => void;
    const exit = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    await renderResult('online', false, exit); openReport();
    fireEvent.click(screen.getByRole('button', { name: '大厅' }));
    expect(exit).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('lobby-destination')).not.toBeInTheDocument();
    await act(async () => { finish(); });
    expect(screen.getByTestId('betrayal-endgame-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('lobby-destination')).not.toBeInTheDocument();
  });
});
