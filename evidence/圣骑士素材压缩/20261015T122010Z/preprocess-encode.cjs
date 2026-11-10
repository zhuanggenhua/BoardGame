// 和上一轮推荐参数相同，仅比较预处理是否值得采用。
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
sharp.cache(false);sharp.concurrency(2);
async function run(){
  const phase=process.argv[2]||'pilot';
  const rows=JSON.parse(fs.readFileSync(path.join(__dirname,`preprocess-${phase}-inputs.json`),'utf8'));
  const records=[];
  for(const row of rows){
    const file=path.join(__dirname,`preprocess-${phase}`,(phase==='pilot'?row.id:row.asset)+'.webp');
    const info=await sharp(row.file).webp({quality:75,effort:6,preset:'text',smartSubsample:true,alphaQuality:100}).toFile(file);
    records.push({...row,file,bytes:info.size,width:info.width,height:info.height});
    fs.writeFileSync(path.join(__dirname,`preprocess-${phase}-results.json`),JSON.stringify(records,null,2));
    console.log(row.id,info.size);
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
