/**
 * DiceThrone Token 响应时序测试
 * 
 * 验证：Token 响应请求后，伤害事件不应立即生成
 * 
 * 测试场景：
 * 1. 攻击方发起攻击（有伤害）
 * 2. 防御方有可用的闪避 Token
 * 3. 验证事件流：TOKEN_RESPONSE_REQUESTED 之后没有 DAMAGE_DEALT
 * 4. 防御方跳过 Token 响应
 * 5. 验证事件流：TOKEN_RESPONSE_CLOSED 之后才有 DAMAGE_DEALT
 */

import { test, expect } from './fixtures';
import { 
    waitForPhase, 
    rollDice, 
    confirmRoll, 
    selectAbility,
    advancePhase,
    readCoreState,
    readEventStream,
    applyCoreStateDirect,
} from './helpers/dicethrone';

test.describe('DiceThrone Token Response Timing', () => {
    test('Token 响应请求后不应立即生成伤害事件', async ({ 
        createDiceThroneMatch, 
        page1, 
        page2 
    }) => {
        // 创建对局：Barbarian vs Moon Elf
        await createDiceThroneMatch({
            player1Character: 'barbarian',
            player2Character: 'moon_elf',
        });

        // 等待双方进入游戏
        await Promise.all([
            waitForPhase(page1, 'offensiveRoll'),
            waitForPhase(page2, 'offensiveRoll'),
        ]);

        // === 设置初始状态 ===
        // 给防御方（Moon Elf）添加闪避 Token，并设置固定伤害
        const initialState = await readCoreState(page1);
        initialState.players['1'].tokens = { evasive: 2 };
        initialState.players['0'].resources.hp = 50;
        initialState.players['1'].resources.hp = 50;
        await applyCoreStateDirect(page1, initialState);
        await page1.waitForTimeout(500);

        // === 攻击方回合：发起攻击 ===
        // 投骰
        await rollDice(page1);
        await page1.waitForTimeout(500);

        // 确认投骰
        await confirmRoll(page1);
        await page1.waitForTimeout(500);

        // 选择有伤害的技能（Smash - 基础攻击）
        await selectAbility(page1, 'smash');
        await page1.waitForTimeout(500);

        // 推进到防御阶段
        await advancePhase(page1);
        await Promise.all([
            waitForPhase(page1, 'defensiveRoll'),
            waitForPhase(page2, 'defensiveRoll'),
        ]);

        // === 防御方回合：投骰并确认 ===
        await rollDice(page2);
        await page2.waitForTimeout(500);

        await confirmRoll(page2);
        await page2.waitForTimeout(500);

        // 推进到攻击结算（触发 Token 响应）
        await advancePhase(page2);
        await page2.waitForTimeout(1500);

        // === 验证 1：Token 响应请求后，事件流中不应有 DAMAGE_DEALT ===
        const eventsAfterRequest = await readEventStream(page2);
        
        // 找到 TOKEN_RESPONSE_REQUESTED 事件的位置
        const tokenRequestIndex = eventsAfterRequest.findIndex(
            (e: any) => e.event.type === 'TOKEN_RESPONSE_REQUESTED'
        );
        
        expect(tokenRequestIndex, 'Should have TOKEN_RESPONSE_REQUESTED event').toBeGreaterThanOrEqual(0);

        // 检查 TOKEN_RESPONSE_REQUESTED 之后、TOKEN_RESPONSE_CLOSED 之前是否有 DAMAGE_DEALT
        const tokenCloseIndex = eventsAfterRequest.findIndex(
            (e: any) => e.event.type === 'TOKEN_RESPONSE_CLOSED'
        );

        if (tokenCloseIndex === -1) {
            // Token 响应还未关闭，检查 TOKEN_RESPONSE_REQUESTED 之后是否有 DAMAGE_DEALT
            const eventsAfterTokenRequest = eventsAfterRequest.slice(tokenRequestIndex + 1);
            const hasDamageAfterRequest = eventsAfterTokenRequest.some(
                (e: any) => e.event.type === 'DAMAGE_DEALT'
            );

            expect(hasDamageAfterRequest, 
                'Should NOT have DAMAGE_DEALT after TOKEN_RESPONSE_REQUESTED (before response closed)'
            ).toBe(false);

            console.log('✅ 验证通过：TOKEN_RESPONSE_REQUESTED 之后没有 DAMAGE_DEALT 事件');
        }

        // === 防御方跳过 Token 响应 ===
        // 查找跳过按钮（可能是"跳过"或"Skip"）
        const skipButton = page2.locator('button').filter({ 
            hasText: /跳过|Skip/i 
        }).first();
        
        if (await skipButton.isVisible({ timeout: 2000 })) {
            await skipButton.click();
            await page2.waitForTimeout(1500);
        }

        // === 验证 2：Token 响应关闭后，才应该有 DAMAGE_DEALT 事件 ===
        const eventsAfterClose = await readEventStream(page2);
        
        // 找到 TOKEN_RESPONSE_CLOSED 事件的位置
        const finalTokenCloseIndex = eventsAfterClose.findIndex(
            (e: any) => e.event.type === 'TOKEN_RESPONSE_CLOSED'
        );
        
        if (finalTokenCloseIndex >= 0) {
            // 检查 TOKEN_RESPONSE_CLOSED 之后是否有 DAMAGE_DEALT
            const eventsAfterTokenClose = eventsAfterClose.slice(finalTokenCloseIndex + 1);
            const damageEvent = eventsAfterTokenClose.find(
                (e: any) => e.event.type === 'DAMAGE_DEALT'
            );

            expect(damageEvent, 
                'Should have DAMAGE_DEALT after TOKEN_RESPONSE_CLOSED'
            ).toBeTruthy();

            console.log('✅ 验证通过：TOKEN_RESPONSE_CLOSED 之后才有 DAMAGE_DEALT 事件');
        }

        // === 验证 3：伤害应该正确应用 ===
        const finalState = await readCoreState(page2);
        const defenderHp = finalState.players['1'].resources.hp;
        
        // 防御方应该受到伤害（HP 减少）
        expect(defenderHp, 'Defender should take damage').toBeLessThan(50);

        console.log(`✅ 验证通过：防御方 HP 从 50 降到 ${defenderHp}`);
    });

    test('事件流顺序验证：完整的 Token 响应流程', async ({ 
        createDiceThroneMatch, 
        page1, 
        page2 
    }) => {
        // 创建对局
        await createDiceThroneMatch({
            player1Character: 'barbarian',
            player2Character: 'moon_elf',
        });

        await Promise.all([
            waitForPhase(page1, 'offensiveRoll'),
            waitForPhase(page2, 'offensiveRoll'),
        ]);

        // 给防御方添加闪避 Token
        const initialState = await readCoreState(page1);
        initialState.players['1'].tokens = { evasive: 2 };
        await applyCoreStateDirect(page1, initialState);
        await page1.waitForTimeout(500);

        // 攻击方发起攻击
        await rollDice(page1);
        await page1.waitForTimeout(500);
        await confirmRoll(page1);
        await page1.waitForTimeout(500);
        await selectAbility(page1, 'smash');
        await page1.waitForTimeout(500);
        await advancePhase(page1);

        // 防御方投骰
        await Promise.all([
            waitForPhase(page1, 'defensiveRoll'),
            waitForPhase(page2, 'defensiveRoll'),
        ]);
        await rollDice(page2);
        await page2.waitForTimeout(500);
        await confirmRoll(page2);
        await page2.waitForTimeout(500);

        // 推进到 Token 响应
        await advancePhase(page2);
        await page2.waitForTimeout(1500);

        // 跳过 Token 响应
        const skipButton = page2.locator('button').filter({ 
            hasText: /跳过|Skip/i 
        }).first();
        
        if (await skipButton.isVisible({ timeout: 2000 })) {
            await skipButton.click();
            await page2.waitForTimeout(1500);
        }

        // 验证完整的事件流顺序
        const allEvents = await readEventStream(page2);
        const eventTypes = allEvents.map((e: any) => e.event.type);

        // 找到关键事件的位置
        const tokenRequestIdx = eventTypes.indexOf('TOKEN_RESPONSE_REQUESTED');
        const tokenCloseIdx = eventTypes.indexOf('TOKEN_RESPONSE_CLOSED');
        const damageIdx = eventTypes.lastIndexOf('DAMAGE_DEALT');

        console.log('事件流顺序：');
        console.log(`  TOKEN_RESPONSE_REQUESTED: ${tokenRequestIdx}`);
        console.log(`  TOKEN_RESPONSE_CLOSED: ${tokenCloseIdx}`);
        console.log(`  DAMAGE_DEALT (最后一个): ${damageIdx}`);

        // 验证顺序：TOKEN_RESPONSE_REQUESTED < TOKEN_RESPONSE_CLOSED < DAMAGE_DEALT
        expect(tokenRequestIdx, 'Should have TOKEN_RESPONSE_REQUESTED').toBeGreaterThanOrEqual(0);
        expect(tokenCloseIdx, 'Should have TOKEN_RESPONSE_CLOSED').toBeGreaterThan(tokenRequestIdx);
        expect(damageIdx, 'Should have DAMAGE_DEALT after TOKEN_RESPONSE_CLOSED').toBeGreaterThan(tokenCloseIdx);

        console.log('✅ 验证通过：事件流顺序正确');
    });
});
