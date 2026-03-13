import { describe, expect, it, vi } from 'vitest';
import { GameChangelogService } from '../src/modules/game-changelog/game-changelog.service';

type ChangelogRecord = {
    _id: { toString(): string };
    gameId: string;
    title: string;
    versionLabel: string | null;
    content: string;
    published: boolean;
    pinned: boolean;
    publishedAt: Date | null;
    createdBy: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
};

const createChangelogModel = (items: ChangelogRecord[]) => {
    const lean = vi.fn().mockResolvedValue(items);
    const sort = vi.fn().mockReturnValue({ lean });
    const find = vi.fn().mockReturnValue({ sort });
    return { find };
};

const createUserModel = (actor: {
    role: 'admin' | 'developer';
    developerGameIds?: string[];
}) => {
    const lean = vi.fn().mockResolvedValue(actor);
    const select = vi.fn().mockReturnValue({ lean });
    const findById = vi.fn().mockReturnValue({ select });
    return { findById };
};

const buildItem = (): ChangelogRecord => {
    const now = new Date('2026-03-12T10:00:00.000Z');
    return {
        _id: { toString: () => 'log-1' },
        gameId: 'smashup',
        title: '平衡性调整',
        versionLabel: 'v1.2.0',
        content: '修复若干问题',
        published: true,
        pinned: true,
        publishedAt: now,
        createdBy: 'internal-user-1',
        updatedBy: 'internal-user-2',
        createdAt: now,
        updatedAt: now,
    };
};

describe('GameChangelogService', () => {
    it('公开列表不会返回内部用户 ID', async () => {
        const changelogModel = createChangelogModel([buildItem()]);
        const service = new GameChangelogService(changelogModel as never, {} as never);

        const result = await service.listPublishedByGame('smashup');

        expect(changelogModel.find).toHaveBeenCalledWith({
            gameId: 'smashup',
            published: true,
        });
        expect(result).toEqual([
            {
                id: 'log-1',
                gameId: 'smashup',
                title: '平衡性调整',
                versionLabel: 'v1.2.0',
                content: '修复若干问题',
                published: true,
                pinned: true,
                publishedAt: new Date('2026-03-12T10:00:00.000Z'),
                createdAt: new Date('2026-03-12T10:00:00.000Z'),
                updatedAt: new Date('2026-03-12T10:00:00.000Z'),
            },
        ]);
        expect(result[0]).not.toHaveProperty('createdBy');
        expect(result[0]).not.toHaveProperty('updatedBy');
    });

    it('后台列表仍然保留内部用户 ID', async () => {
        const changelogModel = createChangelogModel([buildItem()]);
        const userModel = createUserModel({
            role: 'admin',
        });
        const service = new GameChangelogService(changelogModel as never, userModel as never);

        const result = await service.listForAdmin('admin-user-1');

        expect(result.availableGameIds).toBeNull();
        expect(result.items[0]?.createdBy).toBe('internal-user-1');
        expect(result.items[0]?.updatedBy).toBe('internal-user-2');
    });
});
