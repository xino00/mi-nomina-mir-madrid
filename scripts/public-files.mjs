import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const excluded=new Set(['.git','node_modules','dist','build','.gradle','.idea','.vscode','.test-artifacts','.playwright-cli','test-results','playwright-report','coverage','releases','release','entrega','__pycache__','capacitor-cordova-android-plugins']);
function generated(name){return name.startsWith('android/app/src/main/assets/')||name==='android/app/src/main/res/xml/config.xml'||name==='android/local.properties';}

export function publicFiles(){
 const root=spawnSync('git',['rev-parse','--show-toplevel'],{cwd:projectRoot,encoding:'utf8'});
 if(root.status===0&&path.resolve(root.stdout.trim())===projectRoot){
  // Includes force-added ignored files, so the publication check can reject them.
  const list=spawnSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:projectRoot,encoding:'utf8'});
  if(list.status!==0)throw new Error('No se pudo revisar el índice Git.');
  return [...new Set(list.stdout.split('\0').filter(Boolean))].sort();
 }
 const result=[];
 function visit(folder=''){
  for(const entry of fs.readdirSync(path.join(projectRoot,folder),{withFileTypes:true})){
   if(excluded.has(entry.name))continue;
   const relative=path.posix.join(folder,entry.name);
   if(generated(relative)||entry.name.endsWith('.log')||entry.name.endsWith('.pyc'))continue;
   if(entry.isDirectory())visit(relative);else result.push(relative);
  }
 }
 visit();return result.sort();
}
