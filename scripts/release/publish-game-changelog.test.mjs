import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildChangelogDraft,
    detectGameIdsFromPaths,
    filterPublishableGameIds,
    parsePublishOptions,
    publishChangelogDrafts,
} from './publish-game-changelog.mjs';
import {
    formatDeploymentOtaNotes,
    prepareDeploymentGameChangelog,
    resolveDeploymentChangelogApiBaseUrl,
} from './deployment-game-changelog.mjs';

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

test('部署日志只保留可公开游戏并将同一标题和正文格式化为 OTA 文案', () => {
    const prepared = prepareDeploymentGameChangelog({
        payload: {
            entries: [
                {
                    gameId: 'dicethrone',
                    title: '王权骰铸 0.6.48：响应提示修复',
                    content: '本次更新修复伤害响应提示。\r\n\r\n## 修复\r\n- 修复不可防御伤害错误打开防御窗口',
                },
                {
                    gameId: 'betrayal',
                    title: '山屋惊魂：调查日志修复',
                    content: '本次更新修复调查流程。',
                },
            ],
        },
        gameNames: { dicethrone: '王权骰铸', betrayal: '山屋惊魂' },
        underConstructionGameIds: ['betrayal'],
        defaultVersionLabel: '0.6.48',
    });

    assert.deepEqual(prepared.skippedGameIds, ['betrayal']);
    assert.deepEqual(prepared.drafts, [{
        gameId: 'dicethrone',
        title: '王权骰铸 0.6.48：响应提示修复',
        versionLabel: '0.6.48',
        content: '本次更新修复伤害响应提示。\n\n## 修复\n- 修复不可防御伤害错误打开防御窗口',
        published: true,
        pinned: false,
    }]);
    assert.equal(
        formatDeploymentOtaNotes(prepared.drafts),
        '王权骰铸 0.6.48：响应提示修复\n\n本次更新修复伤害响应提示。\n\n## 修复\n- 修复不可防御伤害错误打开防御窗口',
    );
});

test('部署日志空条目可跳过，重复游戏或未知游戏拒绝发布', () => {
    const base = {
        gameNames: { dicethrone: '王权骰铸' },
        underConstructionGameIds: [],
    };
    assert.deepEqual(prepareDeploymentGameChangelog({ payload: { entries: [] }, ...base }), {
        drafts: [],
        skippedGameIds: [],
    });

    const entry = {
        gameId: 'dicethrone',
        title: '王权骰铸：修复',
        content: '修复了玩家可见问题。',
    };
    assert.throws(() => prepareDeploymentGameChangelog({
        payload: { entries: [entry, entry] },
        ...base,
    }), /不能为 dicethrone 提供多条/);
    assert.throws(() => prepareDeploymentGameChangelog({
        payload: { entries: [{ ...entry, gameId: 'unknown-game' }] },
        ...base,
    }), /未知游戏/);
    assert.throws(() => prepareDeploymentGameChangelog({
        payload: { entries: [{ ...entry, versionLabel: 123 }] },
        ...base,
    }), /versionLabel 必须是字符串/);
    assert.throws(() => prepareDeploymentGameChangelog({
        payload: { entries: [{ ...entry, published: 'false' }] },
        ...base,
    }), /published 必须是布尔值/);
    assert.throws(() => prepareDeploymentGameChangelog({
        payload: { entries: [{ ...entry, pinned: 'true' }] },
        ...base,
    }), /pinned 必须是布尔值/);
});

test('部署日志 API 必须显式配置且只接受 HTTP(S) 地址', () => {
    assert.throws(() => resolveDeploymentChangelogApiBaseUrl({ env: {} }), /不会默认写入 localhost/);
    assert.equal(resolveDeploymentChangelogApiBaseUrl({
        env: { VITE_BACKEND_URL: 'https://api.example.com/' },
    }), 'https://api.example.com');
    assert.equal(resolveDeploymentChangelogApiBaseUrl({
        explicitUrl: 'http://127.0.0.1:18001/',
        env: {},
    }), 'http://127.0.0.1:18001');
    assert.throws(() => resolveDeploymentChangelogApiBaseUrl({
        explicitUrl: 'ftp://api.example.com',
        env: {},
    }), /HTTP\(S\) URL/);
});

test('已存在相同发布日志时跳过创建', async () => {
    const draft = {
        gameId: 'dicethrone',
        title: '王权骰铸：修复',
        versionLabel: '0.6.48',
        content: '修复了玩家可见问题。',
        published: true,
        pinned: false,
    };
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options = {}) => {
        requests.push({ url: String(url), method: options.method || 'GET' });
        if (String(url).endsWith('/auth/login')) {
            return new Response(JSON.stringify({ success: true, data: { token: 'test-token' } }), { status: 200 });
        }
        if (options.method === 'GET') {
            return new Response(JSON.stringify({ items: [draft] }), { status: 200 });
        }
        return new Response(JSON.stringify({ success: true }), { status: 201 });
    };

    try {
        const result = await publishChangelogDrafts({
            drafts: [draft],
            options: {
                apiBaseUrl: 'https://changelog.test',
                account: 'publisher@test.invalid',
                password: 'test-only',
                noPrompt: true,
                skipDuplicateCheck: false,
            },
        });
        assert.deepEqual(result, { createdCount: 0, duplicateCount: 1 });
        assert.equal(requests.some(({ url, method }) => (
            method === 'POST' && url.endsWith('/admin-api/game-changelogs')
        )), false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('相同的未发布草稿不阻止创建公开日志', async () => {
    const draft = {
        gameId: 'dicethrone',
        title: '王权骰铸：修复',
        versionLabel: '0.6.48',
        content: '修复了玩家可见问题。',
        published: true,
        pinned: false,
    };
    const originalFetch = globalThis.fetch;
    const createRequests = [];
    globalThis.fetch = async (url, options = {}) => {
        if (String(url).endsWith('/auth/login')) {
            return new Response(JSON.stringify({ success: true, data: { token: 'test-token' } }), { status: 200 });
        }
        if (options.method === 'GET') {
            return new Response(JSON.stringify({ items: [{ ...draft, published: false }] }), { status: 200 });
        }
        createRequests.push(JSON.parse(options.body));
        return new Response(JSON.stringify({ success: true, changelog: { id: 'published-1' } }), { status: 201 });
    };

    try {
        const result = await publishChangelogDrafts({
            drafts: [draft],
            options: {
                apiBaseUrl: 'https://changelog.test',
                account: 'publisher@test.invalid',
                password: 'test-only',
                noPrompt: true,
                skipDuplicateCheck: false,
            },
        });
        assert.deepEqual(result, { createdCount: 1, duplicateCount: 0 });
        assert.deepEqual(createRequests, [draft]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('新日志发布成功后记录创建结果', async () => {
    const draft = {
        gameId: 'dicethrone',
        title: '王权骰铸：修复',
        versionLabel: '0.6.48',
        content: '修复了玩家可见问题。',
        published: true,
        pinned: false,
    };
    const originalFetch = globalThis.fetch;
    const publishedDrafts = [];
    globalThis.fetch = async (url, options = {}) => {
        if (String(url).endsWith('/auth/login')) {
            return new Response(JSON.stringify({ success: true, data: { token: 'test-token' } }), { status: 200 });
        }
        if (options.method === 'GET') {
            return new Response(JSON.stringify({ items: [] }), { status: 200 });
        }
        publishedDrafts.push(JSON.parse(options.body));
        return new Response(JSON.stringify({ success: true, changelog: { id: 'created-1' } }), { status: 201 });
    };

    try {
        const result = await publishChangelogDrafts({
            drafts: [draft],
            options: {
                apiBaseUrl: 'https://changelog.test',
                account: 'publisher@test.invalid',
                password: 'test-only',
                noPrompt: true,
                skipDuplicateCheck: false,
            },
        });
        assert.deepEqual(result, { createdCount: 1, duplicateCount: 0 });
        assert.deepEqual(publishedDrafts, [draft]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('后台更新日志 API 写入失败会向部署流程抛出错误', async () => {
    const draft = {
        gameId: 'dicethrone',
        title: '王权骰铸：修复',
        versionLabel: '0.6.48',
        content: '修复了玩家可见问题。',
        published: true,
        pinned: false,
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
        if (String(url).endsWith('/auth/login')) {
            return new Response(JSON.stringify({ success: true, data: { token: 'test-token' } }), { status: 200 });
        }
        if (options.method === 'GET') {
            return new Response(JSON.stringify({ items: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'write unavailable' }), { status: 503 });
    };

    try {
        await assert.rejects(publishChangelogDrafts({
            drafts: [draft],
            options: {
                apiBaseUrl: 'https://changelog.test',
                account: 'publisher@test.invalid',
                password: 'test-only',
                noPrompt: true,
                skipDuplicateCheck: false,
            },
        }), /创建更新日志 失败: HTTP 503 write unavailable/);
    } finally {
        globalThis.fetch = originalFetch;
    }
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
