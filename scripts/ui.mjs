/* scripts/ui.mjs */
document.addEventListener("DOMContentLoaded", () => {
  // Placeholder sicherheitshalber setzen (falls Template andere Texte hat)
  document.querySelectorAll("input[placeholder]").forEach(i=>{
    if(/Zutat|Rezept|Tag/.test(i.placeholder)===false){
      i.placeholder = "Zutat, Rezept, Tag …";
    }
    i.classList.add("search-input");
  });

  // Falls Karten noch keine Makros zeigen: nutrition.mjs zieht sie automatisch hoch
  // Voraussetzung: Karten haben data-recipe-card, data-servings und data-ingredients (JSON).
});

