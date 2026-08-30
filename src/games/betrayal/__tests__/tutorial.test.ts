import { describe, expect, it } from 'vitest';
import zhCNLocale from '../../../../public/locales/zh-CN/game-betrayal.json';
import enLocale from '../../../../public/locales/en/game-betrayal.json';
import {
    buildDiscoveryAtlasImageStyle,
    EVENT_FRONT_ATLAS,
    EVENT_FRONT_FRAME_BY_TITLE,
    resolveDiscoveryAtlasVisual,
} from '../discoveryAtlas';
import { resolvePossessionAtlasVisual } from '../possessionAtlas';
import { BETRAYAL_DISCOVERY_POOLS } from '../scenarioConfig';
import tutorialCatalog from '../tutorial';
import {
    createJackSpiritPostReviveAttackReadyTutorialCore,
    createMummyMonsterAttackRewardReadyTutorialCore,
    createMummyMonsterMoveReadyTutorialCore,
    createMummyReadyToBanishTutorialCore,
    createMummyTraitorVictoryReadyTutorialCore,
} from '../testing/firstScenarioTestUtils';

const collectPlayerText = (value: unknown): string[] => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(collectPlayerText);
    if (value && typeof value === 'object') {
        return Object.values(value).flatMap(collectPlayerText);
    }
    return [];
};

const LOCKED_EVENT_FRONT_FRAMES = {
    标本剥制: 0,
    不可能的房间: 1,
    磁带播放器: 2,
    大宅饿了: 3,
    地狱蝙蝠: 4,
    电话铃声: 5,
    吊死鬼: 6,
    断手: 7,
    嘎吱的木门: 8,
    怪异的镜子: 9,
    花团锦簇: 10,
    晦暗暴风夜: 11,
    技术难点: 12,
    佳馔满桌: 13,
    禁忌知识: 14,
    可怜的尤里克: 15,
    轮到约拿了: 16,
    秘密升降机: 17,
    脑状食品: 18,
    片刻希望: 19,
    肉质苔癣: 20,
    上古旧宅: 21,
    神秘液体: 22,
    '说“茄子”！': 23,
    外星几何: 24,
    无线电广播: 25,
    小丑房间: 26,
    小机器人: 27,
    摇曳灯光: 28,
    '咬一口！': 29,
    夜幕众星: 30,
    一罐器官: 31,
    一抹鲜红: 32,
    一瓶微尘: 33,
    一声呼救: 34,
    一条秘密通道: 35,
    一种怪异的感觉: 36,
    游魂: 37,
    '在你背后！': 38,
    葬礼: 39,
    着火的人: 40,
    '蜘蛛！': 41,
    最深的壁橱: 42,
} as const;

describe('Betrayal 教程配置', () => {
    it('导出合并后的 TutorialCollection，并只把主线和叛徒视角放进玩家目录', () => {
        expect(tutorialCatalog.defaultTutorialId).toBe('basic-setup-and-turn');
        expect(Object.keys(tutorialCatalog.tutorials)).toEqual([
            'basic-setup-and-turn',
            'omen-confirmation-and-haunt-risk',
            'trade-and-agreement',
            'move-explore-use',
            'crimson-jack-objective',
            'haunt-actions-and-finish',
            'hero-attack-path',
            'jack-spirit-path',
            'traitor-path',
            'mummy-monster-actions',
        ]);
        expect(Object.entries(tutorialCatalog.tutorials)
            .filter(([, entry]) => entry.hiddenFromCatalog !== true)
            .map(([id]) => id)).toEqual([
            'basic-setup-and-turn',
            'traitor-path',
        ]);
        expect(tutorialCatalog.tutorials['basic-setup-and-turn']?.titleKey).toBe('tutorial.mainPath.title');
        for (const hiddenTutorialId of [
            'omen-confirmation-and-haunt-risk',
            'trade-and-agreement',
            'move-explore-use',
            'crimson-jack-objective',
            'haunt-actions-and-finish',
            'hero-attack-path',
            'jack-spirit-path',
            'mummy-monster-actions',
        ]) {
            expect(tutorialCatalog.tutorials[hiddenTutorialId]?.hiddenFromCatalog).toBe(true);
        }
        expect(tutorialCatalog.tutorials['traitor-path']?.hiddenFromCatalog).not.toBe(true);
    });

    it('默认教程会合并普通玩家主线，只有叛徒视角另列目录章节', () => {
        const manifest = tutorialCatalog.tutorials['basic-setup-and-turn']?.manifest;
        expect(manifest?.steps.map((step) => step.id)).toEqual([
            'setup-runtime',
            'objective-and-turn',
            'traits-and-speed',
            'trait-track-reading',
            'moves-remaining',
            'room-board',
            'observe-teammate',
            'focus-self-room',
            'haunt-risk-track',
            'inventory-and-help',
            'open-move-targets',
            'move-to-hallway',
            'explore-upper',
            'confirm-room-placement',
            'use-book',
            'finish',
            'setup-omen-confirmation',
            'confirm-omen-card',
            'omen-confirmation-review',
            'omen-haunt-risk-track',
            'setup-trade',
            'choose-trade-item',
            'choose-trade-target',
            'choose-trade-return',
            'send-trade-request',
            'request-waiting',
            'accept-trade-request',
            'trade-review',
            'setup-ready-to-banish',
            'help-entry',
            'haunt-actions',
            'banish-mummy',
            'endgame-review',
        ]);
        expect(new Set(manifest?.steps.map((step) => step.id)).size).toBe(manifest?.steps.length);

        const setupStep = manifest?.steps.find((step) => step.id === 'setup-runtime');
        expect(setupStep?.aiActions).toHaveLength(1);
        expect(setupStep?.aiActions?.[0]?.commandType).toBe('SYS_CHEAT_MERGE_STATE');
        expect(manifest?.steps.find((step) => step.id === 'objective-and-turn')?.highlightTarget).toBe('betrayal-action-move');
        expect(manifest?.steps.find((step) => step.id === 'traits-and-speed')?.highlightTarget).toBe('betrayal-current-traits');
        expect(manifest?.steps.find((step) => step.id === 'trait-track-reading')?.highlightTarget).toBe('betrayal-current-traits');
        expect(manifest?.steps.find((step) => step.id === 'moves-remaining')?.highlightTarget).toBe('betrayal-moves-remaining');
        expect(manifest?.steps.find((step) => step.id === 'observe-teammate')?.highlightTarget).toBe('betrayal-bottom-teammate-1');
        expect(manifest?.steps.find((step) => step.id === 'focus-self-room')?.highlightTarget).toBe('betrayal-focus-self-room');
        expect(manifest?.steps.find((step) => step.id === 'haunt-risk-track')?.highlightTarget).toBe('betrayal-haunt-risk-status');
        expect(manifest?.steps.find((step) => step.id === 'confirm-room-placement')?.highlightTarget).toBe('betrayal-room-placement-confirm');
        expect(manifest?.steps.find((step) => step.id === 'confirm-omen-card')?.allowedCommands).toEqual([
            'ACKNOWLEDGE_CARD_RESOLUTION',
        ]);
        expect(manifest?.steps.find((step) => step.id === 'send-trade-request')?.allowedCommands).toEqual([
            'TRADE_POSSESSION',
        ]);
        expect(manifest?.steps.find((step) => step.id === 'banish-mummy')?.allowedCommands).toEqual([
            'BANISH_MUMMY',
        ]);
    });

    it('玩家可见教程注入态不使用测试专用假对象', () => {
        const injectedPayloads = Object.values(tutorialCatalog.tutorials)
            .flatMap(({ manifest }) => manifest.steps)
            .flatMap((step) => step.aiActions ?? [])
            .map((action) => JSON.stringify(action.payload ?? {}))
            .join('\n');

        expect(injectedPayloads).not.toContain('测试中性事件');
        expect(injectedPayloads).not.toMatch(/测试牌|测试事件|中性占位结果/);
    });

    it('基础回合兼容入口只保留真实的使用、移动、探索命令链', () => {
        const defaultManifest = tutorialCatalog.tutorials['basic-setup-and-turn']?.manifest;
        const manifest = tutorialCatalog.tutorials['move-explore-use']?.manifest;
        const setupStep = manifest?.steps.find((step) => step.id === 'setup-runtime');
        const setupFields = setupStep?.aiActions?.[0]?.payload?.fields as { eventOrder?: Array<{ name?: string }> } | undefined;
        const setupInventory = setupFields && 'currentExplorer' in setupFields
            ? (setupFields as { currentExplorer?: { inventory?: Array<{ id?: string; name?: string }> } }).currentExplorer?.inventory
            : undefined;
        const actionSteps = manifest?.steps.filter((step) => step.requireAction) ?? [];
        expect(actionSteps.map((step) => step.id)).toEqual([
            'move-to-hallway',
            'explore-upper',
            'confirm-room-placement',
            'use-book',
        ]);
        expect(defaultManifest?.steps.slice(0, manifest?.steps.length).map((step) => step.id))
            .toEqual(manifest?.steps.map((step) => step.id));
        expect(tutorialCatalog.tutorials['move-explore-use']?.hiddenFromCatalog).toBe(true);
        expect(manifest?.steps.map((step) => step.id)).toContain('open-move-targets');
        expect(manifest?.steps.find((step) => step.id === 'open-move-targets')?.highlightTarget).toBe('betrayal-action-move');
        expect(actionSteps.map((step) => step.allowedCommands)).toEqual([
            ['MOVE_TO_ROOM'],
            [],
            ['EXPLORE_ROOM'],
            ['USE_POSSESSION'],
        ]);
        expect(actionSteps.map((step) => step.allowedTargets ?? null)).toEqual([
            ['hallway'],
            null,
            null,
            ['omen-book'],
        ]);
        expect(actionSteps.at(-1)?.highlightTarget).toBe('betrayal-inventory-omen-book');
        expect(setupInventory?.map((card) => card.id)).toEqual(['rope', 'omen-book']);
        expect(setupFields?.eventOrder?.map((event) => event.name)).toEqual(['标本剥制']);
        expect(JSON.stringify(setupFields)).not.toContain('测试中性事件');
    });

    it('交易教程会实际走同房间请求、接收方同意和结算链', () => {
        const manifest = tutorialCatalog.tutorials['trade-and-agreement']?.manifest;
        expect(manifest?.steps.map((step) => step.id)).toEqual([
            'setup-trade',
            'choose-trade-item',
            'choose-trade-target',
            'choose-trade-return',
            'send-trade-request',
            'request-waiting',
            'accept-trade-request',
            'trade-review',
        ]);

        const setupStep = manifest?.steps.find((step) => step.id === 'setup-trade');
        const setupFields = setupStep?.aiActions?.[0]?.payload?.fields as { eventOrder?: Array<{ name?: string }> } | undefined;
        expect(setupStep?.aiActions?.[0]?.commandType).toBe('SYS_CHEAT_MERGE_STATE');
        expect(setupStep?.autoAdvanceAfterAi).toBe(false);
        expect(JSON.stringify(setupFields)).not.toContain('测试中性事件');
        expect(JSON.stringify(setupFields)).toContain('地图');
        expect(manifest?.steps.find((step) => step.id === 'choose-trade-item')?.highlightTarget).toBe('betrayal-inventory-rope');
        expect(manifest?.steps.find((step) => step.id === 'choose-trade-target')?.highlightTarget).toBe('betrayal-room-occupant-hallway-1');
        expect(manifest?.steps.find((step) => step.id === 'choose-trade-return')?.highlightTarget).toBe('betrayal-trade-return-selector');
        expect(manifest?.steps.find((step) => step.id === 'request-waiting')?.highlightTarget).toBe('betrayal-trade-flow-banner');

        const actionSteps = manifest?.steps.filter((step) => step.requireAction) ?? [];
        expect(actionSteps.map((step) => step.id)).toEqual([
            'send-trade-request',
            'accept-trade-request',
        ]);
        expect(actionSteps.map((step) => step.allowedCommands)).toEqual([
            ['TRADE_POSSESSION'],
            ['RESOLVE_TRADE_AGREEMENT'],
        ]);
        expect(actionSteps[0]?.advanceOnEvents).toEqual([
            { type: 'POSSESSION_TRADE_REQUESTED', match: { playerId: '0', targetPlayerId: '1' } },
        ]);
        expect(actionSteps[1]?.advanceOnEvents).toEqual([
            { type: 'POSSESSION_TRADED', match: { playerId: '0', targetPlayerId: '1' } },
        ]);
        expect(actionSteps[1]?.viewAs).toBe('1');
        expect(manifest?.steps.find((step) => step.id === 'trade-review')?.highlightTarget).toBe('betrayal-room-latest-feedback');
    });

    it('预兆教程使用规则原文解释作祟检定，并保留一次确认动作', () => {
        const manifest = tutorialCatalog.tutorials['omen-confirmation-and-haunt-risk']?.manifest;
        expect(manifest?.steps.map((step) => step.id)).toEqual([
            'setup-omen-confirmation',
            'confirm-omen-card',
            'omen-confirmation-review',
            'haunt-risk-track',
        ]);

        const setupStep = manifest?.steps.find((step) => step.id === 'setup-omen-confirmation');
        expect(setupStep?.aiActions).toHaveLength(1);
        expect(setupStep?.aiActions?.[0]?.commandType).toBe('SYS_CHEAT_MERGE_STATE');

        expect(manifest?.steps.find((step) => step.id === 'haunt-risk-track')?.highlightTarget).toBe('betrayal-haunt-risk-status');
        expect(manifest?.steps.find((step) => step.id === 'confirm-omen-card')?.highlightTarget).toBe('betrayal-latest-discovery');
        expect(manifest?.steps.find((step) => step.id === 'omen-confirmation-review')?.highlightTarget).toBe('betrayal-inventory-zone');

        const actionSteps = manifest?.steps.filter((step) => step.requireAction) ?? [];
        expect(actionSteps.map((step) => step.id)).toEqual([
            'confirm-omen-card',
        ]);
        expect(actionSteps.map((step) => step.allowedCommands)).toEqual([
            ['ACKNOWLEDGE_CARD_RESOLUTION'],
        ]);
        expect(actionSteps[0]?.aiActions).toEqual([
            { commandType: 'ACKNOWLEDGE_CARD_RESOLUTION', playerId: '1' },
            { commandType: 'ACKNOWLEDGE_CARD_RESOLUTION', playerId: '2' },
        ]);
        expect(actionSteps[0]?.autoAdvanceAfterAi).toBe(false);
        expect(actionSteps[0]?.advanceOnEvents).toEqual([
            { type: 'CARD_RESOLUTION_ACKNOWLEDGED', match: { playerId: '0', remainingCount: 0 } },
        ]);
    });

    it('教程发现事件使用正式 9x5 事件牌图集，不再按错误大格裁切', () => {
        expect(EVENT_FRONT_ATLAS).toMatchObject({
            imageW: 6076,
            imageH: 6376,
            cols: 9,
            rows: 5,
            colStarts: [0, 675, 1350, 2025, 2700, 3375, 4050, 4725, 5400],
            colWidths: [675, 675, 675, 675, 675, 675, 675, 675, 676],
            rowStarts: [0, 1275, 2550, 3825, 5100],
            rowHeights: [1275, 1275, 1275, 1275, 1276],
        });
        expect(EVENT_FRONT_FRAME_BY_TITLE).toEqual(LOCKED_EVENT_FRONT_FRAMES);
        expect(Object.keys(EVENT_FRONT_FRAME_BY_TITLE).sort()).toEqual(
            BETRAYAL_DISCOVERY_POOLS.events.map((event) => event.name).sort(),
        );
        expect(Object.values(EVENT_FRONT_FRAME_BY_TITLE).every((frameIndex) => (
            Number.isInteger(frameIndex)
            && frameIndex >= 0
            && frameIndex < 43
        ))).toBe(true);
        expect(EVENT_FRONT_FRAME_BY_TITLE.标本剥制).toBe(0);

        const visual = resolveDiscoveryAtlasVisual({
            kind: 'event',
            title: '标本剥制',
            summary: '进行一次力量检定。',
            detail: '5+ 获得 1 点神志。',
        }, []);

        expect(visual).toMatchObject({
            image: 'betrayal/cards/event-front-atlas',
            frameIndex: 0,
        });
        const style = buildDiscoveryAtlasImageStyle(visual!);
        expect(Number.parseFloat(String(style.width))).toBeCloseTo(900.148, 3);
        expect(Number.parseFloat(String(style.height))).toBeCloseTo(500.078, 3);
        expect(String(style.transform)).toContain('translate(-0%, -0%)');
    });

    it('发现牌展示能识别带运行时来源后缀的物品牌 ID', () => {
        expect(resolvePossessionAtlasVisual({
            id: 'medical-kit-armory-0-1',
            name: '急救包',
            kind: 'item',
        })).toMatchObject({
            image: 'betrayal/cards/item-front-atlas',
            frameIndex: 4,
        });
    });

    it('haunt 章节会合并第一剧本目标与真实收尾入口', () => {
        const objectiveManifest = tutorialCatalog.tutorials['crimson-jack-objective']?.manifest;
        const hauntActionsManifest = tutorialCatalog.tutorials['haunt-actions-and-finish']?.manifest;
        const heroAttackManifest = tutorialCatalog.tutorials['hero-attack-path']?.manifest;
        const jackSpiritManifest = tutorialCatalog.tutorials['jack-spirit-path']?.manifest;
        const traitorManifest = tutorialCatalog.tutorials['traitor-path']?.manifest;
        const mummyMonsterManifest = tutorialCatalog.tutorials['mummy-monster-actions']?.manifest;
        expect(objectiveManifest).toBe(hauntActionsManifest);
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'help-entry')?.highlightTarget).toBe('betrayal-open-scenario');
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'haunt-actions')?.highlightTarget).toBe('betrayal-action-use');
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'banish-mummy')?.allowedCommands)
            .toEqual(['BANISH_MUMMY']);
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'banish-mummy')?.randomPolicy).toEqual({
            mode: 'sequence',
            values: [3, 3, 3, 3, 3, 1, 1, 1, 1, 1],
            cursor: 0,
        });
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'banish-mummy')?.advanceOnEvents).toEqual([
            { type: 'MUMMY_BANISHED', match: { playerId: '0', success: true } },
        ]);
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'endgame-review')?.highlightTarget).toBe('betrayal-endgame-screen');
        expect(heroAttackManifest?.steps.map((step) => step.id)).toEqual([
            'setup-hero-attack',
            'hero-attack-objective',
            'attack-traitor',
            'hero-attack-review',
        ]);
        const heroAttackObjective = heroAttackManifest?.steps.find((step) => step.id === 'hero-attack-objective');
        expect(heroAttackObjective?.highlightTarget).toBe('betrayal-open-scenario');
        expect(heroAttackObjective?.requireAction).toBe(true);
        expect(heroAttackObjective?.allowedCommands).toEqual([]);
        expect(heroAttackObjective?.infoStep).not.toBe(true);
        expect(heroAttackManifest?.steps.find((step) => step.id === 'attack-traitor')?.allowedCommands).toEqual(['HAUNT_ATTACK']);
        expect(heroAttackManifest?.steps.find((step) => step.id === 'attack-traitor')?.advanceOnEvents).toEqual([
            { type: 'HAUNT_ATTACK_RESOLVED', match: { attackerPlayerId: '0', target: 'traitor' } },
        ]);
        expect(heroAttackManifest?.steps.find((step) => step.id === 'hero-attack-review')?.highlightTarget).toBe('betrayal-attack-roll-review');
        expect(jackSpiritManifest?.steps.map((step) => step.id)).toEqual([
            'setup-jack-spirit',
            'jack-spirit-objective',
            'jack-spirit-attack',
            'jack-spirit-review',
        ]);
        const jackSpiritObjective = jackSpiritManifest?.steps.find((step) => step.id === 'jack-spirit-objective');
        expect(jackSpiritObjective?.highlightTarget).toBe('betrayal-open-scenario');
        expect(jackSpiritObjective?.requireAction).toBe(true);
        expect(jackSpiritObjective?.allowedCommands).toEqual([]);
        expect(jackSpiritObjective?.infoStep).not.toBe(true);
        expect(jackSpiritManifest?.steps.find((step) => step.id === 'jack-spirit-attack')?.allowedCommands).toEqual(['HAUNT_ATTACK']);
        expect(jackSpiritManifest?.steps.find((step) => step.id === 'jack-spirit-attack')?.advanceOnEvents).toEqual([
            { type: 'HAUNT_ATTACK_RESOLVED', match: { attackerPlayerId: '2', target: 'hero' } },
        ]);
        expect(jackSpiritManifest?.steps.find((step) => step.id === 'jack-spirit-review')?.highlightTarget).toBe('betrayal-attack-roll-review');
        expect(traitorManifest?.steps.map((step) => step.id)).toEqual([
            'setup-mummy-monster-move',
            'traitor-objective',
            'mummy-monster-turn-start',
            'mummy-monster-roll',
            'mummy-monster-roll-review',
            'mummy-monster-move-target',
            'mummy-monster-move-result',
            'setup-mummy-attack',
            'mummy-attack-forced',
            'mummy-attack-target',
            'mummy-attack-roll-review',
            'mummy-attack-reward',
            'mummy-steal-result',
            'setup-traitor-turn',
            'pick-up-girl',
            'give-girl-to-mummy',
            'give-omen-to-mummy',
            'traitor-finish',
        ]);
        expect(traitorManifest?.steps.find((step) => step.id === 'setup-traitor-turn')?.viewAs).toBe('2');
        const traitorObjective = traitorManifest?.steps.find((step) => step.id === 'traitor-objective');
        expect(traitorObjective?.highlightTarget).toBe('betrayal-open-scenario');
        expect(traitorObjective?.requireAction).toBe(true);
        expect(traitorObjective?.allowedCommands).toEqual([]);
        expect(traitorObjective?.infoStep).not.toBe(true);
        expect(traitorManifest?.steps.find((step) => step.id === 'pick-up-girl')?.allowedCommands).toEqual(['PICK_UP_MUMMY_GIRL']);
        expect(traitorManifest?.steps.find((step) => step.id === 'pick-up-girl')?.advanceOnEvents).toEqual([
            { type: 'MUMMY_GIRL_PICKED_UP', match: { playerId: '2' } },
        ]);
        expect(traitorManifest?.steps.find((step) => step.id === 'give-girl-to-mummy')?.allowedCommands).toEqual(['GIVE_GIRL_TO_MUMMY']);
        expect(traitorManifest?.steps.find((step) => step.id === 'give-girl-to-mummy')?.advanceOnEvents).toEqual([
            { type: 'MUMMY_GIRL_GIVEN', match: { playerId: '2' } },
        ]);
        expect(traitorManifest?.steps.find((step) => step.id === 'give-omen-to-mummy')?.allowedCommands).toEqual(['GIVE_OMEN_TO_MUMMY']);
        expect(traitorManifest?.steps.find((step) => step.id === 'give-omen-to-mummy')?.advanceOnEvents).toEqual([
            { type: 'MUMMY_OMEN_GIVEN', match: { playerId: '2', cardId: 'holy-symbol' } },
        ]);
        expect(mummyMonsterManifest?.steps.map((step) => step.id)).toEqual([
            'setup-mummy-monster-move',
            'mummy-monster-turn-start',
            'mummy-monster-roll',
            'mummy-monster-roll-review',
            'mummy-monster-move-target',
            'mummy-monster-move-result',
            'setup-mummy-attack',
            'mummy-attack-forced',
            'mummy-attack-target',
            'mummy-attack-roll-review',
            'mummy-attack-reward',
            'mummy-steal-result',
        ]);
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-monster-turn-start')?.allowedCommands)
            .toEqual(['RESOLVE_MONSTER_TURN_START']);
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-monster-roll')?.allowedCommands)
            .toEqual(['ROLL_MONSTER_MOVEMENT_GROUP']);
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-monster-roll')?.randomPolicy).toEqual({
            mode: 'sequence',
            values: [1, 1, 1],
            cursor: 0,
        });
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-monster-roll-review')?.allowedCommands)
            .toEqual(['ACKNOWLEDGE_RECENT_ROLL']);
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-monster-roll-review')?.advanceOnEvents).toEqual([
            { type: 'RECENT_ROLL_ACKNOWLEDGED', match: { isFullyAcknowledged: true } },
        ]);
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-monster-roll-review')?.highlightFrame)
            .toBe('none');
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-monster-move-target')?.allowedCommands)
            .toEqual(['MOVE_MONSTER_TO_ROOM']);
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-attack-target')?.allowedCommands)
            .toEqual(['MONSTER_ATTACK_HERO']);
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-attack-target')?.randomPolicy).toEqual({
            mode: 'sequence',
            values: [3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1],
            cursor: 0,
        });
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-attack-roll-review')?.highlightFrame)
            .toBe('none');
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-attack-roll-review')?.advanceOnEvents).toEqual([
            { type: 'RECENT_ROLL_ACKNOWLEDGED', match: { isFullyAcknowledged: true } },
        ]);
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-attack-reward')?.allowedCommands)
            .toEqual(['RESOLVE_MUMMY_ATTACK_REWARD']);
        expect(mummyMonsterManifest?.steps.find((step) => step.id === 'mummy-attack-reward')?.advanceOnEvents).toEqual([
            {
                type: 'MUMMY_ATTACK_REWARD_RESOLVED',
                match: { monsterId: 'mummy', choice: 'steal', stolenCardId: 'map' },
            },
        ]);
    });

    it('木乃伊叛徒教程必须停在女孩、木乃伊、石棺和圣符同房的真实胜利前状态', () => {
        const core = createMummyTraitorVictoryReadyTutorialCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId;
        const mummy = core.scenarioRuntime.mummy;
        const mummyMonster = core.monsters.find((monster) => monster.id === mummy?.mummyMonsterId);
        const completedMonsterIds = core.monsters.map((monster) => monster.id);

        expect(core.scenarioRuntime.hauntScenarioCardId).toBe('mummy-rampage');
        expect(core.scenarioRuntime.hauntScenarioCardTitle).toBe('木乃伊横行');
        expect(core.currentPlayer).toBe(traitorId);
        expect(core.currentExplorer.playerId).toBe(traitorId);
        expect(core.currentExplorer.inventory.map((card) => card.id)).toContain('holy-symbol');
        expect(mummy?.sarcophagusRoomId).toBe(core.currentExplorer.roomId);
        expect(mummy?.girlRoomId).toBe(core.currentExplorer.roomId);
        expect(mummy?.girlHeldByMummy).toBe(false);
        expect(mummy?.mummyCarriedOmenIds).toEqual([]);
        expect(mummyMonster?.roomId).toBe(core.currentExplorer.roomId);
        expect(core.scenarioRuntime.monsterTurn.resolvedStartMonsterIds).toEqual(completedMonsterIds);
        expect(core.scenarioRuntime.monsterTurn.skippedMonsterIdsThisTurn).toEqual(completedMonsterIds);
        expect(core.scenarioRuntime.monsterTurn.attackedMonsterIdsThisTurn).toEqual(completedMonsterIds);
        expect(core.scenarioRuntime.monsterTurn.movedMonsterIdsThisTurn).toEqual(completedMonsterIds);
        expect(core.scenarioRuntime.monsterTurn.movementRollsByGroupId).toEqual({});
        expect(core.scenarioRuntime.monsterTurn.moveRemainingById).toEqual(
            Object.fromEntries(completedMonsterIds.map((monsterId) => [monsterId, 0])),
        );
        expect(core.recentRoll).toBeNull();
    });

    it('木乃伊怪物移动教程必须停在叛徒操控木乃伊、女孩远处且无阻塞弹层的状态', () => {
        const core = createMummyMonsterMoveReadyTutorialCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId;
        const mummy = core.scenarioRuntime.mummy;
        const mummyMonster = core.monsters.find((monster) => monster.id === mummy?.mummyMonsterId);

        expect(core.scenarioRuntime.hauntScenarioCardId).toBe('mummy-rampage');
        expect(core.currentPlayer).toBe(traitorId);
        expect(core.currentExplorer.playerId).toBe(traitorId);
        expect(mummyMonster?.roomId).toBe(mummy?.sarcophagusRoomId);
        expect(mummy?.girlRoomId).toBeTruthy();
        expect(mummy?.girlRoomId).not.toBe(mummy?.sarcophagusRoomId);
        expect(mummy?.girlHolderPlayerId).toBeNull();
        expect(mummy?.girlHeldByMummy).toBe(false);
        expect(core.latestDiscovery).toBeNull();
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.pendingEventChoice).toBeNull();
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.recentRoll).toBeNull();
    });

    it('木乃伊攻击奖励教程必须停在同房先攻击且英雄有地图和圣符的状态', () => {
        const core = createMummyMonsterAttackRewardReadyTutorialCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId;
        const mummy = core.scenarioRuntime.mummy;
        const mummyMonster = core.monsters.find((monster) => monster.id === mummy?.mummyMonsterId);
        const livingHero = [core.currentExplorer, ...core.otherExplorers]
            .find((explorer) => (
                explorer.playerId !== traitorId
                && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            ));

        expect(core.scenarioRuntime.hauntScenarioCardId).toBe('mummy-rampage');
        expect(core.currentPlayer).toBe(traitorId);
        expect(core.currentExplorer.playerId).toBe(traitorId);
        expect(mummyMonster?.roomId).toBe(mummy?.sarcophagusRoomId);
        expect(livingHero?.roomId).toBe(mummyMonster?.roomId);
        expect(livingHero?.inventory.map((card) => card.id)).toEqual(['map', 'holy-symbol']);
        expect(core.scenarioRuntime.monsterTurn.movementRollsByGroupId['木乃伊:3']).toMatchObject({
            dice: [0, 0, 0],
            total: 0,
            moveAllowance: 0,
        });
        expect(core.scenarioRuntime.monsterTurn.moveRemainingById[mummy?.mummyMonsterId ?? '']).toBe(0);
        expect(core.latestDiscovery).toBeNull();
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.recentRoll).toBeNull();
    });

    it('杰克之灵攻击教程必须停在灵体已释放且英雄同房的真实攻击态', () => {
        const core = createJackSpiritPostReviveAttackReadyTutorialCore();
        const hero = [core.currentExplorer, ...core.otherExplorers]
            .find((explorer) => explorer.playerId === '0');

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBeTruthy();
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId)
            .toBe(core.scenarioRuntime.jackSpiritRoomId);
        expect(core.recentRoll).toBeNull();
        expect(hero?.roomId).toBe(core.scenarioRuntime.jackSpiritRoomId);
    });

    it('木乃伊作祟收尾教程必须停在已找真名、已学法术、可驱逐的真实状态', () => {
        const core = createMummyReadyToBanishTutorialCore();

        expect(core.scenarioRuntime.hauntScenarioCardId).toBe('mummy-rampage');
        expect(core.scenarioRuntime.hauntScenarioCardTitle).toBe('木乃伊横行');
        expect(core.scenarioRuntime.mummy?.knowledgeTokenCount).toBe(2);
        expect(core.recentRoll).toBeNull();
        expect(core.currentPlayer).toBe('0');
        expect(core.currentExplorer.roomId).toBe(core.scenarioRuntime.mummy?.sarcophagusRoomId);
        expect(core.monsters.find((monster) => monster.id === core.scenarioRuntime.mummy?.mummyMonsterId)?.roomId)
            .toBe(core.currentExplorer.roomId);
    });

    it('中文教程文案会聚焦玩家能理解的规则动作与结果', () => {
        const officialOmenRuleZh = '抽到预兆卡时，大声朗读，把它放在自己面前并获得。然后进行作祟检定：按所有玩家持有的预兆总数掷骰；若作祟检定结果为 5+，作祟开始。';
        const officialOmenRuleEn = 'When you draw an Omen card, read its text aloud, place it face-up in front of you, and make a haunt roll. Roll dice equal to the total number of Omens held by all players; on a result of 5+, the haunt begins.';
        expect(zhCNLocale.tutorial.mainPath.title).toContain('主线教程');
        expect(zhCNLocale.tutorial.mainPath.description).toContain('预兆确认');
        expect(zhCNLocale.tutorial.mainPath.description).toContain('驱逐木乃伊');
        expect(enLocale.tutorial.mainPath.title).toContain('Main Tutorial');
        expect(enLocale.tutorial.mainPath.description).toContain('omen confirmation');
        expect(enLocale.tutorial.mainPath.description).toContain('banishing the Mummy');
        expect(zhCNLocale.tutorial.basicSetup.description).toContain('按任意顺序');
        expect(zhCNLocale.tutorial.basicSetup.description).toContain('探索新房间会结束你的回合');
        expect(enLocale.tutorial.basicSetup.description).toContain('in any order');
        expect(enLocale.tutorial.basicSetup.description).toContain('Discovering a new room ends your turn');
        expect(zhCNLocale.tutorial.omenConfirmation.description).toBe(officialOmenRuleZh);
        expect(zhCNLocale.tutorial.omenConfirmation.steps.setupOmenConfirmation).toBe(officialOmenRuleZh);
        expect(enLocale.tutorial.omenConfirmation.description).toBe(officialOmenRuleEn);
        expect(enLocale.tutorial.omenConfirmation.steps.setupOmenConfirmation).toBe(officialOmenRuleEn);
        expect(zhCNLocale.tutorial.basicSetup.steps.setupRuntime).toContain('基础回合');
        expect(zhCNLocale.tutorial.basicSetup.steps.objectiveAndTurn).toContain('在你的回合中');
        expect(zhCNLocale.tutorial.basicSetup.steps.traitsAndSpeed).toContain('速度');
        expect(zhCNLocale.tutorial.basicSetup.steps.traitTrackReading).toContain('绿色数字');
        expect(zhCNLocale.tutorial.basicSetup.steps.traitTrackReading).toContain('骷髅');
        expect(zhCNLocale.tutorial.basicSetup.steps.traitTrackReading).toContain('重复的数字仍分别占格');
        expect(zhCNLocale.tutorial.basicSetup.steps.movesRemaining).toContain('本回合还剩的移动力');
        expect(zhCNLocale.tutorial.basicSetup.steps.observeTeammate).toContain('观察该探险者');
        expect(zhCNLocale.tutorial.basicSetup.steps.observeTeammate).toContain('进入观察前的位置');
        expect(zhCNLocale.tutorial.basicSetup.steps.focusSelfRoom).toContain('聚焦到我的房间');
        expect(zhCNLocale.tutorial.basicSetup.steps.focusSelfRoom).toContain('回到自己所在房间');
        expect(zhCNLocale.tutorial.basicSetup.steps.hauntRiskTrack).toContain('预兆进度条');
        expect(zhCNLocale.tutorial.basicSetup.steps.hauntRiskTrack).toContain('所有玩家持有的预兆总数');
        expect(zhCNLocale.tutorial.basicSetup.steps.hauntRiskTrack).toContain('5+');
        expect(zhCNLocale.tutorial.basicSetup.steps.useBook).toContain('看到事件牌和事件骰后');
        expect(zhCNLocale.tutorial.basicSetup.steps.useBook).toContain('立即失去 1 点神志');
        expect(zhCNLocale.tutorial.basicSetup.steps.useBook).toContain('书本的使用不需要再次确认');
        expect(zhCNLocale.tutorial.basicSetup.steps.useBook).toContain('事件结果仍要等所有玩家确认看清');
        expect(zhCNLocale.tutorial.basicSetup.steps.exploreUpper).toContain('可探索的盖着房间');
        expect(zhCNLocale.tutorial.basicSetup.steps.exploreUpper).toContain('未探索走廊');
        expect(zhCNLocale.tutorial.basicSetup.steps.confirmRoomPlacement).toContain('确认放置');
        expect(zhCNLocale.tutorial.basicSetup.steps.finish).toContain('原本是力量检定');
        expect(zhCNLocale.tutorial.basicSetup.steps.finish).toContain('改用知识重新投骰');
        expect(zhCNLocale.tutorial.basicSetup.steps.finish).toContain('兔脚');
        expect(zhCNLocale.tutorial.basicSetup.steps.finish).toContain('让其他玩家看清结果');
        expect(zhCNLocale.tutorial.omenConfirmation.title).toContain('预兆');
        expect(zhCNLocale.tutorial.omenConfirmation.description).toContain('所有玩家持有的预兆总数');
        expect(zhCNLocale.tutorial.omenConfirmation.description).toContain('5+');
        expect(zhCNLocale.tutorial.omenConfirmation.steps.confirmOmenCard).toContain('点“确认”');
        expect(zhCNLocale.tutorial.omenConfirmation.steps.confirmOmenCard).toContain('所有玩家持有的预兆总数');
        expect(zhCNLocale.tutorial.omenConfirmation.steps.confirmOmenCard).toContain('5+');
        expect(zhCNLocale.tutorial.omenConfirmation.steps.confirmOmenCard).toContain('完成这次检定');
        expect(zhCNLocale.tutorial.omenConfirmation.steps.confirmOmenCard).not.toContain('预兆牌和作祟检定结果');
        expect(zhCNLocale.tutorial.omenConfirmation.steps.review).toContain('结果低于 5+');
        expect(zhCNLocale.tutorial.omenConfirmation.steps.review).toContain('你获得这张预兆');
        expect(zhCNLocale.tutorial.tradeAndAgreement.title).toContain('交易');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.setupTrade).toContain('同一房间');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.setupTrade).not.toContain('同一板块');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.setupTrade).toContain('双方都要同意');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.chooseTradeItem).toContain('兔脚');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.chooseTradeTarget).toContain('同房间队友');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.sendTradeRequest).toContain('提出交易');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.requestWaiting).toContain('接收方作出选择前');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.acceptTradeRequest).toContain('同意交易');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.acceptTradeRequest).toContain('拒绝');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.tradeReview).toContain('进入队友持有区');
        expect(zhCNLocale.tutorial.hauntActions.title).toContain('英雄目标与驱逐');
        expect(zhCNLocale.tutorial.hauntActions.steps.setupReadyToExorcise).toContain('英雄胜利条件');
        expect(zhCNLocale.tutorial.hauntActions.steps.setupReadyToExorcise).toContain('让木乃伊与女孩成婚');
        expect(zhCNLocale.tutorial.hauntActions.steps.helpEntry).toContain('打开剧本书');
        expect(zhCNLocale.tutorial.hauntActions.steps.helpEntry).toContain('目标与胜利条件');
        expect(zhCNLocale.tutorial.hauntActions.steps.hauntActions).toContain('6+ 知识考验');
        expect(zhCNLocale.tutorial.hauntActions.steps.hauntActions).toContain('石棺房、研究室或图书馆');
        expect(zhCNLocale.tutorial.hauntActions.steps.hauntActions).toContain('找到真名');
        expect(zhCNLocale.tutorial.hauntActions.steps.hauntActions).toContain('驱逐法术');
        expect(zhCNLocale.tutorial.hauntActions.steps.hauntActions).toContain('每名英雄每回合只能尝试一个步骤');
        expect(zhCNLocale.tutorial.hauntActions.steps.banishMummy).toContain('用神志攻击木乃伊');
        expect(zhCNLocale.tutorial.hauntActions.steps.endgameReview).toContain('英雄胜利');
        expect(zhCNLocale.tutorial.hauntActions.steps.endgameReview).toContain('细砂');
        expect(zhCNLocale.tutorial.heroAttackPath.steps.heroAttackObjective).toContain('打开英雄剧本');
        expect(zhCNLocale.tutorial.heroAttackPath.steps.attackTraitor).toContain('攻击叛徒');
        expect(zhCNLocale.tutorial.heroAttackPath.steps.heroAttackReview).toContain('按差值结算伤害');
        expect(zhCNLocale.tutorial.jackSpiritPath.title).toContain('杰克之灵');
        expect(zhCNLocale.tutorial.jackSpiritPath.steps.setupJackSpirit).toContain('作为怪物继续行动');
        expect(zhCNLocale.tutorial.jackSpiritPath.steps.jackSpiritObjective).toContain('叛徒尸体所在房间');
        expect(zhCNLocale.tutorial.jackSpiritPath.steps.jackSpiritAttack).toContain('同房间的英雄');
        expect(zhCNLocale.tutorial.jackSpiritPath.steps.jackSpiritReview).toContain('按差值结算伤害');
        expect(zhCNLocale.tutorial.traitorPath.title).toContain('叛徒视角');
        expect(zhCNLocale.tutorial.traitorPath.description).toContain('木乃伊移动');
        expect(zhCNLocale.tutorial.traitorPath.description).toContain('胜利链');
        expect(zhCNLocale.tutorial.traitorPath.steps.setupTraitorTurn).toContain('女孩和圣符或指环');
        expect(zhCNLocale.tutorial.traitorPath.steps.traitorObjective).toContain('打开叛徒剧本');
        expect(zhCNLocale.tutorial.traitorPath.steps.pickUpGirl).toContain('拾起女孩');
        expect(zhCNLocale.tutorial.traitorPath.steps.giveGirlToMummy).toContain('交出女孩');
        expect(zhCNLocale.tutorial.traitorPath.steps.giveOmenToMummy).toContain('交出圣符');
        expect(zhCNLocale.tutorial.traitorPath.steps.traitorFinish).toContain('叛徒胜利');
        expect(zhCNLocale.tutorial.mummyMonsterActions.title).toContain('木乃伊怪物行动');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.setupMonsterMove).toContain('石棺房间');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.monsterTurnStart).toContain('木乃伊开回合');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.monsterRoll).toContain('木乃伊移动骰');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.monsterRollReview).toContain('移动骰结果');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.monsterRollReview).not.toContain('0 点');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.monsterMoveTarget).toContain('结果为 0 或 1');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.monsterMoveTarget).toContain('已发现房间');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.monsterMoveResult).toContain('可以持有女孩');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.setupAttack).toContain('同房攻击');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.setupAttack).toContain('木乃伊攻击英雄');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.attackForced).toContain('必须先攻击英雄');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.attackTarget).toContain('叛徒和已死亡探险者不是攻击目标');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.attackRollReview).toContain('选择造成伤害或偷窃');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.attackReward).toContain('偷走地图');
        expect(zhCNLocale.tutorial.mummyMonsterActions.steps.stealResult).toContain('被偷的英雄不扣减能力');
        const playerTutorialText = collectPlayerText(zhCNLocale.tutorial).join('\n');
        const englishTutorialText = collectPlayerText(enLocale.tutorial).join('\n');
        expect(playerTutorialText).not.toMatch(/真实链路|运行态|不是动画|不是说明图层|不是教程按钮|E2E|正式验证|收口|收尾|终局页|房间焦点入口|对攻/);
        expect(playerTutorialText).not.toMatch(/不常驻|写满公式|业务公式|悬浮提示才|验收|测试|AI|HUD|为什么和|不是凭空出现|同一画面|同屏|同一次发现|结果面板|日志摘要|奖励条|行动槽|终幕报告|背景说明|为了演示|演示|面板会|面板|摘要|队列|待放置状态|主视区|动作区|结果区|横幅|提示条|底部动作|移动圆牌|读完骰盘|读完攻击骰盘|在这里|实现|运行态/);
        expect(englishTutorialText).not.toMatch(/same screen|same frame|result panel|summary|queue|for this .*demo|demo|placement preview|bottom actions|movement medallion|dice table|attack dice, bonus, and result|screen|panel|summary|queue|banner|implementation|runtime|here\./i);
    });
});
