import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import type { MatchMetadata, StoredMatchState, PlayerMetadata } from '../../engine/transport/storage';
import { evaluateEmptyRoomJoinGuard } from '../joinGuard';

const buildState = (ownerKey?: string): StoredMatchState => ({
    G: { __setupData: ownerKey ? { ownerKey } : {} },
    _stateID: 0,
});

const buildPlayers = (overrides: Record<string, Partial<PlayerMetadata>> = {}) => {
    const base: Record<string, PlayerMetadata> = {
        0: {},
        1: {},
    };
    Object.entries(overrides).forEach(([key, value]) => {
        base[key] = { ...base[key], ...value };
    });
    return base;
};

const buildMetadata = (ownerKey?: string, players?: Record<string, PlayerMetadata>): MatchMetadata => ({
    gameName: 'tictactoe',
    players: players ?? buildPlayers(),
    setupData: ownerKey ? { ownerKey } : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
} as MatchMetadata);

describe('evaluateEmptyRoomJoinGuard', () => {
    it('允许非空房间加入', () => {
        const metadata = buildMetadata('guest:g1', buildPlayers({
            0: { name: 'Alice' },
        }));

        const guard = evaluateEmptyRoomJoinGuard({
            metadata,
            state: buildState('guest:g1'),
            guestId: 'g2',
            jwtSecret: 'secret',
        });

        expect(guard.allowed).toBe(true);
        expect(guard.isEmptyRoom).toBe(false);
    });

    it.each([
        ['matching', 'g1'],
        ['mismatched', 'g2'],
        ['missing', undefined],
    ])('空 guest 房间不将 %s guestId 作为房主凭证', (_, guestId) => {
        const guard = evaluateEmptyRoomJoinGuard({
            metadata: buildMetadata('guest:g1'),
            state: buildState('guest:g1'),
            guestId,
            jwtSecret: 'secret',
        });

        expect(guard).toMatchObject({
            allowed: false,
            isEmptyRoom: true,
            status: 409,
            message: 'GUEST_OWNER_PROOF_UNAVAILABLE',
            reason: 'guest_owner_proof_unavailable',
        });
    });

    it.each(['g1', 'g2'])('旧状态中的 guest ownerKey 不能为 %s 提供房主凭证', guestId => {
        const guard = evaluateEmptyRoomJoinGuard({
            metadata: buildMetadata(),
            state: buildState('guest:g1'),
            guestId,
            jwtSecret: 'secret',
        });

        expect(guard).toMatchObject({
            allowed: false,
            isEmptyRoom: true,
            status: 409,
            message: 'GUEST_OWNER_PROOF_UNAVAILABLE',
            reason: 'guest_owner_proof_unavailable',
        });
    });

    it.each([undefined, null, {}, 'guest:g1', { ownerKey: 42 }, { ownerKey: {} }])(
        '空房间拒绝缺失或无效的旧 owner 数据 %#',
        setupData => {
            const guard = evaluateEmptyRoomJoinGuard({
                metadata: buildMetadata(),
                state: { G: { __setupData: setupData }, _stateID: 0 },
                guestId: 'g1',
                jwtSecret: 'secret',
            });

            expect(guard.allowed).toBe(false);
            expect(guard.isEmptyRoom).toBe(true);
            expect(guard.status).toBe(403);
        },
    );

    it.each([undefined, null, {}, { ownerKey: 42 }])(
        '旧数据缺失或无效也不能绕过 metadata 中的 guest 房间限制 %#',
        setupData => {
            const guard = evaluateEmptyRoomJoinGuard({
                metadata: buildMetadata('guest:g1'),
                state: { G: { __setupData: setupData }, _stateID: 0 },
                guestId: 'g1',
                jwtSecret: 'secret',
            });

            expect(guard).toMatchObject({
                allowed: false,
                isEmptyRoom: true,
                status: 409,
                message: 'GUEST_OWNER_PROOF_UNAVAILABLE',
                reason: 'guest_owner_proof_unavailable',
            });
        },
    );

    it('仅有座位凭证的 guest 房间仍为非空，保持正常加入流程', () => {
        const guard = evaluateEmptyRoomJoinGuard({
            metadata: buildMetadata('guest:g1', buildPlayers({
                0: { credentials: 'test-owner-seat-proof' },
            })),
            guestId: 'g2',
            jwtSecret: 'secret',
        });

        expect(guard).toEqual({ allowed: true, isEmptyRoom: false });
    });

    it('空房间允许房主 user token 重连', () => {
        const jwtSecret = 'secret';
        const token = jwt.sign({ userId: 'u1' }, jwtSecret);
        const metadata = buildMetadata('user:u1');

        const guard = evaluateEmptyRoomJoinGuard({
            metadata,
            state: buildState('user:u1'),
            authHeader: `Bearer ${token}`,
            jwtSecret,
        });

        expect(guard.allowed).toBe(true);
        expect(guard.requesterKey).toBe('user:u1');
    });

    it('空房间遇到非法 token 直接拒绝', () => {
        const metadata = buildMetadata('user:u1');

        const guard = evaluateEmptyRoomJoinGuard({
            metadata,
            state: buildState('user:u1'),
            authHeader: 'Bearer invalid.token.payload',
            jwtSecret: 'secret',
        });

        expect(guard.allowed).toBe(false);
        expect(guard.reason).toBe('invalid_token');
        expect(guard.status).toBe(401);
    });

    it('空房间拒绝其他用户的有效 token', () => {
        const jwtSecret = 'secret';
        const token = jwt.sign({ userId: 'u2' }, jwtSecret);

        const guard = evaluateEmptyRoomJoinGuard({
            metadata: buildMetadata('user:u1'),
            state: buildState('user:u1'),
            authHeader: `Bearer ${token}`,
            jwtSecret,
        });

        expect(guard).toMatchObject({
            allowed: false,
            isEmptyRoom: true,
            status: 403,
            reason: 'not_owner',
        });
    });

    it('旧状态中的 user 房主仍可用有效 token 重连', () => {
        const jwtSecret = 'secret';
        const token = jwt.sign({ userId: 'u1' }, jwtSecret);

        const guard = evaluateEmptyRoomJoinGuard({
            metadata: buildMetadata(),
            state: buildState('user:u1'),
            authHeader: `Bearer ${token}`,
            jwtSecret,
        });

        expect(guard).toMatchObject({
            allowed: true,
            isEmptyRoom: true,
            requesterKey: 'user:u1',
        });
    });

    it('空房间缺失 ownerKey 时拒绝', () => {
        const metadata = buildMetadata();

        const guard = evaluateEmptyRoomJoinGuard({
            metadata,
            state: buildState(),
            guestId: 'g1',
            jwtSecret: 'secret',
        });

        expect(guard.allowed).toBe(false);
        expect(guard.reason).toBe('missing_owner');
        expect(guard.status).toBe(403);
    });
});
