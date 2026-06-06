import process from 'node:process';
import { chromium } from 'playwright';
import { ensureSingleWorkerRuntime, stopManagedRuntime } from './e2e-runtime-manager.mjs';
import {
    createDTRoomViaAPI,
    claimDTSeatViaAPI,
    joinDTMatchViaAPI,
    seedDTMatchCredentials,
    waitForCharacterSelectionInRoom,
} from '../../e2e/helpers/dicethrone';
import { initContext } from '../../e2e/helpers/common';

type CliOptions = {
    attempts: number;
    characterSelectionTimeout: number;
    scope: string;
    headed: boolean;
};

type AttemptResult = {
    attempt: number;
    ok: boolean;
    durationMs: number;
    message: string;
};

process.on('exit', (code) => {
    console.log(`[diag-dt-room-entry] process exit: ${code ?? 0}`);
});

process.on('uncaughtException', (error) => {
    console.error('[diag-dt-room-entry] uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('[diag-dt-room-entry] unhandledRejection', reason);
});

process.env.PW_SERVER_RUNTIME = process.env.PW_SERVER_RUNTIME ?? 'tsx';
process.env.PW_SERVER_WATCH = process.env.PW_SERVER_WATCH ?? 'false';

const parseCliOptions = (): CliOptions => {
    const args = process.argv.slice(2);
    let attempts = 1;
    let characterSelectionTimeout = 90000;
    let scope = 'diag-dt-room-entry';
    let headed = false;

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--attempts') {
            attempts = Number.parseInt(args[index + 1] ?? '1', 10) || 1;
            index += 1;
            continue;
        }
        if (arg.startsWith('--attempts=')) {
            attempts = Number.parseInt(arg.slice('--attempts='.length), 10) || 1;
            continue;
        }
        if (arg === '--character-selection-timeout') {
            characterSelectionTimeout = Number.parseInt(args[index + 1] ?? '90000', 10) || 90000;
            index += 1;
            continue;
        }
        if (arg.startsWith('--character-selection-timeout=')) {
            characterSelectionTimeout = Number.parseInt(arg.slice('--character-selection-timeout='.length), 10) || 90000;
            continue;
        }
        if (arg === '--scope') {
            scope = args[index + 1]?.trim() || scope;
            index += 1;
            continue;
        }
        if (arg.startsWith('--scope=')) {
            scope = arg.slice('--scope='.length).trim() || scope;
            continue;
        }
        if (arg === '--headed') {
            headed = true;
        }
    }

    return {
        attempts: Math.max(1, attempts),
        characterSelectionTimeout: Math.max(10000, characterSelectionTimeout),
        scope,
        headed,
    };
};

const summarizeResults = (results: AttemptResult[]) => {
    const passed = results.filter(result => result.ok).length;
    console.log(`\n=== DiceThrone 进房诊断汇总 ===`);
    console.log(`总尝试: ${results.length}`);
    console.log(`成功: ${passed}`);
    console.log(`失败: ${results.length - passed}`);
    for (const result of results) {
        console.log(`\n[attempt ${result.attempt}] ${result.ok ? 'PASS' : 'FAIL'} ${result.durationMs}ms`);
        console.log(result.message);
    }
};

const gotoRoom = async (page: import('@playwright/test').Page, matchId: string, playerId: string) => {
    await page.goto(`/play/dicethrone/match/${matchId}?playerID=${playerId}`, {
        waitUntil: 'commit',
        timeout: 30000,
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
};

const main = async () => {
    const options = parseCliOptions();
    const runtimeResult = await ensureSingleWorkerRuntime({
        requestedScope: options.scope,
        target: 'diagnose-dicethrone-room-entry',
        logger: console,
    });
    const runtimeId = runtimeResult.runtime.runtimeId;
    const baseURL = `http://127.0.0.1:${runtimeResult.runtime.ports.frontend}`;
    process.env.PW_PORT = String(runtimeResult.runtime.ports.frontend);
    process.env.PW_GAME_SERVER_PORT = String(runtimeResult.runtime.ports.gameServer);
    process.env.GAME_SERVER_PORT = String(runtimeResult.runtime.ports.gameServer);
    process.env.PW_API_SERVER_PORT = String(runtimeResult.runtime.ports.apiServer);
    process.env.API_SERVER_PORT = String(runtimeResult.runtime.ports.apiServer);
    const results: AttemptResult[] = [];

    console.log(`DiceThrone 进房诊断启动`);
    console.log(`runtimeId: ${runtimeId}`);
    console.log(`baseURL: ${baseURL}`);
    console.log(`attempts: ${options.attempts}`);
    console.log(`characterSelectionTimeout: ${options.characterSelectionTimeout}`);

    try {
        for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
            const startedAt = Date.now();
            let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
            let hostContext: import('@playwright/test').BrowserContext | null = null;
            let guestContext: import('@playwright/test').BrowserContext | null = null;

            try {
                console.log(`[diag-dt-room-entry] attempt ${attempt}: launch browser`);
                browser = await chromium.launch({ headless: !options.headed });
                hostContext = await browser.newContext({ baseURL });
                await initContext(hostContext, {
                    storageKey: '__dicethrone_storage_reset',
                    skipTutorial: false,
                });
                const hostPage = await hostContext.newPage();

                const hostGuestId = `diag_dt_host_${Date.now()}_${attempt}`;
                console.log(`[diag-dt-room-entry] attempt ${attempt}: create room`);
                const matchId = await createDTRoomViaAPI(hostPage, hostGuestId);
                if (!matchId) {
                    throw new Error('createDTRoomViaAPI 返回 null');
                }

                console.log(`[diag-dt-room-entry] attempt ${attempt}: claim host seat`);
                const hostCredentials = await claimDTSeatViaAPI(hostPage, matchId, '0', {
                    guestId: hostGuestId,
                    playerName: `DiagHost-${Date.now()}`,
                });
                if (!hostCredentials) {
                    throw new Error('claimDTSeatViaAPI(host) 返回 null');
                }

                await seedDTMatchCredentials(hostContext, matchId, '0', hostCredentials);
                console.log(`[diag-dt-room-entry] attempt ${attempt}: goto host room`);
                await gotoRoom(hostPage, matchId, '0');
                console.log(`[diag-dt-room-entry] attempt ${attempt}: wait host character selection`);
                await waitForCharacterSelectionInRoom(hostPage, {
                    matchId,
                    playerId: '0',
                    timeout: options.characterSelectionTimeout,
                });

                guestContext = await browser.newContext({ baseURL });
                await initContext(guestContext, {
                    storageKey: '__dicethrone_storage_reset',
                    skipTutorial: false,
                });
                const guestPage = await guestContext.newPage();
                const guestGuestId = `diag_dt_guest_${Date.now()}_${attempt}`;

                console.log(`[diag-dt-room-entry] attempt ${attempt}: join guest`);
                const guestCredentials = await joinDTMatchViaAPI(guestPage, matchId, '1', `DiagGuest-${Date.now()}`, guestGuestId);
                if (!guestCredentials) {
                    throw new Error('joinDTMatchViaAPI(guest) 返回 null');
                }

                await seedDTMatchCredentials(guestContext, matchId, '1', guestCredentials);
                console.log(`[diag-dt-room-entry] attempt ${attempt}: goto guest room`);
                await gotoRoom(guestPage, matchId, '1');
                console.log(`[diag-dt-room-entry] attempt ${attempt}: wait guest character selection`);
                await waitForCharacterSelectionInRoom(guestPage, {
                    matchId,
                    playerId: '1',
                    timeout: options.characterSelectionTimeout,
                });

                console.log(`[diag-dt-room-entry] attempt ${attempt}: setup ok, matchId=${matchId}`);
                const hostCharacterCount = await hostPage.locator('[data-character-id], [data-char-id]').count();
                const guestCharacterCount = await guestPage.locator('[data-character-id], [data-char-id]').count();
                const hostUrl = hostPage.url();
                const guestUrl = guestPage.url();
                results.push({
                    attempt,
                    ok: true,
                    durationMs: Date.now() - startedAt,
                    message: [
                        `matchId: ${matchId}`,
                        `hostUrl: ${hostUrl}`,
                        `guestUrl: ${guestUrl}`,
                        `hostCharacterCount: ${hostCharacterCount}`,
                        `guestCharacterCount: ${guestCharacterCount}`,
                    ].join('\n'),
                });
            } catch (error) {
                const message = error instanceof Error ? error.stack ?? error.message : String(error);
                console.error(`[diag-dt-room-entry] attempt ${attempt}: failed`);
                console.error(message);
                results.push({
                    attempt,
                    ok: false,
                    durationMs: Date.now() - startedAt,
                    message,
                });
            } finally {
                console.log(`[diag-dt-room-entry] attempt ${attempt}: cleanup start`);
                if (hostContext) {
                    await hostContext.close().catch(() => undefined);
                }
                if (guestContext) {
                    await guestContext.close().catch(() => undefined);
                }
                if (browser) {
                    await browser.close().catch(() => undefined);
                }
                console.log(`[diag-dt-room-entry] attempt ${attempt}: cleanup done`);
            }
        }
    } finally {
        await stopManagedRuntime({ runtimeId, logger: console }).catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`停止诊断 runtime 失败: ${message}`);
        });
    }

    summarizeResults(results);
    if (results.some(result => !result.ok)) {
        process.exitCode = 1;
    }
};

void main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
