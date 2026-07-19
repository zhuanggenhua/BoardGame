import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildChangelogDraft,
    detectGameIdsFromPaths,
    filterPublishableGameIds,
    parsePublishOptions,
} from './publish-game-changelog.mjs';

test('从常见改动路径识别受影响游戏', () => {
    assert.deepEqual(detectGameIdsFromPaths([
        'src/games/dicethrone/domain/rules.ts',
        'e2e/smashup/smashup-marvel.e2e.ts',
        'docs/games/betrayal/README.md',
        'public/locales/zh-CN/game-the-gang.json',
        'public/assets/i18n/zh-CN/summonerwars/assets-manifest.json',
        'src/games/manifest.client.generated.tsx',
        'src/games/__tests__/registry.test.ts',
    ]), ['betrayal', 'dicethrone', 'smashup', 'summonerwars', 'the-gang']);
});

test('手动指定游戏时不再额外混入自动识别结果', () => {
    assert.deepEqual(detectGameIdsFromPaths([
        'src/games/dicethrone/domain/rules.ts',
        'src/games/smashup/abilities/marvel.ts',
    ], ['the-gang']), ['the-gang']);
});

test('玩家公开日志默认跳过实施中游戏', () => {
    const result = filterPublishableGameIds(
        ['betrayal', 'dicethrone', 'smashup', 'summonerwars', 'the-gang'],
        ['betrayal', 'qidahen'],
    );

    assert.deepEqual(result.gameIds, ['dicethrone', 'smashup', 'summonerwars', 'the-gang']);
    assert.deepEqual(result.skippedGameIds, ['betrayal']);
});

test('显式覆盖时允许为实施中游戏生成日志', () => {
    const result = filterPublishableGameIds(
        ['betrayal', 'dicethrone'],
        ['betrayal'],
        { includeUnderConstruction: true },
    );

    assert.deepEqual(result.gameIds, ['betrayal', 'dicethrone']);
    assert.deepEqual(result.skippedGameIds, []);
});

test('生成按 Steam 风格分组的更新日志草稿', () => {
    const draft = buildChangelogDraft({
        gameId: 'dicethrone',
        gameName: '王权骰铸',
        commitMessages: [
            'fix: 修复不可防御伤害仍打开防御方减伤窗口',
            'feat: 新增战斗结算提示',
            'test: 补充 DiceThrone 回归覆盖',
        ],
        versionLabel: '0.6.12',
    });

    assert.equal(draft.title, '王权骰铸 更新：修复不可防御伤害仍打开防御方减伤窗口');
    assert.match(draft.content, /## 修复\n- 修复不可防御伤害仍打开防御方减伤窗口/);
    assert.match(draft.content, /## 新增\n- 新增战斗结算提示/);
    assert.doesNotMatch(draft.content, /验证|回归覆盖|测试/);
    assert.equal(draft.versionLabel, '0.6.12');
    assert.equal(draft.published, true);
});

test('玩家日志过滤其他游戏和纯内部提交说明', () => {
    const draft = buildChangelogDraft({
        gameId: 'dicethrone',
        gameName: '王权骰铸',
        commitMessages: [
            '山屋惊魂：补探索者详情和移动端投骰承接',
            'DiceThrone：修复不可防御伤害仍打开防御方减伤窗口，补测试与审计回写',
            '规范：补当前对话改动归属边界',
        ],
        versionLabel: '0.6.12',
    });

    assert.match(draft.content, /## 修复\n- 修复不可防御伤害仍打开防御方减伤窗口/);
    assert.doesNotMatch(draft.content, /山屋惊魂|规范|审计|测试/);
});

test('玩家日志清理多游戏前缀和内部验收措辞', () => {
    const smashupDraft = buildChangelogDraft({
        gameId: 'smashup',
        gameName: '大杀四方',
        commitMessages: [
            '召唤师战争与 Smash Up：对齐友方攻击、触发时机和目标选择合同',
        ],
        versionLabel: '0.6.12',
    });
    const gangDraft = buildChangelogDraft({
        gameId: 'the-gang',
        gameName: '纸牌帮',
        commitMessages: [
            '纸牌帮与资源链：接入关键图片预加载解析器，补路径测试和中央筹码布局验收',
        ],
        versionLabel: '0.6.12',
    });

    assert.match(smashupDraft.content, /- 对齐友方攻击、触发时机和目标选择规则/);
    assert.doesNotMatch(smashupDraft.content, /召唤师战争|Smash Up|合同/);
    assert.match(gangDraft.content, /- 接入关键图片预加载解析器/);
    assert.doesNotMatch(gangDraft.content, /测试|验收/);
});

test('读取 env 凭据并支持草稿发布配置', () => {
    const options = parsePublishOptions(
        ['--game', 'dicethrone,smashup', '--draft', '--pinned=true', '--type', 'fix'],
        {
            BG_CHANGELOG_API_BASE_URL: 'https://api.example.com/',
            BG_CHANGELOG_ACCOUNT: 'dev@example.com',
            BG_CHANGELOG_PASSWORD: 'secret',
            BG_CHANGELOG_VERSION: '0.7.0',
        },
    );

    assert.deepEqual(options.games, ['dicethrone', 'smashup']);
    assert.equal(options.apiBaseUrl, 'https://api.example.com');
    assert.equal(options.account, 'dev@example.com');
    assert.equal(options.password, 'secret');
    assert.equal(options.versionLabel, '0.7.0');
    assert.equal(options.published, false);
    assert.equal(options.pinned, true);
    assert.equal(options.type, 'fix');
    assert.equal(options.includeUnderConstruction, false);
});

test('解析实施中游戏发布覆盖开关', () => {
    const options = parsePublishOptions(['--include-under-construction']);

    assert.equal(options.includeUnderConstruction, true);
});
