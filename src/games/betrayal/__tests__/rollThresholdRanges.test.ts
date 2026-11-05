import {expect,it} from 'vitest';
import {buildRollThresholdRanges} from '../recentRollPresentation';
it('吊死鬼的失败分支是零到一点，不是达到零点都失败',()=>{
 expect(buildRollThresholdRanges([{min:0,label:'失败'},{min:2,label:'通过'}])).toEqual([{min:2,max:null,label:'通过'},{min:0,max:1,label:'失败'}]);
});
it('多分支按相邻下界划分互不重叠的范围，不改变原数据',()=>{
 const branches=[{min:0,label:'低'},{min:6,label:'高'},{min:3,label:'中'}];
 expect(buildRollThresholdRanges(branches).map(item=>[item.min,item.max])).toEqual([[6,null],[3,5],[0,2]]);
 expect(branches.map(item=>item.min)).toEqual([0,6,3]);
});
