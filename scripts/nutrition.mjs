const round1 = n => Math.round((n + Number.EPSILON)*10)/10;
async function fdcRequest(zutat) {
  const key = "fdc:" + JSON.stringify(zutat);
  const cached = sessionStorage.getItem(key); if (cached) return JSON.parse(cached);
  const qs = new URLSearchParams({ name:zutat.name, amount:String(zutat.amount??0), unit:(zutat.unit||"g"), approxWeight:String(zutat.approxWeight||60) });
  const res = await fetch("/.netlify/functions/fdc?" + qs.toString(), { cache:"no-cache" });
  const data = await res.json(); sessionStorage.setItem(key, JSON.stringify(data)); return data;
}
export async function aggregateOfficial(ingredients=[]) {
  let total = { kcal:0, protein:0, carbs:0, sugar:0, fat:0, satFat:0, fiber:0, sodium:0, cholesterol:0 };
  for (const ing of ingredients) { const resp = await fdcRequest(ing); if (resp && resp.ok) for (const k of Object.keys(total)) total[k]+=Number(resp.total?.[k]||0); }
  for (const k of Object.keys(total)) total[k]=round1(total[k]); return total;
}
export const perPortion = (total, servings) => Object.fromEntries(Object.entries(total).map(([k,v]) => [k, round1(v / Math.max(1, Number(servings)||1))]));
export function renderMacroPills(el, n){
  if (!el||!n) return;
  let wrap = el.querySelector(".sb-macros"); if(!wrap){ wrap=document.createElement("div"); wrap.className="sb-macros"; el.appendChild(wrap); }
  wrap.innerHTML = `
    <span class="sb-pill sb-pill--kcal">${Math.round(n.kcal)} kcal</span>
    <span class="sb-pill">P ${n.protein} g</span>
    <span class="sb-pill">F ${n.fat} g</span>
    <span class="sb-pill">KH ${n.carbs} g</span>`;
}
async function initCards(){
  const cards = document.querySelectorAll("[data-recipe-card]");
  for (const card of cards) {
    try {
      const ing = JSON.parse(card.getAttribute("data-ingredients")||"[]");
      const servings = Number(card.getAttribute("data-servings")||1);
      const total = await aggregateOfficial(ing);
      renderMacroPills(card, perPortion(total, servings));
    } catch(e){ console.warn("Makros fehlgeschlagen:", e); }
  }
}
window.SB = window.SB || {}; window.SB.nutrition = { aggregateOfficial, perPortion, renderMacroPills };
document.addEventListener("DOMContentLoaded", initCards);
