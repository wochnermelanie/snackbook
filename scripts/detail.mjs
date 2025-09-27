/**
 * Detail: Portionen-Stepper + Live-Nährwerte
 * Markup-Konvention (flexibel, IDs nicht zwingend):
 * <section data-recipe-detail
 *          data-title="Zimtschneckenkuchen"
 *          data-cover="/img.jpg"
 *          data-servings="3.5"
 *          data-ingredients="[ {name,amount,unit,approxWeight?}, ... ]"
 *          data-steps="[ {text, subIngredients?}, ... ]">
 *   <div class="sb-detail-bar">
 *     <div class="sb-stepper" data-stepper>
 *       <button type="button" data-dec aria-label="Portion verringern">–</button>
 *       <output data-servings-output>3,5</output>
 *       <button type="button" data-inc aria-label="Portion erhöhen">+</button>
 *     </div>
 *     <div class="sb-macros-line" data-macros></div>
 *   </div>
 *   <ul data-ingredients-list>
 *     <!-- optional: Zeilen, sonst werden sie generiert -->
 *     <!-- <li class="sb-ing"><strong data-qty data-amount="105" data-unit="g"></strong><span>Mehl</span></li> -->
 *   </ul>
 *   <button class="sb-btn" data-cook-start><span class="ms">restaurant</span> Jetzt kochen</button>
 * </section>
 */
const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
const fmt = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 });
const DECIMALS_BY_UNIT = { g: 0, ml: 0, stk: 1, 'stück':1 };

function normalizeUnit(u='g'){
  u = String(u).toLowerCase().trim();
  if (u === 'st' || u === 'st.') u = 'stk';
  if (u === 'n.b.' || u === 'nb' || u === 'n.b') u = 'n.b.';
  if (u === 'gramm') u = 'g';
  return u;
}
function fmtAmount(val, unit){
  const d = DECIMALS_BY_UNIT[normalizeUnit(unit)] ?? 1;
  return fmt.format(round1(Number(val))) + (unit ? ' ' + unit : '');
}
function ensureListLines(root, ings=[]){
  const list = root.querySelector('[data-ingredients-list]');
  if (!list) return;
  if (list.children.length) return;
  for (const ing of ings){
    const li = document.createElement('li');
    li.className = 'sb-ing';
    const q = document.createElement('strong');
    q.setAttribute('data-qty','');
    q.setAttribute('data-amount', String(ing.amount ?? 0));
    q.setAttribute('data-unit', ing.unit || 'g');
    q.textContent = fmtAmount(ing.amount, ing.unit || 'g');
    const n = document.createElement('span');
    n.textContent = ing.name;
    li.appendChild(q); li.appendChild(n);
    list.appendChild(li);
  }
}

async function recalc(root){
  const servings = Number(root.dataset.servings || 1) || 1;
  const baseServ = Number(root.dataset.baseServings || servings) || servings;
  const ings = JSON.parse(root.dataset.ingredients || '[]');
  const factor = servings / baseServ;

  // Mengen im UI skalieren
  root.querySelectorAll('[data-qty]').forEach(el=>{
    const a = Number(el.getAttribute('data-amount') || 0);
    const u = normalizeUnit(el.getAttribute('data-unit') || 'g');
    el.textContent = fmtAmount(a * factor, u);
  });

  // Nährwerte (offiziell via USDA + /fdc)
  let total;
  try {
    total = await window.SB?.nutrition?.aggregateOfficial(
      ings.map(i => ({...i, amount: (Number(i.amount||0) * factor)}))
    );
  } catch(e){ total = null; console.warn('Nährwerte fehlgeschlagen', e); }

  // pro Portion + Anzeige
  const macrosEl = root.querySelector('[data-macros]');
  if (macrosEl && total){
    const per = window.SB.nutrition.perPortion(total, servings);
    macrosEl.innerHTML = `
      <span class="sb-macro sb-macro--kcal">${Math.round(per.kcal)} kcal</span>
      <span class="sb-macro">P ${fmt.format(per.protein)} g</span>
      <span class="sb-macro">F ${fmt.format(per.fat)} g</span>
      <span class="sb-macro">KH ${fmt.format(per.carbs)} g</span>
    `;
  }

  // Stepper Output
  const out = root.querySelector('[data-servings-output]');
  if (out) out.textContent = fmt.format(servings);
}

// Bootstrap
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('[data-recipe-detail]').forEach(root=>{
    const sv = Number(root.dataset.servings || 1) || 1;
    if (!root.dataset.baseServings) root.dataset.baseServings = String(sv);

    // Zutatenzeilen generieren (falls leer)
    const ings = JSON.parse(root.dataset.ingredients || '[]');
    ensureListLines(root, ings);

    // Stepper Events
    const stepper = root.querySelector('[data-stepper]');
    const set = (v)=>{ v = Math.max(0.5, Math.round(v*10)/10); root.dataset.servings = String(v); recalc(root); };
    stepper?.querySelector('[data-inc]')?.addEventListener('click', ()=> set(Number(root.dataset.servings||1)+0.5));
    stepper?.querySelector('[data-dec]')?.addEventListener('click', ()=> set(Number(root.dataset.servings||1)-0.5));

    recalc(root);
  });
});
export {};

