import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectRoot,publicFiles} from './public-files.mjs';

const rootFiles=new Set(['.gitignore','.gitattributes','.nvmrc','.java-version','README.md','LICENSE','CONTRIBUIR.md','CONTRIBUTING.md','PUBLIC-MANIFEST.json','SECURITY.md','package.json','package-lock.json','capacitor.config.ts','vite.config.ts','tsconfig.json','playwright.config.ts','index.html']);
const folders=new Set(['src','tests','scripts','docs','public','android','.github']);
const forbiddenFolders=new Set(['node_modules','dist','build','.gradle','.git','.test-artifacts','.playwright-cli','releases','entrega']);
const fixturePdfs=new Set(['nomina-sintetica.pdf','dos-recibos.pdf','once-paginas.pdf'].map(name=>`tests/fixtures/${name}`));
const secretPatterns=[
 ['clave privada',/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
 ['token de acceso',/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,})/],
 ['ruta local personal',/\/(?:home|Users)\/[^/\s]+\/(?:Documentos|Documents|Desktop)\//],
 ['cuenta bancaria española',/\bES\d{2}(?: ?\d){20}\b/],
];

export function checkPublic(){
 const files=publicFiles(),problems=[];
 for(const name of files){
  const parts=name.split('/'),base=parts.at(-1);
  if(name.startsWith('../')||path.isAbsolute(name)||(!folders.has(parts[0])&&!rootFiles.has(name)))problems.push(`${name}: ruta fuera de la copia pública`);
  if(parts.some(part=>forbiddenFolders.has(part))||/\.(?:p12|pfx|jks|keystore|pem|key|apk|aab|db|sqlite3?|ics|csv|zip)$/i.test(name)||/^\.env(?:\.|$)/.test(base)||/^(?:local|release|keystore|signing)\.properties$/.test(base))problems.push(`${name}: archivo privado o generado`);
  if(name.endsWith('.pdf')&&!fixturePdfs.has(name))problems.push(`${name}: PDF ajeno a los ejemplos sintéticos`);
  const target=path.join(projectRoot,name);
  if(!fs.existsSync(target)){problems.push(`${name}: archivo del índice ausente`);continue;}
  if(fs.lstatSync(target).isSymbolicLink()){problems.push(`${name}: enlace simbólico no publicable`);continue;}
  if(!fs.statSync(target).isFile()){problems.push(`${name}: entrada no regular`);continue;}
  if(/\.(?:png|pdf|jar|woff2?)$/.test(name))continue;
  const text=fs.readFileSync(target,'utf8');
  for(const [label,pattern] of secretPatterns)if(pattern.test(text))problems.push(`${name}: posible ${label}`);
  const calendarUrls=text.match(/https:\/\/calendar\.google\.com\/calendar\/ical\/[^\s"'<>]+\/private-[^/\s]+\/basic\.ics/g)??[];
  for(const url of calendarUrls){
   const testFile=name.includes('/tests/')||name.startsWith('tests/')||name.includes('/androidTest/')||name.endsWith('.test.ts');
   const example=/\/(?:example%40group\.calendar\.google\.com|fixture%40example\.invalid|a)\/private-(?:secret|new-secret|test|123)\/basic\.ics$/.test(url);
   if(!(testFile&&example))problems.push(`${name}: enlace privado de calendario`);
  }
  if(name.endsWith('.json')){
   try{const value=JSON.parse(text);if(value.format==='mi-nomina-guardias'&&value.state)problems.push(`${name}: copia de datos de la app`);}catch{problems.push(`${name}: JSON inválido`);}
  }
 }
 if(problems.length)throw new Error('Revisa antes de publicar:\n'+problems.join('\n'));
 console.log(`Comprobación pública: ${files.length} archivos; sin patrones privados detectados. No sustituye la revisión de contenido.`);
 return files;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{checkPublic();}catch(error){console.error(error.message);process.exitCode=1;}
}
