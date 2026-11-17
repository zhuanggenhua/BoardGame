import {expect,it} from 'vitest';
import {constrainFateTableCamera, fitFateTableCamera, fitFateTargetCamera, resizeFateTableCamera} from '../tableCameraLayout';

it.each([.25, 1.5])('缩放为 %s 时斜向拖出边界仍保留棋盘主体', (zoom) => {
 const width=1169, height=719, mapWidth=1927, mapHeight=1179;
 for(const [panX,panY] of [[1500,-900],[-1000,850],[909,-265]]){
  const pose=constrainFateTableCamera({zoom,panX,panY},width,height,mapWidth,mapHeight);
  expect(Math.min(width,pose.panX+mapWidth*zoom)-Math.max(0,pose.panX)).toBeGreaterThanOrEqual(Math.min(width,mapWidth*zoom)*.85-.01);
  expect(Math.min(height,pose.panY+mapHeight*zoom)-Math.max(0,pose.panY)).toBeGreaterThanOrEqual(Math.min(height,mapHeight*zoom)*.85-.01);
 }
});

it('新都事件选择时避让手牌与威力，尽可能保持整张地图在视口内',()=>{
 const view={width:1169,height:719},map={width:1927,height:1179};
 const current=fitFateTableCamera(view.width,view.height,map.width,map.height);
 const target={x:417,y:806,width:226,height:316};
 const blockers=[{left:284,top:410,right:445,bottom:476},{left:454,top:302,right:578,bottom:476},{left:284,top:486,right:735,bottom:719},{left:775,top:486,right:1130,bottom:719}];
 const next=fitFateTargetCamera(current,view,map,target,blockers);
 const rect={left:next.panX+target.x*next.zoom,top:next.panY+target.y*next.zoom,right:next.panX+(target.x+target.width)*next.zoom,bottom:next.panY+(target.y+target.height)*next.zoom};
 expect(blockers.every(b=>rect.right<=b.left||rect.left>=b.right||rect.bottom<=b.top||rect.top>=b.bottom)).toBe(true);
 expect(next.panX).toBeGreaterThanOrEqual(-4);
 expect(next.panX+map.width*next.zoom).toBeLessThanOrEqual(view.width+4);
 expect(next.panY).toBeGreaterThanOrEqual(-4);
 expect(next.panY+map.height*next.zoom).toBeLessThanOrEqual(view.height+4);
});
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
