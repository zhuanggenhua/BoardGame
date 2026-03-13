import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { DICETHRONE_STATUS_ATLAS_IDS } from '../domain/ids';
import { registerDiceDefinition } from '../domain/diceRegistry';
import { moonElfDiceDefinition } from '../heroes/moon_elf/diceConfig';
import { Dice3D } from '../ui/Dice3D';
import { buildSpriteBackgroundImage, getDiceSpriteAssetPath } from '../ui/assets';
import { getStatusEffectIconNode, type StatusIconAtlasConfig } from '../ui/statusEffects';

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
        expect(getDiceSpriteAssetPath('moon_elf-dice', 'moon_elf')).toBe('dicethrone/images/moon_elf/dice-sprite');
    });

    it('渲染骰图背景时应指向 dice-sprite 的压缩资源', () => {
        const backgroundImage = buildSpriteBackgroundImage('/game-data/dicethrone/monk/dice-sprite.png');
        expect(backgroundImage).toContain('/assets/dicethrone/images/monk/compressed/dice-sprite.webp');
    });

    it('dice sprite 缺失时应渲染可读的正式 fallback 骰面', () => {
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
        expect(html).toContain('data-face-symbol="moon"');
        expect(html).toContain('>月<');
        expect(html).toContain('>M<');
    });
});
