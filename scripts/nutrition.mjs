/**
 * Aggregate via USDA proxy (/fdc). Renders macro pills on cards.
 */
const round1 = (n)=>Math.round((n+Number.EPSILON)*10)/10;
async function fdcRequest(z){
  const qs = new URLSearchParams({
    name: z.name,
    amount: String(z.amount ?? 0),
    unit: (z.unit || "g"),
    approxWeight: String(z.approxWeight || 60)
  });
  const res = await fetch('/.netlify/functions/fdc?'+qs.toString(),{cache:'no-cache'});
  return res.json();
}
export async function aggregateOfficial(ingredients=[]){
  const total = {kcal:0,protein:0,carbs:0,sugar:0,fat:0,satFat:0,fiber:0,sodium:0,cholesterol:0};
  for(const ing of ingredients){
    try{
      const r = await fdcRequest(ing);
      if(r && r.ok){
        for(const k of Object.keys(total)) total[k]+=Number(r.total?.[k]||0);
      }
    }catch(e){}
  }
  for(const k of Object.keys(total)) total[k]=round1(total[k]);
  return total;
}
export function perPortion(total, servings){
  const s=Math.max(1,Number(servings)||1); const out={};
  for(const [k,v] of Object.entries(total)) out[k]=round1(v/s);
  return out;
}
export function renderMacroPills(el, n){
  if(!el||!n) return;
  let wrap=el.querySelector('.sb-macros');
  if(!wrap){ wrap=document.createElement('div'); wrap.className='sb-macros'; el.appendChild(wrap); }
  wrap.innerHTML=\
    <span class="sb-pill sb-pill--kcal">\ kcal</span>
    <span class="sb-pill">P \ g</span>
    <span class="sb-pill">F \ g</span>
    <span class="sb-pill">KH \ g</span>\;
}
window.SB = window.SB || {};
window.SB.nutrition = { aggregateOfficial, perPortion, renderMacroPills };