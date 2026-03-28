import { describe, it, expect } from 'vitest';
import {
    areAllSeatsOccupied,
    hasOccupiedPlayers,
    isSeatOccupied,
    isSupportedPlayerCount,
    type PlayerSeat,
} from '../matchOccupancy';

describe('matchOccupancy', () => {
    it('isSeatOccupied: name/credentials/isConnected 任一成立视为占座', () => {
        expect(isSeatOccupied({ name: 'P1' })).toBe(true);
        expect(isSeatOccupied({ credentials: 'cred' })).toBe(true);
        expect(isSeatOccupied({ isConnected: true })).toBe(true);
        expect(isSeatOccupied({})).toBe(false);
        expect(isSeatOccupied(undefined)).toBe(false);
    });

    it('hasOccupiedPlayers: 任意玩家占座返回 true', () => {
        expect(hasOccupiedPlayers(undefined)).toBe(false);
        const emptyPlayers: Record<string, PlayerSeat> = { 0: {}, 1: {} };
        const occupiedPlayers: Record<string, PlayerSeat> = { 0: { name: 'P0' }, 1: {} };
        expect(hasOccupiedPlayers(emptyPlayers)).toBe(false);
        expect(hasOccupiedPlayers(occupiedPlayers)).toBe(true);
    });

    it('areAllSeatsOccupied: 所有座位都占满时才返回 true', () => {
        expect(areAllSeatsOccupied(undefined)).toBe(false);
        expect(areAllSeatsOccupied({ 0: {}, 1: { name: 'P1' } })).toBe(false);
        expect(areAllSeatsOccupied({ 0: { name: 'P0' }, 1: { credentials: 'cred-1' } })).toBe(true);
        expect(areAllSeatsOccupied({
            0: { name: 'P0' },
            1: { name: 'P1' },
            2: { credentials: 'cred-2' },
            3: { isConnected: true },
        })).toBe(true);
    });

    it('isSupportedPlayerCount: 仅允许整数且在 min/max 区间内的人数', () => {
        expect(isSupportedPlayerCount(2, 2, 4)).toBe(true);
        expect(isSupportedPlayerCount(4, 2, 4)).toBe(true);
        expect(isSupportedPlayerCount(3, 2, 4)).toBe(true);
        expect(isSupportedPlayerCount(1, 2, 4)).toBe(false);
        expect(isSupportedPlayerCount(5, 2, 4)).toBe(false);
        expect(isSupportedPlayerCount(2.5, 2, 4)).toBe(false);
        expect(isSupportedPlayerCount(Number.NaN, 2, 4)).toBe(false);
    });

    it('isSupportedPlayerCount: 有显式 playerOptions 时按白名单校验', () => {
        expect(isSupportedPlayerCount(2, 2, 4, [2, 4])).toBe(true);
        expect(isSupportedPlayerCount(4, 2, 4, [2, 4])).toBe(true);
        expect(isSupportedPlayerCount(3, 2, 4, [2, 4])).toBe(false);
        expect(isSupportedPlayerCount(3, 2, 4, [2, 3, 4])).toBe(true);
    });
});
