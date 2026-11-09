import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createMaterials,disposeMaterials} from './materials.mjs';
import {createRoom,setWallMode,disposeRoom,geometryStats} from './room.mjs';
import {cameraPresets,lighting,dimensions} from './dimensions.mjs';
import {applyCameraPose,inspectionControls} from './camera-pose.mjs';
import {batchStaticRoom} from './batch-static.mjs';
import {createAbstractRoom} from './abstract.mjs';

type View=keyof typeof cameraPresets;
type LightMode=keyof typeof lighting;
type WallMode='cutaway'|'full'|'floor';
type ArtMode='detailed'|'abstract';
export function createStudy(host:HTMLElement) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#171c19');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','旧宅餐厅：细节微缩与抽象纸剧场双方向样板');
  const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,80);
  const controls=new OrbitControls(camera,renderer.domElement);
  Object.assign(controls,inspectionControls);
  controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
  const materials=createMaterials();
  const detailed=createRoom(materials),abstract=createAbstractRoom(materials);
  for(const room of [detailed,abstract]){batchStaticRoom(room);scene.add(room.root);setWallMode(room,'cutaway');}
  abstract.root.visible=false;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#171c19',roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.31;ground.receiveShadow=true;scene.add(ground);
  const hemisphere=new THREE.HemisphereLight();scene.add(hemisphere);
  const key=new THREE.DirectionalLight();key.position.set(1.5,10,4.5);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:25});key.shadow.normalBias=.018;key.shadow.bias=-.0001;scene.add(key);
  const fill=new THREE.DirectionalLight();fill.position.set(-4,5,1);scene.add(fill);
  const candleLights:THREE.PointLight[]=[];
  for(const z of [-.63,.63]) {
    const p=new THREE.Vector3(0,dimensions.tableHeight+.55,z).applyAxisAngle(new THREE.Vector3(0,1,0),dimensions.rotation);
    const light=new THREE.PointLight('#ffd29a',2,3.4,2);light.position.copy(p);scene.add(light);candleLights.push(light);
  }
  const auxiliary=new THREE.PointLight('#ffd09b',1.3,3.4,2);auxiliary.position.set(2.5,1.38,-2.6);scene.add(auxiliary);
  const flameMeshes:THREE.Mesh[]=[];detailed.root.traverse(object=>{if(object instanceof THREE.Mesh&&object.name==='candle-flame')flameMeshes.push(object);});
  let viewName:View='overview',lightName:LightMode='neutral',wallName:WallMode='cutaway',artName:ArtMode='detailed',alive=true;
  function resize() {
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    renderer.setSize(width,height,false);
    const half=cameraPresets[viewName].height*Math.max(1,height/width*1.12);
    camera.left=-half*width/height;camera.right=half*width/height;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
  }
  function view(name:View) {
    viewName=name;const preset=cameraPresets[name];
    applyCameraPose(camera,controls,preset,resize);
  }
  function light(name:LightMode) {
    const preset=lighting[name];lightName=name;
    hemisphere.color.set(preset.sky);hemisphere.groundColor.set(preset.ground);hemisphere.intensity=preset.ambient;
    key.color.set(preset.key);key.intensity=preset.keyIntensity;fill.color.set(preset.fill);fill.intensity=preset.fillIntensity;
    candleLights.forEach(item=>item.intensity=preset.candles);auxiliary.intensity=preset.candles*.65;
    flameMeshes.forEach(item=>item.visible=name==='warm');renderer.toneMappingExposure=preset.exposure;
  }
  function walls(name:WallMode) {wallName=name;for(const room of [detailed,abstract])setWallMode(room,name);}
  function art(name:ArtMode) {
    if(!['detailed','abstract'].includes(name))throw new Error(`Unknown art mode: ${name}`);
    artName=name;detailed.root.visible=name==='detailed';abstract.root.visible=name==='abstract';
  }
  function reset() {view('overview');light('neutral');walls('cutaway');}
  const observer=new ResizeObserver(resize);observer.observe(host);reset();
  let frame=0;
  function render() {if(!alive)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render);}
  render();
  return {view,light,walls,art,reset,resize,stats:{detailed:geometryStats(detailed.root),abstract:geometryStats(abstract.root)},state:()=>({view:viewName,light:lightName,walls:wallName,art:artName}),dispose:()=>{
    if(!alive)return;alive=false;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
    disposeRoom(detailed.root);disposeRoom(abstract.root);disposeMaterials(materials);ground.geometry.dispose();ground.material.dispose();renderer.dispose();renderer.domElement.remove();
  }};
}
