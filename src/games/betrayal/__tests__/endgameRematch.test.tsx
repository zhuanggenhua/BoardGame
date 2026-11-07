/* @vitest-environment happy-dom */
import React from 'react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import locale from '../../../../public/locales/zh-CN/game-betrayal.json';
import common from '../../../../public/locales/zh-CN/common.json';
import { GameModeProvider, type GameMode } from '../../../contexts/GameModeContext';
import { RematchProvider } from '../../../contexts/RematchContext';
import { useLocalProviderSession } from '../../../engine/transport/useLocalProviderSession';
import type { GameEngineConfig } from '../../../engine/transport/engineConfig';
import type { RematchVoteState } from '../../../services/matchSocket';
import { engineConfig } from '../game';
import { EndgameScreen } from '../endgameScreen';
import { playMummyScenarioToTraitorVictory } from '../testing/firstScenarioTestUtils';

const mocks = vi.hoisted(() => ({ vote: vi.fn(), playAgain: vi.fn(), error: vi.fn(), warning: vi.fn(), reset: null as null | (() => Promise<void>), state: null as null | ((value: RematchVoteState) => void) }));
vi.mock('../../../services/matchSocket', () => ({ matchSocket: {
  joinMatch: vi.fn(), leaveMatch: vi.fn(), isSocketConnected: () => true, setAutoAcceptedPlayerIds: vi.fn(), vote: mocks.vote,
  subscribeRematchConnection: (callback: (connected: boolean) => void) => { callback(true); return () => {}; },
  subscribeState: (cb: (state: RematchVoteState) => void) => { mocks.state = cb; return () => {}; },
  subscribeReset: (cb: () => Promise<void>) => { mocks.reset = cb; return () => {}; }, subscribeNewRoom: () => () => {}, broadcastNewRoom: vi.fn(),
} }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, token: null }) }));
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ error: mocks.error, warning: mocks.warning }) }));
vi.mock('../../../hooks/match/useMatchStatus', () => ({ readStoredMatchCredentials: () => ({ gameName: 'betrayal', credentials: 'synthetic-proof', playerName: 'Alice' }), persistRematchOwnerCredentials: vi.fn(), setOwnerActiveMatch: vi.fn() }));
vi.mock('../../../services/matchApi', () => ({ playAgain: mocks.playAgain }));
vi.mock('../../../components/common/media/OptimizedImage', () => ({ OptimizedImage: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} data-src={src} /> }));

beforeEach(() => { vi.clearAllMocks(); mocks.reset = null; mocks.state = null; });
afterEach(cleanup);
async function i18nForTest() {
  const i18n = i18next.createInstance(); await i18n.use(initReactI18next).init({ lng: 'zh-CN', defaultNS: 'game-betrayal', resources: { 'zh-CN': { 'game-betrayal': locale, common } }, interpolation: { escapeValue: false } }); return i18n;
}
async function renderResult({ mode = 'local', spectator = false, playerID = '0', reset = vi.fn(), isConnected = true }: { mode?: GameMode; spectator?: boolean; playerID?: string | null; reset?: (() => void) | null; isConnected?: boolean } = {}) {
  const i18n = await i18nForTest();
  render(<I18nextProvider i18n={i18n}><MemoryRouter><GameModeProvider mode={mode} isSpectator={spectator}><RematchProvider matchId="old" playerId={playerID ?? undefined} isMultiplayer={mode === 'online'}>
    <EndgameScreen core={playMummyScenarioToTraitorVictory()} effectiveLocale="zh-CN" matchData={[{ id: 0, name: 'Alice' }, { id: 1, name: 'Bob' }, { id: 2, name: 'Carol' }]} playerID={playerID} reset={reset ?? undefined} isMultiplayer={mode === 'online'} isConnected={isConnected} />
  </RematchProvider></GameModeProvider></MemoryRouter></I18nextProvider>);
  fireEvent.click(screen.getByRole('button', { name: '查看结果报告' })); return reset;
}

describe('Betrayal result rematch uses formal platform owners', () => {
  it('resets the real local session with the same setup and no multiplayer request', async () => {
    const i18n = await i18nForTest(); const finished = playMummyScenarioToTraitorVictory();
    const setupData = { scenarioId: finished.scenarioId }; const ids = ['0', '1', '2']; const aiSeatIds: string[] = [];
    let session!: ReturnType<typeof useLocalProviderSession>;
    function LocalResult() {
      const currentSession = useLocalProviderSession({ config: engineConfig as GameEngineConfig, numPlayers: 3, seed: 'local-rematch', setupData, setupPlayerIds: ids, aiSeatIds, persistSession: false });
      React.useLayoutEffect(() => { session = currentSession; }, [currentSession]);
      return currentSession.state.core && (currentSession.state.core as typeof finished).phase === 'endgame'
        ? <EndgameScreen core={currentSession.state.core as typeof finished} effectiveLocale="zh-CN" playerID={null} reset={currentSession.reset} isMultiplayer={false} />
        : <div data-testid="local-new-session" />;
    }
    render(<I18nextProvider i18n={i18n}><MemoryRouter><GameModeProvider mode="local"><LocalResult /></GameModeProvider></MemoryRouter></I18nextProvider>);
    const initialCore = JSON.stringify(session.state.core);
    act(() => session.setState({ ...session.state, core: finished, sys: { ...session.state.sys, gameover: { winner: '0' } } }));
    fireEvent.click(screen.getByRole('button', { name: '查看结果报告' })); fireEvent.click(screen.getByRole('button', { name: '重赛' }));
    expect(screen.getByTestId('local-new-session')).toBeInTheDocument(); expect(session.state.sys.gameover).toBeUndefined();
    expect(JSON.stringify(session.state.core)).toBe(initialCore); expect(mocks.vote).not.toHaveBeenCalled(); expect(mocks.playAgain).not.toHaveBeenCalled();
  });

  it('votes and cancels online, waits for every required seat, and never directly resets/creates', async () => {
    const reset = vi.fn(); await renderResult({ mode: 'online', reset });
    fireEvent.click(screen.getByRole('button', { name: '重赛' })); expect(mocks.vote).toHaveBeenCalledTimes(1);
    act(() => mocks.state!({ votes: { 0: true, 1: true, 2: false }, ready: false, revision: 1 }));
    expect(screen.getByText('等待对手确认…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消投票' })); expect(mocks.vote).toHaveBeenCalledTimes(2);
    act(() => mocks.state!({ votes: { 0: true, 1: true, 2: true }, ready: true, revision: 2 }));
    expect(screen.getByRole('button', { name: '双方已确认，重开中…' })).toBeDisabled();
    expect(reset).not.toHaveBeenCalled(); expect(mocks.playAgain).not.toHaveBeenCalled();
  });

  it.each([{ spectator: true, playerID: '0' }, { spectator: false, playerID: null }])('disables online spectator or missing-seat access: %j', async args => {
    const reset = vi.fn(); await renderResult({ mode: 'online', reset, ...args });
    const button = screen.getByRole('button', { name: '重赛' }); expect(button).toBeDisabled(); fireEvent.click(button);
    expect(mocks.vote).not.toHaveBeenCalled(); expect(reset).not.toHaveBeenCalled(); expect(mocks.playAgain).not.toHaveBeenCalled();
  });

  it('disables a known disconnected online client', async () => {
    await renderResult({ mode: 'online', isConnected: false }); expect(screen.getByRole('button', { name: '重赛' })).toBeDisabled();
  });

  it('disables local rematch when the runtime does not supply reset', async () => {
    await renderResult({ reset: null }); expect(screen.getByRole('button', { name: '重赛' })).toBeDisabled();
  });

  it('keeps a rejected server rematch in the original result without local fallback', async () => {
    const reset = vi.fn(); await renderResult({ mode: 'online', reset });
    mocks.playAgain.mockRejectedValue(Object.assign(new Error('unsupported'), { code: 'REMATCH_SETUP_UNSUPPORTED' }));
    await act(async () => { await mocks.reset!(); });
    expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ key: 'rematch.setupUnsupported' }));
    expect(reset).not.toHaveBeenCalled(); expect(screen.getByTestId('betrayal-endgame-result-report')).toBeInTheDocument();
  });
});

vi.mock('../../../hooks/match/matchCredentialTransaction', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../hooks/match/matchCredentialTransaction')>();
    let queue = Promise.resolve<unknown>(undefined);
    return { ...actual, withMatchCredentialWrite: <T,>(write: () => T): Promise<T> => {
        const result = queue.then(write); queue = result.catch(() => {}); return result;
    } };
});
