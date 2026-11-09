import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {createMaterials,disposeMaterials} from '../src/materials.mjs';
import {createRoom,setWallMode,geometryStats,disposeRoom} from '../src/room.mjs';
import {dimensions as d,seats,settings,lighting,cameraPresets} from '../src/dimensions.mjs';

// One-off source/geometry smoke evidence, NOT a screenshot or aesthetic acceptance test.
const m=createMaterials(),room=createRoom(m),results=[];
function check(name,fn){fn();results.push({name,status:'PASS'});console.log(`PASS ${name}`);}
room.root.updateMatrixWorld(true);
check('Six configured chairs and six place settings are constructed',()=>{
  assert.equal(seats.length,6);assert.equal(settings.length,6);
  const count=name=>{let n=0;room.root.traverse(o=>{if(o.name===name)n++;});return n;};
  assert.equal(count('slender-dining-chair'),6);assert.equal(count('dining-setting'),6);
});
check('All vertex positions and world transforms are finite',()=>{
  room.root.traverse(o=>{
    assert(o.matrixWorld.elements.every(Number.isFinite));
    if(o instanceof THREE.Mesh)assert([...o.geometry.attributes.position.array].every(Number.isFinite));
  });
});
check('Inferred furniture dimensions are coherent',()=>{
  assert(d.seatHeight<d.tableHeight-.20);assert(d.chairHeight>d.tableHeight);
  const table=room.root.getObjectByName('oval-tabletop');
  table.geometry.computeBoundingBox();const size=table.geometry.boundingBox.getSize(new THREE.Vector3());
  assert(Math.abs(size.x-d.tableWidth)<.04);assert(Math.abs(size.z-d.tableLength)<.04);
  assert(size.y<.12);assert(d.tableLength/d.tableWidth>2);
});
check('Every chair faces toward its assigned setting',()=>{
  seats.forEach((seat,index)=>{
    const facing=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),seat.rotation);
    const target=new THREE.Vector3(settings[index].x-seat.x,0,settings[index].z-seat.z).normalize();
    assert(facing.dot(target)>.99);
  });
});
check('Furniture feet touch their support surface within 1mm',()=>{
  const near=(a,b)=>assert(Math.abs(a-b)<.001,`Contact gap: ${a-b}`);
  room.root.traverse(o=>{if(o.name==='slender-dining-chair'||o.name==='oval-dining-table')near(new THREE.Box3().setFromObject(o).min.y,.039);});
  for(const name of ['wooden-sideboard','southwest-bench'])near(new THREE.Box3().setFromObject(room.root.getObjectByName(name)).min.y,.035);
});
check('All six dinner plates contact tabletop or runner within 1mm',()=>{
  room.suite.children.filter(o=>o.name==='dining-setting').forEach(o=>{
    const plate=o.getObjectByName('ceramic-plate'),y=new THREE.Box3().setFromObject(plate).min.y;
    const support=.039+d.tableHeight+(o.position.x===0?.018:.009);
    assert(Math.abs(y-support)<.001,`Plate gap: ${y-support}`);
  });
});
check('Portrait overview camera fits visible room width with margin',()=>{
  setWallMode(room,'cutaway');const width=390,height=844,p=cameraPresets.overview;
  const half=p.height*Math.max(1,height/width*1.12);
  const camera=new THREE.OrthographicCamera(-half*width/height,half*width/height,half,-half,.1,80);
  camera.position.fromArray(p.position);camera.lookAt(new THREE.Vector3(...p.target));camera.updateMatrixWorld();
  let maxX=0;
  room.root.traverseVisible(o=>{if(!(o instanceof THREE.Mesh))return;
    const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){
      const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(camera);maxX=Math.max(maxX,Math.abs(v.x));
    }
  });
  assert(maxX<.95,`Overview horizontal NDC bound: ${maxX}`);
});
check('Dining furniture remains inside the room footprint',()=>{
  const bounds=new THREE.Box3().setFromObject(room.suite);
  assert(bounds.min.x>-d.room/2+.1&&bounds.max.x<d.room/2-.1);
  assert(bounds.min.z>-d.room/2+.1&&bounds.max.z<d.room/2-.1);
});
check('Rug corners fit inside the room',()=>{
  const half=(d.rugWidth+d.rugLength)/2*Math.SQRT1_2;
  assert(half<d.room/2-.15);
});
check('Wall state changes are reversible and reject invalid state',()=>{
  for(const mode of ['cutaway','full','floor','full','cutaway']){
    setWallMode(room,mode);assert.equal(room.walls.filter(w=>w.visible).length,mode==='full'?4:mode==='cutaway'?2:0);
  }
  assert.throws(()=>setWallMode(room,'unexpected'));
});
check('Neutral and warm presets are distinct and neutral candle light is disabled',()=>{
  assert.equal(lighting.neutral.candles,0);assert(lighting.warm.candles>0);
  assert.equal(lighting.neutral.key,'#ffffff');assert.notEqual(lighting.warm.key,lighting.neutral.key);
});
check('All three camera presets have finite position and target',()=>{
  assert.equal(Object.keys(cameraPresets).length,3);
  for(const preset of Object.values(cameraPresets))assert([...preset.position,...preset.target,preset.height].every(Number.isFinite));
});
check('All texture pixels are generated locally with correct data sizes',()=>{
  for(const material of Object.values(m))for(const key of ['map','bumpMap']){
    const t=material[key];if(!t)continue;
    assert(t.isDataTexture);assert.equal(t.image.data.length,t.image.width*t.image.height*4);
  }
});
const stats=geometryStats(room.root);
writeFileSync('checks/geometry-result.json',JSON.stringify({scope:'CPU-side procedural geometry and resource smoke check only',visualAcceptance:'NOT_RUN',results,stats},null,2));
console.log(JSON.stringify(stats));disposeRoom(room.root);disposeMaterials(m);
