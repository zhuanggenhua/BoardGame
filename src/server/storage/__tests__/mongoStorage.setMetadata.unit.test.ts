import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchMetadata } from '../../../engine/transport/storage';

const buildMetadata = (): MatchMetadata => ({
    gameName: 'tictactoe',
    players: {
        0: { name: 'Alice', credentials: 'cred-a', isConnected: true },
        1: { isConnected: false },
    },
    createdAt: Date.now() - 1000,
    updatedAt: Date.now(),
});

describe('MongoStorage.setMetadata freshness', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('setMetadata 应显式推进文档顶层 updatedAt，避免 cleanup/list freshness 继续停在旧值', async () => {
        const updateOne = vi.fn(async () => ({ acknowledged: true }));
        const existing = {
            ttlSeconds: 0,
            expiresAt: null,
            metadata: {
                players: {
                    0: { isConnected: true },
                    1: { isConnected: false },
                },
            },
        };
        const modelStub = {
            findOne: vi.fn(() => ({
                select: vi.fn(() => ({
                    lean: vi.fn(async () => existing),
                })),
            })),
            updateOne,
        };

        vi.doMock('mongoose', () => {
            class SchemaMock {
                static Types = { Mixed: 'Mixed' };

                constructor(..._args: unknown[]) {}

                index(..._args: unknown[]) {}
            }

            return {
                default: {
                    models: { Match: modelStub },
                    model: vi.fn(() => modelStub),
                },
                Schema: SchemaMock,
                Document: class {},
                Model: class {},
            };
        });

        const { MongoStorage } = await import('../MongoStorage');
        const storage = new MongoStorage();
        const metadata = buildMetadata();

        await storage.setMetadata('match-set-metadata', metadata);

        expect(updateOne).toHaveBeenCalledTimes(1);
        expect(updateOne).toHaveBeenCalledWith(
            { matchID: 'match-set-metadata' },
            expect.objectContaining({
                metadata,
                updatedAt: expect.any(Date),
            }),
        );
        const updatePayload = updateOne.mock.calls[0]?.[1] as { updatedAt?: Date };
        expect(updatePayload.updatedAt?.getTime()).toBeGreaterThanOrEqual(metadata.updatedAt);
    });
});
