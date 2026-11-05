import { describe, expect, it } from 'vitest';
import { getMatchPlayerResult, getMatchWinnerIDs, readTerminalOutcome } from '../matchRecord';

describe('persisted match outcome', () => {
    it('preserves all team winners even when a legacy winner is also supplied', () => {
        expect(readTerminalOutcome({ winner: '0', winners: ['0', '2'] }).winnerSeats).toEqual(['0', '2']);
        expect(getMatchPlayerResult({ winnerID: 'old', winnerIDs: ['user:0', 'user:2'] }, { id: 'user:2' })).toBe('win');
    });
    it('distinguishes an explicit draw from cooperative defeat', () => {
        expect(readTerminalOutcome({ draw: true, winner: '0' })).toMatchObject({ winnerSeats: [], draw: true });
        expect(readTerminalOutcome({ draw: false, winners: [] }).draw).toBe(false);
        expect(getMatchPlayerResult({ winnerIDs: [], draw: false }, { id: 'user:0' })).toBe('loss');
    });
    it('retains old single-winner records without inventing a winner for empty new arrays', () => {
        expect(getMatchWinnerIDs({ winnerID: 'user:0' })).toEqual(['user:0']);
        expect(getMatchWinnerIDs({ winnerID: 'user:0', winnerIDs: [] })).toEqual([]);
    });
    it('retains explicit per-player cooperative results and finite scores', () => {
        expect(getMatchPlayerResult({}, { id: 'user:0', result: 'win' })).toBe('win');
        expect(readTerminalOutcome({ winners: [0, '0', 2], scores: { '0': 12, '2': Infinity } }))
            .toEqual({ winnerSeats: ['0', '2'], draw: false, scores: { '0': 12 } });
    });
});
