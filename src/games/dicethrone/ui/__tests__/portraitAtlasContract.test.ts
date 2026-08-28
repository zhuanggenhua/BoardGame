import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { CHARACTER_PORTRAIT_BINDINGS, getPortraitStyle } from '../assets';

const OLD_PORTRAIT_PATH = 'public/assets/i18n/zh-CN/dicethrone/images/Common/character-portraits.png';
const OLD_PORTRAIT_WEBP_PATH = 'public/assets/i18n/zh-CN/dicethrone/images/Common/compressed/character-portraits.webp';
const NEW_PORTRAIT_PATH = 'public/assets/i18n/zh-CN/dicethrone/images/Common/characterhead2.png';
const NEW_PORTRAIT_WEBP_PATH = 'public/assets/i18n/zh-CN/dicethrone/images/Common/compressed/characterhead2.webp';

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('DiceThrone portrait atlas contract', () => {
    it('老角色继续使用 character-portraits，新角色使用 characterhead2', () => {
        for (const characterId of ['monk', 'barbarian', 'pyromancer', 'paladin', 'artificer', 'vampire_lord'] as const) {
            const style = getPortraitStyle(characterId, 'zh-CN');
            expect(style.backgroundImage).toContain('character-portraits');
            expect(style.backgroundImage).not.toContain('characterhead2');
        }

        for (const characterId of ['treant', 'ninja', 'zhanshujia', 'cursed_pirate', 'tianshi', 'lieren'] as const) {
            const style = getPortraitStyle(characterId, 'zh-CN');
            expect(style.backgroundImage).toContain('characterhead2');
            expect(style.backgroundImage).not.toContain('character-portraits');
        }

        expect(getPortraitStyle('artificer', 'zh-CN').backgroundPosition)
            .toBe('22.1223% 14.7660%');
        expect(getPortraitStyle('tianshi', 'zh-CN').backgroundPosition)
            .toBe('20.0000% 16.6634%');
        expect(getPortraitStyle('artificer', 'zh-CN').backgroundPosition)
            .not.toBe(getPortraitStyle('tianshi', 'zh-CN').backgroundPosition);
        expect(getPortraitStyle('lieren', 'zh-CN').backgroundPosition)
            .toBe('0.0000% 33.3269%');
        expect(getPortraitStyle('vampire_lord', 'zh-CN').backgroundPosition)
            .toBe('11.0611% 14.7660%');
    });

    it('角色头像绑定必须明确图集和格位，且不允许静默共用格位', () => {
        expect(CHARACTER_PORTRAIT_BINDINGS.artificer).toEqual({ atlasId: 'legacy', row: 1, col: 2 });
        expect(CHARACTER_PORTRAIT_BINDINGS.tianshi).toEqual({ atlasId: 'new', row: 1, col: 1 });
        expect(CHARACTER_PORTRAIT_BINDINGS.lieren).toEqual({ atlasId: 'new', row: 2, col: 0 });
        expect(CHARACTER_PORTRAIT_BINDINGS.vampire_lord).toEqual({ atlasId: 'legacy', row: 1, col: 1 });

        const cells = Object.entries(CHARACTER_PORTRAIT_BINDINGS).map(([characterId, binding]) => (
            `${binding.atlasId}:${binding.row}:${binding.col}:${characterId}`
        ));
        const uniqueCells = new Set(cells.map(cell => cell.replace(/:[^:]+$/, '')));
        expect(uniqueCells.size).toBe(cells.length);
    });

    it('头像运行时资源本体尺寸与 manifest hash 必须匹配分流合同', async () => {
        const oldWebp = await sharp(OLD_PORTRAIT_WEBP_PATH).metadata();
        const newWebp = await sharp(NEW_PORTRAIT_WEBP_PATH).metadata();

        expect([oldWebp.width, oldWebp.height]).toEqual([1975, 2048]);
        expect([newWebp.width, newWebp.height]).toEqual([1210, 2048]);

        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/dicethrone/assets-manifest.json', 'utf8'));

        expect(rootManifest.files['zh-CN/dicethrone/images/Common/compressed/character-portraits'].variants.webp.sha256)
            .toBe(sha256(OLD_PORTRAIT_WEBP_PATH));
        expect(gameManifest.files['images/Common/compressed/character-portraits'].variants.webp.sha256)
            .toBe(sha256(OLD_PORTRAIT_WEBP_PATH));
        expect(gameManifest.files['images/Common/compressed/characterhead2'].variants.webp.sha256)
            .toBe(sha256(NEW_PORTRAIT_WEBP_PATH));

        expect(rootManifest.files['zh-CN/dicethrone/images/Common/character-portraits'].variants.png.sha256)
            .toBeTruthy();
        expect(gameManifest.files['images/Common/character-portraits'].variants.png.sha256)
            .toBeTruthy();
        expect(gameManifest.files['images/Common/characterhead2'].variants.png.sha256)
            .toBeTruthy();

        if (existsSync(OLD_PORTRAIT_PATH)) {
            const oldPng = await sharp(OLD_PORTRAIT_PATH).metadata();
            expect([oldPng.width, oldPng.height]).toEqual([3950, 4096]);
            expect(rootManifest.files['zh-CN/dicethrone/images/Common/character-portraits'].variants.png.sha256)
                .toBe(sha256(OLD_PORTRAIT_PATH));
            expect(gameManifest.files['images/Common/character-portraits'].variants.png.sha256)
                .toBe(sha256(OLD_PORTRAIT_PATH));
        }

        if (existsSync(NEW_PORTRAIT_PATH)) {
            const newPng = await sharp(NEW_PORTRAIT_PATH).metadata();
            expect([newPng.width, newPng.height]).toEqual([3570, 6042]);
            expect(gameManifest.files['images/Common/characterhead2'].variants.png.sha256)
                .toBe(sha256(NEW_PORTRAIT_PATH));
        }
    });
});
