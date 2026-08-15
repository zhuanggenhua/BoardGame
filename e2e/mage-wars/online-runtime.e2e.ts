import {
    expect,
    test,
    type Browser,
    type BrowserContext,
    type BrowserContextOptions,
    type Locator,
    type Page,
    type TestInfo,
} from '@playwright/test';
import * as fs from 'node:fs';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
    withJpegEvidenceScreenshotOptions,
} from '../framework/evidenceScreenshots';
import {
    attachPageDiagnostics,
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    joinMatchViaAPI,
    seedMatchCredentials,
    waitForFrontendAssets,
    waitForMatchAvailable,
} from '../helpers/common';

type MageWarsOnlineMatch = {
    hostContext: BrowserContext;
    guestContext: BrowserContext;
    hostPage: Page;
    guestPage: Page;
    matchId: string;
    hostCredentials: string;
    guestCredentials: string;
};

type PageDiagnostics = ReturnType<typeof attachPageDiagnostics>;
type JsonRecord = Record<string, unknown>;

const TEST_API_TOKEN_FILE = 'temp/e2e/shared-test-api-token.txt';
const SELF_PREPARED_CARD_SELECTOR = '[data-mage-wars-prepared-card="self"]';

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, name: string) {
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await page.screenshot(withJpegEvidenceScreenshotOptions({
        path,
        fullPage: false,
        animations: 'disabled',
        timeout: 10_000,
    }));
    testInfo.annotations.push({
        type: 'evidence-screenshot',
        description: path,
    });
}

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickFields(source: unknown, keys: string[]): JsonRecord {
    if (!isRecord(source)) return {};
    return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

function resolveTestApiToken(): string | null {
    const envToken = process.env.TEST_API_TOKEN?.trim();
    if (envToken) return envToken;
    try {
        const fileToken = fs.readFileSync(TEST_API_TOKEN_FILE, 'utf-8').trim();
        return fileToken.length > 0 ? fileToken : null;
    } catch {
        return null;
    }
}

async function readVisibleToastMessages(page: Page): Promise<string[]> {
    return page.evaluate(() => Array.from(
        document.querySelectorAll<HTMLElement>('.pointer-events-none .pointer-events-auto'),
    )
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter((text) => text.length > 0));
}

async function readServerCoreSnapshot(
    page: Page,
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
) {
    const token = resolveTestApiToken();
    if (!token) return { error: `missing test api token: ${TEST_API_TOKEN_FILE}` };

    const credentials = playerId === '0' ? match.hostCredentials : match.guestCredentials;
    const response = await page.request.get(`${getGameServerBaseURL()}/test/get-state/${match.matchId}`, {
        headers: {
            'x-test-token': token,
            'x-test-player-id': playerId,
            'x-test-player-credentials': credentials,
        },
    });
    const payload = await response.json().catch(async () => ({
        text: await response.text().catch(() => ''),
    })) as unknown;
    if (!response.ok()) {
        return {
            error: `test state api failed: ${response.status()}`,
            payload,
        };
    }

    const payloadRecord = isRecord(payload) ? payload : {};
    const state = isRecord(payloadRecord.state) ? payloadRecord.state : {};
    const core = isRecord(state.core) ? state.core : {};
    const sys = isRecord(state.sys) ? state.sys : {};
    const players = isRecord(core.players) ? core.players : {};
    const objects = isRecord(core.objects) ? core.objects : {};
    const arena = Array.isArray(core.arena) ? core.arena : [];
    const eventStream = isRecord(sys.eventStream) ? sys.eventStream : {};
    const eventEntries = Array.isArray(eventStream.entries) ? eventStream.entries : [];

    return {
        stateID: payloadRecord._stateID,
        sys: pickFields(sys, ['phase', 'currentPlayerId', 'phaseActorId', 'turnNumber']),
        core: pickFields(core, ['phase', 'currentPlayerId', 'phaseActorId', 'turnNumber']),
        players: Object.fromEntries(Object.entries(players).map(([id, player]) => [
            id,
            pickFields(player, [
                'mageId',
                'mageZoneId',
                'mana',
                'life',
                'damage',
                'actionReady',
                'quickcastReady',
                'preparedSpellCardIds',
                'discardPileCardIds',
                'guarding',
            ]),
        ])),
        objects: Object.fromEntries(Object.entries(objects).map(([id, object]) => [
            id,
            pickFields(object, [
                'ownerId',
                'sourceSpellCardId',
                'zoneId',
                'kind',
                'actionReady',
                'damage',
                'statusTokens',
            ]),
        ])),
        arena: arena.map((zone) => pickFields(zone, ['id', 'occupantIds'])),
        eventStream: eventEntries.slice(-30).map((entry) => {
            const record = isRecord(entry) ? entry : {};
            const event = isRecord(record.event) ? record.event : {};
            const payload = isRecord(event.payload) ? event.payload : {};
            return {
                id: record.id,
                type: event.type,
                payload: pickFields(payload, [
                    'playerId',
                    'spellCardId',
                    'targetObjectId',
                    'targetPlayerId',
                    'targetZoneId',
                    'diceResults',
                    'effectDieResult',
                    'baseDamage',
                    'actualDamage',
                    'amount',
                ]),
            };
        }),
    };
}

async function collectFailureEvidence(
    page: Page,
    options?: {
        match?: MageWarsOnlineMatch;
        playerId?: '0' | '1';
        diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>;
    },
) {
    const [snapshot, toastMessages, serverSnapshot] = await Promise.all([
        readOnlineBoardSnapshot(page),
        readVisibleToastMessages(page),
        options?.match && options.playerId
            ? readServerCoreSnapshot(page, options.match, options.playerId)
            : Promise.resolve(null),
    ]);

    return {
        snapshot,
        toastMessages,
        serverSnapshot,
        diagnostics: options?.diagnostics?.map(({ label, diagnostics }) => ({
            label,
            errors: diagnostics.errors,
        })) ?? [],
    };
}

async function openOnlineBoard(page: Page) {
    await waitForFrontendAssets(page, 45_000);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    const board = page.getByTestId('mage-wars-board');
    await expect(board).toBeVisible({ timeout: 30_000 });
    await expect(board).toContainText('正式竞技场');
    await page.waitForFunction(() => Array.from(document.images)
        .filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.width > 10 && rect.height > 10;
        })
        .every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), undefined, { timeout: 30_000 });
}

async function readPhase(page: Page): Promise<string | null> {
    return page.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase', { timeout: 500 }).catch(() => null);
}

const SIMULTANEOUS_PHASES = new Set(['reset', 'channel', 'upkeep', 'planning']);

async function readOnlineBoardSnapshot(page: Page) {
    const board = page.getByTestId('mage-wars-board');
    const turnEnd = page.getByTestId('mage-wars-turn-end');
    const zones = await page.evaluate(() => Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid^="mage-wars-arena-zone-"]'),
    ).map((zone) => ({
        zoneId: zone.getAttribute('data-testid')?.replace('mage-wars-arena-zone-', '') ?? null,
        legalMove: zone.getAttribute('data-legal-move-zone') === 'true',
        legalTarget: zone.getAttribute('data-legal-target-zone') === 'true',
        fieldCards: Array.from(zone.querySelectorAll<HTMLButtonElement>('[data-testid="mage-wars-zone-field-card"]'))
            .map((card) => ({
                sourceCardId: card.getAttribute('data-source-card-id'),
                objectId: card.getAttribute('data-object-id'),
                disabled: card.disabled,
                ariaLabel: card.getAttribute('aria-label'),
            })),
        mages: Array.from(zone.querySelectorAll<HTMLElement>('[data-testid="mage-wars-zone-mage-entity"]'))
            .map((mage) => ({
                playerId: mage.getAttribute('data-player-id'),
                ariaLabel: mage.getAttribute('aria-label'),
            })),
    })));
    const preparedCards = await page.evaluate(() => Array.from(
        document.querySelectorAll<HTMLElement>('[data-mage-wars-prepared-card="self"]'),
    ).map((card) => ({
        ariaLabel: card.getAttribute('aria-label'),
        sourceCardId: card.getAttribute('data-source-card-id'),
        disabled: card instanceof HTMLButtonElement ? card.disabled : null,
        selected: card.getAttribute('data-selected') === 'true',
        rect: (() => {
            const rect = card.getBoundingClientRect();
            return {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            };
        })(),
    })));
    return {
        phase: await board.getAttribute('data-mage-wars-phase', { timeout: 1_000 }).catch(() => null),
        currentPlayerId: await board.getAttribute('data-mage-wars-current-player-id', { timeout: 1_000 }).catch(() => null),
        phaseActorId: await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 1_000 }).catch(() => null),
        turnNumber: await board.getAttribute('data-mage-wars-turn-number', { timeout: 1_000 }).catch(() => null),
        readyPlayerIds: await board.getAttribute('data-mage-wars-ready-player-ids', { timeout: 1_000 }).catch(() => null),
        turnEndEnabled: await turnEnd.isEnabled({ timeout: 500 }).catch(() => false),
        turnEndText: await turnEnd.innerText({ timeout: 1_000 }).catch(() => ''),
        preparedCards,
        zones,
    };
}

async function readHitTest(locator: Locator) {
    return locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(centerX, centerY);
        const hitChain: Array<{
            tagName: string;
            testId: string | null;
            ariaLabel: string | null;
            className: string | null;
            disabled: boolean | null;
        }> = [];
        let current: Element | null = hit;
        while (current && hitChain.length < 6) {
            hitChain.push({
                tagName: current.tagName.toLowerCase(),
                testId: current.getAttribute('data-testid'),
                ariaLabel: current.getAttribute('aria-label'),
                className: typeof (current as HTMLElement).className === 'string'
                    ? (current as HTMLElement).className
                    : null,
                disabled: current instanceof HTMLButtonElement ? current.disabled : null,
            });
            current = current.parentElement;
        }

        return {
            rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            },
            center: {
                x: Math.round(centerX),
                y: Math.round(centerY),
            },
            hitChain,
        };
    });
}

async function selectPreparedSpell(page: Page, preparedCard: Locator, contextLabel: string) {
    await preparedCard.scrollIntoViewIfNeeded();
    const beforeHit = await readHitTest(preparedCard);
    await preparedCard.click();
    await expect(preparedCard).toHaveAttribute('data-selected', 'true', {
        timeout: 3_000,
    }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const [afterHit, snapshot] = await Promise.all([
            readHitTest(preparedCard).catch((hitError: unknown) => ({
                error: hitError instanceof Error ? hitError.message : String(hitError),
            })),
            readOnlineBoardSnapshot(page),
        ]);
        throw new Error([
            `${contextLabel} 点击后没有进入选中态`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickLegalTargetZone(page: Page, zoneId: string, contextLabel: string) {
    const zone = page.getByTestId(`mage-wars-arena-zone-${zoneId}`);
    await expect(zone).toHaveAttribute('data-legal-target-zone', 'true', {
        timeout: 3_000,
    }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 的目标格 ${zoneId} 未被标记为合法目标`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
    const beforeHit = await readHitTest(zone);
    await zone.click().catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const afterHit = await readHitTest(zone).catch((hitError: unknown) => ({
            error: hitError instanceof Error ? hitError.message : String(hitError),
        }));
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 点击目标格 ${zoneId} 失败`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickLegalMoveZone(page: Page, zoneId: string, contextLabel: string) {
    const zone = page.getByTestId(`mage-wars-arena-zone-${zoneId}`);
    await expect(zone).toHaveAttribute('data-legal-move-zone', 'true', {
        timeout: 3_000,
    }).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 的移动格 ${zoneId} 未被标记为合法移动`,
            message,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
    const beforeHit = await readHitTest(zone);
    await zone.click().catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const afterHit = await readHitTest(zone).catch((hitError: unknown) => ({
            error: hitError instanceof Error ? hitError.message : String(hitError),
        }));
        const snapshot = await readOnlineBoardSnapshot(page);
        throw new Error([
            `${contextLabel} 点击移动格 ${zoneId} 失败`,
            message,
            `beforeHit=${JSON.stringify(beforeHit, null, 2)}`,
            `afterHit=${JSON.stringify(afterHit, null, 2)}`,
            `snapshot=${JSON.stringify(snapshot, null, 2)}`,
        ].join('\n'));
    });
}

async function clickTurnEndIfEnabled(page: Page): Promise<boolean> {
    const turnEnd = page.getByTestId('mage-wars-turn-end');
    if (!await turnEnd.isEnabled({ timeout: 200 }).catch(() => false)) return false;
    try {
        await turnEnd.click({ timeout: 1_000 });
        await page.waitForTimeout(120);
        return true;
    } catch (error: unknown) {
        if (await turnEnd.isEnabled({ timeout: 200 }).catch(() => false)) {
            await turnEnd.click({ timeout: 800, force: true });
            await page.waitForTimeout(120);
            return true;
        }
        return false;
    }
}

async function clickPlanSpellsIfEnabled(page: Page): Promise<boolean> {
    const planSpells = page.getByTestId('mage-wars-plan-spells');
    if (!await planSpells.isVisible({ timeout: 200 }).catch(() => false)) return false;
    if (!await planSpells.isEnabled({ timeout: 200 }).catch(() => false)) return false;
    try {
        await planSpells.click({ timeout: 1_000 });
        await page.waitForTimeout(120);
        return true;
    } catch (error: unknown) {
        if (await planSpells.isEnabled({ timeout: 200 }).catch(() => false)) {
            await planSpells.click({ timeout: 800, force: true });
            await page.waitForTimeout(120);
            return true;
        }
        return false;
    }
}

async function clickPlanningOrTurnEndIfEnabled(page: Page): Promise<boolean> {
    if (await clickPlanSpellsIfEnabled(page)) return true;
    return clickTurnEndIfEnabled(page);
}

async function advanceUntilPhase(
    match: MageWarsOnlineMatch,
    targetPhase: string,
    contextLabel: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const board = match.hostPage.getByTestId('mage-wars-board');
    for (let index = 0; index < 120; index += 1) {
        const [hostPhase, guestPhase] = await Promise.all([
            readPhase(match.hostPage),
            readPhase(match.guestPage),
        ]);
        if (hostPhase === targetPhase && guestPhase === targetPhase) return;

        const phaseActorId = await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(hostPhase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];

        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await match.hostPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        contextLabel,
        `expectedPhase=${targetPhase}`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function waitForZoneFieldCard(
    page: Page,
    zoneId: string,
    sourceCardId: number,
    contextLabel: string,
    options?: {
        match?: MageWarsOnlineMatch;
        playerId?: '0' | '1';
        diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>;
    },
) {
    let lastSnapshot: Awaited<ReturnType<typeof readOnlineBoardSnapshot>> | null = null;

    await expect.poll(async () => {
        lastSnapshot = await readOnlineBoardSnapshot(page);
        const zone = lastSnapshot.zones.find((candidate) => candidate.zoneId === zoneId);
        return zone?.fieldCards.some((card) => card.sourceCardId === String(sourceCardId)) ?? false;
    }, {
        timeout: 10_000,
        message: `${contextLabel} 应出现在 ${zoneId}`,
    }).toBe(true).catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const failureEvidence = await collectFailureEvidence(page, options);
        throw new Error([
            message,
            `${contextLabel} 部署后未在 ${zoneId} 看到 CardID ${sourceCardId}`,
            `snapshot=${JSON.stringify(lastSnapshot, null, 2)}`,
            `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
        ].join('\n'));
    });
}

async function advanceBothPlayersToPlanning(match: MageWarsOnlineMatch) {
    const preparationPhases = new Set(['reset', 'channel', 'upkeep']);
    for (let index = 0; index < 24; index += 1) {
        const phases = await Promise.all([
            readPhase(match.hostPage),
            readPhase(match.guestPage),
        ]);
        if (phases.every((phase) => phase === 'planning')) return;

        for (const page of [match.hostPage, match.guestPage]) {
            const phase = await readPhase(page);
            if (!preparationPhases.has(phase ?? '')) continue;
            await clickTurnEndIfEnabled(page);
        }
        await Promise.all([
            match.hostPage.waitForTimeout(120),
            match.guestPage.waitForTimeout(120),
        ]);
    }

    await expect.poll(async () => Promise.all([
        readPhase(match.hostPage),
        readPhase(match.guestPage),
    ])).toEqual(['planning', 'planning']);
}

async function setupOnlineMageWars(
    browser: Browser,
    baseURL?: string,
    contextOptions: BrowserContextOptions = {},
): Promise<MageWarsOnlineMatch> {
    const hostContext = await browser.newContext({ baseURL, ...contextOptions });
    await initContext(hostContext, {
        storageKey: `mage-wars-online-host-${Date.now()}`,
        skipImageGate: false,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    if (!(await ensureGameServerAvailable(hostPage))) {
        throw new Error('Mage Wars 游戏服务器不可用，无法创建正式联机房间');
    }

    const guestId = `mage_wars_online_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const base = getGameServerBaseURL();
    const createResponse = await hostPage.request.post(`${base}/games/mage-wars/create`, {
        data: {
            numPlayers: 2,
            setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' },
        },
    });
    if (!createResponse.ok()) {
        throw new Error(`Mage Wars 正式房间创建失败：${createResponse.status()}`);
    }
    const createData = await createResponse.json() as { matchID?: string };
    const matchId = createData.matchID;
    if (!matchId) throw new Error('Mage Wars 正式房间未返回 matchID');

    const claimResponse = await hostPage.request.post(`${base}/games/mage-wars/${matchId}/claim-seat`, {
        data: { playerID: '0', playerName: 'MageWars-Host-E2E', guestId },
    });
    if (!claimResponse.ok()) {
        throw new Error(`Mage Wars 房主占座失败：${claimResponse.status()}`);
    }
    const claimData = await claimResponse.json() as { playerCredentials?: string };
    if (!claimData.playerCredentials) throw new Error('Mage Wars 房主占座未返回凭证');
    await seedMatchCredentials(hostContext, 'mage-wars', matchId, '0', claimData.playerCredentials);
    if (!(await waitForMatchAvailable(hostPage, 'mage-wars', matchId, 20_000))) {
        throw new Error(`Mage Wars 正式房间不可查询：${matchId}`);
    }
    await hostPage.goto(`/play/mage-wars/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });

    const guestContext = await browser.newContext({ baseURL, ...contextOptions });
    await initContext(guestContext, {
        storageKey: `mage-wars-online-guest-${Date.now()}`,
        skipImageGate: false,
        blockCdnAssets: false,
        locale: 'zh-CN',
    });
    const guestPage = await guestContext.newPage();
    await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
    const guestCredentials = await joinMatchViaAPI(
        guestPage,
        'mage-wars',
        matchId,
        '1',
        'MageWars-Guest-E2E',
    );
    if (!guestCredentials) throw new Error(`Mage Wars 客户端加入房间失败：${matchId}`);
    await seedMatchCredentials(guestContext, 'mage-wars', matchId, '1', guestCredentials);
    await guestPage.goto(`/play/mage-wars/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });

    await Promise.all([openOnlineBoard(hostPage), openOnlineBoard(guestPage)]);
    return {
        hostContext,
        guestContext,
        hostPage,
        guestPage,
        matchId,
        hostCredentials: claimData.playerCredentials,
        guestCredentials,
    };
}

async function advanceUntilEnabled(page: Page, locator: ReturnType<Page['getByRole']>) {
    for (let index = 0; index < 16; index += 1) {
        if (await locator.isEnabled().catch(() => false)) return;
        const turnEnd = page.getByTestId('mage-wars-turn-end');
        await expect(turnEnd).toBeVisible();
        if (!await clickPlanningOrTurnEndIfEnabled(page)) await page.waitForTimeout(180);
    }
    await expect(locator).toBeEnabled();
}

async function selectFirstVisibleSpellbookCard(page: Page): Promise<string> {
    for (let index = 0; index < 8; index += 1) {
        const cards = page.getByTestId('mage-wars-desktop-spellbook-card');
        const count = await cards.count();
        for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
            const card = cards.nth(cardIndex);
            if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
                const name = await card.getAttribute('aria-label');
                if (!name) continue;
                await card.click();
                return name;
            }
        }
        const nextPage = page.getByRole('button', { name: '下一页', exact: true });
        if (await nextPage.isDisabled().catch(() => true)) break;
        await nextPage.click();
    }
    throw new Error('正式联机法术书中没有可选的生物卡牌');
}

async function selectNamedSpellbookCard(page: Page, name: string) {
    for (let index = 0; index < 8; index += 1) {
        const card = page.locator(`[data-testid="mage-wars-desktop-spellbook-card"][aria-label="${name}"]`).first();
        if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
            await card.click();
            return;
        }

        const nextPage = page.getByRole('button', { name: '下一页', exact: true });
        if (await nextPage.isDisabled().catch(() => true)) break;
        await nextPage.click();
    }
    throw new Error(`正式联机法术书中没有找到卡牌：${name}`);
}

function selfPreparedCardByName(page: Page, name: string): Locator {
    return page.locator(`${SELF_PREPARED_CARD_SELECTOR}[aria-label="${name}"]`).first();
}

function hasSpellAttackRolledEvent(
    snapshot: JsonRecord,
    spellCardId: number,
    targetObjectId: string,
): boolean {
    const eventStream = Array.isArray(snapshot.eventStream) ? snapshot.eventStream : [];
    return eventStream.some((entry) => {
        if (!isRecord(entry) || entry.type !== 'MW_SPELL_ATTACK_ROLLED') return false;
        const payload = isRecord(entry.payload) ? entry.payload : {};
        return payload.spellCardId === spellCardId
            && payload.targetObjectId === targetObjectId
            && Array.isArray(payload.diceResults);
    });
}

async function deployBothPlayers(
    match: MageWarsOnlineMatch,
    hostCreatureName: string,
    guestCreatureName: string,
    hostZone: string,
    guestZone: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const hostPreparedCard = selfPreparedCardByName(match.hostPage, hostCreatureName);
    await advanceUntilEnabled(match.hostPage, hostPreparedCard);
    const hostSourceCardId = await hostPreparedCard.getAttribute('data-source-card-id');
    await selectPreparedSpell(match.hostPage, hostPreparedCard, hostCreatureName);
    await clickLegalTargetZone(match.hostPage, hostZone, hostCreatureName);
    if (!hostSourceCardId) throw new Error(`部署 ${hostCreatureName} 前未能读取 CardID`);
    await waitForZoneFieldCard(match.hostPage, hostZone, Number(hostSourceCardId), hostCreatureName, {
        match,
        playerId: '0',
        diagnostics,
    });
    await match.hostPage.getByTestId('mage-wars-turn-end').click();

    const guestPreparedCard = selfPreparedCardByName(match.guestPage, guestCreatureName);
    await advanceUntilEnabled(match.guestPage, guestPreparedCard);
    const guestSourceCardId = await guestPreparedCard.getAttribute('data-source-card-id');
    await selectPreparedSpell(match.guestPage, guestPreparedCard, guestCreatureName);
    await clickLegalTargetZone(match.guestPage, guestZone, guestCreatureName);
    if (!guestSourceCardId) throw new Error(`部署 ${guestCreatureName} 前未能读取 CardID`);
    await waitForZoneFieldCard(match.guestPage, guestZone, Number(guestSourceCardId), guestCreatureName, {
        match,
        playerId: '1',
        diagnostics,
    });
    await match.guestPage.getByTestId('mage-wars-turn-end').click();
}

async function advanceToPlayerCreatureAction(
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const targetPage = playerId === '0' ? match.hostPage : match.guestPage;
    for (let index = 0; index < 72; index += 1) {
        const phase = await readPhase(targetPage);
        const phaseActorId = await match.hostPage.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        if (phase === 'creatureAction' && phaseActorId === playerId) {
            return;
        }

        if (phase === 'planning') {
            for (const page of [match.hostPage, match.guestPage]) {
                await clickPlanningOrTurnEndIfEnabled(page);
            }
            continue;
        }

        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(phase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];
        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await targetPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(targetPage, {
        match,
        playerId,
        diagnostics,
    });
    throw new Error([
        `正式联机未能让玩家 ${playerId} 进入行动阶段`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function advanceToReadyFieldObjectAction(
    match: MageWarsOnlineMatch,
    playerId: '0' | '1',
    zoneId: string,
    sourceCardId: number,
    objectName: string,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const targetPage = playerId === '0' ? match.hostPage : match.guestPage;
    const fieldObject = targetPage
        .locator(`[data-testid="mage-wars-arena-zone-${zoneId}"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="${sourceCardId}"]`)
        .first();

    for (let index = 0; index < 180; index += 1) {
        const phase = await readPhase(targetPage);
        const phaseActorId = await match.hostPage.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        if (
            phase === 'creatureAction'
            && phaseActorId === playerId
            && await fieldObject.isEnabled({ timeout: 200 }).catch(() => false)
        ) {
            return;
        }

        if (phase === 'planning') {
            for (const page of [match.hostPage, match.guestPage]) {
                await clickPlanningOrTurnEndIfEnabled(page);
            }
            continue;
        }

        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(phase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];
        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await targetPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(targetPage, {
        match,
        playerId,
        diagnostics,
    });
    throw new Error([
        `正式联机未能让玩家 ${playerId} 的${objectName}在 ${zoneId} 进入可行动窗口`,
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

async function advanceToNextPlanningPhase(
    match: MageWarsOnlineMatch,
    diagnostics?: Array<{ label: string; diagnostics: PageDiagnostics }>,
) {
    const board = match.hostPage.getByTestId('mage-wars-board');
    const initialTurnNumber = Number(await board.getAttribute('data-mage-wars-turn-number', { timeout: 500 }).catch(() => null));

    for (let index = 0; index < 180; index += 1) {
        const phase = await readPhase(match.hostPage);
        const turnNumber = Number(await board.getAttribute('data-mage-wars-turn-number', { timeout: 500 }).catch(() => null));
        const guestPhase = await readPhase(match.guestPage);
        if (
            phase === 'planning'
            && guestPhase === 'planning'
            && Number.isFinite(turnNumber)
            && turnNumber > initialTurnNumber
        ) {
            return;
        }

        const phaseActorId = await board.getAttribute('data-mage-wars-phase-actor-id', { timeout: 500 }).catch(() => null);
        const actorPage = phaseActorId === '1' ? match.guestPage : match.hostPage;
        const standbyPage = phaseActorId === '1' ? match.hostPage : match.guestPage;
        const isSimultaneousPhase = SIMULTANEOUS_PHASES.has(phase ?? '');
        const candidates = isSimultaneousPhase
            ? [match.hostPage, match.guestPage]
            : [actorPage, standbyPage];
        let advanced = false;
        for (const page of candidates) {
            if (await clickPlanningOrTurnEndIfEnabled(page)) {
                advanced = true;
                if (!isSimultaneousPhase) break;
            }
        }
        if (!advanced) await match.hostPage.waitForTimeout(250);
    }

    const failureEvidence = await collectFailureEvidence(match.hostPage, {
        match,
        playerId: '0',
        diagnostics,
    });
    throw new Error([
        '正式联机未能推进到下一轮计划阶段',
        `failureEvidence=${JSON.stringify(failureEvidence, null, 2)}`,
    ].join('\n'));
}

test.describe('Mage Wars formal online runtime', () => {
    test('正式联机入口从双方计划到部署并保持对手计划隐藏', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await expect(match.hostPage.getByTestId('mage-wars-plan-spells')).toBeVisible();
            await expect(match.guestPage.getByTestId('mage-wars-plan-spells')).toBeVisible();
            await match.hostPage.getByRole('button', { name: '生物', exact: true }).click();
            const hostCreatureName = await selectFirstVisibleSpellbookCard(match.hostPage);
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();

            await match.guestPage.getByRole('button', { name: '生物', exact: true }).click();
            const guestCreatureName = await selectFirstVisibleSpellbookCard(match.guestPage);
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();

            await expect(match.hostPage.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible();
            await expect(match.guestPage.getByTestId('mage-wars-opponent-prepared-mirror')).toBeVisible();
            await expect(match.hostPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await expect(match.guestPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-双方计划后-对手计划仍隐藏');

            const hostPreparedCard = selfPreparedCardByName(match.hostPage, hostCreatureName);
            await advanceUntilEnabled(match.hostPage, hostPreparedCard);
            await hostPreparedCard.click();
            await clickLegalTargetZone(match.hostPage, 'a3', hostCreatureName);
            await match.hostPage.getByTestId('mage-wars-turn-end').click();

            const guestPreparedCard = selfPreparedCardByName(match.guestPage, guestCreatureName);
            await advanceUntilEnabled(match.guestPage, guestPreparedCard);
            await guestPreparedCard.click();
            await clickLegalTargetZone(match.guestPage, 'd1', guestCreatureName);
            await match.guestPage.getByTestId('mage-wars-turn-end').click();

            await expect(match.hostPage.locator('[data-testid="mage-wars-zone-field-card"]').first()).toBeVisible();
            await expect(match.guestPage.locator('[data-testid="mage-wars-zone-field-card"]').first()).toBeVisible();
            await expect(match.hostPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await expect(match.guestPage.locator('[data-testid="mage-wars-opponent-prepared-mirror"] img[alt="隐藏计划"]')).toHaveCount(2);
            await expect(match.hostPage.getByTestId('mage-wars-opponent-prepared-mirror')).toContainText('对手已计划 0');
            await expect(match.guestPage.getByTestId('mage-wars-opponent-prepared-mirror')).toContainText('对手已计划 0');
            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-部署完成后-场地生物和隐藏计划');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式联机入口真实施放法术并产生法力、弃牌和法术 FX', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL);
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await match.hostPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.hostPage, '丛林灰狼');
            await selectNamedSpellbookCard(match.hostPage, '冲锋陷阵');
            await expect(match.hostPage.getByTestId('mage-wars-plan-spells')).toHaveText('计划 2 张');
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();

            await match.guestPage.getByRole('button', { name: '生物', exact: true }).click();
            const guestCreatureName = await selectFirstVisibleSpellbookCard(match.guestPage);
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();

            await deployBothPlayers(match, '丛林灰狼', guestCreatureName, 'a3', 'd1', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await advanceToPlayerCreatureAction(match, '0', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);

            const preparedCharge = selfPreparedCardByName(match.hostPage, '冲锋陷阵');
            await expect(preparedCharge).toBeEnabled();
            await preparedCharge.click();
            const wolfCard = match.hostPage.locator('[data-testid="mage-wars-zone-field-card"][data-source-card-id="2819"]').first();
            await expect(wolfCard.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible();
            await wolfCard.click();

            await expect(match.hostPage.getByTestId('mage-wars-fx-spell-cast')).toBeVisible();
            await expect.poll(async () => match.hostPage.getByTestId('mage-wars-mage-hud-self').innerText()).toMatch(/法力\s+[\s\S]*7/);
            await expect(match.hostPage.getByTestId('mage-wars-discard-pile')).toContainText('弃牌 2');
            await expect(match.hostPage.locator(`${SELF_PREPARED_CARD_SELECTOR}[aria-label="冲锋陷阵"]`)).toHaveCount(0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-冲锋陷阵结算后-法力弃牌已变化');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });

    test('正式联机入口真实移动、攻击并切换回合', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(300_000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const match = await setupOnlineMageWars(browser, baseURL, {
            hasTouch: true,
        });
        const hostDiagnostics = attachPageDiagnostics(match.hostPage);
        const guestDiagnostics = attachPageDiagnostics(match.guestPage);

        try {
            await advanceBothPlayersToPlanning(match);
            await match.hostPage.getByRole('button', { name: '生物', exact: true }).click();
            await selectNamedSpellbookCard(match.hostPage, '丛林灰狼');
            await match.hostPage.getByTestId('mage-wars-plan-spells').click();

            await match.guestPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.guestPage, '阿希拉牧师');
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();
            await deployBothPlayers(match, '丛林灰狼', '阿希拉牧师', 'a3', 'd1', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);

            await advanceToNextPlanningPhase(match, [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await match.guestPage.getByRole('button', { name: '全部', exact: true }).click();
            await selectNamedSpellbookCard(match.guestPage, '圣光之柱');
            await expect(match.guestPage.getByTestId('mage-wars-plan-spells')).toHaveText('计划 1 张');
            await match.guestPage.getByTestId('mage-wars-plan-spells').click();
            await advanceToReadyFieldObjectAction(match, '0', 'a3', 2819, '丛林灰狼', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '05-生物行动前-场地对象可直选');

            const hostWolfCard = match.hostPage.locator('[data-testid="mage-wars-arena-zone-a3"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="2819"]').first();
            await hostWolfCard.click({ timeout: 3_000 });
            await clickLegalMoveZone(match.hostPage, 'a2', '丛林灰狼移动');
            await waitForZoneFieldCard(match.hostPage, 'a2', 2819, '丛林灰狼移动后', {
                match,
                playerId: '0',
                diagnostics: [
                    { label: 'host', diagnostics: hostDiagnostics },
                    { label: 'guest', diagnostics: guestDiagnostics },
                ],
            });
            await match.hostPage.setViewportSize({ width: 960, height: 540 });
            await match.guestPage.setViewportSize({ width: 960, height: 540 });
            await saveEvidenceScreenshot(match.hostPage, testInfo, '06-横屏移动后-丛林灰狼进入目标区域');

            await match.hostPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000 });
            await advanceToPlayerCreatureAction(match, '1', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);

            const preparedLightPillar = selfPreparedCardByName(match.guestPage, '圣光之柱');
            await advanceUntilEnabled(match.guestPage, preparedLightPillar);
            await selectPreparedSpell(match.guestPage, preparedLightPillar, '圣光之柱');
            const targetCleric = match.guestPage.locator('[data-testid="mage-wars-arena-zone-d1"] [data-testid="mage-wars-zone-field-card"][data-source-card-id="2811"]').first();
            const targetClericObjectId = await targetCleric.getAttribute('data-object-id');
            if (!targetClericObjectId) throw new Error('圣光之柱目标牧师没有对象 ID，无法核对服务端攻击事件');
            await expect(targetCleric.locator('[data-testid="mage-wars-field-card-target-frame"]')).toBeVisible();
            const attackImpactFx = match.guestPage.getByTestId('mage-wars-fx-attack-impact');
            const attackDiceFx = match.guestPage.getByTestId('mage-wars-fx-attack-dice');
            await Promise.all([
                expect(attackImpactFx).toBeVisible({ timeout: 5_000 }),
                expect(attackDiceFx).toBeVisible({ timeout: 5_000 }),
                expect(attackDiceFx.getByTestId('mage-wars-fx-attack-die-face')).toHaveCount(2, { timeout: 5_000 }),
                expect(attackDiceFx.getByTestId('mage-wars-fx-effect-die-face')).toBeVisible({ timeout: 5_000 }),
                targetCleric.click({ timeout: 3_000 }),
            ]);

            await expect.poll(async () => {
                const snapshot = await readServerCoreSnapshot(match.guestPage, match, '1');
                if (!hasSpellAttackRolledEvent(snapshot, 1706, targetClericObjectId)) return false;
                const objects = isRecord(snapshot.objects) ? snapshot.objects : {};
                const targetObject = isRecord(objects[targetClericObjectId]) ? objects[targetClericObjectId] : {};
                return typeof targetObject.damage === 'number' && targetObject.damage > 0;
            }, {
                message: '服务端没有记录圣光之柱对阿希拉牧师的攻击掷骰和伤害状态',
                timeout: 5_000,
            }).toBe(true);
            await expect(targetCleric.locator('img[alt*="伤害"]')).toBeVisible({ timeout: 5_000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '07-横屏圣光之柱攻击阿希拉牧师后-攻击骰反馈和伤害状态');

            await match.guestPage.getByTestId('mage-wars-turn-end').click({ timeout: 3_000 });
            await advanceUntilPhase(match, 'finalQuickcast', '攻击行动结束后应通过剩余行动结束进入终末快速施法窗口', [
                { label: 'host', diagnostics: hostDiagnostics },
                { label: 'guest', diagnostics: guestDiagnostics },
            ]);
            await saveEvidenceScreenshot(match.guestPage, testInfo, '08-攻击行动结束后-进入终末快速施法窗口');
        } finally {
            await Promise.all([match.hostContext.close(), match.guestContext.close()]);
        }

        expect(hostDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
        expect(guestDiagnostics.errors.filter((entry) => /Maximum update depth|Too many re-renders|ChunkLoadError/i.test(entry))).toEqual([]);
    });
});
