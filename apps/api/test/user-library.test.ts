import { describe, expect, it, vi } from 'vitest';
import type { Model } from 'mongoose';
import { UserSettingsService } from '../src/modules/user-settings/user-settings.service';
import type { UserUISettingsDocument } from '../src/modules/user-settings/schemas/user-ui-settings.schema';
import type { UserAudioSettingsDocument } from '../src/modules/user-settings/schemas/user-audio-settings.schema';

describe('用户收藏持久化', () => {
    it('新账户收藏为空；添加与移除只更新当前账户单项，保留其它设置', async () => {
        const findOne = vi.fn().mockResolvedValue(null);
        const findOneAndUpdate = vi.fn().mockResolvedValue({ favoriteGameIds: ['betrayal'] });
        const model = { findOne, findOneAndUpdate } as unknown as Model<UserUISettingsDocument>;
        const service = new UserSettingsService({} as Model<UserAudioSettingsDocument>, model);
        expect(await service.getFavoriteGames('viewer')).toEqual([]);
        expect(await service.setFavoriteGame('viewer', 'betrayal', true)).toEqual(['betrayal']);
        expect(findOneAndUpdate).toHaveBeenLastCalledWith({ userId: 'viewer' }, {
            $addToSet: { favoriteGameIds: 'betrayal' }, $setOnInsert: { userId: 'viewer' },
        }, { upsert: true, new: true });
        findOneAndUpdate.mockResolvedValue({ favoriteGameIds: [] });
        expect(await service.setFavoriteGame('viewer', 'betrayal', false)).toEqual([]);
        expect(findOneAndUpdate).toHaveBeenLastCalledWith({ userId: 'viewer' }, {
            $pull: { favoriteGameIds: 'betrayal' }, $setOnInsert: { userId: 'viewer' },
        }, { upsert: true, new: true });
    });
});
