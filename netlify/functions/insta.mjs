// netlify/functions/insta.mjs
export async function handler(event) {
  const raw = event.queryStringParameters?.url || "";
  const url = decodeURIComponent(raw).trim();

  if (!url) {
    return json(400, { error: "Bitte eine Instagram-URL übergeben (?url=...)." });
  }

  let ok = false;
  try {
    const u = new URL(url);
    const hostOK = /(?:^|\.)instagram\.com$|^instagr\.am$/.test(u.hostname);
    const pathOK = /^\/(?:p|reel|reels)\//.test(u.pathname); // <-- Reels erlaubt
    ok = hostOK && pathOK;
  } catch (_) {}

  if (!ok) {
    return json(400, {
      error:
        "Bitte einen gültigen Instagram-Link senden (z.B. https://www.instagram.com/p/..., /reel/... oder /reels/...).",
    });
  }

  // Einfach an den bewährten Extract-Parser weiterleiten
  const target = `/.netlify/functions/extract?url=${encodeURIComponent(url)}`;
  return {
    statusCode: 302,
    headers: { Location: target },
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}
