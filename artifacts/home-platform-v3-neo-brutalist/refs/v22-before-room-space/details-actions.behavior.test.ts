import {describe,it} from 'vitest';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {openDetailsForCheck,assertDetailsActions} from './details-layout.mjs';

describe.each([375,1920])('详情操作区 %i',width=>{
  it('主辅分组且入口仍可用，署名和只读人数不再冒充按钮',async()=>{
    const browser=await chromium.launch({headless:true});
    try{
      const page=await browser.newPage({viewport:{width,height:width===375?812:1080},isMobile:width===375,hasTouch:width===375});
      await openDetailsForCheck(page,width);
      const fav=page.locator('[data-testid="game-details-fav"]');
      await fav.click();assert.equal(await fav.textContent(),'添加收藏');
      await fav.click();assert.equal(await fav.textContent(),'移出收藏');
      await page.locator('.details-secondary [data-tutorial]').click();
      assert.equal(await page.locator('#toast').textContent(),'打开教程模式');
      await page.locator('.details-secondary [data-config]').click();
      assert.equal(await page.locator('#toast').textContent(),'打开配置表');
      await page.locator('.author-btn').click();
      assert.ok(await page.locator('#author').isVisible());
      await page.locator('[data-close="author"]').click();
      assert.ok(await page.locator('[data-testid="game-details-modal-root"]').isVisible());
      assert.ok(await page.locator('.room-row').filter({hasText:'4/4'}).getByRole('button',{name:'已满',exact:true}).isDisabled());
      await assertDetailsActions(page);
      await page.locator('[data-testid="game-details-close-button"]').click();
      assert.ok(await page.locator('#details').isHidden());
    }finally{await browser.close();}
  },30000);
});
