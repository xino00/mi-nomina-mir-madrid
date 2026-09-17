import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {checkPublic} from './check-public.mjs';
import {projectRoot} from './public-files.mjs';

const files=checkPublic().filter(name=>name!=='PUBLIC-MANIFEST.json');
const {version}=JSON.parse(fs.readFileSync(path.join(projectRoot,'package.json'),'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Versión inválida.');
const filename=`mi-nomina-publico-${version}.zip`,destination=path.join(projectRoot,'releases',filename);
fs.mkdirSync(path.dirname(destination),{recursive:true});
const result=spawnSync('python3',['-c',`
import hashlib,json,pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1]); output=pathlib.Path(sys.argv[2]); names=json.load(sys.stdin)
manifest=[]
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
 for name in names:
  source=root/name; content=source.read_bytes()
  archive.write(source,'mi-nomina-publico/'+name)
  manifest.append({'path':name,'sha256':hashlib.sha256(content).hexdigest()})
 archive.writestr('mi-nomina-publico/PUBLIC-MANIFEST.json',json.dumps(manifest,indent=2)+'\\n')
with zipfile.ZipFile(output) as archive:
 assert archive.testzip() is None
 for entry in manifest:
  assert hashlib.sha256(archive.read('mi-nomina-publico/'+entry['path'])).hexdigest()==entry['sha256']
print(str(output))
`,projectRoot,destination],{input:JSON.stringify(files),encoding:'utf8'});
if(result.error)throw result.error;
if(result.status!==0)throw new Error(result.stderr||'No se pudo crear el ZIP público.');
const hash=createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
fs.writeFileSync(destination+'.sha256',`${hash}  ${filename}\n`);
console.log(`ZIP público verificado: releases/${filename} (${files.length} archivos y manifiesto).`);
