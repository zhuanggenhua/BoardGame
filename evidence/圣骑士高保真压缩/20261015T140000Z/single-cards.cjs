const fs=require('fs'),path=require('path'),sharp=require('sharp');
sharp.cache(false);sharp.concurrency(1);
async function run(){
 const inputs=JSON.parse(fs.readFileSync(path.join(__dirname,'single-inputs.json'),'utf8'));const rows=[];
 for(const input of inputs)for(const kind of ['near60','q85']){
  const file=path.join(__dirname,`card-${input.frame}-${kind}.webp`);
  const options=kind==='near60'?{lossless:true,quality:100,effort:6}:{quality:85,effort:6,preset:'text',smartSubsample:true,alphaQuality:100};
  const info=await sharp(kind==='near60'?input.near:input.source).webp(options).toFile(file);
  rows.push({frame:input.frame,kind,file,bytes:info.size,options});console.log(input.frame,kind,info.size);
  fs.writeFileSync(path.join(__dirname,'single-results.json'),JSON.stringify(rows,null,2));
 }
}
run().catch(e=>{console.error(e);process.exitCode=1});
