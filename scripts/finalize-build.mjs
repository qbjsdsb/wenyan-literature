import {copyFile,mkdir} from 'node:fs/promises';
for(const dir of ['legacy','legacy/js','legacy/css'])await mkdir('dist/'+dir,{recursive:true});
for(const file of ['index.html','js/app.js','js/data.js','css/style.css'])await copyFile('legacy/'+file,'dist/legacy/'+file);
console.log('Legacy pages preserved');
