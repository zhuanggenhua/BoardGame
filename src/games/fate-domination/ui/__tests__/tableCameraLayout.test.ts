import {expect,it} from 'vitest';
import {fitFateTableCamera, resizeFateTableCamera} from '../tableCameraLayout';
it.each([
 [1920,1080,'height'],
 [1366,768,'height'],
 [1180,757,'width'],
] as const)('初始取景在%s×%s使用完整视口，不为 HUD 缩小地图', (width,height,filledAxis)=>{
 const pose=fitFateTableCamera(width,height,1927,1179);
 if (filledAxis==='height') {
  expect(1179*pose.zoom).toBeCloseTo(height);
  expect(pose.panY).toBeCloseTo(0);
 } else {
  expect(1927*pose.zoom).toBeCloseTo(width);
  expect(pose.panX).toBeCloseTo(0);
 }
 expect(pose.panX).toBeGreaterThanOrEqual(-.001);
 expect(pose.panY).toBeGreaterThanOrEqual(-.001);
 expect(pose.panX+1927*pose.zoom/2).toBeCloseTo(width/2);
 expect(pose.panY+1179*pose.zoom/2).toBeCloseTo(height/2);
 expect(pose.panX+1927*pose.zoom).toBeLessThanOrEqual(width+.001);
 expect(pose.panY+1179*pose.zoom).toBeLessThanOrEqual(height+.001);
});

it('窗口缩小时默认取景随完整视口重算，用户主动平移缩放则保持',()=>{
 const before=fitFateTableCamera(1920,1080,1927,1179);
 const after=fitFateTableCamera(1366,768,1927,1179);
 expect(resizeFateTableCamera(before,before,after)).toEqual(after);
 const manual={zoom:before.zoom*1.2,panX:before.panX-80,panY:before.panY+20};
 expect(resizeFateTableCamera(manual,before,after)).toEqual(manual);
 expect(resizeFateTableCamera(manual,null,after)).toEqual(after);
});
