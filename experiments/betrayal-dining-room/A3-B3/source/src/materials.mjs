import * as THREE from 'three';

// Original deterministic procedural textures. No photo, scraped image or third-party art.
const clamp = value => Math.max(0,Math.min(255,value));
const hash = (x,y) => {let n=Math.imul(x+37,374761393)^Math.imul(y+71,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
const color = (base,delta) => base.map(v=>clamp(v+delta));
const mix = (a,b,t) => a.map((v,i)=>v*(1-t)+b[i]*t);
function texture(size,sample,isColor=true) {
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const values=sample(x/size,y/size,x,y);
    const i=(y*size+x)*4;
    data[i]=values[0];data[i+1]=values[1];data[i+2]=values[2];data[i+3]=255;
  }
  const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  tex.colorSpace=isColor?THREE.SRGBColorSpace:THREE.NoColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps=true;tex.needsUpdate=true;tex.anisotropy=4;
  return tex;
}
function woodSample(u,v,x,y,base=[104,65,37]) {
  const grain=Math.sin(v*340+Math.sin(u*17)*2.7+Math.sin(u*39)*.6);
  const pores=Math.pow(Math.max(0,Math.sin(v*770+Math.sin(u*21))),18);
  return color(base,grain*5-pores*11+(hash(x,y)-.5)*10+Math.sin(u*9)*4);
}
function floral(u,v) {
  const x=u*2-1,y=v*2-1,r=Math.hypot(x,y),angle=Math.atan2(y,x);
  const petal=.33+.13*Math.cos(8*angle);
  return Math.abs(r-petal)<.045 || r<.08 || (Math.abs(x)<.025&&Math.abs(y)<.8) ||
    (Math.abs(Math.hypot(Math.abs(x)-.27,Math.abs(y)-.54)-.16)<.025);
}
function rugSample(u,v,x,y) {
  const edge=Math.min(u,1-u,v,1-v),grain=(hash(x,y)-.5)*13;
  let c=[73,57,42];
  if(edge<.014) c=[130,110,76];
  else if(edge<.025) c=[49,47,32];
  else if(edge<.045) c=[145,118,76];
  else if(edge<.105) {
    const a=(u*22)%1,b=(v*36)%1;
    c=floral(a,b)?[158,131,86]:[80,55,40];
  } else if(edge<.12) c=[136,115,75];
  else if(edge<.133) c=[42,52,37];
  else {
    c=floral((u*11)%1,(v*19)%1)?[114,100,66]:[76,72,48];
    const dx=(u-.5)*1.45,dy=(v-.5)*1.1;
    const angle=Math.atan2(dy,dx),r=Math.hypot(dx,dy),boundary=.21+.035*Math.cos(12*angle);
    if(r<boundary) c=[102,57,43];
    if(Math.abs(r-boundary)<.011) c=[171,139,87];
    if(Math.abs(r-.13)<.01||r<.036) c=[165,134,83];
    if(Math.abs(r-(.07+.02*Math.cos(angle*8)))<.012) c=[164,136,90];
  }
  const wear=.13+.14*Math.sin(u*13+v*5)**2;
  c=mix(c,[163,145,114],wear);
  return color(c,grain+((x%3===0||y%3===0)?-6:0));
}
export function createMaterials() {
  const woodMap=texture(256,woodSample);
  const darkWoodMap=texture(256,(u,v,x,y)=>woodSample(u,v,x,y,[67,39,24]));
  const bump=texture(256,(u,v,x,y)=>{const n=128+Math.sin(v*330+Math.sin(u*18)*3)*13+(hash(x,y)-.5)*16;return [n,n,n];},false);
  const floorMap=texture(1024,(u,v,x,y)=>{
    const grid=11, gx=Math.floor(u*grid),gy=Math.floor(v*grid);
    let a=(u*grid)%1,b=(v*grid)%1;
    if((gx+gy)%2===0)[a,b]=[b,a];
    const plank=Math.floor(a*5),seam=Math.min((a*5)%1,1-(a*5)%1)<.035||b<.013||b>.987;
    const base=color([131,85,45],(hash(gx*5+plank,gy)-.5)*24);
    return seam?[67,45,29]:woodSample(b,a,x,y,base);
  });
  const wallMap=texture(512,(u,v,x,y)=>{
    const ux=(u*5)%1,vy=(v*6)%1;
    const pattern=floral(ux,vy);
    const line=Math.abs(ux-.5)<.007;
    return color(pattern?[64,79,57]:line?[78,89,62]:[34,58,46],(hash(x,y)-.5)*9+Math.sin(u*21+v*9)*3);
  });
  const rugMap=texture(1024,rugSample);
  const fabricMap=texture(128,(u,v,x,y)=>color([182,166,129],((x%3===0||y%3===0)?-11:0)+(hash(x,y)-.5)*10));
  const paperMap=texture(128,(u,v,x,y)=>color([160,140,99],(hash(x,y)-.5)*20));
  const velvetMap=texture(256,(u,v,x,y)=>color([68,42,38],Math.sin(u*30)*3+(hash(x,y)-.5)*7+(y%3===0?-4:0)));
  const windowMap=texture(256,(u,v,x,y)=>{
    const haze=Math.sin(u*13+v*4)*6+(hash(x,y)-.5)*8;
    const outer=Math.pow(Math.max(Math.abs(u-.5),Math.abs(v-.5))*2,7);
    const branch=Math.abs(u-(.43+.07*Math.sin(v*9)))<.009 || (v>.45&&Math.abs(u-(.45+(v-.45)*.5))<.009);
    return color(branch?[38,48,46]:[111,124,117],haze-outer*39);
  });
  const portraitMap=texture(256,(u,v,x,y)=>{
    // Original anonymous silhouette; not a copy of an artwork or identifiable person.
    const head=((u-.49)/.14)**2+((v-.65)/.18)**2;
    const bust=((u-.50)/.31)**2+((v-.22)/.31)**2;
    const vignette=Math.max(0,1-1.5*Math.hypot(u-.5,v-.5));
    let c=head<1?[75,65,45]:bust<1?[29,34,29]:[49+22*vignette,52+15*vignette,36+7*vignette];
    if(head<1&&u>.47&&u<.58&&v>.56&&v<.72)c=[102,86,60];
    const fissure=Math.abs(Math.sin(u*71+Math.sin(v*43)))>.998?-18:0;
    return color(c,(hash(x,y)-.5)*13+Math.sin(v*330)*2+fissure);
  });
  const letterMap=texture(128,(u,v,x,y)=>{
    const ink=u>.12&&u<.86&&v>.20&&v<.78&&(Math.floor(v*24)%3===0)&&Math.sin(u*61+v*19)>.1;
    return color(ink?[76,64,45]:[176,157,118],(hash(x,y)-.5)*14);
  });
  const paperFloorMap=texture(512,(u,v,x,y)=>{
    const a=(u*11)%1,b=(v*11)%1,cell=(Math.floor(u*11)+Math.floor(v*11))%2;
    const line=(cell?a:b)*5%1;
    return color(line<.04||a<.015||b<.015?[64,66,52]:[141,137,108],(hash(x,y)-.5)*12);
  });
  const paperRugMap=texture(512,(u,v,x,y)=>{
    const e=Math.min(u,1-u,v,1-v),r=Math.hypot((u-.5)*1.7,v-.5);
    const motif=floral((u*9)%1,(v*15)%1);
    let c=e<.018||e>.075&&e<.085?[154,138,103]:[67,74,62];
    if(e>.10)c=motif?[111,119,91]:[76,84,68];
    if(Math.abs(r-.23)<.009)c=[161,142,100];
    return color(c,(hash(x,y)-.5)*15);
  });
  const standard=(options)=>new THREE.MeshStandardMaterial(options);
  const materials={
    wood:standard({map:woodMap,bumpMap:bump,bumpScale:.008,roughness:.54,color:'#cbb694'}),
    darkWood:standard({map:darkWoodMap,bumpMap:bump,bumpScale:.006,roughness:.58}),
    floor:standard({map:floorMap,roughness:.72,bumpMap:bump,bumpScale:.003}),
    wallpaper:standard({map:wallMap,roughness:.97}),
    rug:standard({map:rugMap,roughness:1}),
    cloth:standard({map:fabricMap,roughness:.96}),
    upholstery:standard({color:'#56604a',map:fabricMap,roughness:.91}),
    brass:standard({color:'#aa8851',roughness:.5,metalness:.65}),
    iron:standard({color:'#39372c',roughness:.6,metalness:.4}),
    ceramic:standard({color:'#d2ccb1',roughness:.38,metalness:0}),
    bottle:standard({color:'#293a25',roughness:.28,metalness:.05}),
    wine:standard({color:'#40201c',roughness:.28}),
    glass:standard({color:'#a9a58d',roughness:.15,metalness:.22,transparent:true,opacity:.55,depthWrite:false}),
    candle:standard({color:'#d9c99b',roughness:.91}),
    flame:new THREE.MeshBasicMaterial({color:'#efc77c',toneMapped:false}),
    paper:standard({map:paperMap,roughness:1}),
    base:standard({color:'#212c25',roughness:.9}),
    black:standard({color:'#141a16',roughness:1}),
    velvet:standard({map:velvetMap,roughness:1,side:THREE.DoubleSide}),
    cord:standard({color:'#98805b',roughness:.85}),
    window:standard({map:windowMap,roughness:.61,emissive:'#26312f',emissiveIntensity:.17}),
    portrait:standard({map:portraitMap,roughness:.92}),
    crack:standard({color:'#202c24',roughness:1}),
    letter:standard({map:letterMap,roughness:1}),
    seal:standard({color:'#622e27',roughness:.68}),
    paperLight:standard({map:paperMap,color:'#e4dcc3',roughness:1}),
    paperDark:standard({map:paperMap,color:'#62725d',roughness:1}),
    paperFloor:standard({map:paperFloorMap,roughness:1}),
    paperRug:standard({map:paperRugMap,roughness:1}),
    paperTable:standard({map:paperMap,color:'#8b7656',roughness:1}),
    paperGold:standard({map:paperMap,color:'#b5a16f',roughness:1}),
    ink:standard({color:'#252e29',roughness:1}),
  };
  return materials;
}
export function disposeMaterials(materials) {
  const textures=new Set();
  for(const material of Object.values(materials)) {
    for(const value of Object.values(material)) if(value instanceof THREE.Texture)textures.add(value);
    material.dispose();
  }
  textures.forEach(t=>t.dispose());
}
