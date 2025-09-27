// Creates a recipe draft from an image using OpenAI Vision.
// Request body: either a data URL (string) or JSON { image: "data:image/...;base64,..." }

const KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini"; // gÃ¼nstig + gut fÃ¼r Vision

export async function handler(event) {
  try {
    if (!KEY) return json(404, { error: "OPENAI_API_KEY missing" });

    // 1) Body einlesen (Data-URL oder JSON)
    let dataUrl = "";
    if (event.headers["content-type"]?.includes("application/json")) {
      const j = JSON.parse(event.body || "{}");
      dataUrl = j.image || j.data || "";
    } else {
      // Roh: data URL als Text
      dataUrl = event.body || "";
    }
    if (!dataUrl || !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(dataUrl)) {
      return json(400, { error: "Send a data URL (image) in body" });
    }

    // 2) Prompt
    const prompt =
      "Erzeuge aus dem Bild ein plausibles Rezept als valides JSON. " +
      "Gib nur JSON zurÃ¼ck â€“ keine ErklÃ¤rungen. Felder: " +
      "{title, servings, ingredients[], steps[]}. " +
      "ingredients: je Zutat eine Zeile (mit Menge + Einheit, wenn erkennbar). " +
      "steps: kurze, nummerierte Kochschritte. " +
      "Wenn Angaben unsicher sind, schÃ¤tze sinnvoll.";

    // 3) OpenAI call
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
        response_format: { type: "json_object" } // erzwingt JSON
      })
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return json(502, { error: "OpenAI error", detail: errText.slice(0, 500) });
    }

    const out = await resp.json();
    const raw = out?.choices?.[0]?.message?.content || "{}";

    // 4) JSON parsen + absichern
    let draft;
    try {
      draft = JSON.parse(raw);
    } catch {
      draft = {};
    }

    // Normalize
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


