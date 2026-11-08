'use strict';
/* Read-only Git repository preflight: large files and forbidden secrets should not be committed. */
const {execFileSync}=require('node:child_process');const fs=require('node:fs');
const path=require('node:path');
try {
 const names=execFileSync('git',['ls-files','-c','-o','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const bad=[];
 for(const file of names){
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
  if(/(^|\/|\\)(node_modules|storage|__MACOSX|\.git)(\/|\\)/i.test(file)||/(^|\/|\\)\.env($|\.)/i.test(file)||/\.(dump|sqlite3?|log|part)$/i.test(file))bad.push(file+' (excluded path/type)');
  if(fs.statSync(file).size>25*1024*1024)bad.push(file+' (larger than 25 MiB)');
 }
 console.log('Repo source files checked:',names.length);
 if(bad.length){console.error('CHECK BEFORE COMMIT:\n'+bad.join('\n'));process.exitCode=1}
 else console.log('No obvious forbidden or >25 MiB files among tracked/unignored files. Manual review for secrets still required.');
} catch(e){console.error('Run inside a Git repository. Error:',e.message);process.exitCode=1}
