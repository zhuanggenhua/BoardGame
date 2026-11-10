const fs=require('fs');const path=require('path');const sharp=require('sharp');
sharp.cache(false);sharp.concurrency(2);
const old=path.resolve(__dirname,'../../圣骑士素材压缩/20261015T122010Z');
const source=path.join(old,'sample-source.png');
async function run(){
 const rows=[];
 const alpha=path.join(__dirname,'sample-alpha.png');
 await sharp(source).extractChannel('alpha').png({compressionLevel:9}).toFile(alpha);
 for(const sub of ['4:4:4','4:2:0']) for(const quality of [80,90]){
  const id=`jpeg-${sub.replaceAll(':','')}-q${quality}`;const file=path.join(__dirname,id+'.jpg');
  const info=await sharp(source).removeAlpha().jpeg({quality,chromaSubsampling:sub,mozjpeg:true}).toFile(file);
  rows.push({id,file,bytes:info.size,alphaBytes:fs.statSync(alpha).size,alphaFile:alpha,standaloneAlpha:false});
  fs.writeFileSync(path.join(__dirname,'alternative-results.json'),JSON.stringify(rows,null,2));console.log(id,info.size);
 }
 for(const dither of [0,1]){
  const id=`png256-dither${dither}`,file=path.join(__dirname,id+'.png');
  const info=await sharp(source).png({palette:true,colours:256,dither,effort:10,compressionLevel:9}).toFile(file);
  rows.push({id,file,bytes:info.size});
  fs.writeFileSync(path.join(__dirname,'alternative-results.json'),JSON.stringify(rows,null,2));console.log(id,info.size);
 }
}
run().catch(e=>{console.error(e);process.exitCode=1});
