// Reproduces the adapter used for the included live evidence.
// Pass an existing CUA tab and an absolute evidence directory from cua_repl.
import fs from 'node:fs/promises';
import path from 'node:path';
export async function createCuaAdapter(tab,out) {
  await fs.mkdir(out,{recursive:true});
  return {p:tab.playwright,url:()=>tab.url(),goto:u=>tab.goto(u),reload:()=>tab.reload(),
    observe:()=>tab.getAXState({emit:false}),
    navigateClick:f=>tab.playwright.expectNavigation(f,{waitUntil:'domcontentloaded'}),
    capture:async name=>{
      await fs.writeFile(path.join(out,name+'.png'),await tab.screenshot({fullPage:true}));
      await fs.writeFile(path.join(out,name+'.txt'),await tab.getAXState({emit:false,disableDiffing:true}));
    }};
}
