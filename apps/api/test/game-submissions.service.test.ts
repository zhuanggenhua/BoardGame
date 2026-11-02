import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Model } from 'mongoose';
const storage = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('../../../src/server/storage/UGCStorageService', () => ({ createUGCStorageService: () => storage }));
import { GameSubmissionsService } from '../src/modules/ugc/game-submissions.service';
import type { GameSubmissionDocument } from '../src/modules/ugc/schemas/game-submission.schema';
import type { ExternalGamesService } from '../src/modules/ugc/external-games.service';
const draft = { name: ' 测试游戏 ', description: '游戏介绍', url: 'https://example.com/game', category: 'card', minPlayers: 2, maxPlayers: 4, author: '作者', rules: '规则' };
const createService = () => {
    const model = { create: vi.fn(async data => data), findOne: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn() };
    const games = { assertSubmissionEditable: vi.fn(), publishSubmission: vi.fn(async () => 'external-published') } as unknown as ExternalGamesService;
    return { model, games, service: new GameSubmissionsService(model as unknown as Model<GameSubmissionDocument>, games) };
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

describe('投稿规则文件合同', () => {
    const pdf = () => ({ buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n'), originalname: '规则.pdf', mimetype: 'application/pdf' });
    const record = () => ({ ...draft, submissionId: 'draft-id', ownerId: 'owner', status: 'draft', updatedAt: new Date(), coverUrl: '/cover.webp' });
    it('规则文件写入存储及草稿，文件路径不使用用户文件名', async () => {
        const { model, service } = createService();
        model.findOne.mockResolvedValue(record()); model.findOneAndUpdate.mockResolvedValue({});
        storage.upload.mockResolvedValue('/assets/ugc/owner/submission-draft-id/rules.pdf');
        const result = await service.uploadRules('owner', 'draft-id', pdf());
        expect(result.rulesDocument).toEqual(expect.objectContaining({ name: '规则.pdf', size: pdf().buffer.length, url: expect.stringContaining('/assets/ugc/') }));
        expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', packageId: 'submission-draft-id', fileName: expect.stringMatching(/^rules-[a-f0-9]+\.pdf$/), contentType: 'application/pdf' }));
        expect(model.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner', status: { $ne: 'pending' } }), expect.objectContaining({ $set: expect.objectContaining({ rulesDocument: result.rulesDocument, status: 'draft' }) }), { new: true });
    });
    it('普通字段不能伪造规则文件地址', async () => {
        const { service, model } = createService();
        await service.create('owner', { ...draft, rulesDocument: { url: 'https://evil.invalid/forged.pdf' } } as typeof draft);
        expect(model.create.mock.calls[0][0]).not.toHaveProperty('rulesDocument');
    });
    it('待审核或他人投稿不允许替换与移除规则文件', async () => {
        const { service, model } = createService();
        model.findOne.mockResolvedValue({ ...record(), status: 'pending' });
        await expect(service.uploadRules('owner', 'draft-id', pdf())).rejects.toThrow('审核');
        await expect(service.removeRules('owner', 'draft-id')).rejects.toThrow('审核');
        model.findOne.mockResolvedValue(null);
        await expect(service.uploadRules('other', 'draft-id', pdf())).rejects.toThrow('没有找到');
        expect(storage.upload).not.toHaveBeenCalled();
    });
    it('拒绝伪装文件及超限文件且不写存储', async () => {
        const { service, model } = createService(); model.findOne.mockResolvedValue(record());
        await expect(service.uploadRules('owner', 'draft-id', { ...pdf(), buffer: Buffer.from('<html>fake</html>') })).rejects.toThrow('PDF');
        await expect(service.uploadRules('owner', 'draft-id', { ...pdf(), buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })).rejects.toThrow('10 MB');
        expect(storage.upload).not.toHaveBeenCalled();
    });
    it('移除规则文件会清空元数据，不能保留旧文件引用', async () => {
        const { service, model } = createService();
        model.findOne.mockResolvedValue(record()); model.findOneAndUpdate.mockResolvedValue({});
        await service.removeRules('owner', 'draft-id');
        expect(model.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner', status: { $ne: 'pending' } }), expect.objectContaining({ $unset: expect.objectContaining({ rulesDocument: 1 }) }), { new: true });
    });
    it('审核发布向公开游戏传递草稿中已保存的规则文件', async () => {
        const { service, model, games } = createService();
        const rulesDocument = { url: '/assets/ugc/owner/submission-draft-id/rules.pdf', name: '规则.pdf', size: 500 };
        const pending = { ...record(), status: 'pending', rulesDocument };
        model.findOne.mockResolvedValue(pending); model.findOneAndUpdate.mockResolvedValue({ ...pending, status: 'approved' });
        await service.review('admin', 'draft-id', { decision: 'approved', comment: '规则文件可查看', revision: pending.updatedAt.toISOString() });
        expect(games.publishSubmission).toHaveBeenCalledWith('draft-id', 'owner', expect.anything(), '/cover.webp', rulesDocument);
    });
});
