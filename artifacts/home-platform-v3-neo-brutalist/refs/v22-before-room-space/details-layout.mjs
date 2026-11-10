import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

export async function assertDetailsActions(page) {
  const facts=await page.locator('[data-testid="game-details-modal-root"]').evaluate(root=>{
    const box=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height}};
    const primary=root.querySelector('.details-primary'), secondary=root.querySelector('.details-secondary');
    const author=root.querySelector('.author-btn');
    const buttons=[...(secondary?.querySelectorAll('button')||[])];
    return {narrow:innerWidth<=1023,primary:box(primary),secondary:box(secondary),
      buttons:buttons.map(el=>({...box(el),text:el.textContent.trim(),clipped:el.scrollWidth>el.clientWidth+1})),
      author:{...box(author),inActions:Boolean(author?.closest('.details-cta')),shadow:author?getComputedStyle(author).boxShadow:'',border:author?getComputedStyle(author).borderWidth:''},
      fakeSelectors:root.querySelectorAll('.details-facts .player-sq').length,
      players:root.querySelector('[data-testid="game-details-player-recommendation"]')?.textContent,
    };
  });
  console.log('detailsActions',facts);
  assert.ok(facts.primary&&facts.secondary,'主操作和辅助操作没有独立承载');
  const separation=facts.narrow?facts.secondary.top-facts.primary.bottom:facts.secondary.left-facts.primary.right;
  assert.ok(separation>=20,`主辅操作没有清楚间距：${separation}`);
  assert.equal(facts.buttons.length,3,'教程、收藏、配置入口缺失');
  const top=facts.buttons[0].top;
  for(let i=0;i<facts.buttons.length;i++){
    const b=facts.buttons[i];
    assert.ok(Math.abs(b.top-top)<=1,'辅助操作排成零散多行');
    assert.ok(b.height>=44&&!b.clipped,'触控区不足或按钮文字裁切');
    if(i)assert.ok(b.left-facts.buttons[i-1].right>=16,'辅助操作按钮挤在一起');
  }
  assert.ok(!facts.author.inActions&&facts.author.shadow==='none'&&facts.author.border==='0px','作者仍冒充同级重按钮');
  assert.ok(facts.author.width<220&&facts.author.height>=44,'作者入口不应占满一行或失去触控区域');
  assert.equal(facts.fakeSelectors,0,'只读人数仍伪装为选择按钮');
  assert.ok(facts.players.includes('推荐'),'人数语义丢失');
}

export async function openDetailsForCheck(page,width=375) {
  await page.goto(process.env.HOME_V3_ORIGIN||'http://127.0.0.1:7788/index.html',{waitUntil:'domcontentloaded'});
  await page.locator(width<=1023?'[data-testid="bottom-nav"] [data-view="discover"]':'.chrome [data-view="discover"]').click();
  await page.locator('.tile[data-game="smashup"]').click();
  if(width<=1023)await page.locator('.tile[data-game="smashup"]').click();
  await page.waitForSelector('[data-testid="game-details-modal-root"]');
  await assertDetailsActions(page);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});await openDetailsForCheck(page);}finally{await browser.close();}
}
