import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createMaterials,disposeMaterials} from '../src/materials.mjs';
import {createRoom,setWallMode,geometryStats,disposeRoom} from '../src/room.mjs';
import {cameraPresets} from '../src/dimensions.mjs';
import {applyCameraPose,inspectionControls} from '../src/camera-pose.mjs';
import {bindPageLifecycle} from '../src/page-lifecycle.mjs';
import {batchStaticRoom} from '../src/batch-static.mjs';

const results = [];
function check(name, fn) {fn();results.push({name,status:'PASS'});console.log(`PASS ${name}`);}
const camera = new THREE.OrthographicCamera(-5,5,5,-5,.1,80);
const controls = new OrbitControls(camera);
Object.assign(controls,inspectionControls);
const dirty = () => {
  // Controlled CPU injection into the real Three.js controls. Not UI input.
  controls._sphericalDelta.theta = .3;
  controls._sphericalDelta.phi = .05;
  controls._panOffset.set(.2,0,.1);
};
let oldDrift;
check('Regression demonstrates that the old reset drifts', () => {
  const preset=cameraPresets.overview;
  camera.position.fromArray(preset.position);controls.target.fromArray(preset.target);
  dirty();controls.update();
  for(let i=0;i<120;i++)controls.update();
  oldDrift=camera.position.distanceTo(new THREE.Vector3(...preset.position));
  assert(oldDrift>1);
});
for(const [name,preset] of Object.entries(cameraPresets)) {
  check(`Exact ${name} pose survives 120 frames of prior rotate/pan momentum`, () => {
    dirty();camera.zoom=2;
    applyCameraPose(camera,controls,preset,()=>camera.updateProjectionMatrix());
    for(let i=0;i<120;i++)controls.update();
    assert(camera.position.distanceTo(new THREE.Vector3(...preset.position))<1e-9);
    assert(controls.target.distanceTo(new THREE.Vector3(...preset.target))<1e-9);
    assert.equal(camera.zoom,1);assert.equal(controls.enableDamping,true);
  });
}
check('Pose helper restores controls flags after a failed resize', () => {
  controls.autoRotate=true;
  assert.throws(()=>applyCameraPose(camera,controls,cameraPresets.overview,()=>{throw new Error('resize');}));
  assert(controls.autoRotate);assert(controls.enableDamping);controls.autoRotate=false;
});

function pageEvent(type,persisted) {const event=new Event(type);Object.defineProperty(event,'persisted',{value:persisted});return event;}
check('Repeated bfcache cycles preserve the scene and refresh its size', () => {
  const target=new EventTarget();let disposed=0,resized=0;
  bindPageLifecycle(target,{dispose:()=>disposed++,resize:()=>resized++});
  for(let i=0;i<3;i++){target.dispatchEvent(pageEvent('pagehide',true));target.dispatchEvent(pageEvent('pageshow',true));}
  assert.equal(disposed,0);assert.equal(resized,3);
  target.dispatchEvent(pageEvent('pagehide',false));
  target.dispatchEvent(pageEvent('pagehide',false));target.dispatchEvent(pageEvent('pageshow',true));
  assert.equal(disposed,1);assert.equal(resized,3);
});
check('Ordinary pageshow does not trigger unnecessary resize, listener unbind works', () => {
  const target=new EventTarget();let calls=0;
  const unbind=bindPageLifecycle(target,{dispose:()=>calls++,resize:()=>calls++});
  target.dispatchEvent(pageEvent('pageshow',false));unbind();
  target.dispatchEvent(pageEvent('pagehide',false));target.dispatchEvent(pageEvent('pageshow',true));
  assert.equal(calls,0);
});

const materials=createMaterials();
const original=createRoom(materials),batched=createRoom(materials);
const originalStats=geometryStats(original.root);
const batchResult=batchStaticRoom(batched);
const batchedStats=geometryStats(batched.root);
check('Batching preserves triangle count and cuts mesh submissions by at least 85%',()=>{
  assert.equal(batchedStats.triangles,originalStats.triangles);
  assert(batchedStats.meshes<originalStats.meshes*.15);
});
check('Transparent wineglasses and switchable candle flames stay independent',()=>{
  for(const room of [original,batched]){
    let glasses=0,flames=0;room.root.traverse(o=>{
      if(o.name==='wineglass'){glasses++;assert(o.material.transparent);assert.equal(o.material.depthWrite,false);}
      if(o.name==='candle-flame'){flames++;assert.equal(o.castShadow,false);}
    });assert.equal(glasses,6);assert.equal(flames,9);
  }
});

// Preserve ordered triangle vertices within each independent visibility/material
// partition. Verify position, transformed normal, UV, material identity, layer,
// shadow and render flags, not just bounding boxes or totals.
function snapshot(room) {
  const partitions=new Set([...room.walls,room.cutEdges]);
  const output=new Map();
  room.root.updateMatrixWorld(true);
  function walk(object,partition) {
    if(!object.visible)return;
    if(partitions.has(object))partition=object.name;
    if(object instanceof THREE.Mesh){
      const key=JSON.stringify([partition,object.material.uuid,object.castShadow,object.receiveShadow,
        object.renderOrder,object.layers.mask,object.frustumCulled,object.name==='candle-flame']);
      if(!output.has(key))output.set(key,[]);
      const numbers=output.get(key),g=object.geometry,index=g.index;
      const normalMatrix=new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
      const v=new THREE.Vector3(),n=new THREE.Vector3();
      for(let i=0;i<(index?.count??g.attributes.position.count);i++){
        const j=index?index.getX(i):i;
        v.fromBufferAttribute(g.attributes.position,j).applyMatrix4(object.matrixWorld);
        n.fromBufferAttribute(g.attributes.normal,j).applyNormalMatrix(normalMatrix);
        numbers.push(v.x,v.y,v.z,n.x,n.y,n.z,g.attributes.uv.getX(j),g.attributes.uv.getY(j));
      }
    }
    for(const child of object.children)walk(child,partition);
  }
  walk(room.root,'room-root');return output;
}
let maxAttributeError=0;
const visibleMeshCounts=[];
for(const mode of ['cutaway','full','floor'])for(const light of ['neutral','warm']){
  check(`${mode}/${light}: every visible triangle, material, normal, UV and render flag is preserved`,()=>{
    for(const room of [original,batched]){
      setWallMode(room,mode);
      room.root.traverse(o=>{if(o.name==='candle-flame')o.visible=light==='warm';});
    }
    const before=snapshot(original),after=snapshot(batched);
    assert.deepEqual([...before.keys()].sort(),[...after.keys()].sort());
    for(const [key,values]of before){
      const other=after.get(key);assert.equal(values.length,other.length);
      for(let i=0;i<values.length;i++){
        const error=Math.abs(values[i]-other[i]);maxAttributeError=Math.max(error,maxAttributeError);
        assert(error<1e-6,`Geometry attribute ${i} changed by ${error}`);
      }
    }
    const count=room=>{let n=0;room.root.traverseVisible(o=>{if(o instanceof THREE.Mesh)n++;});return n;};
    visibleMeshCounts.push({mode,light,before:count(original),after:count(batched)});
  });
}
check('All merged bounds remain finite and contain every vertex',()=>{
  batched.root.traverse(o=>{if(!o.name.startsWith('static-batch-'))return;
    assert(o.geometry.boundingSphere.radius>0&&Number.isFinite(o.geometry.boundingSphere.radius));
    const p=o.geometry.attributes.position,b=o.geometry.boundingBox,v=new THREE.Vector3();
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);assert(b.containsPoint(v));}
  });
});
check('Batching is idempotent and preserves independently visible wall groups',()=>{
  const result=batchStaticRoom(batched);assert.deepEqual(result,{mergedInputs:0,batches:0});
  for(const mode of ['cutaway','full','floor','cutaway']){
    setWallMode(batched,mode);
    assert.equal(batched.walls.filter(w=>w.visible).length,mode==='full'?4:mode==='cutaway'?2:0);
  }
});
const report={scope:'CPU regression tests; no browser, GPU run, screenshot or visual acceptance',visualAcceptance:'NOT_RUN',
  results,oldResetDriftMetres:oldDrift,originalStats,batchedStats,batchResult,maxAttributeError,visibleMeshCounts};
writeFileSync('checks/regression-result.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:results.length,originalStats,batchedStats,maxAttributeError,visibleMeshCounts}));
disposeRoom(original.root);disposeRoom(batched.root);disposeMaterials(materials);
