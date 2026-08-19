import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import '../domain';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { getDiceDefinition } from '../domain/diceRegistry';
import { IMPLEMENTED_DICETHRONE_CHARACTER_IDS } from '../domain/types';

const DICE_SPRITE_PATH_RE = /^dicethrone\/images\/[^/]+\/dice$/;

const assetRoot = (...parts: string[]) => join(
    process.cwd(),
    'public',
    'assets',
    'i18n',
    'zh-CN',
    ...parts,
);

function resolveCompressedAssetPath(logicalPath: string): string {
    const parts = logicalPath.split('/');
    const basename = parts.at(-1);
    if (!basename) {
        return '';
    }
    return assetRoot(...parts.slice(0, -1), 'compressed', `${basename}.webp`);
}

describe('DiceThrone 骰子图片资源合同', () => {
    it('所有已实现角色的骰子贴图都指向正式 i18n 压缩资源', () => {
        const violations: string[] = [];

        for (const characterId of IMPLEMENTED_DICETHRONE_CHARACTER_IDS) {
            const data = CHARACTER_DATA_MAP[characterId];
            const definition = getDiceDefinition(data.diceDefinitionId);
            const spriteSheet = definition?.assets?.spriteSheet;

            if (!definition) {
                violations.push(`${characterId}: 未注册骰子定义 ${data.diceDefinitionId}`);
                continue;
            }
            if (!spriteSheet) {
                violations.push(`${characterId}: 骰子定义缺少 spriteSheet`);
                continue;
            }
            if (spriteSheet.startsWith('/game-data/dicethrone/')) {
                violations.push(`${characterId}: 仍在引用旧 game-data 直链 ${spriteSheet}`);
                continue;
            }
            if (!DICE_SPRITE_PATH_RE.test(spriteSheet)) {
                violations.push(`${characterId}: 骰子路径不是正式逻辑路径 ${spriteSheet}`);
                continue;
            }

            const compressedPath = resolveCompressedAssetPath(spriteSheet);
            if (!existsSync(compressedPath)) {
                violations.push(`${characterId}: 缺少压缩骰子图 ${compressedPath}`);
            }
        }

        expect(violations).toEqual([]);
    });
});
