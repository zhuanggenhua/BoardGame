import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, waitFor, fireEvent } from '@testing-library/react';

import { DICETHRONE_STATUS_ATLAS_IDS, TOKEN_IDS } from '../domain/ids';
import { registerDiceDefinition } from '../domain/diceRegistry';
import { moonElfDiceDefinition } from '../heroes/moon_elf/diceConfig';
import { getVisualMetaById } from '../domain/statusEffects';
import { Dice3D } from '../ui/Dice3D';
import {
    buildSpriteBackgroundImage,
    DICE_BG_SIZE,
    getDiceSpriteAssetPath,
    getDiceSpritePosition,
    getDiceSpriteUrls,
    resolveSpriteAssetUrls,
} from '../ui/assets';
import { getStatusEffectIconNode, loadStatusAtlases, type StatusIconAtlasConfig } from '../ui/statusEffects';
import { getAssetsBaseUrl, setAssetsBaseUrl } from '../../../core';

registerDiceDefinition(moonElfDiceDefinition);

describe('StatusEffectsIcons', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

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

    it('token 展示查询 debuff token 时应回退到对应视觉元数据', () => {
        const meta = getVisualMetaById(TOKEN_IDS.BOUNTY);

        expect(meta?.frameId).toBe(TOKEN_IDS.BOUNTY);
        expect(meta?.iconPath).toBe('dicethrone/images/gunslinger/icons/赏金');
        expect(meta?.sfxKey).toBe('ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a');
    });

    it('武士 token 视觉元数据应暴露专属 sfxKey，供动画冲击音优先使用', () => {
        const honor = getVisualMetaById(TOKEN_IDS.HONOR);
        const shame = getVisualMetaById(TOKEN_IDS.SHAME);
        const retribution = getVisualMetaById(TOKEN_IDS.SAMURAI_RETRIBUTION);

        expect(honor?.sfxKey).toBe('magic.general.simple_magic_sound_fx_pack_vol.light.heavenly_flame');
        expect(shame?.sfxKey).toBe('fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.pot_explosion');
        expect(retribution?.sfxKey).toBe('fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_power_up_lightning');
    });

    it('无 atlas 时应回退到单图 iconPath', () => {
        const html = renderToStaticMarkup(
            getStatusEffectIconNode(
                { iconPath: 'dicethrone/images/samurai/icons/荣誉' },
                'zh-CN',
                'normal',
                null
            )
        );

        expect(html).toContain('icons/compressed/');
        expect(html).toContain('background-size:contain');
    });

    it('会把 game-data 骰图路径折算成 dice-sprite 资源 key', () => {
        expect(getDiceSpriteAssetPath('moon_elf-dice', 'moon_elf')).toBe('dicethrone/images/moon_elf/dice');
    });

    it('game-data 骰图直链应保留为最终回退候选，避免压缩资源缺失时整块空白', () => {
        const urls = resolveSpriteAssetUrls('/game-data/dicethrone/monk/dice-sprite.png', 'zh-CN');
        expect(urls.at(-1)).toBe('/game-data/dicethrone/monk/dice-sprite.png');
    });

    it('渲染骰图背景时应指向 dice-sprite 的压缩资源', () => {
        const backgroundImage = buildSpriteBackgroundImage('/game-data/dicethrone/monk/dice-sprite.png');
        expect(backgroundImage).toContain('dicethrone/images/monk/compressed/dice.webp');
    });

    it('本地资源模式下，骰图候选 URL 应保留 /assets 前缀', () => {
        const urls = getDiceSpriteUrls('moon_elf-dice', 'moon_elf', 'zh-CN');
        expect(urls.some(url => url.includes('/dice.webp'))).toBe(true);
        expect(urls.some(url => url.startsWith('/assets/i18n/zh-CN/dicethrone/images/moon_elf/compressed/dice.webp'))).toBe(true);
    });

    it('远程资源模式下，骰图候选 URL 应走官方资源域名', () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');
        const urls = getDiceSpriteUrls('moon_elf-dice', 'moon_elf', 'zh-CN');
        const base = getAssetsBaseUrl();
        expect(urls.some(url => url.includes('/dice.webp'))).toBe(true);
        expect(urls.every(url => url.startsWith(`${base}/`))).toBe(true);
    });

    it('远端骰图探测应通过 Image 加载，不应依赖跨域 fetch 成功', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        class MockImage {
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            naturalWidth = 256;
            complete = false;
            decoding = 'auto';

            set src(_value: string) {
                queueMicrotask(() => {
                    this.complete = true;
                    this.onload?.();
                });
            }
        }

        const fetchMock = vi.fn(async () => {
            throw new Error('remote fetch should not be used for dice sprite probing');
        });

        vi.stubGlobal('Image', MockImage as unknown as typeof Image);
        vi.stubGlobal('fetch', fetchMock);

        const { getByTestId, container } = render(
            <Dice3D
                value={6}
                isRolling={false}
                size="48px"
                locale="zh-CN"
                characterId="moon_elf"
                definitionId="moon_elf-dice"
            />
        );

        const sprite = container.querySelector('img');
        if (sprite) {
            fireEvent.load(sprite);
        }
        await waitFor(() => {
            expect(getByTestId('dice-3d')).toHaveAttribute('data-sprite-ready', 'true');
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('本地骰图应直接使用 AssetLoader 候选 URL，并在 Image onload 后标记就绪', async () => {
        class MockImage {
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            naturalWidth = 256;
            complete = false;
            decoding = 'auto';

            set src(_value: string) {
                queueMicrotask(() => {
                    this.complete = true;
                    this.onload?.();
                });
            }
        }

        const fetchMock = vi.fn(async () => {
            throw new Error('local dice sprite should not fetch/blob in this path');
        });

        vi.stubGlobal('Image', MockImage as unknown as typeof Image);
        vi.stubGlobal('fetch', fetchMock);

        const { getByTestId } = render(
            <Dice3D
                value={6}
                isRolling={false}
                size="48px"
                locale="zh-CN"
                characterId="moon_elf"
                definitionId="moon_elf-dice"
            />
        );

        await waitFor(() => {
            expect(getByTestId('dice-3d')).toHaveAttribute('data-sprite-ready', 'true');
        });
        expect(fetchMock).not.toHaveBeenCalled();
        const expectedUrl = getDiceSpriteUrls('moon_elf-dice', 'moon_elf', 'zh-CN')[0];
        if (expectedUrl) {
            expect(getByTestId('dice-3d')).toHaveAttribute('data-sprite-url', expectedUrl);
        } else {
            expect(getByTestId('dice-3d')).toHaveAttribute('data-sprite-url', '');
        }
    });

    it('状态图集 JSON 在远程资源模式下应优先走官方资源域名', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
            ok: true,
            json: async () => ({
                meta: { image: 'status-icons-atlas.png', size: { w: 1314, h: 400 } },
                frames: {
                    purify: { frame: { x: 0, y: 0, w: 400, h: 400 } },
                },
            }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        const atlases = await loadStatusAtlases('zh-CN');

        expect(Object.keys(atlases).length).toBeGreaterThan(0);
        expect(fetchMock).toHaveBeenCalled();
        expect(fetchMock.mock.calls.every(([input]) => String(input).startsWith('https://assets.easyboardgame.top/official/'))).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/i18n/zh-CN/'))).toBe(true);
    });

    it('远端状态图集 JSON 缺失时应回退到本地 /assets', async () => {
        setAssetsBaseUrl('https://assets.easyboardgame.top/official');

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.startsWith('https://assets.easyboardgame.top/official/')) {
                return {
                    ok: false,
                    json: async () => null,
                };
            }
            return {
                ok: true,
                json: async () => ({
                    meta: { image: 'status-icons-atlas.png', size: { w: 1314, h: 400 } },
                    frames: {
                        purify: { frame: { x: 0, y: 0, w: 400, h: 400 } },
                    },
                }),
            };
        });
        vi.stubGlobal('fetch', fetchMock);

        const atlases = await loadStatusAtlases('zh-CN');

        expect(Object.keys(atlases).length).toBeGreaterThan(0);
        expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/assets/'))).toBe(true);
    });

    it('骰图切片坐标应匹配 3x3 atlas（使用下两行）', () => {
        expect(DICE_BG_SIZE).toBe('300% 300%');
        expect(getDiceSpritePosition(2)).toEqual({ xPos: 0, yPos: 50 });
        expect(getDiceSpritePosition(5)).toEqual({ xPos: 100, yPos: 50 });
        expect(getDiceSpritePosition(6)).toEqual({ xPos: 100, yPos: 100 });
    });

    it('dice sprite 缺失时应渲染 shimmer 占位（与手牌一致），避免整块空白', () => {
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
        expect(html).toContain('data-face-fallback="loading"');
    });
});
