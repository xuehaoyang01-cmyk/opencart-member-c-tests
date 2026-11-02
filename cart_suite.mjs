// Shared browser test logic. Executed through the CUA adapter and reusable
// with the standalone Playwright adapter in run.mjs. Only visible UI is used.
export const BASE = 'https://opencart.abstracta.us/';
export const CART = BASE + 'index.php?route=checkout/cart';
export const product = id => BASE + 'index.php?route=product/product&product_id=' + id;
export const scenarios = [
  {id:'T007-S1',name:'Add one iPhone to an empty cart',kind:'add_one'},
  {id:'T007-S2',name:'Add the same iPhone twice',kind:'add_repeat'},
  {id:'T007-S3',name:'Reject Canon EOS 5D without its required option',kind:'add_missing_option'},
  {id:'T008-S1',name:'Increase iPhone quantity from one to three',kind:'increase'},
  {id:'T008-S2',name:'Decrease iPhone quantity from three to one',kind:'decrease'},
  {id:'T008-S3',name:'Set quantity to zero and remove the line',kind:'zero'},
  {id:'T009-S1',name:'Remove the only item',kind:'remove_only'},
  {id:'T009-S2',name:'Remove one product and retain the other',kind:'remove_one_of_two'},
  {id:'T009-S3',name:'Remove a line containing three units',kind:'remove_multiple_units'}
];
export class CheckFailure extends Error {}
function check(condition, message) { if (!condition) throw new CheckFailure(message); }

// Read DOM-rendered values, never backend APIs or hidden application state.
export async function readCart(a) {
  return a.p.evaluate(() => {
    const money = s => Math.round(Number(s.replace(/[^0-9.-]/g,''))*100);
    const root = document.querySelector('#content');
    const rows = Array.from(root.querySelectorAll('tr')).filter(r=>r.querySelector('input[name^="quantity["]')).map(r=>{
      const cells=Array.from(r.querySelectorAll('td'));
      const link=cells[1].querySelector('a');
      return {id:new URL(link.href).searchParams.get('product_id'),name:link.textContent.trim(),
        quantity:r.querySelector('input').value,unit:money(cells[4].innerText),line:money(cells[5].innerText)};
    });
    const totalRow=Array.from(root.querySelectorAll('tr')).find(r=>r.cells.length===2 && r.cells[0].innerText.trim()==='Total:');
    return {url:location.href,heading:root.querySelector('h1')?.innerText,rows,
      empty:root.innerText.includes('Your shopping cart is empty!'),
      total:totalRow?money(totalRow.cells[1].innerText):0,
      stockWarning:document.body.innerText.includes('not available in the desired quantity'),
      text:root.innerText};
  });
}

export function createActions(a) {
  async function open(url) { if(await a.url()===url) await a.reload(); else await a.goto(url); await a.observe(); }
  async function capture(label) { await a.observe(); await a.capture(label); }
  async function cart() { await open(CART); return readCart(a); }
  async function remove(id) {
    // Scope the Remove control to the target product row, not its screen position.
    const row=a.p.getByRole('row').filter({has:a.p.getByRole('link',{name:id==='40'?'iPhone':'MacBook',exact:true})});
    await a.navigateClick(()=>row.locator('button[data-original-title="Remove"]').click());
    await row.waitFor({state:'hidden'});
    await a.observe();
  }
  async function reset() {
    let s=await cart();
    check(s.rows.every(r=>['40','43'].includes(r.id)), 'Unexpected cart contents: reset refused');
    for(const row of s.rows) await remove(row.id);
    s=await readCart(a); check(s.empty && s.rows.length===0,'Precondition: empty cart');
  }
  async function add(id='40',qty=1) {
    await open(product(id));
    await a.p.locator('#input-quantity').fill(String(qty));
    await a.p.locator('#button-cart').click();
    await a.p.getByText('Success: You have added',{exact:false}).waitFor({state:'visible'});
    await a.observe();
  }
  async function update(qty) {
    await a.p.locator('input[name^="quantity["]').fill(String(qty));
    await a.navigateClick(()=>a.p.locator('button[data-original-title="Update"]').click());
    if(qty===0) await a.p.locator('#content').getByText('Your shopping cart is empty!',{exact:true}).waitFor({state:'visible'});
    else await a.p.getByText('Success: You have modified your shopping cart!',{exact:false}).waitFor({state:'visible'});
    await a.observe();
  }
  function assertSingle(s,qty,unit) {
    check(s.rows.length===1 && s.rows[0].id==='40','Exactly one iPhone row must exist');
    check(s.rows[0].quantity===String(qty),`Expected quantity ${qty}; got ${s.rows[0].quantity}`);
    check(s.rows[0].line===s.rows[0].unit*qty,'Line total must equal displayed unit price times quantity');
    if(unit!==undefined) check(s.rows[0].unit===unit,'Unit price must remain unchanged');
    check(s.total===s.rows[0].line,'Cart total must equal the sole line total without shipping or discounts');
  }
  function assertEmpty(s) { check(s.empty && s.rows.length===0 && s.total===0,'Expected empty cart and no chargeable line'); }
  async function execute(sc) {
    await reset();
    let before=null, after=null, detail='';
    if(sc.kind==='add_one') {
      await add(); await capture(sc.id+'_added'); after=await cart(); assertSingle(after,1);
    } else if(sc.kind==='add_repeat') {
      await add(); before=await cart(); await capture(sc.id+'_before');
      await add(); after=await cart(); assertSingle(after,2,before.rows[0].unit);
    } else if(sc.kind==='add_missing_option') {
      await open(product('30'));
      await a.p.locator('#button-cart').click();
      await a.p.getByText('Select required!',{exact:true}).waitFor({state:'visible'});
      await capture(sc.id+'_validation');
      detail='Required Select left blank; Select required! appeared.';
      after=await cart(); assertEmpty(after);
    } else if(['increase','decrease','zero'].includes(sc.kind)) {
      await add('40',sc.kind==='decrease'?3:1); before=await cart(); await capture(sc.id+'_before');
      await update(sc.kind==='increase'?3:sc.kind==='decrease'?1:0);
      after=await readCart(a);
      if(sc.kind==='zero') assertEmpty(after);
      else assertSingle(after,sc.kind==='increase'?3:1,before.rows[0].unit);
    } else if(sc.kind==='remove_one_of_two') {
      await add('40',1); await add('43',1); before=await cart(); await capture(sc.id+'_before');
      check(before.rows.length===2,'Precondition: two distinct product lines');
      const retained=before.rows.find(r=>r.id==='43'); check(!!retained,'MacBook precondition');
      await remove('40'); after=await readCart(a);
      check(after.rows.length===1 && after.rows[0].id==='43','Only MacBook should remain');
      check(after.rows[0].quantity===retained.quantity && after.rows[0].line===retained.line,'Retained product must remain unchanged');
      check(after.total===retained.line,'Cart total must be recalculated for the retained item');
    } else {
      await add('40',sc.kind==='remove_multiple_units'?3:1); before=await cart(); await capture(sc.id+'_before');
      await remove('40'); after=await readCart(a); assertEmpty(after);
    }
    await capture(sc.id+'_after');
    // Reload checks server persistence; an input changing visually is insufficient.
    await a.reload(); await a.observe();
    const persisted=await readCart(a);
    check(JSON.stringify(persisted.rows)===JSON.stringify(after.rows) && persisted.total===after.total && persisted.empty===after.empty,'Cart result must persist after reload');
    await capture(sc.id+'_persisted');
    return {before,after,persisted,detail};
  }
  return {execute,reset,capture,cart};
}

export async function runScenario(a, sc) {
  const started=new Date().toISOString();
  let result;
  try { result={...sc,status:'PASS',...await createActions(a).execute(sc)}; }
  catch(e) {
    await a.observe().catch(()=>{}); await a.capture(sc.id+'_failure').catch(()=>{});
    result={...sc,status:e instanceof CheckFailure?'FAIL':'ERROR',error:String(e)};
  }
  return {...result,started,finished:new Date().toISOString()};
}
