#!/usr/bin/env python3
"""2D anime expression textures mapped onto C's curved head surface.
1024x1024, UV origin bottom-left. Do not copy/paste 3D floating eyes/lips.
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import math, random

S = 1024

def curve(draw, points, fill, width, steps=36):
    # Cubic Bezier, sampled for antialiased painting at image resolution
    if len(points) != 4: raise ValueError('Bezier needs 4 points')
    xy=[]
    for k in range(steps+1):
        t=k/steps; u=1-t
        xy.append((u*u*u*points[0][0]+3*u*u*t*points[1][0]+3*u*t*t*points[2][0]+t*t*t*points[3][0],
                   u*u*u*points[0][1]+3*u*u*t*points[1][1]+3*u*t*t*points[2][1]+t*t*t*points[3][1]))
    draw.line(xy, fill=fill, width=width, joint='curve')
    return xy

def draw_face(path, expression='smirk'):
    # UV-spanning skin colour. Body skin uses the same source palette.
    im=Image.new('RGBA',(S,S),(200,138,103,255))
    px=im.load()
    # Gentle painted illumination, no photographic texture; keeps expression readable at game scale.
    for y in range(S):
        for x in range(S):
            u=x/S; v=1-y/S
            cx=1-max(0,min(1,abs(u-.5)/.25))
            tone=int(12*cx+4*math.cos((v-.65)*math.pi))
            px[x,y]=(min(255,197+tone),min(255,131+int(tone*.9)),min(255,96+int(tone*.65)),255)
    # cheeks/temple wash with transparent blending
    blush=Image.new('RGBA',(S,S),(0,0,0,0))
    bd=ImageDraw.Draw(blush)
    for xx in [399,624]:
        bd.ellipse((xx-74,488,xx+74,605),fill=(203,89,86,42))
    blush=blush.filter(ImageFilter.GaussianBlur(28))
    im=Image.alpha_composite(im,blush)
    d=ImageDraw.Draw(im)
    ink=(41,24,29,255); ink2=(79,40,41,255); lash=(35,23,29,255)
    sclera=(240,215,191,255)
    iris=(111,64,43,255)
    amber=(182,109,57,255)
    dark=(48,30,33,255)
    # Large hand-painted anime eyes, sized for low-resolution game camera reads.
    for side in [-1,1]:
        x=512+side*82; y=392
        if expression=='blink':
            curve(d,[(x-60,y),(x-22,y+14),(x+25,y+16),(x+60,y)],lash,11)
            curve(d,[(x-40,y+10),(x-9,y+22),(x+29,y+18),(x+42,y+7)],ink2,4)
        else:
            # A softly angular open almond eye with a prominent amber iris.
            d.polygon([(x-61,y+2),(x-42,y-25),(x-14,y-43),(x+18,y-43),
                       (x+44,y-26),(x+61,y+2),(x+39,y+31),(x+4,y+42),
                       (x-36,y+30)],fill=sclera)
            # Color blocks are flat *paint* on one textured head surface.
            d.ellipse((x-29,y-39,x+29,y+40),fill=iris)
            d.ellipse((x-22,y-27,x+22,y+35),fill=amber)
            d.ellipse((x-15,y-35,x+15,y+22),fill=dark)
            d.ellipse((x-21,y-25,x-5,y-7),fill=(255,248,230,255))
            d.ellipse((x+14,y+14,x+20,y+19),fill=(255,230,185,255))
            # Dense upper liner with tapered, slightly upswept outward flick.
            curve(d,[(x-60,y+3),(x-31,y-42),(x+24,y-47),(x+61,y-2)],lash,12)
            curve(d,[(x-57,y+9),(x-22,y+40),(x+28,y+46),(x+56,y+12)],ink2,4)
            if side<0:
                d.polygon([(x-60,y+6),(x-79,y-24),(x-62,y-12)],fill=lash)
                d.polygon([(x-54,y+4),(x-70,y-11),(x-57,y-5)],fill=lash)
            else:
                d.polygon([(x+60,y+6),(x+79,y-24),(x+62,y-12)],fill=lash)
                d.polygon([(x+54,y+4),(x+70,y-11),(x+57,y-5)],fill=lash)
        # Graphic brows have a distinct angled silhouette, but remain friendly.
        if side<0:
            d.polygon([(x-60,241),(x-26,251),(x+30,252),(x+52,267),
                       (x+20,273),(x-20,265)],fill=ink)
        else:
            d.polygon([(x-52,267),(x-30,252),(x+26,251),(x+60,241),
                       (x+20,265),(x-20,273)],fill=ink)
    # nose: two painted brush strokes, no separate nose capsule
    curve(d,[(510,552),(507,595),(500,619),(503,630)],(151,89,73,255),4)
    curve(d,[(495,633),(508,641),(524,631),(526,631)],(119,70,63,255),5)
    d.ellipse((490,637,497,641),fill=(112,65,60,255))
    d.ellipse((526,637,532,641),fill=(112,65,60,255))
    # sprinkle a few small freckles across both cheekbones
    rng=random.Random(17)
    for cx in (405,615):
        for k in range(14):
            xx=cx+rng.randint(-49,44); yy=545+rng.randint(-36,36)
            size=rng.choice([2,2,3,4]); c=(135,78,59,255)
            d.ellipse((xx,yy,xx+size,yy+size),fill=c)
    # mouth at z=1.61, asymmetric smirk lifted on C's right (viewer left).
    if expression=='neutral':
        curve(d,[(460,799),(492,805),(529,805),(563,799)],ink2,5)
        curve(d,[(473,811),(505,816),(529,812),(550,808)],(174,97,87,255),8)
    elif expression=='determined':
        curve(d,[(458,794),(488,786),(534,790),(563,800)],ink2,7)
        d.polygon([(470,798),(491,801),(540,804),(557,801),(537,813),(492,809)],fill=(173,94,89,255))
    else:
        # viewer-left mouth corner rises; confident half-smile, not aggressive teeth or grimace
        curve(d,[(454,775),(475,802),(528,811),(564,793)],ink2,6)
        curve(d,[(457,779),(475,802),(503,806),(522,807)],(124,63,61,255),3)
        curve(d,[(471,814),(508,829),(538,818),(553,809)],(174,96,91,255),9)
        curve(d,[(482,814),(514,826),(533,822),(544,814)],(207,131,115,255),3)
        d.ellipse((452,773,460,780),fill=ink2)
    # warm shadow under lower lip, drawn translucently
    shade=Image.new('RGBA',(S,S),(0,0,0,0));sd=ImageDraw.Draw(shade)
    sd.ellipse((475,828,548,850),fill=(113,62,55,30));shade=shade.filter(ImageFilter.GaussianBlur(11))
    im=Image.alpha_composite(im,shade)
    im.convert('RGB').save(path,optimize=True)
    return im

def build_texture_variants(out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    result={}
    for expression in ['smirk','neutral','blink','determined']:
        path=out/f'C_face_anime_{expression}.png'
        draw_face(path,expression)
        result[expression]=str(path)
    return result

if __name__=='__main__':
    import sys
    print(build_texture_variants(sys.argv[1] if len(sys.argv)>1 else '/mnt/data/C_unarmed_VTK_v3'))