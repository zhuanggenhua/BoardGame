/* @vitest-environment happy-dom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the external socket is controlled. Service, Provider and result button
// below are the production owners, not alternate test implementations.
const transport = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => void>(),
    socket: { connected: false, emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    toast: { error: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../services/lobbySocket', () => ({ lobbySocket: {
    acquireConnection: () => transport.socket,
    getSharedSocket: () => transport.socket,
    releaseConnection: vi.fn(),
} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, token: null }) }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => transport.toast }));
vi.mock('../../hooks/match/useMatchStatus', () => ({
    readStoredMatchCredentials: () => ({ gameName: 'betrayal', credentials: 'synthetic-proof' }),
    persistRematchOwnerCredentials: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { RematchProvider, useRematch } from '../../contexts/RematchContext';
import { EndgameRematchActions } from '../../games/betrayal/endgameRematchActions';
import { matchSocket, REMATCH_EVENTS } from '../../services/matchSocket';

function Status() {
    const { isConnected } = useRematch();
    return <output data-testid="connection">{String(isConnected)}</output>;
}
function mount() {
    return render(<MemoryRouter><RematchProvider matchId="old" playerId="0" isMultiplayer>
        <Status />
        <EndgameRematchActions playerID="0" isMultiplayer isConnected />
    </RematchProvider></MemoryRouter>);
}
function emit(event: string, payload?: unknown) {
    act(() => { transport.handlers.get(event)?.(payload); });
}
function connect() {
    transport.socket.connected = true;
    emit('connect');
}
function acknowledgeJoin() {
    emit(REMATCH_EVENTS.STATE_UPDATE, { votes: {}, ready: false, revision: 0 });
}
function disconnect() {
    transport.socket.connected = false;
    emit('disconnect');
}

beforeEach(() => {
    vi.clearAllMocks();
    transport.handlers.clear();
    transport.socket.connected = false;
    transport.socket.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => { transport.handlers.set(event, handler); });
    transport.socket.off.mockImplementation((event: string) => { transport.handlers.delete(event); });
});
afterEach(() => { cleanup(); matchSocket.disconnect(); });

describe('rematch connection lifecycle through the real result action', () => {
    it('updates a Provider mounted before the socket connects, then follows disconnect and reconnect', () => {
        mount();
        expect(screen.getByTestId('connection')).toHaveTextContent('false');
        connect();
        expect(screen.getByTestId('connection')).toHaveTextContent('false');
        acknowledgeJoin();
        expect(screen.getByTestId('connection')).toHaveTextContent('true');
        disconnect();
        expect(screen.getByTestId('connection')).toHaveTextContent('false');
        connect();
        acknowledgeJoin();
        expect(screen.getByTestId('connection')).toHaveTextContent('true');
    });

    it('does not offer a silent vote while only the game socket is connected', () => {
        mount();
        const button = screen.getByRole('button', { name: 'board.endgame.rematch' });
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(transport.socket.emit.mock.calls.some(([event]) => event === REMATCH_EVENTS.VOTE)).toBe(false);
        connect();
        expect(button).toBeDisabled();
        fireEvent.click(button);
        act(() => matchSocket.vote());
        expect(transport.socket.emit.mock.calls.some(([event]) => event === REMATCH_EVENTS.VOTE)).toBe(false);
        acknowledgeJoin();
        expect(button).toBeEnabled();
        fireEvent.click(button);
        expect(transport.socket.emit).toHaveBeenLastCalledWith(REMATCH_EVENTS.VOTE);
        disconnect();
        expect(button).toBeDisabled();
    });

    it('accepts the recreated server vote revision after reconnect while retaining monotonic updates within that connection', () => {
        mount(); connect();
        emit(REMATCH_EVENTS.STATE_UPDATE, { votes: { 0: true }, ready: false, revision: 8 });
        expect(screen.getByRole('button', { name: 'rematch.cancelVote' })).toBeInTheDocument();
        disconnect(); connect();
        emit(REMATCH_EVENTS.STATE_UPDATE, { votes: {}, ready: false, revision: 0 });
        expect(screen.getByRole('button', { name: 'board.endgame.rematch' })).toBeEnabled();
        emit(REMATCH_EVENTS.STATE_UPDATE, { votes: { 0: true }, ready: false, revision: 2 });
        emit(REMATCH_EVENTS.STATE_UPDATE, { votes: {}, ready: false, revision: 1 });
        expect(screen.getByRole('button', { name: 'rematch.cancelVote' })).toBeInTheDocument();
    });

    it('keeps repeated AI-seat refresh from reopening the stale-revision fence', () => {
        mount(); connect();
        emit(REMATCH_EVENTS.STATE_UPDATE, { votes: { 0: true }, ready: false, revision: 8 });
        act(() => matchSocket.setAutoAcceptedPlayerIds(['1']));
        emit(REMATCH_EVENTS.STATE_UPDATE, { votes: {}, ready: false, revision: 1 });
        expect(screen.getByRole('button', { name: 'rematch.cancelVote' })).toBeInTheDocument();
    });

    it('requires a fresh authenticated join even on an already-connected socket, and handles connect errors', () => {
        transport.socket.connected = true;
        mount();
        expect(screen.getByTestId('connection')).toHaveTextContent('false');
        acknowledgeJoin();
        expect(screen.getByTestId('connection')).toHaveTextContent('true');
        transport.socket.connected = false;
        emit('connect_error', new Error('synthetic connection failure'));
        expect(screen.getByTestId('connection')).toHaveTextContent('false');
        expect(screen.getByRole('button', { name: 'board.endgame.rematch' })).toBeDisabled();
        connect();
        acknowledgeJoin();
        expect(screen.getByTestId('connection')).toHaveTextContent('true');
    });

    it('clears rematch readiness on exit without disrupting the shared chat channel', () => {
        const view = mount(); connect(); acknowledgeJoin();
        act(() => matchSocket.joinChat('old', { playerId: '0' }));
        const observer = vi.fn();
        const unsubscribe = matchSocket.subscribeRematchConnection(observer);
        observer.mockClear();
        view.unmount();
        expect(observer.mock.calls).toEqual([[false]]);
        observer.mockClear();
        disconnect(); connect();
        // Chat reconnects, but cannot authenticate a rematch that has been left.
        expect(observer).not.toHaveBeenCalled();
        expect(transport.socket.emit.mock.calls.some(([event]) => event === 'matchChat:join')).toBe(true);
        unsubscribe(); observer.mockClear();
        disconnect();
        expect(observer).not.toHaveBeenCalled();
    });
});
