#!/usr/bin/env python3
"""Losslessly repack a Hero Shooter morph GLB with duplicate vertex removal.
No atlas or preview images are embedded beyond the original face texture.
All vertex positions, UV, colours and morph values are preserved *exactly*.
The output retains all original named animation clips.
"""
import struct,sys,json
from pathlib import Path
import numpy as np
DT={5126:('<f4',4),5125:('<u4',4),5123:('<u2',2),5121:('u1',1),5122:('<i2',2)}
D={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}

def load(src):
 raw=src.read_bytes();magic,vers,total=struct.unpack_from('<4sII',raw)
 assert magic==b'glTF' and vers==2 and total==len(raw)
 pos=12;js=None;bn=None
 while pos<len(raw):
  size,kind=struct.unpack_from('<I4s',raw,pos);v=raw[pos+8:pos+8+size];pos+=8+size
  if kind==b'JSON':js=json.loads(v)
  if kind==b'BIN\0':bn=bytearray(v)
 return js,bn

def opt(src,dst):
 obj,old=load(src)
 previous=json.loads(json.dumps(obj));newbin=bytearray();obj['bufferViews']=[];obj['accessors']=[]
 obj['buffers']=[{'byteLength':0}]
 def push(raw,target=34962):
  while len(newbin)%4:newbin.append(0)
  off=len(newbin);newbin.extend(raw)
  while len(newbin)%4:newbin.append(0)
  i=len(obj['bufferViews']);obj['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(raw)})
  if target is not None:obj['bufferViews'][-1]['target']=target
  return i
 def pack(arr,typeid,kind,normalized=None,bounds=False,target=None):
  arr=np.ascontiguousarray(arr);data=arr.astype(DT[typeid][0],copy=False)
  buff=push(data.tobytes(),target)
  n=len(obj['accessors']);a={'bufferView':buff,'componentType':typeid,'count':len(data),'type':kind}
  if normalized is not None:a['normalized']=bool(normalized)
  if bounds:
   v=data.reshape(len(data),-1)
   a['min']=v.min(axis=0).astype(float).tolist();a['max']=v.max(axis=0).astype(float).tolist()
  obj['accessors'].append(a)
  return n
 def get(idx):
  ac=previous['accessors'][idx];bv=previous['bufferViews'][ac['bufferView']]
  fmt,k=DT[ac['componentType']];n=D[ac['type']];start=bv.get('byteOffset',0)+ac.get('byteOffset',0)
  assert bv.get('byteStride',n*k)==n*k
  a=np.frombuffer(old,dtype=fmt,count=ac['count']*n,offset=start).reshape(-1,n)
  return a.copy(),ac
 total_before=total_after=0
 summary=[]
 for m in obj['meshes']:
  for p in m['primitives']:
   pos,pos_a=get(p['attributes']['POSITION']);targets=[get(x['POSITION'])[0] for x in p.get('targets',[])]
   extattrs={k:get(v) for k,v in p['attributes'].items() if k!='POSITION'}
   idx,_=get(p['indices']);indices=idx.ravel().astype(np.int64)
   count=len(pos);total_before+=count
   stack=np.column_stack([pos.astype(np.float32)]+[x.astype(np.float32) for x in targets]+[x.astype(np.float32) for x,a in extattrs.values()])
   rowbytes=np.ascontiguousarray(stack).view(np.dtype((np.void,stack.shape[1]*stack.dtype.itemsize))).ravel()
   _,chosen,inverse=np.unique(rowbytes,return_index=True,return_inverse=True)
   total_after+=len(chosen)
   newidx=inverse[indices]
   posid=pack(pos[chosen],5126,'VEC3',bounds=True,target=34962)
   attrs={'POSITION':posid}
   for key,(values,acc) in extattrs.items():
    attrs[key]=pack(values[chosen],acc['componentType'],acc['type'],normalized=acc.get('normalized'),target=34962)
   idtype=5123 if len(chosen)<=65535 else 5125
   p['indices']=pack(newidx.reshape(-1,1),idtype,'SCALAR',target=34963)
   p['attributes']=attrs
   p['targets']=[{'POSITION':pack(v[chosen],5126,'VEC3',target=34962)} for v in targets]
   summary.append((m['name'],count,len(chosen)))
 old_new={}
 for anim in obj.get('animations',[]):
  for samp in anim['samplers']:
   for key in ['input','output']:
    prev=samp[key]
    if prev not in old_new:
     a,meta=get(prev);old_new[prev]=pack(a,meta['componentType'],meta['type'],normalized=meta.get('normalized'),bounds='min' in meta,target=None)
    samp[key]=old_new[prev]
 for im in obj.get('images',[]):
  if 'bufferView' not in im:continue
  pv=previous['bufferViews'][im['bufferView']];start=pv.get('byteOffset',0)
  im['bufferView']=push(old[start:start+pv['byteLength']],target=None)
 obj['buffers'][0]['byteLength']=len(newbin)
 j=json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode('utf-8');j+=b' '*(-len(j)%4)
 b=bytes(newbin);b+=b'\0'*(-len(b)%4)
 with dst.open('wb') as f:
  f.write(struct.pack('<4sII',b'glTF',2,len(j)+len(b)+28))
  f.write(struct.pack('<I4s',len(j),b'JSON'));f.write(j)
  f.write(struct.pack('<I4s',len(b),b'BIN\0'));f.write(b)
 return {'source_bytes':src.stat().st_size,'optimized_bytes':dst.stat().st_size,'source_vertices':total_before,'optimized_vertices':total_after,'meshes':len(summary),'animations':[a['name'] for a in obj['animations']], 'largest_savings':sorted(summary,key=lambda x:x[1]-x[2],reverse=True)[:8]}

if __name__=='__main__':
 src=Path(sys.argv[1]);out=Path(sys.argv[2]);print(json.dumps(opt(src,out),indent=2))