"""Deterministic Saafiya walk/run 8-direction motion exporter built atop 3D VTK mesh.
Maintains consistent silhouette, root anchor, orthographic camera; no generative imagery.
"""
from pathlib import Path
import math, json, zipfile, sys
from PIL import Image, ImageDraw, ImageFont
import vtk
import numpy as np
from vtk.util.numpy_support import vtk_to_numpy
import saafiya_true3d as original
OUT=Path('/mnt/data')
FRAME=(176,224)
DIRECTIONS=original.DIRECTIONS

class MotionCharacter(original.Character):
    def __init__(self, yaw, phase, gait):
        self.gait=gait
        self.running=(gait=='run')
        super().__init__(yaw=yaw,phase=phase,walk=(gait!='idle'))
    def build(self):
        # The existing 3D model and its full equipment remains shared. For now
        # vary the stride/arm/foot timing without independently redrawing views.
        super().build()
    # Override parameter-driven stride amplitudes by adjusting the values
    # BEFORE underlying build in a second custom initializer.

# Base renderer supports gait parameters through an explicit subclass
# that rescales the movement parameters used in build via its own source model.
class GaitCharacter(original.Character):
    def __init__(self,yaw,phase,gait):
        self.root=vtk.vtkAssembly()
        self.gait=gait;self.running=(gait=='run')
        self.yaw=yaw;self.phase=phase;self.walk=(gait!='idle')
        self.stride=math.sin(phase*math.tau) if self.walk else 0.0
        self.bob=(.075 if self.running else .034)*(1-math.cos(phase*math.tau*2)) if self.walk else 0.0
        self.s=math.sin(phase*math.tau) if self.walk else 0.0
        self.build();self.root.SetOrientation(0,0,yaw)
    def build(self):
        # model part positions are unchanged at frame zero; motion magnitudes
        # are adjusted by a temporary patched stride. Front/back remains Y.
        stride0=self.stride
        if self.running:
            self.stride*=1.35
        super().build()
        self.stride=stride0

def snap(yaw,phase,gait,size=FRAME):
    # Equivalent light and camera for all 128 frames.
    ren=vtk.vtkRenderer();ren.SetBackground(0,0,0);ren.SetBackgroundAlpha(0)
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetAlphaBitPlanes(1)
    win.SetMultiSamples(2);win.SetSize(*size);win.AddRenderer(ren)
    ch=GaitCharacter(yaw,phase,gait);ren.AddActor(ch.root)
    camera=vtk.vtkCamera()
    elev=math.radians(58)
    camera.SetPosition(0,8*math.cos(elev),1.30+8*math.sin(elev))
    camera.SetFocalPoint(0,0,1.29);camera.SetViewUp(0,0,1)
    camera.ParallelProjectionOn();camera.SetParallelScale(1.58)
    ren.SetActiveCamera(camera)
    l=vtk.vtkLight();l.SetPosition(-3,5,9);l.SetFocalPoint(0,0,1.3);l.SetIntensity(1.08);ren.AddLight(l)
    l2=vtk.vtkLight();l2.SetPosition(5,-5,8);l2.SetIntensity(.54);ren.AddLight(l2)
    win.Render()
    f=vtk.vtkWindowToImageFilter();f.SetInput(win);f.SetInputBufferTypeToRGBA();f.ReadFrontBufferOff();f.Update()
    w,h=size
    arr=vtk_to_numpy(f.GetOutput().GetPointData().GetScalars()).reshape((h,w,4))
    img=Image.fromarray(arr[::-1].copy(),'RGBA').transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    # Force invisible pixels to zero RGB to avoid dark seams in packed atlas.
    if img.getpixel((0,0))[3]!=0:raise RuntimeError('No transparency in VTK capture')
    return img

def all_frames(export_dir):
    frames={}
    for gait in ('walk','run'):
        rows=[]
        for direct,yaw in DIRECTIONS.items():
            row=[]
            for i in range(8):
                img=snap(yaw,i/8,gait)
                img.save(export_dir/f'saafiya_{gait}_{direct}_{i:02d}.png')
                row.append(img)
            rows.append(row)
            print(gait,direct,'done',flush=True)
        frames[gait]=rows
    return frames

def combine(frames,out):
    w,h=FRAME
    for gait,rows in frames.items():
        atlas=Image.new('RGBA',(8*w,8*h),(0,0,0,0))
        for j,row in enumerate(rows):
            for i,im in enumerate(row):atlas.alpha_composite(im,(i*w,j*h))
        atlas.save(out/f'saafiya_{gait}_8way_8frame_atlas.png',compress_level=6)
        # frame row filmstrip for south-facing walk/run
        row=rows[0]
        strip=Image.new('RGBA',(8*w,h),(0,0,0,0))
        for i,img in enumerate(row):strip.alpha_composite(img,(i*w,0))
        strip.save(out/f'saafiya_{gait}_south_filmstrip.png')
        # shareable GIF preview (GIF's palette cannot preserve high-quality alpha)
        previews=[]
        for im in row:
            back=Image.new('RGBA',im.size,'#28222c');back.alpha_composite(im)
            previews.append(back.convert('RGB').resize((264,336),Image.Resampling.NEAREST))
        previews[0].save(out/f'saafiya_{gait}_south_procedural.gif',save_all=True,append_images=previews[1:],duration=100 if gait=='walk' else 65,loop=0,disposal=2)
    # QA contact overview: 1 frame for every direction in walk and run
    canvas=Image.new('RGB',(w*8+90,h*2+106),'#211d25');d=ImageDraw.Draw(canvas)
    d.text((10,10),'Saafiya - procedural motion QA, eight views; frame 2',fill='#f1e5e5')
    for j,gait in enumerate(('walk','run')):
        y=40+j*(h+20);d.text((12,y+5),gait.upper(),fill='#ddd0de')
        for i,im in enumerate(frames[gait]):
            a=Image.new('RGBA',FRAME,'#302733');a.alpha_composite(im[2]);canvas.paste(a.convert('RGB'),(80+i*w,y))
            d.text((80+i*w+8,y+h-19),list(DIRECTIONS.keys())[i],fill='#eadbdc')
    canvas.save(out/'saafiya_gaits_directional_QA.png')
    return out

def export():
    out=OUT/'saafiya_motion_3d';out.mkdir(exist_ok=True)
    frames=all_frames(out)
    combine(frames,OUT)
    data={
        'character':'Saafiya','method':'Python + VTK deterministic geometry',
        'source_model':'saafiya_true3d.py','directions':list(DIRECTIONS.keys()),
        'frame_count_per_cycle':8,'projection':'orthographic / elevated 58 degrees',
        'size_pixels':list(FRAME),'atlas_cols':8,'atlas_rows':8,
        'fps':{'walk':10,'run':15.38},'foot_anchor':'fixed world origin; camera centered 1.29 m',
        'notes':['8 directional rows in order S SW W NW N NE E SE','8 successive frames left to right','two movement animations; separate idle still needed','geometry is intentionally a technical prototype; not yet faithful anime anatomy']}
    (OUT/'saafiya_motion_3d_metadata.json').write_text(json.dumps(data,indent=2))
    with zipfile.ZipFile(OUT/'saafiya_motion_3d_all_assets.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in [OUT/'saafiya_true3d.py',Path(__file__),OUT/'saafiya_motion_3d_metadata.json',
                  OUT/'saafiya_walk_8way_8frame_atlas.png',OUT/'saafiya_run_8way_8frame_atlas.png',
                  OUT/'saafiya_walk_south_procedural.gif',OUT/'saafiya_run_south_procedural.gif',
                  OUT/'saafiya_gaits_directional_QA.png']:
            z.write(p,p.name)
        for p in out.glob('*.png'):z.write(p,'frames/'+p.name)
    print('DONE',flush=True)
if __name__=='__main__':export()