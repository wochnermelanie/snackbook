/* Snackbook UI bootstrap (UTF-8) */
const DB = "recipes";
const CDB = "collections";
const $ = (q,root=document)=>root.querySelector(q);
const $$ = (q,root=document)=>[...root.querySelectorAll(q)];

function toast(msg){
  const t=$("#toast"); if(!t) return;
  t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),1600);
}

const lf = {
  get:(k)=>Promise.resolve(JSON.parse(localStorage.getItem(k)||"null")),
  set:(k,v)=>Promise.resolve(localStorage.setItem(k,JSON.stringify(v)))
};

function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

/* Seed minimal collections if empty */
async function ensureCollections(){
  const c = (await lf.get(CDB))||[];
  if(c.length===0){
    const def=[{id:uid(),name:"Favoriten",count:0},{id:uid(),name:"Schnell & Easy",count:0},{id:uid(),name:"Mealprep",count:0}];
    await lf.set(CDB,def);
    return def;
  }
  return c;
}

function macroBadges(per){
  if(!per) return "";
  const kcal = Math.round(per.kcal||0);
  const p = per.protein??0, f=per.fat??0, c=per.carbs??0;
  return `
    <div class="sb-macros">
      <span class="sb-pill sb-pill--kcal">${kcal} kcal</span>
      <span class="sb-pill">P ${p} g</span>
      <span class="sb-pill">F ${f} g</span>
      <span class="sb-pill">KH ${c} g</span>
    </div>
  `;
}

function icon(name){
  switch(name){
    case "link": return `<svg viewBox="0 0 24 24" class="sb-icon"><path d="M10 14a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07l-1 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 10a5 5 0 00-7.07 0l-1.41 1.41a5 5 0 007.07 7.07l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    case "share": return `<svg viewBox="0 0 24 24" class="sb-icon"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 6l-4-4-4 4M12 2v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    default: return "";
  }
}

function recipeCard(r){
  const img = r.coverImage || r.image || "";
  const per = r.nutritionPerPortion || null;
  const t = (r.timeMinutes ? `${r.timeMinutes} min` : "");
  return `
    <article class="sb-card" data-id="${r.id}">
      <img src="${img}" alt="${r.title?("Bild: "+r.title):"Rezept"}" onerror="this.style.opacity=0">
      <div class="sb-card-body">
        <h3 title="${r.title||""}">${r.title||"Ohne Titel"}</h3>
        <div class="sb-meta">${t ? `<span>${t}</span>` : ""}</div>
        ${macroBadges(per)}
        <div class="sb-actions">
          ${r.sourceUrl?`<a class="sb-action" href="${r.sourceUrl}" target="_blank" rel="noopener" title="Quelle öffnen" aria-label="Quelle öffnen">${icon("link")}</a>`:""}
          <button class="sb-action" data-share="${r.id}" title="Teilen" aria-label="Teilen">${icon("share")}</button>
        </div>
      </div>
    </article>
  `;
}

async function renderCollections(){
  const wrap=$("#collectionsGrid"); if(!wrap) return;
  const cols = await ensureCollections();
  wrap.innerHTML = cols.map(c=>`
    <div class="sb-collection" data-col="${c.id}">
      <h3>${c.name}</h3>
      <p>${c.count||0} Rezepte</p>
    </div>`).join("");
}

async function computeMacrosIfNeeded(list){
  // Compute via USDA-backed aggregator if missing
  for (const r of list) {
    if (!r.nutritionPerPortion && window.SB?.nutrition && r.ingredients?.length){
      try {
        const total = await window.SB.nutrition.aggregateOfficial(r.ingredients);
        const per = window.SB.nutrition.perPortion(total, r.servings||1);
        r.nutritionPerPortion = per;
      } catch{}
    }
  }
  return list;
}

async function renderRecipes(filterText="", filters={}){
  const wrap=$("#recipesGrid"); if(!wrap) return;
  let list = (await lf.get(DB))||[];
  // simple filter by text/tags
  const q = filterText.trim().toLowerCase();
  if(q){
    list = list.filter(r=>{
      const hay = [
        r.title||"", r.description||"",
        ...(r.tags||[]), ...(r.ingredients||[]).map(i=>i.name||"")
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  // time filter
  if (filters.time) list = list.filter(r=> (r.timeMinutes||1e9) <= filters.time);
  // kcal filter (needs compute)
  if (filters.kcal) {
    await computeMacrosIfNeeded(list);
    list = list.filter(r=> (r.nutritionPerPortion?.kcal||1e9) <= filters.kcal);
  }
  // tags filter
  if (filters.tags?.length) {
    list = list.filter(r => filters.tags.some(t => (r.tags||[]).map(x=>String(x).toLowerCase().trim()).includes(t)));
  }

  await computeMacrosIfNeeded(list);
  wrap.innerHTML = list.map(recipeCard).join("") || `<p style="color:var(--sb-muted)">Noch keine Rezepte. Importiere eines über Teilen → Snackbook.</p>`;

  // share buttons
  $$("#recipesGrid [data-share]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id=btn.getAttribute("data-share");
      try {
        await navigator.share?.({ title:"Snackbook", text:"Schau dir dieses Rezept an", url: location.origin+"?open="+encodeURIComponent(id) });
      } catch {}
    });
  });
}

/* Add collection */
$("#btnAddCollection")?.addEventListener("click", async ()=>{
  const name = prompt("Wie soll die Sammlung heißen?");
  if(!name) return;
  const cols = (await lf.get(CDB))||[];
  cols.unshift({id:uid(), name:String(name).trim(), count:0});
  await lf.set(CDB, cols);
  renderCollections();
});

/* Add empty recipe */
$("#btnAddRecipe")?.addEventListener("click", async ()=>{
  const r = { id:uid(), title:"Neues Rezept", ingredients:[], steps:[], tags:[], servings:1, createdAt:Date.now(), coverImage:"" };
  const list=(await lf.get(DB))||[]; list.unshift(r); await lf.set(DB,list);
  toast("Rezept angelegt");
  renderRecipes($("#searchInput")?.value||"", getFilters());
});

function getFilters(){
  return {
    time: Number($("#fTime")?.value||"") || null,
    kcal: Number($("#fKcal")?.value||"") || null,
    tags: ($("#fTags")?.value||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean)
  };
}

$("#btnFilters")?.addEventListener("click", ()=>$("#filterSheet")?.showModal());
$("#applyFilters")?.addEventListener("click", (e)=>{
  e.preventDefault();
  $("#filterSheet")?.close();
  renderRecipes($("#searchInput")?.value||"", getFilters());
});

$("#searchInput")?.addEventListener("input", (e)=>{
  renderRecipes(e.currentTarget.value, getFilters());
});

/* Handle ?open=ID from share flow */
(function(){
  const u=new URL(location.href);
  const open=u.searchParams.get("open");
  if(open){ toast("Rezept importiert ✔"); u.searchParams.delete("open"); history.replaceState({}, "", u.pathname+u.search+u.hash); }
})();

/* Boot */
document.addEventListener("DOMContentLoaded", async ()=>{
  await renderCollections();
  await renderRecipes();
});