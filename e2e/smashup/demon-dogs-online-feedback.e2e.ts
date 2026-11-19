import { test, expect } from '../framework';
import { completeFactionSelection } from '../helpers/smashup';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { cleanupTwoPlayerMatch, setupTwoPlayerMatch, waitForHandArea } from './smashup-helpers';

test('在线额外出牌提示保留恶魔犬下的暂存随从并可打出', async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    const setup = await setupTwoPlayerMatch(browser, testInfo.project.use.baseURL as string | undefined, { skipImageGate: true });
    expect(setup, '在线测试房间必须可用').not.toBeNull();
    if (!setup) return;
    const { hostPage, guestPage, matchId } = setup;
    const pageErrors: string[] = [];
    hostPage.on('pageerror', error => pageErrors.push(error.message));
    try {
        await completeFactionSelection(hostPage, guestPage, ['pirates', 'aliens'], ['ninjas', 'dinosaurs']);
        await Promise.all([waitForHandArea(hostPage, 45_000), waitForHandArea(guestPage, 45_000)]);
        console.log('[demon-dogs-online] both boards ready');
        const state = structuredClone(await getMatchState(matchId, hostPage)) as any;
        state.core.turnOrder = ['0', '1'];
        state.core.currentPlayerIndex = 0;
        state.core.activePlayerId = '0';
        state.core.phase = 'playCards';
        state.sys.turnOrder = ['0', '1'];
        state.sys.currentPlayerIndex = 0;
        state.sys.phase = 'playCards';
        state.core.players['0'].factions = ['wraithrustlers', 'tricksters'];
        state.core.players['0'].storedCards = [{ uid: 'stored-minion-online', defId: 'trickster_gremlin', type: 'minion', owner: '0', storedByPlayerId: '0', storedUnderUid: 'demon-dogs-online', storedUnderDefId: 'wraithrustlers_demon_dogs', reason: 'wraithrustlers_demon_dogs' }];
        state.core.bases[0] = {
            ...state.core.bases[0], defId: 'base_the_jungle',
            minions: [{ uid: 'accelerator-host-online', defId: 'wraithrustlers_roy', owner: '0', controller: '0', basePower: 3, powerCounters: 0, attachedActions: [{ uid: 'accelerator-online', defId: 'wraithrustlers_unlicensed_nuclear_accelerator', ownerId: '0' }] }],
            ongoingActions: [{ uid: 'demon-dogs-online', defId: 'wraithrustlers_demon_dogs', ownerId: '0' }],
        };
        state.sys.interaction = { current: null, queue: [], isBlocked: false };
        await injectMatchState(matchId, state, hostPage);
        console.log('[demon-dogs-online] authoritative scene injected');
        await hostPage.waitForFunction(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.core?.bases?.[0]?.ongoingActions?.some((card: any) => card.uid === 'demon-dogs-online'), undefined, { timeout: 15_000 });
        await hostPage.evaluate(async () => {
            await (window as any).__BG_TEST_HARNESS__.command.dispatch({ type: 'su:use_talent', playerId: '0', payload: { ongoingCardUid: 'accelerator-online', baseIndex: 0 } });
        });
        await hostPage.waitForFunction(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId === 'wraithrustlers_unlicensed_nuclear_accelerator_destroy_action', undefined, { timeout: 15_000 });
        console.log('[demon-dogs-online] destroy prompt received');
        const dogOption = await hostPage.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().sys.interaction.current.data.options.find((option: any) => option.value?.cardUid === 'demon-dogs-online')?.id);
        expect(dogOption).toBeTruthy();
        const dog = hostPage.locator('[data-ongoing-uid="demon-dogs-online"]');
        await expect(dog).toBeVisible();
        await expect(dog).toHaveAttribute('data-highlighted', 'true');
        const dogBox = await dog.boundingBox();
        expect(dogBox).not.toBeNull();
        const dogPoint = { x: dogBox!.x + dogBox!.width / 2, y: dogBox!.y + dogBox!.height / 2 };
        await expect(dog).toHaveJSProperty('isConnected', true);
        expect(await dog.evaluate((element, point) => {
            const hit = document.elementFromPoint(point.x, point.y);
            return !!hit && (hit === element || element.contains(hit));
        }, dogPoint)).toBe(true);
        await hostPage.mouse.click(dogPoint.x, dogPoint.y);
        const storedOption = hostPage.locator('[data-option-id][data-card-def-id="trickster_gremlin"]');
        await expect(storedOption).toBeVisible({ timeout: 15_000 });
        await storedOption.click();
        await hostPage.waitForFunction(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId === 'smashup_immediate_extra_minion_base', undefined, { timeout: 15_000 });
        const baseOption = await hostPage.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().sys.interaction.current.data.options.find((option: any) => option.value?.baseIndex === 0)?.id);
        expect(baseOption).toBeTruthy();
        const base = hostPage.locator('[data-base-index="0"]').first();
        if (await base.isVisible()) await base.click();
        else await hostPage.locator(`[data-option-id="${baseOption}"]`).click();
        await expect.poll(async () => {
            const actual = await getMatchState(matchId, hostPage) as any;
            return { placed: actual.core.bases[0].minions.some((minion: any) => minion.uid === 'stored-minion-online'), stored: (actual.core.players['0'].storedCards ?? []).some((card: any) => card.uid === 'stored-minion-online'), interaction: actual.sys.interaction.current?.data?.sourceId ?? null };
        }, { timeout: 15_000 }).toEqual({ placed: true, stored: false, interaction: null });
        expect(pageErrors).toEqual([]);
    } finally {
        await cleanupTwoPlayerMatch(setup);
    }
});
