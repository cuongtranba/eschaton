import sys, os
from PIL import Image
d=sys.argv[1]; names=sys.argv[2].split(","); out=sys.argv[3]; W=int(sys.argv[4]) if len(sys.argv)>4 else 1400
ims=[]
for n in names:
    im=Image.open(os.path.join(d,n+".png")).convert("RGBA")
    bg=Image.new("RGBA",im.size,(241,231,210,255) if not n.startswith("ink") else (225,212,186,255)); bg.alpha_composite(im); ims.append(bg.convert("RGB"))
cols=2; scale=W/cols
rows=[ims[i:i+cols] for i in range(0,len(ims),cols)]
th=[int(max(im.height*scale/im.width for im in r)) for r in rows]
sheet=Image.new("RGB",(W,sum(th)),(90,90,90)); y=0
for r,h in zip(rows,th):
    x=0
    for im in r:
        t=im.resize((int(scale),int(im.height*scale/im.width))); sheet.paste(t,(x,y)); x+=int(scale)
    y+=h
sheet.save(out)
