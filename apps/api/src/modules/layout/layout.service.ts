import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { createAuthoringDocument } from '../../../../../src/ui-scene/compiler';
import type { UISceneAuthoringSavePayload } from '../../../../../src/ui-scene/types';

export type LayoutSaveResult = {
    filePath: string;
    relativePath: string;
    bytes: number;
};

export type UiSceneAuthoringSaveResult = {
    filePath: string;
    compiledFilePath: string;
    relativePath: string;
    compiledRelativePath: string;
    bytes: number;
    compiledBytes: number;
};

export type AbilitySlotLayoutItem = {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
};

export type DiceThroneAbilityLayoutVersion = 'v1' | 'v2';

export type PlayerBoardUiTuning = {
    shellTranslateX: number;
    playerBoardTranslateY: number;
    magnifyButtonTop: number;
    playerBoardBaseHeightUnits: number;
    tipBoardHeightUnits: number;
    centerBoardGapUnits: number;
};

export type DiceThroneBoardShellTuningMap = Record<DiceThroneAbilityLayoutVersion, PlayerBoardUiTuning>;

export type DiceThroneBoardLayoutPayload = {
    slotLayouts: Record<DiceThroneAbilityLayoutVersion, AbilitySlotLayoutItem[]>;
    uiTuning: DiceThroneBoardShellTuningMap;
};

@Injectable()
export class LayoutService {
    private readonly baseDir: string;
    private readonly fileName = 'summonerwars.layout.json';
    private readonly repoRoot: string;
    private readonly abilityLayoutPath: string;
    private readonly uiSceneRootPath: string;

    constructor() {
        const cwd = process.cwd();
        const marker = `${sep}apps${sep}api`;
        const markerIndex = cwd.lastIndexOf(marker);
        this.repoRoot = markerIndex >= 0 ? cwd.slice(0, markerIndex) : cwd;
        const envDir = process.env.LAYOUT_DATA_DIR?.trim();
        if (envDir) {
            this.baseDir = resolve(cwd, envDir);
        } else {
            this.baseDir = resolve(this.repoRoot, 'public/game-data');
        }
        const envAbilityPath = process.env.DICETHRONE_ABILITY_LAYOUT_PATH?.trim();
        this.abilityLayoutPath = envAbilityPath
            ? resolve(cwd, envAbilityPath)
            : resolve(this.repoRoot, 'src/games/dicethrone/ui/abilitySlotLayout.ts');
        const envUiSceneRoot = process.env.UI_SCENE_ROOT_PATH?.trim();
        this.uiSceneRootPath = envUiSceneRoot
            ? resolve(cwd, envUiSceneRoot)
            : resolve(this.repoRoot, 'src/ui-scenes');
    }

    async saveSummonerWarsLayout(config: Record<string, unknown>): Promise<LayoutSaveResult> {
        if (!config || typeof config !== 'object') {
            throw new Error('layoutConfig.invalid');
        }
        await mkdir(this.baseDir, { recursive: true });
        const filePath = resolve(this.baseDir, this.fileName);
        const content = JSON.stringify(config, null, 2);
        await writeFile(filePath, content, 'utf8');
        return {
            filePath,
            relativePath: this.toRelativePath(filePath),
            bytes: Buffer.byteLength(content, 'utf8'),
        };
    }

    async saveDiceThroneAbilityLayout(payload: DiceThroneBoardLayoutPayload): Promise<LayoutSaveResult> {
        if (!payload || typeof payload !== 'object' || !payload.slotLayouts || !payload.uiTuning) {
            throw new Error('layoutConfig.invalid');
        }
        const content = this.buildDiceThroneAbilityLayoutFile(payload);
        await mkdir(dirname(this.abilityLayoutPath), { recursive: true });
        await writeFile(this.abilityLayoutPath, content, 'utf8');
        return {
            filePath: this.abilityLayoutPath,
            relativePath: this.toRelativePath(this.abilityLayoutPath),
            bytes: Buffer.byteLength(content, 'utf8'),
        };
    }

    async saveUiSceneAuthoring(sceneId: string, payload: UISceneAuthoringSavePayload): Promise<UiSceneAuthoringSaveResult> {
        const normalizedSceneId = sceneId?.trim();
        if (!normalizedSceneId || !payload || typeof payload !== 'object') {
            throw new Error('layoutConfig.invalid');
        }
        if (payload.sceneId && payload.sceneId !== normalizedSceneId) {
            throw new Error('layoutConfig.sceneIdMismatch');
        }
        if (![payload.assetRegistryYaml, payload.skinYaml, payload.sceneYaml].every((value) => typeof value === 'string')) {
            throw new Error('layoutConfig.invalid');
        }

        const sceneDir = resolve(this.uiSceneRootPath, normalizedSceneId);
        const assetRegistryPath = resolve(sceneDir, 'asset-registry.yaml');
        const skinPath = resolve(sceneDir, `${normalizedSceneId}.skin.yaml`);
        const scenePath = resolve(sceneDir, `${normalizedSceneId}.ui.yaml`);
        const compiledPath = resolve(sceneDir, `${normalizedSceneId}.compiled.json`);

        const authoring = createAuthoringDocument({
            sceneId: normalizedSceneId,
            assetRegistryFile: this.toRelativePath(assetRegistryPath),
            assetRegistryYaml: payload.assetRegistryYaml,
            skinFile: this.toRelativePath(skinPath),
            skinYaml: payload.skinYaml,
            sceneFile: this.toRelativePath(scenePath),
            sceneYaml: payload.sceneYaml,
        });
        const compiledJson = JSON.stringify(authoring.compiled, null, 2);

        await mkdir(sceneDir, { recursive: true });
        await writeFile(assetRegistryPath, payload.assetRegistryYaml, 'utf8');
        await writeFile(skinPath, payload.skinYaml, 'utf8');
        await writeFile(scenePath, payload.sceneYaml, 'utf8');
        await writeFile(compiledPath, compiledJson, 'utf8');

        return {
            filePath: scenePath,
            compiledFilePath: compiledPath,
            relativePath: this.toRelativePath(scenePath),
            compiledRelativePath: this.toRelativePath(compiledPath),
            bytes: Buffer.byteLength(payload.sceneYaml, 'utf8'),
            compiledBytes: Buffer.byteLength(compiledJson, 'utf8'),
        };
    }

    private buildDiceThroneAbilityLayoutFile(payload: DiceThroneBoardLayoutPayload) {
        const { slotLayouts, uiTuning } = payload;
        const versions: DiceThroneAbilityLayoutVersion[] = ['v1', 'v2'];
        const hasInvalidVersion = versions.some((version) => !Array.isArray(slotLayouts[version]) || slotLayouts[version].length === 0);
        if (hasInvalidVersion) {
            throw new Error('layoutConfig.invalid');
        }
        const hasInvalidUiTuning = versions.some((version) => {
            const tuning = uiTuning[version];
            if (!tuning) return true;
            return ![
                tuning.shellTranslateX,
                tuning.playerBoardTranslateY,
                tuning.magnifyButtonTop,
                tuning.playerBoardBaseHeightUnits,
                tuning.tipBoardHeightUnits,
                tuning.centerBoardGapUnits,
            ].every((value) => typeof value === 'number' && Number.isFinite(value));
        });
        if (hasInvalidUiTuning) {
            throw new Error('layoutConfig.invalid');
        }

        const renderLayout = (items: AbilitySlotLayoutItem[]) => items.map((slot) => {
            const x = this.formatSlotValue(slot.x);
            const y = this.formatSlotValue(slot.y);
            const w = this.formatSlotValue(slot.w);
            const h = this.formatSlotValue(slot.h);
            return `    { id: '${slot.id}', x: ${x}, y: ${y}, w: ${w}, h: ${h} },`;
        }).join('\n');

        const renderUiTuning = (tuning: PlayerBoardUiTuning) => `{
        shellTranslateX: ${this.formatSlotValue(tuning.shellTranslateX)},
        playerBoardTranslateY: ${this.formatSlotValue(tuning.playerBoardTranslateY)},
        magnifyButtonTop: ${this.formatSlotValue(tuning.magnifyButtonTop)},
        playerBoardBaseHeightUnits: ${this.formatSlotValue(tuning.playerBoardBaseHeightUnits)},
        tipBoardHeightUnits: ${this.formatSlotValue(tuning.tipBoardHeightUnits)},
        centerBoardGapUnits: ${this.formatSlotValue(tuning.centerBoardGapUnits)},
    }`;

        return `import type { CharacterId } from '../domain/types';

/**
 * DiceThrone 技能槽布局（游戏级配置）
 * - 使用百分比坐标，基于玩家面板图片
 * - 所有角色显式声明使用的布局版本
 */
export interface AbilitySlotLayoutItem {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export type DiceThronePlayerBoardLayoutVersion = 'v1' | 'v2';

type PlayerBoardDimensions = {
    width: number;
    height: number;
};

export type PlayerBoardUiTuning = {
    shellTranslateX: number;
    playerBoardTranslateY: number;
    magnifyButtonTop: number;
    playerBoardBaseHeightUnits: number;
    tipBoardHeightUnits: number;
    centerBoardGapUnits: number;
};

const V1_ABILITY_SLOT_LAYOUT: AbilitySlotLayoutItem[] = [
${renderLayout(slotLayouts.v1)}
];

// v2 面板来自枪手 / 武士图片裁图坐标，顶部留白显著增加。
const V2_ABILITY_SLOT_LAYOUT: AbilitySlotLayoutItem[] = [
${renderLayout(slotLayouts.v2)}
];

export type DiceThroneBoardShellTuningMap = Record<DiceThronePlayerBoardLayoutVersion, PlayerBoardUiTuning>;

export type DiceThroneBoardLayoutConfig = {
    slotLayouts: Record<DiceThronePlayerBoardLayoutVersion, AbilitySlotLayoutItem[]>;
    uiTuning: DiceThroneBoardShellTuningMap;
};

export const DICETHRONE_ABILITY_SLOT_LAYOUTS: Record<DiceThronePlayerBoardLayoutVersion, AbilitySlotLayoutItem[]> = {
    v1: V1_ABILITY_SLOT_LAYOUT,
    v2: V2_ABILITY_SLOT_LAYOUT,
};

export const DEFAULT_ABILITY_SLOT_LAYOUT: AbilitySlotLayoutItem[] = DICETHRONE_ABILITY_SLOT_LAYOUTS.v1;

export const DICETHRONE_PLAYER_BOARD_DIMENSIONS: Record<string, PlayerBoardDimensions> = {
    barbarian: { width: 2048, height: 1675 },
    gunslinger: { width: 2048, height: 1254 },
    monk: { width: 2048, height: 1673 },
    moon_elf: { width: 2048, height: 1670 },
    paladin: { width: 2048, height: 1680 },
    pyromancer: { width: 2048, height: 1674 },
    samurai: { width: 2048, height: 1248 },
    shadow_thief: { width: 2048, height: 1686 },
};

export const DICETHRONE_PLAYER_BOARD_LAYOUT_VERSION_BY_CHARACTER: Record<string, DiceThronePlayerBoardLayoutVersion> = {
    monk: 'v1',
    barbarian: 'v1',
    pyromancer: 'v1',
    moon_elf: 'v1',
    shadow_thief: 'v1',
    paladin: 'v1',
    gunslinger: 'v2',
    samurai: 'v2',
};

export const DICETHRONE_PLAYER_BOARD_UI_TUNING: DiceThroneBoardShellTuningMap = {
    v1: ${renderUiTuning(uiTuning.v1)},
    v2: ${renderUiTuning(uiTuning.v2)},
};

export const DICETHRONE_BOARD_LAYOUT_CONFIG: DiceThroneBoardLayoutConfig = {
    slotLayouts: DICETHRONE_ABILITY_SLOT_LAYOUTS,
    uiTuning: DICETHRONE_PLAYER_BOARD_UI_TUNING,
};

export const getPlayerBoardLayoutVersion = (characterId?: string | null): DiceThronePlayerBoardLayoutVersion => (
    DICETHRONE_PLAYER_BOARD_LAYOUT_VERSION_BY_CHARACTER[characterId ?? ''] ?? 'v1'
);

export const getAbilitySlotLayoutByVersion = (version: DiceThronePlayerBoardLayoutVersion): AbilitySlotLayoutItem[] => (
    DICETHRONE_ABILITY_SLOT_LAYOUTS[version]
);

export const getAbilitySlotLayoutForCharacter = (characterId?: CharacterId | string | null): AbilitySlotLayoutItem[] => (
    getAbilitySlotLayoutByVersion(getPlayerBoardLayoutVersion(characterId))
);

export const getPlayerBoardDimensions = (characterId?: CharacterId | string | null): PlayerBoardDimensions => (
    DICETHRONE_PLAYER_BOARD_DIMENSIONS[characterId ?? ''] ?? DICETHRONE_PLAYER_BOARD_DIMENSIONS.monk
);

export const getPlayerBoardAspectRatio = (characterId?: CharacterId | string | null): number => {
    const { width, height } = getPlayerBoardDimensions(characterId);
    return width / height;
};

export const getPlayerBoardUiTuning = (characterId?: CharacterId | string | null): PlayerBoardUiTuning => (
    DICETHRONE_PLAYER_BOARD_UI_TUNING[getPlayerBoardLayoutVersion(characterId)]
);
`;
    }

    private formatSlotValue(value: number) {
        if (!Number.isFinite(value)) return '0';
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }

    private toRelativePath(filePath: string) {
        const root = process.cwd();
        if (filePath.startsWith(root)) {
            return filePath.slice(root.length + 1);
        }
        return filePath;
    }
}
