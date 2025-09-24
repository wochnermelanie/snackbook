// netlify/functions/extract.mjs
// Minimaler, robuster HTML-Extractor für Instagram & Co.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function handler(event) {
  try {
    const raw = event.httpMethod === "POST"
      ? (JSON.parse(event.body || "{}").url || "")
      : (event.queryStringParameters?.url || "");

    if (!raw) return j(400, { error: "Bitte ?url=… angeben." });

    const url = decodeURIComponent(raw);

    // Seite abrufen (Server-Side; CORS egal)
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "de,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      return j(502, { error: `Fetch fehlgeschlagen (${res.status})` });
    }
    const html = await res.text();

    // 1) ld+json suchen & sicher parsen
    const ld = pickLdJson(html);

    // 2) OpenGraph/Fallback
    const og = {
      title: meta(html, "og:title") || textBetween(html, "<title>", "</title>"),
      image: meta(html, "og:image") || meta(html, "twitter:image"),
      description: meta(html, "og:description") || meta(html, "description"),
    };

    // Instagram: Einfaches Heuristik-Mapping
    const title =
      ld?.headline ||
      ld?.name ||
      clean(og.title) ||
      "Instagram-Import";
    const image = firstString(ld?.image) || og.image || "";
    const text =
      ld?.description || og.description || "";

    // Minimales Rezeptobjekt – Zutaten/Schritte versuchen wir heuristisch
    const ingredients = guessIngredients(text);
    const steps = guessSteps(text);

    const out = {
      title,
      image,
      ingredients,
      steps,
      tags: ["Import"],
      source: url,
      macros: null,
    };

    return j(200, out);
  } catch (err) {
    // Niemals „Unexpected end of JSON input“ durchreichen – sauber antworten
    return j(500, { error: "Extraktion fehlgeschlagen", detail: String(err?.message || err) });
  }
}

// ---------- Hilfsfunktionen ----------

function j(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

// zieht <meta property="og:*" content="...">
function meta(html, prop) {
  const re = new RegExp(
    `<meta\\s+(?:property|name)=["']${escapeRx(prop)}["'][^>]*?content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  return m ? decode(m[1]) : "";
}

function pickLdJson(html) {
  // nimm das erste <script type="application/ld+json">...</script>
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i;
  const m = html.match(re);
  if (!m) return null;
  const raw = m[1].trim();
  // Manche Seiten enthalten mehrere JSON-Objekte hintereinander – safe parse:
  try {
    return JSON.parse(stripDangerous(raw));
  } catch {
    // Versuche, erstes Objekt herauszuschneiden
    const firstObj = firstJsonBlock(raw);
    if (firstObj) {
      try { return JSON.parse(firstObj); } catch { /* ignore */ }
    }
  }
  return null;
}

function firstJsonBlock(s) {
  let depth = 0, start = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") { if (start === -1) start = i; depth++; }
    else if (c === "}") { depth--; if (depth === 0 && start !== -1) return s.slice(start, i + 1); }
  }
  return null;
}

function textBetween(h, a, b) {
  const i = h.indexOf(a);
  if (i < 0) return "";
  const j = h.indexOf(b, i + a.length);
  if (j < 0) return "";
  return clean(h.slice(i + a.length, j));
}

function clean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function escapeRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function stripDangerous(s) {
  // Entfernt HTML-Kommentare & <script> in JSON-Blobs (kommt selten vor)
  return s.replace(/<!--[\s\S]*?-->/g, "").replace(/<\/?script[^>]*>/gi, "");
}

function firstString(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return firstString(x[0]);
  if (typeof x === "object" && x.url) return x.url;
  return "";
}

// super einfache Heuristiken:
function guessIngredients(desc) {
  if (!desc) return [];
  // split an Sätzen, picke Zeilen mit Gramm/Stk/ml usw.
  return desc
    .split(/[\r\n\.]+/)
    .map(s => clean(s))
    .filter(s => /\b(\d+(?:[.,]\d+)?\s?(g|ml|stk|stück|l|tl|el))\b/i.test(s))
    .slice(0, 12);
}

function guessSteps(desc) {
  if (!desc) return [];
  const lines = desc.split(/[\r\n]+/).map(clean).filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, 8);
  // Fallback: Punkte
  const parts = desc.split(/[.!?]+/).map(clean).filter(Boolean);
  return parts.slice(0, 8);
}
