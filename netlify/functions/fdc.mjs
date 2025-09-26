/**
 * Netlify Function: /fdc  (USDA FoodData Central)
 * Params: name, amount, unit (g|ml|Stk|n.B.), approxWeight (g je Stück, default 60)
 */
const API = "https://api.nal.usda.gov/fdc/v1/foods/search";
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,OPTIONS", "Access-Control-Allow-Headers":"Content-Type" };

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  try{
    const params = event.httpMethod === "GET" ? (event.queryStringParameters||{}) : JSON.parse(event.body||"{}");
    const name = String(params.name||"").trim();
    const amount = Number(params.amount||0);
    const unit = String(params.unit||"g").toLowerCase();
    const approxWeight = Number(params.approxWeight||60);
    if(!name) return json({error:"name fehlt"},400);
    if(!process.env.FDC_API_KEY) return json({error:"FDC_API_KEY fehlt (Netlify Env)"},500);

    // normalize to base grams/ml
    let base=0, baseType="g";
    if (["g","gramm"].includes(unit)) { base=amount; baseType="g"; }
    else if (unit==="ml") { base=amount; baseType="ml"; }
    else if (["stk","stück","st"].includes(unit)) { base=amount*approxWeight; baseType="g"; }
    else if (["n.b.","nb","n.b"].includes(unit)) { base=0; baseType="g"; }
    else { base=amount; baseType="g"; }

    const url = new URL(API);
    url.searchParams.set("api_key", process.env.FDC_API_KEY);
    url.searchParams.set("query", name);
    url.searchParams.set("pageSize","1");
    url.searchParams.set("dataType", ["Survey (FNDDS)","Foundation","SR Legacy","Branded"].join(","));

    const res = await fetch(url, { headers: { "Accept":"application/json" }});
    if(!res.ok) return json({error:FDC Fehler },502);
    const data = await res.json();
    const food = (data.foods && data.foods[0]) || null;
    if(!food) return json({error:Keine FDC-Treffer für ""},404);

    const pick = (needle) => {
      const hit = (food.foodNutrients||[]).find(n => n.nutrient?.number == needle || n.nutrientId == needle);
      return hit ? Number(hit.amount||0) : 0;
    };
    const N = { kcal:1008, protein:1003, carbs:1005, sugar:2000, fat:1004, satFat:1258, fiber:1079, sodium:1093, cholesterol:1253 };

    const per100 = {
      kcal: pick(N.kcal), protein: pick(N.protein), carbs: pick(N.carbs), sugar: pick(N.sugar),
      fat: pick(N.fat), satFat: pick(N.satFat), fiber: pick(N.fiber), sodium: pick(N.sodium), cholesterol: pick(N.cholesterol)
    };
    const factor = (baseType==="g"||baseType==="ml") ? (base/100) : 0;
    const total = Object.fromEntries(Object.entries(per100).map(([k,v])=>[k, round1((v||0)*factor)]));

    return json({ ok:true, source:{ fdcId:food.fdcId, description:food.description, dataType:food.dataType },
                  per100, amount:{value:amount,unit,approxWeight,base,baseType}, total });
  }catch(e){ return json({error:String(e?.message||e)},500); }
}
function json(body, statusCode=200){ return { statusCode, headers:{ "content-type":"application/json; charset=utf-8", ...cors }, body: JSON.stringify(body) }; }
function round1(n){ return Math.round((n+Number.EPSILON)*10)/10; }