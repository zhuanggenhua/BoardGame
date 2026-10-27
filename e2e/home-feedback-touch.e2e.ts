import { test,expect,initHome,record } from './helpers/homeAcceptance';

test('手机反馈原始点按与完整触控滚动后关闭',async({browser},info)=>{
    info.setTimeout(60_000);
    const context=await browser.newContext({baseURL:info.project.use.baseURL,viewport:{width:375,height:812},isMobile:true,hasTouch:true});
    try{
        const page=await context.newPage();
        await initHome(page);
        const fab=page.getByTestId('fab-menu');
        await fab.locator('button').first().tap();
        const feedback=page.locator('[data-platform-dialog="feedback"]');
        await fab.locator('[data-fab-id="feedback"]').tap();
        await expect(page.getByTestId('feedback-image-preview')).toBeVisible({timeout:20_000});
        await feedback.locator('.platform-dialog-close').tap();
        await expect(feedback).toHaveCount(0);
        await fab.locator('[data-fab-id="feedback"]').tap();
        await expect(page.getByTestId('feedback-image-preview')).toBeVisible({timeout:20_000});
        const content=feedback.locator('div.overflow-y-auto').first();
        await expect.poll(()=>content.evaluate(node=>node.scrollHeight-node.clientHeight)).toBeGreaterThan(0);
        const box=(await content.boundingBox())!;
        const input=await context.newCDPSession(page);
        const x=box.x+12,start=box.y+box.height*.8,end=box.y+box.height*.25;
        const finger=(y:number)=>({id:1,x,y,radiusX:8,radiusY:8,force:1});
        await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(start)]});
        for(let step=1;step<=18;step++){
            await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(start+(end-start)*step/18)]});
            await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
        }
        // 控制住照片列表后再抬指，模拟不带惯性甩动的完整拖动手势。
        for(let frame=0;frame<10;frame++){
            await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(end)]});
            await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
        }
        await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        expect(await content.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
        const close=feedback.locator('.platform-dialog-close');
        expect(await close.evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
        await close.tap();
        await expect(feedback).toHaveCount(0);
        await record('手机反馈受控触控',{initialTapClosed:true,touchScrollCompleted:true,afterScrollTapClosed:true});
    }finally{await context.close();}
});
