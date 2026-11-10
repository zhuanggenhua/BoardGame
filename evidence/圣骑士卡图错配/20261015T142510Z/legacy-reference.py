from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,subprocess
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
backup=Path('D:/gongzuo/webgame/gameasset/王权骰铸（全26中文角色）/圣骑士预览备份/20261013T133935Z/original/public/assets/i18n/zh-CN/dicethrone/images/paladin/compressed/ability-cards.webp')
config=json.loads(subprocess.check_output(['git','show','bb2779b45^:src/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json'],cwd=ROOT,text=True,encoding='utf-8'))
image=Image.open(backup).convert('RGBA')
indices=[8,10,20,21,22];sheet=Image.new('RGB',(990,1120),'#eeeeee');draw=ImageDraw.Draw(sheet)
for i,index in enumerate(indices):
    row,col=divmod(index,10);x=config['colStarts'][col];y=config['rowStarts'][row];w=config['colWidths'][col];h=config['rowHeights'][row]
    crop=image.crop((x,y,x+w,y+h));crop.save(OUT/f'legacy-frame-{index:02d}.png')
    draw.text(((i%3)*330+8,(i//3)*560+8),f'legacy index {index}',fill='black')
    crop=crop.resize((330,h*2),Image.Resampling.NEAREST)
    sheet.paste(crop,((i%3)*330,(i//3)*560+28),crop)
sheet.save(OUT/'legacy-five-full-cards.png')
(OUT/'legacy-reference.json').write_text(json.dumps({'file':str(backup),'sha256':hashlib.sha256(backup.read_bytes()).hexdigest(),'config':'bb2779b45^:ability-cards-common.atlas.json','indices':indices},ensure_ascii=False,indent=2),encoding='utf-8')
