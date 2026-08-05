import { describe, expect, it } from 'vitest';

import {
    DICETHRONE_CHARACTER_CATALOG,
    getDiceThroneCharacterNameKey,
} from '../domain/core-types';

describe('DiceThrone 角色名 i18n 合同', () => {
    it('角色目录中的每个英雄都应能解析出 nameKey', () => {
        for (const character of DICETHRONE_CHARACTER_CATALOG) {
            expect(
                getDiceThroneCharacterNameKey(character.id),
                `角色 ${character.id} 缺少可复用的 nameKey`,
            ).toBe(character.nameKey);
        }
    });

    it('新增英雄不应在共享映射里丢失 nameKey', () => {
        expect(getDiceThroneCharacterNameKey('zhanshujia')).toBe('characters.zhanshujia');
        expect(getDiceThroneCharacterNameKey('cursed_pirate')).toBe('characters.cursed_pirate');
        expect(getDiceThroneCharacterNameKey('tianshi')).toBe('characters.tianshi');
    });
});
