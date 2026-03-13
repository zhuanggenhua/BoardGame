import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { DICETHRONE_STATUS_ATLAS_IDS } from '../domain/ids';
import { registerDiceDefinition } from '../domain/diceRegistry';
import { moonElfDiceDefinition } from '../heroes/moon_elf/diceConfig';
import { Dice3D } from '../ui/Dice3D';
import {
    buildSpriteBackgroundImage,
    DICE_BG_SIZE,
    getDiceSpriteAssetPath,
    getDiceSpritePosition,
    getDiceSpriteUrls,
} from '../ui/assets';
import { getStatusEffectIconNode, type StatusIconAtlasConfig } from '../ui/statusEffects';
import { getAssetsBaseUrl } from '../../../core';

registerDiceDefinition(moonElfDiceDefinition);

describe('StatusEffectsIcons', () => {
    it('渲染状态图集时应指向压缩后的 atlas 资源', () => {
        const atlas: StatusIconAtlasConfig = {
            imageW: 1314,
            imageH: 400,
            frames: {
                purify: { x: 0, y: 0, w: 400, h: 400 },
            },
            imagePath: 'dicethrone/images/monk/status-icons-atlas.png',
        };

        const html = renderToStaticMarkup(
            getStatusEffectIconNode(
                { frameId: 'purify', atlasId: DICETHRONE_STATUS_ATLAS_IDS.MONK },
                undefined,
                'normal',
                { [DICETHRONE_STATUS_ATLAS_IDS.MONK]: atlas }
            )
        );

        expect(html).toContain('/assets/dicethrone/images/monk/compressed/status-icons-atlas.webp');
    });

    it('会把 game-data 骰图路径折算成 dice-sprite 资源 key', () => {
        expect(getDiceSpriteAssetPath('moon_elf-dice', 'moon_elf')).toBe('dicethrone/images/moon_elf/dice');
    });

    it('渲染骰图背景时应指向 dice-sprite 的压缩资源', () => {
        const backgroundImage = buildSpriteBackgroundImage('/game-data/dicethrone/monk/dice-sprite.png');
        expect(backgroundImage).toContain('dicethrone/images/monk/compressed/dice.webp');
    });

    it('R2 路径兼容：骰图强制走远程 R2，不返回本地 /assets 路径', () => {
        const urls = getDiceSpriteUrls('moon_elf-dice', 'moon_elf', 'zh-CN');
        const base = getAssetsBaseUrl();
        expect(urls.some(url => url.includes('/dice.webp'))).toBe(true);
        expect(urls.every(url => !url.startsWith('/assets/'))).toBe(true);
        if (base.startsWith('http://') || base.startsWith('https://')) {
            expect(urls.every(url => url.startsWith(`${base}/`))).toBe(true);
        } else {
            expect(urls.every(url => url.startsWith('/'))).toBe(true);
        }
    });

    it('骰图切片坐标应匹配旧版 3x3 atlas 布局', () => {
        expect(DICE_BG_SIZE).toBe('300% 300%');
        expect(getDiceSpritePosition(2)).toEqual({ xPos: 0, yPos: 50 });
        expect(getDiceSpritePosition(5)).toEqual({ xPos: 100, yPos: 50 });
        expect(getDiceSpritePosition(6)).toEqual({ xPos: 100, yPos: 100 });
    });

    it('dice sprite 缺失时不应渲染占位文本内容', () => {
        const html = renderToStaticMarkup(
            <Dice3D
                value={6}
                isRolling={false}
                size="48px"
                characterId="moon_elf"
                definitionId="moon_elf-dice"
            />
        );

        expect(html).toContain('data-sprite-ready="false"');
        expect(html).toContain('data-face-id="1"');
        expect(html).not.toContain('data-face-symbol=');
    });
});
