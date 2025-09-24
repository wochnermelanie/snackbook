import { parseHTML } from "linkedom";
import cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }
  try {
    const url =
      (event.queryStringParameters && event.queryStringParameters.url) ||
      (event.body ? JSON.parse(event.body).url : undefined);

    if (!url || !/^https?:\/\//i.test(url)) {
      return json({ error: "Bitte gültige URL senden." }, 400);
    }

    const html = await fetchText(url);
    const data = await extract(html, url);

    return json({
      title: data.title || "Import",
      image: data.image || "",
      ingredients: data.ingredients || [],
      steps: data.steps || [],
      tags: data.tags?.length ? data.tags : ["Import"],
      source: url,
      macros: data.macros || null
    });
  } catch (err) {
    return json({ error: (err && err.message) || String(err) }, 500);
  }
}

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
    body: JSON.stringify(body)
  };
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`Fetch fehlgeschlagen (${res.status})`);
  return await res.text();
}

async function extract(html, url) {
  const { document } = parseHTML(html);

  // 1) JSON-LD (Recipe, Article, Video, Graph)
  const ldNodes = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map(s => safeJson(s.textContent))
    .filter(Boolean)
    .flatMap(v => Array.isArray(v) ? v : (v["@graph"] || v));

  const isRecipe = x => x && x["@type"] && (x["@type"] === "Recipe" || (Array.isArray(x["@type"]) && x["@type"].includes("Recipe")));
  const recipe = (Array.isArray(ldNodes) ? ldNodes : [ldNodes]).find(isRecipe);

  if (recipe) return normalizeRecipe(recipe);

  // 2) OpenGraph Fallback
  const og = prop => document.querySelector(`meta[property="${prop}"]`)?.getAttribute("content") || "";
  const title = og("og:title") || document.title || "";
  const image = og("og:image") || "";

  // 3) sehr einfache Microdata-Heuristik
  const $ = cheerio.load(html);
  const ing = $('[itemprop="recipeIngredient"]').map((_, el) => $(el).text().trim()).get();
  const steps = $('[itemprop="recipeInstructions"]').map((_, el) => $(el).text().trim()).get();

  return { title, image, ingredients: ing, steps, tags: [], macros: null };
}

function normalizeRecipe(r) {
  const toArray = v => Array.isArray(v) ? v : v ? [v] : [];
  const ingredients = toArray(r.recipeIngredient).map(x => (typeof x === "string" ? x : String(x))).filter(Boolean);

  let steps = [];
  if (Array.isArray(r.recipeInstructions)) {
    steps = r.recipeInstructions.map(s => typeof s === "string" ? s : (s.text || s.name || "")).map(s => s.trim()).filter(Boolean);
  } else if (typeof r.recipeInstructions === "string") {
    steps = r.recipeInstructions.split(/\n+/).map(s => s.trim()).filter(Boolean);
  }

  const n = r.nutrition || {};
  const macros = (n.calories || n.proteinContent || n.carbohydrateContent || n.fatContent) ? {
    kcal: n.calories ? parseNumber(n.calories) : null,
    protein: n.proteinContent ? parseNumber(n.proteinContent) : null,
    carbs: n.carbohydrateContent ? parseNumber(n.carbohydrateContent) : null,
    fat: n.fatContent ? parseNumber(n.fatContent) : null
  } : null;

  return {
    title: r.name || "Import",
    image: typeof r.image === "string" ? r.image : (r.image?.url || ""),
    ingredients,
    steps,
    tags: toArray(r.recipeCategory).filter(Boolean),
    macros
  };
}

function parseNumber(v) {
  const m = String(v).match(/([0-9]+(?:[.,][0-9]+)?)/);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}