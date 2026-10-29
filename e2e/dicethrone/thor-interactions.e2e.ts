import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { waitForTestHarness } from '../helpers/common';
import { dragDiceThroneHandCardToPlay, closeDebugPanelIfOpen } from '../helpers/dicethrone';
import { expectDiceHintSurface, shot } from '../helpers/dicethroneThorEvidence';

test('索尔正式素材、弃牌飞掷与奥丁整组重掷',async({page,game},info)=>{
 test.setTimeout(240000); await clearEvidenceScreenshotsForTest(info);
 page.on('pageerror',error=>console.error('Thor page error:',error.message));
 await page.setViewportSize({width:1920,height:1080});
 await game.openTestGame('dicethrone',{playerID:'0',seat1:'human'},180000);
 await waitForTestHarness(page,40000);
 await game.setupScene({gameId:'dicethrone',randomQueue:[1,1,4,4,4,1,1,4,4,6,6,6].map(value=>(value-0.5)/6),player0:{hand:['upgrade-thor-odinforce-2','card-thor-worthy','card-thor-thunderous','card-thor-hammer-time'],resources:{cp:10,hp:50}},player1:{hand:[],resources:{cp:2,hp:50}},currentPlayer:'0',phase:'main1',extra:{selectedCharacters:{'0':'thor','1':'monk'},hostStarted:true,pendingAttack:null,pendingDamage:undefined,rollCount:0,rollConfirmed:false,dice:[]}});
 await closeDebugPanelIfOpen(page);
 await expect(page.getByTestId('player-board-surface')).toHaveAttribute('data-character-id','thor');
 await expect(page.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4);
 await expect.poll(async()=>page.locator('[data-card-id="card-thor-worthy"] [data-card-atlas-img="true"]').evaluate((img:HTMLImageElement)=>{
  const src=img.currentSrc ? new URL(img.currentSrc).pathname : '';
  return img.complete&&img.naturalWidth>0&&img.naturalHeight>0&&src.includes('/dicethrone/images/thor/');
 })).toBe(true);
 await expect(page.locator('[data-testid="hand-area"] [data-is-flipped="true"]')).toHaveCount(4);
 await expect(page.locator('[data-testid="hand-area"] .atlas-shimmer')).toHaveCount(0);
 await page.mouse.move(15,15);await page.waitForTimeout(650);
 await shot(page,info,'01-索尔正式角色板与卡牌');
 await page.getByTestId('passive-action-thor-mjolnir-0').click();
  const discardHint=page.getByTestId('dicethrone-hand-discard-hint');
  const discardOverlay=page.getByTestId('dt-card-pool-overlay');
  await expect(discardHint).toBeVisible();
  await expect(discardHint).toContainText('选择 1 张手牌弃置');
  await expect(page.locator('[data-testid="hand-area"] [data-testid="hand-card-visual"]')).toHaveCount(4);
  await expect(page.getByTestId('dicethrone-hand-discard-cancel')).toHaveText('取消');
  await expect(discardOverlay).toBeHidden();
 await shot(page,info,'02-弃牌飞掷选择成本');
  await page.getByTestId('dicethrone-hand-discard-cancel').click();
  await expect(discardHint).toHaveCount(0);
  await expect.poll(async()=>{const s=await game.getState();return {cp:s.core.players['0'].resources.cp,hand:s.core.players['0'].hand.length,holder:s.core.players['0'].tokens.mjolnir};}).toEqual({cp:10,hand:4,holder:1});
  await shot(page,info,'03-取消弃牌支付且资源未扣');
  await page.getByTestId('passive-action-thor-mjolnir-0').click();
  await expect(discardHint).toBeVisible();
  await page.locator('[data-testid="hand-area"] [data-card-id="card-thor-thunderous"]').click();
 await expect.poll(async()=>{const s=await game.getState();return {hp:s.core.players['1'].resources.hp,holder:s.core.players['1'].tokens.mjolnir,count:s.core.mjolnirThrowsThisTurn?.['0']};}).toEqual({hp:49,holder:1,count:1});
  await expect(page.locator('[data-testid="hand-area"] [data-card-id="card-thor-thunderous"]')).toHaveCount(0);
  await expect(page.getByText('飞掷或召回姆乔尔尼尔',{exact:true})).toHaveCount(0);
 await shot(page,info,'04-手牌区弃置成本后飞掷结算');
 await dragDiceThroneHandCardToPlay(page,'upgrade-thor-odinforce-2');
 await expect.poll(async()=>(await game.getState()).core.players['0'].abilityLevels['thor-odinforce']).toBe(2);
 await shot(page,info,'05-奥丁之力二级升级完成');
 await page.locator('[data-tutorial-id="advance-phase-button"]').click();
 await page.locator('[data-tutorial-id="dice-roll-button"]').click();
 await expect.poll(async()=>(await game.getState()).core.currentRollContext?.dice.map((die:{value:number})=>die.value)).toEqual([1,1,4,4,4]);
 await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
 const sky=page.locator('[data-ability-slot="sky"][data-can-click="true"]').first();
 await expect(sky).toBeVisible({timeout:10000});
 await sky.click();
 await page.locator('[data-tutorial-id="advance-phase-button"]').click();
 await expect(page.locator('[data-tutorial-id="dice-roll-button"]')).toHaveCount(0);
 await expect(page.getByTestId('dice-interaction-hint')).toHaveText('选择要一起重掷的骰子，或确认保留当前结果');
 await expectDiceHintSurface(page,'dice-tray');
 await expect(page.locator('[data-testid^="die-button-"]')).toHaveCount(5);
 await expect(page.getByTestId('dice-reroll-selected-group')).toHaveCount(0);
 await expect(page.getByTestId('dice-bonus-settlement-confirm-button')).toHaveText('确认');
 await shot(page,info,'06-奥丁效果骰等待选择重掷骰子');
 await page.getByTestId('die-button-0').click(); await page.getByTestId('die-button-2').click();
 await expect(page.getByTestId('die-button-0')).toHaveAttribute('data-selected','true');
 await expect(page.getByTestId('die-button-2')).toHaveAttribute('data-selected','true');
 const rerollSelected = page.getByTestId('dice-reroll-selected-group');
 const settleBonusDice = page.getByTestId('dice-bonus-settlement-confirm-button');
 await expect(rerollSelected).toBeVisible();
 await expect(rerollSelected).toHaveAttribute('data-tutorial-id','dice-reroll-selected-group');
 await expect(rerollSelected).toHaveText('重掷');
 await expect(rerollSelected).toHaveAttribute('aria-label','重掷所选（2）');
 await expect(page.getByText('重置所选',{exact:true})).toHaveCount(0);
 await expect(settleBonusDice).toHaveText('确认');
 await expect(settleBonusDice).toHaveAttribute('data-tutorial-id','dice-confirm-button');
 await expect(page.getByTestId('dice-interaction-hint')).toHaveText('已选择2颗骰子，点击重掷；也可确认保留当前结果');
 await expectDiceHintSurface(page,'dice-tray');
 await shot(page,info,'07-使用原整组重掷动作提交两颗所选骰子');
 await rerollSelected.click();
 await expect.poll(async()=>(await game.getState()).core.pendingBonusDiceSettlement?.rerollCount).toBe(1);
 await expect.poll(async()=>(await game.getState()).core.pendingBonusDiceSettlement?.dice.filter((die:{index:number})=>die.index===0||die.index===2).map((die:{value:number})=>die.value)).toEqual([6,6]);
 await expect(page.getByTestId('die-button-0')).toHaveAttribute('data-selected','false');
 await expect(page.getByTestId('die-button-2')).toHaveAttribute('data-selected','false');
 await expect(page.getByTestId('dice-reroll-selected-group')).toHaveCount(0);
 await expect(settleBonusDice).toBeVisible();
 await shot(page,info,'08-整组重掷一次完成并保留原确认收口');
 await settleBonusDice.click();
 // 效果骰可能触发一次召回选择，只有玩家明确确认后才结束。
 const retrieve=page.locator('[data-option-id="option-0"]');
 if(await retrieve.isVisible({timeout:1500}).catch(()=>false)) await retrieve.click();
 const skip=page.getByText('跳过',{exact:true});
 if(await skip.isVisible({timeout:1000}).catch(()=>false)) await skip.click();
 await expect.poll(async()=>(await game.getState()).sys.phase).toBe('defensiveRoll');
 await shot(page,info,'09-效果骰收口后进入主攻击防御');
});

test('索尔奥丁之力II可用原确认入口跳过额外重掷', async ({ page, game }, info) => {
 test.setTimeout(120000);
 await clearEvidenceScreenshotsForTest(info);
 await page.setViewportSize({ width: 1920, height: 1080 });
 await game.openTestGame('dicethrone', { playerID: '0', seat1: 'human' }, 60000);
 await waitForTestHarness(page, 20000);
 await game.setupScene({
  gameId: 'dicethrone',
  randomQueue: [1, 1, 4, 4, 4, 1, 1, 4, 4, 6, 6, 6].map(value => (value - 0.5) / 6),
  player0: { hand: ['upgrade-thor-odinforce-2'], resources: { cp: 10, hp: 50 } },
  player1: { hand: [], resources: { cp: 2, hp: 50 } },
  currentPlayer: '0',
  phase: 'main1',
  extra: {
   selectedCharacters: { '0': 'thor', '1': 'monk' },
   hostStarted: true,
   pendingAttack: null,
   pendingDamage: undefined,
   rollCount: 0,
   rollConfirmed: false,
   dice: [],
  },
 });
 await closeDebugPanelIfOpen(page);
 await dragDiceThroneHandCardToPlay(page, 'upgrade-thor-odinforce-2');
 await expect.poll(async () => (await game.getState()).core.players['0'].abilityLevels['thor-odinforce']).toBe(2);
 await page.locator('[data-tutorial-id="advance-phase-button"]').click();
 await page.locator('[data-tutorial-id="dice-roll-button"]').click();
 await expect.poll(async () => (await game.getState()).core.currentRollContext?.dice.map((die: { value: number }) => die.value)).toEqual([1, 1, 4, 4, 4]);
 await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
 await page.locator('[data-ability-slot="sky"][data-can-click="true"]').first().click();
 await page.locator('[data-tutorial-id="advance-phase-button"]').click();

 const confirm = page.getByTestId('dice-bonus-settlement-confirm-button');
 await expect(page.getByTestId('dice-interaction-hint')).toContainText('选择要一起重掷的骰子');
 await expectDiceHintSurface(page,'dice-tray');
 await expect(page.getByTestId('die-button-0')).toHaveAttribute('data-selected', 'false');
 await expect(confirm).toHaveText('确认');
 await shot(page, info, '01-奥丁效果骰空选时沿用原确认入口');
 await confirm.click();

 const retrieve = page.locator('[data-option-id="option-0"]');
 if (await retrieve.isVisible({ timeout: 1500 }).catch(() => false)) await retrieve.click();
 const skip = page.getByText('跳过', { exact: true });
 if (await skip.isVisible({ timeout: 1000 }).catch(() => false)) await skip.click();
 await expect.poll(async () => (await game.getState()).core.pendingBonusDiceSettlement).toBeUndefined();
 await expect.poll(async () => (await game.getState()).sys.phase).toBe('defensiveRoll');
 await shot(page, info, '02-空选确认后直接收口且进入防御投掷');
});

test('索尔手牌可完整放大并通过当之无愧选择自己的骰子',async({page,game},info)=>{
 test.setTimeout(120000);await clearEvidenceScreenshotsForTest(info);await page.setViewportSize({width:1920,height:1080});
 await game.openTestGame('dicethrone',{playerID:'0',seat1:'human'},60000);await waitForTestHarness(page,20000);
 await game.setupScene({gameId:'dicethrone',randomQueue:[0.08,0.08,0.08,0.08,0.08],player0:{hand:['card-thor-worthy','card-thor-hammer-time'],resources:{cp:5,hp:50}},player1:{hand:[],resources:{cp:2,hp:50}},currentPlayer:'0',phase:'main1',extra:{selectedCharacters:{'0':'thor','1':'monk'},hostStarted:true,pendingAttack:null,pendingDamage:undefined,dice:[],rollCount:0,rollConfirmed:false}});
 await closeDebugPanelIfOpen(page);
 const card=page.locator('[data-testid="hand-area"] [data-card-id="card-thor-hammer-time"]');
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
 const cardPoint=await card.evaluate(node=>{
  const rect=node.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height*.45;
  return {x,y,hit:document.elementFromPoint(x,y)?.closest('[data-card-id]')?.getAttribute('data-card-id')};
 });
 expect(cardPoint.hit).toBe('card-thor-hammer-time');
 await page.mouse.move(cardPoint.x,cardPoint.y);await page.mouse.click(cardPoint.x,cardPoint.y);
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
 await expect(page.getByTestId('board-magnify-overlay')).toBeVisible();
 await expect(page.getByTestId('board-magnify-overlay').locator('.atlas-shimmer')).toHaveCount(0);
 await shot(page,info,'01-手牌放大完整阅读挥锤时刻');
 await page.getByTestId('board-magnify-overlay-close').click();
 await page.locator('[data-tutorial-id="advance-phase-button"]').click();await page.locator('[data-tutorial-id="dice-roll-button"]').click();
 await expect.poll(async()=>(await game.getState()).core.rollCount).toBe(1);
 await shot(page,info,'02-改骰前自己的五颗骰子');
 await dragDiceThroneHandCardToPlay(page,'card-thor-worthy');
 await expect(page.getByText('选择骰子点数',{exact:true})).toHaveCount(0);
 await expect(page.getByTestId('dice-interaction-hint')).toContainText('选择目标点数');
 await expectDiceHintSurface(page,'viewport');
 await expect(page.getByTestId('die-target-value-4')).toBeVisible();
 await expect(page.getByTestId('die-target-value-5')).toBeVisible();
 await expect(page.locator('[data-testid^="die-adjust-"]')).toHaveCount(0);
 await shot(page,info,'03-当之无愧直接选择固定目标四或五');
 await expect.poll(async()=>(await game.getState()).core.currentRollContext?.dice.map((die:{value:number})=>die.value)).toEqual([1,1,1,1,1]);
 await page.getByTestId('die-target-value-4').click();
 await expect(page.getByTestId('dice-interaction-hint')).toContainText('选择要设为4的骰子');
 await expectDiceHintSurface(page,'viewport');
 await expect(page.getByTestId('die-button-0')).toHaveAttribute('data-display-value','1');
 await shot(page,info,'04-选择四后沿原固定值流程点选骰子');
 await page.getByTestId('die-button-0').click();
 await expect.poll(async()=>(await game.getState()).core.currentRollContext?.dice.map((die:{value:number})=>die.value)).toEqual([4,1,1,1,1]);
 await shot(page,info,'05-改为四且其余骰子保持');
});

test('索尔当之无愧选择五后取消不提交改骰',async({page,game},info)=>{
 test.setTimeout(120000);await clearEvidenceScreenshotsForTest(info);await page.setViewportSize({width:1920,height:1080});
 await game.openTestGame('dicethrone',{playerID:'0',seat1:'human'},60000);await waitForTestHarness(page,20000);
 await game.setupScene({gameId:'dicethrone',randomQueue:[0.08,0.08,0.08,0.08,0.08],player0:{hand:['card-thor-worthy'],resources:{cp:5,hp:50}},player1:{hand:[],resources:{cp:2,hp:50}},currentPlayer:'0',phase:'main1',extra:{selectedCharacters:{'0':'thor','1':'monk'},hostStarted:true,pendingAttack:null,pendingDamage:undefined,dice:[],rollCount:0,rollConfirmed:false}});
 await closeDebugPanelIfOpen(page);await page.locator('[data-tutorial-id="advance-phase-button"]').click();await page.locator('[data-tutorial-id="dice-roll-button"]').click();
 await expect.poll(async()=>(await game.getState()).core.currentRollContext?.dice.map((die:{value:number})=>die.value)).toEqual([1,1,1,1,1]);
 await dragDiceThroneHandCardToPlay(page,'card-thor-worthy');
 await page.getByTestId('die-target-value-5').click();
 await expect(page.getByTestId('dice-interaction-hint')).toContainText('选择要设为5的骰子');
 await expectDiceHintSurface(page,'viewport');
 await expect(page.getByTestId('die-button-0')).toHaveAttribute('data-display-value','1');await shot(page,info,'01-当之无愧取消前选择五但尚未改骰');
 const cancel=page.getByRole('button',{name:'取消',exact:true});await expect(cancel).toBeVisible();await cancel.click();
 await expect.poll(async()=>{const state=await game.getState();return {values:state.core.currentRollContext?.dice.map((die:{value:number})=>die.value),interaction:state.sys.interaction?.current?.kind??null,cp:state.core.players['0'].resources.cp,hand:state.core.players['0'].hand.map((card:{id:string})=>card.id),discard:state.core.players['0'].discard.map((card:{id:string})=>card.id)};}).toEqual({values:[1,1,1,1,1],interaction:null,cp:5,hand:['card-thor-worthy'],discard:[]});
 await shot(page,info,'02-取消改骰后骰面保持且卡牌资源退回');
 await dragDiceThroneHandCardToPlay(page,'card-thor-worthy');
 await page.getByTestId('die-target-value-5').click();
 await expect(page.getByTestId('dice-interaction-hint')).toContainText('选择要设为5的骰子');
 await page.getByTestId('die-button-1').click();
 await expect.poll(async()=>(await game.getState()).core.currentRollContext?.dice.map((die:{value:number})=>die.value)).toEqual([1,5,1,1,1]);
 await shot(page,info,'03-重新出牌选择五后原固定流程完成改骰');
});

test('索尔连锁闪电选择效果骰并自动结算唯一附属目标',async({page,game},info)=>{
 test.setTimeout(120000);await clearEvidenceScreenshotsForTest(info);
 await page.setViewportSize({width:1920,height:1080});
 await game.openTestGame('dicethrone',{playerID:'0',seat1:'human'},60000);
 await waitForTestHarness(page,20000);
 await expect(page.getByTestId('character-badge-thor-implementation_in_progress')).toHaveCount(1);
 await game.setupScene({gameId:'dicethrone',randomQueue:[1,1,1,6,6,1,4,6].map(value=>(value-.5)/6),player0:{hand:[],resources:{cp:2,hp:50}},player1:{hand:[],resources:{cp:2,hp:50}},currentPlayer:'0',phase:'main1',extra:{selectedCharacters:{'0':'thor','1':'monk'},hostStarted:true,dice:[],rollCount:0,rollConfirmed:false,pendingAttack:null,pendingDamage:undefined}});
 await closeDebugPanelIfOpen(page);
 await page.locator('[data-tutorial-id="advance-phase-button"]').click();
 await page.locator('[data-tutorial-id="dice-roll-button"]').click();
 await expect.poll(async()=>(await game.getState()).core.currentRollContext?.dice.map((die:{value:number})=>die.value)).toEqual([1,1,1,6,6]);
 await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
 await shot(page,info,'01-连锁闪电触发前');
 await page.locator('[data-ability-slot="lotus"][data-can-click="true"]').first().click();
 await page.locator('[data-tutorial-id="advance-phase-button"]').click();
 await expect.poll(async()=>(await game.getState()).core.pendingBonusDiceSettlement?.dice.length).toBe(3);
 await shot(page,info,'02-三颗效果骰等待确认');
 await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
 await expect(page.getByText('选择两颗效果骰',{exact:true})).toBeVisible();
  await shot(page,info,'03-选择两颗效果骰组合');
 await page.locator('[data-option-id="option-2"]').click();
 await expect.poll(async()=>{const s=await game.getState();return {hp:s.core.players['1'].resources.hp,bonus:s.core.pendingAttack?.bonusDamage,phase:s.sys.phase};}).toEqual({hp:48,bonus:10,phase:'defensiveRoll'});
  await expect(page.getByText('选择附属伤害目标',{exact:true})).toHaveCount(0);
  await shot(page,info,'04-附属伤害自动命中唯一对手并保留主攻击');
});


test('索尔破防连续消费失败后仍可再次使用',async({page,game},info)=>{
 test.setTimeout(120000);await clearEvidenceScreenshotsForTest(info);await page.setViewportSize({width:1920,height:1080});
 await game.openTestGame('dicethrone',{playerID:'0',seat1:'human'},60000);await waitForTestHarness(page,20000);
 await game.setupScene({gameId:'dicethrone',randomQueue:[6,6,6,6,1,1,4].map(value=>(value-.5)/6),player0:{hand:[],resources:{cp:2,hp:50}},player1:{hand:[],resources:{cp:2,hp:50}},currentPlayer:'0',phase:'main1',extra:{selectedCharacters:{'0':'thor','1':'monk'},hostStarted:true,pendingAttack:null,pendingDamage:undefined,dice:[],rollCount:0,rollConfirmed:false}});
 await closeDebugPanelIfOpen(page);
 await page.locator('[data-tutorial-id="advance-phase-button"]').click();await page.locator('[data-tutorial-id="dice-roll-button"]').click();
 await expect.poll(async()=>(await game.getState()).core.currentRollContext?.dice.map((die:{value:number})=>die.value)).toEqual([6,6,6,6,1]);
 await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
 await page.locator('[data-ability-slot="lightning"][data-can-click="true"]').first().click();await page.locator('[data-tutorial-id="advance-phase-button"]').click();
 await page.locator('[data-choice-custom-id="thor-mjolnir-move"]').filter({hasText:'停止'}).click();
 const guard=page.getByRole('button',{name:'破防',exact:true});await expect(guard).toBeVisible();
 await shot(page,info,'01-破防正式图标与消费入口');await guard.click();
 await expect.poll(async()=>(await game.getState()).core.pendingBonusDiceSettlement?.dice[0].value).toBe(1);
 await shot(page,info,'02-第一枚破防效果骰失败');await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
 await expect(guard).toBeVisible();await shot(page,info,'03-失败后仍可使用第二枚破防');await guard.click();
 await expect.poll(async()=>(await game.getState()).core.pendingBonusDiceSettlement?.dice[0].value).toBe(4);
 await shot(page,info,'04-第二枚破防效果骰成功');await page.locator('[data-tutorial-id="dice-confirm-button"]').click();
 await expect.poll(async()=>{const s=await game.getState();return {hp:s.core.players['1'].resources.hp,guard:s.core.players['0'].tokens.guard_break,phase:s.sys.phase};}).toEqual({hp:43,guard:0,phase:'main2'});
 await shot(page,info,'05-不可防御主攻击结算后收口');
});
