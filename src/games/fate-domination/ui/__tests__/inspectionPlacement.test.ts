import { expect, it } from 'vitest';
import { placeFateInspection } from '../inspectionPlacement';
it('抽屉打开时放大牌避开已打出源牌', () => {
 const result=placeFateInspection({width:1366,height:768},[
  {left:410,top:291,width:304,height:214},{left:678,top:88,width:316,height:418},{left:1010,top:88,width:340,height:418},
 ]);
 expect(result.left+result.width).toBeLessThan(410);
});
it('窄屏不会沿用右侧固定槽而裁出视口', () => {
 const result=placeFateInspection({width:768,height:1024},[{left:78,top:88,width:316,height:418}]);
 expect(result.left).toBeGreaterThanOrEqual(16);
 expect(result.left+result.width).toBeLessThanOrEqual(752);
 expect(result.top+result.width*1.4+16).toBeLessThanOrEqual(1008);
});
it('窄横屏卡牌检视保持至少200px的完整牌面并留在视口内', () => {
 const viewport={width:936,height:432};
 const result=placeFateInspection(viewport,[]);
 expect(result.width).toBeGreaterThanOrEqual(200);
 expect(result.top).toBeGreaterThanOrEqual(16);
 expect(result.top+result.width*1.4+16).toBeLessThanOrEqual(viewport.height-16);
});
