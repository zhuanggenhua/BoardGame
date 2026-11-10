import { test,expect,initHome,capture,record } from './helpers/homeAcceptance';

test('手机反馈原始点按与完整触控滚动后关闭',async({browser},info)=>{
    info.setTimeout(60_000);
    const context=await browser.newContext({baseURL:info.project.use.baseURL,viewport:{width:375,height:812},isMobile:true,hasTouch:true});
    try{
        const page=await context.newPage();
        await initHome(page);
        const attachment=(await page.screenshot({scale:'css'})).toString('base64');
        const fab=page.getByTestId('fab-menu');
        await fab.locator('button').first().tap();
        const feedback=page.locator('[data-platform-dialog="feedback"]');
        await fab.locator('[data-fab-id="feedback"]').tap();
        await expect(feedback).toBeVisible({timeout:20_000});
        await expect(page.getByTestId('feedback-image-preview')).toHaveCount(0);
        await feedback.locator('.platform-dialog-close').tap();
        await expect(feedback).toHaveCount(0);
        await fab.locator('button').first().tap();
        await fab.locator('[data-fab-id="feedback"]').tap();
        await expect(feedback).toBeVisible({timeout:20_000});
        await expect(page.getByTestId('feedback-image-preview')).toHaveCount(0);
        const pasteImage=()=>feedback.locator('textarea').evaluate((node,base64)=>{
            const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
            const clipboardData=new DataTransfer();
            clipboardData.items.add(new File([bytes],'反馈附件.png',{type:'image/png'}));
            node.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));
        },attachment);
        await pasteImage();
        const preview=page.getByTestId('feedback-image-preview');
        await expect(preview).toBeVisible();
        const remove=preview.getByRole('button',{name:'删除图片'});
        await expect(remove).toHaveCSS('opacity','1');
        const removeBox=await remove.boundingBox();
        expect(removeBox!.width).toBeGreaterThanOrEqual(44);
        expect(removeBox!.height).toBeGreaterThanOrEqual(44);
        await capture(page,'手机-反馈附图删除');
        await remove.tap();
        await expect(preview).toHaveCount(0);
        await pasteImage();
        await expect(preview).toBeVisible();
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
        await record('手机反馈受控触控',{initialTapClosed:true,attachmentRemoved:true,touchScrollCompleted:true,afterScrollTapClosed:true});
    }finally{await context.close();}
});
