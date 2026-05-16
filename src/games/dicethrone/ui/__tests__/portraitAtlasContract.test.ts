import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { getPortraitStyle } from '../assets';

const OLD_PORTRAIT_PATH = 'public/assets/i18n/zh-CN/dicethrone/images/Common/character-portraits.png';
const OLD_PORTRAIT_WEBP_PATH = 'public/assets/i18n/zh-CN/dicethrone/images/Common/compressed/character-portraits.webp';
const NEW_PORTRAIT_PATH = 'public/assets/i18n/zh-CN/dicethrone/images/Common/characterhead2.png';
const NEW_PORTRAIT_WEBP_PATH = 'public/assets/i18n/zh-CN/dicethrone/images/Common/compressed/characterhead2.webp';

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('DiceThrone portrait atlas contract', () => {
    it('老角色继续使用 character-portraits，新角色使用 characterhead2', () => {
        for (const characterId of ['monk', 'barbarian', 'pyromancer', 'paladin'] as const) {
            const style = getPortraitStyle(characterId, 'zh-CN');
            expect(style.backgroundImage).toContain('character-portraits');
            expect(style.backgroundImage).not.toContain('characterhead2');
        }

        for (const characterId of ['treant', 'ninja'] as const) {
            const style = getPortraitStyle(characterId, 'zh-CN');
            expect(style.backgroundImage).toContain('characterhead2');
            expect(style.backgroundImage).not.toContain('character-portraits');
        }
    });

    it('头像资源本体尺寸与 manifest hash 必须匹配分流合同', async () => {
        const oldPng = await sharp(OLD_PORTRAIT_PATH).metadata();
        const oldWebp = await sharp(OLD_PORTRAIT_WEBP_PATH).metadata();
        const newPng = await sharp(NEW_PORTRAIT_PATH).metadata();
        const newWebp = await sharp(NEW_PORTRAIT_WEBP_PATH).metadata();

        expect([oldPng.width, oldPng.height]).toEqual([3950, 4096]);
        expect([oldWebp.width, oldWebp.height]).toEqual([1975, 2048]);
        expect([newPng.width, newPng.height]).toEqual([3570, 6042]);
        expect([newWebp.width, newWebp.height]).toEqual([1210, 2048]);

        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/dicethrone/assets-manifest.json', 'utf8'));

        expect(rootManifest.files['zh-CN/dicethrone/images/Common/character-portraits'].variants.png.sha256)
            .toBe(sha256(OLD_PORTRAIT_PATH));
        expect(rootManifest.files['zh-CN/dicethrone/images/Common/compressed/character-portraits'].variants.webp.sha256)
            .toBe(sha256(OLD_PORTRAIT_WEBP_PATH));
        expect(gameManifest.files['images/Common/character-portraits'].variants.png.sha256)
            .toBe(sha256(OLD_PORTRAIT_PATH));
        expect(gameManifest.files['images/Common/compressed/character-portraits'].variants.webp.sha256)
            .toBe(sha256(OLD_PORTRAIT_WEBP_PATH));
        expect(gameManifest.files['images/Common/characterhead2'].variants.png.sha256)
            .toBe(sha256(NEW_PORTRAIT_PATH));
        expect(gameManifest.files['images/Common/compressed/characterhead2'].variants.webp.sha256)
            .toBe(sha256(NEW_PORTRAIT_WEBP_PATH));
    });
});
