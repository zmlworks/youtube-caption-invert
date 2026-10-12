import json; from PIL import Image
r=json.load(open('./shots.json'))
for k,v in r.items():
    im=Image.open(v['file']).convert('RGB'); b=v['box']
    # sample the centre row of the block-glyph run (middle 50% horizontally)
    y=int(b['y']+b['h']*0.55); xs=range(int(b['x']+b['w']*0.3), int(b['x']+b['w']*0.7), 4)
    from collections import Counter
    c=Counter(im.getpixel((x,y)) for x in xs)
    print(f"{k:22s}", c.most_common(2))
