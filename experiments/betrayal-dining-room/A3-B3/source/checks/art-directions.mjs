import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createMaterials,disposeMaterials} from '../src/materials.mjs';
import {createRoom,setWallMode,disposeRoom,geometryStats} from '../src/room.mjs';
import {createAbstractRoom} from '../src/abstract.mjs';
import {batchStaticRoom} from '../src/batch-static.mjs';
import {dimensions as d,cameraPresets} from '../src/dimensions.mjs';
const m=createMaterials(),detailed=createRoom(m),abstract=createAbstractRoom(m),results=[];
const count=(root,name)=>{let n=0;root.traverse(o=>{if(o.name===name)n++;});return n;};
function check(name,fn){fn();results.push({name,status:'PASS'});console.log(`PASS ${name}`);}
for(const room of [detailed,abstract])room.root.updateMatrixWorld(true);
check('A3 is independent paper geometry with six chairs and six printed plates',()=>{
  assert.equal(count(abstract.root,'paper-chair'),6);assert.equal(count(abstract.root,'printed-place-setting'),6);
  assert.equal(count(abstract.root,'slender-dining-chair'),0);assert.equal(count(abstract.root,'paper-layer-01'),1);
  assert.equal(count(abstract.root,'die-cut-chair-outline'),6);assert.equal(count(abstract.root,'cutout-candelabra'),2);
  assert.equal(count(abstract.root,'table-paper-surface'),1);
});
check('Both directions keep the same diagonal orientation and tabletop footprint',()=>{
  assert.equal(abstract.suite.rotation.y,d.rotation);assert.equal(detailed.suite.rotation.y,d.rotation);
  const table=abstract.root.getObjectByName('table-paper-surface');table.geometry.computeBoundingBox();
  const size=table.geometry.boundingBox.getSize(new THREE.Vector3());
  assert(Math.abs(size.x-d.tableWidth)<.001);assert(Math.abs(size.z-d.tableLength)<.001);
});
check('Paper chair back contains a real cut-through hole',()=>{
  const chair=abstract.root.getObjectByName('die-cut-chair-outline');
  const standalone=new THREE.Mesh(chair.geometry,m.ink);standalone.updateMatrixWorld(true);
  const hole=new THREE.Raycaster(new THREE.Vector3(0,.78,2),new THREE.Vector3(0,0,-1));
  const edge=new THREE.Raycaster(new THREE.Vector3(.20,.78,2),new THREE.Vector3(0,0,-1));
  assert.equal(hole.intersectObject(standalone).length,0);assert(edge.intersectObject(standalone).length>0);
});
check('B3 includes curved cabinet, gathered fabric, framed portraits and restrained age details',()=>{
  for(const name of ['bow-front-cabinet-body','bow-front-cabinet-top','aged-window-and-drapery','unopened-correspondence'])assert.equal(count(detailed.root,name),1);
  assert.equal(count(detailed.root,'gathered-curtain'),2);assert.equal(count(detailed.root,'ancestral-portrait'),2);
  assert.equal(count(detailed.root,'cooled-wax-drop'),10);assert.equal(count(detailed.root,'hairline-wall-crack'),16);
  assert.equal(count(detailed.root,'sideboard-body'),0);
});
check('Curtains have actual depth variation and valid normals',()=>{
  detailed.root.traverse(o=>{if(o.name!=='gathered-curtain')return;
    const a=o.geometry.attributes.position,n=o.geometry.attributes.normal;let min=Infinity,max=-Infinity;
    for(let i=0;i<a.count;i++){min=Math.min(min,a.getZ(i));max=Math.max(max,a.getZ(i));assert(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5);}
    assert(max-min>.07);
  });
});
check('Window and portraits remain inside non-door wall sections',()=>{
  detailed.walls.forEach(wall=>wall.children.forEach(o=>{
    if(!['aged-window-and-drapery','ancestral-portrait'].includes(o.name))return;
    // Evaluate group-local bounds, independently of the wall orientation.
    const clone=o.clone();const bounds=new THREE.Box3().setFromObject(clone);
    assert(bounds.min.x> d.doorWidth/2+.04 || bounds.max.x< -d.doorWidth/2-.04);
    assert(bounds.min.x>-d.room/2+.05&&bounds.max.x<d.room/2-.05);
  }));
});
check('All new material maps are deterministic and self-contained',()=>{
  const second=createMaterials();
  for(const key of ['velvet','window','portrait','letter','paperFloor','paperRug']){
    assert(m[key].map.isDataTexture);assert.deepEqual(m[key].map.image.data,second[key].map.image.data);
  }
  disposeMaterials(second);
});
check('A3 geometry, normals, UVs and world matrices contain no non-finite values',()=>{
  abstract.root.traverse(o=>{
    assert(o.matrixWorld.elements.every(Number.isFinite));
    if(o instanceof THREE.Mesh)for(const a of Object.values(o.geometry.attributes))assert([...a.array].every(Number.isFinite));
  });
});
check('A3 dining assembly stays inside the room tile',()=>{
  const b=new THREE.Box3().setFromObject(abstract.suite);assert(b.min.x>-3.3&&b.max.x<3.3&&b.min.z>-3.3&&b.max.z<3.3);
});
check('Repeated wall modes work independently in both directions',()=>{
  for(const room of [abstract,detailed])for(const mode of ['floor','cutaway','full','floor','cutaway']){
    setWallMode(room,mode);assert.equal(room.walls.filter(w=>w.visible).length,mode==='full'?4:mode==='floor'?0:2);
  }
});
check('A3 overview remains inside portrait and landscape horizontal projection bounds',()=>{
  const p=cameraPresets.overview;
  for(const [width,height]of [[390,844],[1440,900],[800,360]]){
    const half=p.height*Math.max(1,height/width*1.12);
    const c=new THREE.OrthographicCamera(-half*width/height,half*width/height,half,-half,.1,80);
    c.position.fromArray(p.position);c.lookAt(new THREE.Vector3(...p.target));c.updateMatrixWorld(true);
    abstract.root.traverseVisible(o=>{if(!(o instanceof THREE.Mesh))return;
      const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){
        const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(c);assert(Math.abs(v.x)<.95);
      }
    });
  }
});
const before=geometryStats(abstract.root),batch=batchStaticRoom(abstract),after=geometryStats(abstract.root);
check('A3 batching preserves triangle count and independent wall partitions',()=>{
  assert.equal(before.triangles,after.triangles);assert(after.meshes<before.meshes*.20);
  for(const mode of ['full','floor','cutaway']){setWallMode(abstract,mode);assert.equal(abstract.walls.filter(w=>w.visible).length,mode==='full'?4:mode==='floor'?0:2);}
});
check('Direction controls are connected to visibility-only switching without resetting comparison camera',()=>{
  // Source contract only, not a real DOM click or screenshot.
  const scene=readFileSync('src/scene.ts','utf8'),ui=readFileSync('src/main.ts','utf8');
  assert(scene.includes("detailed.root.visible=name==='detailed';abstract.root.visible=name==='abstract'"));
  const art=scene.slice(scene.indexOf('  function art('),scene.indexOf('  function reset('));
  assert(!art.includes('view('));assert(ui.includes('study.art(button.dataset.art'));
  assert(ui.includes('data-art="detailed"'));assert(ui.includes('data-art="abstract"'));
});
writeFileSync('checks/art-direction-result.json',JSON.stringify({scope:'CPU geometry and source contracts only; no graphics or browser execution',visualAcceptance:'NOT_RUN',results,abstract:{before,after,batch},detailed:geometryStats(detailed.root)},null,2));
console.log(JSON.stringify({passed:results.length,abstract:{before,after},detailed:geometryStats(detailed.root)}));
disposeRoom(detailed.root);disposeRoom(abstract.root);disposeMaterials(m);
