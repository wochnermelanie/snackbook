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

// netlify/functions/ai-image-recipe.mjs
var ai_image_recipe_exports = {};
__export(ai_image_recipe_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(ai_image_recipe_exports);
var KEY = process.env.OPENAI_API_KEY;
var MODEL = "gpt-4o-mini";
async function handler(event) {
  try {
    if (!KEY) return json(404, { error: "OPENAI_API_KEY missing" });
    let dataUrl = "";
    if (event.headers["content-type"]?.includes("application/json")) {
      const j = JSON.parse(event.body || "{}");
      dataUrl = j.image || j.data || "";
    } else {
      dataUrl = event.body || "";
    }
    if (!dataUrl || !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(dataUrl)) {
      return json(400, { error: "Send a data URL (image) in body" });
    }
    const prompt = "Erzeuge aus dem Bild ein plausibles Rezept als valides JSON. Gib nur JSON zur\xFCck \u2013 keine Erkl\xE4rungen. Felder: {title, servings, ingredients[], steps[]}. ingredients: je Zutat eine Zeile (mit Menge + Einheit, wenn erkennbar). steps: kurze, nummerierte Kochschritte. Wenn Angaben unsicher sind, sch\xE4tze sinnvoll.";
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
        // erzwingt JSON
      })
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return json(502, { error: "OpenAI error", detail: errText.slice(0, 500) });
    }
    const out = await resp.json();
    const raw = out?.choices?.[0]?.message?.content || "{}";
    let draft;
    try {
      draft = JSON.parse(raw);
    } catch {
      draft = {};
    }
    const title = (draft.title || "Rezept").toString().slice(0, 140);
    const servings = Number(draft.servings || 2) || 2;
    const ingredients = Array.isArray(draft.ingredients) ? draft.ingredients.map(String) : [];
    const steps = Array.isArray(draft.steps) ? draft.steps.map(String) : [];
    return json(200, { title, servings, ingredients, steps });
  } catch (e) {
    return json(500, { error: String(e) });
  }
}
function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=ai-image-recipe.js.map
