/* @vitest-environment happy-dom */
import React, { useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reset: null as null | (() => Promise<void>),
  newRoom: null as null | ((url: string) => void),
  stored: { gameName: 'Betrayal', playerName: 'Tester', credentials: 'PRIVATE_CREDENTIAL' } as Record<string, string> | null,
  auth: { user: null, token: null } as { user: { id: string; username: string } | null; token: string | null },
  navigate: vi.fn(), clearMatchCredentials: vi.fn(), toastWarning: vi.fn(),
  setOwnerActiveMatch: vi.fn(), claimSeat: vi.fn(), playAgain: vi.fn(), showError: vi.fn(), broadcast: vi.fn(), localReset: vi.fn(),
}));
vi.mock('../../services/matchSocket', () => ({ matchSocket: {
  joinMatch: vi.fn(), leaveMatch: vi.fn(), isSocketConnected: () => true,
  subscribeRematchConnection: (callback: (connected: boolean) => void) => { callback(true); return () => {}; },
  subscribeState: () => () => {}, subscribeReset: (callback: () => Promise<void>) => { mocks.reset = callback; return () => {}; },
  subscribeNewRoom: (callback: (url: string) => void) => { mocks.newRoom = callback; return () => {}; },
  broadcastNewRoom: mocks.broadcast, setAutoAcceptedPlayerIds: vi.fn(), vote: vi.fn(),
} }));
vi.mock('../../hooks/match/useMatchStatus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../match/useMatchStatus')>();
  return { ...actual, clearMatchCredentials: mocks.clearMatchCredentials, readStoredMatchCredentials: () => mocks.stored, claimSeat: mocks.claimSeat,
    persistRematchOwnerCredentials: async (...args: Parameters<typeof actual.persistRematchOwnerCredentials>) => {
      const saved = await actual.persistRematchOwnerCredentials(...args);
      if (saved && args[2]) mocks.setOwnerActiveMatch(args[2]);
      return saved;
    },
  };
});
vi.mock('../../hooks/match/ownerIdentity', () => ({ getOrCreateGuestId: () => 'original-guest', getOwnerKey: (userId?: string, guestId?: string) => userId ? `user:${userId}` : `guest:${guestId}` }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ error: mocks.showError, warning: mocks.toastWarning }) }));
vi.mock('../../services/matchApi', () => ({ playAgain: mocks.playAgain }));
vi.mock('../../contexts/ModalStackContext', () => ({ useModalStack: () => ({ openModal: vi.fn(), closeModal: vi.fn(), closeAll: vi.fn() }) }));
import { useMatchRoomExitFlow } from '../../pages/useMatchRoomExitFlow';
import { RematchProvider, useRematch } from '../../contexts/RematchContext';

function RegisterReset() {
  const { registerReset } = useRematch();
  useEffect(() => registerReset(mocks.localReset), [registerReset]);
  return null;
}
const mount = (playerId = '0') => render(<RematchProvider matchId="old" playerId={playerId} isMultiplayer><RegisterReset /></RematchProvider>);
const reset = async () => { await act(async () => { await mocks.reset!(); }); };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.stored = { gameName: 'Betrayal', playerName: 'Tester', credentials: 'PRIVATE_CREDENTIAL' };
  mocks.auth = { user: null, token: null };
  mocks.playAgain.mockResolvedValue({ nextMatchID: 'new', ownerCredentials: 'NEW_PRIVATE_CREDENTIAL', ownerType: 'guest' });
  mocks.claimSeat.mockResolvedValue({ success: true, credentials: 'seat' });
  window.location.href = 'http://localhost/play/betrayal/match/old';
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); mocks.reset = null; });

describe('rematch does not silently reset the multiplayer client on failure', () => {
  it('shows localized unsupported feedback, never resets or navigates, and permits another attempt', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.playAgain.mockRejectedValue(Object.assign(new Error('PRIVATE_CREDENTIAL'), { code: 'REMATCH_SETUP_UNSUPPORTED' }));
    mount();
    await reset();
    expect(mocks.showError).toHaveBeenCalledWith({ kind: 'i18n', ns: 'common', key: 'rematch.setupUnsupported' });
    expect(mocks.localReset).not.toHaveBeenCalled();
    expect(mocks.claimSeat).not.toHaveBeenCalled();
    expect(mocks.broadcast).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/play/betrayal/match/old');
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_CREDENTIAL');
    await reset();
    expect(mocks.playAgain).toHaveBeenCalledTimes(2);
  });

  it('does not broadcast or navigate when a committed room proof cannot be stored', async () => {
    vi.spyOn(await import('../../lib/browserStorage'), 'writeLocalStorageItem').mockReturnValue(false);
    mount(); await reset();
    expect(mocks.broadcast).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/play/betrayal/match/old');
    expect(mocks.showError).toHaveBeenCalledWith(expect.objectContaining({ key: 'rematch.credentialsNotSaved' }));
  });

  it('keeps the original match on missing credentials', async () => {
    mocks.stored = null;
    mount();
    await reset();
    expect(mocks.localReset).not.toHaveBeenCalled();
    expect(mocks.playAgain).not.toHaveBeenCalled();
    expect(mocks.showError).toHaveBeenCalledWith(expect.objectContaining({ key: 'rematch.missingCredentials' }));
  });

  it('does not locally reset when a non-owner times out, and can wait again', async () => {
    vi.useFakeTimers();
    mount('1');
    await reset();
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(mocks.localReset).not.toHaveBeenCalled();
    expect(mocks.showError).toHaveBeenCalledWith(expect.objectContaining({ key: 'rematch.waitTimeout' }));
    expect(window.location.pathname).toBe('/play/betrayal/match/old');
    await reset();
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(mocks.showError).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, '', {}, 71])('does not broadcast or navigate if create returned invalid owner proof %j', async ownerCredentials => {
    mocks.playAgain.mockResolvedValue({ nextMatchID: 'new', ownerType: 'guest', ownerCredentials });
    mount();
    await reset();
    expect(mocks.localReset).not.toHaveBeenCalled();
    expect(mocks.broadcast).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/play/betrayal/match/old');
    expect(mocks.showError).toHaveBeenCalledWith(expect.objectContaining({ key: 'rematch.failed' }));
  });
});

describe('rematch joins the server-created room', () => {
  it('uses guest proof even when the guest owner has since logged in', async () => {
    const view = mount();
    mocks.auth = { user: { id: 'u1', username: 'Logged in' }, token: 'token' };
    view.rerender(<RematchProvider matchId="old" playerId="0" isMultiplayer><RegisterReset /></RematchProvider>);
    await reset();
    expect(mocks.playAgain).toHaveBeenCalledWith('betrayal', 'old', expect.objectContaining({ credentials: 'PRIVATE_CREDENTIAL', token: 'token' }));
    expect(mocks.claimSeat).not.toHaveBeenCalled();
    expect(mocks.broadcast).toHaveBeenCalledWith('/play/betrayal/match/new', 'NEW_PRIVATE_CREDENTIAL');
    expect(window.location.pathname + window.location.search).toBe('/play/betrayal/match/new?playerID=0');
    expect(mocks.localReset).not.toHaveBeenCalled();
    expect(mocks.setOwnerActiveMatch).toHaveBeenCalledWith({ matchID: 'new', gameName: 'betrayal', ownerType: 'guest', ownerKey: 'guest:original-guest' });
  });

  it('reclaims the new guest room with saved P0 proof after a logged-in rematch', async () => {
    const actual = await vi.importActual<typeof import('../match/useMatchStatus')>('../match/useMatchStatus');
    await actual.setOwnerActiveMatch({ matchID: 'old', gameName: 'betrayal', ownerType: 'guest', ownerKey: 'guest:original-guest' });
    mocks.auth = { user: { id: 'u1', username: 'Account' }, token: 'token' };
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ playerCredentials: 'new-seat-proof' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    await reset();
    expect(actual.getOwnerActiveMatch()).toMatchObject({ matchID: 'new', ownerType: 'guest', ownerKey: 'guest:original-guest' });
    expect(actual.readStoredMatchCredentials('new')).toMatchObject({ playerID: '0', credentials: 'NEW_PRIVATE_CREDENTIAL' });
    await actual.claimSeat('betrayal', 'new', '0', { token: 'token' });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(String(request.body))).toMatchObject({ playerID: '0', ownerCredentials: 'NEW_PRIVATE_CREDENTIAL' });
  });

  it('preserves account ownership when using the issued seat proof', async () => {
    mocks.auth = { user: { id: 'u1', username: 'Account' }, token: 'token' };
    mocks.playAgain.mockResolvedValue({ nextMatchID: 'new', ownerCredentials: 'proof', ownerType: 'user' });
    mount();
    await reset();
    expect(mocks.claimSeat).not.toHaveBeenCalled();
    expect(mocks.setOwnerActiveMatch).toHaveBeenCalledWith(expect.objectContaining({ ownerType: 'user', ownerKey: 'user:u1' }));
  });

  it('navigates the other player with join=true and cancels the wait timer', async () => {
    vi.useFakeTimers();
    mount('1');
    await reset();
    act(() => { mocks.newRoom!('/play/betrayal/match/new'); });
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(window.location.pathname + window.location.search).toBe('/play/betrayal/match/new?join=true');
    expect(mocks.showError).not.toHaveBeenCalled();
    expect(mocks.localReset).not.toHaveBeenCalled();
  });
});


it('warns about an unknown server outcome without claiming the old room survived', async () => {
  mocks.playAgain.mockRejectedValue(Object.assign(new Error('unknown'), { code: 'ROOM_REPLACEMENT_OUTCOME_UNKNOWN' }));
  mount(); await reset();
  expect(mocks.showError).toHaveBeenCalledWith(expect.objectContaining({ key: 'rematch.outcomeUnknown' }));
  expect(mocks.localReset).not.toHaveBeenCalled();
  expect(mocks.claimSeat).not.toHaveBeenCalled();
  expect(mocks.playAgain).toHaveBeenCalledTimes(1);
});


// The actual provider and missing-room exit hook share their production callback.
// HTTP/socket delivery is supplied at their public boundaries, not browser E2E.
function RematchExitHarness({ playerId = '1', missing = false, matchId = 'old', aiSeats }: {
  playerId?: string; missing?: boolean; matchId?: string; aiSeats?: string[];
}) {
  const exit = useMatchRoomExitFlow({
    gameId: 'betrayal', matchId, statusPlayerID: playerId,
    credentials: 'PRIVATE_CREDENTIAL', matchStatusIsHost: playerId === '0',
    isTutorialRoute: false, shouldAutoJoin: false, isAutoJoining: false, autoJoinGraceActive: false,
    onlineTransportError: missing ? 'match_not_found' : null,
    matchStatusErrorKind: missing ? 'not_found' : null, navigate: mocks.navigate,
  });
  return <RematchProvider matchId={matchId} playerId={playerId} isMultiplayer
    onTransitionChange={exit.handleRematchTransitionChange} autoAcceptedPlayerIds={aiSeats}><RegisterReset /></RematchProvider>;
}

describe('rematch retirement does not win the page navigation race', () => {
  it('keeps the follower subscribed when retirement and REST 404 arrive before successor notification', async () => {
    const view = render(<RematchExitHarness />);
    await reset();
    view.rerender(<RematchExitHarness missing />);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.clearMatchCredentials).not.toHaveBeenCalled();
    act(() => { mocks.newRoom!('/play/betrayal/match/new'); });
    expect(window.location.pathname + window.location.search).toBe('/play/betrayal/match/new?join=true');
    expect(mocks.toastWarning).not.toHaveBeenCalled();
  });

  it('defers owner exit while create waits, then retains the successful handoff', async () => {
    let release!: (result: unknown) => void;
    mocks.playAgain.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const view = render(<RematchExitHarness playerId="0" />);
    let pending!: Promise<void>;
    act(() => { pending = mocks.reset!(); });
    view.rerender(<RematchExitHarness playerId="0" missing />);
    expect(mocks.navigate).not.toHaveBeenCalled();
    await act(async () => { release({ nextMatchID: 'new', ownerCredentials: 'proof', ownerType: 'guest' }); await pending; });
    expect(mocks.broadcast).toHaveBeenCalledWith('/play/betrayal/match/new', 'proof');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('rechecks an already missing room after the bounded follower wait expires', async () => {
    vi.useFakeTimers();
    const view = render(<RematchExitHarness />);
    await reset();
    view.rerender(<RematchExitHarness missing />);
    expect(mocks.navigate).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(mocks.navigate).toHaveBeenCalledWith('/?game=betrayal', { replace: true });
  });
});


describe('rematch transition lifetime boundaries', () => {
  it('does not cancel an active handoff when AI seat metadata refreshes', async () => {
    const view = render(<RematchExitHarness aiSeats={['2']} />);
    await reset();
    view.rerender(<RematchExitHarness aiSeats={[]} missing />);
    expect(mocks.navigate).not.toHaveBeenCalled();
    act(() => { mocks.newRoom!('/play/betrayal/match/new'); });
    expect(window.location.pathname).toBe('/play/betrayal/match/new');
  });

  it('releases missing-room deferral after an owner create failure', async () => {
    let rejectClaim!: (reason: unknown) => void;
    mocks.playAgain.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectClaim = reject; }));
    const view = render(<RematchExitHarness playerId="0" />);
    let pending!: Promise<void>;
    await act(async () => { pending = mocks.reset!(); });
    view.rerender(<RematchExitHarness playerId="0" missing />);
    expect(mocks.navigate).not.toHaveBeenCalled();
    await act(async () => { rejectClaim(new Error('claim failed')); await pending; });
    expect(mocks.navigate).toHaveBeenCalledWith('/?game=betrayal', { replace: true });
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it('preserves the owner proof when create takes longer than the follower wait', async () => {
    vi.useFakeTimers();
    let release!: (value: unknown) => void;
    mocks.playAgain.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const view = render(<RematchExitHarness playerId="0" />);
    let pending!: Promise<void>;
    await act(async () => { pending = mocks.reset!(); });
    view.rerender(<RematchExitHarness playerId="0" missing />);
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.showError).not.toHaveBeenCalled();
    await act(async () => { release({ nextMatchID: 'new', ownerCredentials: 'proof', ownerType: 'guest' }); await pending; });
    expect(mocks.broadcast).toHaveBeenCalledWith('/play/betrayal/match/new', 'proof');
    expect(mocks.setOwnerActiveMatch).toHaveBeenCalledWith(expect.objectContaining({ matchID: 'new' }));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('does not let an unmounted owner request mutate the next room or navigate', async () => {
    let release!: (value: unknown) => void;
    mocks.playAgain.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const view = render(<RematchExitHarness playerId="0" />);
    let pending!: Promise<void>;
    act(() => { pending = mocks.reset!(); });
    view.rerender(<RematchExitHarness matchId="other" playerId="1" />);
    await reset();
    view.rerender(<RematchExitHarness matchId="other" playerId="1" missing />);
    await act(async () => { release({ nextMatchID: 'late', ownerCredentials: 'proof', ownerType: 'guest' }); await pending; });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.claimSeat).not.toHaveBeenCalled();
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it('still accepts an authenticated successor notification after the follower wait', async () => {
    vi.useFakeTimers(); render(<RematchExitHarness />); await reset();
    await act(async () => { vi.advanceTimersByTime(8000); });
    act(() => { mocks.newRoom!('/play/betrayal/match/late'); });
    expect(window.location.pathname).toBe('/play/betrayal/match/late');
  });
});


it('preserves the existing authenticated debug successor notification without a reset trigger', () => {
  mount('1');
  act(() => { mocks.newRoom!('/play/betrayal/match/debug-new'); });
  expect(window.location.pathname + window.location.search).toBe('/play/betrayal/match/debug-new?join=true');
});


describe('late owner create response respects the current local selection', () => {
  it('saves committed proof after leaving to Home without navigating or broadcasting', async () => {
    const actual = await vi.importActual<typeof import('../match/useMatchStatus')>('../match/useMatchStatus');
    await actual.persistMatchCredentials('old', { matchID: 'old', playerID: '0', credentials: 'PRIVATE_CREDENTIAL', gameName: 'betrayal' });
    let release!: (value: unknown) => void;
    mocks.playAgain.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const view = mount(); let pending!: Promise<void>;
    act(() => { pending = mocks.reset!(); });
    view.unmount(); window.location.href = 'http://localhost/?game=betrayal';
    await act(async () => { release({ nextMatchID: 'new', ownerCredentials: 'committed-proof', ownerType: 'guest' }); await pending; });
    await actual.pruneStoredMatchCredentials(); // Home's actual single-room consumer.
    expect(actual.getLatestStoredMatchCredentials()).toMatchObject({ matchID: 'new', playerID: '0', credentials: 'committed-proof' });
    expect(actual.readStoredMatchCredentials('old')).toBeNull();
    expect(actual.getOwnerActiveMatch()).toMatchObject({ matchID: 'new', ownerType: 'guest' });
    expect(window.location.pathname).toBe('/');
    expect(mocks.broadcast).not.toHaveBeenCalled();
    expect(mocks.claimSeat).not.toHaveBeenCalled();
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it('does not prune, overwrite, timestamp or notify over a later selected room', async () => {
    const actual = await vi.importActual<typeof import('../match/useMatchStatus')>('../match/useMatchStatus');
    let release!: (value: unknown) => void;
    mocks.playAgain.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const view = mount(); let pending!: Promise<void>;
    act(() => { pending = mocks.reset!(); }); view.unmount();
    await actual.persistMatchCredentials('chosen', { matchID: 'chosen', playerID: '1', credentials: 'chosen-proof' });
    await actual.setOwnerActiveMatch({ matchID: 'chosen', gameName: 'betrayal', ownerType: 'user' });
    const before = { ...localStorage };
    const changed = vi.fn(); window.addEventListener('match-credentials-changed', changed);
    window.addEventListener('owner-active-match-changed', changed);
    window.location.href = 'http://localhost/play/betrayal/match/chosen';
    await act(async () => { release({ nextMatchID: 'new', ownerCredentials: 'late-proof', ownerType: 'guest' }); await pending; });
    expect({ ...localStorage }).toEqual(before);
    expect(changed).not.toHaveBeenCalled();
    await actual.pruneStoredMatchCredentials();
    expect(actual.getLatestStoredMatchCredentials()?.matchID).toBe('chosen');
    expect(actual.getOwnerActiveMatch()?.matchID).toBe('chosen');
    expect(window.location.pathname).toBe('/play/betrayal/match/chosen');
    expect(mocks.broadcast).not.toHaveBeenCalled();
    window.removeEventListener('match-credentials-changed', changed);
    window.removeEventListener('owner-active-match-changed', changed);
  });

  it('uses the already issued P0 seat proof without a second claim request', async () => {
    const actual = await vi.importActual<typeof import('../match/useMatchStatus')>('../match/useMatchStatus');
    mount(); await reset();
    expect(mocks.claimSeat).not.toHaveBeenCalled();
    expect(actual.readStoredMatchCredentials('new')).toMatchObject({ playerID: '0', credentials: 'NEW_PRIVATE_CREDENTIAL' });
    expect(mocks.broadcast).toHaveBeenCalledWith('/play/betrayal/match/new', 'NEW_PRIVATE_CREDENTIAL');
  });
});


it('does not navigate a follower who intentionally left before a late notification', async () => {
  const view = mount('1'); await reset(); const lateNotification = mocks.newRoom!;
  view.unmount(); window.location.href = 'http://localhost/?game=betrayal';
  act(() => lateNotification('/play/betrayal/match/late'));
  expect(window.location.pathname).toBe('/');
});

it.each(['pointer-only', 'rotated-successor'] as const)('does not overwrite a later %s selection', async mode => {
  const actual = await vi.importActual<typeof import('../match/useMatchStatus')>('../match/useMatchStatus');
  let release!: (value: unknown) => void;
  mocks.playAgain.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const view = mount(); let pending!: Promise<void>;
  act(() => { pending = mocks.reset!(); }); view.unmount();
  if (mode === 'pointer-only') await actual.setOwnerActiveMatch({ matchID: 'chosen', gameName: 'betrayal' });
  else await actual.persistMatchCredentials('new', { matchID: 'new', playerID: '0', credentials: 'newer-rotated-proof' });
  const before = { ...localStorage };
  await act(async () => { release({ nextMatchID: 'new', ownerCredentials: 'late-proof', ownerType: 'guest' }); await pending; });
  expect({ ...localStorage }).toEqual(before);
  expect(mocks.broadcast).not.toHaveBeenCalled();
});


describe('owner long-wait notice is informational, not a request deadline', () => {
  async function holdProductionCreate() {
    const actualApi = await vi.importActual<typeof import('../../services/matchApi')>('../../services/matchApi');
    let release!: (response: Response) => void;
    const fetch = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(resolve => { release = resolve; }));
    vi.stubGlobal('fetch', fetch);
    mocks.playAgain.mockImplementationOnce(actualApi.playAgain);
    return { fetch, release: (body: unknown, status = 200) => release(new Response(JSON.stringify(body), { status })) };
  }

  it('warns once after15s, keeps the same request and accepts a late success', async () => {
    vi.useFakeTimers(); const request = await holdProductionCreate();
    const view = render(<RematchExitHarness playerId="0" />); let pending!: Promise<void>;
    act(() => { pending = mocks.reset!(); });
    view.rerender(<RematchExitHarness playerId="0" missing />);
    await act(async () => { vi.advanceTimersByTime(14999); });
    expect(mocks.toastWarning).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(mocks.toastWarning).toHaveBeenCalledExactlyOnceWith({ kind: 'i18n', ns: 'common', key: 'rematch.stillWaiting' });
    await reset(); // A repeated reset cannot submit a second create.
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(mocks.toastWarning).toHaveBeenCalledTimes(1);
    expect(request.fetch).toHaveBeenCalledTimes(1);
    expect(String(request.fetch.mock.calls[0][0])).toMatch(/\/games\/betrayal\/create$/);
    expect(mocks.showError).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.clearMatchCredentials).not.toHaveBeenCalled();
    await act(async () => { request.release({ matchID: 'new', ownerCredentials: 'late-proof', ownerType: 'guest' }); await pending; });
    expect(mocks.broadcast).toHaveBeenCalledWith('/play/betrayal/match/new', 'late-proof');
    expect(window.location.pathname + window.location.search).toBe('/play/betrayal/match/new?playerID=0');
  });

  it('does not warn after a response completed before the threshold', async () => {
    vi.useFakeTimers(); mount(); await reset();
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(mocks.toastWarning).not.toHaveBeenCalled();
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it.each([1000, 16000])('does not keep notifying or force navigation after leaving at%dms', async leaveAt => {
    vi.useFakeTimers(); const request = await holdProductionCreate();
    const view = mount(); let pending!: Promise<void>;
    act(() => { pending = mocks.reset!(); });
    await act(async () => { vi.advanceTimersByTime(leaveAt); });
    expect(mocks.toastWarning).toHaveBeenCalledTimes(leaveAt < 15000 ? 0 : 1);
    view.unmount(); window.location.href = 'http://localhost/?game=betrayal';
    const warningsAtExit = mocks.toastWarning.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(mocks.toastWarning).toHaveBeenCalledTimes(warningsAtExit);
    await act(async () => { request.release({ matchID: 'new', ownerCredentials: 'late-proof', ownerType: 'guest' }); await pending; });
    const actual = await vi.importActual<typeof import('../match/useMatchStatus')>('../match/useMatchStatus');
    expect(actual.readStoredMatchCredentials('new')?.credentials).toBe('late-proof');
    expect(window.location.pathname).toBe('/');
    expect(mocks.broadcast).not.toHaveBeenCalled();
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it('keeps an eventual unknown server outcome distinct from failure', async () => {
    vi.useFakeTimers(); const request = await holdProductionCreate();
    mount(); let pending!: Promise<void>; act(() => { pending = mocks.reset!(); });
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(mocks.toastWarning).toHaveBeenCalledWith(expect.objectContaining({ key: 'rematch.stillWaiting' }));
    await act(async () => { request.release({ error: 'ROOM_REPLACEMENT_OUTCOME_UNKNOWN' }, 503); await pending; });
    expect(mocks.showError).toHaveBeenCalledExactlyOnceWith({ kind: 'i18n', ns: 'common', key: 'rematch.outcomeUnknown' });
    expect(request.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });
});

vi.mock('../match/matchCredentialTransaction', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../match/matchCredentialTransaction')>();
    let queue = Promise.resolve<unknown>(undefined);
    return { ...actual, withMatchCredentialWrite: <T,>(write: () => T): Promise<T> => {
        const result = queue.then(write); queue = result.catch(() => {}); return result;
    } };
});
