import {describe,it} from 'vitest';
import {chromium} from 'playwright';
import {captureLibraryTasks} from './library-tasks.mjs';

describe('移动收藏库的找游戏主任务',()=>{
  it('首屏可见全部演示收藏，搜索可恢复，单击进入且返回保留位置',async()=>{
    const browser=await chromium.launch({headless:true});
    try {
      const page=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
      await page.goto(process.env.HOME_V3_ORIGIN || 'http://127.0.0.1:7788/index.html',{waitUntil:'domcontentloaded'});
      await captureLibraryTasks(page,async()=>{});
    } finally {await browser.close();}
  },30000);
});
