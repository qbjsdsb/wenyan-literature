import {chromium} from 'playwright';
export function launchBrowser(){const executablePath=process.env.WENYAN_CHROMIUM_EXECUTABLE;return chromium.launch({headless:true,...(executablePath?{executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}: {})});}
