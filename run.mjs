// Standalone adapter for the same cart_suite.mjs executed in the supplied evidence.
// Browser actions are sequential; a fresh context prevents interference with users.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {scenarios,runScenario,createActions} from './cart_suite.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(root,'runs',stamp);
await fs.mkdir(out,{recursive:true});
const filter=process.argv.find(x=>/^T00[789]$/.test(x));
const browser=await chromium.launch({headless:!process.argv.includes('--headed')});
const context=await browser.newContext({viewport:{width:1280,height:900},locale:'en-AU',timezoneId:'Australia/Sydney'});
const page=await context.newPage();
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(30000);
await context.tracing.start({screenshots:true,snapshots:true});
const a={p:page,url:async()=>page.url(),goto:u=>page.goto(u,{waitUntil:'domcontentloaded'}),
  reload:()=>page.reload({waitUntil:'domcontentloaded'}),observe:async()=>{},
  navigateClick:async f=>{await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),f()]);},
  capture:async name=>{await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
    await fs.writeFile(path.join(out,name+'.txt'),await page.locator('body').innerText());}};
const results=[];
try {
  for(const sc of scenarios.filter(s=>!filter||s.id.startsWith(filter))) {
    const r=await runScenario(a,sc); results.push(r);
    console.log(`${r.id}: ${r.status}${r.error?' '+r.error:''}`);
    await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
  }
  await createActions(a).reset();
} finally {
  await fs.writeFile(path.join(out,'environment.json'),JSON.stringify({timestamp:stamp,platform:os.platform(),release:os.release(),arch:os.arch(),node:process.version,browser:browser.version(),adapter:'standalone Playwright'},null,2));
  await context.tracing.stop({path:path.join(out,'trace.zip')});
  await browser.close();
}
console.log('Results saved to '+out);
process.exitCode=results.some(r=>r.status!=='PASS')?1:0;
