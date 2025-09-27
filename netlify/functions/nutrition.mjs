// netlify/functions/nutrition.mjs
const KEY = process.env.OPENAI_API_KEY || "";

// sehr kleine NÃ¤hrwert-DB (pro 100g / 100ml / StÃ¼ck)
const DB = [
  ["hÃ¤hnchenbrust", /h(Ã¤|ae)hnchen(brust)?|pute(n)?brust|huhn/i, "100g", 110, 0, 23, 1.5],
  ["rinderhack", /rinderhack|rind(hack)?/i, "100g", 250, 0, 26, 17],
  ["reis, roh", /reis(?!milch)/i, "100g", 350, 78, 7, 1],
  ["nudeln, roh", /nudeln|pasta|spaghetti|penne/i, "100g", 360, 73, 13, 2],
  ["haferflocken", /haferflocken/i, "100g", 370, 60, 13, 7],
  ["zucker", /zucker/i, "100g", 400, 100, 0, 0],
  ["mehl", /mehl/i, "100g", 364, 76, 10, 1],
  ["butter", /butter/i, "100g", 745, 0, 1, 82],
  ["Ã¶l", /(oel|Ã¶l|olive|raps).*(Ã¶l|oil)|\bÃ¶l\b/i, "100g", 884, 0, 0, 100],
  ["milch 3.5%", /milch/i, "100ml", 64, 5, 3.4, 3.6],
  ["eier", /\bei(er)?\b/i, "1pc", 78, 0.6, 6.3, 5.3],
  ["banane", /banane/i, "100g", 89, 23, 1, 0.3],
  ["apfel", /apfel/i, "100g", 52, 14, 0.3, 0.2],
  ["tomate", /tomate/i, "100g", 18, 3.9, 0.9, 0.2],
  ["kartoffel", /kartoffel/i, "100g", 77, 17, 2, 0.1],
];

const APPROX_PIECES = [
  [/ei(er)?/i, 60],
  [/banane/i, 120],
  [/apfel/i, 150],
  [/knoblauch|zehe/i, 5],
  [/zwiebel/i, 120],
  [/mÃ¶hre|karotte/i, 80]
];

export async function handler(event) {
  try {
    const { ingredients = [], servings = 1 } = JSON.parse(event.body || "{}");
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return json(200, { kcal: null, carbs: null, protein: null, fat: null });
    }

    let total = { kcal: 0, carbs: 0, protein: 0, fat: 0 };

    for (const lineRaw of ingredients) {
      const line = String(lineRaw).trim();
      if (!line) continue;

      const parsed = parseLine(line);
      if (parsed.qty == null && KEY) {
        const guess = await aiGuessQty(line).catch(() => null);
        if (guess?.qty) { parsed.qty = guess.qty; parsed.unit = guess.unit || parsed.unit; }
      }

      const grams = toGrams(parsed);
      const ref = matchDb(line);
      if (!ref) continue;

      let factor = 0;
      if (ref.per === "100g") factor = (grams ?? 0) / 100;
      if (ref.per === "100ml") factor = (toMilli(parsed) ?? 0) / 100;
      if (ref.per === "1pc") factor = pieceCount(parsed, line);

      total.kcal   += ref.kcal   * factor;
      total.carbs  += ref.carbs  * factor;
      total.protein+= ref.protein* factor;
      total.fat    += ref.fat    * factor;
    }

    const out = Object.fromEntries(Object.entries(total).map(([k,v])=>[k, Math.round(v)]));
    return json(200, out);
  } catch {
    return json(200, { kcal: null, carbs: null, protein: null, fat: null });
  }
}

/* ---------- Helpers ---------- */
function parseLine(s){
  const t = s.toLowerCase().replace(',','.');
  const frac = {'Â½':0.5,'Â¼':0.25,'Â¾':0.75};
  const mQty = t.match(/(\d+(?:\.\d+)?)|[Â½Â¼Â¾]/);
  const qty = mQty ? (frac[mQty[0]] ?? parseFloat(mQty[0])) : null;
  const mUnit = t.match(/\b(kg|g|l|ml|el|tl|prise|pÃ¤ckchen|packung|dose|dosen|stÃ¼ck|stk|zehe|ei|eier)\b/);
  const unit = mUnit ? mUnit[1] : null;
  return { qty, unit, text: s };
}
function toGrams({qty, unit, text}){
  if (qty == null) {
    for (const [re, g] of APPROX_PIECES) if (re.test(text)) return g;
    return null;
  }
  if (!unit) return qty;
  if (unit === 'kg') return qty * 1000;
  if (unit === 'g')  return qty;
  if (unit === 'el') return qty * 15;
  if (unit === 'tl') return qty * 5;
  if (unit === 'stÃ¼ck' || unit === 'stk' || unit === 'ei' || unit === 'eier') {
    for (const [re, g] of APPROX_PIECES) if (re.test(text)) return g * qty;
    return 50 * qty;
  }
  return null;
}
function toMilli({qty, unit}){
  if (qty == null) return null;
  if (unit === 'l')  return qty * 1000;
  if (unit === 'ml') return qty;
  if (unit === 'el') return qty * 15;
  if (unit === 'tl') return qty * 5;
  return null;
}
function pieceCount({qty, unit}, text){
  if (qty == null) return 1;
  if (unit === 'stÃ¼ck' || unit === 'stk' || unit === 'ei' || unit === 'eier') return qty;
  if (/\bei(er)?\b|banane|apfel|zwiebel/i.test(text)) return qty;
  return qty;
}
function matchDb(line){
  for (const [, re, per, kcal, c, p, f] of DB) {
    if (re.test(line)) return { per, kcal, carbs: c, protein: p, fat: f };
  }
  return null;
}
async function aiGuessQty(text){
  if (!KEY) return null;
  try{
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{ authorization:`Bearer ${KEY}`, "content-type":"application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role:"user", content:[{ type:"text", text:
          "SchÃ¤tze aus dieser Zutatenzeile eine Menge und Einheit. Antworte als JSON {qty:number, unit:string|null}. Zeile: "+text
        }]}],
        response_format: { type: "json_object" }
      })
    });
    const j = await r.json();
    return JSON.parse(j?.choices?.[0]?.message?.content || "{}");
  }catch{return null;}
}
function json(status, body){
  return { statusCode: status, headers: { "content-type":"application/json", "cache-control":"no-store" }, body: JSON.stringify(body) };
}


