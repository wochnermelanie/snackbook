var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/extract.mjs
var extract_exports = {};
__export(extract_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(extract_exports);
async function handler(event) {
  try {
    const { url } = JSON.parse(event.body || "{}");
    if (!url) return json(400, { error: "Missing url" });
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        "accept-language": "de-DE,de;q=0.9,en;q=0.8"
      }
    });
    const html = await res.text();
    const meta = (name) => {
      const re = new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)`,
        "i"
      );
      const m = html.match(re);
      return m ? decode(m[1]) : null;
    };
    let title = meta("og:title") || meta("twitter:title") || getTitle(html) || url;
    let image = meta("og:image") || meta("twitter:image") || null;
    const description = meta("og:description") || meta("twitter:description") || null;
    const recipe = extractRecipeFromJsonLd(html);
    const ingredients = recipe?.ingredients || [];
    const steps = recipe?.steps || [];
    const servings = recipe?.servings || null;
    return json(200, { title, image, description, ingredients, steps, servings });
  } catch (e) {
    return json(200, { title: null, image: null, description: null, ingredients: [], steps: [], servings: null });
  }
}
function json(status, body) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body)
  };
}
function getTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? decode(m[1]) : null;
}
function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}
function extractRecipeFromJsonLd(html) {
  const m = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    const recipe = findRecipe(data);
    if (!recipe) return null;
    return {
      title: recipe.name || null,
      image: recipe.image?.url || recipe.image || null,
      ingredients: recipe.recipeIngredient || [],
      steps: Array.isArray(recipe.recipeInstructions) ? recipe.recipeInstructions.map((x) => x.text || x.name || x).filter(Boolean) : [],
      servings: recipe.recipeYield ? parseInt(recipe.recipeYield) : null
    };
  } catch {
    return null;
  }
}
function findRecipe(obj) {
  if (!obj) return null;
  if (Array.isArray(obj)) return obj.map(findRecipe).find(Boolean);
  if (typeof obj === "object") {
    const t = obj["@type"];
    if (t === "Recipe" || Array.isArray(t) && t.includes("Recipe")) return obj;
    if (obj["@graph"]) return findRecipe(obj["@graph"]);
    for (const k of Object.keys(obj)) {
      const r = findRecipe(obj[k]);
      if (r) return r;
    }
  }
  return null;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=extract.js.map
