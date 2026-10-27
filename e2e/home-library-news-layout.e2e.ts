import mongoose,{Types} from 'mongoose';
import { test,expect,initHome,login,capture,record,runId } from './helpers/homeAcceptance';

for(const view of [{name:'桌面',width:1920,height:1080,mobile:false,capture:true},{name:'手机',width:375,height:812,mobile:true,capture:true},{name:'桌面短窗压力',width:1280,height:480,mobile:false,capture:false}]){
    test(`${view.name}收藏动态展开与横向浏览没有嵌套纵向滚动`,async({browser,accounts},info)=>{
        info.setTimeout(70_000);
        const uri=process.env.MONGO_URI;
        if(uri!==`mongodb://127.0.0.1:37022/boardgame_home_acceptance_${runId}`)throw Error('只允许本轮37022隔离数据库');
        const db=await mongoose.createConnection(uri).asPromise();
        const context=await browser.newContext({baseURL:info.project.use.baseURL,viewport:{width:view.width,height:view.height},hasTouch:view.mobile,isMobile:view.mobile});
        const created:Types.ObjectId[]=[];
        try{
            // 合法管理员身份是发布入口前置夹具，动态仍通过正式管理API创建。
            await db.collection('users').updateOne({_id:new Types.ObjectId(accounts.alice.id)},{$set:{role:'admin'}});
            const page=await context.newPage();await initHome(page);
            const auth=page.waitForResponse(r=>r.url().endsWith('/auth/login')&&r.request().method()==='POST');
            await login(page,accounts.alice);
            const token=(await (await auth).json()).data.token as string;
            const games=['dicethrone','smashup','summonerwars','splendor'];
            for(const gameId of games){
                const response=await context.request.post(new URL('/admin-api/game-changelogs',page.url()).href,{headers:{Authorization:`Bearer ${token}`},data:{gameId,title:'界面与操作体验优化',content:'改进游戏大厅的信息展示与返回操作。',published:true}});
                expect(response.status()).toBe(201);
                created.push(new Types.ObjectId((await response.json()).changelog.id));
            }
            for(const gameId of games){
                const library=await context.request.put(new URL('/auth/user-settings/library',page.url()).href,{headers:{Authorization:`Bearer ${token}`},data:{gameId,favorite:true}});
                expect(library.status()).toBe(200);
            }
            await page.reload();
            await page.getByRole('button',{name:'收藏库',exact:true}).click();
            if(view.mobile)await page.locator('.platform-library-news-toggle').tap();
            const news=page.locator('.platform-library-news');
            const order=await news.evaluate(node=>({newsBottom:node.getBoundingClientRect().bottom,headerTop:node.parentElement!.querySelector('.platform-catalog-header')!.getBoundingClientRect().top}));
            expect(order.newsBottom).toBeLessThanOrEqual(order.headerTop);
            await expect(news.locator('.platform-library-news-card')).toHaveCount(4);
            await news.scrollIntoViewIfNeeded();
            const metrics=await news.locator('.platform-library-news-body').evaluate(node=>({client:node.clientHeight,scroll:node.scrollHeight,overflow:getComputedStyle(node).overflowY}));
            expect(metrics.scroll).toBeLessThanOrEqual(metrics.client+1);
            expect(metrics.overflow).toBe('visible');
            const track=news.locator('.platform-library-news-track');
            const next=news.getByRole('button',{name:'下一条动态',exact:true});
            const overflows=await track.evaluate(node=>node.scrollWidth>node.clientWidth);
            if(overflows){
                if(view.mobile)await next.tap();else await next.click();
                await expect.poll(()=>track.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);
            }else expect(await track.evaluate(node=>node.scrollLeft)).toBe(0);
            if(view.capture)await capture(page,`重构-${view.name}-收藏动态展开`);
            await news.locator('.platform-library-news-card').nth(1).click();
            await expect(page.locator('.platform-news-dialog')).toBeVisible();
            await page.getByRole('button',{name:'关闭动态详情',exact:true}).click();
            await expect(page.locator('.platform-news-dialog')).toBeHidden();
            await record(`动态-${view.name}`,{metrics,publishedViaAdminApi:true,fixtureScope:'本轮隔离管理员与代表性动态，不代表生产发布',horizontalScroll:true,detailOpenClose:true});
        }finally{
            await context.close();
            await db.collection('gamechangelogs').deleteMany({_id:{$in:created}});
            await db.collection('users').updateOne({_id:new Types.ObjectId(accounts.alice.id)},{$set:{role:'user'}});
            await db.close();
        }
    });
}
