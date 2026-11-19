import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createEvidenceScreenshotRun } from '../framework/evidenceScreenshots';
import { initContext } from '../helpers/common';
import { getMatchState, patchMatchState } from '../helpers/state-injection';
import { chooseFateIdentity } from './identitySelection';
import type { MatchState } from '../../src/engine/types';
import { createFateAttackDeck, type FateDominationCore } from '../../src/games/fate-domination/domain';
import { FATE_ATTACK_BY_ID, FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';

test.use({ viewport: { width: 1366, height: 768 } });

test('正式在线房的 AI 自行发动神威车轮，从私有候选换牌并交还真人战斗操作', async ({ page, context }, testInfo) => {
    test.setTimeout(120000);
    await initContext(context);
    await page.goto('/');
    await page.locator('[data-game-id="fate-domination"] .platform-game-open').first().click();
    await page.getByTestId('game-details-open-create-room').first().click();
    const room = page.getByTestId('create-room-modal').last();
    await room.getByRole('button', { name: '3人', exact: true }).click();
    await room.getByRole('button', { name: /^加入 AI/ }).click();
    await room.getByTestId('create-room-confirm-button').click();
    await page.waitForURL(/\/play\/fate-domination\/match\/[^/?]+\?playerID=0/);
    const matchId = new URL(page.url()).pathname.split('/').at(-1)!;
    const read = async () => await getMatchState(matchId, page) as MatchState<FateDominationCore>;
    const primary = page.getByTestId('fate-domination-primary-action');
    await chooseFateIdentity(page, 'master', 'm_waver');
    await chooseFateIdentity(page, 'servant', 'servant-saber');
    await primary.click();
    await expect.poll(async () => (await read()).core.phase, { timeout: 30000 }).toBe('outpost');

    // 只预置行动交接的前态。发动、抽牌、选牌、回洗和阶段交还由在线机器人执行。
    const { core, sys } = await read();
    const ai = core.players['1'];
    const human = core.players['0'];
    const other = core.players['2'];
    const workshopAttacks = human.hand.slice(0, 2).map(card => card.id);
    const [openAttack, hiddenAttack] = [...other.hand].sort((left, right) =>
        FATE_ATTACK_BY_ID[left.definitionId].manaCost - FATE_ATTACK_BY_ID[right.definitionId].manaCost);
    const rider = FATE_SERVANT_BY_ID['servant-rider'];
    const skills = [...(FATE_MASTER_BY_ID[ai.masterId].skills ?? []), ...rider.skillCards!]
        .map((skill, i) => ({ ...skill, id: `${skill.id}:${i}` }));
    const chariot = skills.find(skill => skill.id.startsWith('sc_iskandar_2:'))!;
    const deck = createFateAttackDeck(ai.id, rider.id);
    const [ordinaryAttack] = deck.splice(0, 1);
    const events = [...core.currentEvents.miyama, ...core.currentEvents.shinto, ...core.eventDeck, ...core.eventDiscard];
    const byId = new Map(events.map(card => [card.id, card]));
    const original = byId.get('fuyuki_E11')!;
    const low = byId.get('fuyuki_E9')!;
    const high = byId.get('fuyuki_E4')!;
    const shinto = byId.get('fuyuki_E3')!;
    const kept = new Set([original.id, low.id, high.id, shinto.id]);
    const eventDeck = [low, high, ...events.filter(card => !kept.has(card.id))];
    const battlefield = structuredClone(core.battlefield);
    battlefield.workshop.playerIds = ['0'];
    battlefield.miyama = { ...battlefield.miyama, playerIds: ['1'], eventCards: [original] };
    battlefield.shinto = { ...battlefield.shinto, playerIds: ['2'], eventCards: [shinto] };
    const situation = FATE_SITUATIONS.find(card => card.id === 'sit1')!;
    await patchMatchState(matchId, { core: {
        phase: 'action', currentPlayerId: '0', currentTurnIndex: 0, phaseCompletedPlayerIds: [],
        battlefield, situation, situationDeck: core.situationDeck?.map(card => card.id === situation.id ? core.situation : card),
        currentEvents: { miyama: [original], shinto: [shinto] }, miyamaEvent: original, shintoEvent: shinto, shintoEventFaceDown: false,
        eventDeck, eventDeckCount: eventDeck.length, eventDiscard: [], eventDiscardCount: 0,
        players: {
            '0': { ...human, activeAttackIds: workshopAttacks, faceDownAttackIds: workshopAttacks,
                normalAttackPlayed: true, hasPassedAction: false, locationId: 'workshop', deploymentSlot: 0 },
            '1': { ...ai, servantId: rider.id, skills, hand: [ordinaryAttack], deck, discard: [], activeAttackIds: [ordinaryAttack.id], activeSkills: [chariot.id],
                faceDownAttackIds: [ordinaryAttack.id], locationId: 'miyama', deploymentSlot: null, isRevealed: true, usedAbilityIds: [],
                mana: 0, commandSpells: 0, hasPassedAction: false, normalAttackPlayed: true, normalMoveCompleted: true },
            '2': { ...other, activeAttackIds: [openAttack.id, hiddenAttack.id], faceDownAttackIds: [hiddenAttack.id],
                mana: other.mana - FATE_ATTACK_BY_ID[openAttack.definitionId].manaCost,
                locationId: 'shinto', deploymentSlot: 0, hasPassedAction: true, normalAttackPlayed: true },
        },
    }, sys: { ...sys, turnOrder: core.turnOrder, currentPlayerIndex: 0 } }, page);

    const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready');
    const eventButton = (name: string) => page.getByRole('button', { name: `检视${name}`, exact: true });
    await expect(eventButton(original.name)).toBeVisible();
    await expect(primary).toBeEnabled();
    await page.screenshot({ path: path.join(run.stagingDir, '01-真人交接前的旧事件.png') });
    await primary.click();
    await expect(primary).toBeDisabled();
    await expect(page.locator('.fd-runtime-seat-summary').filter({ hasText: /AI.*行动中/ })).toBeVisible();
    await expect(page).toHaveURL(/\?playerID=0(?:&|$)/);
    await expect(page.locator('[data-card-zone="skill"] .fd-runtime-card-art').first()).toHaveCSS('filter', 'none');
    await expect(page.getByTestId('fate-chariot-choice')).toHaveCount(0);
    await page.screenshot({ path: path.join(run.stagingDir, '02-电脑行动时真人等待.png') });
    await expect.poll(async () => ({ phase: (await read()).core.phase, actor: (await read()).core.currentPlayerId }), { timeout: 25000 })
        .toEqual({ phase: 'battle', actor: '0' });
    const after = await read();
    const resolved = after.sys.eventStream.entries.map(entry => entry.event);
    const draws = resolved.filter(event => event.type === 'FATE_CHARIOT_DRAWN');
    expect(draws).toHaveLength(1);
    expect(draws[0].payload).toMatchObject({ playerId: '1', targetId: original.id, offered: [{ id: low.id }, { id: high.id }] });
    const replacements = resolved.filter(event => event.type === 'FATE_CHARIOT_RESOLVED');
    expect(replacements).toHaveLength(1);
    expect(replacements[0].payload).toMatchObject({ playerId: '1', selected: { id: high.id }, locationId: 'miyama' });
    expect(after.core.eventDeck.some(card => card.id === low.id)).toBe(true);
    expect(after.core.eventDiscard.some(card => card.id === original.id)).toBe(true);
    expect(after.sys.interaction.current).toBeUndefined();
    const visibleDraw = () => page.evaluate(() => {
        const browser = window as unknown as { __BG_TEST_HARNESS__?: { state: { get: () => MatchState<FateDominationCore> } } };
        return browser.__BG_TEST_HARNESS__?.state.get().sys.eventStream.entries.find(entry => entry.event.type === 'FATE_CHARIOT_DRAWN')?.event.payload;
    });
    await expect.poll(visibleDraw).toMatchObject({ playerId: '1', targetId: original.id });
    expect(await visibleDraw()).not.toHaveProperty('offered');
    await expect(eventButton(original.name)).toHaveCount(0);
    await expect(eventButton(high.name)).toBeVisible();
    await expect(primary).toBeEnabled();
    await expect(page.getByTestId('fate-chariot-choice')).toHaveCount(0);
    await page.screenshot({ path: path.join(run.stagingDir, '03-新事件与真人战斗入口.png') });
    await writeFile(path.join(run.stagingDir, 'behavior-trace.json'), JSON.stringify({ kind: 'online-server-ai-representative', matchId,
        fixtureEndsBefore: 'PASS_ACTION', actorId: '1', discarded: original.id, candidates: [low.id, high.id], selected: high.id, next: { phase: after.core.phase, playerId: after.core.currentPlayerId } }, null, 2));
    console.log('[Fate AI chariot]', run.stagingDir);
});
