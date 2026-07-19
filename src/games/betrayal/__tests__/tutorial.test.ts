import { describe, expect, it } from 'vitest';
import zhCNLocale from '../../../../public/locales/zh-CN/game-betrayal.json';
import {
    buildDiscoveryAtlasImageStyle,
    EVENT_FRONT_ATLAS,
    EVENT_FRONT_FRAME_BY_TITLE,
    resolveDiscoveryAtlasVisual,
} from '../discoveryAtlas';
import { BETRAYAL_DISCOVERY_POOLS } from '../scenarioConfig';
import tutorialCatalog from '../tutorial';

const LOCKED_EVENT_FRONT_FRAMES = {
    标本剥制: 0,
    磁带播放器: 2,
    大宅饿了: 3,
    电话铃声: 5,
    吊死鬼: 6,
    嘎吱的木门: 8,
    脑状食品: 18,
    肉质苔癣: 20,
    上古旧宅: 21,
    '说“茄子”！': 23,
    外星几何: 24,
    小丑房间: 26,
    小机器人: 27,
    '咬一口！': 29,
    夜幕众星: 30,
    一抹鲜红: 32,
    一瓶微尘: 33,
    一条秘密通道: 35,
    一种怪异的感觉: 36,
    '在你背后！': 38,
    葬礼: 39,
    '蜘蛛！': 41,
    最深的壁橱: 42,
} as const;

describe('Betrayal 教程配置', () => {
    it('导出多章节 TutorialCollection，并把基础开局教程设为默认入口', () => {
        expect(tutorialCatalog.defaultTutorialId).toBe('basic-setup-and-turn');
        expect(Object.keys(tutorialCatalog.tutorials)).toEqual([
            'basic-setup-and-turn',
            'trade-and-agreement',
            'move-explore-use',
            'crimson-jack-objective',
            'haunt-actions-and-finish',
            'hero-attack-path',
            'jack-spirit-path',
            'traitor-path',
        ]);
        expect(Object.entries(tutorialCatalog.tutorials)
            .filter(([, entry]) => entry.hiddenFromCatalog !== true)
            .map(([id]) => id)).toEqual([
            'basic-setup-and-turn',
            'trade-and-agreement',
            'haunt-actions-and-finish',
            'hero-attack-path',
            'jack-spirit-path',
            'traitor-path',
        ]);
        expect(tutorialCatalog.tutorials['move-explore-use']?.hiddenFromCatalog).toBe(true);
        expect(tutorialCatalog.tutorials['crimson-jack-objective']?.hiddenFromCatalog).toBe(true);
    });

    it('默认教程会合并恶兆前基础回合，并覆盖首轮必需的规则入口', () => {
        const manifest = tutorialCatalog.tutorials['basic-setup-and-turn']?.manifest;
        expect(manifest?.steps.map((step) => step.id)).toEqual([
            'setup-runtime',
            'objective-and-turn',
            'traits-and-speed',
            'moves-remaining',
            'room-board',
            'inventory-and-help',
            'use-book',
            'open-move-targets',
            'move-to-hallway',
            'explore-upper',
            'finish',
        ]);

        const setupStep = manifest?.steps.find((step) => step.id === 'setup-runtime');
        expect(setupStep?.aiActions).toHaveLength(1);
        expect(setupStep?.aiActions?.[0]?.commandType).toBe('SYS_CHEAT_MERGE_STATE');
        expect(manifest?.steps.find((step) => step.id === 'objective-and-turn')?.highlightTarget).toBe('betrayal-action-move');
        expect(manifest?.steps.find((step) => step.id === 'traits-and-speed')?.highlightTarget).toBe('betrayal-current-traits');
        expect(manifest?.steps.find((step) => step.id === 'moves-remaining')?.highlightTarget).toBe('betrayal-moves-remaining');
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

    it('基础回合教程只允许真实的使用、移动、探索命令链，旧移动探索路由隐藏兼容', () => {
        const manifest = tutorialCatalog.tutorials['basic-setup-and-turn']?.manifest;
        const legacyManifest = tutorialCatalog.tutorials['move-explore-use']?.manifest;
        const setupStep = manifest?.steps.find((step) => step.id === 'setup-runtime');
        const setupFields = setupStep?.aiActions?.[0]?.payload?.fields as { eventOrder?: Array<{ name?: string }> } | undefined;
        const actionSteps = manifest?.steps.filter((step) => step.requireAction) ?? [];
        expect(legacyManifest).toBe(manifest);
        expect(actionSteps.map((step) => step.id)).toEqual([
            'use-book',
            'move-to-hallway',
            'explore-upper',
        ]);
        expect(manifest?.steps.map((step) => step.id)).toContain('open-move-targets');
        expect(manifest?.steps.find((step) => step.id === 'open-move-targets')?.highlightTarget).toBe('betrayal-action-move');
        expect(actionSteps.map((step) => step.allowedCommands)).toEqual([
            ['USE_POSSESSION'],
            ['MOVE_TO_ROOM'],
            ['EXPLORE_ROOM'],
        ]);
        expect(actionSteps.map((step) => step.allowedTargets ?? null)).toEqual([
            ['omen-book'],
            ['hallway'],
            null,
        ]);
        expect(actionSteps[0]?.highlightTarget).toBe('betrayal-inventory-omen-book');
        expect(setupFields?.eventOrder?.map((event) => event.name)).toEqual(['外星几何']);
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
        expect(EVENT_FRONT_FRAME_BY_TITLE.外星几何).toBe(24);

        const visual = resolveDiscoveryAtlasVisual({
            kind: 'event',
            title: '外星几何',
            summary: '进行一次知识检定。',
            detail: '4+ 获得 1 点知识。',
        }, []);

        expect(visual).toMatchObject({
            image: 'betrayal/cards/event-front-atlas',
            frameIndex: 24,
        });
        const style = buildDiscoveryAtlasImageStyle(visual!);
        expect(Number.parseFloat(String(style.width))).toBeCloseTo(900.148, 3);
        expect(Number.parseFloat(String(style.height))).toBeCloseTo(500.078, 3);
        expect(String(style.transform)).toContain('translate(-66.655');
        expect(String(style.transform)).toContain('-39.993');
    });

    it('haunt 章节会合并第一剧本目标与真实收尾入口', () => {
        const objectiveManifest = tutorialCatalog.tutorials['crimson-jack-objective']?.manifest;
        const hauntActionsManifest = tutorialCatalog.tutorials['haunt-actions-and-finish']?.manifest;
        const heroAttackManifest = tutorialCatalog.tutorials['hero-attack-path']?.manifest;
        const jackSpiritManifest = tutorialCatalog.tutorials['jack-spirit-path']?.manifest;
        const traitorManifest = tutorialCatalog.tutorials['traitor-path']?.manifest;
        expect(objectiveManifest).toBe(hauntActionsManifest);
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'help-entry')?.highlightTarget).toBe('betrayal-reference-entry');
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'haunt-actions')?.highlightTarget).toBe('betrayal-action-use');
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'exorcise-jack')?.allowedCommands).toEqual(['EXORCISE_JACK']);
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'exorcise-jack')?.randomPolicy).toEqual({
            mode: 'fixed',
            values: [3],
        });
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'endgame-review')?.highlightTarget).toBe('betrayal-endgame-screen');
        expect(heroAttackManifest?.steps.map((step) => step.id)).toEqual([
            'setup-hero-attack',
            'hero-attack-objective',
            'attack-traitor',
            'hero-attack-review',
        ]);
        expect(heroAttackManifest?.steps.find((step) => step.id === 'hero-attack-objective')?.highlightTarget).toBe('betrayal-reference-entry');
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
        expect(jackSpiritManifest?.steps.find((step) => step.id === 'jack-spirit-objective')?.highlightTarget).toBe('betrayal-reference-entry');
        expect(jackSpiritManifest?.steps.find((step) => step.id === 'jack-spirit-attack')?.allowedCommands).toEqual(['HAUNT_ATTACK']);
        expect(jackSpiritManifest?.steps.find((step) => step.id === 'jack-spirit-attack')?.advanceOnEvents).toEqual([
            { type: 'HAUNT_ATTACK_RESOLVED', match: { attackerPlayerId: '2', target: 'hero' } },
        ]);
        expect(jackSpiritManifest?.steps.find((step) => step.id === 'jack-spirit-review')?.highlightTarget).toBe('betrayal-attack-roll-review');
        expect(traitorManifest?.steps.map((step) => step.id)).toEqual([
            'setup-traitor-turn',
            'traitor-objective',
            'attack-hero',
            'traitor-finish',
        ]);
        expect(traitorManifest?.steps.find((step) => step.id === 'setup-traitor-turn')?.viewAs).toBe('2');
        expect(traitorManifest?.steps.find((step) => step.id === 'attack-hero')?.allowedCommands).toEqual(['HAUNT_ATTACK']);
        expect(traitorManifest?.steps.find((step) => step.id === 'attack-hero')?.advanceOnEvents).toEqual([
            { type: 'HAUNT_ATTACK_RESOLVED', match: { attackerPlayerId: '2', target: 'hero' } },
        ]);
    });

    it('中文教程文案会聚焦玩家能理解的规则动作与结果', () => {
        expect(zhCNLocale.tutorial.basicSetup.steps.setupRuntime).toContain('基础回合');
        expect(zhCNLocale.tutorial.basicSetup.steps.objectiveAndTurn).toContain('底部动作');
        expect(zhCNLocale.tutorial.basicSetup.steps.traitsAndSpeed).toContain('速度');
        expect(zhCNLocale.tutorial.basicSetup.steps.movesRemaining).toContain('移动圆牌');
        expect(zhCNLocale.tutorial.basicSetup.steps.useBook).toContain('先选择持有区里的书本');
        expect(zhCNLocale.tutorial.basicSetup.steps.useBook).toContain('再点“使用”');
        expect(zhCNLocale.tutorial.basicSetup.steps.exploreUpper).toContain('可探索的盖着房间');
        expect(zhCNLocale.tutorial.basicSetup.steps.exploreUpper).toContain('翻开成新房间');
        expect(zhCNLocale.tutorial.basicSetup.steps.finish).toContain('兔脚');
        expect(zhCNLocale.tutorial.tradeAndAgreement.title).toContain('交易');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.setupTrade).toContain('双方都要同意');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.chooseTradeItem).toContain('兔脚');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.chooseTradeTarget).toContain('同房间队友');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.sendTradeRequest).toContain('发送交易请求');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.requestWaiting).toContain('等待对方同意');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.acceptTradeRequest).toContain('同意交易');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.acceptTradeRequest).toContain('拒绝');
        expect(zhCNLocale.tutorial.tradeAndAgreement.steps.tradeReview).toContain('进入队友持有区');
        expect(zhCNLocale.tutorial.hauntActions.title).toContain('看目标，再驱魔');
        expect(zhCNLocale.tutorial.hauntActions.steps.setupReadyToExorcise).toContain('探索和预兆');
        expect(zhCNLocale.tutorial.hauntActions.steps.setupReadyToExorcise).toContain('赤红杰克归来');
        expect(zhCNLocale.tutorial.hauntActions.steps.helpEntry).toContain('作祟后目标已经变了');
        expect(zhCNLocale.tutorial.hauntActions.steps.helpEntry).toContain('确认双方怎么赢');
        expect(zhCNLocale.tutorial.hauntActions.steps.hauntActions).toContain('驱魔不是凭空出现');
        expect(zhCNLocale.tutorial.hauntActions.steps.hauntActions).toContain('调查杰克');
        expect(zhCNLocale.tutorial.hauntActions.steps.hauntActions).toContain('驱魔法阵');
        expect(zhCNLocale.tutorial.hauntActions.steps.exorciseJack).toContain('神志检定');
        expect(zhCNLocale.tutorial.hauntActions.steps.endgameReview).toContain('驱魔成功');
        expect(zhCNLocale.tutorial.hauntActions.steps.endgameReview).toContain('幸存者逃脱');
        expect(zhCNLocale.tutorial.heroAttackPath.steps.heroAttackObjective).toContain('打开剧本提示');
        expect(zhCNLocale.tutorial.heroAttackPath.steps.attackTraitor).toContain('攻击叛徒');
        expect(zhCNLocale.tutorial.heroAttackPath.steps.heroAttackReview).toContain('攻击骰');
        expect(zhCNLocale.tutorial.jackSpiritPath.title).toContain('杰克之灵');
        expect(zhCNLocale.tutorial.jackSpiritPath.steps.setupJackSpirit).toContain('会继续行动的怪物');
        expect(zhCNLocale.tutorial.jackSpiritPath.steps.jackSpiritObjective).toContain('回到尸体房间');
        expect(zhCNLocale.tutorial.jackSpiritPath.steps.jackSpiritAttack).toContain('怪物攻击');
        expect(zhCNLocale.tutorial.jackSpiritPath.steps.jackSpiritReview).toContain('同一套攻击骰盘');
        expect(zhCNLocale.tutorial.traitorPath.steps.setupTraitorTurn).toContain('不是英雄路线的下一步');
        expect(zhCNLocale.tutorial.traitorPath.steps.traitorObjective).toContain('所有英雄倒下');
        expect(zhCNLocale.tutorial.traitorPath.steps.attackHero).toContain('敌方攻击');
        expect(zhCNLocale.tutorial.traitorPath.steps.attackHero).toContain('投骰对抗');
        expect(JSON.stringify(zhCNLocale.tutorial)).not.toMatch(/真实链路|运行态|不是动画|不是说明图层|不是教程按钮|E2E|正式验证|收口|收尾|终局页|房间焦点入口|对攻/);
    });
});
