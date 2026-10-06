import {copyFile,mkdir} from 'node:fs/promises';
for(const dir of ['legacy','legacy/js','legacy/css'])await mkdir('dist/'+dir,{recursive:true});
for(const file of ['index.html','js/app.js','js/data.js','css/style.css'])await copyFile('legacy/'+file,'dist/legacy/'+file);
console.log('Legacy pages preserved');

// Versioned desktop offline shell. Never cache authentication or learning APIs.
const {readdir,readFile,writeFile}=await import('node:fs/promises');
const {createHash}=await import('node:crypto');
const assets=(await readdir('dist/assets')).filter(name=>/\.(js|css|woff2)$/.test(name)).map(name=>'assets/'+name);
const files=['index.html','data/english/netem-v1.json','data/english/ecdict-v1.json',...assets];
const hash=createHash('sha256');for(const file of files)hash.update(await readFile('dist/'+file));
const version=hash.digest('hex').slice(0,16);
await writeFile('dist/sw.js',`const CACHE='wenyan-shell-${version}';
const FILES=${JSON.stringify(files)};
const ROOT=new URL('./',self.location.href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new URL(path,ROOT).href)))));
// No skipWaiting: a running study group keeps its version until all tabs close.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('wenyan-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname)||url.search)return;
 const relative=url.pathname.slice(ROOT.pathname.length);
 if(req.mode==='navigate'&&(relative===''||relative==='index.html')){event.respondWith(caches.open(CACHE).then(cache=>cache.match(new URL('index.html',ROOT).href)).then(cached=>cached||fetch(req)));return;}
 if(FILES.includes(relative))event.respondWith(caches.open(CACHE).then(cache=>cache.match(req)).then(cached=>cached||fetch(req)));
});
`);
console.log('Offline desktop shell '+version);
