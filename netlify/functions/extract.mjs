// netlify/functions/extract.mjs
export async function handler(event) {
  try {
    const { url } = JSON.parse(event.body || "{}");
    if (!url) return json(400, { error: "Missing url" });

    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
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

    // 1) JSON-LD (beste Quelle)
    const jld = extractRecipeFromJsonLdAll(html);
    if (jld) {
      title = jld.title || title;
      image = jld.image || image;
      return json(200, {
        title, image, description,
        ingredients: jld.ingredients || [],
        steps: jld.steps || [],
        servings: jld.servings || null
      });
    }

    // 2) Fallbacks (Microdata/Klassen)
    const ingredients = extractIngredientsFallback(html);
    const steps = extractStepsFallback(html);
    const servings = extractServingsFallback(html);

    return json(200, { title, image, description, ingredients, steps, servings });
  } catch (e) {
    return json(200, { title:null,image:null,description:null,ingredients:[],steps:[],servings:null });
  }
}

/* ---------------- helpers ---------------- */
function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) };
}
function getTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? decode(m[1]) : null;
}
function decode(s) {
  return s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'").replace(/&quot;/g,'"');
}

function extractRecipeFromJsonLdAll(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of scripts) {
    const raw = m[1].trim();
    const candidates = safeJsonMulti(raw);
    for (const cand of candidates) {
      const recipe = findRecipeNode(cand);
      if (!recipe) continue;

      const title = recipe.name || null;

      let image = null;
      if (typeof recipe.image === "string") image = recipe.image;
      else if (Array.isArray(recipe.image) && recipe.image.length) image = recipe.image[0];
      else if (recipe.image && typeof recipe.image === "object" && recipe.image.url) image = recipe.image.url;

      let ingredients = recipe.recipeIngredient || recipe.ingredients || [];
      if (!Array.isArray(ingredients)) ingredients = [String(ingredients)];
      ingredients = ingredients.map(x => String(x).trim()).filter(Boolean);

      let steps = [];
      if (Array.isArray(recipe.recipeInstructions)) {
        steps = recipe.recipeInstructions
          .map((s) => typeof s === "string" ? s : (s?.text || s?.name || ""))
          .map((s) => String(s).trim())
          .filter(Boolean);
      } else if (typeof recipe.recipeInstructions === "string") {
        steps = recipe.recipeInstructions
          .split(/\r?\n|\. (?=[A-ZÄÖÜ])/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      let servings = null;
      const ry = recipe.recipeYield || null;
      if (ry) {
        const m2 = String(ry).match(/(\d+)/);
        if (m2) servings = Number(m2[1]);
      }

      return { title, image, ingredients, steps, servings };
    }
  }
  return null;
}
function safeJsonMulti(text) {
  const out = [];
  try { out.push(JSON.parse(text)); }
  catch {
    const parts = text.replace(/<\/?[^>]+>/g, "")
      .split(/\n(?=\s*[{[])/).map((s)=>s.trim()).filter(Boolean);
    for (const p of parts) { try { out.push(JSON.parse(p)); } catch {} }
  }
  return out;
}
function findRecipeNode(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const r=findRecipeNode(n); if (r) return r; } return null; }
  if (Array.isArray(node["@graph"])) { for (const n of node["@graph"]) { const r=findRecipeNode(n); if (r) return r; } }
  const t = node["@type"];
  if (t && (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe")))) return node;
  for (const k of Object.keys(node)) { const r=findRecipeNode(node[k]); if (r) return r; }
  return null;
}

function stripTags(s) { return s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[^>]+>/g, " ").replace(/&nbsp;/g, " "); }
function extractIngredientsFallback(html) {
  const li = [...html.matchAll(/<li[^>]+itemprop=["']recipeIngredient["'][^>]*>([\s\S]*?)<\/li>/gi)]
    .map(m => stripTags(m[1])).map(s=>s.replace(/\s+/g," ").trim()).filter(Boolean);
  if (li.length) return li;
  const m = html.match(/class=["'][^"']*(ingredients|zutaten)[^"']*["'][^>]*>([\s\S]*?)<\/(ul|ol|div)>/i);
  if (m) {
    const items = [...m[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(x => stripTags(x[1]).replace(/\s+/g," ").trim()).filter(Boolean);
    if (items.length) return items;
  }
  return [];
}
function extractStepsFallback(html) {
  const li = [...html.matchAll(/<li[^>]+itemprop=["']recipeInstructions["'][^>]*>([\s\S]*?)<\/li>/gi)]
    .map(m => stripTags(m[1])).map(s=>s.replace(/\s+/g," ").trim()).filter(Boolean);
  if (li.length) return li;
  const m = html.match(/class=["'][^"']*(instructions|zubereitung)[^"']*["'][^>]*>([\s\S]*?)<\/(ol|ul|div)>/i);
  if (m) {
    const items = [...m[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(x => stripTags(x[1]).replace(/\s+/g," ").trim()).filter(Boolean);
    if (items.length) return items;
  }
  return [];
}
function extractServingsFallback(html) {
  const m = html.match(/(ergibt|für|servings?|portionen?)\s*[:\-]?\s*(\d+)/i);
  return m ? Number(m[2]) : null;
}
