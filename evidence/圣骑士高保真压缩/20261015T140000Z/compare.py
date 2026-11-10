from benchmark import OUT, OLD, SOURCE
from PIL import Image,ImageDraw
import json
files={'source':SOURCE,'near60':OUT/'near-60-noexact.webp',
       'q85':OLD/'pilot/sample--text-q85.webp','current':OLD/'preprocess-pilot/edge-protected-09.webp'}
sheet=Image.new('RGB',(1472,1210),'#dddddd');draw=ImageDraw.Draw(sheet)
for i,name in enumerate(['source','near60']):
    im=Image.open(files[name]).convert('RGBA').crop((0,0,736,1178))
    draw.text((i*736+8,8),name,fill='black');sheet.paste(im,(i*736,32),im)
sheet.save(OUT/'card0-source-near60.png')
for tile,name,box in [(0,'card0',(150,350,650,620)),(4,'tip',(20,280,620,560))]:
    width,height=box[2]-box[0],box[3]-box[1]
    sheet=Image.new('RGB',(width*2,(height+28)*2),'#dddddd');draw=ImageDraw.Draw(sheet)
    for i,(label,file) in enumerate(files.items()):
        x=(i%2)*width;y=(i//2)*(height+28)
        im=Image.open(file).convert('RGBA').crop((box[0]+736*tile,box[1],box[2]+736*tile,box[3]))
        draw.text((x+8,y+7),label,fill='black');sheet.paste(im,(x,y+28),im)
    sheet.save(OUT/f'text-{name}.png')
