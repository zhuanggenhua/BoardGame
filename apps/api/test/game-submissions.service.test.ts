import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Model } from 'mongoose';
const storage = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('../../../src/server/storage/UGCStorageService', () => ({ createUGCStorageService: () => storage }));
import { GameSubmissionsService } from '../src/modules/ugc/game-submissions.service';
import type { GameSubmissionDocument } from '../src/modules/ugc/schemas/game-submission.schema';
import type { ExternalGamesService } from '../src/modules/ugc/external-games.service';
const draft = { name: ' 测试游戏 ', description: '游戏介绍', url: 'https://example.com/game', category: 'card', minPlayers: 2, maxPlayers: 4, author: '作者', rules: '规则' };
const createService = () => {
    const model = { create: vi.fn(async data => data), findOne: vi.fn(), findOneAndUpdate: vi.fn() };
    const games = { assertSubmissionEditable: vi.fn() } as unknown as ExternalGamesService;
    return { model, service: new GameSubmissionsService(model as unknown as Model<GameSubmissionDocument>, games) };
};
beforeEach(() => vi.clearAllMocks());
describe('外部游戏投稿持久化', () => {
    it('创建规范化草稿，不把提交资料当成已发布游戏', async () => {
        const { service, model } = createService();
        const record = await service.create('owner', draft);
        expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ name: '测试游戏', ownerId: 'owner', status: 'draft' }));
        expect(record.submissionId).toBeTruthy();
    });
    it('禁止反转人数范围与空白正文', () => {
        const { service } = createService();
        expect(() => service.create('owner', { ...draft, minPlayers: 5 })).toThrow('最少人数');
        expect(() => service.create('owner', { ...draft, description: ' ' })).toThrow('名称和介绍');
    });
    it('不能更新别人的投稿，查询必须同时限定所有者和投稿编号', async () => {
        const { service, model } = createService(); model.findOne.mockResolvedValue(null);
        await expect(service.update('other', 'id', draft)).rejects.toThrow('没有找到');
        expect(model.findOne).toHaveBeenCalledWith({ ownerId: 'other', submissionId: 'id' });
    });
    it('未上传封面不能送审；有封面的草稿只进入待审核', async () => {
        const { service, model } = createService();
        const record = { ...draft, coverUrl: '', status: 'draft', reviewComment: '', save: vi.fn() };
        model.findOne.mockResolvedValue(record);
        await expect(service.submit('owner', 'id')).rejects.toThrow('封面');
        expect(record.save).not.toHaveBeenCalled();
        record.coverUrl = 'https://example.com/cover.webp';
        model.findOneAndUpdate.mockResolvedValue({ ...record, status: 'pending' });
        expect((await service.submit('owner', 'id')).status).toBe('pending');
    });
});
