import { test, expect } from '../framework';
import * as fs from 'node:fs';
import * as path from 'node:path';

const OUT_DIR = path.resolve(
  process.cwd(),
  'test-results',
  'evidence-screenshots',
  'smashup',
  'bewitched-samurai-force-order-regression',
);

async function dump(page: any, name: string) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const state = await page.evaluate(() => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    return harness?.state?.get?.();
  });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(state, null, 2), 'utf8');
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
  return state;
}

async function currentInteraction(page: any) {
  return page.evaluate(() => {
    const current = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
    return current ? {
      id: current.id,
      playerId: current.playerId,
      sourceId: current.data?.sourceId,
      title: current.data?.title,
      prompt: current.data?.prompt,
      options: (current.data?.options ?? []).map((option: any) => ({
        id: option.id,
        label: option.label,
        value: option.value,
      })),
    } : null;
  });
}

test.describe('回归：着魔 + 武士 陈强制效果先结算选择', () => {
  test('选择任一强制效果后不应卡在先结算界面', async ({ page, game }) => {
    test.setTimeout(90000);

    page.on('console', msg => console.log(`[browser:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', error => console.error(`[pageerror] ${error.message}\n${error.stack}`));

    await page.goto('/play/smashup');
    await page.waitForFunction(
      () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
      { timeout: 20000, polling: 200 },
    );

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [],
        deck: ['robot_microbot_alpha', 'robot_microbot_guard'],
        discard: [],
        factions: ['world_champs', 'robots'],
      },
      player1: {
        hand: [],
        deck: [],
        discard: [],
        factions: ['dinosaurs', 'pirates'],
      },
      currentPlayer: '0',
      phase: 'playCards',
      bases: [{
        defId: 'base_the_jungle',
        minions: [
          {
            uid: 'wc-chan-host',
            defId: 'world_champs_samurai_chan',
            owner: '0',
            controller: '0',
            tempPowerModifier: 20,
            attachedActions: [{ uid: 'bewitched-action', defId: 'world_champs_bewitched', ownerId: '0' }],
          },
          { uid: 'ally-target', defId: 'robot_microbot_alpha', owner: '0', controller: '0', tempPowerModifier: 0 },
          { uid: 'enemy-power', defId: 'dino_king_rex', owner: '1', controller: '1', tempPowerModifier: 0 },
        ],
        ongoingActions: [],
      }, {
        defId: 'base_tar_pits',
        minions: [
          { uid: 'remote-target', defId: 'robot_microbot_guard', owner: '0', controller: '0', tempPowerModifier: 0 },
        ],
        ongoingActions: [],
      }],
    });

    await dump(page, '01-before-end-turn');
    await page.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });

    await page.waitForFunction(
      () => {
        const current = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
        return current?.data?.sourceId === 'smashup_reaction_choose';
      },
      { timeout: 20000, polling: 200 },
    );

    const firstPrompt = await currentInteraction(page);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, '02-first-prompt-meta.json'), JSON.stringify(firstPrompt, null, 2), 'utf8');
    await page.screenshot({ path: path.join(OUT_DIR, '02-first-prompt.png'), fullPage: true });

    expect(firstPrompt?.options?.some((option: any) => /着魔|world_champs_bewitched/.test(option.label))).toBe(true);
    expect(firstPrompt?.options?.some((option: any) => /武士\s*陈|world_champs_samurai_chan/.test(option.label))).toBe(true);

    const bewitchedOption = firstPrompt?.options?.find((option: any) =>
      /着魔|world_champs_bewitched/.test(option?.label ?? '') || option?.id?.includes?.('world_champs_bewitched')
    );
    expect(bewitchedOption).toBeTruthy();
    await page.getByRole('button', { name: /着魔/ }).click({ force: true });

    await page.waitForTimeout(1000);
    const afterState = await dump(page, '03-after-click-bewitched');
    const afterBewitched = await currentInteraction(page);
    fs.writeFileSync(path.join(OUT_DIR, '03-after-click-bewitched-meta.json'), JSON.stringify({ current: afterBewitched, triggerQueue: afterState?.core?.triggerQueue }, null, 2), 'utf8');

    expect(afterBewitched?.sourceId).toBe('world_champs_bewitched_transfer');
    expect(afterBewitched?.title).toContain('着魔');
    expect(afterBewitched?.options?.some((option: any) => option.value?.minionUid === 'ally-target')).toBe(true);
  });
});
