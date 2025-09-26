/**
 * Kochmodus Vollbild
 * Trigger: Button mit [data-cook-start] innerhalb [data-recipe-detail]
 * Quelle Steps: JSON in data-steps am [data-recipe-detail]
 */
const fmt = new Intl.NumberFormat("de-AT",{maximumFractionDigits:1});

function el(html){ const d=document.createElement("div"); d.innerHTML=html.trim(); return d.firstElementChild; }

function mountCook(root){
  const dataSteps = JSON.parse(root.dataset.steps || "[]");
  if (!dataSteps.length){ alert("Keine Schritte hinterlegt."); return; }

  const title = root.dataset.title || document.title;
  const cover = root.dataset.cover || "";

  const overlay = el(`
    <div class="sb-cook" role="dialog" aria-modal="true">
      <div class="sb-cook__hero" style="${cover?`background-image:url('${cover}')`:''}">
        <div class="sb-cook__title">${title}</div>
      </div>
      <div class="sb-cook__body">
        <div class="sb-cook__stepno" data-no>1</div>
        <div class="sb-cook__text" data-text></div>
        <div class="sb-cook__subs" data-subs></div>
      </div>
      <div class="sb-cook__nav">
        <div class="sb-cook__bar"><i data-bar></i></div>
        <div class="sb-cook__buttons">
          <button class="sb-btn sb-btn--ghost" data-prev><span class="ms">arrow_back</span> Zurück</button>
          <div style="display:flex;gap:.5rem">
            <button class="sb-btn sb-btn--ghost" data-close><span class="ms">close</span> Beenden</button>
            <button class="sb-btn" data-next>Weiter <span class="ms">arrow_forward</span></button>
          </div>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add("sb-cook--show"));

  let i = 0;
  const n = dataSteps.length;
  const no = overlay.querySelector("[data-no]");
  const txt = overlay.querySelector("[data-text]");
  const subs = overlay.querySelector("[data-subs]");
  const bar = overlay.querySelector("[data-bar]");
  const prev = overlay.querySelector("[data-prev]");
  const next = overlay.querySelector("[data-next]");
  const close = overlay.querySelector("[data-close]");

  function render(){
    const s = dataSteps[i];
    no.textContent = (i+1).toString();
    txt.textContent = s.text || "";
    subs.innerHTML = "";
    (s.subIngredients||[]).forEach(si=>{
      const u = si.unit || "";
      const t = (si.amount!=null) ? `${fmt.format(si.amount)} ${u} ${si.name}` : si.name;
      subs.appendChild(el(`<span class="sb-chip">${t}</span>`));
    });
    bar.style.width = ((i+1)/n*100) + "%";
    prev.disabled = i===0;
    next.textContent = (i===n-1) ? "Fertig" : "Weiter";
  }
  function done(){
    bar.style.width = "100%";
    overlay.remove();
  }

  prev.addEventListener("click", ()=>{ if(i>0){i--; render();} });
  next.addEventListener("click", ()=>{ if(i<n-1){i++; render(); } else { done(); } });
  close.addEventListener("click", done);
  document.addEventListener("keydown", (e)=>{
    if(!overlay.parentNode) return;
    if(e.key==="ArrowRight") next.click();
    if(e.key==="ArrowLeft") prev.click();
    if(e.key==="Escape") close.click();
  });

  render();
}

document.addEventListener("DOMContentLoaded", ()=>{
  document.querySelectorAll("[data-recipe-detail] [data-cook-start]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      const root = btn.closest("[data-recipe-detail]");
      if (root) mountCook(root);
    });
  });
});
export {};