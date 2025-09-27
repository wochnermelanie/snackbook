import { parseHTML } from "linkedom";

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

    if (!url || !/^https?:\/\/(www\.)?(instagram\.com)\/+/i.test(url)) {
      return json({ error: "Bitte einen gÃ¼ltigen Instagram-Link senden." }, 400);
    }

    const html = await fetchText(url);
    const payload = extractFromInstagramHTML(html, url);
    return json(payload);
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

function extractFromInstagramHTML(html, sourceUrl) {
  const { document } = parseHTML(html);

  // JSON-LD bevorzugen
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map(s => safeJson(s.textContent))
    .find(x => x && (x["@type"] === "ImageObject" || x["@type"] === "VideoObject" || x["@type"] === "SocialMediaPosting"));

  const og = prop => document.querySelector(`meta[property="${prop}"]`)?.getAttribute("content") || "";

  let title = ld?.headline || og("og:title") || document.title || "Instagram";
  title = (title || "").replace(/\s*â€¢\s*Instagram\s*$/i, "").trim();
  const image = ld?.image?.url || ld?.image || og("og:image") || "";

  return {
    title: title || "Instagram",
    image: image || "",
    ingredients: [],
    steps: [],
    tags: ["Import","instagram"],
    source: sourceUrl,
    macros: null
  };
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

