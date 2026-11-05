import { readFileSync } from 'node:fs';
import { expect, test } from '../framework';

test('线上反馈圣洁光辉快照在本地页面消费原始阶段和响应', async ({ page, game }) => {
    const packetPath = process.env.DT_FEEDBACK_SNAPSHOT_PATH;
    test.skip(!packetPath, '需要显式提供本地反馈诊断包');
    const markdown = readFileSync(packetPath!, 'utf8');
    const snapshotText = markdown.split('## 状态快照')[1]?.match(/```text\s*([\s\S]*?)\s*```/)?.[1];
    if (!snapshotText) throw new Error('反馈诊断包缺少状态快照');
    const snapshot = JSON.parse(snapshotText);

    await game.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true });
    await page.evaluate(async state => {
        await (window as any).__BG_TEST_HARNESS__.state.set(state);
    }, snapshot);

    await expect.poll(async () => {
        const state = await game.getState() as any;
        return {
            phase: state.sys.phase,
            interactionId: state.sys.interaction.current?.id,
            attack: state.core.pendingAttack?.sourceAbilityId,
            defenseResolved: state.core.pendingAttack?.defenseResolved,
            defenderHealth: state.core.players['1'].resources.hp,
            flight: state.core.players['0'].tokens.flight,
            healSeen: state.sys.eventStream.entries.some((entry: any) => entry.event?.type === 'HEAL_APPLIED' && entry.event.payload?.amount === 6),
        };
    }, { timeout: 10000 }).toEqual({
        phase: 'defensiveRoll',
        interactionId: snapshot.sys.interaction.current.id,
        attack: 'holy-radiance',
        defenseResolved: true,
        defenderHealth: 7,
        flight: 1,
        healSeen: true,
    });
    await page.screenshot({ path: 'temp/feedback-closeout/timing-audit-20261028/feedback-snapshot-consumed.png' });
});

test('线上反馈判决指令提交快照在本地页面消费已发生的休战和伤害', async ({ page, game }) => {
    const packetPath = process.env.DT_FEEDBACK_SNAPSHOT_PATH;
    test.skip(!packetPath, '需要显式提供本地反馈诊断包');
    const markdown = readFileSync(packetPath!, 'utf8');
    const snapshotText = markdown.split('## 状态快照')[1]?.match(/```text\s*([\s\S]*?)\s*```/)?.[1];
    if (!snapshotText) throw new Error('反馈诊断包缺少状态快照');
    const snapshot = JSON.parse(snapshotText);
    await game.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true });
    await page.evaluate(async state => {
        await (window as any).__BG_TEST_HARNESS__.state.set(state);
    }, snapshot);
    await expect.poll(async () => {
        const state = await game.getState() as any;
        const events = state.sys.eventStream.entries.map((entry: any) => entry.event);
        return {
            matchId: state.sys.matchId,
            phase: state.sys.phase,
            pendingAttack: state.core.pendingAttack ?? null,
            treantHp: state.core.players['0'].resources.hp,
            parley: state.core.players['0'].statusEffects.parley,
            divine: state.core.players['0'].tokens.treant_divine,
            appliedParley: events.some((event: any) => event?.type === 'STATUS_APPLIED' && event.payload?.sourceAbilityId === 'verdict-command' && event.payload?.statusId === 'parley'),
            verdictDamage: events.some((event: any) => event?.type === 'DAMAGE_DEALT' && event.payload?.sourceAbilityId === 'verdict-command' && event.payload?.amount === 7),
        };
    }, { timeout: 10000 }).toEqual({
        matchId: 'LQY1Q11xUYU', phase: 'main1', pendingAttack: null,
        treantHp: 22, parley: 1, divine: 1, appliedParley: true, verdictDamage: true,
    });
});
