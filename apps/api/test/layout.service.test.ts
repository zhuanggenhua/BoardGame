import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { LayoutService } from '../src/modules/layout/layout.service';

const TEST_DIR = 'uploads-test-layout';
const ABILITY_LAYOUT_FILE = 'abilitySlotLayout.ts';

describe('LayoutService', () => {
    afterEach(() => {
        const fullPath = join(process.cwd(), TEST_DIR);
        if (existsSync(fullPath)) {
            rmSync(fullPath, { recursive: true, force: true });
        }
        delete process.env.LAYOUT_DATA_DIR;
        delete process.env.DICETHRONE_ABILITY_LAYOUT_PATH;
        delete process.env.UI_SCENE_ROOT_PATH;
    });

    it('应保存布局到指定目录', async () => {
        process.env.LAYOUT_DATA_DIR = TEST_DIR;
        const service = new LayoutService();
        const config = {
            version: '1.0.0',
            grid: {
                rows: 6,
                cols: 8,
                bounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
            },
            zones: [],
            tracks: [],
            stackPoints: [],
        };

        const result = await service.saveSummonerWarsLayout(config);
        const expectedPath = join(process.cwd(), TEST_DIR, 'summonerwars.layout.json');

        expect(result.filePath).toBe(expectedPath);
        expect(result.relativePath.endsWith('summonerwars.layout.json')).toBe(true);
        expect(existsSync(expectedPath)).toBe(true);

        const saved = JSON.parse(readFileSync(expectedPath, 'utf8')) as Record<string, unknown>;
        expect(saved.version).toBe('1.0.0');
        expect(saved.grid).toBeTruthy();
    });

    it('应保存 DiceThrone 技能槽布局到指定文件', async () => {
        process.env.DICETHRONE_ABILITY_LAYOUT_PATH = join(TEST_DIR, ABILITY_LAYOUT_FILE);
        const service = new LayoutService();
        const layout = {
            slotLayouts: {
                v1: [
                    { id: 'fist', x: 0.1, y: 1.2, w: 20.5, h: 30.4 },
                    { id: 'chi', x: 22.2, y: 1.4, w: 21.3, h: 39.4 },
                ],
                v2: [
                    { id: 'fist', x: 0.0, y: 13.6, w: 16.1, h: 38.8 },
                    { id: 'chi', x: 16.1, y: 13.6, w: 16.6, h: 38.8 },
                ],
            },
            uiTuning: {
                v1: {
                    shellTranslateX: 0,
                    playerBoardTranslateY: 0,
                    magnifyButtonTop: 0.48,
                    playerBoardBaseHeightUnits: 35,
                    tipBoardHeightUnits: 35,
                    centerBoardGapUnits: 0.5,
                },
                v2: {
                    shellTranslateX: 1.1,
                    playerBoardTranslateY: -1.45,
                    magnifyButtonTop: 1.85,
                    playerBoardBaseHeightUnits: 35,
                    tipBoardHeightUnits: 29.6,
                    centerBoardGapUnits: 0.24,
                },
            },
        };

        const result = await service.saveDiceThroneAbilityLayout(layout);
        const expectedPath = join(process.cwd(), TEST_DIR, ABILITY_LAYOUT_FILE);

        expect(result.filePath).toBe(expectedPath);
        expect(result.relativePath.endsWith(ABILITY_LAYOUT_FILE)).toBe(true);
        expect(existsSync(expectedPath)).toBe(true);

        const saved = readFileSync(expectedPath, 'utf8');
        expect(saved).toContain('DICETHRONE_ABILITY_SLOT_LAYOUTS');
        expect(saved).toContain('DICETHRONE_PLAYER_BOARD_UI_TUNING');
        expect(saved).toContain('DICETHRONE_BOARD_LAYOUT_CONFIG');
        expect(saved).toContain("id: 'fist'");
        expect(saved).toContain('x: 0.10');
        expect(saved).toContain('playerBoardBaseHeightUnits: 35');
        expect(saved).toContain('tipBoardHeightUnits: 29.60');
        expect(saved).toContain("gunslinger: 'v2'");
    });

    it('应保存 Home V2 UI scene YAML 和编译产物', async () => {
        process.env.UI_SCENE_ROOT_PATH = TEST_DIR;
        const service = new LayoutService();

        const result = await service.saveUiSceneAuthoring('home-v2', {
            sceneId: 'home-v2',
            assetRegistryYaml: 'assets: {}\n',
            skinYaml: 'skins: {}\n',
            sceneYaml: `scene:
  id: home_v2_content
  artboard:
    width: 896
    height: 720
    zones:
      left_page:
        x: 94
        y: 98
        width: 280
        height: 498
      tab_lobby:
        x: 806.4
        y: 108
        width: 53.76
        height: 72
  root:
    id: root
    type: stack
    direction: absolute
    children:
      - id: overview_left_page
        type: slot
        zoneRef: left_page
        slotId: overview_left_page
      - id: tab_button_lobby
        type: button
        zoneRef: tab_lobby
        actionId: openLobbyTab
`,
        });

        const expectedScenePath = join(process.cwd(), TEST_DIR, 'home-v2', 'home-v2.ui.yaml');
        const expectedCompiledPath = join(process.cwd(), TEST_DIR, 'home-v2', 'home-v2.compiled.json');

        expect(result.filePath).toBe(expectedScenePath);
        expect(result.compiledFilePath).toBe(expectedCompiledPath);
        expect(existsSync(expectedScenePath)).toBe(true);
        expect(existsSync(expectedCompiledPath)).toBe(true);

        const savedSceneYaml = readFileSync(expectedScenePath, 'utf8');
        const compiledJson = JSON.parse(readFileSync(expectedCompiledPath, 'utf8')) as {
            id: string;
            root: { children: Array<{ slotId?: string; actionId?: string; rect: { width: number } }> };
        };

        expect(savedSceneYaml).toContain('slotId: overview_left_page');
        expect(savedSceneYaml).toContain('actionId: openLobbyTab');
        expect(compiledJson.id).toBe('home_v2_content');
        expect(compiledJson.root.children[0]?.slotId).toBe('overview_left_page');
        expect(compiledJson.root.children[0]?.rect.width).toBe(280);
        expect(compiledJson.root.children[1]?.actionId).toBe('openLobbyTab');
    });
});
