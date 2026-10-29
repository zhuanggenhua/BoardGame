import {expect,it} from 'vitest';
import {fitFateTableCamera, resizeFateTableCamera} from '../tableCameraLayout';
it.each([[1920,1080],[1366,768],[1180,757]] as const)('默认取景在%s×%s按完整视口居中适配，不因浮动牌区缩小棋盘', (width,height)=>{
 const pose=fitFateTableCamera(width,height,1927,1179);
 expect(pose.panX).toBeGreaterThanOrEqual(-.001);
 expect(pose.panY).toBeGreaterThanOrEqual(-.001);
 expect(pose.panX+1927*pose.zoom/2).toBeCloseTo(width/2);
 expect(pose.panY+1179*pose.zoom/2).toBeCloseTo(height/2);
 expect(pose.panX+1927*pose.zoom).toBeLessThanOrEqual(width+.001);
 expect(pose.panY+1179*pose.zoom).toBeLessThanOrEqual(height+.001);
 expect(Math.max(1927*pose.zoom/width,1179*pose.zoom/height)).toBeCloseTo(1);
});

it('窗口缩小时默认取景随视口重算，用户主动平移缩放则保持',()=>{
 const before=fitFateTableCamera(1920,1080,1927,1179);
 const after=fitFateTableCamera(1366,768,1927,1179);
 expect(resizeFateTableCamera(before,before,after)).toEqual(after);
 const manual={zoom:before.zoom*1.2,panX:before.panX-80,panY:before.panY+20};
 expect(resizeFateTableCamera(manual,before,after)).toEqual(manual);
 expect(resizeFateTableCamera(manual,null,after)).toEqual(after);
});
