import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    CLOUDFLARE_PAGES_MAX_FILE_BYTES,
    DIST_I18N_JSON_RETAIN_RELATIVE_PATHS,
    getEmbeddedPublicAssetMirrorDirNamesToRemove,
    isCloudflarePagesFileSizeAllowed,
    isRemovedAndroidEmbeddedPublicAssetDir,
    isRemovedWebLegacyGameAssetDir,
    isRetainedDistI18nFile,
    isRetainedDistLogoFile,
    WEB_LEGACY_GAME_ASSET_DIR_NAMES_TO_REMOVE,
} from '../../../scripts/deploy/prune-web-dist-assets.mjs';

describe('Android embedded 资源裁剪', () => {
    it('Docker 构建上下文会保留首页 logo 和二维码文件', () => {
        const dockerignore = readFileSync(join(process.cwd(), '.dockerignore'), 'utf8');

        expect(dockerignore).toContain('public/**/*.png');
        expect(dockerignore).toContain('public/**/*.jpg');
        expect(dockerignore).toContain('!public/logos/');
        expect(dockerignore).toContain('!public/logos/**');
    });

    it('只为王权骰铸首页保留压缩缩略图，不回塞大图资源', () => {
        expect(isRetainedDistI18nFile('zh-CN/dicethrone/thumbnails/compressed/fengm.webp')).toBe(true);

        expect(isRetainedDistI18nFile('zh-CN/dicethrone/thumbnails/fengm.png')).toBe(false);
        expect(isRetainedDistI18nFile('zh-CN/dicethrone/images/pyromancer/player-board.png')).toBe(false);
        expect(isRetainedDistI18nFile('zh-CN/dicethrone/images/pyromancer/compressed/player-board.webp')).toBe(false);
    });

    it('DiceThrone 内置保留清单不包含未压缩图片', () => {
        const diceThroneRetainedImages = DIST_I18N_JSON_RETAIN_RELATIVE_PATHS
            .filter((relativePath) => relativePath.startsWith('zh-CN/dicethrone/'))
            .filter((relativePath) => /\.(?:png|jpe?g|webp)$/i.test(relativePath));

        expect(diceThroneRetainedImages).toEqual([
            'zh-CN/dicethrone/thumbnails/compressed/fengm.webp',
        ]);
    });

    it('DiceThrone 对局图片和状态图集不进入 Android embedded 保留清单', () => {
        const diceThroneGameplayAssets = DIST_I18N_JSON_RETAIN_RELATIVE_PATHS
            .filter((relativePath) => relativePath.startsWith('zh-CN/dicethrone/images/'));

        expect(diceThroneGameplayAssets).toEqual([]);
        expect(isRetainedDistI18nFile('zh-CN/dicethrone/images/monk/status-icons-atlas.json')).toBe(false);
        expect(isRetainedDistI18nFile('zh-CN/dicethrone/images/monk/compressed/status-icons-atlas.webp')).toBe(false);
    });

    it('Web 发布产物不允许超过 Cloudflare Pages 单文件上限', () => {
        expect(isCloudflarePagesFileSizeAllowed(CLOUDFLARE_PAGES_MAX_FILE_BYTES)).toBe(true);
        expect(isCloudflarePagesFileSizeAllowed(CLOUDFLARE_PAGES_MAX_FILE_BYTES + 1)).toBe(false);
    });

    it('Web 发布产物会移除旧顶层游戏素材目录', () => {
        expect(WEB_LEGACY_GAME_ASSET_DIR_NAMES_TO_REMOVE).toContain('smashup');
        expect(isRemovedWebLegacyGameAssetDir('smashup')).toBe(true);
        expect(isRemovedWebLegacyGameAssetDir('i18n')).toBe(false);
        expect(isRemovedWebLegacyGameAssetDir('atlas-configs')).toBe(false);
    });

    it('Web 和 Android embedded 会保留首页 HTML 直接引用的 logos 静态图', () => {
        expect(isRetainedDistLogoFile('logo_1_grid.png')).toBe(true);
        expect(isRetainedDistLogoFile('logo_1_grid.svg')).toBe(true);
        expect(isRetainedDistLogoFile('weixin.jpg')).toBe(true);
        expect(isRetainedDistLogoFile('zhifubao.jpg')).toBe(true);
    });

    it('Android embedded 会移除 public/assets 镜像目录，避免把游戏素材打进 APK', () => {
        const removedDirs = getEmbeddedPublicAssetMirrorDirNamesToRemove();

        expect(removedDirs).toEqual(expect.arrayContaining([
            'atlas-configs',
            'common',
            'i18n',
            'smashup',
        ]));
        expect(isRemovedAndroidEmbeddedPublicAssetDir('smashup')).toBe(true);
        expect(isRemovedAndroidEmbeddedPublicAssetDir('atlas-configs')).toBe(true);
        expect(isRemovedAndroidEmbeddedPublicAssetDir('vendor-react')).toBe(false);
    });
});
