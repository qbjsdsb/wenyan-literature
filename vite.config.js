import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({mode})=>{
  const env={...loadEnv(mode,process.cwd(),'VITE_'),...process.env};
  const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(Boolean(url)!==Boolean(key))throw Error('Configure both Supabase URL and browser publishable key');
  if(key){let anon=false;try{anon=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}if(!key.startsWith('sb_publishable_')&&!anon)throw Error('Supabase browser build requires a publishable or anon key');}
  return {
  // Keep production output portable so a personal deployment can live at either
  // the domain root or a project subpath without rewriting English data URLs.
  base: './',
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local']
  },
  build: {
    outDir: 'dist',
    manifest: true,
    rollupOptions: {input: {app:'index.html',cloudValidation:'tests/hosted-sync.html',consent:'oauth/consent.html'}}
  }
};});
