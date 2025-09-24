// netlify/functions/insta.mjs
// Holt Instagram-Daten per offizieller oEmbed-API (erfordert META_APP_ID & META_CLIENT_TOKEN).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const APP_ID = process.env.META_APP_ID;
const CLIENT_TOKEN = process.env.META_CLIENT_TOKEN;

export async function handler(event) {
  try {
    const urlParam =
      event.httpMethod === "POST"
        ? JSON.parse(event.body || "{}").url
        : event.queryStringParameters?.url;

    if (!urlParam) return j(400, { error: "Bitte ?url=… angeben." });

    if (!APP_ID || !CLIENT_TOKEN) {
      return j(500, { error: "Server: META_APP_ID oder META_CLIENT_TOKEN fehlt." });
    }

    const postUrl = decodeURIComponent(urlParam);
    // Instagram akzeptiert Posts /p/... und Reels /reel/...
    if (!/^https?:\/\/(www\.)?instagram\.com\/(p|reel)\//i.test(postUrl)) {
      return j(400, { error: "Bitte einen gültigen Instagram-Post- oder Reel-Link senden." });
    }

    const token = `${APP_ID}|${CLIENT_TOKEN}`;
    const api = new URL("https://graph.facebook.com/v21.0/instagram_oembed");
    api.searchParams.set("url", postUrl);
    api.searchParams.set("access_token", token);
    api.searchParams.set("omitscript", "true");
    api.searchParams.set("hidecaption", "false");

    const res = await fetch(api, { headers: { "User-Agent": UA } });
    const data = await res.json();

    if (!res.ok) {
      return j(res.status, { error: "oEmbed-Fehler", detail: data?.error || data });
    }

    // data.title  -> Caption-Text
    // data.thumbnail_url -> Vorschaubild (bei Reels wichtig)
    const title = clean(data.author_name ? `${data.author_name}: ${data.title || ""}` : data.title || "Instagram");
    const image = data.thumbnail_url || "";
    const caption = data.title || "";

    const ingredients = guessIngredients(caption);
    const steps = guessSteps(caption);

    return j(200, {
      title: title || "Instagram-Import",
      image,
      ingredients,
      steps,
      tags: ["Import", "Instagram"],
      source: postUrl,
      macros: null,
    });
  } catch (err) {
    return j(500, { error: "Import fehlgeschlagen", detail: String(err?.message || err) });
  }
}

function j(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }

// sehr einfache Heuristiken – kann man später schärfen:
function guessIngredients(text) {
  return (text || "")
    .split(/[\r\n\.]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => /\b(\d+(?:[.,]\d+)?\s?(g|ml|l|stk|stück|tl|el))\b/i.test(s))
    .slice(0, 20);
}
function guessSteps(text) {
  if (!text) return [];
  const byLines = text.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
  if (byLines.length >= 3) return byLines.slice(0, 12);
  const bySent = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  return bySent.slice(0, 12);
}
