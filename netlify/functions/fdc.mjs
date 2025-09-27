/**
 * /fdc Function – USDA FoodData Central Proxy
 * Query (GET/POST):
 *  - name: Zutatentext (z.B. "Haferflocken")
 *  - amount: Zahl der Menge
 *  - unit: "g" | "ml" | "Stk"
 *  - approxWeight: optional Gramm/ML je Stück (Fallback 60)
 *
 * Netlify ENV required: FDC_API_KEY
 */
const API = "https://api.nal.usda.gov/fdc/v1/foods/search";

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
    const params = event.httpMethod === "GET"
      ? (event.queryStringParameters || {})
      : JSON.parse(event.body || "{}");

    const name = String(params.name || "").trim();
    const amount = Number(params.amount || 0);
    const unit = String(params.unit || "g").toLowerCase();
    const approxWeight = Number(params.approxWeight || 60); // für "Stk"

    if (!name) return json({ error: "name fehlt" }, 400);
    if (!process.env.FDC_API_KEY) {
      return json({ error: "FDC_API_KEY fehlt (Netlify Environment Variable setzen)" }, 500);
    }

    // Menge normalisieren
    let base = 0; let baseType = "g";
    if (unit === "g" || unit === "gramm") { base = amount; baseType = "g"; }
    else if (unit === "ml") { base = amount; baseType = "ml"; }
    else if (unit === "stk" || unit === "stück" || unit === "st") { base = amount * approxWeight; baseType = "g"; }
    else if (unit === "n.b." || unit === "nb" || unit === "n.b") { base = 0; baseType = "g"; }
    else { base = amount; baseType = "g"; }

    // FDC Suche
    const url = new URL(API);
    url.searchParams.set("api_key", process.env.FDC_API_KEY);
    url.searchParams.set("query", name);
    url.searchParams.set("pageSize", "1");
    url.searchParams.set("dataType", ["Survey (FNDDS)","Foundation","SR Legacy","Branded"].join(","));

    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return json({ error: "FDC Fehler" }, 502);
    const data = await res.json();
    const food = (data.foods && data.foods[0]) || null;
    if (!food) return json({ error: `Keine FDC-Treffer für "${name}"` }, 404);

    // Nährstoffe mappen
    const NMAP = {
      energyKcal: 1008, // Energie (kcal)
      protein: 1003,
      fat: 1004,
      carbs: 1005,
      sugars: 2000,
      fiber: 1079,
      satFat: 1258,
      monoFat: 1292,
      polyFat: 1293,
      cholesterol: 1253,
      sodium: 1093
    };

    function pick(id) {
      const hit = (food.foodNutrients || []).find(n =>
        n.nutrient?.number == id || n.nutrientId == id
      );
      return hit ? Number(hit.amount || 0) : 0;
    }

    const per100 = {
      kcal: pick(NMAP.energyKcal),
      protein: pick(NMAP.protein),
      carbs: pick(NMAP.carbs),
      sugar: pick(NMAP.sugars),
      fat: pick(NMAP.fat),
      satFat: pick(NMAP.satFat),
      fiber: pick(NMAP.fiber),
      sodium: pick(NMAP.sodium),
      cholesterol: pick(NMAP.cholesterol)
    };

    // Faktor (typisch je 100 g/ml)
    let factor = 0;
    if (baseType === "g" || baseType === "ml") factor = base / 100;

    const total = Object.fromEntries(
      Object.entries(per100).map(([k, v]) => [k, round1((v || 0) * factor)])
    );

    return json({
      ok: true,
      source: {
        fdcId: food.fdcId,
        description: food.description,
        dataType: food.dataType
      },
      per100,
      amount: { value: amount, unit, approxWeight, base, baseType },
      total
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders },
    body: JSON.stringify(body)
  };
}
function round1(n){ return Math.round((n + Number.EPSILON)*10)/10; }
