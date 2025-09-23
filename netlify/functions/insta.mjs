// netlify/functions/insta.mjs
// Holt Instagram-Caption via oEmbed (offiziell) und parst Zutaten / Schritte / Portionen.

const OEMBED = "https://graph.facebook.com/v19.0/instagram_oembed";
const TOKEN = process.env.IG_OEMBED_TOKEN || ""; // Format: APP_ID|CLIENT_TOKEN

export async function handler(event) {
  try {
    const { url } = JSON.parse(event.body || "{}");
    if (!url || !/instagram\.com\/(p|reel|tv)\//.test(url)) {
      return json(400, { error: "Bitte einen gültigen Instagram-Post-Link senden." });
    }
    if (!TOKEN) {
      return json(500, { error: "IG_OEMBED_TOKEN fehlt (APP_ID|CLIENT_TOKEN in Netlify Vars)" });
    }

    // oEmbed abrufen
    const qs = new URLSearchParams({
      url,
      access_token: TOKEN,
      omitscript: "true",
      hidecaption: "false",
      maxwidth: "640"
    });
    const r = await fetch(`${OEMBED}?${qs.toString()}`, {
      headers: { "accept-language": "de-DE,de;q=0.9,en;q=0.8" }
    });
    if (!r.ok) {
      const err = await safeJson(r);
      return json(502, { error: "oEmbed-Fehler", detail: err });
    }
    const em = await r.json();

    const caption = cleanCaption((em.title || "").trim());
    const image = em.thumbnail_url || null;
    const author = em.author_name || null;

    const parsed = parseCaption(caption);

    const title =
      parsed.title ||
      firstLine(caption) ||
      (author ? `${author} – Rezept` : "Instagram Rezept");

    return json(200, {
      source: url,
      title,
      image,
      description: caption || null,
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      servings: parsed.servings
    });
  } catch (e) {
    return json(200, {
      title: null,
      image: null,
      description: null,
      ingredients: [],
      steps: [],
      servings: null,
      error: "insta.mjs failed"
    });
  }
}

/* ---------------- Parser ---------------- */

function cleanCaption(c) {
  if (!c) return "";
  return c
    // URLs raus
    .replace(/https?:\/\/\S+/g, "")
    // Mentions/Hashtags am Zeilenende reduzieren
    .replace(/(^|\s)[#@][\wäöüÄÖÜß]+/g, "")
    // doppelte Leerzeichen/Zeilen straffen
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

function firstLine(c) {
  return (c || "").split("\n").map(s=>s.trim()).filter(Boolean)[0] || null;
}

function parseCaption(captionRaw = "") {
  const lines = captionRaw.split("\n").map(s => s.trim()).filter(Boolean);

  // Abschnittsmarker (DE/EN + Emojis)
  const ING_KEYS = /(zutaten|ingredients|einkauf|🛒|📝|🥗|🥣)\b/i;
  const STEP_KEYS = /(zubereitung|anleitung|instructions|so geht'?s|schritte|👩‍🍳|🍳|➡️|→)\b/i;
  const SERV_KEYS = /(ergibt|für|portionen?|servings?)\b/i;

  let mode = null;
  const ing = [];
  const steps = [];
  let servings = null;
  let title = null;

  // Kandidat für Titel: erste nicht-leere Zeile ohne Marker
  title = lines.find(l => !ING_KEYS.test(l) && !STEP_KEYS.test(l) && !SERV_KEYS.test(l)) || null;
  if (title) title = title.replace(/^#+\s*/, "").trim();

  // Zeilen iterieren
  for (let raw of lines) {
    let line = raw.replace(/\s+/g, " ").trim();

    // Portionen erkennen
    const servMatch = line.match(/(ergibt|für|servings?|portionen?)\D*(\d{1,3})/i);
    if (!servings && servMatch) servings = parseInt(servMatch[2], 10);

    // Moduswechsel durch Überschriften
    if (ING_KEYS.test(line)) { mode = "ing"; continue; }
    if (STEP_KEYS.test(line)) { mode = "steps"; continue; }

    // Dekorative Bullet/Nummerierung entfernen
    line = line.replace(/^[*\-–—•●○◦·]\s*/,'').replace(/^\d+[\).\s]\s*/,'').trim();

    // Zutaten-Heuristik
    if (!mode) {
      if (looksLikeIngredient(line)) { ing.push(cleanQty(line)); continue; }
    }
    if (mode === "ing") {
      if (line && !isSectionHeader(line, ING_KEYS, STEP_KEYS)) {
        if (looksLikeIngredient(line)) ing.push(cleanQty(line));
      }
      continue;
    }
    if (mode === "steps") {
      if (line && !isSectionHeader(line, ING_KEYS, STEP_KEYS)) {
        steps.push(line);
      }
      continue;
    }
  }

  // Wenn keine Steps markiert, aus restlichen satzartigen Zeilen bauen
  if (steps.length === 0) {
    for (const l of lines) {
      if (!looksLikeIngredient(l) && !isSectionHeader(l, ING_KEYS, STEP_KEYS)) {
        if (/[.!?]$|^\d+[\).]/.test(l) || l.split(/\s+/).length >= 5) {
          steps.push(l.replace(/^[\d\)\.]+\s*/, "").trim());
        }
      }
    }
  }

  return {
    title: (title || "").trim() || null,
    servings: servings || null,
    ingredients: dedupe(ing),
    steps: dedupe(steps)
  };
}

function isSectionHeader(s, ING_KEYS, STEP_KEYS) {
  return ING_KEYS.test(s) || STEP_KEYS.test(s) || /^\s*#{1,3}\s*\w+/.test(s);
}

function looksLikeIngredient(s) {
  const t = s.toLowerCase();
  const hasQty = /(^|\s)(\d+([.,]\d+)?|¼|½|¾)\s*/.test(t);
  const hasUnit = /\b(kg|g|l|ml|el|tl|prise|päckchen|päckl|packung|dose|dosen|scheiben|stück|stk|zehe|tasse|cups?|becher)\b/.test(t);
  const hasFood = /\b(mehl|zucker|butter|öl|oel|milch|eier?|ei|reis|nudeln|pasta|huhn|hähnchen|pute|rind|schwein|kartoffel|zwiebel|tomate|quark|joghurt|banane|apfel|salz|pfeffer|backpulver|vanille|hef(e|e-)?|kakao|hafer|haferflocken)\b/i.test(s);
  // Auch reine „Zutat + Einheit“ ohne Menge erlauben, wenn eindeutig
  return hasQty || (hasUnit && hasFood);
}
function cleanQty(s) {
  return s
    .replace(/[*•\-–—]\s*/g, "")
    .replace(/(\d)\s?(g|kg|ml|l|el|tl)\b/gi, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function dedupe(arr) {
  return Array.from(new Set(arr.map(x => x.trim()))).filter(Boolean);
}

/* ---------------- utils ---------------- */
function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    },
    body: JSON.stringify(body)
  };
}
async function safeJson(res){
  try { return await res.json(); } catch { return await res.text(); }
}
