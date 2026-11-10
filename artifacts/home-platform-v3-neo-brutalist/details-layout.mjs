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
      counts:[...root.querySelectorAll('.details-facts .player-count')].map(el=>({value:el.textContent,best:el.classList.contains('is-best'),interactive:el.tagName==='BUTTON'||el.hasAttribute('data-create-seats')||el.getAttribute('role')==='button'})),
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
  assert.ok(facts.author.inActions&&facts.author.shadow==='none'&&facts.author.border==='0px','作者未以轻量署名放到按钮右侧');
  assert.ok(facts.author.width<220&&facts.author.height>=44,'作者入口不应占满一行或失去触控区域');
  const nextTo=facts.narrow?facts.primary:facts.secondary;
  assert.ok(facts.author.left-nextTo.right>=16&&Math.abs((facts.author.top+facts.author.bottom-nextTo.top-nextTo.bottom)/2)<=2,'作者没有放在按钮右侧同一行');
  assert.deepEqual(facts.counts.map(c=>c.value),['2','3','4'],'人数数字格遗漏可支持人数');
  assert.deepEqual(facts.counts.filter(c=>c.best).map(c=>c.value),['3'],'推荐人数未突出');
  assert.ok(facts.counts.every(c=>!c.interactive),'只读人数被实现成选择操作');
  assert.ok(facts.players.includes('推荐'),'人数语义丢失');
}

export async function assertDetailsLobby(page) {
  const facts=await page.locator('[data-testid="game-details-modal-root"]').evaluate(root=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};
    const modal=rect(root),main=rect(root.querySelector('.details-main')),body=rect(root.querySelector('.tab-body'));
    const rooms=[...root.querySelectorAll('.room-row')].map(rect);
    const ceiling=Math.min(body.bottom,innerHeight);
    return {modal,main,body,rooms,complete:rooms.filter(r=>r.top>=body.top-1&&r.bottom<=ceiling+1).length};
  });
  console.log('detailsLobby',facts);
  assert.ok(facts.main.height>=facts.modal.height*.55,'资料头部挤占大厅，大厅未获得主要展示空间');
  assert.equal(facts.rooms.length,4,'没有进入四房间的目标大厅状态');
  assert.equal(facts.complete,4,'默认首屏不能完整浏览当前四间房');
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
